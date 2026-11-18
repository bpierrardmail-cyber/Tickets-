# Rejoue un fichier « banc-lecture-AAAA-MM-JJ.json » (Menu › Aide › Tester la lecture, version Perso) dans l'appli :
# les morceaux ML Kit lus sur le téléphone repassent par mlkitRows et parseTicket de beta/index.html, et chaque ticket
# est comparé à ce qui avait été enregistré. Sert à corriger la lecture sans le téléphone.
# Le fichier contient de vrais tickets : le garder HORS du dépôt (public). En faire des tickets inventés pour tests/donnees.
# Usage : python3 outils/banc_rejouer.py /chemin/banc-lecture.json [--ko]   (--ko : seulement ce qui est à revoir)
import sys, os, json
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, os.path.join(ROOT, "tests"))
from playwright.sync_api import sync_playwright
import horloge
if len(sys.argv)<2: print(__doc__ or "usage : banc_rejouer.py fichier.json [--ko]"); sys.exit(2)
B=json.load(open(sys.argv[1], encoding="utf-8")); KO="--ko" in sys.argv
T=B["tickets"]; ents=[]; order=[]
for i, t in enumerate(T):
    e=dict(t["enregistre"]); arts=e.pop("articles", [])
    e.update({"id":5000+i, "payePar":"Moi", "articles":[{"label":a["lu"], "prix":a["prix"], "produit":a["article"]} for a in arts]})
    if not e.get("pay"): e.pop("pay", None)
    ents.append(e)
idx=sorted(range(len(T)), key=lambda i: T[i]["enregistre"]["date"], reverse=True)   # ordre de lecture de l'appli
queue=[]
for i in idx:
    for pgx in T[i]["pages"]: queue.append({"lines":pgx["morceaux"], "width":pgx["width"], "height":pgx["height"]})
NP=[len(T[i]["pages"]) for i in range(len(T))]
CAP="window.__ml=%s; window.Capacitor={ isNativePlatform:function(){ return true; }, Plugins:{ TicketOcr:{ recognize:function(){ return Promise.resolve(window.__ml.shift()||{lines:[]}); } } } };"%json.dumps(queue)
data={"askName":False,"devise":"EUR","comptes":[{"key":"Moi","nom":"Compte","payer":"Moi","main":True}],"entries":ents}
SEED="""np=>new Promise(res=>{ const c=document.createElement('canvas'); c.width=40; c.height=60; c.getContext('2d').fillRect(0,0,20,20);
  c.toBlob(b=>{ const rq=indexedDB.open('ticketsdb',2); rq.onsuccess=()=>{ const tx=rq.result.transaction('orig','readwrite');
    np.forEach((n,i)=>tx.objectStore('orig').put({b:Array(Math.max(1,n)).fill(b), s:b.size}, String(5000+i))); tx.oncomplete=()=>res(true); }; }, 'image/jpeg'); })"""
with sync_playwright() as p:
    br=p.chromium.launch(); c=br.new_context(viewport={'width':412,'height':900}, accept_downloads=True); c.add_init_script(CAP)
    pg=c.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    pg.goto('file://'+ROOT+'/beta/index.html'); pg.wait_for_timeout(400)
    pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); pg.reload(); pg.wait_for_timeout(900)
    pg.evaluate(SEED, NP); pg.reload(); pg.wait_for_timeout(1200)
    pg.locator("#hmenu").click(); pg.wait_for_timeout(300); pg.locator('.mnsub[data-ms="aide"]').click(); pg.wait_for_timeout(300)
    pg.get_by_text("Tester la lecture sur mes tickets").click(); pg.wait_for_timeout(400)
    pg.locator("#bcGo").click(); pg.wait_for_selector("#bcRes", timeout=600000)
    with pg.expect_download() as dl: pg.locator("#bcExp").click()
    R=json.load(open(dl.value.path(), encoding="utf-8")); br.close()
print("Avant (téléphone) : %d/%d bien lus · maintenant : %d/%d"%(B.get("ok",0), B["n"], R["ok"], R["n"]))
for j, t in enumerate(R["tickets"]):
    sm=" (petite photo)" if T[idx[j]].get("petite") else ""
    if KO and t["ok"].get("ok"): continue
    e=t["enregistre"]; l=t["lu"] or {}; k=t["ok"]
    bad=[n for n in ("total","marchand","date","arts") if k.get(n) is False]
    print(("OK  " if k.get("ok") else "KO  ")+"%s %s %.2f%s"%(e["date"], e["marchand"], e["montant"] or 0, sm)+("" if not bad else "  → lu : "+" · ".join(
        {"total":"total %s"%l.get("total"), "marchand":"magasin %r"%l.get("marchand"), "date":"date %s"%l.get("date"), "arts":"%d articles sur %d"%(len(l.get("articles",[])), len([a for a in e["articles"] if not a["lu"].endswith(" · ticket entier")]))}[n] for n in bad)))
if errs: print("Erreurs JS :", errs[:3])
