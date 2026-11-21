# Téléphone perdu ou volé (21/11) : ligne du Menu › Aide qui ouvre la partie du guide, dépliée ; guide du membre aussi. Données inventées.
import sys, os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
sys.path.insert(0, HERE)
import horloge
from playwright.sync_api import sync_playwright
APP='file://'+ROOT+'/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
data={"askName":False,"devise":"EUR","welcomeSeen":True,"personnes":[{"nom":"Marie"}],
  "comptes":[{"key":"Benoit","nom":"Compte courant","payer":"Benoit","main":True}],"menuSub":"aide"}
def txt(pg): return pg.locator("body").inner_text().replace("\xa0"," ")
with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    pg=b.new_page(viewport={'width':412,'height':900}); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    pg.goto(APP); pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); pg.reload(); pg.wait_for_timeout(1200)
    pg.locator("#hmenu").click(); pg.wait_for_timeout(400)
    row=pg.locator('.dr-row[data-k="perdu"]')
    check(row.count()==1 and "Téléphone perdu ou volé" in row.inner_text(), "Menu › Aide : ligne « Téléphone perdu ou volé »")
    row.click(); pg.wait_for_timeout(500); t=txt(pg)
    op=pg.locator(".aide-sec.open")
    check(op.count()==1 and "Téléphone perdu ou volé" in op.inner_text(), "elle ouvre le guide sur cette partie, seule dépliée")
    check("Effacer l'appareil" in t and "Nouveau téléphone : nouveau QR code" in t and "Arrêter le partage" in t, "les étapes : effacer à distance, nouveau QR code d'un membre, arrêter le partage")
    check(pg.locator("#hback").count()==1, "retour vers le menu")
    pg.locator("#hback").click(); pg.wait_for_timeout(300)
    pg.locator("#mnQ").fill("volé"); pg.wait_for_timeout(300)
    check(pg.locator('.dr-row[data-k="perdu"]').count()==1, "la recherche du menu la trouve (« volé »)")
    m=pg.evaluate("()=>{ var h=document.documentElement.outerHTML; return [h.indexOf('ne te demanderont ton code')>=0, h.indexOf('Ni l\\'appli, ni son auteur')>=0]; }")
    check(m[0] and m[1], "le guide du membre et celui du propriétaire disent qu'on ne demande jamais le code")
    check(not errs, "aucune erreur JS" + (" : "+errs[0] if errs else ""))
    b.close()
print("\n%d échec(s)" % len(fails)); sys.exit(1 if fails else 0)
