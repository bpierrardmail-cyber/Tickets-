# Restaurer depuis Google Drive (étape 2). Faux window.Capacitor : un faux TicketsNative qui garde les sauvegardes envoyées
# (comme le dossier Drive) avec leurs propriétés (n tickets, c comptes, d téléphone, kf clé) : driveList, driveFetch({id}).
# 1. Sur ce téléphone : 2 sauvegardes (2 puis 3 tickets) ; Drive › Restaurer : la liste ; la plus ancienne : confirmation
#    (téléphone 3 tickets / sauvegarde 2 tickets), l'état actuel part d'abord sur Drive ; après : 2 tickets, bandeau
#    « Sauvegarde du … restaurée » avec « Annuler » ; réglages du téléphone (rappels, Drive) inchangés.
# 2. « Annuler la restauration » : les 3 tickets reviennent. 3. Bandeau retiré à la 1re modification, bouton gardé dans l'écran Drive.
# 4. Sauvegardes d'un autre téléphone : avertissement dans la confirmation, bandeau « Un autre téléphone sauvegarde ici ».
# 5. Nouveau téléphone : « Restaurer depuis Google Drive » au premier démarrage, code de secours (sans « Repartir de zéro »),
#    rien n'est envoyé avant la restauration, tout revient, la sauvegarde Drive continue avec la même clé.
# 6. Réglages › Restaurer une sauvegarde : Drive ou fichier. Données inventées.
import sys, os, base64, time
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
# servie sur https://localhost (une vraie origine : le stockage du navigateur survit aux rechargements, ce que file:// ne garantit pas)
APP='https://localhost/beta/index.html'; fails=[]
def serve(r):
    u=r.request.url
    if not u.startswith("https://localhost/"): return r.abort()
    f=os.path.join(ROOT, u.split("https://localhost/",1)[1].split("?")[0].split("#")[0])
    if not os.path.isfile(f): return r.fulfill(status=404, body="")
    ct="text/html; charset=utf-8" if f.endswith(".html") else ("application/javascript" if f.endswith(".js") else "application/octet-stream")
    return r.fulfill(status=200, body=open(f,"rb").read(), headers={"Content-Type":ct})
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def norm(t): return t.replace(" "," ").replace("\xa0"," ")
SEC=bytes(range(1,17)); SEC64=base64.urlsafe_b64encode(SEC).decode().rstrip("=")
CODE=base64.b32encode(SEC).decode().rstrip("=")
def T(i, d, m, x): return {"id":i,"date":d,"marchand":m,"montant":x,"categorie":"Alimentation","payePar":"Alex","articles":[]}
data={"askName":False,"devise":"EUR","personnes":[{"nom":"Marie"}],"lastBackup":"2026-10-29T10:00:00.000Z",
  "comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True}],
  "entries":[T(1,"2026-10-12","Marché",85), T(2,"2026-10-20","Boulangerie",6.4)],
  "rappels":{"on":False,"h":18,"frais":True,"vir":True,"bud":True,"bk":True},
  "driveSec":SEC64, "driveCfg":{"on":True,"email":"alex.test@gmail.com","since":1793300000000}}
