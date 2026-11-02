# Abonnement dont le prix change (factures sans consommation, 9,99 € puis 15,99 €) : prochaine facture au prix actuel,
# « par mois » au prix actuel, rythme tiré des 12 factures même si la dernière annonce une « prochaine facture » dans 2 mois.
# Données inventées.
import sys, os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
APP='file://'+ROOT+'/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def norm(t): return t.replace(" "," ").replace("\xa0"," ")
ms=["2025-11","2025-12"]+["2026-%02d"%m for m in range(1,11)]
F=[{"id":100+i,"four":"Mobile Test","type":"net","date":m+"-27","montant":15.99 if m>="2026-09" else 9.99,"prelev":m+"-27","src":"pdf"} for i,m in enumerate(ms)]
F[-1]["next"]="2026-12-27"   # une « prochaine facture » annoncée à tort dans 2 mois
FR=[{"id":900,"label":"Mobile Test · prochaine facture (estimée)","montant":10,"personne":"Commun","recurrent":False,"month":"2026-12","jour":27,"fact":"net|mobile test","factNom":"Mobile Test","est":True}]
data={"askName":False,"devise":"EUR","plusUnlocked":True,"comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True}],"factures":F,"fraisCommuns":FR,"entries":[]}
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':412,'height':900}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    pg.goto(APP); pg.wait_for_timeout(300)
    pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); pg.reload(); pg.wait_for_timeout(900)
    pg.locator('#nav .navi[data-view="factures"]').click(); pg.wait_for_timeout(400)
    pg.locator('.avtabs button[data-av="fact"]').click(); pg.wait_for_timeout(400)
    t=norm(pg.locator("#app").inner_text()); print("  ", t[60:260].replace("\n"," | "))
    check("tous les mois" in t and "15,99 €/mois" in t and "en moyenne" not in t, "carte : « tous les mois · 15,99 €/mois »")
    check("15,99 €" in t and "vers le 27/11" in t and "≈ 10" not in t, "prochaine facture : 15,99 € vers le 27/11")
    pg.locator(".fct-card[data-k]").first.click(); pg.wait_for_timeout(500)
    t=norm(pg.locator("#app").inner_text())
    check("Par mois" in t and "au prix actuel" in t and "TOUS LES MOIS" in t.upper() and "tous les 2 mois" not in t.lower(), "détail : « Par mois 15,99 € au prix actuel », tous les mois")
    check("Prochaine facture" in t and "vers le 27/11/2026" in t, "détail : prochaine facture vers le 27/11/2026")
    E=[f for f in pg.evaluate("()=>JSON.parse(localStorage.getItem('fraisCommuns'))") if f.get("est")]
    check(len(E)==1 and E[0]["montant"]==15.99 and E[0]["month"]=="2026-11" and E[0]["jour"]==27, "estimation déjà dans À venir : 15,99 € le 27/11 (au lieu de 10 € en décembre) %s" % [(e["montant"], e["month"]) for e in E])
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
print("\n%d échec(s)"%len(fails)); sys.exit(1 if fails else 0)
