# Sauvegarde sur Google Drive (étape 1) : Menu › Sauvegarder › Drive.
# Faux window.Capacitor avec un faux TicketsNative qui imite la partie Android (TkDrive) : connexion Google,
# fichier préparé (driveStage), envoi (driveSendNow), état (driveStatus), lecture (driveFetch).
# 1. Menu › Sauvegarder : Drive en tête ; présentation ; connexion ; code de secours (case obligatoire) ; activation :
#    une sauvegarde chiffrée (g1.) est préparée puis envoyée ; elle s'ouvre avec le code affiché (AES-GCM + gzip) ;
#    écran « Première sauvegarde… » puis « À jour » ; ligne du menu « Drive · aujourd'hui HH:MM ».
# 2. En quittant l'appli : rien n'est préparé si rien n'a changé ; un ticket de plus → nouvelle sauvegarde préparée.
# 3. Envoi en attente : bandeau sur l'accueil après 1 h (fermable) ; ligne du menu grise « envoi en cours » les 6 premières heures, rouge ensuite, « Envoyer maintenant ».
# 4. Compte à reconnecter : bandeau « Sauvegarde Drive arrêtée ».
# 5. Wi-Fi seulement, durées de conservation, Vérifier, Désactiver.
# 6. Un autre téléphone, compte qui a déjà des sauvegardes : le code est demandé et vérifié.
# 7. Rappels : le rappel « 7 jours » n'est plus programmé quand Drive est actif ; Android est prévenu (remind).
# 8. Version Store sans Plus : Drive gratuit (07/11). 9. Navigateur : pas de Drive. Données inventées.
import sys, os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
# servie sur https://localhost (vraie origine : le stockage survit aux rechargements, ce que file:// ne garantit pas)
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
data={"askName":False,"devise":"EUR","personnes":[{"nom":"Marie"}],"lastBackup":"2026-10-01T10:00:00.000Z",
  "comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True}],
  "entries":[{"id":1,"date":"2026-10-12","marchand":"Marché","montant":85,"categorie":"Alimentation","payePar":"Alex","articles":[]},
             {"id":2,"date":"2026-10-20","marchand":"Boulangerie","montant":6.4,"categorie":"Alimentation","payePar":"Alex","articles":[]}],
  "fraisCommuns":[{"id":5,"label":"Loyer","montant":650,"personne":"Commun","recurrent":True,"startMonth":"2026-01","jour":5,"compte":"Alex"}]}
