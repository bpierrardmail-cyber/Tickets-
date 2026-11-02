# Hors ligne : appli Store complète (servie en https://localhost, aucune requête ailleurs), appli Perso (pas de service worker
# avec TkOff), navigateur (service worker + ménage des index.html?v=), Tesseract seulement à la demande
import sys, os, json, re, shutil, mimetypes
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
SP=(sys.argv[1] if len(sys.argv)>1 else HERE); fails=[]
BETA=ROOT+'/beta/'; PJ=os.environ.get('PDFJS_DIR','/opt/npm-tools/node_modules/pdfjs-dist/legacy/build/').rstrip('/')+'/'
GH='https://bpierrardmail-cyber.github.io/Tickets-/'
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def norm(t): return t.replace(" "," ").replace("\xa0"," ")

# www de l'appli Store, comme le fait la compilation
W=os.path.join(SP,"offline","www"); shutil.rmtree(W, ignore_errors=True); os.makedirs(W+"/pdfjs")
shutil.copytree(BETA, W, dirs_exist_ok=True)   # comme l'APK : tout le dossier beta (captures de vitrine/ comprises)
for f in ["pdf.min.mjs","pdf.worker.min.mjs"]: shutil.copy(PJ+f, W+"/pdfjs/")
series=[{"m":"2025-%02d"%m,"v":120+m*0.1} for m in range(9,13)]+[{"m":"2026-%02d"%m,"v":121.5+m*0.1} for m in range(1,10)]
json.dump({"ok":True,"yoy":1.2,"last":"2026-09","title":"IPC","series":series}, open(W+"/insee.json","w"))

UA_BASE="Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36"
CAP="""window.__ml=[]; window.Capacitor={ isNativePlatform:function(){ return true; }, Plugins:{ TicketOcr:{ recognize:function(){ return Promise.resolve(window.__ml.shift()||{lines:[]}); } } } };"""
SPY="""(function(){ window.__sw={reg:0, list:0, unreg:0};
  if(!navigator.serviceWorker) return;
  var fake={ update:function(){ return Promise.resolve(); }, unregister:function(){ window.__sw.unreg++; return Promise.resolve(true); } };
  try{ Object.defineProperty(navigator.serviceWorker, "register", { value:function(){ window.__sw.reg++; return Promise.resolve(fake); } });
       Object.defineProperty(navigator.serviceWorker, "getRegistrations", { value:function(){ window.__sw.list++; return Promise.resolve([fake]); } }); }catch(e){ window.__sw.err=String(e); }
})();"""
data={"askName":False,"devise":"EUR","personnes":[{"nom":"Sylvette"}],"plusUnlocked":True,
  "comptes":[{"key":"Benoit","nom":"Compte courant","payer":"Benoit","main":True}],
  "fraisCommuns":[{"id":1,"label":"EDF","montant":60,"personne":"Commun","recurrent":True,"startMonth":"2026-01","jour":12}],
  "entries":[{"id":1,"date":"2026-08-03","marchand":"Intermarché","montant":3.1,"categorie":"Courses","articles":[{"libelle":"LAIT DEMI ECREME","prix":1.0,"produit":"Lait"},{"libelle":"PAIN","prix":2.1,"produit":"Pain"}]},
             {"id":2,"date":"2026-10-03","marchand":"Intermarché","montant":3.3,"categorie":"Courses","articles":[{"libelle":"LAIT DEMI ECREME","prix":1.1,"produit":"Lait"},{"libelle":"PAIN","prix":2.2,"produit":"Pain"}]}]}

def serve_from(root, base):
    def h(r):
        u=r.request.url
        if u.startswith(base):
            path=u[len(base):].split("?")[0].split("#")[0]
            if path=="" or path.endswith("/"): path+="index.html"
            fp=os.path.join(root, path)
            if os.path.isfile(fp):
                ct="text/javascript" if fp.endswith((".js",".mjs")) else (mimetypes.guess_type(fp)[0] or "application/octet-stream")
                return r.fulfill(status=200, body=open(fp,'rb').read(), headers={"Content-Type":ct})
            return r.fulfill(status=404, body="")
        return None
    return h

