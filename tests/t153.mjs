// Limite par adresse du relais des cours (08/11, sécurité point 7) : rien ne part vers Yahoo / CoinGecko quand la limite est passée.
// node tests/t153.mjs  (données inventées, aucun réseau : fetch est imité)
import fs from "node:fs"; import path from "node:path"; import os from "node:os";
const here = path.dirname(new URL(import.meta.url).pathname), SRC = path.join(here, "..", "relais");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t153-"));
for (const f of ["cours-worker.js", "foyer.js"]) fs.copyFileSync(path.join(SRC, f), path.join(tmp, f));
let up = 0;
globalThis.fetch = async (u) => { up++; return new Response(JSON.stringify({ quotes: [{ symbol: "MC.PA", shortname: "Essai", quoteType: "EQUITY" }] }), { headers: { "Content-Type": "application/json" } }); };
const { default: w, RL_MAX } = await import(path.join(tmp, "cours-worker.js"));
let fails = 0; const check = (c, m) => { console.log((c ? "OK   " : "FAIL ") + m); if (!c) fails++; };
const get = (p, ip) => w.fetch(new Request("https://relais.test" + p, { headers: ip ? { "CF-Connecting-IP": ip } : {} }), {});
let st = [];
for (let i = 0; i < RL_MAX; i++) st.push((await get("/search?q=essai" + i, "203.0.113.7")).status);
check(st.every(s => s === 200), RL_MAX + " recherches en une minute : acceptées");
const n0 = up, r = await get("/search?q=trop", "203.0.113.7");
check(r.status === 429 && up === n0 && r.headers.get("Access-Control-Allow-Origin") === "*", "au-delà : 429 (lisible par l'appli), rien ne part vers l'extérieur");
check((await get("/search?q=autre", "203.0.113.8")).status === 200, "une autre adresse n'est pas gênée");
check((await get("/search?q=v6", "2001:db8:1:2::5")).status === 200, "IPv6 acceptée");
let k = 0; while ((await get("/quote?symbols=" + Array.from({ length: 40 }, (_, i) => "S" + i).join(","), "198.51.100.9")).status === 200) k++;
check(k > 0 && k <= Math.ceil(RL_MAX / 8), "/quote de 40 titres compte plus (" + k + " acceptées)");
let v6 = 0; for (let i = 0; i < RL_MAX + 5; i++) if ((await get("/search?q=b" + i, "2001:db8:aa:bb:" + (i % 9 + 1) + "::1")).status === 429) v6++;
check(v6 > 0, "IPv6 : tout le bloc /64 compte ensemble");
check((await w.fetch(new Request("https://relais.test/search?q=x", { method: "POST", headers: { "CF-Connecting-IP": "203.0.113.50" } }), {})).status === 405, "seulement GET pour les cours");
check((await get("/search?q=sansip")).status === 200, "sans adresse (banc d'essai local) : pas de limite");
fs.rmSync(tmp, { recursive: true });
console.log("\n" + fails + " échec(s)"); process.exit(fails ? 1 : 0);
