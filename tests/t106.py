# Provisions : le total s'appelle « Total provisions » dans À venir › Provisions ; aucun ancien titre sur l'Accueil ;
# Compte › Graphiques n'a plus Provisions ni Épargne (03/11) ; l'ancienne carte « Compte · Provisions » de l'Accueil devient la carte Provisions.
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
  "epargne":[{"id":301,"nom":"Livret A","owner":"Alex","vals":{"2026-05":700,"2026-08":900,"2026-10":1000}}],
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
    tabs=[x.strip() for x in pg.locator(".cch-tabs button").all_inner_texts()]
    check(not any("Provisions" in x or "Épargne" in x for x in tabs) and len(tabs)==4, "Compte › Graphiques : plus de Provisions ni d'Épargne (À venir et sous-onglet Épargne) %s" % tabs)
    pg.locator('.avtabs .cpsub', has_text="Épargne").click(); pg.wait_for_timeout(600)
    t=norm(txt()) if 'norm' in globals() else txt().replace("\u202f"," ").replace("\xa0"," ")
    check("Épargne totale" in t and "Sur la période" in t and "Dont provisions" in t and "Disponible" in t and pg.locator(".crange-c").count()==1, "sous-onglet Épargne : le graphique de Graphiques (période 6 / 12 mois / Tout, Sur la période, Dont provisions, Disponible)")
    pg.locator(".crange-c").click(); pg.wait_for_timeout(500)
    check("sur 12 mois" in txt(), "« 6 mois ⇄ » passe à 12 mois")
    pg.locator('#nav .navi[data-view="list"]').click(); pg.wait_for_timeout(600)
    ids=pg.evaluate("()=>[...document.querySelectorAll('.hmini[data-id]')].map(x=>x.getAttribute('data-id'))")
    check(ids.count("provisions")==1 and "compte:prov" not in ids, "Accueil : l'ancienne carte « Compte · Provisions » devient la carte Provisions, sans doublon %s" % ids)
    check(not errs, "pas d'erreur %s"%errs)
    b.close()
print("\n%d échec(s)"%len(fails)); sys.exit(1 if fails else 0)
