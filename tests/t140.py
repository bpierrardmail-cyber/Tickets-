# Corrections de la relecture indépendante (06/11) : catégories en arbre. Données inventées.
# 1. restaurer une sauvegarde d'avant l'arbre refait les migrations (familles gardées, pas tout dans « Autre ») ;
# (2. membre sans ✎ ni ✕ sur les catégories : vérifié dans t138, foyer réel)
# 3. réparation : « Carburant » (la plus ancienne, avec ses tickets) est gardée face à « Carburants », ses mots-clés suivent ;
# 5. annuler une suppression remet la catégorie et ses tickets (seulement ceux qu’elle avait touchés) ; 6. nom déjà pris (casse, pluriel) refusé ; 7. « Achats » n'est pas rangé dans Animaux.
import sys, os, json, tempfile
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
APP='file://'+ROOT+'/beta/index.html'; fails=[]; TMP=tempfile.mkdtemp()
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
NEW={"askName":False,"devise":"EUR","welcomeSeen":True,"comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True}],
  "entries":[{"id":1,"date":"2026-10-03","marchand":"Station","montant":40,"categorie":"Carburant","payePar":"Alex","articles":[]}]}
def start(b, d, init=""):
    c=b.new_context(viewport={'width':412,'height':900}); c.add_init_script("window.__catMigTest=true;"+init)
    pg=c.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); dlg=[]
    pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    pg.goto(APP); pg.wait_for_timeout(300)
    pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", d); pg.reload(); pg.wait_for_timeout(1500)
    while pg.locator(".sheet-overlay .ui-no").count(): pg.locator(".sheet-overlay .ui-no").last.click(); pg.wait_for_timeout(250)
    return c, pg, errs, dlg
def ls(pg, k): return pg.evaluate("k=>JSON.parse(localStorage.getItem(k))", k)
def produits(pg):
    pg.locator('#nav .navi[data-view="depenses"]').click(); pg.wait_for_timeout(500)
    pg.locator('.dpsub', has_text="Produits").click(); pg.wait_for_timeout(500); pg.locator("#artprod").click(); pg.wait_for_timeout(500)
allerr=[]
with sync_playwright() as p:
    b=p.chromium.launch()
    # 1. restauration d'une sauvegarde de septembre (familles à part, pas d'arbre)
    c, pg, errs, dlg = start(b, NEW); allerr+=errs
    pg.on("dialog", lambda d: (dlg.append(d.message), d.accept()))
    old={"_app":"tickets","_version":1,"data":{"taxoV2":2,"cats":["Alimentation","Carburant","Autre"],"familles":["Nourriture","Hygiène & soins","Bricolage & outillage","Divers"],
      "familleDe":{"Savon":"Hygiène & soins","Vis":"Bricolage & outillage","Pain":"Nourriture"},"produits":["Savon","Vis","Pain"],
      "comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True}],
      "entries":[{"id":7,"date":"2026-09-02","marchand":"Brico","montant":9,"categorie":"Autre","payePar":"Alex","articles":[{"label":"VIS X10","prix":9,"produit":"Bricolage & outillage"}]}]}}
    OP=os.path.join(TMP, "septembre.json"); json.dump(old, open(OP,"w"))
    pg.set_input_files("#restorein", OP)
    for _ in range(60):
        if any("restaurée" in m for m in dlg): break
        pg.wait_for_timeout(150)
    pg.wait_for_timeout(2500)
    C=ls(pg,"cats"); FD=ls(pg,"familleDe"); E=ls(pg,"entries")
    print("  après restauration :", C, FD)
    check(ls(pg,"catParent") and ls(pg,"taxoV3")==3, "migrations refaites (arbre, familles)")
    check(FD.get("Savon") not in (None,"Autre") and FD.get("Vis") not in (None,"Autre"), "produits pas tombés dans « Autre » (%s, %s)"%(FD.get("Savon"), FD.get("Vis")))
    check(E[0]["articles"][0]["produit"]==FD.get("Vis"), "l'article suit sa famille (%s)"%E[0]["articles"][0]["produit"])
    c.close()
    # 3. réparation : Carburant garde sa place, ses mots-clés suivent
    d=dict(NEW); d.update({"taxoV2":2,"taxoV3":3,"cats":["Courses","Sorties","Transport","Maison","Santé","Loisirs","Shopping","Enfants","Animaux","Autre","Carburant","Carburants","Achats"],
      "catParent":{"Carburant":"Transport","Carburants":"Transport","Achats":"Autre"},"budgets":{"Carburant":120}})
    c, pg, errs, dlg = start(b, d); allerr+=errs
    C=ls(pg,"cats"); print("  après réparation :", C)
    check("Carburant" in C and "Carburants" not in C and ls(pg,"entries")[0]["categorie"]=="Carburant" and ls(pg,"budgets").get("Carburant")==120, "réparation : « Carburant » (tickets, budget) gardée")
    check(ls(pg,"catParent").get("Achats")!="Animaux", "« Achats » pas rangé dans Animaux (%s)"%ls(pg,"catParent").get("Achats"))
    # 6. nom déjà pris
    produits(pg); msgs=[]
    pg.once("dialog", lambda x: x.accept("carburants")); pg.on("dialog", lambda x: (msgs.append(x.message), x.accept()) if x.type=="alert" else None)
    pg.locator('.catadd[data-cat="Transport"]').click(); pg.wait_for_timeout(500)
    check("carburants" not in ls(pg,"cats") and any("existe déjà" in m for m in msgs), "« carburants » refusé : déjà là sous un autre nom")
    # 5. supprimer, enregistrer un ticket, annuler : le nouveau ticket reste
    pg.once("dialog", lambda x: x.accept()); pg.evaluate("()=>{ var b=document.querySelector('.catdel[data-cat=\"Carburant\"]'); b.style.display=''; b.click(); }"); pg.wait_for_timeout(400)
    check(ls(pg,"entries")[0]["categorie"]=="Transport", "suppression : le ticket passe dans Transport")
    pg.locator(".ui-toast button, .undo-btn, [data-undo]").first.click() if pg.locator(".ui-toast button, .undo-btn, [data-undo]").count() else None
    pg.wait_for_timeout(500)
    check(ls(pg,"entries")[0]["categorie"]=="Carburant" and "Carburant" in ls(pg,"cats"), "annuler : la catégorie et son ticket reviennent")
    c.close()
    errs2=[e for e in allerr if "Failed to load resource" not in e]
    check(not errs2, "pas d'erreur %s"%errs2[:3])
    b.close()
print("\n%d échec(s)"%len(fails)); sys.exit(1 if fails else 0)
