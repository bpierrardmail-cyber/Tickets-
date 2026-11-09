# Menu refondu (09/11) : page à sous-onglets Gérer · Sauvegarde · Réglages · Aide, recherche, retour au menu. Données inventées.
import sys, os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
sys.path.insert(0, HERE)
import horloge
from playwright.sync_api import sync_playwright
APP='file://'+ROOT+'/beta/index.html'; fails=[]
SP=(sys.argv[1] if len(sys.argv)>1 else HERE)
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
data={"askName":False,"devise":"EUR","welcomeSeen":True,"personnes":[{"nom":"Marie"}],
  "comptes":[{"key":"Benoit","nom":"Compte courant","payer":"Benoit","main":True}],
  "fraisCommuns":[{"id":5,"label":"Loyer","montant":700,"personne":"Commun","recurrent":True,"month":"2026-01","doneMonths":[]}],
  "entries":[{"id":100+i,"date":"2026-10-%02d"%(1+i),"marchand":"Magasin %d"%i,"montant":10+i,"categorie":"Alimentation","payePar":"Benoit","articles":[]} for i in range(3)]}
def txt(pg): return pg.locator("body").inner_text().replace("\xa0"," ")
with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    pg=b.new_page(viewport={'width':412,'height':900}); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    pg.goto(APP); pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); pg.reload(); pg.wait_for_timeout(1200)
    pg.locator("#hmenu").click(); pg.wait_for_timeout(400)
    check(pg.locator(".mnsub").count()==4 and pg.locator("#mnQ").count()==1, "☰ ouvre la page Menu : 4 sous-onglets et la recherche")
    t=txt(pg)
    for w in ["Comptes bancaires","Catégories et produits","Frais fixes","Provisions","Factures","Personnes","Foyer partagé","Corbeille"]: check(w in t, "Gérer : "+w)
    check("1 chaque mois" in t, "Frais fixes : nombre de frais")
    pg.screenshot(path=os.path.join(SP,"t156_gerer.png"))
    pg.locator('.mnsub[data-ms="sauv"]').click(); pg.wait_for_timeout(300); t=txt(pg)
    check("Dernière sauvegarde" in t and "Voir mon code de secours" in t and "Depuis un fichier" in t and "Exporter" in t, "Sauvegarde : état, code de secours, restaurer, exporter")
    pg.screenshot(path=os.path.join(SP,"t156_sauv.png"))
    pg.locator('.mnsub[data-ms="regl"]').click(); pg.wait_for_timeout(300); t=txt(pg)
    check("Affichage" in t and "Monnaie" in t and "Rappels" in t and "Mode démo" in t, "Réglages")
    pg.locator('.mnsub[data-ms="aide"]').click(); pg.wait_for_timeout(300); t=txt(pg)
    check("Guide" in t and "À propos" in t, "Aide")
    pg.reload(); pg.wait_for_timeout(900); pg.locator("#hmenu").click(); pg.wait_for_timeout(300)
    check(pg.locator('.mnsub.on[data-ms="aide"]').count()==1, "le dernier sous-onglet est gardé")
    pg.locator("#mnQ").fill("restaur"); pg.wait_for_timeout(300); t=txt(pg)
    check("Depuis un fichier" in t and "Sauvegarde › Restaurer" in t, "recherche : trouve « Restaurer » et dit où il est")
    pg.locator("#mnQ").fill("catégor"); pg.wait_for_timeout(300)
    pg.locator('.dr-row[data-k="cats"]').click(); pg.wait_for_timeout(500)
    check("Produits" in pg.locator(".htitle").inner_text(), "Catégories ouvre Produits & catégories")
    pg.locator("#hback").click(); pg.wait_for_timeout(400)
    check(pg.locator(".mnsub").count()==4, "‹ ramène au menu")
    pg.locator('.mnsub[data-ms="gerer"]').click(); pg.wait_for_timeout(300)
    pg.locator('.dr-row[data-k="frais"]').click(); pg.wait_for_timeout(500)
    check("Loyer" in txt(pg), "Frais fixes ouvre À venir › Frais fixes")
    check(pg.locator("#hback").count()==0 and pg.evaluate("()=>1")==1, "onglet À venir : pas de ‹, la barre du bas sert")
    pg.locator('#nav .navi[data-view="list"]').click(); pg.wait_for_timeout(300)
    pg.locator("#hmenu").click(); pg.wait_for_timeout(300); pg.locator("#hback").click(); pg.wait_for_timeout(400)
    check(pg.locator(".mnsub").count()==0 and pg.locator('#nav .navi.on[data-view="list"]').count()==1, "‹ du menu ramène à l'écran d'avant")
    pg.locator("#hmenu").click(); pg.wait_for_timeout(300); pg.locator('.mnsub[data-ms="regl"]').click(); pg.wait_for_timeout(300)
    pg.locator('.dr-row[data-k="aff"]').click(); pg.wait_for_timeout(300)
    check(pg.locator(".sheet-overlay").count()==1, "Affichage : la fenêtre s'ouvre")
    pg.locator(".sheet-overlay .ui-no").click(); pg.wait_for_timeout(200)
    pg.locator('.mnsub[data-ms="sauv"]').click(); pg.wait_for_timeout(300); pg.locator('.dr-row[data-k="code"]').click(); pg.wait_for_timeout(300)
    check("pas encore de code" in pg.locator(".sheet-overlay").last.inner_text(), "code de secours : expliqué quand il n'y en a pas")
    check(not errs, "pas d'erreur "+str(errs[:3]))
    b.close()
print("\n%d échec(s)" % len(fails)); sys.exit(1 if fails else 0)
