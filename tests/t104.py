# Frais fixe : « Prélevé sur » = la liste des comptes, sans « Automatique » ; le compte par défaut est déjà choisi
# (compte principal pour un frais commun, compte de la personne pour un frais perso) et suit « Pour qui » tant qu'on n'y touche pas.
# Données inventées.
import sys, os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
SP=(sys.argv[1] if len(sys.argv)>1 else HERE); APP='file://'+ROOT+'/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
data={"askName":False,"devise":"EUR","personnes":[{"nom":"Sam"}],
  "comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True},{"key":"sam","nom":"Compte Sam","payer":"Sam"},{"key":"joint","nom":"Compte joint","payer":""}],
  "fraisCommuns":[{"id":1,"label":"Assurance","montant":40,"personne":"Commun","recurrent":True,"startMonth":"2026-01","compte":"joint"}],"entries":[]}
def ls(pg, k): return pg.evaluate("k=>JSON.parse(localStorage.getItem(k))", k)
with sync_playwright() as p:
    b=p.chromium.launch(); c=b.new_context(viewport={'width':412,'height':900}); pg=c.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    pg.goto(APP); pg.wait_for_timeout(300)
    pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); pg.reload(); pg.wait_for_timeout(900)
    pg.locator('#nav .navi[data-view="factures"]').click(); pg.wait_for_timeout(300)
    pg.locator('.avtabs button[data-av="frais"]').click(); pg.wait_for_timeout(400)
    def sel(lbl): return pg.locator(".sheet-overlay .ui-field", has_text=lbl).locator("select")
    # nouveau frais
    pg.locator("#addfrais").click(); pg.wait_for_timeout(300)
    opts=sel("Prélevé sur").locator("option").all_inner_texts()
    check(opts==["Compte courant","Compte Sam","Compte joint"], "« Prélevé sur » : les comptes, sans « Automatique » %s"%opts)
    check(sel("Prélevé sur").input_value()=="Alex", "frais commun : « Compte courant » déjà choisi")
    sel("Pour qui").select_option("Sam"); pg.wait_for_timeout(200)
    check(sel("Prélevé sur").input_value()=="sam", "« Pour qui » Sam : « Compte Sam » choisi tout seul")
    pg.locator(".sheet-overlay .ui-field", has_text="Nom").first.locator("input").fill("Téléphone Sam")
    pg.locator(".sheet-overlay .ui-field", has_text="Montant").first.locator("input").fill("15")
    pg.locator(".sheet-overlay .ui-actions button[type=submit]").click(); pg.wait_for_timeout(400)
    f=[x for x in ls(pg,"fraisCommuns") if x["label"]=="Téléphone Sam"][0]
    check(f["personne"]=="Sam" and "compte" not in f, "enregistré : frais de Sam, sur son compte habituel (rien de forcé)")
    # un compte choisi à la main ne bouge plus
    pg.locator("#addfrais").click(); pg.wait_for_timeout(300)
    sel("Prélevé sur").select_option("joint"); pg.wait_for_timeout(100)
    sel("Pour qui").select_option("Sam"); pg.wait_for_timeout(200)
    check(sel("Prélevé sur").input_value()=="joint", "compte choisi à la main : il reste « Compte joint »")
    pg.locator(".sheet-overlay .ui-cancel").click(); pg.wait_for_timeout(200)
    # modifier un frais sur un autre compte : il est choisi, et gardé
    pg.locator(".fxrow", has_text="Assurance").locator(".fxmore").click(); pg.wait_for_timeout(200)
    pg.locator(".sheet-overlay button", has_text="Modifier").click(); pg.wait_for_timeout(300)
    check(sel("Prélevé sur").input_value()=="joint", "modifier « Assurance » : « Compte joint » choisi")
    sel("Prélevé sur").select_option("Alex"); pg.wait_for_timeout(100)
    pg.locator(".sheet-overlay .ui-actions button[type=submit]").click(); pg.wait_for_timeout(400)
    a=[x for x in ls(pg,"fraisCommuns") if x["id"]==1][0]
    check("compte" not in a, "remis sur « Compte courant » (le compte par défaut d'un frais commun) : plus de compte forcé")
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
print("\n%d échec(s)"%len(fails))
