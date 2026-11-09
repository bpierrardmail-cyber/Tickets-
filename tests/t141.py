# Parcours d'affichage (07/11, après la fenêtre coupée vue par Benoît) : chaque écran et chaque fenêtre, à plusieurs tailles d'écran
# (320×568, 360×640, 412×915, paysage 915×412, tablette 800×1280), sur une grande famille inventée (celle de t137, plus 40 catégories
# aux noms longs et un ticket de 25 articles). À chaque écran, en haut puis en bas de page, audit_affichage.js cherche :
# contenu coupé sans défilement, texte qui sort de son bouton, élément hors de l'écran, fenêtre qui ne défile pas, bouton caché.
# « python3 t141.py » : parcours court (3 combinaisons) ; « --all » : 15 ; « --full » : toutes les tailles et tous les rôles ; « --shots DOSSIER » : une capture par défaut.
import sys, os, json
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
sys.argv_keep=list(sys.argv)
src=open(os.path.join(HERE,'t137.py'),encoding='utf-8').read()
sys.argv=[sys.argv[0]]; exec(src.split("BAD=")[0]); sys.argv=sys.argv_keep
FULL='--full' in sys.argv
QUICK=not FULL and '--all' not in sys.argv   # par défaut (run.sh, 400 s) : 3 combinaisons ; « --all » : 15 ; « --full » : toutes
SHOTS=sys.argv[sys.argv.index('--shots')+1] if '--shots' in sys.argv else None
AUDIT=open(os.path.join(HERE,'audit_affichage.js'),encoding='utf-8').read()
fails=[]
# plus de catégories, en arbre, avec des noms longs ; un ticket de 25 articles ; la fenêtre « rangées » à l'ouverture
mains=["Courses","Sorties","Transport","Maison","Santé","Loisirs","Shopping","Enfants","Animaux","Autre"]
subs={"Courses":["Alimentation","Hygiène et soins","Fruits et légumes de saison","Boissons","Entretien de la maison","Surgelés"],"Sorties":["Restaurant","Bar","Cinéma et spectacles"],
  "Transport":["Carburant","Péage","Parking","Entretien du véhicule et contrôle technique","Train"],"Maison":["Bricolage","Jardin","Décoration","Électroménager"],
  "Santé":["Pharmacie","Médecin","Dentiste","Optique"],"Loisirs":["Sport","Livres","Jeux vidéo","Voyages et vacances"],"Shopping":["Multimédia","prêt à porter","Chaussures"],
  "Enfants":["École et cantine","Jouets","Activités extrascolaires du mercredi"],"Animaux":["Croquettes","Vétérinaire"],"Autre":["Cadeaux"]}
cats2=list(mains); par={}
for m,l in subs.items():
    for x in l: cats2.append(x); par[x]=m
data["cats"]=cats2; data["catParent"]=par; data["familles"]=cats2; data["taxoV2"]=2; data["taxoV3"]=3; data["taxoV4"]=4
for i,e in enumerate(data["entries"]): e["categorie"]=cats2[10+(i%len(par))]
big=[{"label":"ARTICLE N°%d AU LIBELLÉ TRÈS LONG POUR VOIR"%k,"prix":1.5+k,"produit":cats2[10+k%len(par)]} for k in range(25)]
data["entries"].append({"id":99999,"date":"2026-10-29","marchand":"Hypermarché Fictif de la zone commerciale du Grand Ouest","montant":round(sum(a["prix"] for a in big),2),"categorie":"Alimentation","payePar":"Alex","articles":big})
data["budgets"]={"Transport":300,"Alimentation":600,"Bar":40,"Entretien du véhicule et contrôle technique":90,"Activités extrascolaires du mercredi":45}
data["catMigShow"]=True
problems={}   # signature → {kind, sig, txt, extra, where:[…]}
nscreens=0
def note(tag, where, lst, pg):
    for x in lst:
        k=x["kind"]+"|"+x["sig"]
        if k not in problems:
            problems[k]=dict(x, where=[])
            if SHOTS:
                try: pg.screenshot(path=os.path.join(SHOTS, "%03d-%s.png"%(len(problems), x["kind"])))
                except Exception: pass
        if len(problems[k]["where"])<6: problems[k]["where"].append(tag+" · "+where)