MOCK="""
(function(){
var dv=window.__dv={ calls:[], on:false, wifi:false, keepD:30, keepM:12, keepY:5, lastOk:0, lastSize:0, pendingSince:0, err:'', count:0, email:'',
  staged:null, stages:[], lastData:null, autoSend:true, connect:{ email:'alex.test@gmail.com', count:0, kfs:[] } };
// l'état d'Android survit au rechargement de la page (comme les préférences du téléphone)
try{ var sv=JSON.parse(localStorage.getItem('__dv')||'null'); if(sv) for(var k0 in sv) dv[k0]=sv[k0]; }catch(e){}
function save(){ try{ localStorage.setItem('__dv', JSON.stringify(dv)); }catch(e){} }
window.__dvSave=save;

function st(){ return { on:dv.on, email:dv.email, wifi:dv.wifi, keepD:dv.keepD, keepM:dv.keepM, keepY:dv.keepY, lastOk:dv.lastOk, lastSize:dv.lastSize,
  pendingSince:dv.staged ? dv.pendingSince : 0, count:dv.count, err:dv.err }; }
function send(){ if(!dv.autoSend || !dv.staged) return; dv.lastData=dv.staged; dv.lastSize=dv.staged.length; dv.staged=null; dv.pendingSince=0; dv.lastOk=Date.now(); dv.count++; dv.err=''; save(); }
window.__dvSend=send;
window.__ln=[];
window.Capacitor={ isNativePlatform:function(){ return true; }, Plugins:{
  TicketsNative:{
    driveConnect:function(){ dv.calls.push('connect'); dv.email=dv.connect.email; save(); return Promise.resolve(JSON.parse(JSON.stringify(dv.connect))); },
    driveSetup:function(o){ dv.calls.push(['setup', JSON.parse(JSON.stringify(o))]); for(var k in o) if(k in dv) dv[k]=o[k];
      if(o.on===false){ dv.staged=null; dv.pendingSince=0; dv.err=''; } save(); return Promise.resolve(st()); },
    driveStatus:function(){ return Promise.resolve(st()); },
    driveStage:function(o){ if(!dv.on) return Promise.reject({ code:'off', message:'off' });
      dv.calls.push(['stage', { n:o.n, kf:o.kf, remind:o.remind, name:o.name }]); dv.staged=o.data; dv.stages.push(o.data);
      if(!dv.pendingSince) dv.pendingSince=Date.now(); save(); setTimeout(send, 1500); return Promise.resolve(st()); },
    driveSendNow:function(){ dv.calls.push('send'); save(); setTimeout(send, 1500); return Promise.resolve(st()); },
    driveFetch:function(){ dv.calls.push('fetch'); save(); return dv.lastData ? Promise.resolve({ data:dv.lastData, name:'x', created:dv.lastOk, count:dv.count }) : Promise.reject({ code:'none', message:'Aucune' }); },
    widgetData:function(){ return Promise.resolve(); }, launchTarget:function(){ return Promise.resolve({ target:null }); }
  },
  LocalNotifications:{
    schedule:function(o){ o.notifications.forEach(function(n){ window.__ln.push(n); }); return Promise.resolve({}); },
    getPending:function(){ return Promise.resolve({ notifications:window.__ln.map(function(n){ return { id:n.id }; }) }); },
    cancel:function(o){ var ids=o.notifications.map(function(n){ return n.id; }); window.__ln=window.__ln.filter(function(n){ return ids.indexOf(n.id)<0; }); return Promise.resolve(); },
    requestPermissions:function(){ return Promise.resolve({ display:'granted' }); }, createChannel:function(){ return Promise.resolve(); },
    addListener:function(){ return Promise.resolve({ remove:function(){} }); } } } };
})();
"""
# déchiffre une sauvegarde avec le code de secours affiché (même calcul que l'appli : HKDF « drive », AES-GCM, gzip)
OPEN="""async ([code, str])=>{
  const A='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits=0, val=0, out=[];
  for(const ch of code.toUpperCase().replace(/[^A-Z2-7]/g,'')){ val=(val<<5)|A.indexOf(ch); bits+=5; if(bits>=8){ out.push((val>>>(bits-8))&255); bits-=8; } }
  const sec=new Uint8Array(out);
  const hk=await crypto.subtle.importKey('raw', sec, 'HKDF', false, ['deriveBits']);
  const raw=await crypto.subtle.deriveBits({ name:'HKDF', hash:'SHA-256', salt:new TextEncoder().encode('tickets-foyer'), info:new TextEncoder().encode('drive') }, hk, 256);
  const key=await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
  const p=str.split('.'); let s=p[1].replace(/-/g,'+').replace(/_/g,'/'); while(s.length%4) s+='=';
  const b=atob(s), all=new Uint8Array(b.length); for(let i=0;i<b.length;i++) all[i]=b.charCodeAt(i);
  const d=new Uint8Array(await crypto.subtle.decrypt({ name:'AES-GCM', iv:all.slice(0,12) }, key, all.slice(12)));
  const txt=await new Response(new Blob([d]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  return { len:sec.length, prefix:p[0], obj:JSON.parse(txt) };
}"""
def calls(pg, kind): return [c[1] for c in pg.evaluate("()=>__dv.calls") if isinstance(c, list) and c[0]==kind]
def hide(pg):
    pg.evaluate("()=>{ Object.defineProperty(document,'hidden',{configurable:true,get:()=>true}); Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'}); document.dispatchEvent(new Event('visibilitychange')); }")
    pg.wait_for_timeout(1500)
