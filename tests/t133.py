# Refonte, étapes 4 et 5 (06/11). Données inventées.
# 1. Fiche d'un ticket saisi à la main : pas de catégorie d'avance, Enregistrer refuse sans catégorie (« Choisis une catégorie »).
# 2. Ticket sans article : un article du ticket entier est ajouté tout seul (le compte tombe juste) ; prix tapé dans le champ produit → mis dans le prix.
# 3. Retrait au distributeur : « Mettre dans mon liquide » (virement sorti + liquide), ou « Garder comme une dépense ».
# 4. Page Tickets : un ticket sans article ne compte pas comme un écart.
# 5. À venir › « À payer bientôt » limité à 4 (« Voir les N autres ») ; Foyer : détail du graphique replié.
# 6. Premier démarrage : après le prénom et la monnaie, « Remplis ton appli en une minute ».
import sys, os, json
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
APP='file://'+ROOT+'/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def norm(t): return t.replace(" "," ").replace("\xa0"," ").replace(" "," ")
base={"askName":False,"devise":"EUR","welcomeSeen":True,"personnes":[{"nom":"Marie"}],"communParts":{"Alex":50,"Marie":50},
  "comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True}],
  "fraisCommuns":[{"id":10+i,"label":"Frais %d"%i,"montant":10+i,"personne":"Alex","recurrent":True,"startMonth":"2026-01","jour":31,"doneMonths":{}} for i in range(7)],
  "entries":[{"id":1,"date":"2026-10-03","marchand":"Station Fictive","montant":60,"categorie":"Carburant","payePar":"Alex","articles":[]}]}
