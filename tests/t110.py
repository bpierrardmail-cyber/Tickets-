# Factures : relevé, contrôles, lecture par voisinage, Factur-X.
# 1. PDF avec données Factur-X jointes : date, montant, échéance et fournisseur pris dedans (le texte ne donne que le HT) ;
# 2. facture retrouvée sur le relevé (montant égal) : bandeau vert, jour du prélèvement pris sur le relevé ;
# 3. relevé un peu différent : bandeau orange, « Prendre le relevé » ;
# 4. contrôles : montant 10 fois plus élevé que d'habitude, HT + TVA = TTC ;
# 5. détail du fournisseur : prélevé sur le relevé sans facture ce mois-là ;
# 6. lecture apprise par voisinage : le libellé appris avec un mot ajouté entre lui et la valeur.
# Données inventées (PDF faits par donnees/facture_mobile_fictive.py).
import sys, os, re
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
APP='file://'+ROOT+'/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def norm(t): return t.replace("\u202f"," ").replace("\xa0"," ")
PJ=os.environ.get('PDFJS_DIR','/opt/npm-tools/node_modules/pdfjs-dist/legacy/build/').rstrip('/')+'/'
def route(r):
    u=r.request.url
    if u.startswith("file:"): return r.continue_()
    m=re.search(r"pdfjs-dist@[^/]+/legacy/build/(pdf(?:\.worker)?\.min\.mjs)$", u)
    if m and os.path.exists(PJ+m.group(1)): return r.fulfill(status=200, body=open(PJ+m.group(1),'rb').read(), headers={"Content-Type":"text/javascript","Access-Control-Allow-Origin":"*"})
    return r.abort()
