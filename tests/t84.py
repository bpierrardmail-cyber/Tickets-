# Nom d'un article lu sur un ticket (18/11 : un seul nom par article) : vide = en orange, avec des suggestions ;
# rempli avec le dernier nom que la personne (« Payé par ») a donné à ce texte lu, cloisonné par personne ; ce qui a été lu reste en petit.
import sys, os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
SP=(sys.argv[1] if len(sys.argv)>1 else HERE); APP='file://'+ROOT+'/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def norm(t): return t.replace(" "," ").replace("\xa0"," ")
def T(i,d,who,arts): return {"id":i,"date":d,"marchand":"X","montant":round(sum(a[1] for a in arts),2),"categorie":"Carburant","payePar":who,"articles":[{"label":a[0],"prix":a[1],"produit":a[2]} for a in arts]}
data={"askName":False,"devise":"EUR","welcomeSeen":True,"personnes":[{"nom":"Sylvette"}],"comptes":[{"key":"Benoit","nom":"Compte courant","payer":"Benoit","main":True}],
  "entries":[T(1,"2026-09-01","Benoit",[("GAZOLE",40,"Carburant")]), T(2,"2026-10-01","Benoit",[("GAZOLE",45,"Gazole"),("PAIN DE MIE",1.85,"Pain")]),
             T(3,"2026-10-05","Sylvette",[("GAZOLE",50,"Diesel")]),
             T(4,"2026-10-20","Benoit",[("GAZOLE",48.69,""),("PAIN DE MIE",1.85,"")])]}
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={'width':412,'height':900}).new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    pg.goto(APP); pg.wait_for_timeout(300)
    pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); pg.reload(); pg.wait_for_timeout(1000)
    pg.locator('#nav .navi[data-view="compte"]').click(); pg.wait_for_timeout(400); pg.locator('.avtabs .cpsub[data-cp="tk"]').click(); pg.wait_for_timeout(400)
    pg.locator('.entry[data-id="4"]').click(); pg.wait_for_timeout(600)
    prod=lambda i=0: pg.locator("#arts .art .art-prod").nth(i).input_value()
    need=lambda: pg.locator("#arts .art-prod.need").count()
    lu=lambda i=0: norm(pg.locator("#arts .art").nth(i).inner_text())
    check(pg.locator("#arts .art .art-name").count()==0 and pg.locator("#arts .art").count()==2, "un seul champ par article (plus de champ « article » à part)")
    check("lu : GAZOLE" in lu(0) and prod(0)=="" and need()==2 and pg.locator("#arts .art .art-prod").first.get_attribute("placeholder")=="Quel article ?", "texte lu en petit, nom vide en orange (« Quel article ? »)")
    c=norm(pg.locator("#artchk").inner_text()); check("2 à nommer" in c, "bandeau : « 2 à nommer » (%s)" % c.replace("\n"," | "))
    sg=[norm(x) for x in pg.locator("#arts .art").nth(0).locator(".art-sugb").all_inner_texts()]
    check("Gazole" in sg, "suggestions pour GAZOLE : %s" % sg)
    pg.screenshot(path=os.path.join(SP,"t84_vide.png"))
    pg.locator('#f-payer').select_option("Sylvette"); pg.wait_for_timeout(500)
    check(prod(0)=="Diesel", "Payé par Sylvette : son dernier nom pour GAZOLE (Diesel)")
    check(prod(1)=="" and need()==1, "Sylvette : rien appris pour PAIN DE MIE → vide et orange (cloisonné)")
    sg=[norm(x) for x in pg.locator("#arts .art").nth(1).locator(".art-sugb").all_inner_texts()]
    check("Pain" in sg, "suggestion « Pain » pour PAIN DE MIE (le nom est dans le texte lu) : %s" % sg)
    pg.locator('#f-payer').select_option("Benoit"); pg.wait_for_timeout(500)
    check(prod(0)=="Gazole" and prod(1)=="Pain", "Payé par Benoit : Gazole (pas l'ancien « Carburant ») et Pain, remplis tout seuls donc remplacés")
    # nom tapé : ne bouge plus
    pg.locator("#arts .art .art-prod").first.fill("Plein"); pg.wait_for_timeout(200)
    pg.locator('#f-payer').select_option("Sylvette"); pg.wait_for_timeout(500)
    check(prod(0)=="Plein", "nom tapé à la main : ne change pas avec « Payé par »")
    # suggestion touchée
    pg.locator("#arts .art").nth(1).locator(".art-sugb", has_text="Pain").first.click(); pg.wait_for_timeout(400)
    check(prod(1)=="Pain" and "lu : PAIN DE MIE" in lu(1), "suggestion touchée : « Pain », le texte lu reste")
    pg.locator("#arts .art .art-prod").nth(1).fill("Pain de mie"); pg.wait_for_timeout(200)
    pg.locator("#save").click(); pg.wait_for_timeout(600)
    if pg.locator("#cksave").count(): pg.locator("#cksave").click(); pg.wait_for_timeout(500)
    E=pg.evaluate("()=>JSON.parse(localStorage.getItem('entries'))"); e=[x for x in E if x["id"]==4][0]
    check([(a["label"], a["produit"]) for a in e["articles"]]==[("GAZOLE","Plein"),("PAIN DE MIE","Pain de mie")], "enregistré : texte lu gardé, nom donné %s" % [(a["label"], a["produit"]) for a in e["articles"]])
    # saisi à la main : le nom suffit (gardé aussi comme texte)
    pg.locator("#navplus").click(); pg.wait_for_timeout(300); pg.locator('.dr-row[data-k="man"]').click(); pg.wait_for_timeout(400); pg.locator('.cattiles .chip:not(.more)').first.click(); pg.wait_for_timeout(300)
    pg.locator("#f-montant").fill("3,20"); pg.locator("#f-marchand").fill("Boulangerie Test"); pg.locator("#addart").click(); pg.wait_for_timeout(250)
    a=pg.locator("#arts .art").last; check(a.locator(".art-lu").count()==0 and a.locator(".art-prod").get_attribute("placeholder").startswith("Article"), "saisie à la main : pas de texte lu, « Article — tape ou choisis »")
    a.locator(".art-prod").fill("Pain"); a.locator(".art-prix").fill("3,20"); pg.locator("#f-marchand").click(); pg.wait_for_timeout(200)
    pg.locator("#save").click(); pg.wait_for_timeout(600)
    E=pg.evaluate("()=>JSON.parse(localStorage.getItem('entries'))"); e=[x for x in E if x["marchand"]=="Boulangerie Test"]
    check(e and e[0]["articles"]==[{"label":"Pain","prix":3.2,"produit":"Pain","commun":False}], "enregistré : l'article « Pain » à 3,20 € %s" % (e[0]["articles"] if e else None))
    print("errors:", errs); check(not errs, "aucune erreur")
    b.close()
print(len(fails), "échec(s)")
sys.exit(1 if fails else 0)
