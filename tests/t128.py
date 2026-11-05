# Relevé partagé vers Tickets (« Partager › Tickets » depuis l'appli de la banque). Faux TicketsNative.sharedFile.
# 1. Deux comptes : « Dans quel compte ? » (le compte affiché en premier), puis l'écran d'import habituel.
# 2. Un seul compte : l'import s'ouvre directement. 3. Un fichier qui n'est pas un relevé : message.
# 4. Rien de partagé : rien ne s'ouvre. Relevé QIF inventé (tests/donnees/releves/money_fr.qif).
import sys, os, base64, json
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
APP='file://'+ROOT+'/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def norm(t): return t.replace(" "," ").replace("\xa0"," ")
QIF=base64.b64encode(open(os.path.join(HERE,"donnees","releves","money_fr.qif"),"rb").read()).decode()
base={"askName":False,"devise":"EUR","personnes":[{"nom":"Marie"}],"entries":[]}
two=dict(base, comptes=[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True},{"key":"livret","nom":"Compte joint","payer":"Marie"}])
one=dict(base, comptes=[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True}])
MOCK="""window.__share=%s; window.Capacitor={ isNativePlatform:function(){ return true; }, Plugins:{ TicketsNative:{
  sharedFile:function(){ var r=window.__share||{}; window.__share=null; return Promise.resolve(r); },
  widgetData:function(){ return Promise.resolve(); }, launchTarget:function(){ return Promise.resolve({ target:null }); } } } };"""
with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    def page(data, share):
        c=b.new_context(viewport={'width':412,'height':900}); pg=c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
        pg.goto(APP); pg.wait_for_timeout(1200)
        pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); pg.wait_for_timeout(500)
        c.add_init_script(MOCK % json.dumps(share))
        pg.reload(); pg.wait_for_timeout(2000)
        return pg
    pg=page(two, {"name":"releve_octobre.qif","mime":"application/octet-stream","b64":QIF})
    s=norm(pg.locator(".sheet-overlay").last.inner_text()) if pg.locator(".sheet-overlay").count() else ""
    check("releve_octobre.qif" in s.lower() and "Dans quel compte" in s and "Compte courant" in s and "Compte joint" in s, "deux comptes : « Dans quel compte ? »")
    pg.locator(".sheet-overlay button", has_text="Compte joint").click(); pg.wait_for_timeout(800)
    check("quel compte du fichier" in norm(pg.locator(".sheet-overlay").last.inner_text()).lower(), "relevé à 2 comptes : « Quel compte du fichier ? » (comme l'import habituel)")
    pg.locator(".sheet-overlay button", has_text="Compte chèques").click(); pg.wait_for_timeout(1200)
    t=norm(pg.locator("#app").inner_text())
    check(pg.locator(".imp-l").count()>0 and "Compte joint" in t, "import ouvert sur le compte choisi, avec les opérations du fichier (%d lignes)"%pg.locator(".imp-l").count())
    p2=page(one, {"name":"releve.qif","b64":QIF})
    if p2.locator(".sheet-overlay button", has_text="Compte chèques").count(): p2.locator(".sheet-overlay button", has_text="Compte chèques").click(); p2.wait_for_timeout(1200)
    check(p2.locator(".imp-l").count()>0 and p2.locator(".sheet-overlay").count()==0, "un seul compte : import ouvert directement")
    p3=page(one, {"name":"photo.txt","b64":base64.b64encode("bonjour, voici un texte".encode()).decode()})
    check("pas un relevé lisible" in norm(p3.locator("body").inner_text()) and p3.locator(".imp-l").count()==0, "fichier qui n'est pas un relevé : message, rien d'importé")
    p4=page(one, None)
    check(p4.locator(".imp-l").count()==0 and p4.locator(".sheet-overlay").count()==0, "rien de partagé : rien ne s'ouvre")
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
print("\n%d échec(s)"%len(fails)); sys.exit(1 if fails else 0)
