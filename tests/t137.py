# Parcours complet (campagne de test du 06/11) : tous les onglets et sous-onglets, dans toutes les combinaisons
#   version Perso / Store × affichage simple / détaillé × propriétaire / membre en modification / membre en lecture / enfant × 360 / 412 px,
# sur une grande famille inventée (12 personnes, 15 comptes, 6 mois de tickets, frais fixes, virements, épargne, provisions, factures, budgets, groupes).
# À chaque écran : aucune erreur, pas de défilement de côté, pas de « undefined » / « NaN » / « [object » affiché.
import sys, os, json, random
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
APP='file://'+ROOT+'/beta/index.html'; API='http://localhost:9'; fails=[]
FAST='--full' not in sys.argv   # par défaut (run.sh) : un parcours plus court ; « --full » : toutes les combinaisons et les onglets des graphiques
def check(c, m):
    if not c: print("FAIL "+m); fails.append(m)
R=random.Random(7)
P=["Alex","Marie","Léa","Tom","Jules","Inès","Hugo","Chloé","Nina","Paul","Zoé","Max"]
months=["2026-05","2026-06","2026-07","2026-08","2026-09","2026-10"]
comptes=[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True}]
for i,p in enumerate(P[1:]):
    comptes.append({"key":"c"+str(i),"nom":"Compte de "+p,"payer":p})
comptes.append({"key":"joint","nom":"Compte joint très long pour voir si ça déborde","payer":"Alex"})
comptes.append({"key":"livret2","nom":"Compte pro","payer":"Marie"})
cats=["Alimentation","Restaurant","Carburant","Maison","Santé","Transport","Loisirs","Bar","Multimédia","prêt à porter","Pharmacie","Hygiène et soins","Autre"]
E=[]; n=1
for m in months:
    for k in range(40):
        n+=1; who=R.choice(P); c=R.choice(cats)
        arts=[]
        if k%5==0: arts=[{"label":"Lait","prix":1.05,"produit":"Lait"},{"label":"Pain","prix":2.2,"produit":"Pain"},{"label":"Truc partagé","prix":4,"produit":"","commun":True}]
        amt=round(sum(a["prix"] for a in arts),2) if arts else round(R.uniform(3,180),2)
        E.append({"id":n,"date":m+"-%02d"%R.randint(1,28),"marchand":R.choice(["Intermarché","Station Fictive","Pizzeria du Port","Pharmacie Centrale","Magasin au nom vraiment très très long pour déborder"]),"montant":amt,"categorie":c,"payePar":who,"articles":arts})
F=[{"id":1,"label":"Loyer","montant":1200,"personne":"Commun","recurrent":True,"startMonth":"2026-01","jour":5},
   {"id":2,"label":"Électricité","montant":140,"personne":"Commun","recurrent":True,"startMonth":"2026-01","jour":12,"split":True},
   {"id":3,"label":"Internet","montant":39.99,"personne":"Commun","recurrent":True,"startMonth":"2026-01","jour":20}]
for i,p in enumerate(P): F.append({"id":10+i,"label":"Téléphone "+p,"montant":9.99+i,"personne":p,"recurrent":True,"startMonth":"2026-03","jour":(i%27)+1})
V=[]; vid=500
for m in months:
    for i,a in enumerate(comptes[:13]):
        vid+=1; V.append({"id":vid,"person":a["key"],"month":m,"label":"Salaire","montant":1500+i*100,"done":True,"day":1})
