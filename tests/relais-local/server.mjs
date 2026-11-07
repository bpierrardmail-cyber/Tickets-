// Banc d'essai local du relais : le vrai code du Worker et du Durable Object, avec un stockage SQLite en mémoire.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
const SRC = process.argv[2];
const here = path.dirname(new URL(import.meta.url).pathname);
for (const f of ["cours-worker.js", "foyer.js"]) fs.copyFileSync(path.join(SRC, f), path.join(here, "w_" + f));
let code = fs.readFileSync(path.join(here, "w_cours-worker.js"), "utf8").replace('"./foyer.js"', '"./w_foyer.js"');
fs.writeFileSync(path.join(here, "w_cours-worker.js"), code);
const { default: worker, Foyer, Garde } = await import("./w_cours-worker.js");

class Cursor { constructor(r) { this.r = r; } toArray() { return this.r; } one() { if (this.r.length !== 1) throw new Error("one() : " + this.r.length + " lignes"); return this.r[0]; } [Symbol.iterator]() { return this.r[Symbol.iterator](); } }
function storage() {
  const db = new DatabaseSync(":memory:");
  return {
    sql: { exec(q, ...b) { return new Cursor(db.prepare(q).all(...b)); } },
    alarm: null, setAlarm(t) { this.alarm = t; }, deleteAlarm() { this.alarm = null; },
    transactionSync(fn) { db.exec("BEGIN"); try { const r = fn(); db.exec("COMMIT"); return r; } catch (e) { db.exec("ROLLBACK"); throw e; } },
  };
}
const objs = new Map();
function ns(Cls, pre) {
  return { idFromName: n => pre + n,
    get: id => ({ fetch: (u, init) => { if (!objs.has(id)) objs.set(id, new Cls({ storage: storage() }, env)); return objs.get(id).fetch(new Request(u, init)); } }) };
}
const env = { FOYER: ns(Foyer, ""), GARDE: ns(Garde, "garde:") };
// essais : /__test/alarm?fid=… avance l'horloge de « jours » et lance l'alarme du foyer ; /__test/stats compte les requêtes
const realNow = Date.now; let shift = 0; Date.now = () => realNow() + shift;
let reqs = 0, paths = {};
http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks);
  const r = new Request("http://localhost" + req.url, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : body });
  if (req.url.startsWith("/__test/")) {
    const u = new URL("http://x" + req.url);
    if (u.pathname === "/__test/stats") { res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }); res.end(JSON.stringify({ reqs, paths })); return; }
    if (u.pathname === "/__test/reset") { reqs = 0; paths = {}; if (u.searchParams.get("clock")) shift = 0; res.writeHead(200, { "Access-Control-Allow-Origin": "*" }); res.end("ok"); return; }
    if (u.pathname === "/__test/alarm") {
      shift += Number(u.searchParams.get("days") || 0) * 86400000;
      const o = objs.get(u.searchParams.get("fid")); let out = "absent";
      if (o) { await o.alarm(); out = o.meta("otok") ? "garde" : "efface"; }
      res.writeHead(200, { "Access-Control-Allow-Origin": "*" }); res.end(out); return;
    }
  }
  reqs++; const pk = req.method + " " + req.url.split("?")[0].replace(/\/(snap|member)\/[^/]+$/, "/$1/:id"); paths[pk] = (paths[pk] || 0) + 1;
  try {
    const out = await worker.fetch(r, env);
    const h = {}; out.headers.forEach((v, k) => { h[k] = v; });
    res.writeHead(out.status, h); res.end(Buffer.from(await out.arrayBuffer()));
  } catch (e) { res.writeHead(500); res.end(String(e && e.stack || e)); }
  if (process.env.LOG) console.log(req.method, req.url, "->", res.statusCode);
}).listen(Number(process.env.PORT || 8787), () => console.log("relais local prêt"));
