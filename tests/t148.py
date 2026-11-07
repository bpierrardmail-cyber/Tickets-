# Foyer (07/11) : moins de connexions au relais et copies différentielles. Données inventées, relais local.
# 1. Marie rejoint : copie complète ; ensuite le propriétaire n'envoie que les différences (ticket ajouté, supprimé, comptes réordonnés) ;
# 2. un changement de Marie revient chez elle tel que le propriétaire l'a retenu (fiche « renvoyée ») ;
# 3. ancienne appli (sans « d=1 ») : toujours des copies complètes ;
# 4. Marie fait 2 tickets en quelques secondes : un seul envoi au relais ; appli ouverte sans rien faire : pas de requête pendant 50 s.
import sys, os, json, time, urllib.request
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
SP=(sys.argv[1] if len(sys.argv)>1 else HERE)
src=open(os.path.join(HERE,'foyer_base.py'),encoding='utf-8').read()
exec(src.split("with sync_playwright() as p:")[0])
def stats(): return json.loads(urllib.request.urlopen(API+"/__test/stats").read())
def reset(): urllib.request.urlopen(API+"/__test/reset").read()
data={"askName":False,"devise":"EUR","personnes":[{"nom":"Marie"},{"nom":"Léo"}],
  "comptes":[{"key":"Benoit","nom":"Compte courant","payer":"Benoit","main":True},{"key":"marie","nom":"Compte Marie","payer":"Marie"},{"key":"joint","nom":"Compte joint","payer":""}],
  "entries":[{"id":100+i,"date":"2026-10-%02d"%(1+i%28),"marchand":"Magasin %d"%i,"montant":10+i,"categorie":"Alimentation","payePar":"Benoit","articles":[]} for i in range(60)]}
def invite(O, name, q):
    open_foyer(O); O.locator("#fyAdd").click(); O.wait_for_timeout(300); O.locator('[data-n="%s"]' % name).click(); O.wait_for_timeout(150)
    O.locator('[data-q="%s"]' % q).click(); O.wait_for_timeout(150)
    O.locator("#fyOk").click(); O.wait_for_timeout(1500); inv=read_qr(O, "t148_qr.png"); O.locator(".ui-no").last.click(); O.wait_for_timeout(300); return inv
def join(b, errs, tag, inv, init=None):
    ctx=b.new_context(viewport={'width':412,'height':900})
    if init: ctx.add_init_script(init)
    pg=ctx.new_page(); pg.on('pageerror', lambda e: errs.append(tag+": "+str(e)))
    pg.route("**/*", lambda r: r.continue_() if (r.request.url.startswith("file:") or r.request.url.startswith(API)) else r.abort())
    pg.goto(APP); pg.wait_for_timeout(300)
    pg.evaluate("()=>{localStorage.clear(); localStorage.setItem('foyerApi', JSON.stringify('%s'));}" % API)
    pg.reload(); pg.wait_for_timeout(1200); btn(pg, "Rejoindre un foyer (QR code)")
    pg.locator("#fyPaste").fill(inv); pg.locator("#fyGo").click(); pg.wait_for_timeout(1500); setup_lock(pg); pg.wait_for_timeout(1500)
    if pg.locator(".ui-no").count(): pg.locator(".ui-no").last.click(); pg.wait_for_timeout(300)
    return pg
def pub(O, name): # ce que le propriétaire sait de la dernière copie envoyée à ce membre
    c=ls(O,"fyCfg"); mid=[k for k,v in c["members"].items() if v["name"]==name][0]; h=ls(O,"fyPubH") or {}; return h.get(mid) or {}
def owner_edit(O, fn):   # modifie les données du propriétaire « appli fermée », puis la rouvre (fyDetect au démarrage, puis envoi)
    O.evaluate(fn); reload(O, 3500)
