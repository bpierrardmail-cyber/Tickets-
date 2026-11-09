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
    check(pg.locator(".hmode").count()==0 and pg.locator(".rs-hero").count()==1 and pg.locator("#hcPick").count()==0, "l'Accueil est le Résumé : plus de sélecteur ni de tableau de bord")
    t=app(pg)
    check("Il te reste" in t and "31 octobre" in t and pg.locator(".rs-hero").count()==1, "Résumé : « Il te reste … jusqu'au 31 octobre »")
    check("Loisirs : budget dépassé" in t, "Résumé : alerte budget dépassé")
    check("Dernières opérations" in t and "Cinéma Rex" in t and "Salaire" in t, "Résumé : dernières opérations")
    check("Foyer" in t and "Ta part du commun" in t, "Résumé : ligne Foyer")
    check("hidden" not in pg.evaluate("()=>document.getElementById('nav').className"), "Résumé à l'ouverture : la barre des onglets est là")
    pg.locator('.rs-row', has_text="Cinéma Rex").click(); pg.wait_for_timeout(700)
    check(pg.evaluate("()=>state && 1") if False else pg.locator("#f-payer").count()==1, "toucher une opération ouvre le ticket")
    pg.reload(); pg.wait_for_timeout(1300)
    pg.locator('.rs-h button[data-rs="compte"]').click(); pg.wait_for_timeout(700)
    check(norm(pg.locator(".htitle").first.inner_text())=="Opérations", "« Tout voir » → Opérations")
    m=dict(base); m["fyCfg"]={"role":"edit","fid":"F_T","mid":"m1","tok":"T","km":KM,"me":"Marie","owner":"Alex","tabs":["list","communes"],"ed":["list"],"accts":None,"tk":"own","snapT":1}
    m["homeMode"]="dash"   # ancien choix : ignoré
    pm=page(m, code=True)
    t=app(pm)
    check("Ta part du commun" in t and "400" in t and "Il te reste" not in t, "membre : Résumé tourné vers le commun (sa part 400 €)")
    check("Mes derniers tickets" in t and "Mes tickets" in t and "Mon compte" not in t, "membre sans l'onglet Compte : pas de case « Mon compte », ses derniers tickets")
    check(pm.locator(".hmode").count()==0, "membre : pas de sélecteur")
    m2=dict(base); m2["fraisCommuns"]=[dict(base["fraisCommuns"][0], doneMonths={}, jour=31)]
    m2["entries"]=base["entries"]+[{"id":3,"date":"2026-10-28","marchand":"Boulangerie","montant":6.8,"categorie":"Alimentation","payePar":"Marie","articles":[]}]
    m2["fyCfg"]=dict(m["fyCfg"], tabs=["list","communes","compte"], accts=["Alex"])
    pm2=page(m2, code=True); t=app(pm2)
    check("Mon compte" in t and "Fin du mois" in t and pm2.locator(".rs-tiles.t3").count()==1, "membre avec son compte : Mon compte · Fin du mois · Mes tickets")
    check("Prochainement" in t and "Loyer" in t and "400" in t, "membre : prochaines dépenses communes avec sa part")
    check("Boulangerie" in t, "membre : ses derniers tickets")
    pm2.locator('.rs-row', has_text="Boulangerie").click(); pm2.wait_for_timeout(700)
    check(pm2.locator("#f-payer").count()==1, "membre : toucher un ticket l'ouvre")
    m3=dict(base); m3["communParts"]={"Alex":100}; m3["fraisCommuns"]=[]
    m3["entries"]=[{"id":4,"date":"2026-10-28","marchand":"Cinéma","montant":9.5,"categorie":"Loisirs","payePar":"Léo","articles":[]}]
    m3["personnes"]=[{"nom":"Léo"}]
    m3["fyCfg"]=dict(m["fyCfg"], me="Léo", tabs=["list"], accts=[])
    pm3=page(m3, code=True); t=app(pm3)
    check("Mes tickets · octobre" in t and "9,50" in t and "Cinéma" in t, "membre sans compte ni part : ses tickets en haut")
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
print("\n%d échec(s)"%len(fails)); sys.exit(1 if fails else 0)
