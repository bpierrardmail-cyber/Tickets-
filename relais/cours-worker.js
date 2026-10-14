// Relais des cours de bourse pour l'app Tickets (Cloudflare Worker).
// Il interroge Yahoo Finance côté serveur et renvoie les données avec l'autorisation CORS,
// pour que l'app puisse chercher une action / un ETF par son nom et lire son cours.
//   GET /search?q=lvmh            -> { results: [{ symbol, name, exch, type }] }
//   GET /quote?symbols=MC.PA,AAPL -> { quotes: { "MC.PA": { price, prev, currency, name } } }
// Aucune clé ni donnée personnelle : seuls des noms de titres transitent.
//
//   GET /etoro        (protégé par APP_SECRET) -> portefeuille eToro + noms des titres + cours en direct
//   GET /etoro/check  (protégé par APP_SECRET) -> diagnostic sans montants
// Les clés eToro sont des variables SECRÈTES du Worker (jamais dans ce code) :
//   ETORO_API_KEY, ETORO_USER_KEY, APP_SECRET

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};
const UA = { "User-Agent": "Mozilla/5.0 (compatible; TicketsApp/1.0)", "Accept": "application/json" };
const TYPES_OK = ["EQUITY", "ETF", "MUTUALFUND", "INDEX"];

function json(obj, ttl) {
  return new Response(JSON.stringify(obj), {
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=" + (ttl || 60) },
  });
}

async function getJSON(url, ttl) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, { headers: UA, signal: ctrl.signal, redirect: "follow", cf: { cacheTtl: ttl, cacheEverything: true } });
    const txt = await r.text();
    try { return JSON.parse(txt); } catch (e) { throw new Error("HTTP " + r.status + " : " + txt.slice(0, 120)); }
  } finally { clearTimeout(timer); }
}

async function search(q) {
  const qs = "/v1/finance/search?q=" + encodeURIComponent(q) + "&quotesCount=12&newsCount=0&listsCount=0&lang=fr-FR&region=FR";
  let d, lastErr;
  for (const host of ["https://query2.finance.yahoo.com", "https://query1.finance.yahoo.com"]) {
    try { d = await getJSON(host + qs, 3600); break; } catch (e) { lastErr = e; }
  }
  if (!d) throw lastErr || new Error("recherche indisponible");
  return (d.quotes || [])
    .filter(x => x && x.symbol && TYPES_OK.includes(x.quoteType))
    .map(x => ({ symbol: x.symbol, name: x.longname || x.shortname || x.symbol, exch: x.exchDisp || x.exchange || "", type: x.typeDisp || x.quoteType }));
}

async function quote(symbol) {
  const u = "https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(symbol) + "?range=1d&interval=1d";
  const d = await getJSON(u, 60);
  const m = d && d.chart && d.chart.result && d.chart.result[0] && d.chart.result[0].meta;
  if (!m || m.regularMarketPrice == null) return null;
  const prev = m.chartPreviousClose != null ? m.chartPreviousClose : (m.previousClose != null ? m.previousClose : null);
  return { price: m.regularMarketPrice, prev: prev, currency: m.currency || "USD", name: m.longName || m.shortName || symbol };
}

// ---------- eToro (API officielle) ----------
const ETORO = "https://public-api.etoro.com/api/v1";
async function etoroGet(env, path) {
  const r = await fetch(ETORO + path, { headers: {
    "x-api-key": env.ETORO_API_KEY, "x-user-key": env.ETORO_USER_KEY,
    "x-request-id": crypto.randomUUID(), "Accept": "application/json" } });
  const t = await r.text();
  let j; try { j = JSON.parse(t); } catch (e) { j = null; }
  if (!r.ok || j === null) throw new Error("eToro " + path.split("?")[0] + " : HTTP " + r.status + " " + t.slice(0, 160));
  return j;
}
function instrumentIdsOf(cp) {
  const ids = new Set();
  const add = p => { const id = p && (p.instrumentID != null ? p.instrumentID : p.instrumentId); if (id != null) ids.add(id); };
  (cp.positions || []).forEach(add);
  (cp.mirrors || []).forEach(m => (m.positions || []).forEach(add));
  return [...ids];
}
async function etoroInChunks(env, path, ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 50) {
    const j = await etoroGet(env, path + "?instrumentIds=" + ids.slice(i, i + 50).join(","));
    out.push(j);
  }
  return out;
}
async function etoroFull(env) {
  const pf = await etoroGet(env, "/trading/info/portfolio");
  const cp = pf.clientPortfolio || pf;
  const ids = instrumentIdsOf(cp);
  let instruments = [], rates = [], errors = [];
  try { instruments = await etoroInChunks(env, "/market-data/instruments", ids); } catch (e) { errors.push(String(e.message || e)); }
  try { rates = await etoroInChunks(env, "/market-data/instruments/rates", ids); } catch (e) { errors.push(String(e.message || e)); }
  return { portfolio: pf, instruments, rates, errors, t: Date.now() };
}
function etoroAllowed(request, env, url) {
  const k = request.headers.get("x-app-secret") || url.searchParams.get("k") || "";
  return !!env.APP_SECRET && k === env.APP_SECRET;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    try {
      if (url.pathname === "/search") {
        const q = (url.searchParams.get("q") || "").trim().slice(0, 60);
        try { return json({ results: q ? await search(q) : [] }, 3600); }
        catch (e) { return json({ results: [], error: String((e && e.message) || e) }, 5); }
      }
      if (url.pathname === "/etoro" || url.pathname === "/etoro/check") {
        if (!env || !env.ETORO_API_KEY || !env.ETORO_USER_KEY || !env.APP_SECRET) return json({ error: "not_configured" }, 5);
        if (!etoroAllowed(request, env, url)) return json({ error: "unauthorized" }, 5);
        try {
          const full = await etoroFull(env);
          if (url.pathname === "/etoro") return json(full, 30);
          const cp = full.portfolio.clientPortfolio || full.portfolio;
          const first = a => (Array.isArray(a) && a.length) ? a[0] : null;
          const inst0 = first(full.instruments), rate0 = first(full.rates);
          return json({
            ok: true,
            portfolioKeys: Object.keys(cp || {}),
            positions: (cp.positions || []).length,
            positionKeys: Object.keys(first(cp.positions) || {}),
            mirrors: (cp.mirrors || []).map(m => ({ parentUsername: m.parentUsername, positions: (m.positions || []).length, keys: Object.keys(m) })),
            instrumentsShape: inst0 ? JSON.stringify(inst0).slice(0, 600) : null,
            ratesShape: rate0 ? JSON.stringify(rate0).slice(0, 600) : null,
            errors: full.errors,
          }, 5);
        } catch (e) { return json({ error: String((e && e.message) || e) }, 5); }
      }
      if (url.pathname === "/quote") {
        const syms = (url.searchParams.get("symbols") || "").split(",").map(s => s.trim()).filter(Boolean).slice(0, 40);
        const out = {};
        await Promise.all(syms.map(async s => { try { const q = await quote(s); if (q) out[s] = q; } catch (e) {} }));
        return json({ quotes: out }, 60);
      }
      return json({ ok: true, usage: ["/search?q=lvmh", "/quote?symbols=MC.PA,AAPL"] }, 300);
    } catch (e) {
      return json({ error: String((e && e.message) || e) }, 5);
    }
  },
};