MOCK="""
(function(){
var dv=window.__dv={ calls:[], on:true, wifi:false, keepD:30, keepM:12, keepY:5, lastOk:0, lastSize:0, pendingSince:0, err:'', count:0, email:'alex.test@gmail.com',
  staged:null, stagedMeta:null, files:[], dev:'telA', otherAt:0, autoSend:true, connect:null };
try{ var sv=JSON.parse(localStorage.getItem('__dv')||'null'); if(sv) for(var k0 in sv) dv[k0]=sv[k0]; }catch(e){}
function save(){ try{ localStorage.setItem('__dv', JSON.stringify(dv)); }catch(e){} }
window.__dvSave=save;
function st(){ return { on:dv.on, email:dv.email, wifi:dv.wifi, keepD:dv.keepD, keepM:dv.keepM, keepY:dv.keepY, lastOk:dv.lastOk, lastSize:dv.lastSize,
  pendingSince:dv.staged ? dv.pendingSince : 0, count:dv.files.length, err:dv.err, dev:dv.dev, otherAt:dv.otherAt }; }
function send(){ if(!dv.autoSend || !dv.staged) return; var m=dv.stagedMeta;
  dv.files.unshift({ id:'f'+(dv.files.length+1)+'_'+Date.now(), created:Date.now(), n:String(m.n), c:String(m.c), d:dv.dev, kf:m.kf, size:'1000', data:dv.staged });
  dv.lastSize=dv.staged.length; dv.staged=null; dv.pendingSince=0; dv.lastOk=Date.now(); dv.err=''; save(); }
window.__dvSend=send;
if(dv.staged) setTimeout(send, 800);   // comme Android : un envoi préparé avant un rechargement part quand même
function meta(f){ var o={}; for(var k in f) if(k!=='data') o[k]=f[k]; return o; }
window.Capacitor={ isNativePlatform:function(){ return true; }, Plugins:{
  TicketsNative:{
    driveConnect:function(){ dv.calls.push('connect'); var kfs=[]; dv.files.forEach(function(f){ if(f.kf && kfs.indexOf(f.kf)<0) kfs.push(f.kf); });
      save(); return Promise.resolve({ email:dv.email, count:dv.files.length, kfs:kfs, last:dv.files.length?dv.files[0].created:0 }); },
    driveSetup:function(o){ dv.calls.push(['setup', JSON.parse(JSON.stringify(o))]); for(var k in o) if(k in dv) dv[k]=o[k];
      if(o.on===false){ dv.staged=null; dv.pendingSince=0; } save(); return Promise.resolve(st()); },
    driveStatus:function(){ return Promise.resolve(st()); },
    driveStage:function(o){ if(!dv.on) return Promise.reject({ code:'off', message:'off' });
      dv.calls.push(['stage', { n:o.n, c:o.c }]); dv.staged=o.data; dv.stagedMeta={ n:o.n, c:o.c, kf:o.kf };
      if(!dv.pendingSince) dv.pendingSince=Date.now(); save(); setTimeout(send, 800); return Promise.resolve(st()); },
    driveSendNow:function(){ dv.calls.push('send'); save(); setTimeout(send, 800); return Promise.resolve(st()); },
    driveList:function(){ dv.calls.push('list'); return Promise.resolve({ files:dv.files.map(meta), dev:dv.dev }); },
    driveFetch:function(o){ dv.calls.push(['fetch', o&&o.id]); var f=dv.files.filter(function(x){ return !o || !o.id || x.id===o.id; })[0];
      return f ? Promise.resolve({ data:f.data, name:'x', created:f.created, count:dv.files.length }) : Promise.reject({ code:'none', message:'Aucune' }); },
    widgetData:function(){ return Promise.resolve(); }, launchTarget:function(){ return Promise.resolve({ target:null }); }
  } } };
})();
"""
def calls(pg, kind): return [c for c in pg.evaluate("()=>__dv.calls") if (c==kind or (isinstance(c, list) and c[0]==kind))]
def hide(pg):
    pg.evaluate("()=>{ Object.defineProperty(document,'hidden',{configurable:true,get:()=>true}); Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'}); document.dispatchEvent(new Event('visibilitychange')); }")
    pg.wait_for_timeout(1500)
def show(pg):
    pg.evaluate("()=>{ Object.defineProperty(document,'hidden',{configurable:true,get:()=>false}); Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'visible'}); document.dispatchEvent(new Event('visibilitychange')); }")
    pg.wait_for_timeout(1200)
def LS(pg, k): return pg.evaluate("k=>JSON.parse(localStorage.getItem(k))", k)
def open_drive(pg):
    pg.locator("#hmenu").click(); pg.wait_for_timeout(400); pg.locator('.dr-row[data-k="backup"]').click(); pg.wait_for_timeout(400)
    pg.locator('.sheet-overlay .dr-row[data-k="drive"]').click(); pg.wait_for_timeout(800)
