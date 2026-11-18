# Articles simplifiés (18/11). Données inventées.
# 1. « Qui paie ce ticket ? » : « Quoi ? » Tout le ticket / Certains articles (à partir de 2 articles), total partagé, au moins un article coché.
# 2. Foyer › Articles partagés : le nom de l'article (pas le texte lu) ; Budget › Articles (un seul mot).
# 3. Saisi à la main sans article puis partagé : un article « Divers » partagé ; un seul article : pas de « Quoi ? ».
import sys, os, json
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
APP='file://'+ROOT+'/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def norm(t): return t.replace(" "," ").replace("\xa0"," ")
data={"askName":False,"devise":"EUR","welcomeSeen":True,"personnes":[{"nom":"Marie"}],"communParts":{"Alex":50,"Marie":50},
  "comptes":[{"key":"Alex","nom":"Compte Alex","payer":"Alex","main":True}],
  "entries":[{"id":7,"date":"2026-10-20","marchand":"Super Fictif","montant":16.15,"categorie":"Courses","payePar":"Alex","articles":[
     {"label":"CRF YAOURT NAT X4","prix":2.35,"produit":"Yaourt"},{"label":"PQ LOTUS CONF X12","prix":3.9,"produit":"Papier toilette"},{"label":"LESSIVE ARIEL 2L","prix":9.9,"produit":"Lessive"}]},
   {"id":8,"date":"2026-10-21","marchand":"Café Fictif","montant":4.2,"categorie":"Sorties","payePar":"Alex","articles":[{"label":"Café","prix":4.2,"produit":"Café"}]}]}
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={'width':412,'height':900}).new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    pg.goto(APP); pg.wait_for_timeout(300)
    pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); pg.reload(); pg.wait_for_timeout(1100)
    E=lambda: pg.evaluate("()=>JSON.parse(localStorage.getItem('entries'))")
    def openT(i):
        pg.locator('#nav .navi[data-view="compte"]').click(); pg.wait_for_timeout(400); pg.locator('.avtabs .cpsub[data-cp="tk"]').click(); pg.wait_for_timeout(400)
        pg.locator('.entry[data-id="%d"]' % i).click(); pg.wait_for_timeout(500)
        if pg.locator("#fshare").count()==0: pg.locator("#fopt").click(); pg.wait_for_timeout(300)
    openT(7)
    check(pg.locator("#arts .art").count()==3 and pg.locator("#arts .art-comc").count()==0, "3 articles, pas de case « partager » sur chacun")
    pg.locator("#fshare").click(); pg.wait_for_timeout(300)
    check(pg.locator("#shWhat .pay-seg").count()==0, "« Seulement toi » : pas de « Quoi ? »")
    pg.locator('.sh-m[data-m="all"]').click(); pg.wait_for_timeout(200)
    check(pg.locator('#shWhat .pay-seg button.on[data-w="all"]').count()==1 and pg.locator(".sh-ac").count()==0, "commun du foyer : « Quoi ? » sur « Tout le ticket »")
    pg.locator('#shWhat .pay-seg button[data-w="some"]').click(); pg.wait_for_timeout(200)
    names=[norm(x) for x in pg.locator(".sh-a .nm").all_inner_texts()]
    check(names==["Yaourt","Papier toilette","Lessive"] and pg.locator(".sh-ac:checked").count()==3, "« Certains articles » : leurs noms (pas le texte lu), tous cochés %s" % names)
    pg.locator('.sh-ac[data-i="2"]').uncheck(); pg.wait_for_timeout(200)
    tot=norm(pg.locator(".sh-tot").inner_text())
    check("6,25 €" in tot and "16,15 €" in tot, "total partagé : 6,25 € sur 16,15 € (« %s »)" % tot)
    for i in range(2): pg.locator('.sh-ac[data-i="%d"]' % i).uncheck(); pg.wait_for_timeout(100)
    pg.locator("#shOk").click(); pg.wait_for_timeout(300)
    check("Coche au moins un article" in norm(pg.locator(".sheet-overlay .ui-err").inner_text()), "aucun article coché : refusé")
    pg.locator('.sh-ac[data-i="0"]').check(); pg.locator('.sh-ac[data-i="1"]').check(); pg.wait_for_timeout(100)
    pg.locator("#shOk").click(); pg.wait_for_timeout(300)
    check("2 articles · Commun du foyer" in norm(pg.locator("#fshare").inner_text()) and [pg.locator("#arts .art").nth(i).get_attribute("data-c") for i in range(3)]==["1","1",None], "Partage : « 2 articles · Commun du foyer », les 2 premiers marqués")
    check("partagé" in norm(pg.locator("#arts .art").first.inner_text()), "« partagé » écrit en petit sous l'article")
    pg.locator("#save").click(); pg.wait_for_timeout(600)
    if pg.locator("#cksave").count(): pg.locator("#cksave").click(); pg.wait_for_timeout(500)
    e=[x for x in E() if x["id"]==7][0]
    check([bool(a.get("commun")) for a in e["articles"]]==[True,True,False] and [a["label"] for a in e["articles"]][0]=="CRF YAOURT NAT X4", "enregistré : 2 articles partagés, texte lu gardé")
    # Foyer › Articles partagés
    pg.locator('#nav .navi[data-view="communes"]').click(); pg.wait_for_timeout(500)
    if pg.locator('.cfx-sec[data-k="pp"] .cfx-h').count(): pg.locator('.cfx-sec[data-k="pp"] .cfx-h').click(); pg.wait_for_timeout(300)
    t=norm(pg.locator("#app").inner_text())
    check("Articles partagés" in t and "Yaourt" in t and "Papier toilette" in t and "CRF YAOURT" not in t, "Foyer › Articles partagés : « Yaourt », « Papier toilette » (pas le texte lu)")
    # un seul article : pas de « Quoi ? »
    openT(8); pg.locator("#fshare").click(); pg.wait_for_timeout(300); pg.locator('.sh-m[data-m="all"]').click(); pg.wait_for_timeout(200)
    check(pg.locator("#shWhat .pay-seg").count()==0, "un seul article : pas de « Quoi ? »")
    pg.locator(".sheet-overlay .ui-no").click(); pg.wait_for_timeout(200); pg.locator("#cancel").click(); pg.wait_for_timeout(300)
    # Budget › Articles
    pg.locator('#nav .navi[data-view="depenses"]').click(); pg.wait_for_timeout(400)
    subs=[norm(x).strip() for x in pg.locator(".avtabs .dpsub").all_inner_texts()]
    check(subs==["Budgets","Analyse","Articles"], "Budget : sous-onglets Budgets · Analyse · Articles %s" % subs)
    pg.locator('.avtabs .dpsub[data-dp="produits"]').click(); pg.wait_for_timeout(400)
    t=norm(pg.locator("#app").inner_text())
    check("Mes articles" in t and "Articles & catégories" in t and "produit" not in t.lower(), "Budget › Articles : « Mes articles », « Articles & catégories », plus le mot « produit »")
    check(not errs, "aucune erreur JS (%s)" % errs[:3])
    b.close()
print("\n%d échec(s)" % len(fails)); sys.exit(1 if fails else 0)
