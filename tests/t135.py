# Affichage simple / détaillé (Menu › Réglages › Affichage), sur le foyer inventé du mode démo.
import sys, os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={'width':412,'height':900}).new_page(); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    pg.goto('file://'+ROOT+'/beta/index.html?demo'); pg.wait_for_timeout(2500)
    def pages(): return pg.evaluate("()=>{ var g=document.querySelector('.hpgr .hgrid'); return g ? g.querySelectorAll('.hmini').length : 0; }")
    check("det" not in pg.evaluate("document.body.className"), "simple par défaut")
    # Réglages › Affichage › Détaillé
    pg.locator("#hmenu").click(); pg.wait_for_timeout(400)
    pg.locator('.mnsub[data-ms="regl"]').click(); pg.wait_for_timeout(400)
    pg.locator('.dr-row[data-k="aff"]').click(); pg.wait_for_timeout(400)
    pg.locator(".sheet-overlay button", has_text="Détaillé").click(); pg.wait_for_timeout(700)
    pg.locator('#nav .navi[data-view="list"]').click(); pg.wait_for_timeout(700)
    check("det" in pg.evaluate("document.body.className"), "détaillé : classe « det »")
    pg.locator('#nav .navi[data-view="compte"]').click(); pg.wait_for_timeout(700)
    fs=pg.evaluate("()=>[].map.call(document.querySelectorAll('.ops-f button'), b=>b.getAttribute('data-f'))")
    check(fs==["tout","in","out","av","tk","fx","vr"] and pg.locator("#opsQ").count()==1, "Opérations : filtres Tickets / Frais fixes / Virements, recherche ouverte %s"%fs)
    pg.locator('.ops-f button[data-f="tk"]').click(); pg.wait_for_timeout(500)
    kinds=pg.evaluate("()=>[...new Set([].map.call(document.querySelectorAll('#opsBody .ops-open'), b=>b.getAttribute('data-k')))]")
    check(kinds==["t"], "filtre Tickets : seulement des tickets %s"%kinds)
    pg.locator('#nav .navi[data-view="depenses"]').click(); pg.wait_for_timeout(700)
    check("Dépassés" in pg.locator("#app").inner_text(), "Budget : les cases reviennent")
    pg.locator('#nav .navi[data-view="communes"]').click(); pg.wait_for_timeout(700)
    check(pg.locator(".fy-det").count()==1, "Foyer : le détail est ouvert")
    # retour en simple : le filtre « Tickets » ne reste pas coincé
    pg.evaluate("()=>localStorage.setItem('demo:affichage', JSON.stringify('simple'))")
    pg.locator('#nav .navi[data-view="compte"]').click(); pg.wait_for_timeout(700)
    check(pg.locator('.ops-f button.on').get_attribute("data-f")=="tout" and pg.locator("#opsQ").count()==0, "simple : Tout, recherche repliée")
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
print("\n%d échec(s)"%len(fails)); sys.exit(1 if fails else 0)
