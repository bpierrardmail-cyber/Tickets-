# Le foyer dans la sauvegarde (07/11, à la place de la copie de secours sur le relais). Données inventées, relais local.
# 1. après la création : « Protège ton foyer » ; écran du foyer : ligne de sauvegarde ;
# 2. la sauvegarde (fichier) contient le foyer chiffré (fyBk), sans rien de lisible (ni prénoms des membres, ni clés) ;
# 3. nouveau téléphone : restaurer le fichier → le code de secours est demandé ; mauvais code refusé ; bon code → propriétaire du même foyer,
#    Marie garde son accès sans nouveau QR code et reçoit le ticket ajouté ensuite ; « Sans le foyer » → données seules ;
# 4. plus rien n'est envoyé au relais pour la copie de secours (/blob/full).
import sys, os, json, urllib.request
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
SP=(sys.argv[1] if len(sys.argv)>1 else HERE)
src=open(os.path.join(HERE,'foyer_base.py'),encoding='utf-8').read()
exec(src.split("with sync_playwright() as p:")[0])
def stats(): return json.loads(urllib.request.urlopen(API+"/__test/stats").read())
data={"askName":False,"devise":"EUR","personnes":[{"nom":"Marie"}],
  "comptes":[{"key":"Benoit","nom":"Compte courant","payer":"Benoit","main":True}],
  "entries":[{"id":100+i,"date":"2026-10-%02d"%(1+i),"marchand":"Magasin %d"%i,"montant":10+i,"categorie":"Alimentation","payePar":"Benoit","articles":[]} for i in range(4)]}
def txt(pg): return pg.locator("body").inner_text().replace(" "," ").replace("\xa0"," ")
def fresh(b, errs, tag, init=None):
    ctx=b.new_context(viewport={'width':412,'height':900}, accept_downloads=True)
    if init: ctx.add_init_script(init)
    pg=ctx.new_page(); pg.on('pageerror', lambda e: errs.append(tag+": "+str(e))); pg.on('dialog', lambda d: d.accept())
    pg.route("**/*", lambda r: r.continue_() if (r.request.url.startswith("file:") or r.request.url.startswith(API)) else r.abort())
    pg.goto(APP); pg.wait_for_timeout(300); return pg
