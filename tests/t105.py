# Passer un virement envoyé en frais fixe : un mois, plusieurs mois ou sans fin. Données inventées.
# - le menu d'un virement envoyé propose « Passer en frais fixe » (pas un virement reçu, ni un virement vers l'épargne) ;
# - le virement est remplacé ; déjà fait → le frais est fait le même jour (le solde ne bouge pas) ;
# - les mêmes virements des mois couverts sont retirés (ou gardés) ; « Annuler » remet tout ; un virement importé garde sa clé.
import sys, os, re
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
SP=(sys.argv[1] if len(sys.argv)>1 else HERE); APP='file://'+ROOT+'/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def norm(t): return t.replace(" "," ").replace("\xa0"," ")
V=[{"id":41,"person":"Alex","month":"2026-10","label":"Claude ia","montant":-21.6,"day":12,"done":True,"imp":3,"impKey":"k-claude-oct"},
   {"id":42,"person":"Alex","month":"2026-11","label":"Claude ia","montant":-21.6,"day":12},
   {"id":43,"person":"Alex","month":"2026-12","label":"Claude ia","montant":-21.6,"day":12},
   {"id":44,"person":"Alex","month":"2026-10","label":"CAF","montant":394.96,"day":5,"done":True},
   {"id":45,"person":"Alex","month":"2026-10","label":"BO+","montant":-10,"day":3,"done":True,"epargneId":301,"epApplied":10}]
data={"askName":False,"devise":"EUR","personnes":[{"nom":"Sam"}],
  "comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True},{"key":"sam","nom":"Compte Sam","payer":"Sam"}],
  "epargne":[{"id":301,"nom":"Livret A","owner":"Alex","vals":{"2026-10":1000}}],
  "virements":V,"fraisCommuns":[],"entries":[],"soldeInit":{"Alex":{"2026-09":800}}}
def ls(pg, k): return pg.evaluate("k=>JSON.parse(localStorage.getItem(k))", k)
def money(t):
    m=re.search(r"[-−]?\d[\d ]*(?:,\d+)?", norm(t)); return float(m.group(0).replace(" ","").replace("−","-").replace(",",".")) if m else None
