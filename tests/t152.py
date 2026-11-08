# Code et empreinte du foyer : choisis par chaque téléphone, plus obligatoires (08/11). Données inventées, relais local.
# 1. Propriétaire sans lecteur d'empreinte : à la création, le code est « fortement conseillé », pas d'étape empreinte ;
#    « Passer » demande confirmation (avertissement) ; l'écran du foyer rappelle « Pas de code sur ce téléphone · Ajouter » ;
#    au redémarrage, plus rien n'est demandé.
# 2. Marie rejoint avec un téléphone qui a un lecteur (faux TicketsNative) : son propre code, puis l'empreinte proposée,
#    « Pas d'empreinte · le code suffit » ; au redémarrage, son code est demandé, l'empreinte n'est plus proposée.
# 3. Réglages › Code et empreinte : « Retirer le code » permis dans un foyer (avec avertissement).
import sys, os, json, urllib.request
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
SP=(sys.argv[1] if len(sys.argv)>1 else HERE)
src=open(os.path.join(HERE,'foyer_base.py'),encoding='utf-8').read()
exec(src.split("with sync_playwright() as p:")[0])
data={"askName":False,"devise":"EUR","personnes":[{"nom":"Marie"}],
  "comptes":[{"key":"Benoit","nom":"Compte courant","payer":"Benoit","main":True}],
  "entries":[{"id":100+i,"date":"2026-10-%02d"%(1+i),"marchand":"Magasin %d"%i,"montant":10+i,"categorie":"Alimentation","payePar":"Benoit","articles":[]} for i in range(3)]}
BIO="""
window.__bio=[];
var TN=new Proxy({}, { get:function(o,k){
  if(k==="then") return undefined;
  if(k==="biometricAvailable") return function(){ window.__bio.push("avail"); return Promise.resolve({ available:true }); };
  if(k==="biometric") return function(){ window.__bio.push("bio"); return Promise.resolve({}); };
  return function(){ return Promise.reject(new Error("absent du test")); };
} });
window.Capacitor={ isNativePlatform:function(){ return true; }, getPlatform:function(){ return "android"; }, Plugins:{ TicketsNative:TN } };
"""
def txt(pg): return pg.locator("body").inner_text().replace(" "," ").replace("\xa0"," ")
def fresh(b, errs, tag, init=None):
    ctx=b.new_context(viewport={'width':412,'height':900})
    if init: ctx.add_init_script(init)
    pg=ctx.new_page(); pg.on('pageerror', lambda e: errs.append(tag+": "+str(e))); pg.on('dialog', lambda d: d.accept())
    pg.route("**/*", lambda r: r.continue_() if (r.request.url.startswith("file:") or r.request.url.startswith(API)) else r.abort())
    pg.goto(APP); pg.wait_for_timeout(300); return pg
