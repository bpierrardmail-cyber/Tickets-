# Foyer effacé faute d'utilisation (07/11) : messages sur les téléphones, sans parler du relais, et « Recréer le foyer ». Données inventées, relais local.
import sys, os, json, urllib.request
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
SP=(sys.argv[1] if len(sys.argv)>1 else HERE)
src=open(os.path.join(HERE,'foyer_base.py'),encoding='utf-8').read()
exec(src.split("with sync_playwright() as p:")[0])
data={"askName":False,"devise":"EUR","personnes":[{"nom":"Marie"}],
  "comptes":[{"key":"Benoit","nom":"Compte courant","payer":"Benoit","main":True}],
  "entries":[{"id":100+i,"date":"2026-10-%02d"%(1+i),"marchand":"Magasin %d"%i,"montant":10+i,"categorie":"Alimentation","payePar":"Benoit","articles":[]} for i in range(5)]}
def txt(pg): return pg.locator("body").inner_text().replace(" "," ").replace("\xa0"," ")
with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    O=new_page(b, errs, "O")
    O.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k])); localStorage.setItem('foyerApi', JSON.stringify('%s'));}" % API, data)
    O.reload(); O.wait_for_timeout(1200)
    open_foyer(O); O.locator("#fyNew").click(); O.wait_for_timeout(300)
    t=O.locator(".sheet-overlay").last.inner_text()
    check("3 mois" in t and "15 jours" in t and "relais" not in t.split("Tu en es")[1], "création : on dit que le foyer est effacé après 3 mois sans utilisation (15 jours si personne ne le rejoint)")
    O.locator(".ui-yes").click(); setup_lock(O); btn(O, "Je l'ai noté")
    check("Effacé s'il ne sert plus" in txt(O), "écran du foyer : la règle d'effacement est rappelée")
    open_foyer(O); O.locator("#fyAdd").click(); O.wait_for_timeout(300); O.locator('[data-n="Marie"]').click(); O.wait_for_timeout(150)
    O.locator('[data-q="w"]').click(); O.wait_for_timeout(150); O.locator("#fyOk").click(); O.wait_for_timeout(1500)
    inv=read_qr(O, "t149_qr.png"); O.locator(".ui-no").last.click(); O.wait_for_timeout(300)
    ctx=b.new_context(viewport={'width':412,'height':900}); M=ctx.new_page(); M.on('pageerror', lambda e: errs.append("M: "+str(e)))
    M.route("**/*", lambda r: r.continue_() if (r.request.url.startswith("file:") or r.request.url.startswith(API)) else r.abort())
    M.goto(APP); M.wait_for_timeout(300); M.evaluate("()=>{localStorage.clear(); localStorage.setItem('foyerApi', JSON.stringify('%s'));}" % API)
    M.reload(); M.wait_for_timeout(1200); btn(M, "Rejoindre un foyer (QR code)")
    M.locator("#fyPaste").fill(inv); M.locator("#fyGo").click(); M.wait_for_timeout(1500); setup_lock(M); M.wait_for_timeout(1500)
    if M.locator(".ui-no").count(): M.locator(".ui-no").last.click(); M.wait_for_timeout(300)
    reload(O, 3000); reload(M, 3000)
    check(len(ls(M,"entries") or [])==5, "Marie a rejoint et reçu les 5 tickets")
    fid=ls(O,"fyCfg")["fid"]
    r=urllib.request.urlopen(API+"/__test/alarm?days=100&fid="+fid).read().decode()
    check(r=="efface", "3 mois et plus sans utilisation : le foyer est effacé")
    # Marie
    M.reload(); M.wait_for_timeout(700); unlock(M); M.wait_for_timeout(3500)
    t=M.locator(".sheet-overlay").last.inner_text() if M.locator(".sheet-overlay").count() else ""
    print("  Marie :", t.replace("\n"," | ")[:220])
    check("a été effacé car il n'a pas été utilisé depuis 3 mois" in t and "nouveau QR code" in t and "relais" not in t, "Marie : « Le foyer de … a été effacé car il n'a pas été utilisé depuis 3 mois », nouveau QR code à demander")
    check(not ls(M,"fyCfg"), "Marie : le foyer est retiré de son téléphone")
    # propriétaire
    O.reload(); O.wait_for_timeout(700); unlock(O); O.wait_for_timeout(3500)
    t=O.locator(".sheet-overlay").last.inner_text() if O.locator(".sheet-overlay").count() else ""
    print("  propriétaire :", t.replace("\n"," | ")[:220])
    check("Ton foyer a été effacé car il n'a pas été utilisé depuis 3 mois" in t and "intactes" in t and "relais" not in t, "propriétaire : message clair, données intactes, pas de mot « relais »")
    check(len(ls(O,"entries"))==5, "propriétaire : ses 5 tickets sont toujours là")
    O.locator(".sheet-overlay .ui-yes", has_text="Recréer").click(); O.wait_for_timeout(1500)
    c=ls(O,"fyCfg"); check(c and c.get("role")=="owner" and not c.get("members") and not c.get("err"), "« Recréer le foyer » : foyer recréé, membres à réinviter")
    O.wait_for_timeout(500); print("  écran :", txt(O)[:300].replace("\n"," | ")); check("0 membre" in txt(O).lower() and "Ton foyer a été effacé" not in txt(O), "écran du foyer : plus d'alerte, 0 membre")
    errs=[e for e in errs if "Failed to load resource" not in e and "URL scheme \"file\"" not in e]
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
urllib.request.urlopen(API+"/__test/reset?clock=1").read()
print("\n%d échec(s)"%len(fails)); sys.exit(1 if fails else 0)
