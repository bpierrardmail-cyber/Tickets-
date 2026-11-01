# Factures de mobile au format des PDF Free : accents détachés (« pr ´elev ´ee », « `a payer »), montants « 15.99 e »,
# date en lettres (« du 27 octobre 2026 »), « sera prélevée sur votre carte bancaire le … ». Deux PDF d'un coup :
# date, montant et prélèvement lus, la plus récente en haut. PDF fabriqués par donnees/facture_mobile_fictive.py.
# Données inventées.
import sys, os, re
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
data={"askName":False,"devise":"EUR","plusUnlocked":True,"comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True}],"entries":[]}
if not os.path.exists(PJ+"pdf.min.mjs"):
    print("  (pdf.js absent : test sauté)\n\n0 échec(s)"); sys.exit(0)
with sync_playwright() as p:
    b=p.chromium.launch(); c=b.new_context(viewport={'width':412,'height':900})
    pg=c.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route("**/*", route)
    pg.goto(APP); pg.wait_for_timeout(300)
    pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); pg.reload(); pg.wait_for_timeout(900)
    pg.locator('#nav .navi[data-view="factures"]').click(); pg.wait_for_timeout(400)
    pg.locator('.avtabs button[data-av="fact"]').click(); pg.wait_for_timeout(400)
    pg.locator("#fctImp").click(); pg.wait_for_timeout(300)
    with pg.expect_file_chooser() as fc: pg.locator(".sheet-overlay button", has_text="PDF").first.click()
    fc.value.set_files([os.path.join(D,"facture_mobile_fictive_09.pdf"), os.path.join(D,"facture_mobile_fictive_10.pdf")])
    pg.wait_for_selector("#fctApply", timeout=30000); pg.wait_for_timeout(300)
    t=norm(pg.locator("#app").inner_text())
    B=pg.evaluate("()=>[].map.call(document.querySelectorAll('.fbill'), r=>r.innerText.replace(/\\s+/g,' '))")
    print("  ", B)
    check("2 PDF · 2 lus" in t and "Date ?" not in t and "À VÉRIFIER" not in t, "« 2 PDF · 2 lus », chaque facture a sa date")
    check(len(B)==2 and "27/09/2026" in B[0] and "LA PLUS RÉCENTE" in B[1] and "27/10/2026" in B[1], "la plus récente : celle du 27/10/2026")
    check("Free Mobile" in pg.evaluate("()=>[].map.call(document.querySelectorAll('#app input'), i=>i.value)"), "fournisseur : Free Mobile")
    check("à payer à réception" not in t, "prélevée sur la carte : pas « à payer à réception »")
    pg.locator("#fctApply").click(); pg.wait_for_timeout(700)
    F=sorted(pg.evaluate("()=>JSON.parse(localStorage.getItem('factures'))") or [], key=lambda f: f["date"])
    print("  ", [(f.get("four"), f.get("type"), f["date"], f["montant"], f.get("prelev"), f.get("aPayer")) for f in F])
    check([(f.get("four"), f.get("type"), f["date"], f["montant"], f.get("prelev"), bool(f.get("aPayer"))) for f in F]==
          [("Free Mobile","net","2026-09-27",9.99,"2026-09-27",False),("Free Mobile","net","2026-10-27",15.99,"2026-10-27",False)],
          "« Appliquer » : 2 factures Free Mobile, 9,99 € et 15,99 €, prélevées le 27")
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
print("\n%d échec(s)"%len(fails)); sys.exit(1 if fails else 0)
