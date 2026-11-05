# Sauvegarde des membres d'un foyer (version Store). Données inventées, relais imité par une route, faux TicketsNative.
# 1. Membre : Menu › « Sauvegarder · restaurer » (statut « Mes comptes ») → explique que le foyer est sauvegardé par le propriétaire
#    et que « Mes comptes » a sa propre sauvegarde ; « Aller dans Mes comptes » y mène.
# 2. Dans « Mes comptes », le Plus du propriétaire couvre encore le membre : pas de ligne « Tickets Plus », Drive sans ✦.
# 3. Sauvegarde Drive activée dans « Mes comptes » : revenir au foyer prépare d'abord la sauvegarde (driveStage), avec les données perso seulement.
# 4. Propriétaire sans Plus : dans « Mes comptes », l'offre Plus revient.
import sys, os, json
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
# servie sur https://localhost (le stockage survit aux rechargements, ce que file:// ne garantit pas)
APP='https://localhost/beta/index.html?edition=store'; API='http://localhost:9'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def norm(t): return t.replace(" "," ").replace("\xa0"," ")
KM="A"*43
MOCK="""(function(){
var dv; try{ dv=JSON.parse(localStorage.getItem('__dv')||'null'); }catch(e){} dv=dv||{ stages:[] };
function save(){ try{ localStorage.setItem('__dv', JSON.stringify(dv)); }catch(e){} }
function st(){ return { on:true, lastOk:0, pendingSince:dv.stages.length?Date.now():0, count:0, err:'' }; }
window.Capacitor={ isNativePlatform:function(){ return true; }, Plugins:{ TicketsNative:{
  driveConnect:function(){ return Promise.resolve({ email:'marie.test@gmail.com', count:0, kfs:[] }); },
  driveSetup:function(){ return Promise.resolve(st()); }, driveStatus:function(){ return Promise.resolve(st()); },
  driveStage:function(o){ dv.stages.push({ n:o.n, c:o.c, kf:o.kf }); save(); return Promise.resolve(st()); },
  driveSendNow:function(){ return Promise.resolve(st()); }, driveList:function(){ return Promise.resolve({ files:[] }); },
  widgetData:function(){ return Promise.resolve(); }, launchTarget:function(){ return Promise.resolve({ target:null }); },
  sharedFile:function(){ return Promise.resolve({}); } } } };
})();"""
foyer={"askName":False,"devise":"EUR","personnes":[{"nom":"Marie"}],
  "comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True}],
  "entries":[{"id":1,"date":"2026-10-12","marchand":"Marché","montant":85,"categorie":"Alimentation","payePar":"Marie","articles":[]}]}
