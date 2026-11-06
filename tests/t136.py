# Catégories en arbre (06/11) : grandes catégories + sous-catégories. Données inventées.
# 1. Anciennes catégories : rangées comme sous-catégories (Bar → Sorties, Carburant → Transport, prêt à porter → Shopping), tickets inchangés ; fenêtre « Tes catégories sont rangées ».
# 2. Fiche d'un ticket : 10 grandes tuiles, les sous-catégories de celle choisie ; enregistré dans la sous-catégorie.
# 3. Budgets : une grande catégorie compte ses sous-catégories ; une sous-catégorie seulement elle.
# 4. Gérer : ajouter une sous-catégorie, la déplacer, renommer (le budget suit).
# 5. Familles de produits réunies avec l'arbre : Hygiène & soins → Hygiène et soins, Bricolage & outillage → Bricolage, Fruits & légumes → nouvelle sous-catégorie, Nourriture → Alimentation, Divers → Autre.
import sys, os, json
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
APP='file://'+ROOT+'/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def norm(t): return t.replace(" "," ").replace("\xa0"," ")
data={"askName":False,"devise":"EUR","welcomeSeen":True,
  "cats":["Alimentation","Restaurant","Carburant","Maison","Santé","Transport","Loisirs","Bar","Multimédia","prêt à porter","Pharmacie","Hygiène et soins","Bricolage","Autre"],
  "taxoV2":2, "familles":["Nourriture","Hygiène & soins","Bricolage & outillage","Fruits & légumes","Divers"],
  "familleDe":{"Lait":"Nourriture","Savon":"Hygiène & soins","Vis":"Bricolage & outillage","Pommes":"Fruits & légumes","Éponge":"Divers"},
  "produits":["Nourriture","Hygiène & soins","Bricolage & outillage","Fruits & légumes","Divers","Lait","Savon","Vis","Pommes","Éponge","Remise"],
  "comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True}],
  "budgets":{"Transport":200,"Bar":30},
  "entries":[{"id":1,"date":"2026-10-03","marchand":"Station Fictive","montant":120,"categorie":"Carburant","payePar":"Alex","articles":[]},
             {"id":2,"date":"2026-10-05","marchand":"Parking du Port","montant":30,"categorie":"Transport","payePar":"Alex","articles":[]},
             {"id":3,"date":"2026-10-07","marchand":"Le Comptoir","montant":36,"categorie":"Bar","payePar":"Alex","articles":[]},
             {"id":4,"date":"2026-10-09","marchand":"Pizzeria","montant":40,"categorie":"Restaurant","payePar":"Alex","articles":[]},
             {"id":5,"date":"2026-10-11","marchand":"Marché","montant":0,"categorie":"Alimentation","payePar":"Alex","articles":[{"label":"Divers légumes","prix":0,"produit":"Nourriture"}]}]}
