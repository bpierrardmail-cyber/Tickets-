// Relais des cours de bourse pour l'app Tickets (Cloudflare Worker).
// Il interroge Yahoo Finance côté serveur et renvoie les données avec l'autorisation CORS,
// pour que l'app puisse chercher une action / un ETF par son nom et lire son cours.
//   GET /search?q=lvmh            -> { results: [{ symbol, name, exch, type }] }
//   GET /quote?symbols=MC.PA,AAPL -> { quotes: { "MC.PA": { price, prev, currency, name } } }
//   GET /crypto/search?q=sol       -> recherche CoinGecko (secours quand l'app est limitée par CoinGecko)
//   GET /crypto/price?ids=solana   -> cours CoinGecko en € (+ variation 24 h)
// Aucune clé ni donnée personnelle : seuls des noms de titres transitent.

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
      if (url.pathname === "/crypto/search") {
        const q = (url.searchParams.get("q") || "").trim().slice(0, 60);
        if (!q) return json({ coins: [] }, 3600);
        const d = await getJSON("https://api.coingecko.com/api/v3/search?query=" + encodeURIComponent(q), 3600);
        if (!d || !Array.isArray(d.coins)) return json({ error: "indisponible" }, 5);
        return json({ coins: d.coins.slice(0, 10).map(c => ({ id: c.id, name: c.name, symbol: c.symbol, thumb: c.thumb, market_cap_rank: c.market_cap_rank })) }, 3600);
      }
      if (url.pathname === "/crypto/price") {
        const ids = (url.searchParams.get("ids") || "").split(",").map(s => s.trim().toLowerCase()).filter(s => /^[a-z0-9-]{1,80}$/.test(s)).slice(0, 50);
        if (!ids.length) return json({}, 60);
        const d = await getJSON("https://api.coingecko.com/api/v3/simple/price?ids=" + encodeURIComponent(ids.join(",")) + "&vs_currencies=eur&include_24hr_change=true", 60);
        if (!d || d.status || d.error) return json({ error: "indisponible" }, 5);
        return json(d, 60);
      }
      if (url.pathname === "/quote") {
        const syms = (url.searchParams.get("symbols") || "").split(",").map(s => s.trim()).filter(Boolean).slice(0, 40);
        const out = {};
        await Promise.all(syms.map(async s => { try { const q = await quote(s); if (q) out[s] = q; } catch (e) {} }));
        return json({ quotes: out }, 60);
      }
      return json({ ok: true, usage: ["/search?q=lvmh", "/quote?symbols=MC.PA,AAPL", "/crypto/search?q=sol", "/crypto/price?ids=solana"] }, 300);
    } catch (e) {
      return json({ error: String((e && e.message) || e) }, 5);
    }
  },
};