data={"askName":False,"devise":"EUR","welcomeSeen":True,"plusUnlocked":True,"cats":cats,"personnes":[{"nom":p} for p in P[1:]],"comptes":comptes,
  "communParts":{p:round(100.0/len(P),2) for p in P},"entries":E,"fraisCommuns":F,"virements":V,
  "soldeInit":{"Alex":{"2026-05":2500}},"budgets":{"Transport":300,"Alimentation":600,"Bar":40},"budgetsP":{"Marie":{"Loisirs":50}},
  "epargne":[{"id":301,"nom":"Livret A","owner":"Alex","vals":{"2026-08":4000,"2026-10":4300}},{"id":302,"nom":"LDDS","owner":"Marie","vals":{"2026-10":2100}}],
  "provisions":[{"id":11,"nom":"Taxe foncière","mensuel":80,"soldeInitial":400,"startMonth":"2026-05","prelevements":[],"echeance":10,"prevu":960}],
  "factures":[{"id":600+i,"four":"Énergie Fictive","type":"elec","date":d,"montant":a,"prelev":d,"src":"pdf","conso":round(a*4)} for i,(d,a) in enumerate([("2026-03-14",120.5),("2026-05-14",95.2),("2026-07-14",70.1),("2026-09-14",82.3)])],
  "groupes":[{"id":1,"nom":"Week-end","membres":P[:5],"dep":[{"id":1,"date":"2026-10-10","label":"Gîte","montant":400,"payePar":"Alex"}],"rembs":[]}],
  "liquideMois":{"Alex":{"2026-10":45}},"homeCharts":["analyse:mois","articles:prod","epargne","provisions","compte:solde","communes:rep","analyse:pay","bourse"]}
KM="A"*43
roles={
  "owner":None,
  "membre":{"role":"edit","fid":"F_T","mid":"m1","tok":"T","km":KM,"me":"Marie","owner":"Alex","tabs":["list","articles","analyse","compte","factures","communes"],"ed":["list","compte","communes"],"accts":None,"tk":"all","snapT":1},
  "lecture":{"role":"view","fid":"F_T","mid":"m2","tok":"T","km":KM,"me":"Léa","owner":"Alex","tabs":["list","analyse","communes"],"ed":[],"accts":[],"tk":"own","snapT":1},
  "enfant":{"role":"view","fid":"F_T","mid":"m3","tok":"T","km":KM,"me":"Tom","owner":"Alex","tabs":["list"],"ed":[],"accts":[],"tk":"own","snapT":1}}
