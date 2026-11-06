# Espace perso d'un membre du foyer (« Mes comptes », privé) :
# 1. membre (après le code) : Menu › « Mes comptes » → l'appli passe dans son espace à lui (ses données d'avant le foyer),
#    pastille « 🔒 Mes comptes · privé », plus de foyer ;
# 2. un ticket ajouté dans « Mes comptes » n'est pas envoyé (rien dans les changements en attente du foyer) ;
# 3. pastille › « Revenir au foyer » : les données du foyer reviennent telles quelles, le ticket perso n'y est pas ;
# 4. retour dans « Mes comptes » : le ticket perso est toujours là ;
# 5. « Envoyer aussi au foyer » : le ticket est copié dans le foyer (payé par le membre), il part au retour ; décocher le retire. Sans relais (réseau coupé). Données inventées.
import sys, os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
APP='file://'+ROOT+'/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def norm(t): return t.replace(" "," ").replace("\xa0"," ")
foyer={"askName":False,"devise":"EUR","personnes":[{"nom":"Lou"}],
  "comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True}],
  "entries":[{"id":1,"date":"2026-10-12","marchand":"Boulangerie du foyer","montant":4.6,"categorie":"Alimentation","payePar":"Lou","articles":[]}]}
avant={"entries":[{"id":7,"date":"2026-10-02","marchand":"Librairie perso","montant":18.0,"categorie":"Loisirs","payePar":"Lou","articles":[]}],
       "comptes":[{"key":"principal","nom":"Mon compte perso","payer":"Lou","main":True}]}
