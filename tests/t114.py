# Photos en qualité d'origine et stockage :
# 1. un ticket scanné (2 pages) garde ses photos d'origine (toutes les pages, octet pour octet) en plus de la petite photo ;
#    une photo ajoutée à un ticket saisi aussi ; la visionneuse montre l'origine (2 pages) ;
# 2. galerie rangée par mois, ⋯ → supprimer les photos du mois (annulable ; les tickets restent) ;
# 3. Menu › Stockage : taille des photos et des données, années / mois, « Supprimer » (avertit sans sauvegarde complète),
#    « Garder les photos d'origine » 2 ans : retire l'origine des vieux tickets, garde la petite photo ;
# 4. sauvegarde complète (ZIP : data.json + photos d'origine, CRC justes) et données seules (JSON sans photos) ;
# 5. restauration du ZIP sur un téléphone vide : tickets, petites photos et photos d'origine remises ; ancienne sauvegarde JSON toujours lue.
# Images et données inventées.
import sys, os, json, tempfile, zipfile, io
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw
import horloge
APP='file://'+ROOT+'/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def norm(t): return t.replace(" "," ").replace("\xa0"," ")
TMP=tempfile.mkdtemp()
def img(name, w, h, txt, col):
    im=Image.new("RGB", (w, h), col); d=ImageDraw.Draw(im)
    for y in range(40, h-40, 60): d.text((40, y), "%s  ligne %d  1,%02d" % (txt, y, y%97), fill=(20,20,20))
    p=os.path.join(TMP, name); im.save(p, "JPEG", quality=95); return p
P1=img("page1.jpg", 1600, 2400, "TICKET FICTIF", (250,248,240)); P2=img("page2.jpg", 1600, 1800, "SUITE", (245,245,235))
P3=img("photo_sept.jpg", 1200, 1600, "SEPTEMBRE", (240,250,240)); P4=img("photo_2025.jpg", 1200, 1600, "MARS", (240,240,250)); P5=img("photo_2023.jpg", 1200, 1600, "MAI", (250,240,240))
SZ=lambda p: os.path.getsize(p)
ML={"lines":[{"t":"EPICERIE TEST","p":[60,80,300,80,300,98,60,98]},{"t":"PATES","p":[60,104,200,104,200,122,60,122]},{"t":"4,20","p":[860,104,940,104,940,122,860,122]},
             {"t":"TOTAL","p":[60,128,200,128,200,146,60,146]},{"t":"4,20","p":[860,128,940,128,940,146,860,146]},{"t":"20/10/2026","p":[60,152,260,152,260,170,60,170]}],"width":1000,"height":260}