with sync_playwright() as p:
    b=p.chromium.launch()
    def run(edition, aff, role, w, h):
        global nscreens
        c=b.new_context(viewport={'width':w,'height':h}, has_touch=True); c.add_init_script(AUDIT+";window.__catMigTest=true;")
        pg=c.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.dismiss())
        pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else (r.fulfill(status=200, body=json.dumps({"t":1,"items":[]}), headers={"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}) if r.request.url.startswith(API) else r.abort()))
        pg.goto(APP+("?edition=store" if edition=="store" else "")); pg.wait_for_timeout(300)
        ls=dict(data); ls["affichage"]=aff; cfg=roles[role]
        if cfg:
            hh=pg.evaluate("()=>crypto.subtle.digest('SHA-256', new TextEncoder().encode('c2FsdA==:123456')).then(b=>btoa(String.fromCharCode(...new Uint8Array(b))))")
            ls["lockCfg"]={"hash":hh,"salt":"c2FsdA==","len":6,"bioId":None}; ls["foyerApi"]=API; ls["fyCfg"]=cfg; ls.pop("catMigShow", None)
        pg.evaluate("d=>{ localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k])); }", ls); pg.reload(); pg.wait_for_timeout(1300)
        tag="%s/%s/%s/%dx%d"%(edition, aff, role, w, h)
        def inspect(where):
            global nscreens
            nscreens+=1; pg.wait_for_timeout(250)
            sw=pg.evaluate("()=>document.documentElement.scrollWidth")
            if sw>w+1: note(tag, where, [{"kind":"page-large","sig":"html","txt":"","extra":"%d px pour %d"%(sw,w)}], pg)
            note(tag, where, pg.evaluate("()=>__audit('top')"), pg)
            # en bas de la page, puis en bas de la fenêtre ouverte
            pg.evaluate("()=>{ window.scrollTo(0, document.documentElement.scrollHeight); document.querySelectorAll('.sheet, .drawer, .wlc .wlc-card, .wlc').forEach(function(x){ x.scrollTop=x.scrollHeight; }); }"); pg.wait_for_timeout(200)
            note(tag, where+" (en bas)", pg.evaluate("()=>__audit('bottom')"), pg)
            pg.evaluate("()=>{ window.scrollTo(0,0); document.querySelectorAll('.sheet, .drawer').forEach(function(x){ x.scrollTop=0; }); }")
        def closeAll():
            for _ in range(5):
                if pg.locator(".sheet-overlay, .drawer-ov, .wlc").count()==0: break
                pg.keyboard.press("Escape"); pg.wait_for_timeout(120)
                pg.evaluate("()=>{ document.querySelectorAll('.sheet-overlay, .drawer-ov, .wlc').forEach(x=>x.remove()); }")
        def click(sel, wait=400):
            l=pg.locator(sel)
            if l.count()==0: return False
            try: l.first.scroll_into_view_if_needed(timeout=2000); l.first.click(timeout=3000)
            except Exception:
                try: pg.evaluate("s=>{ var x=document.querySelector(s); if(x) x.click(); }", sel)
                except Exception: return False
            pg.wait_for_timeout(wait); return True
        def nav(v): closeAll(); return click('#nav .navi[data-view="%s"]'%v, 500)
        if cfg:
            inspect("écran du code")
            for k in "123456": pg.locator('#lockscreen button[data-k="%s"]' % k).click(); pg.wait_for_timeout(50)
            pg.wait_for_timeout(1000)
        else:
            if pg.locator(".sheet-overlay").count(): inspect("fenêtre « catégories rangées »")
        closeAll()
        navs=pg.evaluate("()=>[].filter.call(document.querySelectorAll('#nav .navi[data-view]'), b=>b.offsetParent!==null).map(b=>b.getAttribute('data-view'))")
        for v in navs:
            nav(v)
            if v=="list":
                for hm in ["resume","dash"]:
                    if click('.hmode button[data-hm="%s"]'%hm): inspect("Accueil "+hm)
                if click("#hcPick"): inspect("choix des graphiques"); closeAll()
                continue
            inspect(v)
            n=pg.locator('.avtabs button').count()
            for i in range(n):
                closeAll(); bt=pg.locator('.avtabs button').nth(i)
                if not bt.is_visible(): continue
                lbl=bt.inner_text().strip(); bt.click(); pg.wait_for_timeout(450); inspect(v+" › "+lbl)
                if v=="depenses" and "Produits" in lbl and click("#artprod", 600): inspect("Budget › Produits › Catégories")
                if v=="depenses" and "Budget" in lbl and click("#budEdit"): inspect("modifier les budgets"); closeAll()
                if v=="factures" and pg.locator(".fct-card, .fcard, [data-fk]").count() and click(".fct-card, .fcard, [data-fk]", 600): inspect("détail d'un fournisseur"); nav(v)
            if v=="compte":
                closeAll(); click('.avtabs button')
                if click("#acctSel"): inspect("liste des comptes"); closeAll()
                if click("#cptGear"): inspect("roue du compte"); closeAll()
                if click("#opsQBtn"): inspect("recherche ouverte")
                if click(".ops-open[data-k='t'], .entry[data-id]", 600): inspect("un ticket ouvert"); click("#cancel"); nav(v)
            if v=="communes":
                if click("#comPartsB"): inspect("parts du foyer"); closeAll()
                if click(".grp-card, [data-grp]", 600): inspect("un groupe"); nav(v)
        # « + », fiche d'un ticket, ticket de 25 articles
        nav("list")
        if pg.locator("#navplus").is_visible():
            click("#navplus", 300); inspect("feuille +")
            if click('.sheet-overlay .dr-row[data-k="man"]', 600):
                inspect("fiche d'un ticket vide")
                if click("#catMore"): inspect("fiche · toutes les catégories")
                if click('#chips .chip[data-cat="Transport"]'): inspect("fiche · sous-catégories de Transport")
                if click("#fopt"): inspect("fiche · options")
                click("#cancel")
        closeAll()
        if role in ("owner","membre"):
            pg.evaluate("()=>{ window.__open && window.__open(99999); }")
            nav("compte")
            if click('.avtabs button:has-text("Tickets")', 500) and click('.entry[data-id="99999"]', 700): inspect("ticket de 25 articles"); click("#cancel")
        # menu et tout ce qu'il ouvre
        nav("list")
        if click("#hmenu", 400):
            for ms in ("gerer","sauv","regl","aide"):
              click('.mnsub[data-ms="%s"]'%ms, 300); inspect("menu · "+ms)
              keys=pg.evaluate("()=>[].map.call(document.querySelectorAll('.mn-pg .dr-row[data-k]'), b=>b.getAttribute('data-k'))")
              for k in keys:
                if k in ("pdf","demo","restore","lock","full","data","rdrive","undo","perso","drive","backup"): continue
                closeAll(); nav("list"); click("#hmenu", 400); click('.mnsub[data-ms="%s"]'%ms, 300)
                if click('.mn-pg .dr-row[data-k="%s"]'%k, 700):
                    inspect("menu › "+k)
                    if k=="plus":
                        for _ in range(6):
                            if not click("#wlcNext", 400): break
                            inspect("Tickets Plus (suite)")
                    if k=="aide" and click("#aideWlc", 600):
                        inspect("accueil en diapos")
                        for _ in range(5):
                            if not click("#wlcNext", 400): break
                            inspect("accueil en diapos (suite)")
        check(not errs, "%s : erreurs %s"%(tag, errs[:3]))
        c.close()
    sizes=[(320,568),(360,640),(412,915),(915,412),(800,1280)]
    combos=[]
    if QUICK: sizes=[(320,568),(915,412)]
    for (w,h) in sizes: combos.append(("perso","simple","owner",w,h))
    if QUICK: combos.append(("perso","simple","membre",360,640))
    else:
        for (w,h) in [(320,568),(412,915)]: combos+= [("perso","detail","owner",w,h),("store","simple","owner",w,h),("perso","simple","membre",w,h)]
        combos+=[("perso","simple","lecture",360,640),("perso","simple","enfant",360,640),("perso","simple","membre",915,412),("store","simple","owner",915,412)]
    if FULL:
        for (w,h) in sizes:
            for ed in ["perso","store"]:
                for aff in ["simple","detail"]:
                    for role in roles:
                        if (ed,aff,role,w,h) not in combos: combos.append((ed,aff,role,w,h))
    for cb in combos:
        try: run(*cb)
        except Exception as ex: check(False, "%s : %s"%("/".join(map(str,cb)), str(ex).split("\n")[0][:200]))
    b.close()
for k,x in sorted(problems.items()):
    check(False, "%s · %s «%s» %s\n       vu : %s"%(x["kind"], x["sig"], x["txt"][:40], x["extra"], " | ".join(x["where"][:3])))
print("%d écrans vus, %d combinaisons, %d défaut(s) distinct(s)"%(nscreens, len(combos), len(problems)))
print("\n%d échec(s)"%len(fails)); sys.exit(1 if fails else 0)