with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    def unlock(pg):
        pg.wait_for_timeout(1200)
        if pg.locator('#lockscreen button[data-k="1"]').count():
            for k in "123456": pg.locator('#lockscreen button[data-k="%s"]' % k).click(); pg.wait_for_timeout(60)
            pg.wait_for_timeout(1200)
    def nav(pg, loc):   # le geste recharge la page : attendre le rechargement, puis le code
        with pg.expect_navigation(timeout=15000): loc.click()
        unlock(pg)
    def page(ls):
        c=b.new_context(viewport={'width':412,'height':900}); pg=c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        def route(r):
            u=r.request.url
            if u.startswith("https://localhost/"):
                f=os.path.join(ROOT, u.split("https://localhost/",1)[1].split("?")[0].split("#")[0])
                if not os.path.isfile(f): return r.fulfill(status=404, body="")
                return r.fulfill(status=200, body=open(f,"rb").read(), headers={"Content-Type":"text/html; charset=utf-8" if f.endswith(".html") else "application/octet-stream"})
            if u.startswith(API+"/"): return r.fulfill(status=200, body=json.dumps({"t":1,"items":[]}), headers={"Content-Type":"application/json","Access-Control-Allow-Origin":"*"})
            return r.abort()
        pg.route("**/*", route); c.add_init_script(MOCK)
        pg.goto(APP); pg.wait_for_timeout(300)
        h=pg.evaluate("()=>crypto.subtle.digest('SHA-256', new TextEncoder().encode('c2FsdA==:123456')).then(b=>btoa(String.fromCharCode(...new Uint8Array(b))))")
        ls=dict(ls); ls["lockCfg"]={"hash":h,"salt":"c2FsdA==","len":6,"bioId":None}; ls["foyerApi"]=API
        pg.evaluate("d=>{ localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k])); }", ls)
        pg.wait_for_timeout(300); pg.reload(); unlock(pg)
        return pg
    def menu(pg):
        pg.locator("#hmenu").click(); pg.wait_for_timeout(400)
        return norm(pg.locator(".drawer").inner_text())
    def member(plus):
        m=dict(foyer); m["fyCfg"]={"role":"edit","fid":"F_T","mid":"m1","tok":"T","km":KM,"me":"Marie","owner":"Alex","tabs":["list"],"ed":["list"],"accts":None,"tk":"own","plus":plus,"snapT":1}
        m["fyAvant"]={"entries":[{"id":50,"date":"2026-10-20","marchand":"Librairie","montant":12,"categorie":"Loisirs","payePar":"Marie","articles":[]}]}
        return m
    # ---------- 1. membre : la ligne et la fiche
    pg=page(member(True))
    t=menu(pg)
    check("Sauvegarder · restaurer" in t and "Mes comptes" in t, "membre : ligne « Sauvegarder · restaurer » dans le menu (%s)" % t.replace("\n"," | ")[:160])
    pg.locator('.dr-row[data-k="backup"]').click(); pg.wait_for_timeout(500)
    s=norm(pg.locator(".sheet-overlay").last.inner_text()) if pg.locator(".sheet-overlay").count() else ""
    check("sauvegardées par Alex" in s and "propre sauvegarde" in s and "Aller dans Mes comptes" in s and "Copie du foyer" in s, "fiche du membre : foyer sauvegardé par Alex, « Mes comptes » à part")
    nav(pg, pg.locator(".sheet-overlay button", has_text="Aller dans Mes comptes"))
    check(pg.evaluate("()=>!!localStorage.getItem('fyPerso') && !localStorage.getItem('fyCfg')"), "« Aller dans Mes comptes » : espace perso ouvert")
    # ---------- 2. Plus du propriétaire toujours là
    t=menu(pg)
    check("Tickets Plus" not in t, "Mes comptes : pas de ligne « Tickets Plus » (Plus du propriétaire)")
    pg.locator('.dr-row[data-k="backup"]').click(); pg.wait_for_timeout(500)
    s=norm(pg.locator(".sheet-overlay").last.inner_text())
    check("Sauvegarde sur Google Drive" in s and "✦" not in s and "Depuis Google Drive" in s, "Mes comptes : sauvegarde et restauration Drive, sans ✦")
    pg.locator(".sheet-overlay .ui-no").click(); pg.wait_for_timeout(300)
    # ---------- 3. Drive activé : revenir au foyer prépare d'abord la sauvegarde
    pg.evaluate("()=>{ localStorage.setItem('driveCfg', JSON.stringify({on:true})); localStorage.setItem('driveSec', JSON.stringify('QkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkI')); }")
    pg.wait_for_timeout(300); pg.reload(); unlock(pg)
    pg.locator("#persoPill").click(); pg.wait_for_timeout(400)
    nav(pg, pg.locator(".sheet-overlay button", has_text="Revenir au foyer"))
    dv=pg.evaluate("()=>JSON.parse(localStorage.getItem('__dv')||'{}')")
    st=dv.get("stages",[])
    check(len(st)>=1 and st[-1].get("n")==1, "retour au foyer : sauvegarde Drive préparée avant, avec le seul ticket perso (%s)" % st)
    check(pg.evaluate("()=>!!localStorage.getItem('fyCfg') && !localStorage.getItem('fyPerso')"), "retour au foyer fait")
    t=menu(pg)
    check("Mes comptes · Drive" in t, "membre : statut « Mes comptes · Drive » quand la sauvegarde est activée")
    # ---------- 4. propriétaire sans Plus
    pn=page(member(False))
    pn.locator("#hmenu").click(); pn.wait_for_timeout(400); pn.locator('.dr-row[data-k="perso"]').click(); pn.wait_for_timeout(400)
    nav(pn, pn.locator(".sheet-overlay button", has_text="Aller dans Mes comptes"))
    check("Tickets Plus" in menu(pn), "propriétaire sans Plus : l'offre Plus revient dans Mes comptes")
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
print("\n%d échec(s)"%len(fails)); sys.exit(1 if fails else 0)