with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    c=b.new_context(viewport={'width':412,'height':900}); pg=c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    pg.goto(APP); pg.wait_for_timeout(300)
    h=pg.evaluate("()=>crypto.subtle.digest('SHA-256', new TextEncoder().encode('c2FsdA==:123456')).then(b=>btoa(String.fromCharCode(...new Uint8Array(b))))")
    mem={"role":"edit","fid":"F_T","tok":"T","km":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=","me":"Lou","owner":"Alex","tabs":["list","communes","compte"],"ed":["list","compte"],"accts":None,"tk":"own"}
    d=dict(foyer); d["fyCfg"]=mem; d["fyAvant"]=avant; d["lockCfg"]={"hash":h,"salt":"c2FsdA==","len":6,"bioId":None}; d["foyerApi"]="http://localhost:9"
    pg.evaluate("d=>{ localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k])); }", d)
    def unlock():
        pg.reload(); pg.wait_for_timeout(1200)
        if pg.locator("#lockscreen").count():
            for k in "123456": pg.locator('#lockscreen button[data-k="%s"]' % k).click(); pg.wait_for_timeout(60)
        pg.wait_for_timeout(700)
    def tickets():
        pg.locator('#nav .navi[data-view="compte"]').click(); pg.wait_for_timeout(300); (pg.locator('.cpsub[data-cp="tk"]').click() if pg.locator('.cpsub[data-cp="tk"]').count() else None); pg.wait_for_timeout(500); return norm(pg.locator("#app").inner_text())
    def after_reload():
        pg.wait_for_timeout(1500)
        if pg.locator("#lockscreen").count():
            for k in "123456": pg.locator('#lockscreen button[data-k="%s"]' % k).click(); pg.wait_for_timeout(60)
        pg.wait_for_timeout(700)
    unlock()
    t=tickets(); check("Boulangerie du foyer" in t and "Librairie perso" not in t and pg.locator("#persoPill").count()==0, "membre : les tickets du foyer, pas de pastille")
    # ---------- 1. aller dans « Mes comptes »
    pg.locator("#hmenu").click(); pg.wait_for_timeout(400)
    check(pg.locator('.dr-row[data-k="perso"]').count()==1, "menu du membre : « Mes comptes »")
    pg.locator('.dr-row[data-k="perso"]').click(); pg.wait_for_timeout(300)
    pg.locator(".sheet-overlay button", has_text="Aller dans Mes comptes").click(); after_reload()
    t=tickets()
    check("Librairie perso" in t and "Boulangerie du foyer" not in t and pg.locator("#persoPill").count()==1, "« Mes comptes » : ses données d'avant le foyer, pastille « 🔒 Mes comptes · privé »")
    st=pg.evaluate("()=>({ cfg:localStorage.getItem('fyCfg'), keep:!!localStorage.getItem('fyPerso') })")
    check(st["cfg"] is None and st["keep"], "le foyer est mis de côté tel quel (fyPerso), plus de foyer actif")
    pg.locator("#hmenu").click(); pg.wait_for_timeout(400)
    check("Foyer de Alex" in norm(pg.locator('.dr-row[data-k="foyer"]').inner_text()) and pg.locator('.dr-row[data-k="backup"]').count()==1, "menu : « Foyer de Alex · revenir », et Sauvegarder (c'est son appli)")
    pg.locator(".dr-x").click(); pg.wait_for_timeout(300)
    # ---------- 2. ticket perso, rien d'envoyé
    pg.locator('#nav .navi[data-view="list"]').click(); pg.wait_for_timeout(300)
    (pg.locator("#navplus").click(), pg.wait_for_timeout(300), pg.locator('.dr-row[data-k="man"]').click(), pg.wait_for_timeout(400), pg.locator('.cattiles .chip:not(.more)').first.click()); pg.wait_for_timeout(400)
    pg.locator("#f-montant").fill("25"); pg.locator("#f-marchand").fill("Cadeau perso"); pg.locator("#save").click(); pg.wait_for_timeout(600)
    if pg.locator("#cksave").count(): pg.locator("#cksave").click(); pg.wait_for_timeout(500)
    pend=pg.evaluate("()=>localStorage.getItem('fyPend')")
    check("Cadeau perso" in tickets() and (pend is None or "Cadeau" not in pend), "ticket « Cadeau perso » ajouté, rien en attente d'envoi au foyer")
    # ---------- 3. revenir au foyer
    pg.locator("#persoPill").click(); pg.wait_for_timeout(300)
    pg.locator(".sheet-overlay button", has_text="Revenir au foyer de Alex").click(); after_reload()
    t=tickets()
    check("Boulangerie du foyer" in t and "Cadeau perso" not in t and "Librairie perso" not in t and pg.locator("#persoPill").count()==0, "retour au foyer : ses tickets, sans les tickets perso")
    av=pg.evaluate("()=>JSON.parse(localStorage.getItem('fyAvant'))")
    check(any(e["marchand"]=="Cadeau perso" for e in av["entries"]) and pg.evaluate("()=>JSON.parse(localStorage.getItem('fyCfg')).owner")=="Alex", "les données perso sont gardées de côté, le foyer est actif")
    # ---------- 4. de nouveau dans « Mes comptes »
    pg.locator("#hmenu").click(); pg.wait_for_timeout(400); pg.locator('.dr-row[data-k="perso"]').click(); pg.wait_for_timeout(300)
    pg.locator(".sheet-overlay button", has_text="Aller dans Mes comptes").click(); after_reload()
    t=tickets(); check("Cadeau perso" in t and "Librairie perso" in t, "de retour dans « Mes comptes » : les tickets perso sont toujours là")
    # ---------- 5. envoyer aussi au foyer
    pg.locator('#nav .navi[data-view="list"]').click(); pg.wait_for_timeout(300)
    (pg.locator("#navplus").click(), pg.wait_for_timeout(300), pg.locator('.dr-row[data-k="man"]').click(), pg.wait_for_timeout(400), pg.locator('.cattiles .chip:not(.more)').first.click()); pg.wait_for_timeout(400)
    check(pg.locator("#f-tofy").count()==1 and not pg.locator("#f-tofy").is_checked() and "Envoyer aussi au foyer de Alex" in norm(pg.locator("#app").inner_text()), "fiche : « Envoyer aussi au foyer de Alex », décoché")
    pg.locator("#f-montant").fill("42"); pg.locator("#f-marchand").fill("Courses communes"); pg.locator("#f-tofy").check()
    pg.locator("#save").click(); pg.wait_for_timeout(600)
    if pg.locator("#cksave").count(): pg.locator("#cksave").click(); pg.wait_for_timeout(500)
    check("envoyé au foyer de Alex" in norm(pg.locator("body").inner_text()), "« Ticket enregistré · envoyé au foyer de Alex (à ton retour) »")
    P=pg.evaluate("()=>JSON.parse(localStorage.getItem('fyPerso'))")
    fc=[e for e in P["data"]["entries"] if e["marchand"]=="Courses communes"]
    mine=[e for e in pg.evaluate("()=>JSON.parse(localStorage.getItem('entries'))") if e["marchand"]=="Courses communes"]
    check(len(fc)==1 and fc[0]["payePar"]=="Lou" and mine and mine[0].get("foyerId")==fc[0]["id"], "copié dans le foyer mis de côté, payé par Lou, relié au ticket perso")
    # décocher : retiré du foyer
    pg.locator('#nav .navi[data-view="compte"]').click(); pg.wait_for_timeout(300); (pg.locator('.cpsub[data-cp="tk"]').click() if pg.locator('.cpsub[data-cp="tk"]').count() else None); pg.wait_for_timeout(400)
    pg.locator('.entry[data-id="%s"]' % mine[0]["id"]).first.click(); pg.wait_for_timeout(500)
    check(pg.locator("#f-tofy").is_checked() and "déjà envoyé" in norm(pg.locator("#app").inner_text()), "rouvert : coché, « déjà envoyé »")
    pg.locator("#f-tofy").uncheck(); pg.locator("#save").click(); pg.wait_for_timeout(600)
    if pg.locator("#cksave").count(): pg.locator("#cksave").click(); pg.wait_for_timeout(500)
    P=pg.evaluate("()=>JSON.parse(localStorage.getItem('fyPerso'))")
    check(not [e for e in P["data"]["entries"] if e["marchand"]=="Courses communes"], "décoché : retiré du foyer")
    # recocher puis revenir au foyer : il y est, prêt à partir
    pg.locator('#nav .navi[data-view="compte"]').click(); pg.wait_for_timeout(300); (pg.locator('.cpsub[data-cp="tk"]').click() if pg.locator('.cpsub[data-cp="tk"]').count() else None); pg.wait_for_timeout(400)
    pg.locator('.entry[data-id="%s"]' % mine[0]["id"]).first.click(); pg.wait_for_timeout(500)
    pg.locator("#f-tofy").check(); pg.locator("#save").click(); pg.wait_for_timeout(600)
    if pg.locator("#cksave").count(): pg.locator("#cksave").click(); pg.wait_for_timeout(500)
    pg.locator("#persoPill").click(); pg.wait_for_timeout(300)
    pg.locator(".sheet-overlay button", has_text="Revenir au foyer de Alex").click(); after_reload(); pg.wait_for_timeout(1500)
    t=tickets(); pend=pg.evaluate("()=>localStorage.getItem('fyPend')") or ""
    check("Courses communes" in t and "Cadeau perso" not in t and "Courses communes" in pend, "dans le foyer : « Courses communes » est là et part au propriétaire (changements en attente)")
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
print("\n%d échec(s)"%len(fails)); sys.exit(1 if fails else 0)
