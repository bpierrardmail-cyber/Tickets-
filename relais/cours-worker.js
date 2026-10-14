// Relais des cours de bourse pour l'app Tickets (Cloudflare Worker).
// Il interroge Yahoo Finance côté serveur et renvoie les données avec l'autorisation CORS,
// pour que l'app puisse chercher une action / un ETF par son nom et lire son cours.
//   GET /search?q=lvmh            -> { results: [{ symbol, name, exch, type }] }
//   GET /quote?symbols=MC.PA,AAPL -> { quotes: { "MC.PA": { price, prev, currency, name } } }
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

async function search(q) {
  const u = "https://query2.finance.yahoo.com/v1/finance/search?q=" + encodeURIComponent(q) +
            "&quotesCount=12&newsCount=0&listsCount=0&lang=fr-FR&region=FR";
  const r = await fetch(u, { headers: UA, cf: { cacheTtl: 3600, cacheEverything: true } });
  const d = await r.json();
  return (d.quotes || [])
    .filter(x => x && x.symbol && TYPES_OK.includes(x.quoteType))
    .map(x => ({ symbol: x.symbol, name: x.longname || x.shortname || x.symbol, exch: x.exchDisp || x.exchange || "", type: x.typeDisp || x.quoteType }));
}

async function quote(symbol) {
  const u = "https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(symbol) + "?range=1d&interval=1d";
  const r = await fetch(u, { headers: UA, cf: { cacheTtl: 60, cacheEverything: true } });
  const d = await r.json();
  const m = d && d.chart && d.chart.result && d.chart.result[0] && d.chart.result[0].meta;
  if (!m || m.regularMarketPrice == null) return null;
  const prev = m.chartPreviousClose != null ? m.chartPreviousClose : (m.previousClose != null ? m.previousClose : null);
  return { price: m.regularMarketPrice, prev: prev, currency: m.currency || "USD", name: m.longName || m.shortName || symbol };
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    try {
      if (url.pathname === "/search") {
        const q = (url.searchParams.get("q") || "").trim().slice(0, 60);
        return json({ results: q ? await search(q) : [] }, 3600);
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
