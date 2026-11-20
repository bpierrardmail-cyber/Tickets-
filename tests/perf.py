# Mesure de fluidité (20/11) : un grand foyer inventé (12 personnes, 12 comptes, 3 ans de tickets, 40 frais fixes…),
# chaque écran redessiné plusieurs fois, temps moyen de render() ; --profil : les fonctions qui prennent le plus de temps.
# Pas un test (rien n'échoue) : à lancer avant / après un changement qui touche aux calculs.
#   python3 tests/perf.py             temps par écran        python3 tests/perf.py --profil   + profil du plus lent
import sys, os, json, random, subprocess, time
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
sys.path.insert(0, HERE)
import horloge
from playwright.sync_api import sync_playwright
PAGE=os.path.join(ROOT, "beta", "_unit.html")
subprocess.check_call([sys.executable, os.path.join(ROOT, "outils", "build.py"), "--test", PAGE], stdout=subprocess.DEVNULL)

def foyer(seed=7):
    R=random.Random(seed)
    noms=["Alex","Marie","Lucas","Emma","Hugo","Léa","Nathan","Chloé","Louis","Inès","Jules","Manon"]
    months=[]; y,m=2023,11
    while (y,m)<=(2026,10): months.append("%d-%02d"%(y,m)); m+=1; y,m=(y+1,1) if m>12 else (y,m)
    comptes=[{"key":n,"nom":"Compte "+n,"payer":n,"main":i==0} for i,n in enumerate(noms)]
    shops=[("Supermarché","Courses"),("Boulangerie","Courses"),("Pharmacie","Santé"),("Station","Transport"),("Librairie","Loisirs"),("Restaurant","Sorties"),("Bricolage","Maison")]
    arts=["Pain","Lait","Pâtes","Riz","Pommes","Café","Fromage","Yaourts","Eau","Savon","Jus","Beurre","Œufs","Tomates"]
    entries=[]; i=1
    for mk in months:
        for d in range(1,29):
            for _ in range(R.randint(2,5)):
                s,c=R.choice(shops); a=[{"label":x.upper(),"produit":x,"prix":round(R.uniform(0.5,9),2)} for x in R.sample(arts,R.randint(1,6))]
                entries.append({"id":i,"date":"%s-%02d"%(mk,d),"marchand":s,"montant":round(sum(x["prix"] for x in a),2),"categorie":c,"payePar":R.choice(noms[:6]),"articles":a}); i+=1
    frais=[]; virs=[]
    for k in range(40):
        p="Commun" if k<15 else noms[k%12]
        frais.append({"id":100000+k,"label":"Frais %d"%k,"montant":round(R.uniform(8,300),2),"personne":p,"recurrent":True,"startMonth":months[0],
                      "doneMonths":{mk:True for mk in months[:-1]},"split":(k%4==0)})
    for n in noms:
        for mk in months: virs.append({"id":i,"person":n,"month":mk,"label":"Salaire","montant":round(R.uniform(1200,2600),2),"done":mk<months[-1]}); i+=1
    ep=[{"id":200+k,"nom":"Livret %d"%k,"person":noms[k],"vals":{mk:1000+50*j for j,mk in enumerate(months)}} for k in range(8)]
    prov=[{"id":300+k,"nom":"Provision %d"%k,"mensuel":30+10*k,"startMonth":months[6],"noFrais":True,"ou":"ext"} for k in range(8)]
    return {"askName":False,"devise":"EUR","personnes":[{"nom":n} for n in noms],"comptes":comptes,
            "communParts":{n:round(100/12,2) for n in noms},"soldeInit":{n:{months[0]:1000} for n in noms},
            "entries":entries,"fraisCommuns":frais,"virements":virs,"epargne":ep,"provisions":prov,"welcomeSeen":True,"affichage":"detail"}

VUES=[("Accueil","list",None),("Opérations","compte",None),("Tickets","tickets",None),("Épargne","compte","ep"),("Graphiques","compte","graph"),
      ("Budget","articles",None),("Analyse","analyse",None),("À venir · 12 mois","factures","mois"),("Frais fixes","factures","frais"),
      ("Provisions","factures","prov"),("Foyer","communes",None)]
D=foyer(); print("Foyer inventé : %d tickets, %d frais fixes, %d virements, %d comptes" % (len(D["entries"]), len(D["fraisCommuns"]), len(D["virements"]), len(D["comptes"])))
with sync_playwright() as p:
    b=p.chromium.launch(); c=b.new_context(viewport={'width':412,'height':900}); pg=c.new_page()
    pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    pg.goto("file://"+PAGE)
    pg.evaluate("d=>{ localStorage.clear(); for(var k in d) localStorage.setItem(k, JSON.stringify(d[k])); }", D)
    t0=time.time(); pg.reload(); pg.wait_for_function("()=>typeof window.__tkEval==='function'", timeout=60000); print("Démarrage : %.2f s" % (time.time()-t0))
    pg.wait_for_timeout(800)
    res=[]
    for nom, v, sub in VUES:
        js="""(function(){ state.view=%s; %s render(); var t=performance.now(), n=3; for(var i=0;i<n;i++) render(); return (performance.now()-t)/n; })()""" % (
            json.dumps(v), ("state.cptPage=%s;" % json.dumps(sub)) if v=="compte" else ("state.avnSub=%s;" % json.dumps(sub)) if v=="factures" else "")
        ms=pg.evaluate("s=>window.__tkEval(s)", js); res.append((nom, v, sub, ms)); print("%-20s %7.0f ms" % (nom, ms))
    if "--profil" in sys.argv:
        nom, v, sub, _=max(res, key=lambda r: r[3])
        cdp=c.new_cdp_session(pg); cdp.send("Profiler.enable"); cdp.send("Profiler.setSamplingInterval", {"interval":200}); cdp.send("Profiler.start")
        pg.evaluate("s=>window.__tkEval(s)", "(function(){ state.view=%s; %s for(var i=0;i<3;i++) render(); })()" % (json.dumps(v),
            ("state.cptPage=%s;" % json.dumps(sub)) if v=="compte" else ("state.avnSub=%s;" % json.dumps(sub)) if v=="factures" else ""))
        prof=cdp.send("Profiler.stop")["profile"]
        self_t={}; dt=prof.get("timeDeltas",[]); nodes={n["id"]:n for n in prof["nodes"]}
        for sid, d in zip(prof.get("samples",[]), dt):
            cf=nodes[sid]["callFrame"]; fn=cf["functionName"] or ("(anonyme) l.%d" % (cf.get("lineNumber",0)+1) if cf.get("lineNumber",-1)>=0 else "(anonyme)"); self_t[fn]=self_t.get(fn,0)+d
        tot=sum(self_t.values()) or 1
        print("\nProfil de « %s » (temps propre) :" % nom)
        for fn, t in sorted(self_t.items(), key=lambda x: -x[1])[:15]: print("  %-28s %5.1f %%" % (fn, 100*t/tot))
    b.close()
