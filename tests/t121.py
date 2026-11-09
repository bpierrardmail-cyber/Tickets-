# Export pour un tableur : Menu › Exporter › Tableur (CSV).
# 1. « Cette année », tickets + articles + opérations : un ZIP de 3 CSV (UTF-8 avec BOM, point-virgule, virgule décimale, dates jj/mm/aaaa) ;
# 2. un seul contenu (tickets, ce mois) : un CSV directement ;
# 3. rien de coché : refusé ; Menu › Exporter › PDF ouvre toujours le bilan. Données inventées.
import sys, os, io, zipfile
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
APP='file://'+ROOT+'/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
data={"askName":False,"devise":"EUR","personnes":[{"nom":"Marie"}],"comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True}],
  "entries":[{"id":1,"date":"2026-10-24","marchand":"Intermarché","montant":31.26,"categorie":"Alimentation","payePar":"Alex","articles":[{"label":"Lait; demi-écrémé","prix":1.05,"produit":"Lait"},{"label":"Poulet","prix":30.21,"produit":"Viande","commun":True}]},
             {"id":2,"date":"2026-03-02","marchand":"Pharmacie","montant":18.9,"categorie":"Santé","payePar":"Marie","articles":[]},
             {"id":3,"date":"2025-12-20","marchand":"Librairie","montant":12,"categorie":"Loisirs","payePar":"Alex","articles":[]}],
  "fraisCommuns":[{"id":5,"label":"Loyer","montant":650,"personne":"Commun","recurrent":True,"startMonth":"2026-01","jour":5}],
  "virements":[{"id":9,"person":"Alex","month":"2026-10","label":"Salaire","montant":2100,"done":True,"day":1}]}
with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    c=b.new_context(viewport={'width':412,'height':900}, accept_downloads=True); pg=c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    pg.goto(APP); pg.wait_for_timeout(300)
    pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); pg.reload(); pg.wait_for_timeout(900)
    def open_csv():
        pg.locator("#hmenu").click(); pg.wait_for_timeout(400)
        pg.locator('.mnsub[data-ms="sauv"]').click(); pg.wait_for_timeout(200); pg.locator('.dr-row[data-k="pdf"]').click(); pg.wait_for_timeout(300)
        pg.locator(".sheet-overlay button", has_text="Tableur").click(); pg.wait_for_timeout(300)
    # ---------- 1. ZIP de 3 fichiers
    pg.locator("#hmenu").click(); pg.wait_for_timeout(400); pg.locator('.mnsub[data-ms="sauv"]').click(); pg.wait_for_timeout(200)
    check("PDF ou tableur" in pg.locator('.dr-row[data-k="pdf"]').inner_text(), "menu : « Exporter · PDF ou tableur »"); pg.locator("#hback").click(); pg.wait_for_timeout(300)
    open_csv()
    with pg.expect_download(timeout=15000) as dl: pg.locator("#csvGo").click()
    f=dl.value.path(); z=zipfile.ZipFile(f); names=sorted(z.namelist()); print("  ", dl.value.suggested_filename, names)
    check(dl.value.suggested_filename=="tickets-export-2026.zip" and names==["articles.csv","operations.csv","tickets.csv"], "Cette année : tickets-export-2026.zip avec tickets, articles, opérations")
    t=z.read("tickets.csv").decode("utf-8")
    check(t.startswith("﻿Date;Magasin;Montant;Catégorie;Payé par;Compte") and "24/10/2026;Intermarché;31,26;Alimentation;Alex;Compte courant;2" in t and "02/03/2026;Pharmacie;18,9" in t and "Librairie" not in t,
          "tickets.csv : BOM, point-virgule, virgule décimale, dates jj/mm/aaaa, seulement 2026")
    a=z.read("articles.csv").decode("utf-8")
    check('"Lait; demi-écrémé"' in a and "Poulet;Viande;30,21;oui" in a, "articles.csv : texte avec « ; » entre guillemets, dépense commune")
    o=z.read("operations.csv").decode("utf-8")
    check("01/10/2026;Compte courant;Salaire;Virement" in o and ";2100;oui" in o and "Loyer;Frais fixe" in o and "-650" in o, "operations.csv : virement reçu, loyer (frais fixe) en négatif")
    # ---------- 2. un seul fichier
    open_csv()
    pg.locator('#csvPer button[data-p="m"]').click()
    for w in ("articles","ops"): pg.locator('#csvWhat input[data-w="%s"]' % w).uncheck()
    with pg.expect_download(timeout=15000) as dl: pg.locator("#csvGo").click()
    t=open(dl.value.path(), encoding="utf-8").read()
    check(dl.value.suggested_filename=="tickets-2026-10.csv" and "Intermarché" in t and "Pharmacie" not in t, "ce mois, tickets seuls : un CSV direct (octobre)")
    # ---------- 3. rien de coché
    open_csv()
    for w in ("tickets","articles","ops"): pg.locator('#csvWhat input[data-w="%s"]' % w).uncheck()
    pg.locator("#csvGo").click(); pg.wait_for_timeout(200)
    check("Coche au moins un contenu" in pg.locator(".sheet-overlay").last.inner_text(), "rien de coché : « Coche au moins un contenu »")
    pg.evaluate("()=>document.querySelectorAll('.sheet-overlay').forEach(x=>x.remove())")
    pg.locator("#hmenu").click(); pg.wait_for_timeout(400); pg.locator('.mnsub[data-ms="sauv"]').click(); pg.wait_for_timeout(200); pg.locator('.dr-row[data-k="pdf"]').click(); pg.wait_for_timeout(300)
    pg.locator(".sheet-overlay button", has_text="PDF").click(); pg.wait_for_timeout(300)
    check("exporter en pdf" in pg.locator(".sheet-overlay").last.inner_text().lower(), "Exporter › PDF : le choix de la période du bilan")
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
print("\n%d échec(s)"%len(fails)); sys.exit(1 if fails else 0)
