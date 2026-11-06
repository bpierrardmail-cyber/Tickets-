# Refonte des onglets (06/11), sur le foyer inventé du mode démo :
# Opérations : ligne « compte ▾ + mois », liste des comptes, loupe ; Budget : « Encore … pour N jours » ;
# À venir › 12 mois : À payer bientôt avec la date, Argent de côté ; Foyer : les personnes en haut.
import sys, os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def norm(t): return t.replace(" "," ").replace("\xa0"," ")
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={'width':412,'height':900}).new_page(); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    pg.goto('file://'+ROOT+'/beta/index.html?demo'); pg.wait_for_timeout(2500)
    def app(): return norm(pg.locator("#app").inner_text())
    # Opérations
    pg.locator('#nav .navi[data-view="compte"]').click(); pg.wait_for_timeout(700)
    check(pg.locator("#acctSel").count()==1 and pg.locator(".ap-card").count()==0 and pg.locator("#opsAdd").count()==0, "Opérations : ligne du compte, plus de grande carte ni de « ＋ Ajouter »")
    pg.locator("#acctSel").click(); pg.wait_for_timeout(400)
    sh=norm(pg.locator(".sheet-overlay").last.inner_text())
    check("Compte courant" in sh and "Compte de Marie" in sh and "Tous les comptes" in sh and "Ajouter un compte" in sh, "liste des comptes : par personne, tous, ajouter")
    pg.locator('.sheet-overlay .acrw[data-acct="__all"]').click(); pg.wait_for_timeout(600)
    check("Tous les comptes" in norm(pg.locator("#acctSel").inner_text()) and "Total des comptes" in app(), "« Tous les comptes » : le total")
    pg.locator("#acctSel").click(); pg.wait_for_timeout(400); pg.locator('.sheet-overlay .acrw', has_text="Compte courant").click(); pg.wait_for_timeout(600)
    check(pg.locator("#opsQ").count()==0, "recherche repliée")
    pg.locator("#opsQBtn").click(); pg.wait_for_timeout(400)
    check(pg.locator("#opsQ").count()==1, "la loupe ouvre la recherche")
    # Budget
    pg.locator('#nav .navi[data-view="depenses"]').click(); pg.wait_for_timeout(700)
    t=app(); check("Dépensé en octobre" in t and "Encore" in t and "pour 2 jours" in t and "reste" in t, "Budgets : dépensé, « Encore … pour 2 jours », ce qui reste par catégorie")
    check(pg.locator("#budEdit").count()==1 and "Dépassés" not in t, "Budgets : « Modifier les budgets » dans la carte, plus de cases")
    # À venir
    pg.locator('#nav .navi[data-view="factures"]').click(); pg.wait_for_timeout(700)
    t=app(); i1=t.lower().find("à payer bientôt"); i2=t.lower().find("les 12 prochains mois")
    check(0<=i1<i2 and pg.locator(".av-cal").count()>=1, "12 mois : À payer bientôt d'abord, avec la date")
    check("Argent de côté" in t and pg.locator("#avPr").count()==1, "12 mois : Argent de côté")
    pg.locator("#avPr").click(); pg.wait_for_timeout(500)
    check(pg.locator('.avtabs button.on').inner_text()=="Provisions", "toucher Provisions : sous-onglet Provisions")
    # Foyer
    pg.locator('#nav .navi[data-view="communes"]').click(); pg.wait_for_timeout(700)
    t=app(); check(pg.locator(".fy-top .fy-p").count()>=2 and "Ta part ce mois" in t and "Toi" in t, "Foyer : les personnes en haut, ta part du mois")
    pg.locator("#comPartsB").click(); pg.wait_for_timeout(400)
    check(pg.locator(".sheet-overlay").count()>0, "toucher les personnes : régler les parts")
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
print("\n%d échec(s)"%len(fails)); sys.exit(1 if fails else 0)
