# Banc d'essai de lecture (version Perso, 18/11) : Menu › Aide › « Tester la lecture sur mes tickets » relit la photo d'origine
# de chaque ticket (ML Kit imité), compare à ce qui a été enregistré, liste ce qui est à revoir et exporte un fichier JSON
# (ce que ML Kit a lu + le ticket enregistré, sans photo). Absent de la version Store et du mode démo. Données inventées.
import sys, os, json, random
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
APP='file://'+ROOT+'/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
C=json.load(open(os.path.join(HERE,"donnees","tickets_fictifs.json"), encoding="utf-8"))
def mlkit(text, seed):
    rows=[l for l in text.split("\n") if l.strip()]; out=[]; rnd=random.Random(seed); W=1000
    for r,row in enumerate(rows):
        parts=[q for q in row.split("  ") if q.strip()]; y=80+r*24
        for i,t in enumerate(parts):
            t=t.strip(); w=len(t)*11; x=60 if i==0 else (W-60-w if i==len(parts)-1 else 60+(W-120)*i/(len(parts)-1)-w/2)
            out.append({"t":t,"p":[round(v+rnd.uniform(-1,1)) for v in (x,y,x+w,y,x+w,y+18,x,y+18)]})
    rnd.shuffle(out); return {"lines":out, "width":W, "height":80+len(rows)*24+80}
CAP="""window.__ml=[]; window.Capacitor={ isNativePlatform:function(){ return true; }, Plugins:{ TicketOcr:{ recognize:function(){ return Promise.resolve(window.__ml.shift()||{lines:[]}); } } } };"""
t0=C[0]; A0=t0["attendu"]
ent=[{"id":1001,"date":A0["date"],"marchand":A0["marchand"],"montant":31.26,"categorie":"Courses","payePar":"Alex",
      "articles":[{"label":"LAIT DEMI ECREME","prix":"1,05","produit":"Lait"},{"label":"PAIN DE CAMPAGNE","prix":"2,20","produit":"Pain"},{"label":"CAFE MOULU 250G","prix":"4,15","produit":"Café"},
                  {"label":"POULET ROTI","prix":"14,60","produit":"Poulet"},{"label":"LESSIVE LIQUIDE","prix":"9,26","produit":"Lessive"}]},
     {"id":1002,"date":A0["date"],"marchand":A0["marchand"],"montant":33.26,"categorie":"Courses","payePar":"Alex","articles":[]},   # total corrigé à la main : à revoir
     {"id":1003,"date":"2026-10-04","marchand":"Sans photo","montant":5,"categorie":"Courses","payePar":"Alex","articles":[]}]
data={"askName":False,"devise":"EUR","comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True}],"entries":ent}
SEED="""ids=>new Promise(res=>{ const c=document.createElement('canvas'); c.width=40; c.height=60; c.getContext('2d').fillRect(0,0,20,20);
  c.toBlob(b=>{ const rq=indexedDB.open('ticketsdb',2); rq.onsuccess=()=>{ const tx=rq.result.transaction('orig','readwrite');
    ids.forEach(id=>tx.objectStore('orig').put({b:[b], s:b.size}, String(id))); tx.oncomplete=()=>res(true); }; }, 'image/jpeg'); })"""
with sync_playwright() as p:
    b=p.chromium.launch(); c=b.new_context(viewport={'width':412,'height':900}, accept_downloads=True); c.add_init_script(CAP)
    pg=c.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    pg.goto(APP); pg.wait_for_timeout(400)
    pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); pg.reload(); pg.wait_for_timeout(900)
    pg.evaluate(SEED, [1001, 1002]); pg.reload(); pg.wait_for_timeout(1200)
    pg.locator("#hmenu").click(); pg.wait_for_timeout(300); pg.locator('.mnsub[data-ms="aide"]').click(); pg.wait_for_timeout(300)
    row=pg.get_by_text("Tester la lecture sur mes tickets")
    check(row.count()==1, "version Perso : la ligne est dans Menu › Aide")
    row.click(); pg.wait_for_timeout(400); t=pg.locator("#app").inner_text()
    check("2 tickets avec leur photo d'origine" in t, "compte les tickets qui ont leur photo d'origine (pas celui sans photo)")
    m=mlkit(t0["texte"], 1); pg.evaluate("r=>{ window.__ml=[r, JSON.parse(JSON.stringify(r))]; }", m)
    pg.locator("#bcGo").click()
    pg.wait_for_selector("#bcRes", timeout=20000); t=pg.locator("#app").inner_text()
    check("2 tickets" in t and "1 bien lu" in t and "1 à revoir" in t, "résultat : 2 tickets, 1 bien lu, 1 à revoir")
    check(pg.locator(".bc-bad").count()==1 and "total 31,26" in pg.locator(".bc-bad").inner_text(), "le ticket à revoir dit ce qui a été lu (total 31,26)")
    with pg.expect_download() as dl: pg.locator("#bcExp").click()
    d=json.load(open(dl.value.path(), encoding="utf-8"))
    tk=d["tickets"]
    check(d["n"]==2 and d["ok"]==1 and len(tk)==2, "export : 2 tickets, 1 bien lu")
    one=[x for x in tk if x["enregistre"]["montant"]==31.26][0]
    check(len(one["pages"])==1 and len(one["pages"][0]["morceaux"])==len(m["lines"]) and "INTERMARCHE" in one["pages"][0]["lignes"], "export : les morceaux ML Kit et les lignes reconstituées")
    check(len(one["enregistre"]["articles"])==5 and one["enregistre"]["articles"][0]["article"]=="Lait" and one["ok"]["arts"] is True, "export : le ticket enregistré avec ses articles")
    check("data:image" not in json.dumps(d), "export : sans photo")
    # version Store : pas de ligne
    pg.goto(APP+"?edition=store"); pg.wait_for_timeout(1000)
    pg.locator("#hmenu").click(); pg.wait_for_timeout(300); pg.locator('.mnsub[data-ms="aide"]').click(); pg.wait_for_timeout(300)
    check(pg.get_by_text("Tester la lecture sur mes tickets").count()==0, "version Store : pas de banc d'essai")
    check(not errs, "aucune erreur JS "+str(errs[:2]))
    b.close()
print("\n%d échec(s)"%len(fails)); sys.exit(1 if fails else 0)
