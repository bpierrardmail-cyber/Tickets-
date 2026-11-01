# Lecture des factures, partie générale et apprentissage :
# 1. corpus de factures inventées (Orange, SFR, Bouygues, TotalEnergies, Veolia, artisan, assurance…) passé dans parseBill ;
# 2. fournisseur au format inconnu : 2 PDF d'un coup, rien de lu ; corriger la plus récente remplit la plus ancienne ;
#    « Appliquer » retient la lecture ; la facture suivante de ce fournisseur est lue toute seule.
# Données inventées (donnees/factures_fictives.json, PDF faits par donnees/facture_mobile_fictive.py).
import sys, os, re, json
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
SP=(sys.argv[1] if len(sys.argv)>1 else HERE); APP='file://'+ROOT+'/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def norm(t): return t.replace(" "," ").replace("\xa0"," ")
PJ=os.environ.get('PDFJS_DIR','/opt/npm-tools/node_modules/pdfjs-dist/legacy/build/').rstrip('/')+'/'
def route(r):
    u=r.request.url
    if u.startswith("file:"): return r.continue_()
    m=re.search(r"pdfjs-dist@[^/]+/legacy/build/(pdf(?:\.worker)?\.min\.mjs)$", u)
    if m and os.path.exists(PJ+m.group(1)): return r.fulfill(status=200, body=open(PJ+m.group(1),'rb').read(), headers={"Content-Type":"text/javascript","Access-Control-Allow-Origin":"*"})
    return r.abort()
D=os.path.join(HERE,"donnees")
H=open(ROOT+'/beta/index.html', encoding='utf8').read()
def grab(name):
    i=H.index('    function '+name+'('); j=H.index('{', i); d=0
    for k in range(j, len(H)):
        if H[k]=='{': d+=1
        elif H[k]=='}':
            d-=1
            if not d: return H[i:k+1]
def grabvar(name):
    i=H.index('    var '+name+'='); return H[i:H.index(';\n', i)+1]
FNS="norm,factDateFix,factYMD,factDatesIdx,factDate,factAmtsIdx,factAmts,factDateAfter,factLabelAmt,titleCase,factTxtFix,factWords,factAmtScore,factGuessAmt,factDateScore,factGuessDate,factGuessPrelev,factLines,factItems,factTail,factAnchorOf,factAnchorFind,factLearntApply,parseBill".split(",")
SRC='var store={read:function(k,d){return d;}};'+"\n".join(grabvar(v) for v in "FACT_PAYRE,FACT_FOURS,FACT_ACC,FACT_INIT,FACT_MOIS,FACT_MOISRE".split(","))+"\n".join(grab(f) for f in FNS)+"\nreturn parseBill;"
C=json.load(open(os.path.join(D,"factures_fictives.json"), encoding='utf8'))
data={"askName":False,"devise":"EUR","plusUnlocked":True,"comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True}],"entries":[]}
with sync_playwright() as p:
    b=p.chromium.launch(); c=b.new_context(viewport={'width':412,'height':900})
    pg=c.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route("**/*", route)
    pg.goto(APP); pg.wait_for_timeout(300)
    # ---------- 1. corpus
    R=pg.evaluate("([src, C])=>{ const pb=new Function(src)(); return C.map(c=>pb(c.texte)); }", [SRC, C])
    for c0, r in zip(C, R):
        bad=[k for k,v in c0["attendu"].items() if not (r.get(k)==v or (v is False and not r.get(k)))]
        check(not bad, "lecture : %s%s" % (c0["nom"], (" → "+", ".join("%s=%r"%(k, r.get(k)) for k in bad)) if bad else ""))
    # ---------- 2. fournisseur inconnu : apprendre
    if not os.path.exists(PJ+"pdf.min.mjs"): print("  (pdf.js absent : partie PDF sautée)")
    else:
        pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); pg.reload(); pg.wait_for_timeout(900)
        def imp(files):
            pg.locator('#nav .navi[data-view="factures"]').click(); pg.wait_for_timeout(400)
            pg.locator('.avtabs button[data-av="fact"]').click(); pg.wait_for_timeout(400)
            pg.locator("#fctImp").click(); pg.wait_for_timeout(300)
            with pg.expect_file_chooser() as fc: pg.locator(".sheet-overlay button", has_text="PDF").first.click()
            fc.value.set_files([os.path.join(D, f) for f in files]); pg.wait_for_selector("#fctApply", timeout=30000); pg.wait_for_timeout(300)
        bills=lambda: pg.evaluate("()=>[].map.call(document.querySelectorAll('.fbill'), r=>r.innerText.replace(/\\s+/g,' '))")
        imp(["facture_inconnue_09.pdf", "facture_inconnue_10.pdf"])
        B=bills(); print("  ", B)
        check(len(B)==2 and "Date ?" in B[0] and pg.locator("#fp-mt").input_value()=="" and pg.locator("#fp-four").input_value()=="Bizarre Énergie", "format inconnu : rien de lu (fournisseur « Bizarre Énergie »)")
        pg.locator("#fp-mt").fill("47,80"); pg.locator("#fp-mt").dispatch_event("change"); pg.wait_for_timeout(300)
        pg.locator("#fp-date").fill("2026-10-03"); pg.locator("#fp-date").dispatch_event("change"); pg.wait_for_timeout(400)
        B=bills(); print("  ", B)
        check("03/09/2026" in norm(B[0]) and "45,10" in norm(B[0]) and "À VÉRIFIER" not in B[0], "corriger la plus récente remplit la plus ancienne (03/09/2026 · 45,10 €)")
        pg.locator("#fctApply").click(); pg.wait_for_timeout(600)
        toast=norm(pg.locator("body").inner_text())
        check("lecture retenue pour Bizarre Énergie" in toast, "« Appliquer » : « lecture retenue pour Bizarre Énergie »")
        F=sorted(pg.evaluate("()=>JSON.parse(localStorage.getItem('factures'))") or [], key=lambda f: f["date"])
        check([(f["date"], f["montant"]) for f in F]==[("2026-09-03",45.1),("2026-10-03",47.8)], "2 factures enregistrées")
        L=pg.evaluate("()=>JSON.parse(localStorage.getItem('factAppris')||'{}')"); print("  ", L)
        check("bizarre energie" in L and L["bizarre energie"].get("amt",{}).get("a")=="contribution mensuelle", "appris : le montant suit « Contribution mensuelle »")
        pg.wait_for_timeout(2600)
        imp(["facture_inconnue_11.pdf"])
        check(pg.locator("#fp-mt").input_value()=="52,30" and pg.locator("#fp-date").input_value()=="2026-11-03", "facture suivante : lue toute seule (52,30 €, 03/11/2026)")
        # la sauvegarde garde ce qui a été appris
        check('"factAppris"' in H.split("function backupData")[1][:900], "la sauvegarde contient factAppris")
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
print("\n%d échec(s)"%len(fails)); sys.exit(1 if fails else 0)