with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    def page(ls):
        c=b.new_context(viewport={'width':412,'height':900}); pg=c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
        pg.goto(APP); pg.wait_for_timeout(300)
        pg.evaluate("d=>{ localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k])); }", ls); pg.wait_for_timeout(200)
        pg.reload(); pg.wait_for_timeout(1300); return pg
    def entries(pg): return pg.evaluate("()=>JSON.parse(localStorage.getItem('entries'))")
    def newTicket(pg, amt, mag):
        pg.locator("#navplus").click(); pg.wait_for_timeout(300); pg.locator('.sheet-overlay .dr-row[data-k="man"]').click(); pg.wait_for_timeout(500)
        pg.locator("#f-montant").fill(amt); pg.locator("#f-marchand").fill(mag)
    pg=page(base)
    newTicket(pg, "12,50", "Boutique Test")
    check(pg.locator("#chips .chip.on").count()==0 and "à choisir" in norm(pg.locator("#app").inner_text()), "saisie à la main : pas de catégorie d'avance")
    pg.locator("#fsave, button:has-text('Enregistrer')").first.click(); pg.wait_for_timeout(500)
    check(len(entries(pg))==1 and "Choisis une catégorie" in norm(pg.locator("body").inner_text()), "Enregistrer refusé sans catégorie")
    if pg.locator('#chips .chip[data-cat="Loisirs"]').count()==0: pg.locator("#catMore").click(); pg.wait_for_timeout(300)
    pg.locator('#chips .chip[data-cat="Loisirs"]').click(); pg.wait_for_timeout(300)
    pg.locator("button:has-text('Enregistrer')").first.click(); pg.wait_for_timeout(700)
    E=entries(pg); e=[x for x in E if x["marchand"]=="Boutique Test"]
    check(len(e)==1 and len(e[0]["articles"])==1 and abs(e[0]["articles"][0]["prix"]-12.5)<0.001 and "ticket entier" in e[0]["articles"][0]["label"], "ticket sans article : un article du ticket entier ajouté %s" % (e[0]["articles"] if e else None))
    # retrait
    newTicket(pg, "60", "RETRAIT DAB")
    if pg.locator('#chips .chip[data-cat="Autre"]').count()==0: pg.locator("#catMore").click(); pg.wait_for_timeout(300)
    pg.locator('#chips .chip[data-cat="Autre"]').click(); pg.wait_for_timeout(300)
    pg.locator("button:has-text('Enregistrer')").first.click(); pg.wait_for_timeout(500)
    s=norm(pg.locator(".sheet-overlay").last.inner_text()) if pg.locator(".sheet-overlay").count() else ""
    check("retrait d'espèces" in s.lower(), "retrait : la question « Retrait d'espèces ? »")
    pg.locator(".sheet-overlay button", has_text="Mettre dans mon liquide").click(); pg.wait_for_timeout(700)
    V=pg.evaluate("()=>JSON.parse(localStorage.getItem('virements')||'[]')"); L=pg.evaluate("()=>JSON.parse(localStorage.getItem('liquideMois')||'{}')")
    check(not [x for x in entries(pg) if x["marchand"]=="RETRAIT DAB"] and any(v["montant"]==-60 and v["label"]=="Retrait d'espèces" for v in V) and L.get("Alex",{}).get("2026-10")==60, "« Mettre dans mon liquide » : pas de ticket, virement sorti et 60 € de liquide")
    newTicket(pg, "40", "RETRAIT DAB")
    if pg.locator('#chips .chip[data-cat="Autre"]').count()==0: pg.locator("#catMore").click(); pg.wait_for_timeout(300)
    pg.locator('#chips .chip[data-cat="Autre"]').click(); pg.wait_for_timeout(300)
    pg.locator("button:has-text('Enregistrer')").first.click(); pg.wait_for_timeout(500)
    pg.locator(".sheet-overlay button", has_text="Garder comme une dépense").click(); pg.wait_for_timeout(700)
    check(len([x for x in entries(pg) if x["marchand"]=="RETRAIT DAB"])==1, "« Garder comme une dépense » : le ticket est enregistré")
    # page Tickets : le ticket sans article (station) n'est pas un écart
    pg.locator('#nav .navi[data-view="compte"]').click(); pg.wait_for_timeout(400); pg.locator('.cpsub[data-cp="tk"]').click(); pg.wait_for_timeout(600)
    check("Écart avec Articles" not in norm(pg.locator("#app").inner_text()), "ticket sans article : pas d'écart sur la page Tickets")
    # À venir : 4 lignes puis « Voir les N autres »
    pg.locator('#nav .navi[data-view="factures"]').click(); pg.wait_for_timeout(700)
    check(pg.locator("#soonMore").count()==1 and "autres" in pg.locator("#soonMore").inner_text(), "À payer bientôt : 4 lignes et « Voir les N autres »")
    pg.locator("#soonMore").click(); pg.wait_for_timeout(500)
    check("Moins" in pg.locator("#soonMore").inner_text(), "« Voir les autres » déplie la liste")
    # Foyer : détail replié
    pg.locator('#nav .navi[data-view="communes"]').click(); pg.wait_for_timeout(700)
    check(pg.locator("#comDetT").count()==1 and "Voir le détail" in pg.locator("#comDetT").inner_text(), "Foyer : le détail du graphique est replié")
    # premier démarrage
    p2=page({"askName":True})
    if p2.locator(".sheet-overlay button", has_text="Je commence").count(): p2.locator(".sheet-overlay button", has_text="Je commence").click(); p2.wait_for_timeout(500)
    p2.locator(".sheet-overlay input").first.fill("Camille"); p2.locator(".sheet-overlay .ui-ok, .sheet-overlay button:has-text(\"C'est parti\")").first.click(); p2.wait_for_timeout(1200)
    p2.locator(".sheet-overlay button:has-text('Continuer')").first.click(); p2.wait_for_timeout(800)
    s=norm(p2.locator(".sheet-overlay").last.inner_text()) if p2.locator(".sheet-overlay").count() else ""
    check("remplis ton appli en une minute" in s.lower() and "Importer mon relevé" in s, "premier démarrage : « Remplis ton appli en une minute »")
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
print("\n%d échec(s)"%len(fails)); sys.exit(1 if fails else 0)
