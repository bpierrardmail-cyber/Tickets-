# Scan durable (18/11). Données inventées.
# 1. Magasin reconnu par son SIRET ou son téléphone : nommé une fois, les tickets suivants reprennent ce nom même si le logo est mal lu.
# 2. Nombre d'articles annoncé par le ticket : « il en manque » quand une ligne n'a pas été lue.
# 3. Nom et prix sur deux lignes : « 2 x 1,20  2,40 » sous le nom.
# 4. « Signaler une lecture » : ce qui a été lu, ce qui a été corrigé, puis la lecture complète.
import sys, os, json, random
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
APP='file://'+ROOT+'/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def norm(t): return t.replace(" "," ").replace("\xa0"," ")
IMG=os.path.join(HERE,"donnees","images","ticket_fictif.jpg")
def mlkit(text, seed):
    rows=[l for l in text.split("\n") if l.strip()]; out=[]; rnd=random.Random(seed); W=1000
    for r,row in enumerate(rows):
        parts=[q for q in row.split("  ") if q.strip()]; y=80+r*24
        for i,t in enumerate(parts):
            t=t.strip(); w=len(t)*11; x=60 if i==0 else (W-60-w if i==len(parts)-1 else 60+(W-120)*i/(len(parts)-1)-w/2)
            out.append({"t":t,"p":[round(v+rnd.uniform(-1,1)) for v in (x,y,x+w,y,x+w,y+18,x,y+18)]})
    rnd.shuffle(out); return {"lines":out, "width":W, "height":80+len(rows)*24+80}
CAP="""window.__ml=[]; window.Capacitor={ isNativePlatform:function(){ return true; }, Plugins:{ TicketOcr:{ recognize:function(){ return Promise.resolve(window.__ml.shift()||{lines:[]}); } },
  TicketsNative:{ scanDoc:function(){ return Promise.reject({ code:"fail", message:"indisponible" }); } } } };"""
data={"askName":False,"devise":"EUR","welcomeSeen":True,"comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True}],"entries":[]}
T1="QUINCAILLERIE\nZ.A. DES TESTS\nSIRET: 123 456 789 01234\nTEL 01 23 45 67 89\nVIS INOX  5,00\nTOTAL  5,00\nCB  5,00\n15/10/2026"
T2="QU1NCA1LL\nZ.A. DES TESTS\nSIRET: 123 456 789 01234\nCHEVILLES  7,40\nTOTAL  7,40\nCB  7,40\n20/10/2026"
T3="EPICERIE TEST\nYAOURT NATURE\n2 x 1,20  2,40\nCONFITURE  3,10\n#ILLISIBLE#\nTOTAL  7,50\nNOMBRE D'ARTICLES: 4\nCB  7,50\n21/10/2026"
with sync_playwright() as p:
    b=p.chromium.launch(); c=b.new_context(viewport={'width':412,'height':900}); c.add_init_script(CAP)
    pg=c.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    pg.goto(APP); pg.wait_for_timeout(300)
    pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); pg.reload(); pg.wait_for_timeout(900)
    def scan(text, seed):
        if pg.locator("#cancel").count(): pg.locator("#cancel").click(); pg.wait_for_timeout(300)
        pg.evaluate("r=>{ window.__ml=[r]; }", mlkit(text, seed))
        pg.set_input_files("#filein", IMG); pg.wait_for_selector("#f-montant", timeout=20000)
        for _ in range(40):
            if pg.locator("#f-montant").input_value(): break
            pg.wait_for_timeout(150)
        pg.wait_for_timeout(300)
    def save():
        if pg.locator("#chips .chip.on").count()==0: pg.locator("#chips .chip[data-cat]").first.click(); pg.wait_for_timeout(200)
        pg.locator("#save").click(); pg.wait_for_timeout(600)
        if pg.locator("#cksave").count(): pg.locator("#cksave").click(); pg.wait_for_timeout(500)
    scan(T1, 1)
    pg.locator("#f-marchand").fill("Quincaillerie des Tests"); save()
    M=pg.evaluate("()=>JSON.parse(localStorage.getItem('tkMag')||'{}')")
    check(M.get("s:12345678901234")=="Quincaillerie des Tests" and M.get("t:0123456789")=="Quincaillerie des Tests", "SIRET et téléphone appris pour ce magasin %s" % M)
    scan(T2, 2)
    check(pg.locator("#f-marchand").input_value()=="Quincaillerie des Tests" and "Magasin reconnu" in norm(pg.locator("#srcchk").inner_text()), "logo mal lu (« QU1NCA1LL ») : reconnu par le SIRET (« %s »)" % pg.locator("#f-marchand").input_value())
    # signaler
    pg.locator("#f-montant").fill("7,50"); pg.locator("#fMore").click(); pg.wait_for_timeout(300)
    pg.locator(".sheet-overlay button", has_text="Signaler une lecture").click(); pg.wait_for_timeout(400)
    t=pg.locator("#ocrTxt").input_value()
    check("Lu → corrigé" in t and "Montant : 7,4 → 7,50" in t and "Magasin : Quincaillerie des Tests" in t and "CHEVILLES | 7,40" in t and "--- Lignes lues ---" in t, "« Signaler une lecture » : lu → corrigé, articles, lecture complète")
    pg.locator("#ocrNo").click(); pg.wait_for_timeout(200)
    scan(T3, 3)
    A=pg.evaluate("()=>[...document.querySelectorAll('#arts .art')].map(n=>[n.getAttribute('data-l'), n.querySelector('.art-prix').value])")
    check(["YAOURT NATURE","2,40"] in A and ["CONFITURE","3,10"] in A, "« 2 x 1,20  2,40 » sous le nom : l'article YAOURT NATURE à 2,40 %s" % A)
    w=norm(pg.locator("#srcchk").inner_text())
    check("annonce 4 articles" in w and "3 lus" in w and "manque" in w, "nombre d'articles : « annonce 4 articles, 3 lus : vérifie qu'il n'en manque pas » (%s)" % w.replace("\n"," / "))
    check(not errs, "aucune erreur JS (%s)" % errs[:3])
    b.close()
print("\n%d échec(s)" % len(fails)); sys.exit(1 if fails else 0)