D=os.path.join(HERE,"donnees")
BASE={"askName":False,"devise":"EUR","plusUnlocked":True,"comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True}],"entries":[]}
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
if not os.path.exists(PJ+"pdf.min.mjs"):
    print("  (pdf.js absent : test sauté)\n\n0 échec(s)"); sys.exit(0)
with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    def open_app(extra):
        c=b.new_context(viewport={'width':412,'height':900}); pg=c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e))); pg.route("**/*", route)
        pg.goto(APP); pg.wait_for_timeout(300); d=dict(BASE); d.update(extra)
        pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", d); pg.reload(); pg.wait_for_timeout(900)
        return c, pg
    def imp(pg, files):
        pg.locator('#nav .navi[data-view="factures"]').click(); pg.wait_for_timeout(400)
        pg.locator('.avtabs button[data-av="fact"]').click(); pg.wait_for_timeout(400)
        pg.locator("#fctImp").click(); pg.wait_for_timeout(300)
        with pg.expect_file_chooser() as fc: pg.locator(".sheet-overlay button", has_text="PDF").first.click()
        fc.value.set_files([os.path.join(D, f) for f in files]); pg.wait_for_selector("#fctApply", timeout=30000); pg.wait_for_timeout(300)
    txt=lambda pg: norm(pg.locator("#app").inner_text())
    # ---------- 1. Factur-X
    c, pg = open_app({})
    imp(pg, ["facture_facturx_fictive.pdf"])
    check(pg.locator("#fp-mt").input_value()=="120,00" and pg.locator("#fp-date").input_value()=="2026-10-12" and pg.locator("#fp-four").input_value()=="Atelier Fictif", "Factur-X : 120,00 € (pas le HT du texte), facture du 12/10/2026, « Atelier Fictif »")
    check(pg.locator("#fp-due").count()==1 and pg.locator("#fp-due").input_value()=="2026-11-12", "Factur-X : à payer avant le 12/11/2026")
    c.close()
    # ---------- 2. retrouvée sur le relevé
    c, pg = open_app({"releve":[{"d":"2026-10-28","n":"PRLV SEPA FREE MOBILE","a":-15.99,"k":"r1","c":"Alex","i":1}]})
    imp(pg, ["facture_mobile_fictive_10.pdf"])
    t=txt(pg)
    check("Retrouvée sur ton relevé" in t and "−15,99 € le 28/10" in t and pg.locator("#fp-prel").input_value()=="2026-10-28", "relevé égal : bandeau vert, prélevé le 28/10 (jour du relevé)")
    check("HT 13,33 € + TVA 2,66 € = 15,99 €" in t, "contrôle : « ✓ HT 13,33 € + TVA 2,66 € = 15,99 € »")
    c.close()
    # ---------- 3. relevé un peu différent
    c, pg = open_app({"releve":[{"d":"2026-10-27","n":"PRLV SEPA FREE MOBILE","a":-16.49,"k":"r1","c":"Alex","i":1}]})
    imp(pg, ["facture_mobile_fictive_10.pdf"])
    t=txt(pg)
    check("Sur ton relevé" in t and "−16,49 € le 27/10" in t and pg.locator("#fbTake").count()==1, "relevé différent : bandeau orange « Sur ton relevé : −16,49 € le 27/10 »")
    pg.locator("#fbTake").click(); pg.wait_for_timeout(400)
    check(pg.locator("#fp-mt").input_value()=="16,49", "« Prendre le relevé » : montant 16,49 €")
    c.close()
    # ---------- 4. montant inhabituel
    old=[{"id":10+i,"four":"Free Mobile","type":"net","date":"2026-0%d-27"%(6+i),"montant":1.5,"prelev":"2026-0%d-27"%(6+i),"src":"pdf"} for i in range(3)]
    c, pg = open_app({"factures":old})
    imp(pg, ["facture_mobile_fictive_10.pdf"])
    t=txt(pg)
    check("11 fois plus que d'habitude chez ce fournisseur (1,50 €)" in t and "#e6b450" in (pg.locator("#fp-mt").get_attribute("style") or ""), "contrôle : « 11 fois plus que d'habitude… », montant en orange")
    c.close()
    # ---------- 5. prélevé sans facture
    old=[{"id":10+i,"four":"Free Mobile","type":"net","date":"2026-0%d-27"%(6+i),"montant":15.99,"prelev":"2026-0%d-27"%(6+i),"src":"pdf"} for i in range(4)]
    c, pg = open_app({"factures":old, "releve":[{"d":"2026-10-27","n":"PRLV SEPA FREE MOBILE","a":-15.99,"k":"r1","c":"Alex","i":1}]})
    pg.locator('#nav .navi[data-view="factures"]').click(); pg.wait_for_timeout(400)
    pg.locator('.avtabs button[data-av="fact"]').click(); pg.wait_for_timeout(400)
    pg.locator(".fct-card[data-k]").first.click(); pg.wait_for_timeout(500)
    t=txt(pg)
    check("Prélevé le 27/10 sur ton relevé (15,99 €), mais pas de facture d" in t and "octobre" in t and pg.locator("#fsMissImp").count()==1, "détail : « Prélevé le 27/10 sur ton relevé… pas de facture d'octobre · Importer la facture »")
    # ---------- 6. voisinage
    SRC='var __L=%s; var store={read:function(k,d){return k==="factAppris"?__L:d;}};'
    L={"bizarre energie":{"amt":{"a":"contribution mensuelle"},"date":{"a":"testville"}}}
    src=(SRC % __import__("json").dumps(L))+"\n".join(grabvar(v) for v in "FACT_PAYRE,FACT_FOURS,FACT_ACC,FACT_INIT,FACT_MOIS,FACT_MOISRE".split(","))+"\n".join(grab(f) for f in FNS)+"\nreturn parseBill;"
    R=pg.evaluate("([src, t])=>new Function(src)()(t)", [src, "BIZARRE ÉNERGIE\nCoopérative locale\nTestville, le 03/12/2026\nVotre relevé de participation\nContribution mensuelle due ce mois  € 58,00\nMerci."])
    check(R["montant"]==58.0 and R["date"]=="2026-12-03", "voisinage : « Contribution mensuelle due ce mois € 58,00 » et « Testville, le 03/12/2026 » relus (%s, %s)" % (R["montant"], R["date"]))
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
print("\n%d échec(s)"%len(fails)); sys.exit(1 if fails else 0)
