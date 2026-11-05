# Scan des tickets : jeu d'essai, total recoupé, lecture apprise par enseigne, scanner de documents.
# 1. tickets inventés (donnees/tickets_fictifs.json) lus par toute la chaîne (ML Kit imité, mlkitRows, parseTicket) :
#    montant, enseigne, date, sources du total (articles, carte, TVA) et alerte quand deux sources contredisent le total lu ;
#    taux de bonne lecture affiché ;
# 2. « Prendre 31,26 € » quand la carte et la TVA disent 31,26 et que le total lu est 37,26 ;
# 3. magasin au total mal placé (payé en espèces) : corrigé une fois, le ticket suivant est lu au même endroit
#    (« ✓ Total lu comme tes tickets … ») ;
# 4. scanner de documents : avec scanDoc, la photo du scanner part à la lecture ; scanner indisponible → « Prendre une photo ».
# Données inventées.
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
C=json.load(open(os.path.join(HERE,"donnees","tickets_fictifs.json"), encoding="utf-8"))
def mlkit(text, seed):
    rows=[l for l in text.split("\n") if l.strip()]; out=[]; rnd=random.Random(seed); W=1000
    for r,row in enumerate(rows):
        parts=[q for q in row.split("  ") if q.strip()]; y=80+r*24
        for i,t in enumerate(parts):
            t=t.strip(); w=len(t)*11; x=60 if i==0 else (W-60-w if i==len(parts)-1 else 60+(W-120)*i/(len(parts)-1)-w/2)
            out.append({"t":t,"p":[round(v+rnd.uniform(-1,1)) for v in (x,y,x+w,y,x+w,y+18,x,y+18)]})
    rnd.shuffle(out); return {"lines":out, "width":W, "height":80+len(rows)*24+80}
CAP="""window.__ml=[]; window.__doc=null; window.Capacitor={ isNativePlatform:function(){ return true; }, Plugins:{ TicketOcr:{ recognize:function(){ return Promise.resolve(window.__ml.shift()||{lines:[]}); } },
  TicketsNative:{ scanDoc:function(){ return window.__doc ? Promise.resolve(window.__doc) : Promise.reject({ code:"fail", message:"indisponible" }); } } } };"""
