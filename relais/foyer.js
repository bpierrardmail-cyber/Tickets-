// Foyer partagé de l'app Tickets : une boîte aux lettres chiffrée par foyer (Durable Object, stockage SQLite).
// Le serveur ne voit jamais les données en clair : tout est chiffré sur les téléphones (AES-GCM) avant l'envoi.
//
// Qui fait quoi :
//   - le propriétaire (le téléphone qui a créé le foyer) garde toutes les données. Il dépose pour chaque membre
//     une copie chiffrée avec la clé de ce membre, limitée à ce qu'il a choisi (onglets, comptes) ;
//   - un membre en « consultation » lit seulement sa copie ;
//   - un membre en « modification » lit sa copie et envoie ses changements dans la boîte du foyer ;
//     le propriétaire les fusionne (la modification la plus récente gagne) et met les copies à jour ;
//   - retirer un membre efface son accès, sa copie et ses envois : sa clé ne sert plus à rien.
//
// Authentification : « Authorization: Bearer <foyer>.<membre ou o>.<jeton> ». Le serveur ne garde que l'empreinte
// SHA-256 des jetons et des secrets d'invitation.
//
//   POST   /foyer/create          { fid, otok }                 crée le foyer (otok = empreinte du jeton du propriétaire)
//   POST   /foyer/join            { fid, mid, inv, tok }         rejoint avec une invitation (inv = secret du QR code)
//   GET    /foyer/me                                            { role } (membre) ou { role:"owner" }
//   GET    /foyer/members                         propriétaire  membres, invitations en attente
//   PUT    /foyer/member/:id      { role, inv, exp } propriétaire  nouvelle invitation (à usage unique, limitée dans le temps)
//   PATCH  /foyer/member/:id      { role }       propriétaire  change les droits
//   DELETE /foyer/member/:id                     propriétaire  retire le membre (accès, copie et envois effacés)
//   PUT    /foyer/snap/:id        { v }          propriétaire  copie chiffrée du membre
//   GET    /foyer/snap?since=t                   membre        sa copie (204 si rien de neuf)
//   POST   /foyer/inbox           { v }          membre « modification » : envoie des changements
//   GET    /foyer/inbox                          propriétaire  changements reçus
//   POST   /foyer/inbox/ack       { upto }       propriétaire  changements traités
//   PUT    /foyer/blob/full       { v }          propriétaire  copie de secours (récupérable avec le code de secours)
//   GET    /foyer/blob/full                      propriétaire
//   POST   /foyer/leave                          membre        quitte le foyer
//   DELETE /foyer                                propriétaire  arrête le partage (tout est effacé)

const FCORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};
const RE_FID = /^[A-Za-z0-9_-]{22}$/;
const RE_MID = /^[A-Za-z0-9_-]{8,16}$/;
const RE_TOK = /^[A-Za-z0-9_-]{22,64}$/;
const RE_HASH = /^[A-Za-z0-9_-]{43}$/;
const ROLES = ["view", "edit"];
const CHUNK = 900000;                // une ligne SQLite : 2 Mo au plus
const MAX_BLOB = 12 * 1024 * 1024;   // une copie chiffrée (texte base64)
const MAX_TOTAL = 40 * 1024 * 1024;  // tout le foyer
const MAX_MEMBERS = 20;
const MAX_INBOX = 400;               // envois en attente par membre
const INVITE_MAX = 30 * 60 * 1000;   // une invitation dure 30 min au plus