with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    urllib.request.urlopen(API+"/__test/reset").read()
    O=fresh(b, errs, "O", "window.__fyBkAskTest=1;")
    O.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k])); localStorage.setItem('foyerApi', JSON.stringify('%s'));}" % API, data)
    O.reload(); O.wait_for_timeout(1200)
    open_foyer(O); O.locator("#fyNew").click(); O.wait_for_timeout(300); O.locator(".ui-yes").click(); setup_lock(O)
    code=O.locator(".sheet-overlay .fy-code").inner_text().strip()
    btn(O, "Je l'ai noté"); O.wait_for_timeout(800)
    t=O.locator(".sheet-overlay").last.inner_text() if O.locator(".sheet-overlay").count() else ""
    check("protège ton foyer" in t.lower() and "faire une sauvegarde maintenant" in t.lower(), "après la création : « Protège ton foyer », sauvegarde proposée")
    O.locator(".sheet-overlay button", has_text="Plus tard").click(); O.wait_for_timeout(300)
    check("Aucune sauvegarde" in txt(O), "écran du foyer : « Aucune sauvegarde » en évidence")
    # Marie rejoint
    open_foyer(O); O.locator("#fyAdd").click(); O.wait_for_timeout(300); O.locator('[data-n="Marie"]').click(); O.wait_for_timeout(150)
    O.locator('[data-q="w"]').click(); O.wait_for_timeout(150); O.locator("#fyOk").click(); O.wait_for_timeout(1500)
    inv=read_qr(O, "t150_qr.png"); O.locator(".ui-no").last.click(); O.wait_for_timeout(300)
    M=fresh(b, errs, "M"); M.evaluate("()=>{localStorage.clear(); localStorage.setItem('foyerApi', JSON.stringify('%s'));}" % API)
    M.reload(); M.wait_for_timeout(1200); btn(M, "Rejoindre un foyer (QR code)")
    M.locator("#fyPaste").fill(inv); M.locator("#fyGo").click(); M.wait_for_timeout(1500); setup_lock(M); M.wait_for_timeout(1500)
    if M.locator(".ui-no").count(): M.locator(".ui-no").last.click(); M.wait_for_timeout(300)
    reload(O, 3500); reload(M, 3000)
    check(len(ls(M,"entries") or [])==4, "Marie a rejoint (4 tickets)")
    # 2. sauvegarde fichier
    O.locator("#hmenu").click(); O.wait_for_timeout(400)
    O.locator('.dr-row[data-k="backup"]').click(); O.wait_for_timeout(400)
    with O.expect_download(timeout=15000) as dl: O.locator(".sheet-overlay button, .sheet-overlay .dr-row", has_text="Données seules").first.click()
    path=os.path.join(SP, "t150_sauvegarde.json"); dl.value.save_as(path); bk=json.load(open(path, encoding="utf-8"))
    fb=bk["data"].get("fyBk") or {}
    check(fb.get("fid")==ls(O,"fyCfg")["fid"] and fb.get("v","").startswith("g1."), "la sauvegarde contient le foyer chiffré (fyBk)")
    raw=json.dumps(fb); km=[m["km"] for m in ls(O,"fyCfg")["members"].values()][0]
    check("Marie" not in raw and km not in raw, "rien de lisible dans fyBk (ni prénom de membre, ni clé)")
    open_foyer(O); check("Dernière sauvegarde : aujourd'hui" in txt(O), "écran du foyer : « Dernière sauvegarde : aujourd'hui »")
    # 3. nouveau téléphone
    N=fresh(b, errs, "N"); N.evaluate("()=>{localStorage.clear(); localStorage.setItem('foyerApi', JSON.stringify('%s'));}" % API); N.reload(); N.wait_for_timeout(1200)
    t=txt(N); check("Restaurer une sauvegarde" in t and "Récupérer mon foyer (code de secours)" not in t, "premier démarrage : « Restaurer une sauvegarde », plus de « code de secours » seul")
    with N.expect_file_chooser() as fc: N.locator(".sheet-overlay button", has_text="Restaurer une sauvegarde").click()
    fc.value.set_files(path); N.wait_for_timeout(1500)
    t=N.locator(".sheet-overlay").last.inner_text() if N.locator(".sheet-overlay").count() else ""
    check("ton foyer partagé" in t.lower() and "code de secours" in t, "le code de secours est demandé pour retrouver le foyer")
    N.locator(".sheet-overlay input").last.fill("AAAA-BBBB-CCCC-DDDD-EEEE-FFFF-GG"); N.locator('.sheet-overlay button[type="submit"]').click(); N.wait_for_timeout(1200)
    check("n'ouvre pas ce foyer" in N.locator(".sheet-overlay").last.inner_text(), "mauvais code : refusé")
    N.locator(".sheet-overlay input").last.fill(code); N.locator('.sheet-overlay button[type="submit"]').click(); N.wait_for_timeout(3000)
    setup_lock(N); N.wait_for_timeout(2500)
    c=ls(N,"fyCfg") or {}
    check(c.get("role")=="owner" and c.get("fid")==fb["fid"] and len(c.get("members") or {})==1 and len(ls(N,"entries"))==4, "nouveau téléphone : propriétaire du même foyer, Marie dans les membres, 4 tickets")
    t=N.locator(".sheet-overlay").last.inner_text() if N.locator(".sheet-overlay").count() else ""
    check("Ton foyer est revenu" in t and "ancien téléphone" in t, "message : foyer revenu, ne plus utiliser l'ancien téléphone")
    if N.locator(".sheet-overlay .ui-yes").count(): N.locator(".sheet-overlay .ui-yes").last.click()
    N.evaluate("()=>{ var e=JSON.parse(localStorage.getItem('entries')); e.push({id:900,date:'2026-10-29',marchand:'Boulangerie Fictive',montant:4.2,categorie:'Alimentation',payePar:'Benoit',articles:[]}); localStorage.setItem('entries', JSON.stringify(e)); }")
    reload(N, 4000); reload(M, 3500)
    check(900 in [x["id"] for x in ls(M,"entries")] and ls(M,"fyCfg"), "Marie, sans nouveau QR code, reçoit le ticket ajouté sur le nouveau téléphone")
    # « Sans le foyer »
    N2=fresh(b, errs, "N2"); N2.evaluate("()=>{localStorage.clear(); localStorage.setItem('foyerApi', JSON.stringify('%s'));}" % API); N2.reload(); N2.wait_for_timeout(1200)
    with N2.expect_file_chooser() as fc: N2.locator(".sheet-overlay button", has_text="Restaurer une sauvegarde").click()
    fc.value.set_files(path); N2.wait_for_timeout(1500)
    N2.locator(".sheet-overlay button", has_text="Sans le foyer").click(); N2.wait_for_timeout(2500)
    check(not ls(N2,"fyCfg") and len(ls(N2,"entries") or [])==4, "« Sans le foyer » : les données seules")
    # 4. relais
    s=stats()["paths"]; print("  relais :", {k:v for k,v in s.items() if "blob" in k})
    check(not any("blob" in k for k in s), "plus de copie de secours envoyée au relais")
    errs=[e for e in errs if "Failed to load resource" not in e and "URL scheme \"file\"" not in e]
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
print("\n%d échec(s)"%len(fails)); sys.exit(1 if fails else 0)