with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    urllib.request.urlopen(API+"/__test/reset").read()
    O=fresh(b, errs, "O")
    O.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k])); localStorage.setItem('foyerApi', JSON.stringify('%s'));}" % API, data)
    O.reload(); O.wait_for_timeout(1200)
    open_foyer(O); t=txt(O); check("Chaque téléphone choisit son code" in t and "obligatoire" not in t.lower(), "présentation du foyer : code conseillé, plus « obligatoire »")
    O.locator("#fyNew").click(); O.wait_for_timeout(300); O.locator(".ui-yes").click()
    O.wait_for_selector("#lockscreen[data-setup]", timeout=8000); O.wait_for_timeout(300)
    t=O.locator("#lockscreen").inner_text()
    check("Fortement conseillé" in t and "Ton empreinte" not in t and "ne peuvent pas être passées" not in t, "propriétaire sans lecteur : code conseillé, pas d'étape empreinte")
    O.locator("#fySkip").click(); O.wait_for_timeout(400)
    s=O.locator(".sheet-overlay").last.inner_text()
    check("Sans code, quiconque ouvre ton téléphone voit les comptes du foyer" in s, "« Passer » : avertissement")
    O.locator(".sheet-overlay .ui-no").last.click(); O.wait_for_timeout(300)
    check(O.locator("#lockscreen[data-setup]").count()==1, "« Mettre un code » : retour au code")
    O.locator("#fySkip").click(); O.wait_for_timeout(400); O.locator(".sheet-overlay .ui-yes").last.click(); O.wait_for_timeout(800)
    check(O.locator("#lockscreen").count()==0 and ls(O,"lockCfg") is None and ls(O,"lockSkip")==1, "« Continuer sans code » : pas de code, choix retenu")
    if O.locator(".sheet-overlay .fy-code").count(): btn(O, "Je l'ai noté"); O.wait_for_timeout(500)
    while O.locator(".sheet-overlay .ui-no").count(): O.locator(".sheet-overlay .ui-no").last.click(); O.wait_for_timeout(300)
    open_foyer(O)
    check("Pas de code sur ce téléphone · Ajouter" in txt(O), "écran du foyer : « Pas de code sur ce téléphone · Ajouter »")
    O.locator("#fyLk").click(); O.wait_for_timeout(400)
    check(O.locator(".sheet-overlay input").count()>=2, "« Ajouter » ouvre le choix du code")
    O.locator(".sheet-overlay .ui-cancel").last.click(); O.wait_for_timeout(300)
    O.reload(); O.wait_for_timeout(2500)
    check(O.locator("#lockscreen").count()==0, "redémarrage : rien n'est redemandé")
    # 2. Marie, téléphone avec lecteur
    open_foyer(O); O.locator("#fyAdd").click(); O.wait_for_timeout(300); O.locator('[data-n="Marie"]').click(); O.wait_for_timeout(150)
    O.locator('[data-q="w"]').click(); O.wait_for_timeout(150); O.locator("#fyOk").click(); O.wait_for_timeout(1500)
    inv=read_qr(O, "t152_qr.png"); O.locator(".ui-no").last.click(); O.wait_for_timeout(300)
    M=fresh(b, errs, "M", BIO); M.evaluate("()=>{localStorage.clear(); localStorage.setItem('foyerApi', JSON.stringify('%s'));}" % API)
    M.reload(); M.wait_for_timeout(1200); btn(M, "Rejoindre un foyer (QR code)")
    M.locator("#fyPaste").fill(inv); M.locator("#fyGo").click(); M.wait_for_timeout(1500)
    M.wait_for_selector("#lockscreen[data-setup]", timeout=8000); M.wait_for_timeout(300)
    t=M.locator("#lockscreen").inner_text()
    check("Ton empreinte" in t and "Choisis ton propre code" in t, "Marie avec lecteur : son propre code, puis l'empreinte")
    keypad(M, "135790"); M.wait_for_timeout(150); keypad(M, "135790"); M.wait_for_timeout(700)
    check(M.locator("#fyBio").count()==1 and M.locator("#fySkipB").count()==1, "empreinte proposée après le code, avec « Pas d'empreinte »")
    M.locator("#fySkipB").click(); M.wait_for_timeout(800)
    lc=ls(M,"lockCfg") or {}
    check(M.locator("#lockscreen").count()==0 and lc.get("hash") and not lc.get("bioId") and lc.get("bioSkip")==1, "Marie : code seul, choix retenu")
    check(lc.get("hash")!=(ls(O,"lockCfg") or {}).get("hash"), "chaque téléphone a son code")
    M.reload(); M.wait_for_timeout(1200)
    check(M.locator("#lockscreen:not([data-setup])").count()==1, "redémarrage : son code est demandé")
    keypad(M, "135790"); M.wait_for_timeout(2500)
    check(M.locator("#lockscreen").count()==0, "pas de nouvelle demande d'empreinte")
    open_foyer(M); check("Code actif sur ce téléphone" in txt(M), "écran du foyer de Marie : « Code actif sur ce téléphone »")
    # 3. Réglages › Code et empreinte
    M.locator("#hmenu").click(); M.wait_for_timeout(400); M.locator('.dr-row[data-k="settings"]').click(); M.wait_for_timeout(300)
    M.locator('.sheet-overlay .dr-row[data-k="lock"]').click(); M.wait_for_timeout(500)
    s=M.locator(".sheet-overlay").last.inner_text()
    check("Ajouter l'empreinte" in s and "Retirer le code" in s and "Obligatoires" not in s, "Réglages : ajouter l'empreinte, retirer le code")
    M.locator(".sheet-overlay button", has_text="Retirer le code").click(); M.wait_for_timeout(400)
    s=M.locator(".sheet-overlay").last.inner_text()
    check("Sans code, quiconque" in s, "retirer le code : avertissement")
    M.locator(".sheet-overlay input").first.fill("135790"); M.locator(".sheet-overlay button.danger").last.click(); M.wait_for_timeout(800)
    check(ls(M,"lockCfg") is None and ls(M,"lockSkip")==1, "code retiré, pas redemandé")
    errs=[e for e in errs if "absent du test" not in e]
    check(not errs, "pas d'erreur "+str(errs[:3]))
    b.close()
print("\n%d échec(s)" % len(fails)); sys.exit(1 if fails else 0)
