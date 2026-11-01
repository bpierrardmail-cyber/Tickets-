# Une facture gardée sans ses effets (« Garder seulement la facture ») : le détail du fournisseur le dit
# (« Pas dans tes comptes » + Ajouter) ; l'ajout la met dans « À venir » du compte, à la place du frais fixe
# qui l'estimait ce mois-là ; les factures déjà passées ne sont pas proposées. Données inventées.
import sys, os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
SP=(sys.argv[1] if len(sys.argv)>1 else HERE); APP='file://'+ROOT+'/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def norm(t): return t.replace(" "," ").replace("\xa0"," ")
B=[{"id":201,"four":"Vallée Claire","type":"eau","date":"2025-11-05","montant":198.4,"aPayer":True,"conso":41,"src":"photo"},
   {"id":202,"four":"Vallée Claire","type":"eau","date":"2026-05-06","montant":176.25,"aPayer":True,"conso":44,"src":"photo"},
   {"id":203,"four":"Vallée Claire","type":"eau","date":"2026-10-28","montant":157.77,"aPayer":True,"conso":33,"src":"photo"}]
data={"askName":False,"devise":"EUR","comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True}],"entries":[],"factures":B,
  "fraisCommuns":[{"id":1,"label":"Eau","montant":20,"personne":"Commun","recurrent":True,"startMonth":"2026-01","jour":10}]}
def ls(pg, k): return pg.evaluate("k=>JSON.parse(localStorage.getItem(k))", k)
with sync_playwright() as p:
    b=p.chromium.launch(); c=b.new_context(viewport={'width':412,'height':900}); pg=c.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    pg.goto(APP); pg.wait_for_timeout(300)
    pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); pg.reload(); pg.wait_for_timeout(900)
    pg.locator('#nav .navi[data-view="factures"]').click(); pg.wait_for_timeout(400)
    pg.locator('.avtabs button[data-av="fact"]').click(); pg.wait_for_timeout(400)
    pg.locator(".fct-card", has_text="Vallée Claire").click(); pg.wait_for_timeout(500)
    t=norm(pg.locator("#app").inner_text())
    check(pg.locator(".fct-miss").count()==1 and "Pas dans tes comptes" in t and "28/10/2026" in norm(pg.locator(".fct-miss").inner_text()), "détail : « Pas dans tes comptes · Facture du 28/10/2026 » (pas les anciennes)")
    # la fiche le propose aussi
    pg.locator(".fct-row").nth(0).click(); pg.wait_for_timeout(300)
    check(pg.locator("#feAcc").count()==1 and "octobre" in norm(pg.locator("#feAcc").inner_text()), "fiche : « Ajouter à mes comptes (À venir d'octobre) »")
    pg.locator(".sheet-overlay .ui-actions .btn.primary").click(); pg.wait_for_timeout(300)
    pg.locator(".fct-row").nth(2).click(); pg.wait_for_timeout(300)
    check(pg.locator("#feAcc").count()==0, "une facture de 2025 n'est pas proposée")
    pg.locator(".sheet-overlay .ui-actions .btn.primary").click(); pg.wait_for_timeout(300)
    pg.locator("[data-addacc]").click(); pg.wait_for_timeout(500)
    FR=ls(pg,"fraisCommuns"); f=[x for x in ls(pg,"factures") if x["id"]==203][0]; nw=[x for x in FR if x.get("fact")=="eau|vallee claire"]
    check(len(nw)==1 and nw[0]["month"]=="2026-10" and abs(nw[0]["montant"]-157.77)<0.001 and nw[0].get("aPayer") and f.get("fraisId")==nw[0]["id"], "Ajouter : « Vallée Claire · à payer » 157,77 € en octobre, liée à la facture")
    check([x for x in FR if x["id"]==1][0].get("skipMonths",{}).get("2026-10"), "à la place du frais fixe « Eau » (20 €) ce mois-là")
    t=norm(pg.locator("#app").inner_text())
    check(pg.locator(".fct-miss").count()==0 and "dans tes comptes" in norm(pg.locator(".fct-row").nth(0).inner_text()), "le bandeau disparaît ; la facture dit « dans tes comptes »")
    pg.locator('#nav .navi[data-view="compte"]').click(); pg.wait_for_timeout(600)
    t=norm(pg.locator("#app").inner_text())
    check("Vallée Claire · à payer" in t and "157,77" in t, "Compte › Opérations : la facture est dans « À venir »")
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
print("\n%d échec(s)"%len(fails))
