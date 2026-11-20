# Tests rapides (20/11) : les fonctions de l'appli appelées directement, sans passer par l'écran.
# Une copie de test de l'appli (outils/build.py --test beta/_unit.html, jamais servie ni envoyée) expose window.__tkEval :
# chaque fichier tests/unit/*.js est exécuté DANS l'appli (il voit parseTicket, provState, fraisCommuns…), page neuve à chaque fichier.
# Dans un fichier : T("ce qui est vérifié", function(){ return condition_ou_message; }) ; eq(obtenu, attendu) ; near(a, b) ;
# NOM.json à côté de NOM.js = données mises dans l'appli (localStorage) avant le chargement.
# U = données préparées ici (tickets inventés passés par une imitation de ML Kit). Données inventées seulement.
#   python3 tests/unit/run.py            tous les fichiers        python3 tests/unit/run.py lecture   un seul
import sys, os, json, random, subprocess, glob, time
HERE=os.path.dirname(os.path.abspath(__file__)); TESTS=os.path.dirname(HERE); ROOT=os.path.dirname(TESTS)
sys.path.insert(0, TESTS)
import horloge
from playwright.sync_api import sync_playwright
PAGE=os.path.join(ROOT, "beta", "_unit.html")
subprocess.check_call([sys.executable, os.path.join(ROOT, "outils", "build.py"), "--test", PAGE], stdout=subprocess.DEVNULL)
def mlkit(text, seed):   # même imitation de ML Kit que t112
    rows=[l for l in text.split("\n") if l.strip()]; out=[]; rnd=random.Random(seed); W=1000
    for r,row in enumerate(rows):
        parts=[q for q in row.split("  ") if q.strip()]; y=80+r*24
        for i,t in enumerate(parts):
            t=t.strip(); w=len(t)*11; x=60 if i==0 else (W-60-w if i==len(parts)-1 else 60+(W-120)*i/(len(parts)-1)-w/2)
            out.append({"t":t,"p":[round(v+rnd.uniform(-1,1)) for v in (x,y,x+w,y,x+w,y+18,x,y+18)]})
    rnd.shuffle(out); return {"lines":out, "width":W, "height":80+len(rows)*24+80}
C=json.load(open(os.path.join(TESTS,"donnees","tickets_fictifs.json"), encoding="utf-8"))
U={"tickets":[{"res":mlkit(t["texte"], i), "texte":t["texte"], "attendu":t["attendu"]} for i,t in enumerate(C)]}
PRE="""(function(){ var R=[], U=window.__U;
  function T(n, f){ var t0=Date.now(); try{ var v=f(); R.push([n, v===true, v===true?"":String(v)]); }catch(e){ R.push([n, false, "exception : "+(e&&e.message)]); } }
  function eq(a, b){ var x=JSON.stringify(a), y=JSON.stringify(b); return x===y ? true : "attendu "+y+", obtenu "+x; }
  function near(a, b, tol){ return Math.abs(Number(a)-Number(b))<=(tol||0.005) ? true : "attendu "+b+", obtenu "+a; }
"""
POST="\nreturn R; })()"
want=sys.argv[1:]
files=[f for f in sorted(glob.glob(os.path.join(HERE, "*.js"))) if not want or os.path.basename(f)[:-3] in want]
fails=0; n=0; t0=time.time()
with sync_playwright() as p:
    b=p.chromium.launch(); c=b.new_context(viewport={'width':412,'height':900})
    c.add_init_script("window.__U="+json.dumps(U)+";")
    pg=c.new_page(); errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    for f in files:
        fx=f[:-3]+".json"; D=json.load(open(fx, encoding="utf-8")) if os.path.exists(fx) else {}   # données du fichier (même nom, .json)
        pg.goto("file://"+PAGE); pg.evaluate("d=>{ localStorage.clear(); for(var k in d) localStorage.setItem(k, JSON.stringify(d[k])); }", D); pg.reload(); pg.wait_for_function("()=>typeof window.__tkEval==='function'", timeout=10000)
        R=pg.evaluate("s=>window.__tkEval(s)", PRE+open(f, encoding="utf-8").read()+POST)
        print("— "+os.path.basename(f))
        for name, ok, msg in R:
            n+=1
            if ok: print("OK   "+name)
            else: fails+=1; print("FAIL "+name+" · "+msg)
    if errs: fails+=1; print("FAIL erreurs JS : "+"; ".join(errs[:3]))
    b.close()
print("\n%d vérifications, %d échec(s), %.1f s" % (n, fails, time.time()-t0))
sys.exit(1 if fails else 0)
