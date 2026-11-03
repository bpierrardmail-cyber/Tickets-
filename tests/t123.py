# Rappels hors ligne (notifications locales) : Menu › Réglages › Rappels.
# Faux window.Capacitor avec un faux LocalNotifications qui garde les notifications programmées.
# 1. activer : permission demandée, canal privé « tk-rappels », rappels programmés :
#    frais fixe la veille à 9 h, virement à faire le jour même, sauvegarde de plus de 7 jours, budget à 80 % tout de suite (une seule fois) ;
# 2. un frais marqué fait disparaît des rappels ; changer l'heure les reprogramme ;
# 3. toucher un rappel ouvre l'écran annoncé ; 4. dans un navigateur : expliqué, pas activable. Données inventées.
import sys, os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
APP='file://'+ROOT+'/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def norm(t): return t.replace(" "," ").replace("\xa0"," ")
data={"askName":False,"devise":"EUR","personnes":[{"nom":"Marie"}],"lastBackup":"2026-10-20T10:00:00.000Z",
  "comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True}],
  "entries":[{"id":1,"date":"2026-10-12","marchand":"Marché","montant":85,"categorie":"Alimentation","payePar":"Alex","articles":[]}],
  "budgets":{"Alimentation":100},
  "fraisCommuns":[{"id":5,"label":"Loyer","montant":650,"personne":"Commun","recurrent":True,"startMonth":"2026-01","jour":5,"compte":"Alex"},
                  {"id":6,"label":"Box internet","montant":30,"personne":"Commun","recurrent":True,"startMonth":"2026-01","jour":2}],
  "virements":[{"id":9,"person":"Alex","month":"2026-11","label":"Épargne","montant":-200,"done":False,"day":3}]}