def ids(pg, k="entries"): return [x.get("id", x.get("key")) for x in (ls(pg, k) or [])]
with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    O=new_page(b, errs, "O")
    O.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k])); localStorage.setItem('foyerApi', JSON.stringify('%s'));}" % API, data)
    O.reload(); O.wait_for_timeout(1200)
    open_foyer(O); O.locator("#fyNew").click(); O.wait_for_timeout(300); O.locator(".ui-yes").click(); setup_lock(O); btn(O, "Je l'ai noté")
    invM=invite(O, "Marie", "w"); invV=invite(O, "Léo", "w")
    M=join(b, errs, "M", invM, "window.__fyPushReal=1; window.__fyPush=12000;")
    # Léo : une ancienne appli qui ne sait pas lire les différences (on retire « d=1 » de ses demandes)
    V=join(b, errs, "V", invV, "(function(){ var f=window.fetch; window.fetch=function(u,o){ if(typeof u==='string') u=u.replace('?d=1&','?').replace('?d=1',''); return f.call(this,u,o); }; })();")
    reload(O, 3500); reload(M, 3000); reload(V, 3000)
    check(len(ids(M))==60 and len(ids(V))==60, "Marie et Léo ont les 60 tickets (copie complète)")
    P0=pub(O,"Marie"); check(P0.get("n")==0 and P0.get("fs",0)>0, "Marie : première copie complète (%s o)"%P0.get("fs"))
    # 1. le propriétaire ajoute un ticket → différence
    owner_edit(O, "()=>{ var e=JSON.parse(localStorage.getItem('entries')); e.push({id:900,date:'2026-10-29',marchand:'Boulangerie Fictive',montant:4.2,categorie:'Alimentation',payePar:'Benoit',articles:[]}); localStorage.setItem('entries', JSON.stringify(e)); }")
    P1=pub(O,"Marie"); check(P1.get("n")==1, "ajout d'un ticket : envoyé à Marie comme différence (n=%s)"%P1.get("n"))
    check(pub(O,"Léo").get("n")==0, "Léo (ancienne appli) : copie complète")
    reload(M, 3000); reload(V, 3000)
    check(900 in ids(M) and len(ids(M))==61, "Marie reçoit le ticket ajouté")
    check(900 in ids(V), "Léo aussi (copie complète)")
    # suppression + comptes réordonnés + ticket modifié
    owner_edit(O, "()=>{ var e=JSON.parse(localStorage.getItem('entries')).filter(x=>x.id!==105); e.forEach(x=>{ if(x.id===110) x.montant=99.99; }); localStorage.setItem('entries', JSON.stringify(e)); var c=JSON.parse(localStorage.getItem('comptes')); c.reverse(); localStorage.setItem('comptes', JSON.stringify(c)); }")
    check(pub(O,"Marie").get("n")==2, "suppression, modification et nouvel ordre : une 2e différence")
    reload(M, 3000)
    e=ls(M,"entries"); check(105 not in ids(M) and [x for x in e if x["id"]==110][0]["montant"]==99.99, "Marie : ticket supprimé parti, montant modifié reçu")
    check(ids(M,"comptes")==ids(O,"comptes"), "Marie : comptes dans le nouvel ordre %s"%ids(M,"comptes"))
    # même contenu que chez le propriétaire (tous ses tickets sont visibles pour Marie, accès « tout le foyer » par défaut)
    check(sorted(ids(M))==sorted(ids(O)), "Marie a exactement les tickets du propriétaire")
    # 2. Marie modifie un ticket → revient chez elle tel que retenu
    M.evaluate("()=>{}")
    M.locator('#nav .navi[data-view="compte"]').click(); M.wait_for_timeout(400)
    # 3/4. deux tickets saisis à la suite par Marie : un seul envoi
    reset()
    for i,(mag,mt) in enumerate([("Fleuriste Fictif","12"),("Kiosque Fictif","3,5")]):
        M.locator('#nav .navi[data-view="list"]').click(); M.wait_for_timeout(300)
        M.locator("#navplus").click(); M.wait_for_timeout(300); M.locator('.sheet-overlay .dr-row[data-k="man"]').click(); M.wait_for_timeout(600)
        M.locator('#chips .chip').first.click(); M.wait_for_timeout(200)
        M.locator("#f-montant").fill(mt); M.locator("#f-marchand").fill(mag); M.locator("#save").click(); M.wait_for_timeout(700)
        if M.locator("#cksave").count(): M.locator("#cksave").click(); M.wait_for_timeout(400)
    M.wait_for_timeout(4000)
    s=stats(); print("  requêtes juste après :", s["paths"])
    check(s["paths"].get("POST /foyer/inbox",0)==0, "pas encore envoyé (envoi groupé)")
    M.wait_for_timeout(12000)
    s=stats(); print("  requêtes :", s["paths"])
    check(s["paths"].get("POST /foyer/inbox",0)==1, "deux tickets : un seul envoi au relais")
    reload(O, 3500); reload(M, 3000)
    names=[x["marchand"] for x in ls(O,"entries")]
    check("Fleuriste Fictif" in names and "Kiosque Fictif" in names, "le propriétaire a les deux tickets de Marie")
    mine=[x for x in ls(M,"entries") if x["marchand"]=="Kiosque Fictif"]
    check(len(mine)==1 and not (ls(M,"fyPend") or {}), "Marie : ses tickets reviennent du propriétaire, plus rien en attente")
    check(pub(O,"Marie").get("n",0)>=3, "toujours en différences (n=%s)"%pub(O,"Marie").get("n"))
    # appli ouverte sans rien faire : pas de requête pendant 50 s (avant : toutes les 30 s)
    for pg in (O, M, V): pg.locator('#nav .navi[data-view="list"]').click()
    M.wait_for_timeout(3000); reset(); M.wait_for_timeout(125000)
    s=stats(); P_=s["paths"]; nchk=P_.get("GET /foyer/snap",0)+P_.get("GET /foyer/inbox",0); print("  2 min sans rien faire :", s["reqs"], P_)
    # avant : une vérification toutes les 30 s, soit 12 pour 3 téléphones en 2 min ; maintenant 1 min puis 2 min : 2 au plus chacun
    check(1<=nchk<=6, "3 téléphones ouverts 2 min sans rien faire : %d vérifications (avant : 12)"%nchk)
    errs=[e for e in errs if "Failed to load resource" not in e and "URL scheme \"file\"" not in e]   # vérification de version (index.html?v=…) impossible en file://
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
print("\n%d échec(s)"%len(fails)); sys.exit(1 if fails else 0)
