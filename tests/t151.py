# Catégories et produits (07/11, maquette validée) : grandes catégories repliées, produits par lettre avec barre A–Z,
# nouveau produit tapé dans un ticket : sa catégorie proposée sous l'article (devinée, sinon celle du ticket), modifiable, créée à l'enregistrement.
import sys, os, json
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
APP='file://'+ROOT+'/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def norm(t): return t.replace(" "," ").replace("\xa0"," ")
prods=["Abricot","Ail","Banane","Beurre","Café","Chips","Dentifrice","Éponge","Lait","Miel","Moutarde","Pain","Riz","Savon","Thé","Yaourt"]
data={"askName":False,"devise":"EUR","welcomeSeen":True,"taxoV2":2,"taxoV3":3,"taxoV4":4,"personnes":[{"nom":"Marie"}],
  "comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True}],
  "produits":prods,"familleDe":{p:"Alimentation" for p in prods}}
with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    c=b.new_context(viewport={'width':412,'height':900}); pg=c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('dialog', lambda d: d.accept())
    pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    pg.goto(APP); pg.wait_for_timeout(300)
    pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); pg.reload(); pg.wait_for_timeout(1300)
    def ls(k): return pg.evaluate("k=>JSON.parse(localStorage.getItem(k))", k)
    def produits():
        pg.locator('#nav .navi[data-view="depenses"]').click(); pg.wait_for_timeout(500); pg.locator('.dpsub', has_text="Produits").click(); pg.wait_for_timeout(500)
        pg.locator("#artprod").click(); pg.wait_for_timeout(600)
    produits()
    # 1. catégories repliées
    t=norm(pg.locator("#app").inner_text())
    check(pg.locator(".prow.cts").count()==0 and pg.locator(".cttog").count()>=5 and "sous-catégorie" in t, "les grandes catégories sont repliées, avec leur nombre de sous-catégories")
    pg.locator('.cttog[data-cat="Courses"]').click(); pg.wait_for_timeout(400)
    subs=[norm(x) for x in pg.locator(".prow.cts .pname").all_inner_texts()]
    check(any("Alimentation" in x for x in subs) and pg.locator('.cttog[data-cat="Courses"]').get_attribute("aria-expanded")=="true", "toucher « Courses » la déplie : %s"%subs)
    pg.locator('.cttog[data-cat="Courses"]').click(); pg.wait_for_timeout(400)
    check(pg.locator(".prow.cts").count()==0, "la retoucher la replie")
    # 2. produits par lettre
    lets=[norm(x).split(" ")[0] for x in pg.locator(".plet").all_inner_texts()]
    check(lets==sorted(set(lets)) and "E" in lets and "É" not in lets and len(lets)>=10, "un titre par lettre, dans l'ordre, sans doublon (É rangé avec E) : %s"%lets)
    off=pg.evaluate("()=>[...document.querySelectorAll('#paz button.off')].map(b=>b.dataset.l)")
    check(off and not set(off)&set(lets) and pg.locator('#paz button[data-l="M"]').is_enabled() and not pg.locator('#paz button[data-l="%s"]'%off[0]).is_enabled(), "barre A–Z : les lettres sans produit sont grisées (%s)"%"".join(off))
    check("2 produits" in norm(pg.locator("#plet-M").inner_text()), "« M · 2 produits »")
    pg.locator('#paz button[data-l="S"]').click(); pg.wait_for_timeout(400)
    top,atEnd=pg.evaluate("()=>[document.getElementById('plet-S').getBoundingClientRect().top, innerHeight+scrollY>=document.documentElement.scrollHeight-2]")
    check(-2<top<40 or atEnd, "toucher « S » descend aux produits en S (%d px, bas de page : %s)"%(top, atEnd))
    pg.locator("#prodsearch").fill("mi"); pg.wait_for_timeout(300)
    vis=pg.evaluate("()=>[...document.querySelectorAll('.prodrow')].filter(x=>x.style.display!=='none').map(x=>x.querySelector('.pname').textContent)")
    check(pg.locator(".plet:visible").count()==0 and pg.locator("#paz:visible").count()==0 and "Miel" in vis and "Moutarde" not in vis, "recherche : les lettres disparaissent, « Miel » reste, pas « Moutarde » (%s)"%vis)
    # 3. ticket : nouveau produit
    pg.locator("#hback").click(); pg.wait_for_timeout(400)
    pg.locator('#nav .navi[data-view="list"]').click(); pg.wait_for_timeout(400)
    pg.locator("#navplus").click(); pg.wait_for_timeout(300); pg.locator('.sheet-overlay .dr-row[data-k="man"]').click(); pg.wait_for_timeout(500)
    pg.locator("#f-montant").fill("9,64"); pg.locator("#f-marchand").fill("Supermarché Fictif")
    if pg.locator('#chips .chip[data-cat="Courses"]').count()==0: pg.locator("#catMore").click(); pg.wait_for_timeout(300)
    pg.locator('#chips .chip[data-cat="Courses"]').first.click(); pg.wait_for_timeout(300)
    pg.locator('.catsubs .cs[data-sub="Alimentation"]').click(); pg.wait_for_timeout(300)
    for k in range(2): pg.locator("#addart").click(); pg.wait_for_timeout(300)
    arts=pg.locator("#arts .art")
    arts.nth(0).locator(".art-name").fill("PQ LOTUS 12R"); arts.nth(0).locator(".art-prix").fill("6,49")
    arts.nth(0).locator(".art-prod").fill("Papier toilette"); pg.wait_for_timeout(300)
    t=norm(arts.nth(0).locator(".art-new").inner_text())
    check("Nouveau produit" in t and "Alimentation" in t and "Celle du ticket" in t, "nom nouveau : « Nouveau produit · Catégorie : Alimentation », celle du ticket (%s)"%t)
    check("+ Créer « Papier toilette »" in norm(arts.nth(0).locator(".combo-pop").inner_text()), "la liste propose « + Créer « Papier toilette » »")
    arts.nth(0).locator(".art-name").click(); pg.wait_for_timeout(300)   # la liste des produits se ferme
    arts.nth(0).locator(".art-newcat").click(); pg.wait_for_timeout(400)
    pg.locator('.sheet-overlay .cpk[data-c="Bricolage"]').click(); pg.wait_for_timeout(400)
    arts=pg.locator("#arts .art")
    t=norm(arts.nth(0).locator(".art-new").inner_text())
    check("Bricolage" in t and "Touche pour changer" not in t and arts.nth(0).locator(".art-prod").input_value()=="Papier toilette", "catégorie changée : « Bricolage », le nom tapé est gardé")
    arts.nth(1).locator(".art-name").fill("SIROP PHARMA"); arts.nth(1).locator(".art-prix").fill("3,15")
    arts.nth(1).locator(".art-prod").fill("Sirop pharmacie"); pg.wait_for_timeout(300)
    t=norm(arts.nth(1).locator(".art-new").inner_text())
    check("Santé" in t and "Devinée" in t, "« Sirop pharmacie » : catégorie devinée d'après le nom (%s)"%t)
    arts.nth(1).locator(".art-prod").fill("Miel"); pg.wait_for_timeout(300)
    check(arts.nth(1).locator(".art-new").inner_text().strip()=="", "produit existant : pas de ligne « Nouveau produit »")
    arts.nth(1).locator(".art-prod").fill("Sirop pharmacie"); pg.wait_for_timeout(200)
    pg.locator("button:has-text('Enregistrer')").first.click(); pg.wait_for_timeout(700)
    if pg.locator(".sheet-overlay .ui-yes").count(): pg.locator(".sheet-overlay .ui-yes").last.click(); pg.wait_for_timeout(500)
    fd=ls("familleDe"); pr=ls("produits")
    check(fd.get("Papier toilette")=="Bricolage" and "Papier toilette" in pr, "enregistré : « Papier toilette » créé dans Bricolage (%s)"%fd.get("Papier toilette"))
    check(fd.get("Sirop pharmacie") in ("Santé","Pharmacie") and fd.get("Sirop pharmacie")!="Autre", "« Sirop pharmacie » créé dans la catégorie devinée, pas dans « Autre » (%s)"%fd.get("Sirop pharmacie"))
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
print("\n%d échec(s)"%len(fails)); sys.exit(1 if fails else 0)