with sync_playwright() as p:
    b=p.chromium.launch(); c=b.new_context(viewport={'width':412,'height':900}); errs=[]
    c.add_init_script("window.__catMigTest=true")
    pg=c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    pg.goto(APP); pg.wait_for_timeout(300)
    pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); pg.reload(); pg.wait_for_timeout(1500)
    def ls(k): return pg.evaluate("k=>JSON.parse(localStorage.getItem(k))", k)
    P=ls("catParent") or {}
    check(P.get("Bar")=="Sorties" and P.get("Carburant")=="Transport" and P.get("prêt à porter")=="Shopping" and P.get("Alimentation")=="Courses" and P.get("Pharmacie")=="Santé" and "Transport" not in P, "anciennes catégories rangées %s"%P)
    cats=ls("cats"); check(all(x in cats for x in ["Courses","Sorties","Shopping","Enfants","Animaux","Bar","Multimédia"]), "grandes catégories ajoutées, anciennes gardées")
    check([e["categorie"] for e in ls("entries")]==["Carburant","Transport","Bar","Restaurant","Alimentation"], "tickets inchangés")
    FD=ls("familleDe"); F=ls("familles"); P2=ls("catParent")
    check(FD.get("Lait")=="Alimentation" and FD.get("Savon")=="Hygiène et soins" and FD.get("Vis")=="Bricolage" and FD.get("Pommes")=="Fruits & légumes" and FD.get("Éponge")=="Autre", "produits rangés dans l'arbre %s"%FD)
    check(P2.get("Fruits & légumes")=="Courses", "nouvelle sous-catégorie pour une famille sans équivalent %s"%P2.get("Fruits & légumes"))
    check(set(F)==set(ls("cats")) and "Nourriture" not in F and "Divers" not in F, "plus de familles à part : la liste = les catégories")
    check(ls("entries")[4]["articles"][0]["produit"]=="Alimentation", "article rangé « Nourriture » → Alimentation")
    pg.wait_for_timeout(1200); sh=norm(pg.locator(".sheet-overlay").last.inner_text()) if pg.locator(".sheet-overlay").count() else ""; print("  fenêtre :", sh[:120].replace("\n"," | "))
    check("tes catégories sont rangées" in sh.lower() and "Multimédia" in sh, "fenêtre « Tes catégories sont rangées »")
    pg.locator(".sheet-overlay .ui-no").last.click(); pg.wait_for_timeout(400)
    check(ls("catMigShow") is None, "… montrée une seule fois")
    # 2. fiche d'un ticket
    pg.locator("#navplus").click(); pg.wait_for_timeout(300); pg.locator('.dr-row[data-k="man"]').click(); pg.wait_for_timeout(500)
    tiles=pg.evaluate("()=>[].map.call(document.querySelectorAll('#chips .chip[data-cat]'), b=>b.getAttribute('data-cat'))")
    check(len(tiles)==10 and tiles[0]=="Courses" and tiles[-1]=="Autre", "10 grandes tuiles %s"%tiles)
    pg.locator('#chips .chip[data-cat="Sorties"]').click(); pg.wait_for_timeout(400)
    subs=pg.evaluate("()=>[].map.call(document.querySelectorAll('.catsubs .cs[data-sub]'), b=>b.getAttribute('data-sub'))")
    check(set(subs)=={"Restaurant","Bar"}, "Sorties : ses sous-catégories %s"%subs)
    pg.locator('.catsubs .cs[data-sub="Bar"]').click(); pg.wait_for_timeout(300)
    pg.locator("#f-montant").fill("12"); pg.locator("#f-marchand").fill("Café Fictif"); pg.locator("#save").click(); pg.wait_for_timeout(700)
    if pg.locator("#cksave").count(): pg.locator("#cksave").click(); pg.wait_for_timeout(400)
    E=ls("entries"); check(any(e["marchand"]=="Café Fictif" and e["categorie"]=="Bar" for e in E), "enregistré dans Sorties › Bar")
    # 3. budgets
    pg.locator('#nav .navi[data-view="depenses"]').click(); pg.wait_for_timeout(700)
    t=norm(pg.locator("#app").inner_text())
    check("Transport" in t and "reste 50,00" in t, "Transport (200 €) compte Carburant et Transport : reste 50 €")
    check("Bar" in t and "dépassé de 18,00" in t, "Bar (30 €) seulement lui : 48 €, dépassé de 18 €")
    # 4. gérer
    pg.locator('.dpsub', has_text="Produits").click(); pg.wait_for_timeout(500)
    if pg.locator("#artprod").count(): pg.locator("#artprod").click()
    else: pg.evaluate("()=>{}")
    pg.wait_for_timeout(600)
    pg.once("dialog", lambda d: d.accept("Péage"))
    pg.locator('.catadd[data-cat="Transport"]').click(); pg.wait_for_timeout(500)
    check(ls("catParent").get("Péage")=="Transport", "＋ dans Transport : sous-catégorie Péage")
    pg.locator('.catmv[data-cat="Péage"]').click(); pg.wait_for_timeout(400)
    pg.locator(".sheet-overlay button", has_text="Loisirs").click(); pg.wait_for_timeout(400)
    check(ls("catParent").get("Péage")=="Loisirs", "Déplacer : Péage dans Loisirs")
    pg.once("dialog", lambda d: d.accept("Bistrot"))
    pg.evaluate("()=>{ var b=document.querySelector('.catren[data-cat=\"Bar\"]'); b.style.display=''; b.click(); }"); pg.wait_for_timeout(500)
    check(ls("budgets").get("Bistrot")==30 and "Bar" not in ls("budgets") and ls("catParent").get("Bistrot")=="Sorties" and any(e["categorie"]=="Bistrot" for e in ls("entries")), "renommer Bar : budget, rangement et tickets suivent")
    # supprimer : rien n'est perdu, et « Annuler » remet tout
    pg.once("dialog", lambda d: d.accept())
    pg.evaluate("()=>{ var b=document.querySelector('.catdel[data-cat=\"Bistrot\"]'); b.style.display=''; b.click(); }"); pg.wait_for_timeout(500)
    E=ls("entries"); B=ls("budgets")
    check(not any(e["categorie"]=="Bistrot" for e in E) and sum(1 for e in E if e["categorie"]=="Sorties")==2 and B.get("Sorties")==30 and "Bistrot" not in ls("cats"), "supprimer Bistrot : ses 2 tickets et son budget passent dans Sorties")
    pg.locator(".toast button, .ui-toast button, button", has_text="Annuler").last.click(); pg.wait_for_timeout(500)
    E=ls("entries"); B=ls("budgets")
    check(sum(1 for e in E if e["categorie"]=="Bistrot")==2 and B.get("Bistrot")==30 and "Sorties" not in B and "Bistrot" in ls("cats") and ls("catParent").get("Bistrot")=="Sorties", "Annuler : tout revient")
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
print("\n%d échec(s)"%len(fails)); sys.exit(1 if fails else 0)