with sync_playwright() as p:
    b=p.chromium.launch(); c=b.new_context(viewport={'width':412,'height':900}); pg=c.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    pg.goto(APP); pg.wait_for_timeout(300)
    pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); pg.reload(); pg.wait_for_timeout(900)
    pg.locator('#nav .navi[data-view="compte"]').click(); pg.wait_for_timeout(500)
    def menu(i):
        pg.locator('#opsBody .ops-open[data-k="v"][data-id="%d"]'%i).click(); pg.wait_for_timeout(300)
        t=[norm(x) for x in pg.locator(".sheet-overlay .ui-stack button").all_inner_texts()]; return t
    def close(): pg.locator(".sheet-overlay .ui-no").last.click(); pg.wait_for_timeout(200)
    def bal(): return money(pg.locator(".ops-sum .dash-big").first.inner_text())
    check(not any("frais fixe" in x for x in menu(44)), "virement reçu (CAF) : pas de « Passer en frais fixe »"); close()
    check(not any("frais fixe" in x for x in menu(45)), "virement vers l'épargne (BO+) : pas de « Passer en frais fixe »"); close()
    b0=bal()
    m=menu(41); check("📅 Passer en frais fixe" in m, "virement envoyé (Claude ia) : « 📅 Passer en frais fixe » %s"%m)
    pg.locator(".sheet-overlay button", has_text="Passer en frais fixe").click(); pg.wait_for_timeout(400)
    sh=pg.locator(".sheet-overlay").last
    def sel(lbl): return sh.locator(".ui-field", has_text=lbl).locator("select")
    check(sh.locator(".ui-field", has_text="Nom").first.locator("input").input_value()=="Claude ia" and sel("Prélevé sur").input_value()=="Alex",
          "fenêtre remplie : Claude ia, sur le compte courant")
    kind=sh.locator(".ui-field", has_text="Frais commun ou perso")
    check(kind.locator(".ui-seg button.on").count()==0 and not sh.locator(".ui-field", has_text="Pour qui").is_visible(), "« Frais commun ou perso ? » : rien de choisi d'avance")
    sh.locator(".ui-actions button[type=submit]").click(); pg.wait_for_timeout(300)
    check("Choisis : frais commun ou perso." in norm(sh.inner_text()) and not [x for x in ls(pg,"fraisCommuns") if x["label"]=="Claude ia"], "sans choix : « Choisis : frais commun ou perso. », rien d'enregistré")
    kind.locator("button", has_text="Perso").click(); pg.wait_for_timeout(150)
    check(sel("Pour qui").is_visible() and sel("Pour qui").input_value()=="Alex", "« Perso » : « Pour qui » apparaît, Alex (titulaire du compte)")
    check(sh.locator(".ui-field", has_text="Durée").locator(".ui-seg button.on").inner_text().strip()=="Sans fin" and "(2)" in norm(sh.inner_text()) and sh.locator(".ui-field", has_text="Les mêmes virements").is_visible(),
          "déjà repris en novembre et décembre : « Sans fin » proposé, « Les mêmes virements des mois suivants (2) : Les retirer »")
    pg.screenshot(path=os.path.join(SP,"t105_frais.png"))
    sh.locator(".ui-actions button[type=submit]").click(); pg.wait_for_timeout(500)
    F=[x for x in ls(pg,"fraisCommuns") if x["label"]=="Claude ia"]
    check(len(F)==1 and F[0]["recurrent"] and F[0]["startMonth"]=="2026-10" and F[0]["personne"]=="Alex" and F[0].get("jour")==12 and (F[0].get("doneMonths") or {}).get("2026-10") and (F[0].get("doneDays") or {}).get("2026-10")==12,
          "frais fixe Claude ia chaque mois depuis octobre, le 12, déjà fait en octobre")
    check(F and F[0].get("impKeys")==["k-claude-oct"] and F[0].get("compte")=="Alex", "venu d'un relevé : le frais garde la clé d'import (pas de doublon au prochain import)")
    check(not [x for x in ls(pg,"virements") if x["label"]=="Claude ia"], "les virements Claude ia d'octobre, novembre et décembre sont retirés")
    check(abs(bal()-b0)<0.01, "le solde du compte ne bouge pas (%s → %s)"%(b0, bal()))
    t=norm(pg.locator("#opsBody").inner_text()); check("Claude ia" in t, "Claude ia toujours dans la liste du mois, en frais fixe")
    pg.locator(".ui-toast.undo button").click(); pg.wait_for_timeout(500)
    check(len([x for x in ls(pg,"virements") if x["label"]=="Claude ia"])==3 and not [x for x in ls(pg,"fraisCommuns") if x["label"]=="Claude ia"], "« Annuler » : les 3 virements reviennent, plus de frais")
    # plusieurs mois (jusqu'à novembre) : décembre reste un virement ; « Commun »
    menu(41); pg.locator(".sheet-overlay button", has_text="Passer en frais fixe").click(); pg.wait_for_timeout(400)
    sh=pg.locator(".sheet-overlay").last
    sh.locator(".ui-seg button", has_text="Plusieurs mois").click(); pg.wait_for_timeout(150)
    sh.locator(".ui-field", has_text="Jusqu'au mois").locator("input").fill("2026-11")
    sh.locator(".ui-field", has_text="Frais commun ou perso").locator("button", has_text="Commun").click(); pg.wait_for_timeout(150)
    sh.locator(".ui-actions button[type=submit]").click(); pg.wait_for_timeout(500)
    F=[x for x in ls(pg,"fraisCommuns") if x["label"]=="Claude ia"][0]
    left=sorted([x["month"] for x in ls(pg,"virements") if x["label"]=="Claude ia"])
    check(F["personne"]=="Commun" and F.get("endMonth")=="2026-11" and left==["2026-12"], "jusqu'à novembre, frais commun : octobre et novembre remplacés, décembre reste un virement %s"%left)
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
print("\n%d échec(s)"%len(fails))
