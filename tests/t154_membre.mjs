// Faux membre (relais LOCAL seulement, données inventées) pour t154 : rejoint avec l'invitation puis envoie les envois donnés.
// node t154_membre.mjs "TK1.<fid>.<mid>.<inv>.<km>" '<JSON : liste d'objets à chiffrer et envoyer>'
import { webcrypto as crypto } from "node:crypto";
const API = "http://localhost:8787/foyer";
const [, fid, mid, inv, km] = process.argv[2].match(/TK1\.([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{8,16})\.([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{43})/);
const sends = JSON.parse(process.argv[3] || "[]");
const b64u = b => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = s => new Uint8Array(Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64"));
const sha = async s => b64u(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
async function seal(obj) {
  const gz = new Uint8Array(await new Response(new Blob([JSON.stringify(obj)]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer());
  const k = await crypto.subtle.importKey("raw", unb64u(km), "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, gz));
  const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12);
  return "g1." + b64u(out);
}
const tok = b64u(crypto.getRandomValues(new Uint8Array(24)));
let r = await fetch(API + "/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fid, mid, inv, tok: await sha(tok) }) });
console.log("join", r.status);
const auth = "Bearer " + fid + "." + mid + "." + tok;
for (const o of sends) {
  r = await fetch(API + "/inbox", { method: "POST", headers: { "Content-Type": "application/json", Authorization: auth }, body: JSON.stringify({ v: await seal(o) }) });
  console.log("inbox", r.status);
}