data={"askName":False,"devise":"EUR","comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True}],"entries":[]}
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
        return { "montant":pg.locator("#f-montant").input_value(), "marchand":pg.locator("#f-marchand").input_value(), "date":pg.locator("#f-date").input_value(),
                 "src":norm(pg.locator("#srcchk").inner_text()) }
    # ---------- 1. jeu d'essai
    ok=0
    for i, t in enumerate(C):
        R=scan(t["texte"], i); A=t["attendu"]; bad=[]
        num=lambda x: float(x.replace(",",".")) if x else None
        if "montant" in A and num(R["montant"])!=num(A["montant"]): bad.append("montant=%r"%R["montant"])
        for k in ("marchand","date"):
            if k in A and R[k]!=A[k]: bad.append("%s=%r"%(k, R[k]))
        for sv in A.get("sources", []):
            if sv not in R["src"]: bad.append("source %r absente"%sv)
        if A.get("alerte") is False and "⚠" in R["src"]: bad.append("alerte en trop")
        if A.get("alerte") and ("⚠" not in R["src"] or A["alerte"] not in R["src"]): bad.append("alerte %s absente"%A["alerte"])
        if not bad: ok+=1
        check(not bad, "lecture : %s%s" % (t["nom"], (" → "+", ".join(bad)+" | "+R["src"].replace("\n"," / ")) if bad else ""))
    print("  taux de bonne lecture : %d / %d" % (ok, len(C)))
    # ---------- 2. prendre le montant des deux sources d'accord
    R=scan(C[1]["texte"], 1)
    check("Lu 37,26 €, mais les articles, le paiement carte et la TVA disent 31,26 €" in R["src"], "alerte : « Lu 37,26 €, mais les articles, le paiement carte et la TVA disent 31,26 € »")
    pg.locator("#srcTake").click(); pg.wait_for_timeout(300)
    check(pg.locator("#f-montant").input_value()=="31,26" and "⚠" not in norm(pg.locator("#srcchk").inner_text()), "« Prendre 31,26 € » : montant corrigé, plus d'alerte")
    # ---------- 3. lecture apprise par enseigne
    T1="QUINCAILLERIE TEST\nVIS INOX X50  5,00\nCHEVILLES X20  7,40\nA ENCAISSER  12,40\nESPECES  20,00\nRENDU  7,60\n15/10/2026"
    R=scan(T1, 7)
    check(R["montant"]!="12,40", "magasin inconnu, payé en espèces : total mal lu (%s)" % R["montant"])
    pg.locator("#f-montant").fill("12,40"); pg.locator("#save").click(); pg.wait_for_timeout(500)
    if pg.locator("#cksave").count(): pg.locator("#cksave").click(); pg.wait_for_timeout(600)   # « A ENCAISSER » lu comme un article : enregistrer quand même
    check("total retenu pour" in norm(pg.locator("body").inner_text()), "enregistré : « Ticket enregistré · total retenu pour … »")
    L=pg.evaluate("()=>JSON.parse(localStorage.getItem('tkAppris')||'{}')"); print("  appris :", L)
    pg.wait_for_timeout(2600)
    T2="QUINCAILLERIE TEST\nMARTEAU  14,00\nCLOUS  4,90\nA ENCAISSER  18,90\nESPECES  20,00\nRENDU  1,10\n22/10/2026"
    R=scan(T2, 8)
    check(R["montant"] in ("18,90","18,9") and "Total lu comme tes tickets" in R["src"] and "✓ Articles 18,90" in R["src"], "ticket suivant du même magasin : 18,90 € lu au même endroit, « ✓ Total lu comme tes tickets … », sa ligne retirée des articles")
    # un ticket à un seul article (prix = total) n'apprend pas le nom de l'article comme repère
    T3="FLEURISTE TEST\nBOUQUET ROSES  25,00\nTOTAL  25,00\nCB  25,00\n18/10/2026"
    scan(T3, 9); pg.locator("#save").click(); pg.wait_for_timeout(600)
    L=pg.evaluate("()=>JSON.parse(localStorage.getItem('tkAppris')||'{}')")
    fl=[v for k,v in L.items() if "fleuriste" in k]
    check(fl and fl[0]["amt"]["a"]=="total", "un seul article : le repère est « TOTAL », pas le nom de l'article (%s)" % fl)
    pg.wait_for_timeout(2600)
    # ---------- 4. scanner de documents
    if pg.locator("#cancel").count(): pg.locator("#cancel").click(); pg.wait_for_timeout(300)
    b64=__import__("base64").b64encode(open(IMG,"rb").read()).decode()
    pg.evaluate("([r, d])=>{ window.__ml=[r]; window.__doc={ images:[d] }; }", [mlkit(C[3]["texte"], 3), b64])
    pg.locator('#nav .navi[data-view="list"]').click(); pg.wait_for_timeout(300)
    pg.evaluate("()=>document.getElementById('navplus').click()"); pg.wait_for_timeout(400)
    pg.locator('.sheet-overlay .dr-row[data-k="scan"]').click()
    pg.wait_for_timeout(1500)
    check(pg.locator("#f-montant").count()==1 and pg.locator("#f-montant").input_value() in ("18,90","18,9"), "scanner de documents : la page scannée est lue (18,90 €)")
    if pg.locator("#cancel").count(): pg.locator("#cancel").click(); pg.wait_for_timeout(300)
    pg.evaluate("()=>{ window.__doc=null; }")
    pg.evaluate("()=>document.getElementById('navplus').click()"); pg.wait_for_timeout(400)
    pg.locator('.sheet-overlay .dr-row[data-k="scan"]').click()
    pg.wait_for_timeout(500)
    t=norm(pg.locator("body").inner_text())
    check("scanner indisponible" in t.lower() and "Prendre une photo" in t, "scanner indisponible : « Scanner indisponible » et « Prendre une photo »")
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
print("\n%d échec(s)"%len(fails)); sys.exit(1 if fails else 0)