with sync_playwright() as p:
    b=p.chromium.launch()
    # ---------- 1. appli Store : tout depuis l'APK ----------
    ctx=b.new_context(viewport={'width':412,'height':900}, user_agent=UA_BASE+" TicketsApp/store")
    ctx.add_init_script(CAP); ctx.add_init_script(SPY)
    ext=[]; local=[]
    loc=serve_from(W, "https://localhost/")
    def r1(r):
        u=r.request.url
        if u.startswith("https://localhost/"): local.append(u); return loc(r)
        ext.append(u); return r.abort()
    ctx.route("**/*", r1)
    pg=ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto("https://localhost/"); pg.wait_for_timeout(300)
    pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); pg.reload(); pg.wait_for_timeout(1200)
    foot=pg.evaluate("()=>{ var t=''; document.querySelectorAll('.beta-tag').forEach(x=>t+=x.textContent); return t; }")
    tabs=pg.evaluate("()=>[].map.call(document.querySelectorAll('#nav .navi'), b=>b.textContent)")
    check(tabs==["Accueil","Dépenses","Compte","À venir","Commun"], "Store : 5 onglets, sans Bourse %s"%tabs)
    for v in ["list","articles","commun","compte","factures","analyse"]:
        loc_=pg.locator('#nav .navi[data-view="%s"]'%v)
        if loc_.count(): loc_.click(); pg.wait_for_timeout(350)
    pg.locator('#nav .navi[data-view="depenses"]').click(); pg.wait_for_timeout(300); pg.locator('.avtabs .dpsub[data-dp="analyse"]').click(); pg.wait_for_timeout(300)
    print("  goAvancee :", pg.locator("#goAvancee").count(), "vue :", pg.evaluate("()=>document.querySelector('.htitle')&&document.querySelector('.htitle').textContent"))
    if pg.locator("#goAvancee").count(): pg.locator("#goAvancee").click(); pg.wait_for_timeout(800)
    print("  après :", pg.evaluate("()=>document.querySelector('.htitle')&&document.querySelector('.htitle').textContent"), pg.locator("#app").inner_text()[:200].replace("\n"," | "))
    ins=pg.evaluate("()=>JSON.parse(localStorage.getItem('inseeIpc')||'null')")
    check(ins and ins.get("yoy")==1.2 and ins.get("last")=="2026-09", "Store : inflation INSEE lue dans l'APK (insee.json) %s"%(ins and {k:ins[k] for k in ['yoy','last']}))
    t=norm(pg.locator("#app").inner_text())
    check("INSEE sur 12 mois : +1,2" in t or "INSEE sur 12 mois : 1,2" in t, "Store : Analyse avancée compare à l'INSEE")
    # facture PDF : lecteur PDF de l'APK
    pg.locator('#nav .navi[data-view="factures"]').click(); pg.wait_for_timeout(400)
    pg.locator("#fctImp").click(); pg.wait_for_timeout(300)
    with pg.expect_file_chooser() as fc: pg.locator(".sheet-overlay button", has_text=re.compile("PDF")).first.click()
    fc.value.set_files([os.path.join(HERE,"donnees","facture_edf_fictive.pdf")])
    try: pg.wait_for_selector("#fp-mt", timeout=30000)
    except Exception as e: print("  attente :", e)
    mt=pg.locator("#fp-mt").input_value() if pg.locator("#fp-mt").count() else ""
    check(mt!="" and pg.locator("#fp-four").input_value()=="EDF", "Store : facture PDF lue avec le lecteur de l'APK (EDF, %s €)"%mt)
    check(any("/pdfjs/pdf.min.mjs" in u for u in local) and any("/pdfjs/pdf.worker.min.mjs" in u for u in local), "Store : pdf.js et son worker pris dans l'APK")
    # ticket : ML Kit vide → pas de Tesseract téléchargé
    pg.locator('#nav .navi[data-view="list"]').click(); pg.wait_for_timeout(300)
    fi=pg.locator("input[type=file]#filein, input#filein")
    if fi.count()==0: fi=pg.locator("input[type=file][accept^='image']").first
    pg.evaluate("()=>{ window.__ml.push({lines:[]}); }")
    fi.set_input_files(os.path.join(HERE,"donnees","images","ticket_fictif.jpg"))
    pg.wait_for_timeout(2500)
    check(pg.evaluate("()=>typeof Tesseract")=="undefined", "Store : ML Kit sans résultat → Tesseract n'est pas téléchargé")
    pg.wait_for_timeout(9000)   # la vérification de version partirait à 8 s
    sw=pg.evaluate("()=>window.__sw")
    check(sw["reg"]==0, "Store : pas de service worker %s"%sw)
    check(not any("index.html?v=" in u for u in local), "Store : pas de vérification de version en ligne")
    check(ext==[], "Store : AUCUNE requête hors de l'APK %s"%ext[:6])
    check(not errs, "Store : pas d'erreur %s"%errs[:3])
    pg.screenshot(path=os.path.join(SP,"t90_store.png"))
    ctx.close()

    # ---------- 2. Perso, ancien APK (sans TkOff) : comme avant ----------
    def perso(ua, cap):
        ctx=b.new_context(viewport={'width':412,'height':900}, user_agent=ua)
        if cap: ctx.add_init_script(CAP)
        ctx.add_init_script(SPY)
        reqs=[]; gh=serve_from(ROOT+"/", GH)
        def r2(r):
            u=r.request.url; reqs.append(u)
            return gh(r) if u.startswith(GH) else r.abort()
        ctx.route("**/*", r2)
        pg=ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(GH+"beta/"); pg.wait_for_timeout(300)
        pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data)
        return ctx, pg, reqs, errs
    ctx, pg, reqs, errs = perso(UA_BASE+" TicketsApp/perso", True)
    pg.reload(); pg.wait_for_timeout(1500)
    sw=pg.evaluate("()=>window.__sw")
    check(sw["reg"]==1 and sw["unreg"]==0, "Perso ancien APK : service worker gardé %s"%sw)
    check(not any("tesseract" in u for u in reqs), "Perso : Tesseract plus chargé au démarrage")
    check(not errs, "Perso ancien APK : pas d'erreur %s"%errs[:3]); ctx.close()

    # ---------- 3. Perso, nouvel APK (TkOff) : pas de service worker, caches vidés ----------
    ctx, pg, reqs, errs = perso(UA_BASE+" TicketsApp/perso TkOff/1", True)
    pg.evaluate("""async()=>{ const c=await caches.open('tickets-shell-v4'); await c.put('%sbeta/', new Response('x')); const d=await caches.open('tickets-cdn-v3'); await d.put('https://cdn.jsdelivr.net/x.js', new Response('y')); }"""%GH)
    pg.reload(); pg.wait_for_timeout(1500)
    sw=pg.evaluate("()=>window.__sw"); ks=pg.evaluate("async()=>await caches.keys()")
    check(sw["reg"]==0 and sw["list"]>=1 and sw["unreg"]>=1, "Perso nouvel APK : service worker retiré %s"%sw)
    check(ks==[], "Perso nouvel APK : anciennes copies du service worker supprimées %s"%ks)
    check(not errs, "Perso nouvel APK : pas d'erreur %s"%errs[:3]); ctx.close()

    # ---------- 4. Navigateur : service worker + ménage des vérifications de version ----------
    ctx, pg, reqs, errs = perso(UA_BASE, False)
    pg.evaluate("""async()=>{ const c=await caches.open('tickets-shell-v4'); await c.put('%sbeta/', new Response('page'));
      for(let i=0;i<5;i++) await c.put('%sbeta/index.html?v='+(1700000000000+i), new Response('v')); await c.put('%sindex.html?v=17', new Response('v')); }"""%(GH,GH,GH))
    pg.reload(); pg.wait_for_timeout(6000)
    sw=pg.evaluate("()=>window.__sw")
    left=pg.evaluate("async()=>{ const c=await caches.open('tickets-shell-v4'); return (await c.keys()).map(k=>k.url); }")
    check(sw["reg"]==1, "Navigateur : service worker enregistré %s"%sw)
    check(left==[GH+"beta/"], "Navigateur : les index.html?v=… retirés de la copie, la page gardée %s"%left)
    pg.wait_for_timeout(4000)
    check(any("index.html?v=" in u for u in reqs), "Navigateur : la vérification de version continue %s"%[u for u in reqs if "localhost" not in u][-8:])
    print("  filein :", pg.evaluate("()=>{ var f=document.getElementById('filein'); return f? (f.outerHTML.slice(0,160)) : 'absent'; }"))
    # ticket dans un navigateur : Tesseract chargé à la demande
    pg.evaluate("()=>{ window.__tess=0; }")
    fi=pg.locator("input#filein")
    if fi.count()==0: fi=pg.locator("input[type=file][accept^='image']").first
    fi.set_input_files(os.path.join(HERE,"donnees","images","ticket_fictif.jpg"))
    pg.wait_for_timeout(2500)
    check(any("tesseract.min.js" in u for u in reqs), "Navigateur : Tesseract téléchargé au premier scan")
    check(pg.locator("#app").inner_text()!="" and not errs, "Navigateur : la fiche s'ouvre malgré le lecteur absent %s"%errs[:3])
    ctx.close()
    b.close()
print("\n%d échec(s)"%len(fails))
for f in fails: print(" -", f)