MOCK="""
window.__ln=[]; window.__ch=null; window.__perm=0;
window.Capacitor={ isNativePlatform:function(){ return true; }, Plugins:{ LocalNotifications:{
  schedule:function(o){ o.notifications.forEach(function(n){ window.__ln.push(n); }); return Promise.resolve({}); },
  getPending:function(){ return Promise.resolve({ notifications:window.__ln.filter(function(n){ return n.id<900000; }).map(function(n){ return { id:n.id }; }) }); },
  cancel:function(o){ var ids=o.notifications.map(function(n){ return n.id; }); window.__ln=window.__ln.filter(function(n){ return ids.indexOf(n.id)<0; }); return Promise.resolve(); },
  requestPermissions:function(){ window.__perm++; return Promise.resolve({ display:'granted' }); },
  createChannel:function(c){ window.__ch=c; return Promise.resolve(); },
  addListener:function(e, cb){ window.__lnCb=cb; return Promise.resolve({ remove:function(){} }); } } } };
"""
with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    c=b.new_context(viewport={'width':412,'height':900}); c.add_init_script(MOCK)
    pg=c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    pg.goto(APP); pg.wait_for_timeout(300)
    pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); pg.reload(); pg.wait_for_timeout(1500)
    check(pg.evaluate("()=>window.__ln.length")==0, "rappels pas activés : rien de programmé")
    def open_rap():
        pg.locator("#hmenu").click(); pg.wait_for_timeout(400)
        pg.locator('.dr-row[data-k="settings"]').click(); pg.wait_for_timeout(300)
        pg.locator('.sheet-overlay .dr-row[data-k="rappels"]').click(); pg.wait_for_timeout(300)
    def LN(): return pg.evaluate("()=>window.__ln.map(n=>({id:n.id, t:n.title, b:n.body, at:new Date(n.schedule.at).toISOString(), h:new Date(n.schedule.at).getHours(), go:n.extra&&n.extra.go, ch:n.channelId}))")
    # ---------- 1. activer
    open_rap()
    t=norm(pg.locator(".sheet-overlay").last.inner_text())
    check("Activer les rappels" in t and "Budget à 80 %" in t and "Sauvegarde de plus de 7 jours" in t, "écran Rappels : activer, types, heure")
    pg.locator("#rapOn").check(); pg.locator("#rapOk").click(); pg.wait_for_timeout(800)
    L=LN(); [print("  ", x) for x in L]
    ch=pg.evaluate("()=>window.__ch")
    check(pg.evaluate("()=>window.__perm")==1 and ch and ch["id"]=="tk-rappels" and ch["visibility"]==0, "permission demandée, canal « Rappels » privé (rien sur l'écran verrouillé)")
    loyer=[x for x in L if "Loyer" in x["t"]]
    check(loyer and loyer[0]["t"]=="Demain : Loyer" and "650,00 €" in norm(loyer[0]["b"]) and loyer[0]["h"]==9 and pg.evaluate("()=>new Date(window.__ln.find(n=>/Loyer/.test(n.title)).schedule.at).getDate()")==4 and loyer[0]["ch"]=="tk-rappels",
          "Loyer (le 5) : « Demain : Loyer · 650,00 € prélevé · Compte courant » le 4 à 9 h")
    check(any(x["t"]=="Demain : Box internet" for x in L), "Box internet (le 2) : rappel la veille")
    vir=[x for x in L if "Épargne" in x["t"]]
    check(vir and vir[0]["t"].startswith("Virement à faire aujourd'hui") and vir[0]["go"]=="compte", "virement pas fait : rappel le jour même, ouvre Compte")
    check(any(x["t"]=="Pense à sauvegarder" and x["go"]=="backup" for x in L), "sauvegarde du 20/10 : « Pense à sauvegarder »")
    bud=[x for x in L if x["t"].startswith("Budget Alimentation")]
    check(len(bud)==1 and "85 %" in bud[0]["t"] and "Plus que 15,00 €" in norm(bud[0]["b"]) and bud[0]["id"]>=900000, "budget à 85 % : prévenu tout de suite, « Plus que 15,00 € »")
    pg.reload(); pg.wait_for_timeout(2000)
    L=LN(); check(not [x for x in L if x["t"].startswith("Budget")] and any("Loyer" in x["t"] for x in L), "rouvert : rappels reprogrammés, le budget n'est pas annoncé une 2e fois")
    # ---------- 2. frais fait, heure
    pg.evaluate("()=>{ var f=JSON.parse(localStorage.getItem('fraisCommuns')); f[1].doneMonths={'2026-11':true}; localStorage.setItem('fraisCommuns', JSON.stringify(f)); }"); pg.reload(); pg.wait_for_timeout(2000)
    L=LN(); check(not any("Box internet" in x["t"] for x in L) and any("Loyer" in x["t"] for x in L), "Box internet marquée faite : plus de rappel, le Loyer reste")
    open_rap(); pg.locator("#rapH").select_option("18"); pg.locator("#rapOk").click(); pg.wait_for_timeout(800)
    L=[x for x in LN() if x["id"]<900000]
    check(L and all(x["h"]==18 for x in L if x["t"]!="Pense à sauvegarder") and len([x for x in L if "Loyer" in x["t"]])==1, "heure 18 h : tout reprogrammé à 18 h, sans doublon")
    # ---------- 3. toucher un rappel
    pg.evaluate("()=>window.__lnCb({ notification:{ extra:{ go:'budgets' } } })"); pg.wait_for_timeout(600)
    check("Alimentation" in norm(pg.locator("#app").inner_text()) and pg.locator(".avtabs .dpsub.on", has_text="Budgets").count()==1, "rappel de budget touché : Dépenses › Budgets")
    pg.evaluate("()=>window.__lnCb({ notification:{ extra:{ go:'avenir' } } })"); pg.wait_for_timeout(600)
    check("À venir" in norm(pg.locator("header").inner_text()) or "12 mois" in norm(pg.locator("#app").inner_text()), "rappel de prélèvement touché : À venir › 12 mois")
    # désactiver : tout est retiré
    open_rap(); pg.locator("#rapOn").uncheck(); pg.locator("#rapOk").click(); pg.wait_for_timeout(800)
    check(not [x for x in LN() if x["id"]<900000], "désactivés : plus aucun rappel programmé")
    # ---------- 4. navigateur
    c2=b.new_context(viewport={'width':412,'height':900}); p2=c2.new_page(); p2.on('pageerror', lambda e: errs.append(str(e)))
    p2.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    p2.goto(APP); p2.wait_for_timeout(300)
    p2.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); p2.reload(); p2.wait_for_timeout(900)
    p2.locator("#hmenu").click(); p2.wait_for_timeout(400); p2.locator('.dr-row[data-k="settings"]').click(); p2.wait_for_timeout(300)
    p2.locator('.sheet-overlay .dr-row[data-k="rappels"]').click(); p2.wait_for_timeout(300)
    t=norm(p2.locator(".sheet-overlay").last.inner_text())
    check("marchent dans l'appli Android" in t and p2.locator("#rapOn").is_disabled() and p2.locator("#rapOk").count()==0, "navigateur : expliqué, pas activable")
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
print("\n%d échec(s)"%len(fails)); sys.exit(1 if fails else 0)