def app_txt(pg): return norm(pg.locator("#app").inner_text())
def until(pg, js, ms=15000):
    try: pg.wait_for_function(js, timeout=ms); return True
    except Exception: return False
def restored(pg, n):
    # la restauration recharge la page : attendre la page rechargée, avec n tickets
    ok=until(pg, "()=>{ try{ var e=JSON.parse(localStorage.getItem('entries')); return !window.__pre && document.readyState==='complete' && e && e.length===%d && document.querySelector('#app') && document.querySelector('#app').innerText.length>50; }catch(x){ return false; } }"%n, 20000)
    pg.wait_for_timeout(1500)
    return ok

with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    def ctx():
        c=b.new_context(viewport={'width':412,'height':900}); c.add_init_script(MOCK)
        pg=c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.route("**/*", serve)
        return pg
    pg=ctx(); pg.goto(APP); pg.wait_for_timeout(1200)
    for _ in range(3):
        pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); pg.wait_for_timeout(600); pg.reload(); pg.wait_for_timeout(1500)
        if not pg.locator(".sheet-overlay").count(): break
    # deux sauvegardes : 2 tickets, puis 3
    hide(pg); until(pg, "()=>__dv.files.length===1"); show(pg)
    pg.evaluate("()=>{ var e=JSON.parse(localStorage.getItem('entries')); e.push({id:3,date:'2026-10-28',marchand:'Pharmacie',montant:12,categorie:'Santé',payePar:'Alex',articles:[]}); localStorage.setItem('entries', JSON.stringify(e)); }"); pg.wait_for_timeout(600)
    pg.reload(); pg.wait_for_timeout(1500); hide(pg); until(pg, "()=>__dv.files.length===2"); show(pg)
    F=pg.evaluate("()=>__dv.files.map(f=>[f.n,f.c,f.d])")
    check(F==[["3","1","telA"],["2","1","telA"]], "2 sauvegardes sur le faux Drive, avec tickets, comptes et téléphone : %s"%F)
    # ---------- 1. restaurer la plus ancienne
    open_drive(pg)
    t=app_txt(pg); check("Restaurer" in t and "Choisir une sauvegarde" in t, "écran Drive : « Restaurer » actif")
    pg.locator("#drvRestore").click(); pg.wait_for_timeout(1200)
    t=app_txt(pg); rows=pg.locator(".drv-f")
    check(rows.count()==2 and "cette semaine" in t.lower() and "la plus récente" in t and "3 tickets · 1 compte" in t and "2 tickets · 1 compte" in t, "liste : 2 sauvegardes, la plus récente marquée, tickets et comptes")
    rows.nth(1).click(); pg.wait_for_timeout(500)
    s=norm(pg.locator(".sheet-overlay").last.inner_text())
    check("Sur le téléphone" in s and "3 tickets" in s and "2 tickets" in s and "Annuler la restauration" in s and "photos" in s, "confirmation : téléphone 3 tickets, sauvegarde 2 tickets, état gardé, photos et réglages inchangés")
    check("autre téléphone" not in s and "membres" not in s, "pas d'avertissement (même téléphone, pas de foyer)")
    nsend=len(calls(pg, "send")); nfiles=len(pg.evaluate("()=>__dv.files"))
    pg.evaluate("()=>{ window.__pre=1; }"); pg.locator("#drvRsOk").click(); restored(pg, 2)
    check(len(calls(pg, "send"))>nsend and len(pg.evaluate("()=>__dv.files"))==nfiles+1, "avant de restaurer, l'état actuel part sur Drive")
    check(len(LS(pg, "entries"))==2, "restaurée : 2 tickets sur le téléphone")
    t=app_txt(pg)
    check("restaurée" in t and "gardées 30 jours" in t and pg.locator("#drvBanUndo").count()==1, "accueil : bandeau « Sauvegarde du … restaurée » avec « Annuler »")
    check(LS(pg, "rappels")["h"]==18 and LS(pg, "driveCfg")["on"] is True and LS(pg, "driveSec")==SEC64, "rappels et sauvegarde Drive du téléphone inchangés")
    U=LS(pg, "driveUndo"); check(U and len(U["dump"]["data"]["entries"])==3, "état d'avant gardé (3 tickets)")
    # ---------- 2. annuler la restauration
    pg.locator("#drvBanUndo").click(); pg.wait_for_timeout(300); pg.evaluate("()=>{ window.__pre=1; }"); pg.locator(".sheet-overlay .ui-yes").click(); restored(pg, 3)
    check(len(LS(pg, "entries"))==3 and not LS(pg, "driveUndo") and pg.locator("#drvBanUndo").count()==0, "« Annuler la restauration » : les 3 tickets reviennent, plus de bandeau")
    # ---------- 3. bandeau retiré à la 1re modification
    open_drive(pg); pg.locator("#drvRestore").click(); pg.wait_for_timeout(1200)
    pg.locator(".drv-f").last.click(); pg.wait_for_timeout(400); pg.evaluate("()=>{ window.__pre=1; }"); pg.locator("#drvRsOk").click(); restored(pg, 2)
    check(pg.locator("#drvBanUndo").count()==1, "nouvelle restauration : bandeau")
    pg.evaluate("()=>{ var e=JSON.parse(localStorage.getItem('entries')); e[0].montant=90; localStorage.setItem('entries', JSON.stringify(e)); }"); pg.wait_for_timeout(600)
    pg.reload(); pg.wait_for_timeout(1800); hide(pg); show(pg); pg.reload(); pg.wait_for_timeout(1800)
    check(pg.locator("#drvBanUndo").count()==0, "après une modification : plus de bandeau sur l'accueil")
    open_drive(pg)
    check(pg.locator("#drvUndo").count()==1 and "possible 30 jours" in app_txt(pg), "écran Drive : « Annuler la restauration » toujours là")
    pg.locator("#hback").click(); pg.wait_for_timeout(400)
    # ---------- 4. un autre téléphone
    pg.evaluate("()=>{ __dv.files.unshift({ id:'autre', created:Date.now()-2*3600000, n:'7', c:'2', d:'telB', kf:__dv.files[0].kf, size:'1', data:__dv.files[0].data }); __dv.otherAt=Date.now()-2*3600000; __dvSave(); }")
    show(pg)
    t=app_txt(pg); check("Un autre téléphone sauvegarde ici" in t and pg.locator("#drvOtherX").count()==1, "bandeau « Un autre téléphone sauvegarde ici »")
    pg.locator("#drvOtherX").click(); pg.wait_for_timeout(400); check(pg.locator("#drvOtherX").count()==0, "bandeau fermé")
    open_drive(pg); check("Un autre téléphone sauvegarde ici" in app_txt(pg) and "Applications tierces" in app_txt(pg), "écran Drive : l'avertissement reste, avec comment retirer l'accès")
    pg.locator("#drvRestore").click(); pg.wait_for_timeout(1200); pg.locator(".drv-f").nth(1).click(); pg.wait_for_timeout(400)
    s=norm(pg.locator(".sheet-overlay").last.inner_text())
    check("il y a 2 h" in s and "n'utilise pas les deux" in s, "confirmation : « en a envoyé une il y a 2 h… n'utilise pas les deux »")
    pg.locator(".sheet-overlay .ui-no").last.click(); pg.wait_for_timeout(300)
    files=pg.evaluate("()=>__dv.files")
    # ---------- 5. nouveau téléphone
    p2=ctx(); p2.goto(APP); p2.wait_for_timeout(300)
    p2.evaluate("f=>{ localStorage.clear(); localStorage.setItem('__dv', JSON.stringify({ files:f, dev:'telC', on:false, calls:[] })); }", files)
    p2.reload(); p2.wait_for_timeout(1800)
    s=norm(p2.locator(".sheet-overlay").last.inner_text()) if p2.locator(".sheet-overlay").count() else ""
    check("Restaurer depuis Google Drive" in s, "premier démarrage : « Restaurer depuis Google Drive »")
    p2.locator(".sheet-overlay button", has_text="Restaurer depuis Google Drive").click(); p2.wait_for_timeout(1000)
    s=norm(p2.locator(".sheet-overlay").last.inner_text())
    check("restaurer depuis drive" in s.lower() and "sauvegardes" in s and p2.locator("#drvZero").count()==0, "code demandé, sans « Repartir de zéro »")
    p2.locator("#drvCode").fill("AAAA-BBBB"); p2.locator("#drvOk").click(); p2.wait_for_timeout(400)
    check("26 caractères" in norm(p2.locator("#drvErr").inner_text()), "code incomplet refusé")
    p2.locator("#drvCode").fill("-".join(CODE[i:i+4] for i in range(0,len(CODE),4)).lower()); p2.locator("#drvOk").click(); p2.wait_for_timeout(1500)
    t=norm(p2.locator("#app").inner_text())
    check(p2.locator(".drv-f").count()>=3 and "photos des tickets ne sont pas sur Drive" in t, "liste des sauvegardes ; les photos ne reviennent pas par Drive")
    hide(p2); show(p2)
    check(not calls(p2, "stage"), "rien n'est envoyé avant la restauration (le téléphone vide ne remplace pas la sauvegarde)")
    p2.locator(".drv-f").nth(1).click(); p2.wait_for_timeout(400)
    s=norm(p2.locator(".sheet-overlay").last.inner_text())
    check("Sur le téléphone" not in s and "continue ensuite ici" in s, "confirmation du nouveau téléphone (sans comparaison)")
    p2.evaluate("()=>{ window.__pre=1; }"); p2.locator("#drvRsOk").click(); until(p2, "()=>{ try{ return !window.__pre && !!JSON.parse(localStorage.getItem('driveRestored')) && document.readyState==='complete'; }catch(x){ return false; } }", 20000); p2.wait_for_timeout(2500)
    E=LS(p2, "entries")
    check(E and len(E)>=2 and LS(p2, "driveSec")==SEC64 and LS(p2, "driveCfg")["on"] is True and LS(p2, "askName") is False, "tout est revenu ; même clé ; sauvegarde Drive active")
    check(any(c[1].get("on") is True for c in calls(p2, "setup")), "Android : sauvegarde Drive activée sur le nouveau téléphone")
    t=norm(p2.locator("#app").inner_text()); check("Tout est revenu" in t and "même clé" in t, "accueil : « Tout est revenu »")
    # ---------- 6. Réglages › Restaurer
    pg.locator("#hmenu").click(); pg.wait_for_timeout(400); pg.locator('.dr-row[data-k="settings"]').click(); pg.wait_for_timeout(300)
    pg.locator('.sheet-overlay .dr-row[data-k="restore"]').click(); pg.wait_for_timeout(400)
    s=norm(pg.locator(".sheet-overlay").last.inner_text())
    check("Depuis Google Drive" in s and "Depuis un fichier" in s, "Réglages › Restaurer : Drive ou fichier")
    pg.locator(".sheet-overlay .ui-no").last.click(); pg.wait_for_timeout(300)
    pg.locator("#hmenu").click(); pg.wait_for_timeout(400)
    check("Sauvegarder · restaurer" in norm(pg.locator('.dr-row[data-k="backup"]').inner_text()), "menu : « Sauvegarder · restaurer »")
    pg.locator('.dr-row[data-k="backup"]').click(); pg.wait_for_timeout(400)
    s=norm(pg.locator(".sheet-overlay").last.inner_text())
    check("RESTAURER" in s.upper() and "Depuis Google Drive" in s and "Depuis un fichier" in s and "Sauvegarde sur Google Drive" in s, "feuille : Sauvegarder (Drive, complète, données) puis Restaurer (Drive, fichier)")
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
print("\n%d échec(s)"%len(fails)); sys.exit(1 if fails else 0)
