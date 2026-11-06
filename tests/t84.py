# Produit d'un article : vide = en orange ; rempli avec le dernier produit de la personne (« Payé par ») pour cet article, cloisonné par personne
import sys, os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
SP=(sys.argv[1] if len(sys.argv)>1 else HERE); APP='file://'+ROOT+'/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def norm(t): return t.replace(" "," ").replace("\xa0"," ")
def T(i,d,who,arts): return {"id":i,"date":d,"marchand":"X","montant":sum(a[1] for a in arts),"categorie":"Carburant","payePar":who,"articles":[{"label":a[0],"prix":a[1],"produit":a[2]} for a in arts]}
data={"askName":False,"devise":"EUR","personnes":[{"nom":"Sylvette"}],"comptes":[{"key":"Benoit","nom":"Compte courant","payer":"Benoit","main":True}],
  "entries":[T(1,"2026-09-01","Benoit",[("GAZOLE",40,"Carburant")]), T(2,"2026-10-01","Benoit",[("GAZOLE",45,"Gazole"),("PAIN DE MIE",1.85,"Pain")]),
             T(3,"2026-10-05","Sylvette",[("GAZOLE",50,"Diesel")])]}
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={'width':412,'height':900}).new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    pg.goto(APP); pg.wait_for_timeout(300)
    pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); pg.reload(); pg.wait_for_timeout(900)
    (pg.locator("#navplus").click(), pg.wait_for_timeout(300), pg.locator('.dr-row[data-k="man"]').click(), pg.wait_for_timeout(400), pg.locator('.cattiles .chip:not(.more)').first.click()); pg.wait_for_timeout(400)
    pg.locator("#f-montant").fill("48,69"); pg.locator("#addart").click(); pg.wait_for_timeout(250)
    a=pg.locator("#arts .art").last; a.locator(".art-name").fill("GAZOLE"); a.locator(".art-prix").fill("48,69"); pg.wait_for_timeout(200)
    prod=lambda: pg.locator("#arts .art .art-prod").first.input_value()
    # payé par « — » (= Benoit) : GAZOLE tapé à la main → Gazole tout seul
    a.locator(".art-name").dispatch_event("change"); pg.wait_for_timeout(200)
    check(prod()=="Gazole", "article tapé à la main : son dernier produit (Gazole)")
    pg.locator("#arts .art .art-prod").first.fill(""); pg.wait_for_timeout(200)
    need=lambda: pg.locator("#arts .art-prod.need").count()
    check(prod()=="" and need()==1, "produit vide : en orange")
    c=norm(pg.locator("#artchk").inner_text()); check("1 sans produit à ranger" in c, "bandeau : « 1 sans produit à ranger » (%s)" % c.replace("\n"," | "))
    pg.screenshot(path=os.path.join(SP,"t84_vide.png"))
    pg.locator('#f-payer').select_option("Sylvette"); pg.wait_for_timeout(500)
    check(prod()=="Diesel" and need()==0, "Payé par Sylvette : son dernier produit pour GAZOLE (Diesel)")
    pg.locator('#f-payer').select_option("Benoit"); pg.wait_for_timeout(500)
    check(prod()=="Gazole", "Payé par Benoit : son dernier produit (Gazole, pas l'ancien « Carburant »), rempli tout seul donc remplacé")
    check(norm(pg.locator("#f-montant").input_value())=="48,69", "le montant reste")
    # tapé à la main : ne bouge plus
    pg.locator("#arts .art .art-prod").first.fill("Plein"); pg.wait_for_timeout(200)
    pg.locator('#f-payer').select_option("Sylvette"); pg.wait_for_timeout(500)
    check(prod()=="Plein", "produit tapé à la main : ne change pas avec « Payé par »")
    # article inconnu de la personne : reste vide et orange ; cloisonné (PAIN DE MIE de Benoit pas pour Sylvette)
    pg.locator("#addart").click(); pg.wait_for_timeout(250); a=pg.locator("#arts .art").last; a.locator(".art-name").fill("PAIN DE MIE"); a.locator(".art-prix").fill("1,85")
    pg.locator('#f-payer').select_option("Benoit"); pg.wait_for_timeout(500)
    check(pg.locator("#arts .art .art-prod").nth(1).input_value()=="Pain", "Benoit : PAIN DE MIE → Pain")
    pg.locator('#f-payer').select_option("Sylvette"); pg.wait_for_timeout(500)
    check(pg.locator("#arts .art .art-prod").nth(1).input_value()=="" and need()==1, "Sylvette : rien appris pour PAIN DE MIE → vide et orange (cloisonné)")
    # enregistré : le produit choisi est appris pour Sylvette
    pg.locator("#arts .art .art-prod").nth(1).fill("Pain de mie"); pg.locator("#f-montant").fill("50,54"); pg.wait_for_timeout(200)
    pg.locator("#save").click(); pg.wait_for_timeout(500)
    (pg.locator("#navplus").click(), pg.wait_for_timeout(300), pg.locator('.dr-row[data-k="man"]').click(), pg.wait_for_timeout(400), pg.locator('.cattiles .chip:not(.more)').first.click()); pg.wait_for_timeout(400); pg.locator('#f-payer').select_option("Sylvette"); pg.wait_for_timeout(300)
    pg.locator("#addart").click(); pg.wait_for_timeout(250); a=pg.locator("#arts .art").last; a.locator(".art-name").fill("PAIN DE MIE"); a.locator(".art-prix").fill("1,85")
    pg.locator('#f-payer').select_option("Benoit"); pg.wait_for_timeout(400); pg.locator('#f-payer').select_option("Sylvette"); pg.wait_for_timeout(400)
    check(pg.locator("#arts .art .art-prod").first.input_value()=="Pain de mie", "après l'enregistrement, Sylvette : PAIN DE MIE → Pain de mie")
    print("errors:", errs); check(not errs, "aucune erreur")
    b.close()
print(len(fails), "échec(s)")