BAD=["undefined","NaN","[object","Infinity"]
nscreens=0
with sync_playwright() as p:
    b=p.chromium.launch()
    def run(edition, aff, role, width):
        global nscreens
        c=b.new_context(viewport={'width':width,'height':860}); pg=c.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('dialog', lambda d: d.dismiss())
        pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else (r.fulfill(status=200, body=json.dumps({"t":1,"items":[]}), headers={"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}) if r.request.url.startswith(API) else r.abort()))
        url=APP+("?edition=store" if edition=="store" else "")
        pg.goto(url); pg.wait_for_timeout(300)
        ls=dict(data); ls["affichage"]=aff
        cfg=roles[role]
        if cfg:
            h=pg.evaluate("()=>crypto.subtle.digest('SHA-256', new TextEncoder().encode('c2FsdA==:123456')).then(b=>btoa(String.fromCharCode(...new Uint8Array(b))))")
            ls["lockCfg"]={"hash":h,"salt":"c2FsdA==","len":6,"bioId":None}; ls["foyerApi"]=API; ls["fyCfg"]=cfg
        pg.evaluate("d=>{ localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k])); }", ls); pg.reload(); pg.wait_for_timeout(1300)
        if cfg:
            for k in "123456": pg.locator('#lockscreen button[data-k="%s"]' % k).click(); pg.wait_for_timeout(50)
            pg.wait_for_timeout(1000)
        tag="%s/%s/%s/%d"%(edition, aff, role, width)
        def closeSheets():
            for _ in range(4):
                if pg.locator(".sheet-overlay").count()==0: break
                pg.keyboard.press("Escape"); pg.wait_for_timeout(150)
                if pg.locator(".sheet-overlay").count():
                    pg.evaluate("()=>{ document.querySelectorAll('.sheet-overlay').forEach(x=>x.remove()); }")
        def inspect(where):
            global nscreens
            nscreens+=1
            pg.wait_for_timeout(250)
            sw=pg.evaluate("()=>document.documentElement.scrollWidth")
            check(sw<=width+1, "%s · %s : défilement de côté (%d px)"%(tag, where, sw))
            t=pg.locator("#app").inner_text()
            for w in BAD:
                if w in t:
                    i=t.find(w); check(False, "%s · %s : « %s » affiché : …%s…"%(tag, where, w, t[max(0,i-40):i+30].replace("\n"," ")))
        navs=pg.evaluate("()=>[].filter.call(document.querySelectorAll('#nav .navi[data-view]'), b=>b.offsetParent!==null && getComputedStyle(b).display!=='none').map(b=>b.getAttribute('data-view'))")
        check(len(navs)>=1, "%s : barre des onglets"%tag)
        for v in navs:
            closeSheets()
            pg.locator('#nav .navi[data-view="%s"]'%v).click(); pg.wait_for_timeout(450)
            if v=="list":
                for hm in ["resume","dash"]:
                    if pg.locator('.hmode button[data-hm="%s"]'%hm).count(): pg.locator('.hmode button[data-hm="%s"]'%hm).click(); pg.wait_for_timeout(400); inspect("Accueil "+hm)
                continue
            inspect(v)
            subs=pg.locator('.avtabs button').count()
            for i in range(subs):
                closeSheets()
                bt=pg.locator('.avtabs button').nth(i)
                if not bt.is_visible(): continue
                lbl=bt.inner_text(); bt.click(); pg.wait_for_timeout(400); inspect(v+" › "+lbl)
                if FAST: continue
                tabs=pg.locator('.thero .cch-tabs button').count()
                for j in range(min(tabs, 5)):
                    tb=pg.locator('.thero .cch-tabs button').nth(j)
                    if tb.is_visible(): tl=tb.inner_text(); tb.click(); pg.wait_for_timeout(300); inspect(v+" › "+lbl+" › "+tl)
            if v=="compte" and pg.locator("#acctSel").count():
                pg.locator("#acctSel").click(); pg.wait_for_timeout(300); inspect("liste des comptes")
                if pg.locator('.sheet-overlay .acrw[data-acct="__all"]').count():
                    pg.locator('.sheet-overlay .acrw[data-acct="__all"]').click(); pg.wait_for_timeout(500); inspect("tous les comptes")
                closeSheets()
        # fiche d'un nouveau ticket, menu, aide
        closeSheets()
        if pg.locator('#nav .navi[data-view="list"]').count():
            pg.locator('#nav .navi[data-view="list"]').click(); pg.wait_for_timeout(300)
        if pg.locator("#navplus").is_visible():
            pg.locator("#navplus").click(); pg.wait_for_timeout(300); inspect("feuille +")
            if pg.locator('.sheet-overlay .dr-row[data-k="man"]').count():
                pg.locator('.sheet-overlay .dr-row[data-k="man"]').click(); pg.wait_for_timeout(500)
                if pg.locator('#chips .chip[data-cat="Transport"]').count(): pg.locator('#chips .chip[data-cat="Transport"]').click(); pg.wait_for_timeout(300)
                inspect("fiche d'un ticket")
                if pg.locator("#cancel").count(): pg.locator("#cancel").click(); pg.wait_for_timeout(300)
            closeSheets()
        pg.locator("#hmenu").click(); pg.wait_for_timeout(300)
        if pg.locator('.dr-row[data-k="aide"]').count(): pg.locator('.dr-row[data-k="aide"]').click(); pg.wait_for_timeout(500); inspect("aide")
        check(not errs, "%s : erreurs %s"%(tag, errs[:3]))
        c.close()
    combos=[]
    for ed in ["perso","store"]:
        for aff in ["simple","detail"]:
            for role in roles:
                for w in [412, 360]:
                    if FAST and not ((role=="owner" and w==412) or (role=="owner" and ed=="perso" and aff=="simple") or (w==412 and ed=="perso" and aff=="simple")): continue
                    combos.append((ed, aff, role, w))
    for cb in combos:
        try: run(*cb)
        except Exception as ex: check(False, "%s : %s"%("/".join(map(str,cb)), str(ex).split("\n")[0][:200]))
    b.close()
print("%d écrans vus, %d combinaisons" % (nscreens, len(combos)))
print("\n%d échec(s)"%len(fails)); sys.exit(1 if fails else 0)