CAP="""window.__ml=[]; window.Capacitor={ isNativePlatform:function(){ return true; }, Plugins:{ TicketOcr:{ recognize:function(){ return Promise.resolve(window.__ml.shift()||{lines:[]}); } } } };"""
data={"askName":False,"devise":"EUR","comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True}],"entries":[]}
IDB="""()=>new Promise(res=>{ const rq=indexedDB.open("ticketsdb"); rq.onsuccess=()=>{ const db=rq.result, out={orig:{}, photos:[]};
  if(!db.objectStoreNames.contains("orig")){ res(out); return; }
  const tx=db.transaction(["orig","photos"],"readonly"); const c=tx.objectStore("orig").openCursor();
  c.onsuccess=()=>{ const r=c.result; if(r){ out.orig[r.key]={n:r.value.b.length, s:r.value.s, sizes:r.value.b.map(b=>b.size)}; r.continue(); } };
  const k=tx.objectStore("photos").getAllKeys(); k.onsuccess=()=>{ out.photos=k.result; };
  tx.oncomplete=()=>res(out); }; })"""
with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    def page(ctx):
        pg=ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort()); return pg
    c=b.new_context(viewport={'width':412,'height':900}, accept_downloads=True); c.add_init_script(CAP); pg=page(c)
    pg.goto(APP); pg.wait_for_timeout(300)
    pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); pg.reload(); pg.wait_for_timeout(900)
    E=lambda: pg.evaluate("()=>JSON.parse(localStorage.getItem('entries'))")
    # ---------- 1. ticket scanné, 2 pages
    pg.evaluate("r=>{ window.__ml=[r, {lines:[]}]; }", ML)
    pg.set_input_files("#filein", [P1, P2]); pg.wait_for_selector("#f-montant", timeout=20000)
    for _ in range(60):
        if pg.locator("#f-montant").input_value() and pg.locator("#photoview").count(): break
        pg.wait_for_timeout(150)
    pg.wait_for_timeout(400); pg.locator("#save").click(); pg.wait_for_timeout(500)
    if pg.locator("#cksave").count(): pg.locator("#cksave").click(); pg.wait_for_timeout(500)
    pg.wait_for_timeout(600)
    L=E(); scan=[e for e in L if e["montant"]==4.2]
    D=pg.evaluate(IDB); sid=str(scan[0]["id"]) if scan else "?"
    o=D["orig"].get(sid)
    check(scan and o and o["n"]==2 and o["sizes"]==[SZ(P1), SZ(P2)] and sid in D["photos"], "ticket scanné : 2 photos d'origine gardées telles quelles (%s) + la petite photo" % o)
    # tickets saisis avec une photo
    def manual(mag, amt, date, ph):
        if pg.locator("#cancel").count(): pg.locator("#cancel").click(); pg.wait_for_timeout(300)
        pg.locator('#nav .navi[data-view="list"]').click(); pg.wait_for_timeout(300)
        pg.locator("#manual2").first.click(); pg.wait_for_timeout(400)
        pg.locator("#f-montant").fill(amt); pg.locator("#f-marchand").fill(mag); pg.locator("#f-date").fill(date)
        with pg.expect_file_chooser() as fc: pg.locator("#photoadd").click()
        fc.value.set_files(ph); pg.wait_for_timeout(800)
        pg.locator("#save").click(); pg.wait_for_timeout(500)
        if pg.locator("#cksave").count(): pg.locator("#cksave").click(); pg.wait_for_timeout(500)
    manual("Fleuriste fictif", "12,00", "2026-09-15", P3); manual("Garage fictif", "80,00", "2025-03-10", P4); manual("Librairie fictive", "9,90", "2023-05-02", P5)
    pg.wait_for_timeout(500)
    L=E(); ids={e["marchand"]:str(e["id"]) for e in L}; D=pg.evaluate(IDB)
    check(len(D["orig"])==4 and D["orig"].get(ids["Fleuriste fictif"],{}).get("sizes")==[SZ(P3)], "photo ajoutée à un ticket saisi : gardée en qualité d'origine (%d photos d'origine)" % len(D["orig"]))
    # visionneuse
    pg.goto(APP); pg.wait_for_timeout(1200)
    pg.locator('#nav .navi[data-view="compte"]').click(); pg.wait_for_timeout(300); (pg.locator('.cpsub[data-cp="tk"]').click() if pg.locator('.cpsub[data-cp="tk"]').count() else None); pg.wait_for_timeout(400)
    pg.locator("#gogallery").click(); pg.wait_for_timeout(500)
    gm=[norm(x) for x in pg.locator(".gmh").all_inner_texts()]; print("  mois :", gm)
    check(len(gm)==4 and gm[0].startswith("Octobre 2026") and gm[1].startswith("Septembre 2026") and gm[2].startswith("Mars 2025") and gm[3].startswith("Mai 2023"), "galerie rangée par mois, du plus récent au plus ancien")
    pg.locator('.gimg[data-id="%s"]' % sid).click(); pg.wait_for_timeout(900)
    t=norm(pg.locator(".lightbox").inner_text())
    check(pg.locator('.lbimg[data-orig="1"] img').count()==2 and "photo d'origine · 2 pages" in t, "visionneuse : la photo d'origine, ses 2 pages (%s)" % t.replace("\n"," | ")[:120])
    nat=pg.evaluate("()=>document.querySelector('.lbimg img').naturalWidth")
    check(nat==1600, "visionneuse : pleine définition (%d px de large)" % nat)
    pg.locator(".lbimg").click(); pg.wait_for_timeout(200)
    check(pg.locator(".lbimg.zoom").count()==1, "toucher la photo : zoom")
    pg.locator("#lbclose").click(); pg.wait_for_timeout(400)
    # ---------- 2. galerie : ⋯ → supprimer les photos de septembre, puis Annuler
    pg.locator('.gmore[data-m="2026-09"]').click(); pg.wait_for_timeout(300)
    s=norm(pg.locator(".sheet-overlay").last.inner_text())
    check("Supprimer les photos de septembre 2026 (1)" in s and "Supprimer les photos de 2026 (2)" in s, "⋯ : supprimer les photos du mois ou de l'année")
    pg.locator(".sheet-overlay button", has_text="Supprimer les photos de septembre 2026").click(); pg.wait_for_timeout(300)
    s=norm(pg.locator(".sheet-overlay").last.inner_text())
    check("jamais fait de sauvegarde complète" in s and "galerie du téléphone" in s, "confirmation : « jamais fait de sauvegarde complète », la galerie du téléphone n'est pas touchée")
    pg.locator(".sheet-overlay .btn.danger").last.click(); pg.wait_for_timeout(400)
    check(pg.locator(".gmh").count()==3 and "1 photo supprimée · tickets gardés" in norm(pg.locator("body").inner_text()), "septembre retiré de la galerie, « 1 photo supprimée · tickets gardés »")
    pg.locator(".ui-toast.undo button").click(); pg.wait_for_timeout(400)
    check(pg.locator(".gmh").count()==4 and ids["Fleuriste fictif"] in pg.evaluate(IDB)["orig"], "Annuler : la photo revient")
    # ---------- 3. Menu › Stockage
    pg.locator("#hmenu").click(); pg.wait_for_timeout(400)
    r=norm(pg.locator('.dr-row[data-k="stockage"]').inner_text()); check(" Mo" in r or " Ko" in r, "menu : « Stockage » avec la place utilisée (%s)" % r.replace("\n"," "))
    pg.locator('.dr-row[data-k="stockage"]').click(); pg.wait_for_timeout(500)
    t=norm(pg.locator("#app").inner_text()); print("  stockage :", t.replace("\n"," | ")[:400])
    check("utilisés par l'appli" in t and "Photos · 4 ·" in t and "Données ·" in t and "Toujours" in t, "Stockage : total, photos (4), données, « Garder les photos d'origine : Toujours »")
    check([x.split()[0] for x in pg.locator(".sto-yh").all_inner_texts()]==["▸2026","▸2025","▸2023"] or len(pg.locator(".sto-yh").all_inner_texts())==3, "Stockage : années 2026, 2025, 2023")
    pg.locator('.sto-yh[data-y="2026"]').click(); pg.wait_for_timeout(300)
    check(pg.locator(".sto-m").count()==2 and "Octobre 2026" in norm(pg.locator(".sto-m").first.inner_text()), "2026 ouvert : octobre et septembre")
    # garder 2 ans
    pg.locator("#stoKeep").click(); pg.wait_for_timeout(300)
    pg.locator(".sheet-overlay button", has_text="2 ans").click(); pg.wait_for_timeout(300)
    s=norm(pg.locator(".sheet-overlay").last.inner_text()); check("retirer 1 photo d'origine" in s.lower(), "2 ans : « Retirer 1 photo d'origine ? » (celle de 2023)")
    pg.locator(".sheet-overlay .btn.danger").last.click(); pg.wait_for_timeout(600)
    D=pg.evaluate(IDB); old=ids["Librairie fictive"]
    check(old not in D["orig"] and old in D["photos"] and ids["Garage fictif"] in D["orig"], "2 ans : l'origine de 2023 retirée, sa petite photo gardée ; celle de 2025 gardée")
    check("2 ans" in norm(pg.locator("#stoKeep").inner_text()), "réglage affiché : 2 ans")
    # supprimer l'année 2023
    pg.locator('.sto-del[data-y="2023"]').click(); pg.wait_for_timeout(300)
    pg.locator(".sheet-overlay .btn.danger").last.click(); pg.wait_for_timeout(7600)
    D=pg.evaluate(IDB); L=E(); lib=[e for e in L if e["marchand"]=="Librairie fictive"]
    check(old not in D["photos"] and lib and not lib[0].get("photo") and pg.locator('.sto-yh[data-y="2023"]').count()==0, "« Supprimer » 2023 : photo effacée, le ticket reste")
    # ---------- 4. sauvegardes
    pg.locator("#hmenu").click(); pg.wait_for_timeout(400); pg.locator('.dr-row[data-k="backup"]').click(); pg.wait_for_timeout(300)
    s=norm(pg.locator(".sheet-overlay").last.inner_text()); check("Sauvegarde complète" in s and "Données + 3 photos" in s and "Données seules" in s, "Sauvegarder (appli Android) : Google Drive, complète (3 photos) ou données seules")
    with pg.expect_download(timeout=30000) as dl: pg.locator(".sheet-overlay button", has_text="Sauvegarde complète").click()
    ZP=os.path.join(TMP, dl.value.suggested_filename); dl.value.save_as(ZP); pg.wait_for_timeout(400)
    z=zipfile.ZipFile(ZP); names=z.namelist(); print("  zip :", names)
    check(dl.value.suggested_filename.startswith("tickets-sauvegarde-complete-") and z.testzip() is None, "ZIP « tickets-sauvegarde-complete-… », CRC justes")
    check("data.json" in names and ("photos/2026-10/%s-1.jpg" % sid) in names and ("photos/2026-10/%s-2.jpg" % sid) in names, "ZIP : data.json et les 2 pages du ticket scanné")
    check(z.read("photos/2026-10/%s-1.jpg" % sid)==open(P1,"rb").read() and z.read("photos/2026-10/%s-2.jpg" % sid)==open(P2,"rb").read(), "ZIP : photos identiques aux originales")
    dj=json.loads(z.read("data.json")); check(len(dj["data"]["entries"])==4 and dj["data"].get("photoKeep")==2 and len(dj["_zip"])==4, "data.json : 4 tickets, réglage « 2 ans », 4 fichiers photo (3 tickets) listés")
    gar=[x for x in dj["_zip"] if x["id"]==ids["Garage fictif"]]
    check(gar and gar[0]["o"]==1, "photo de 2025 : l'origine")
    check(pg.evaluate("()=>!!localStorage.getItem('lastBackupFull')"), "date de la dernière sauvegarde complète notée")
    pg.locator("#hmenu").click(); pg.wait_for_timeout(400); pg.locator('.dr-row[data-k="backup"]').click(); pg.wait_for_timeout(300)
    with pg.expect_download(timeout=10000) as dl: pg.locator(".sheet-overlay button", has_text="Données seules").click()
    JP=os.path.join(TMP, dl.value.suggested_filename); dl.value.save_as(JP)
    jj=json.load(open(JP, encoding="utf-8")); check(JP.endswith(".json") and "photos" not in jj and "_zip" not in jj and len(jj["data"]["entries"])==4, "données seules : JSON sans photos")
    # suppression d'un mois de Stockage avec une sauvegarde complète faite
    pg.locator("#hmenu").click(); pg.wait_for_timeout(400); pg.locator('.dr-row[data-k="stockage"]').click(); pg.wait_for_timeout(400)
    pg.locator('.sto-del[data-y="2025"]').click(); pg.wait_for_timeout(300)
    s=norm(pg.locator(".sheet-overlay").last.inner_text()); check("Dernière sauvegarde complète : aujourd'hui" in s, "confirmation : « Dernière sauvegarde complète : aujourd'hui »")
    pg.locator(".sheet-overlay .ui-no").click(); pg.wait_for_timeout(200)
    c.close()
    # ---------- 5. restauration sur un téléphone vide
    c2=b.new_context(viewport={'width':412,'height':900}); c2.add_init_script(CAP); pg=page(c2); dlg=[]
    pg.on("dialog", lambda d: (dlg.append(d.message), d.accept()))
    pg.goto(APP); pg.wait_for_timeout(300)
    pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); pg.reload(); pg.wait_for_timeout(900)
    pg.set_input_files("#restorein", ZP)
    for _ in range(80):
        if any("restaurée" in m for m in dlg): break
        pg.wait_for_timeout(150)
    pg.wait_for_timeout(1500)
    print("  dialogues :", dlg)
    check(any("4 ticket(s) et 3 photo(s)" in m for m in dlg), "restauration : « 4 ticket(s) et 3 photo(s) vont REMPLACER… »")
    D=pg.evaluate(IDB); E2=pg.evaluate("()=>JSON.parse(localStorage.getItem('entries')||'[]')")
    check(len(E2)==4 and D["orig"].get(sid,{}).get("sizes")==[SZ(P1), SZ(P2)] and sid in D["photos"] and len(D["photos"])==3, "après restauration : 4 tickets, les photos d'origine (2 pages) et les petites photos")
    pg.locator('#nav .navi[data-view="compte"]').click(); pg.wait_for_timeout(300); (pg.locator('.cpsub[data-cp="tk"]').click() if pg.locator('.cpsub[data-cp="tk"]').count() else None); pg.wait_for_timeout(400)
    pg.locator("#gogallery").click(); pg.wait_for_timeout(500)
    check(pg.locator(".gimg").count()==3, "galerie : 3 photos après restauration")
    c2.close()
    # ancienne sauvegarde JSON (petites photos dedans)
    c3=b.new_context(viewport={'width':412,'height':900}); pg=page(c3); dlg=[]; pg.on("dialog", lambda d: (dlg.append(d.message), d.accept()))
    pg.goto(APP); pg.wait_for_timeout(300)
    pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); pg.reload(); pg.wait_for_timeout(900)
    old={"_app":"tickets","_version":1,"data":{"entries":[{"id":77,"date":"2026-10-02","marchand":"Ancien","montant":5,"categorie":"Autre","payePar":"","articles":[],"photo":True}]},
         "photos":{"77":"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q=="}}
    OP=os.path.join(TMP, "ancienne.json"); json.dump(old, open(OP,"w"))
    pg.set_input_files("#restorein", OP)
    for _ in range(60):
        if any("restaurée" in m for m in dlg): break
        pg.wait_for_timeout(150)
    pg.wait_for_timeout(1200); D=pg.evaluate(IDB)
    check("77" in D["photos"] and len(pg.evaluate("()=>JSON.parse(localStorage.getItem('entries')||'[]')"))==1, "ancienne sauvegarde JSON : ticket et petite photo remis")
    c3.close()
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
print("\n%d échec(s)"%len(fails)); sys.exit(1 if fails else 0)
