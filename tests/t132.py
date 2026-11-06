# Refonte, étape 2 : Accueil à deux vues, Résumé et Tableau de bord (choix gardé). Données inventées.
# 1. Par défaut le Tableau de bord (les graphiques) avec le sélecteur en haut ; « Résumé » : « Il te reste », alertes, dernières opérations, ligne Foyer ; choix gardé après rechargement.
# 2. Résumé : budget dépassé en alerte ; toucher une opération ouvre le ticket ; « Tout voir » → Opérations.
# 3. Membre : Résumé tourné vers le commun (« Ta part du commun »).
import sys, os, json
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
APP='file://'+ROOT+'/beta/index.html'; API='http://localhost:9'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def norm(t): return t.replace(" "," ").replace("\xa0"," ").replace(" "," ")
KM="A"*43
base={"askName":False,"devise":"EUR","welcomeSeen":True,"personnes":[{"nom":"Marie"}],"communParts":{"Alex":50,"Marie":50},
  "comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True}],
  "soldeInit":{"Alex":{"2026-10":1000}},
  "budgets":{"Loisirs":50},
  "virements":[{"id":5,"person":"Alex","month":"2026-10","label":"Salaire","note":"","montant":2000,"day":1,"done":True}],
  "fraisCommuns":[{"id":7,"label":"Loyer","montant":800,"personne":"Commun","recurrent":True,"startMonth":"2026-01","jour":5,"doneMonths":{"2026-10":True}}],
  "entries":[{"id":1,"date":"2026-10-12","marchand":"Cinéma Rex","montant":70,"categorie":"Loisirs","payePar":"Alex","articles":[]},
             {"id":2,"date":"2026-10-20","marchand":"Marché","montant":30,"categorie":"Alimentation","payePar":"Alex","articles":[]}]}
with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    def page(ls, code=False):
        c=b.new_context(viewport={'width':412,'height':900}); pg=c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else (r.fulfill(status=200, body=json.dumps({"t":1,"items":[]}), headers={"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}) if r.request.url.startswith(API) else r.abort()))
        pg.goto(APP); pg.wait_for_timeout(300)
        ls=dict(ls)
        if code:
            h=pg.evaluate("()=>crypto.subtle.digest('SHA-256', new TextEncoder().encode('c2FsdA==:123456')).then(b=>btoa(String.fromCharCode(...new Uint8Array(b))))")
            ls["lockCfg"]={"hash":h,"salt":"c2FsdA==","len":6,"bioId":None}; ls["foyerApi"]=API
        pg.evaluate("d=>{ localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k])); }", ls); pg.wait_for_timeout(200)
        pg.reload(); pg.wait_for_timeout(1300)
        if code:
            for k in "123456": pg.locator('#lockscreen button[data-k="%s"]' % k).click(); pg.wait_for_timeout(60)
            pg.wait_for_timeout(1200)
        return pg
    def app(pg): return norm(pg.locator("#app").inner_text())
    pg=page(base)
    on=pg.evaluate("()=>document.querySelector('.hmode button.on') && document.querySelector('.hmode button.on').textContent")
    check(on=="Tableau de bord" and pg.locator(".rs-hero").count()==0, "par défaut : Tableau de bord, sélecteur en haut")
    # Tableau de bord : plus de puces au-dessus de la carte, ⚙ sous les graphiques, tout tient sans défiler
    check(pg.locator("#manual2").count()==0 and pg.locator("#pvCap").count()==0, "tableau de bord : plus de puces Saisie / tickets")
    check(pg.locator('.pgr[data-pgr=home] .pg-tools #hcPick').count()==1, "tableau de bord : ⚙ à droite des points, sous les graphiques")
    for hh in (900, 760):
        pg.set_viewport_size({'width':412,'height':hh}); pg.wait_for_timeout(500)
        sh=pg.evaluate("()=>[document.documentElement.scrollHeight, innerHeight]")
        check(sh[0]<=sh[1]+1, "tableau de bord : pas de défilement à %d px de haut %s"%(hh, sh))
    pg.set_viewport_size({'width':412,'height':900}); pg.wait_for_timeout(400)
    pg.locator("#hcPick").click(); pg.wait_for_timeout(400)
    check(pg.locator(".sheet-overlay").count()>0, "⚙ ouvre le choix des graphiques")
    pg.reload(); pg.wait_for_timeout(1300)
    pg.locator('.hmode button[data-hm="resume"]').click(); pg.wait_for_timeout(600)
    t=app(pg)
    check("Il te reste" in t and "31 octobre" in t and pg.locator(".rs-hero").count()==1, "Résumé : « Il te reste … jusqu'au 31 octobre »")
    check("Loisirs : budget dépassé" in t, "Résumé : alerte budget dépassé")
    check("Dernières opérations" in t and "Cinéma Rex" in t and "Salaire" in t, "Résumé : dernières opérations")
    check("Foyer" in t and "Ta part du commun" in t, "Résumé : ligne Foyer")
    pg.reload(); pg.wait_for_timeout(1300)
    check(pg.locator(".rs-hero").count()==1, "choix gardé après rechargement")
    check("hidden" not in pg.evaluate("()=>document.getElementById('nav').className"), "Résumé à l'ouverture : la barre des onglets est là")
    pg.locator('.rs-row', has_text="Cinéma Rex").click(); pg.wait_for_timeout(700)
    check(pg.evaluate("()=>state && 1") if False else pg.locator("#f-payer").count()==1, "toucher une opération ouvre le ticket")
    pg.reload(); pg.wait_for_timeout(1300)
    pg.locator('.rs-h button[data-rs="compte"]').click(); pg.wait_for_timeout(700)
    check(norm(pg.locator(".htitle").first.inner_text())=="Opérations", "« Tout voir » → Opérations")
    m=dict(base); m["fyCfg"]={"role":"edit","fid":"F_T","mid":"m1","tok":"T","km":KM,"me":"Marie","owner":"Alex","tabs":["list","communes"],"ed":["list"],"accts":None,"tk":"own","snapT":1}
    m["homeMode"]="resume"
    pm=page(m, code=True)
    t=app(pm)
    check("Ta part du commun" in t and "400" in t and "Il te reste" not in t, "membre : Résumé tourné vers le commun (sa part 400 €)")
    check("Loyer" in t, "membre : dépenses communes du mois")
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
print("\n%d échec(s)"%len(fails)); sys.exit(1 if fails else 0)
