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
const { default: worker, Foyer } = await import("./w_cours-worker.js");

class Cursor { constructor(r) { this.r = r; } toArray() { return this.r; } one() { if (this.r.length !== 1) throw new Error("one() : " + this.r.length + " lignes"); return this.r[0]; } [Symbol.iterator]() { return this.r[Symbol.iterator](); } }
function storage() {
  const db = new DatabaseSync(":memory:");
  return {
    sql: { exec(q, ...b) { return new Cursor(db.prepare(q).all(...b)); } },
    transactionSync(fn) { db.exec("BEGIN"); try { const r = fn(); db.exec("COMMIT"); return r; } catch (e) { db.exec("ROLLBACK"); throw e; } },
  };
}
const objs = new Map();
const env = {
  FOYER: {
    idFromName: n => n,
    get: id => ({ fetch: (u, init) => { if (!objs.has(id)) objs.set(id, new Foyer({ storage: storage() }, env)); return objs.get(id).fetch(new Request(u, init)); } }),
  },
};
let reqs = 0;
http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks);
  const r = new Request("http://localhost" + req.url, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : body });
  reqs++;
  try {
    const out = await worker.fetch(r, env);
    const h = {}; out.headers.forEach((v, k) => { h[k] = v; });
    res.writeHead(out.status, h); res.end(Buffer.from(await out.arrayBuffer()));
  } catch (e) { res.writeHead(500); res.end(String(e && e.stack || e)); }
  if (process.env.LOG) console.log(req.method, req.url, "->", res.statusCode);
}).listen(Number(process.env.PORT || 8787), () => console.log("relais local prêt"));
