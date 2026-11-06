# Réparation des catégories (taxoV4, 06/11) : après la 1re migration, des familles écrites autrement (MAJUSCULES, « - », pluriel)
# étaient devenues des doublons. Elles sont fusionnées avec la catégorie qui veut dire la même chose, les noms en majuscules réécrits,
# « Véhicule » rangé dans Transport ; tickets, articles et budgets suivent ; la fenêtre « rangées » se rouvre. Données inventées.
import sys, os, json
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
APP='file://'+ROOT+'/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
cats=["Courses","Sorties","Transport","Maison","Santé","Loisirs","Shopping","Enfants","Animaux","Autre","Alimentation","Restaurant","Bricolage","Hygiène et soins",
      "HYGIÈNE- SOINS","BRICOLAGES - OUTILLAGE","MULTIMÉDIA - HIGH-TECH","BOISSONS ALCOOLISÉ","LOISIR","VÉHICULE","RESTAURANT - BAR"]
par={"Alimentation":"Courses","Restaurant":"Sorties","Bricolage":"Maison","Hygiène et soins":"Courses","HYGIÈNE- SOINS":"Courses","BRICOLAGES - OUTILLAGE":"Maison",
     "MULTIMÉDIA - HIGH-TECH":"Shopping","BOISSONS ALCOOLISÉ":"Courses","LOISIR":"Loisirs","VÉHICULE":"Autre","RESTAURANT - BAR":"Sorties"}
data={"askName":False,"devise":"EUR","welcomeSeen":True,"taxoV2":2,"taxoV3":3,"cats":cats,"catParent":par,"familles":cats,
  "familleDe":{"Savon":"HYGIÈNE- SOINS","Vis":"BRICOLAGES - OUTILLAGE","Vin":"BOISSONS ALCOOLISÉ","Câble":"MULTIMÉDIA - HIGH-TECH"},
  "comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True}],
  "budgets":{"LOISIR":50,"HYGIÈNE- SOINS":30,"Hygiène et soins":20},
  "entries":[{"id":1,"date":"2026-10-03","marchand":"Droguerie","montant":12,"categorie":"HYGIÈNE- SOINS","payePar":"Alex","articles":[{"label":"Savon","prix":12,"produit":"HYGIÈNE- SOINS"}]},
             {"id":2,"date":"2026-10-04","marchand":"Cave","montant":15,"categorie":"BOISSONS ALCOOLISÉ","payePar":"Alex","articles":[{"label":"Vin","prix":15,"produit":"BOISSONS ALCOOLISÉ"}]},
             {"id":3,"date":"2026-10-05","marchand":"Bowling","montant":20,"categorie":"LOISIR","payePar":"Alex","articles":[]},
             {"id":4,"date":"2026-10-06","marchand":"Garage","montant":80,"categorie":"VÉHICULE","payePar":"Alex","articles":[]}]}
with sync_playwright() as p:
    b=p.chromium.launch(); c=b.new_context(viewport={'width':412,'height':900}); c.add_init_script("window.__catMigTest=true")
    pg=c.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    pg.goto(APP); pg.wait_for_timeout(300)
    pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); pg.reload(); pg.wait_for_timeout(1800)
    def ls(k): return pg.evaluate("k=>JSON.parse(localStorage.getItem(k))", k)
    C=ls("cats"); P=ls("catParent"); E=ls("entries"); B=ls("budgets"); FD=ls("familleDe")
    print("  catégories :", C)
    check("HYGIÈNE- SOINS" not in C and "BRICOLAGES - OUTILLAGE" not in C and "MULTIMÉDIA - HIGH-TECH" not in C and "LOISIR" not in C and "RESTAURANT - BAR" not in C, "doublons fusionnés")
    check("Boissons alcoolisé" in C and "BOISSONS ALCOOLISÉ" not in C and "Véhicule" in C, "noms en majuscules réécrits")
    check(P.get("Véhicule")=="Transport", "Véhicule rangé dans Transport (%s)"%P.get("Véhicule"))
    check([e["categorie"] for e in E]==["Hygiène et soins","Boissons alcoolisé","Loisirs","Véhicule"], "tickets : catégories suivies %s"%[e["categorie"] for e in E])
    check(E[0]["articles"][0]["produit"]=="Hygiène et soins" and E[1]["articles"][0]["produit"]=="Boissons alcoolisé", "articles suivis")
    check(sum(e["montant"] for e in E)==127 and len(E)==4, "rien de perdu : 4 tickets, 127 €")
    check(B.get("Loisirs")==50 and B.get("Hygiène et soins")==20 and "HYGIÈNE- SOINS" not in B, "budgets : gardés (celui de la catégorie qui reste l'emporte) %s"%B)
    check(FD.get("Savon")=="Hygiène et soins" and FD.get("Vis")=="Bricolage" and FD.get("Câble")=="Multimédia - high-tech" or FD.get("Câble") in ("Multimédia","Multimédia - high-tech"), "produits suivis %s"%FD)
    sh=pg.locator(".sheet-overlay").last.inner_text() if pg.locator(".sheet-overlay").count() else ""
    check("rangées" in sh.lower(), "la fenêtre « rangées » se rouvre")
    w=pg.evaluate("()=>{ var b=document.querySelector('.sheet-overlay .cmg'); return b ? b.getBoundingClientRect().width : 0; }")
    check(0<w<140, "bouton « Changer » à sa taille (%d px)"%w)
    check(ls("taxoV4")==4, "réparation faite une seule fois")
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
print("\n%d échec(s)"%len(fails)); sys.exit(1 if fails else 0)
