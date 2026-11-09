# Sauvegarde fichier chiffrée au choix (revue de sécurité du 08/11, M6). Données inventées, sans réseau.
# 1. avec un code de secours : « Chiffrer la sauvegarde ? » ; données seules chiffrées → JSON { _enc:1, kf, v } sans rien de lisible ;
# 2. sauvegarde complète chiffrée → ZIP : data.json chiffré, photos en .enc (plus de JPEG lisible) ;
# 3. autre téléphone : restaurer le JSON → code demandé, mauvais code refusé, bon code → tout revient ;
# 4. restaurer le ZIP → tickets et photo reviennent ; 5. « Sans chiffrement » → fichier comme avant.
import sys, os, json, base64, zipfile, tempfile
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
sys.path.insert(0, HERE)
import horloge
import numpy as np, cv2
from playwright.sync_api import sync_playwright
APP='file://'+ROOT+'/beta/index.html'
TMP=tempfile.mkdtemp(); fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
SEC=bytes(range(1, 17)); CODE=base64.b32encode(SEC).decode().rstrip("=")
img=np.full((60, 40, 3), 200, np.uint8); cv2.putText(img, "T", (8, 45), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (20, 20, 20), 2)
PH="data:image/jpeg;base64,"+base64.b64encode(cv2.imencode(".jpg", img)[1].tobytes()).decode()
data={"askName":False,"devise":"EUR","welcomeSeen":True,"driveSec":base64.urlsafe_b64encode(SEC).decode().rstrip("="),
  "comptes":[{"key":"Benoit","nom":"Compte courant","payer":"Benoit","main":True}],
  "entries":[{"id":100+i,"date":"2026-10-%02d"%(1+i),"marchand":"Magasin secret %d"%i,"montant":10+i,"categorie":"Alimentation","payePar":"Benoit","articles":[]} for i in range(3)]}
data["entries"][0]["photo"]=PH
NPH="""()=>new Promise(res=>{ const rq=indexedDB.open("ticketsdb"); rq.onsuccess=()=>{ const db=rq.result; try{ const t=db.transaction("photos","readonly").objectStore("photos").count(); t.onsuccess=()=>res(t.result); t.onerror=()=>res(-1); }catch(e){ res(-2); } }; rq.onerror=()=>res(-3); })"""
def page(b, errs, tag):
    ctx=b.new_context(viewport={'width':412,'height':900}, accept_downloads=True)
    pg=ctx.new_page(); pg.on('pageerror', lambda e: errs.append(tag+": "+str(e))); pg.on('dialog', lambda d: d.accept())
    pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    pg.goto(APP); pg.wait_for_timeout(400); return pg
def save(pg, what, chiffre):
    pg.locator("#hmenu").click(); pg.wait_for_timeout(400); pg.locator('.mnsub[data-ms="sauv"]').click(); pg.wait_for_timeout(300)
    pg.locator(".mn-pg .dr-row", has_text=what).first.click(); pg.wait_for_timeout(400)
    s=pg.locator(".sheet-overlay").last.inner_text()
    with pg.expect_download(timeout=30000) as dl:
        pg.locator(".sheet-overlay button", has_text=("Chiffrée avec mon code" if chiffre else "Sans chiffrement")).first.click()
    P=os.path.join(TMP, dl.value.suggested_filename); dl.value.save_as(P); pg.wait_for_timeout(500); return s, P
def restore(pg, path, code):
    while pg.locator(".sheet-overlay").count(): pg.keyboard.press("Escape"); pg.wait_for_timeout(300); pg.locator(".sheet-overlay .ui-no, .sheet-overlay .ui-cancel").last.click(timeout=2000) if pg.locator(".sheet-overlay .ui-no, .sheet-overlay .ui-cancel").count() else None; pg.wait_for_timeout(300)
    pg.locator("#hmenu").click(); pg.wait_for_timeout(400); pg.locator('.mnsub[data-ms="sauv"]').click(); pg.wait_for_timeout(300)
    with pg.expect_file_chooser() as fc: pg.locator('.mn-pg .dr-row[data-k="restore"]').click()
    fc.value.set_files(path); pg.wait_for_timeout(1500)
    t=pg.locator(".sheet-overlay").last.inner_text() if pg.locator(".sheet-overlay").count() else ""
    return t