def show(pg):
    pg.evaluate("()=>{ Object.defineProperty(document,'hidden',{configurable:true,get:()=>false}); Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'visible'}); document.dispatchEvent(new Event('visibilitychange')); }")
    pg.wait_for_timeout(900)
def menu_row(pg):
    pg.locator("#hmenu").click(); pg.wait_for_timeout(400); pg.locator('.mnsub[data-ms="sauv"]').click(); pg.wait_for_timeout(300)
    t=norm(pg.locator('.mn-stat').inner_text()); col=(pg.locator('.dr-row[data-k="drive"] .st').get_attribute("style") or "") if pg.locator('.dr-row[data-k="drive"] .st').count() else ""
    pg.locator("#hback").click(); pg.wait_for_timeout(300)
    return t, col

with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    def page(url=APP, mock=True):
        c=b.new_context(viewport={'width':412,'height':900})
        if mock: c.add_init_script(MOCK)
        pg=c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.route("**/*", serve)
        pg.goto(url); pg.wait_for_timeout(1200)   # laisser le 1er démarrage (vide) se terminer avant d'écrire les données
        for _ in range(3):
            pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); pg.wait_for_timeout(600); pg.reload(); pg.wait_for_timeout(1500)
            if not pg.locator(".sheet-overlay").count(): break
        return pg
    pg=page()
    # ---------- 1. activer
    pg.locator("#hmenu").click(); pg.wait_for_timeout(400); pg.locator('.mnsub[data-ms="sauv"]').click(); pg.wait_for_timeout(400)
    t=norm(pg.locator(".mn-pg").last.inner_text())
    check("Sauvegarde Google Drive" in t and "Sauvegarde complète" in t and "Données seules" in t, "Menu › Sauvegarder : Drive en tête, complète et données seules gardées")
    pg.locator('.mn-pg .dr-row[data-k="drive"]').click(); pg.wait_for_timeout(400)
    t=norm(pg.locator(".sheet-overlay").last.inner_text())
    check("Chiffrée" in t and "Sans photos" in t and "Tickets – sauvegardes" in t and "Choisir le compte Google" in t, "présentation : automatique, chiffrée, sans photos, dossier de l'appli")
    pg.locator("#drvGo").click(); pg.wait_for_timeout(700)
    t=norm(pg.locator(".sheet-overlay").last.inner_text()); code=pg.locator(".sheet-overlay .fy-code").inner_text().strip()
    check("ton code de secours" in t.lower() and "n'apparaîtra plus" in t and len(code.replace("-",""))==26 and code.count("-")==6, "code de secours : 26 caractères en groupes de 4 (%s)"%code)
    check(pg.locator("#drvOk").is_disabled(), "« Activer » grisé tant que la case n'est pas cochée")
    pg.locator("#drvNoted").check(); check(not pg.locator("#drvOk").is_disabled(), "case cochée : « Activer » possible")
    pg.locator("#drvOk").click(); pg.wait_for_timeout(900)
    S=calls(pg, "setup"); G=calls(pg, "stage")
    check(S and S[0].get("on") is True and S[0].get("remind") is False, "Android : sauvegarde activée (rappels pas activés : pas de rappel)")
    check(len(G)==1 and G[0]["n"]==2 and G[0]["kf"] and G[0]["name"].startswith("tickets-2026-10-30-") and G[0]["name"].endswith(".tkb"), "1re sauvegarde préparée : 2 tickets, nom daté %s"%(G[0]["name"] if G else ""))
    staged=pg.evaluate("()=>__dv.stages[0]")
    check(staged.startswith("g1.") and "Marché" not in staged, "sauvegarde chiffrée (g1.), rien de lisible")
    o=pg.evaluate(OPEN, [code, staged])
    check(o["len"]==16 and o["obj"]["_app"]=="tickets" and len(o["obj"]["data"]["entries"])==2 and o["obj"]["data"]["entries"][0]["marchand"]=="Marché", "elle s'ouvre avec le code affiché : 2 tickets")
    check("driveSec" not in o["obj"]["data"] and "driveCfg" not in o["obj"]["data"], "la clé n'est pas dans la sauvegarde")
    t=norm(pg.locator("#app").inner_text())
    check("Première sauvegarde" in t and pg.locator(".drv-prog").count()==1, "écran de la sauvegarde : « Première sauvegarde… » avec la barre")
    pg.wait_for_timeout(4500); t=norm(pg.locator("#app").inner_text())
    check("À jour" in t and "Dernière : aujourd'hui" in t and "alex.test@gmail.com" in t and "30 j · 12 mois · 5 ans" in t, "envoyée : « À jour », compte, conservation")
    r,col=menu_row(pg); check("Drive · aujourd'hui" in r and "accent" in col, "menu : « Sauvegarder · Drive · aujourd'hui HH:MM » en vert (%s)"%r)
    check(pg.evaluate("()=>JSON.parse(localStorage.getItem('lastBackup'))").startswith("2026-10-30"), "la sauvegarde Drive compte comme dernière sauvegarde")
    # ---------- 2. en quittant l'appli
    pg.locator("#hback").click(); pg.wait_for_timeout(400)
    n0=len(calls(pg, "stage")); hide(pg); show(pg)
    check(len(calls(pg, "stage"))==n0, "quitter sans rien changer : rien de préparé")
    pg.evaluate("()=>{ var e=JSON.parse(localStorage.getItem('entries')); e.push({id:3,date:'2026-10-29',marchand:'Pharmacie',montant:12,categorie:'Santé',payePar:'Alex',articles:[]}); localStorage.setItem('entries', JSON.stringify(e)); }"); pg.wait_for_timeout(600)
    pg.reload(); pg.wait_for_timeout(1500)
    hide(pg); G=calls(pg, "stage")
    check(len(G)==n0+1 and G[-1]["n"]==3, "un ticket de plus puis quitter : nouvelle sauvegarde préparée (3 tickets)")
    show(pg); pg.wait_for_timeout(1500)
    # ---------- 3. en attente depuis plus d'1 heure
    pg.evaluate("()=>{ __dv.autoSend=false; __dv.staged=__dv.lastData; __dv.pendingSince=Date.now()-7*3600000; __dv.err='net'; __dvSave(); }")
    hide(pg); show(pg); pg.wait_for_timeout(500)
    t=norm(pg.locator("#app").inner_text())
    check("Pas encore sur Drive" in t and pg.locator("#drvBanX").count()==1, "en attente depuis 7 h : bandeau « Pas encore sur Drive » sur l'accueil")
    r,col=menu_row(pg); check("Drive · en attente" in r and "coral" in col, "menu : « Drive · en attente » en rouge")
    pg.locator("#drvBanX").click(); pg.wait_for_timeout(400)
    check(pg.locator("#drvBanX").count()==0, "bandeau fermé")
    r,col=menu_row(pg); check("en attente" in r, "la ligne du menu reste rouge après la fermeture du bandeau")
    pg.evaluate("()=>{ __dv.pendingSince=Date.now()-20*60000; __dvSave(); }"); show(pg)
    check(pg.locator("#drvBanX").count()==0, "attente de 20 min : pas de bandeau")
    pg.locator("#hmenu").click(); pg.wait_for_timeout(400); pg.locator('.mnsub[data-ms="sauv"]').click(); pg.wait_for_timeout(400)
    pg.locator('.mn-pg .dr-row[data-k="drive"]').click(); pg.wait_for_timeout(700)
    t=norm(pg.locator("#app").inner_text())
    check("En attente" in t and "Android réessaie tout seul" in t and pg.locator("#drvNow").count()==1, "écran : « En attente », « Envoyer maintenant »")
    pg.evaluate("()=>{ __dv.autoSend=true; __dvSave(); }"); pg.locator("#drvNow").click(); pg.wait_for_timeout(4500)
    check("send" in pg.evaluate("()=>__dv.calls") and "À jour" in norm(pg.locator("#app").inner_text()), "« Envoyer maintenant » : envoyée, « À jour »")
    # le réseau revient pendant que l'appli est ouverte : envoi relancé, l'état est relu sans quitter l'appli
    pg.evaluate("()=>{ __dv.autoSend=false; __dv.staged=__dv.lastData; __dv.pendingSince=Date.now()-5*60000; __dvSave(); }"); show(pg)
    r,col=menu_row(pg); check("envoi en cours" in r and "coral" not in col, "envoi en attente depuis 5 min : « envoi en cours » en gris, pas en rouge (%s)"%r)
    n0=len([c for c in pg.evaluate("()=>__dv.calls") if c=="send"])
    pg.evaluate("()=>{ __dv.autoSend=true; __dvSave(); window.dispatchEvent(new Event('online')); }"); pg.wait_for_timeout(25000)
    r,col=menu_row(pg)
    check(len([c for c in pg.evaluate("()=>__dv.calls") if c=="send"])>n0 and "Drive · aujourd'hui" in r and "accent" in col, "réseau revenu, appli ouverte : envoi relancé et la ligne redevient verte toute seule")
    # ---------- 4. compte à reconnecter
    pg.evaluate("()=>{ __dv.err='auth'; __dvSave(); }"); pg.locator("#hback").click(); pg.wait_for_timeout(300); show(pg)
    t=norm(pg.locator("#app").inner_text())
    check("Sauvegarde Drive arrêtée" in t and pg.locator("#drvBanGo").count()==1, "accord Google à redonner : bandeau « Reconnecter »")
    pg.locator("#drvBanGo").click(); pg.wait_for_timeout(1200)
    check(pg.locator(".fy-code").count()==0 and len([c for c in pg.evaluate("()=>__dv.calls") if c=="connect"])>=2, "reconnecter : même clé, pas de nouveau code")
    pg.evaluate("()=>{ __dv.err=''; __dvSave(); }")
    # ---------- 5. Wi-Fi, durées, vérifier, désactiver
    pg.evaluate("()=>{}"); show(pg)
    if not pg.locator("#drvWifi").count():
        pg.locator("#hmenu").click(); pg.wait_for_timeout(400); pg.locator('.mnsub[data-ms="sauv"]').click(); pg.wait_for_timeout(400)
        pg.locator('.mn-pg .dr-row[data-k="drive"]').click(); pg.wait_for_timeout(700)
    pg.locator("#drvWifi").check(); pg.wait_for_timeout(300)
    check(any(s.get("wifi") is True for s in calls(pg, "setup")), "« Wi-Fi seulement » envoyé à Android")
    pg.locator("#drvKeep").click(); pg.wait_for_timeout(300)
    pg.locator('.drv-seg[data-k="keepD"] button[data-v="90"]').click(); pg.locator("#drvKeepOk").click(); pg.wait_for_timeout(500)
    check(any(s.get("keepD")==90 and s.get("keepM")==12 for s in calls(pg, "setup")) and "90 j · 12 mois · 5 ans" in norm(pg.locator("#app").inner_text()), "durées : 90 jours enregistrés")
    pg.locator("#drvVerify").click(); pg.wait_for_timeout(1500)
    t=norm(pg.locator(".sheet-overlay").last.inner_text()) if pg.locator(".sheet-overlay").count() else ""
    check("sauvegarde lisible" in t.lower() and "3 tickets" in t and "1 compte" in t, "Vérifier : la dernière sauvegarde s'ouvre (3 tickets, 1 compte)")
    pg.locator(".sheet-overlay .ui-no").last.click(); pg.wait_for_timeout(300)
    sec=pg.evaluate("()=>JSON.parse(localStorage.getItem('driveSec'))"); kf=calls(pg, "stage")[0]["kf"]
    pg.locator("#drvOff").click(); pg.wait_for_timeout(300); pg.locator(".sheet-overlay .ui-yes").click(); pg.wait_for_timeout(500)
    check(any(s.get("on") is False for s in calls(pg, "setup")) and "Désactivée" in norm(pg.locator("#app").inner_text()), "Désactiver : envoi arrêté")
    r,col=menu_row(pg); check("Drive" not in r, "menu : la ligne redevient la sauvegarde à la main (%s)"%r)
    # ---------- 6. autre téléphone, sauvegardes déjà sur le compte
    p2=page()
    p2.evaluate("k=>{ __dv.connect={ email:'alex.test@gmail.com', count:5, kfs:[k], last:Date.now()-86400000 }; __dvSave(); }", kf)
    p2.locator("#hmenu").click(); p2.wait_for_timeout(400); p2.locator('.mnsub[data-ms="sauv"]').click(); p2.wait_for_timeout(400)
    p2.locator('.mn-pg .dr-row[data-k="drive"]').click(); p2.wait_for_timeout(400); p2.locator("#drvGo").click(); p2.wait_for_timeout(700)
    t=norm(p2.locator(".sheet-overlay").last.inner_text())
    check("sauvegardes trouvées" in t.lower() and "5 sauvegardes" in t and p2.locator(".fy-code").count()==0, "compte avec 5 sauvegardes : le code est demandé, pas de nouveau code")
    p2.locator("#drvCode").fill("AAAA-BBBB-CCCC-DDDD-EEEE-FFFF-GG"); p2.locator("#drvOk").click(); p2.wait_for_timeout(500)
    check("ne correspond pas" in norm(p2.locator("#drvErr").inner_text()), "mauvais code : refusé")
    p2.locator("#drvCode").fill(code.lower()); p2.locator("#drvOk").click(); p2.wait_for_timeout(1500)
    check(p2.evaluate("()=>JSON.parse(localStorage.getItem('driveSec'))")==sec and calls(p2, "stage") and calls(p2, "stage")[0]["kf"]==kf, "bon code (en minuscules) : même clé, sauvegarde préparée")
    # ---------- 7. rappels
    p2.evaluate("()=>{ localStorage.setItem('rappels', JSON.stringify({on:true,h:9,frais:true,vir:true,bud:true,bk:true})); localStorage.setItem('lastBackup', JSON.stringify('2026-10-01T10:00:00.000Z')); }")
    p2.reload(); p2.wait_for_timeout(2000)
    ln=p2.evaluate("()=>window.__ln.map(n=>n.title)")
    check(ln and "Pense à sauvegarder" not in ln, "Drive actif : plus de rappel « 7 jours » (%d rappels)"%len(ln))
    p2.evaluate("()=>{ var e=JSON.parse(localStorage.getItem('entries')); e[0].montant=86; localStorage.setItem('entries', JSON.stringify(e)); }"); p2.reload(); p2.wait_for_timeout(1500)
    hide(p2); G=calls(p2, "stage")
    check(G and G[-1]["remind"] is True, "rappels activés : Android prévient après 24 h sans envoi (remind)")
    # ---------- 8. version Store sans Plus
    p3=page(APP+"?edition=store")
    p3.locator("#hmenu").click(); p3.wait_for_timeout(400); p3.locator('.mnsub[data-ms="sauv"]').click(); p3.wait_for_timeout(400)
    t=norm(p3.locator(".mn-pg").last.inner_text()); check("Google Drive" in t and "✦" not in t, "Store sans Plus : Drive proposé, gratuit (décision du 07/11)")
    p3.locator('.mn-pg .dr-row[data-k="drive"]').click(); p3.wait_for_timeout(400)
    t=norm(p3.locator(".sheet-overlay").last.inner_text()); check("Découvrir Tickets Plus" not in t and p3.locator("#drvGo").count()==1, "Store sans Plus : la présentation de Drive, sans demander Plus")
    # ---------- 9. navigateur
    p4=page(mock=False)
    p4.locator("#hmenu").click(); p4.wait_for_timeout(400); p4.locator('.mnsub[data-ms="sauv"]').click(); p4.wait_for_timeout(400)
    t=norm(p4.locator("body").inner_text()); check("Google Drive" not in t or "Envoie le fichier" in t, "navigateur : pas de sauvegarde Drive")
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
print("\n%d échec(s)"%len(fails)); sys.exit(1 if fails else 0)