function fjson(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { ...FCORS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function sha(s) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  let b = "";
  new Uint8Array(d).forEach(x => { b += String.fromCharCode(x); });
  return btoa(b).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Point d'entrée du Worker pour /foyer/* : trouve le foyer et lui passe la requête. */
export async function handleFoyer(request, env) {
  if (request.method === "OPTIONS") return new Response(null, { headers: FCORS });
  if (!env.FOYER) return fjson({ error: "indisponible" }, 503);
  const url = new URL(request.url);
  let fid = "";
  const auth = request.headers.get("Authorization") || "";
  const m = auth.match(/^Bearer ([A-Za-z0-9_-]{22})\./);
  if (m) fid = m[1];
  let body = null;
  if (request.method !== "GET" && request.method !== "DELETE") {
    const len = Number(request.headers.get("Content-Length") || 0);
    if (len > MAX_BLOB + 4096) return fjson({ error: "trop gros" }, 413);
    const txt = await request.text();
    if (txt.length > MAX_BLOB + 4096) return fjson({ error: "trop gros" }, 413);
    try { body = txt ? JSON.parse(txt) : {}; } catch (e) { return fjson({ error: "json" }, 400); }
    if (!fid && body && typeof body.fid === "string") fid = body.fid;
  }
  if (!RE_FID.test(fid)) return fjson({ error: "foyer" }, 400);
  const stub = env.FOYER.get(env.FOYER.idFromName(fid));
  return stub.fetch("https://foyer/" + url.pathname.replace(/^\/foyer\/?/, "") + url.search, {
    method: request.method,
    headers: { "Authorization": auth, "Content-Type": "application/json", "X-Fid": fid },
    body: body === null ? undefined : JSON.stringify(body),
  });
}

export class Foyer {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS members (id TEXT PRIMARY KEY, role TEXT, tok TEXT, inv TEXT, exp INTEGER, joined INTEGER, seen INTEGER, created INTEGER)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS blobs (name TEXT, part INTEGER, v TEXT, t INTEGER, PRIMARY KEY (name, part))`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS inbox (seq INTEGER PRIMARY KEY AUTOINCREMENT, mid TEXT, v TEXT, t INTEGER)`);
  }

  meta(k) { const r = this.sql.exec("SELECT v FROM meta WHERE k = ?", k).toArray(); return r.length ? r[0].v : null; }
  setMeta(k, v) { this.sql.exec("INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v", k, String(v)); }
  member(id) { const r = this.sql.exec("SELECT * FROM members WHERE id = ?", id).toArray(); return r.length ? r[0] : null; }

  getBlob(name) {
    const rows = this.sql.exec("SELECT part, v, t FROM blobs WHERE name = ? ORDER BY part", name).toArray();
    if (!rows.length) return null;
    return { v: rows.map(r => r.v).join(""), t: rows[0].t };
  }
  putBlob(name, v) {
    if (typeof v !== "string" || !v || v.length > MAX_BLOB) return "taille";
    const used = this.sql.exec("SELECT COALESCE(SUM(LENGTH(v)), 0) AS n FROM blobs WHERE name != ?", name).one().n;
    if (used + v.length > MAX_TOTAL) return "plein";
    const t = Date.now();
    this.ctx.storage.transactionSync(() => {
      this.sql.exec("DELETE FROM blobs WHERE name = ?", name);
      for (let i = 0, p = 0; i < v.length; i += CHUNK, p++) this.sql.exec("INSERT INTO blobs (name, part, v, t) VALUES (?, ?, ?, ?)", name, p, v.slice(i, i + CHUNK), t);
    });
    return t;
  }
  dropMember(id) {
    this.ctx.storage.transactionSync(() => {
      this.sql.exec("DELETE FROM members WHERE id = ?", id);
      this.sql.exec("DELETE FROM blobs WHERE name = ?", "snap:" + id);
      this.sql.exec("DELETE FROM inbox WHERE mid = ?", id);
    });
  }

  /** Qui appelle ? { owner:true } ou { member } ; null si le jeton ne va pas ; "gone" si le foyer ou le membre n'existe plus. */
  async who(request) {
    const a = (request.headers.get("Authorization") || "").match(/^Bearer ([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{1,16})\.([A-Za-z0-9_-]{22,64})$/);
    if (!a) return null;
    const otok = this.meta("otok");
    if (!otok) return "gone";
    const h = await sha(a[3]);
    if (a[2] === "o") return h === otok ? { owner: true } : null;
    const m = this.member(a[2]);
    if (!m || !m.tok) return "gone";
    if (m.tok !== h) return null;
    const now = Date.now();
    if (!m.seen || now - m.seen > 60000) this.sql.exec("UPDATE members SET seen = ? WHERE id = ?", now, m.id);
    return { member: m };
  }

  async fetch(request) {
    try { return await this.route(request); }
    catch (e) { return fjson({ error: String((e && e.message) || e) }, 500); }
  }

  async route(request) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/+|\/+$/g, "");
    const parts = path ? path.split("/") : [];
    const method = request.method;
    const body = (method === "GET" || method === "DELETE") ? {} : await request.json().catch(() => ({}));
    const now = Date.now();

    // ----- sans jeton : créer, rejoindre -----
    if (method === "POST" && path === "create") {
      if (!RE_HASH.test(body.otok || "")) return fjson({ error: "jeton" }, 400);
      const cur = this.meta("otok");
      if (cur && cur !== body.otok) return fjson({ error: "existe" }, 409);
      if (!cur) { this.setMeta("otok", body.otok); this.setMeta("created", now); }
      return fjson({ ok: true, now });
    }
    if (method === "POST" && path === "join") {
      if (!RE_MID.test(body.mid || "") || !RE_TOK.test(body.inv || "") || !RE_HASH.test(body.tok || "")) return fjson({ error: "invitation" }, 400);
      if (!this.meta("otok")) return fjson({ error: "gone" }, 410);
      const m = this.member(body.mid);
      if (!m || m.tok || !m.inv || m.exp < now || m.inv !== await sha(body.inv)) return fjson({ error: "invitation" }, 403);
      this.sql.exec("UPDATE members SET tok = ?, inv = NULL, exp = NULL, joined = ?, seen = ? WHERE id = ?", body.tok, now, now, m.id);
      return fjson({ ok: true, role: m.role, now });
    }

    const w = await this.who(request);
    if (w === "gone") return fjson({ error: "gone" }, 410);
    if (!w) return fjson({ error: "auth" }, 401);

    if (method === "GET" && path === "me") return fjson(w.owner ? { role: "owner", now } : { role: w.member.role, id: w.member.id, now });

    // ----- membre -----
    if (w.member) {
      const m = w.member;
      if (method === "GET" && path === "snap") {
        const since = Number(url.searchParams.get("since") || 0);
        const t = this.sql.exec("SELECT t FROM blobs WHERE name = ? AND part = 0", "snap:" + m.id).toArray();
        if (!t.length) return fjson({ none: true, now });
        if (since && t[0].t === since) return new Response(null, { status: 204, headers: { ...FCORS, "Cache-Control": "no-store" } });
        const b = this.getBlob("snap:" + m.id);
        return fjson({ v: b.v, t: b.t, now });
      }
      if (method === "POST" && path === "inbox") {
        if (m.role !== "edit") return fjson({ error: "consultation" }, 403);
        if (typeof body.v !== "string" || !body.v || body.v.length > 2 * 1024 * 1024) return fjson({ error: "taille" }, 400);
        const n = this.sql.exec("SELECT COUNT(*) AS n FROM inbox WHERE mid = ?", m.id).one().n;
        if (n >= MAX_INBOX) return fjson({ error: "plein" }, 429);
        const r = this.sql.exec("INSERT INTO inbox (mid, v, t) VALUES (?, ?, ?) RETURNING seq", m.id, body.v, now).one();
        return fjson({ seq: r.seq, now });
      }
      if (method === "POST" && path === "leave") { this.dropMember(m.id); return fjson({ ok: true, now }); }
      return fjson({ error: "interdit" }, 403);
    }

    // ----- propriétaire -----
    if (method === "GET" && path === "members") {
      const rows = this.sql.exec("SELECT id, role, tok IS NOT NULL AS joined_ok, exp, joined, seen, created FROM members ORDER BY created").toArray();
      const snaps = {};
      this.sql.exec("SELECT name, t FROM blobs WHERE part = 0 AND name LIKE 'snap:%'").toArray().forEach(r => { snaps[r.name.slice(5)] = r.t; });
      return fjson({
        members: rows.map(r => ({ id: r.id, role: r.role, joined: r.joined_ok ? r.joined : null, pending: !r.joined_ok, exp: r.exp, seen: r.seen, snapT: snaps[r.id] || null })),
        now,
      });
    }
    if (parts[0] === "member" && RE_MID.test(parts[1] || "")) {
      const id = parts[1];
      if (method === "PUT") {
        if (!ROLES.includes(body.role) || !RE_HASH.test(body.inv || "")) return fjson({ error: "paramètres" }, 400);
        const exp = Math.min(Number(body.exp) || 0, now + INVITE_MAX);
        if (exp <= now) return fjson({ error: "expiration" }, 400);
        const ex = this.member(id);
        if (!ex) {
          const n = this.sql.exec("SELECT COUNT(*) AS n FROM members").one().n;
          if (n >= MAX_MEMBERS) return fjson({ error: "plein" }, 429);
          this.sql.exec("INSERT INTO members (id, role, tok, inv, exp, created) VALUES (?, ?, NULL, ?, ?, ?)", id, body.role, body.inv, exp, now);
        } else {
          // nouvelle invitation pour le même membre : l'ancien téléphone perd l'accès
          this.sql.exec("UPDATE members SET role = ?, tok = NULL, inv = ?, exp = ?, joined = NULL WHERE id = ?", body.role, body.inv, exp, id);
        }
        return fjson({ ok: true, exp, now });
      }
      if (method === "PATCH") {
        if (!ROLES.includes(body.role)) return fjson({ error: "paramètres" }, 400);
        if (!this.member(id)) return fjson({ error: "inconnu" }, 404);
        this.sql.exec("UPDATE members SET role = ? WHERE id = ?", body.role, id);
        return fjson({ ok: true, now });
      }
      if (method === "DELETE") { this.dropMember(id); return fjson({ ok: true, now }); }
    }
    if (parts[0] === "snap" && RE_MID.test(parts[1] || "") && method === "PUT") {
      if (!this.member(parts[1])) return fjson({ error: "inconnu" }, 404);
      const t = this.putBlob("snap:" + parts[1], body.v);
      if (typeof t === "string") return fjson({ error: t }, 413);
      return fjson({ ok: true, t, now });
    }
    if (method === "GET" && path === "inbox") {
      const rows = this.sql.exec("SELECT seq, mid, v, t FROM inbox ORDER BY seq LIMIT 200").toArray();
      return fjson({ items: rows, now });
    }
    if (method === "POST" && path === "inbox/ack") {
      const upto = Number(body.upto) || 0;
      this.sql.exec("DELETE FROM inbox WHERE seq <= ?", upto);
      return fjson({ ok: true, now });
    }
    if (path === "blob/full") {
      if (method === "PUT") {
        const t = this.putBlob("full", body.v);
        if (typeof t === "string") return fjson({ error: t }, 413);
        return fjson({ ok: true, t, now });
      }
      if (method === "GET") {
        const b = this.getBlob("full");
        return b ? fjson({ v: b.v, t: b.t, now }) : fjson({ none: true, now });
      }
    }
    if (method === "DELETE" && path === "") {
      this.ctx.storage.transactionSync(() => {
        ["inbox", "blobs", "members", "meta"].forEach(t => this.sql.exec("DELETE FROM " + t));
      });
      return fjson({ ok: true, now });
    }
    return fjson({ error: "inconnu" }, 404);
  }
}