with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    A=page(b, errs, "A")
    A.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data)
    A.reload(); A.wait_for_timeout(2000)
    s, JP=save(A, "Données seules", True)
    check("chiffrer la sauvegarde" in s.lower(), "question « Chiffrer la sauvegarde ? »")
    raw=open(JP, encoding="utf-8").read(); j=json.loads(raw)
    check(j.get("_enc")==1 and j.get("kf") and str(j.get("v","")).startswith("g1.") and "Magasin" not in raw and "Benoit" not in raw, "données seules chiffrées : rien de lisible ("+os.path.basename(JP)+")")
    s, ZP=save(A, "Sauvegarde complète", True)
    z=zipfile.ZipFile(ZP); names=z.namelist(); dj=json.loads(z.read("data.json"))
    phs=[n for n in names if n.startswith("photos/")]
    check(dj.get("_enc")==1 and "Magasin" not in z.read("data.json").decode(), "ZIP : data.json chiffré")
    check(phs and all(n.endswith(".enc") for n in phs) and not z.read(phs[0]).startswith(b"\xff\xd8"), "ZIP : photos chiffrées (.enc, plus de JPEG lisible)")
    s, CP=save(A, "Données seules", False)
    cj=json.load(open(CP, encoding="utf-8")); check(not cj.get("_enc") and len(cj["data"]["entries"])==3, "« Sans chiffrement » : fichier comme avant")
    # autre téléphone : JSON chiffré
    B=page(b, errs, "B"); B.evaluate("()=>{ localStorage.clear(); localStorage.setItem('askName','false'); localStorage.setItem('welcomeSeen','true'); localStorage.setItem('comptes', JSON.stringify([{key:'X',nom:'Compte',payer:'Moi',main:true}])); localStorage.setItem('entries','[]'); }"); B.reload(); B.wait_for_timeout(1200)
    t=restore(B, JP, CODE)
    check("chiffrée" in t.lower() and "code de secours" in t.lower(), "restaurer : le code de secours est demandé")
    B.locator(".sheet-overlay input").last.fill("AAAA-BBBB-CCCC-DDDD-EEEE-FFFF-GG"); B.locator('.sheet-overlay button[type="submit"]').last.click(); B.wait_for_timeout(800)
    check("n'ouvre pas" in B.locator(".sheet-overlay").last.inner_text(), "mauvais code refusé")
    B.locator(".sheet-overlay input").last.fill(CODE); B.locator('.sheet-overlay button[type="submit"]').last.click(); B.wait_for_timeout(3500)
    E=B.evaluate("()=>JSON.parse(localStorage.getItem('entries')||'[]')")
    check(len(E)==3 and E[1]["marchand"]=="Magasin secret 1", "bon code : les 3 tickets reviennent")
    # autre téléphone : ZIP chiffré
    C=page(b, errs, "C"); C.evaluate("()=>{ localStorage.clear(); localStorage.setItem('askName','false'); localStorage.setItem('welcomeSeen','true'); localStorage.setItem('comptes', JSON.stringify([{key:'X',nom:'Compte',payer:'Moi',main:true}])); localStorage.setItem('entries','[]'); }"); C.reload(); C.wait_for_timeout(1200)
    t=restore(C, ZP, CODE)
    C.locator(".sheet-overlay input").last.fill(CODE); C.locator('.sheet-overlay button[type="submit"]').last.click(); C.wait_for_timeout(5000)
    E=C.evaluate("()=>JSON.parse(localStorage.getItem('entries')||'[]')")
    check(len(E)==3, "ZIP chiffré : les tickets reviennent")
    check(C.evaluate(NPH)>=1, "ZIP chiffré : la photo revient")
    check(not errs, "pas d'erreur "+str(errs[:3]))
    b.close()
print("\n%d échec(s)" % len(fails)); sys.exit(1 if fails else 0)
