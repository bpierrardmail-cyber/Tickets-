# Menu court : tient sans défiler, chaque ligne ouvre la bonne chose, Réglages, âge de la sauvegarde
import datetime, os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
APP='file://'+ROOT+'/beta/index.html'
fails=[]
def check(c,m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
y=horloge.today().replace(hour=23, minute=30, second=0, microsecond=0)-datetime.timedelta(days=1)
data={"askName":False,"devise":"EUR","personnes":[{"nom":"Sylvette"}],"comptes":[{"key":"Benoit","nom":"Compte courant","payer":"Benoit","main":True}],"lastBackup":y.astimezone(datetime.timezone.utc).isoformat()}
with sync_playwright() as p:
    b=p.chromium.launch()
    for W,H in ((412,892),(360,640)):
        pg=b.new_context(viewport={'width':W,'height':H}, device_scale_factor=2).new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
        pg.goto(APP); pg.wait_for_timeout(300)
        pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data)
        pg.reload(); pg.wait_for_timeout(900)
        def menu(): pg.locator("#hmenu").click(); pg.wait_for_timeout(450)
        menu(); pg.screenshot(path="menu_new_%d.png"%W)
        sh=pg.evaluate("()=>{ const d=document.querySelector('.drawer'); return [d.scrollHeight, d.clientHeight]; }")
        rows=pg.evaluate("()=>[...document.querySelectorAll('.drawer .dr-row')].map(r=>r.getAttribute('data-k')+' | '+r.textContent)"); print(W, sh, rows)
        check(sh[0]<=sh[1]+1, "%d×%d : le menu tient sans défiler (%d ≤ %d)" % (W,H,sh[0],sh[1]))
        check([r.split(" | ")[0] for r in rows]==["foyer","persons","backup","pdf","settings"], "%d : ordre Foyer, Personnes, Sauvegarder, PDF, Réglages" % W)
        check(any("Sauvegarder" in r and "hier" in r for r in rows), "%d : sauvegarde d'hier soir → « hier » (pas « aujourd'hui »)" % W)
        check(pg.locator(".drawer .dr-sec").count()==0, "%d : plus de titres de rubrique" % W)
        if W==412:
            pg.locator('.dr-row[data-k="persons"]').click(); pg.wait_for_timeout(400)
            check("personnes" in pg.locator(".sheet-overlay").last.inner_text().lower() and "Sylvette" in pg.locator(".sheet-overlay").last.inner_text(), "Personnes : la fenêtre des personnes s'ouvre"); pg.evaluate("()=>document.querySelectorAll('.sheet-overlay').forEach(x=>x.remove())"); pg.wait_for_timeout(300)
            menu(); pg.locator('.dr-row[data-k="settings"]').click(); pg.wait_for_timeout(400)
            st=pg.locator(".sheet-overlay").last.inner_text(); print("  réglages :", st.replace("\n"," | "))
            check("Devise principale" in st and "Verrouiller par un code" in st and "Restaurer une sauvegarde" in st, "Réglages : devise, code, restaurer")
            with pg.expect_file_chooser(timeout=3000) as fc: pg.locator('.sheet-overlay .dr-row[data-k="restore"]').click()
            check(fc.value is not None, "Réglages › Restaurer : le choix du fichier s'ouvre"); pg.wait_for_timeout(300)
            menu(); pg.locator('.dr-row[data-k="settings"]').click(); pg.wait_for_timeout(300); pg.locator('.sheet-overlay .dr-row[data-k="devise"]').click(); pg.wait_for_timeout(400)
            check("Euro" in pg.locator(".sheet-overlay").last.inner_text(), "Réglages › Devise : le choix de la devise s'ouvre"); pg.evaluate("()=>document.querySelectorAll('.sheet-overlay').forEach(x=>x.remove())"); pg.wait_for_timeout(300)
            menu(); pg.locator('.dr-row[data-k="settings"]').click(); pg.wait_for_timeout(300); pg.locator('.sheet-overlay .dr-row[data-k="lock"]').click(); pg.wait_for_timeout(600)
            t=(pg.locator(".sheet-overlay").last.inner_text() if pg.locator(".sheet-overlay").count() else "")+" ".join(pg.locator(".ui-toast").all_inner_texts()); check("code de verrouillage" in t.lower() or "indisponible" in t, "Réglages › Verrouiller : le réglage du code s'ouvre (%s)" % t[:40].replace("\n"," ")); pg.reload(); pg.wait_for_timeout(800)
            menu(); check(pg.locator('.dr-row[data-k="import"]').count()==0, "le menu n'a plus l'import (roue du compte)"); pg.locator(".dr-x").click(); pg.wait_for_timeout(300)
            pg.locator('#nav .navi[data-view="compte"]').click(); pg.wait_for_timeout(500); pg.locator("#cptGear").click(); pg.wait_for_timeout(300); pg.locator(".sheet-overlay button", has_text="Importer un relevé").first.click(); pg.wait_for_timeout(400)
            check("importer un relevé" in pg.locator(".sheet-overlay").last.inner_text().lower(), "Importer un relevé (roue du compte) : la fenêtre s'ouvre"); pg.evaluate("()=>document.querySelectorAll('.sheet-overlay').forEach(x=>x.remove())"); pg.wait_for_timeout(300)
            pg.locator('#nav .navi[data-view="depenses"]').click(); pg.wait_for_timeout(300); pg.locator('.avtabs .dpsub[data-dp="tickets"]').click(); pg.wait_for_timeout(300); pg.locator("#gogallery").click(); pg.wait_for_timeout(500)
            check("Galerie" in pg.locator(".htitle").inner_text(), "Galerie (Dépenses › Tickets) : la page s'ouvre")
            menu(); pg.locator('.dr-row[data-k="pdf"]').click(); pg.wait_for_timeout(400)
            check(pg.locator(".sheet-overlay").count()>=1, "Exporter en PDF : le choix de la période s'ouvre")
        print("errors:", errs); check(not errs, "%d : aucune erreur" % W)
    b.close()
print(len(fails), "échec(s)")
