# « Pas cochés les mois passés » (07/11, choix 1 de Benoît) : dans Opérations, les frais fixes et virements des mois passés jamais cochés
# sont montrés (ils comptaient dans « Fin de mois » sans apparaître) ; pour chacun : Payé, N'a pas eu lieu, À payer. Données inventées.
import sys, os, json
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
APP='file://'+ROOT+'/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def txt(pg): return pg.locator("#app").inner_text().replace(" "," ").replace("\xa0"," ")
def fig(t, lbl):
    i=t.find(lbl); return t[i:i+90].replace("\n"," ") if i>=0 else ""
data={"askName":False,"devise":"EUR","welcomeSeen":True,"taxoV2":2,"taxoV3":3,"taxoV4":4,
  "comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True}],"soldeInit":{"Alex":{"2026-09":1000}},
  "fraisCommuns":[{"id":1,"label":"Abonnement Fictif","montant":100,"personne":"Alex","recurrent":True,"startMonth":"2026-09","jour":5}]}
with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    def start():
        c=b.new_context(viewport={'width':412,'height':900}); pg=c.new_page()
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
        pg.goto(APP); pg.wait_for_timeout(300)
        pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); pg.reload(); pg.wait_for_timeout(1200)
        pg.locator('#nav .navi[data-view="compte"]').click(); pg.wait_for_timeout(600)
        return c, pg
    def act(pg, a):
        pg.locator("#opsPast").click(); pg.wait_for_timeout(400)
        pg.locator('.sheet-overlay .pst-b button[data-a="%s"]'%a).first.click(); pg.wait_for_timeout(600)
        while pg.locator(".sheet-overlay .ui-no").count(): pg.locator(".sheet-overlay .ui-no").last.click(); pg.wait_for_timeout(200)
    c, pg = start(); t=txt(pg)
    print("  avant :", fig(t, "Pas cochés"), "|", fig(t, "Fin de mois"))
    check(pg.locator("#opsPast").count()==1 and "−100,00" in fig(t, "Pas cochés") and "⚠" in t, "la ligne montre le frais de septembre pas coché (−100 €), à vérifier")
    check("800" in fig(t, "Fin de mois"), "fin de mois 1 000 − 100 (sept.) − 100 (oct.) = 800 €")
    act(pg, "keep"); t=txt(pg)
    check(pg.locator("#opsPast").count()==1 and "⚠" not in fig(t, "Pas cochés") and "comptées" in t, "« À payer » : la ligne reste, sans ⚠, comptée dans la fin de mois")
    act(pg, "paid"); t=txt(pg)
    check(pg.locator("#opsPast").count()==0 and "800" in fig(t, "Fin de mois") and "900" in t, "« Payé » : la ligne part, la banque passe à 900 €, la fin de mois reste 800 €")
    check(json.loads(pg.evaluate("()=>localStorage.getItem('fraisCommuns')"))[0]["doneMonths"].get("2026-09")==True, "« Payé » : septembre coché « fait »")
    pg.locator(".ui-toast button").first.click(); pg.wait_for_timeout(500)
    check(pg.locator("#opsPast").count()==1, "« Annuler » : la ligne revient")
    c.close()
    c, pg = start(); act(pg, "skip"); t=txt(pg)
    check(pg.locator("#opsPast").count()==0 and "900" in fig(t, "Fin de mois"), "« N'a pas eu lieu » : retiré de septembre, fin de mois 900 €")
    c.close()
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
print("\n%d échec(s)"%len(fails)); sys.exit(1 if fails else 0)
