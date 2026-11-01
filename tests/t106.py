# Provisions : le total s'appelle « Total provisions » dans À venir › Provisions et Compte › Graphiques ; aucun ancien titre sur l'Accueil.
# Données inventées.
import sys, os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
APP='file://'+ROOT+'/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
data={"askName":False,"devise":"EUR","comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True}],
  "provisions":[{"id":11,"nom":"Taxe","mensuel":50,"soldeInitial":100,"startMonth":"2026-08","prelevements":[]},
                {"id":12,"nom":"Assurance","mensuel":20,"soldeInitial":0,"startMonth":"2026-08","prelevements":[]}],
  "homeCharts":["provisions","compte:prov"], "cptChartDef":"prov",
  "entries":[{"id":1,"date":"2026-10-03","marchand":"Supermarché","montant":3.3,"categorie":"Courses","payePar":"Alex","articles":[]}]}
OLD=["Total mis de côté","Provisions mises de côté","Total provisionné"]
with sync_playwright() as p:
    b=p.chromium.launch(); c=b.new_context(viewport={'width':412,'height':900}, is_mobile=True, has_touch=True)
    pg=c.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    pg.goto(APP); pg.wait_for_timeout(300)
    pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); pg.reload(); pg.wait_for_timeout(1200)
    def txt(): return pg.locator('#app').inner_text()
    t=txt(); check(not any(o in t for o in OLD), "Accueil : aucun ancien titre")
    pg.locator('#nav .navi[data-view="factures"]').click(); pg.wait_for_timeout(500)
    pg.locator('.avtabs button', has_text="Provisions").click(); pg.wait_for_timeout(600)
    t=txt(); check("Total provisions" in t and not any(o in t for o in OLD), "À venir › Provisions : « Total provisions »")
    pg.locator('#nav .navi[data-view="compte"]').click(); pg.wait_for_timeout(500)
    pg.locator('.avtabs .cpsub', has_text="Graphiques").click(); pg.wait_for_timeout(600)
    t=txt(); check("Total provisions" in t and "Total provisions, sur 6 mois" in t and not any(o in t for o in OLD), "Compte › Graphiques › Provisions : « Total provisions »")
    check(not errs, "pas d'erreur %s"%errs)
    b.close()
print("\n%d échec(s)"%len(fails)); sys.exit(1 if fails else 0)
