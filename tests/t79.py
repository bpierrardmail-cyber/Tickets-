# Compte : une opération déjà passée (frais fixe, virement) peut être remise dans « À venir »
import sys, os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
SP=(sys.argv[1] if len(sys.argv)>1 else HERE)
src=open(os.path.join(HERE,"t76.py"),encoding="utf-8").read(); exec(src.split("\nwith sync_playwright() as p:")[0])
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={'width':412,'height':900}).new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    pg.goto(APP); pg.wait_for_timeout(300)
    pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); pg.reload(); pg.wait_for_timeout(900)
    pg.locator('#nav .navi[data-view="compte"]').click(); pg.wait_for_timeout(600)
    def ls(k): return pg.evaluate("k=>JSON.parse(localStorage.getItem(k))", k)
    # coche Épargne (virement) puis la remet
    pg.locator('.ops-ck[data-k="v"]').click(); pg.wait_for_timeout(400)
    check([v for v in ls("virements") if v["id"]==5][0].get("dayAuto")==1, "Épargne cochée : jour du jour noté")
    pg.locator('#opsBody .ops-list .ops-open[data-k="v"][data-id="5"]').click(); pg.wait_for_timeout(400)
    sh=pg.locator(".sheet-overlay").last.inner_text().replace(" "," "); print("  fenêtre :", sh.replace("\n"," | "))
    check("Pas encore passé à la banque" in sh and "Modifier" in sh and "−100,00" in sh and "passé le" in sh, "ligne passée touchée : « Pas encore passé à la banque » ou « Modifier »")
    pg.locator(".sheet-overlay button", has_text="Pas encore passé").click(); pg.wait_for_timeout(500)
    V5=[v for v in ls("virements") if v["id"]==5][0]
    check(not V5["done"] and "day" not in V5 and "dayAuto" not in V5, "Épargne décochée : plus faite, jour oublié")
    check("Épargne" in pg.locator(".ops-av").inner_text(), "… et revenue dans « À venir »")
    # Free (frais fixe déjà payé, sans jour) : le remettre
    pg.locator('#opsBody .ops-list .ops-open[data-k="f"][data-id="14"]').click(); pg.wait_for_timeout(400)
    pg.locator(".sheet-overlay button", has_text="Pas encore passé").click(); pg.wait_for_timeout(500)
    F14=[f for f in ls("fraisCommuns") if f["id"]==14][0]
    check(not F14["doneMonths"].get("2026-10"), "Free décoché")
    check("Free" in pg.locator(".ops-av").inner_text(), "Free revenu dans « À venir »")
    # Modifier ouvre la fiche
    pg.locator('#opsBody .ops-list .ops-open[data-k="f"][data-id="11"]').click(); pg.wait_for_timeout(400)
    pg.locator(".sheet-overlay button", has_text="Modifier").click(); pg.wait_for_timeout(400)
    print("  overlays :", [t.replace("\n"," / ")[:80] for t in pg.locator(".sheet-overlay").all_inner_texts()])
    check(any("modifier le frais" in t.lower() for t in pg.locator(".sheet-overlay").all_inner_texts()), "« Modifier » ouvre la fiche du frais")
    pg.locator(".sheet-overlay .ui-cancel").last.click(); pg.wait_for_timeout(300)
    # un ticket s'ouvre toujours directement
    pg.locator('#opsBody .ops-open[data-k="t"][data-id="23"]').click(); pg.wait_for_timeout(500)
    check(pg.locator(".sheet-overlay").count()==0 or "Pas encore" not in pg.locator("body").inner_text(), "ticket : sa fiche directement")
    print("errors:", errs); check(not errs, "aucune erreur")
    b.close()
print(len(fails), "échec(s)")
