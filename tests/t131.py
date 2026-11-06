# Refonte, étape 1 : barre à 5 onglets (Accueil · Opérations · Budget · À venir · Foyer) et un seul « + » (Accueil et Opérations). Données inventées.
# 1. Propriétaire : les 5 onglets, pas de Bourse dans la barre (dans le menu en Perso), titres Opérations / Budget / Foyer.
# 2. « + » : scanner, galerie, saisir, virement reçu / envoyé, frais fixe, importer un relevé ; « Virement reçu » ouvre le formulaire.
# 3. Membre en consultation : pas de « + ». Membre avec seulement l'Accueil en modification : « + » limité aux tickets.
import sys, os, json
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
APP='file://'+ROOT+'/beta/index.html'; API='http://localhost:9'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def norm(t): return t.replace(" "," ").replace("\xa0"," ")
KM="A"*43
base={"askName":False,"devise":"EUR","welcomeSeen":True,"personnes":[{"nom":"Marie"}],
  "comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True}],
  "entries":[{"id":1,"date":"2026-10-12","marchand":"Marché","montant":12,"categorie":"Alimentation","payePar":"Alex","articles":[]}]}
with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    def page(ls, url=APP, code=False):
        c=b.new_context(viewport={'width':412,'height':900}); pg=c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else (r.fulfill(status=200, body=json.dumps({"t":1,"items":[]}), headers={"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}) if r.request.url.startswith(API) else r.abort()))
        pg.goto(url); pg.wait_for_timeout(300)
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
    def tabs(pg): return pg.evaluate("()=>[...document.querySelectorAll('#nav .navi')].filter(b=>b.style.display!=='none').map(b=>b.textContent.trim())")
    def plus(pg):
        pg.locator("#navplus").click(); pg.wait_for_timeout(400)
        ks=pg.evaluate("()=>[...document.querySelectorAll('.sheet-overlay .dr-row')].map(b=>b.getAttribute('data-k'))")
        return ks
    # ---------- 1. propriétaire (Perso : la Bourse passe dans le menu)
    pg=page(base)
    check(tabs(pg)==["Accueil","Opérations","Budget","À venir","Foyer"], "5 onglets : %s" % tabs(pg))
    check(pg.locator('#nav .navi[data-view="bourse"]').count()==0, "pas de Bourse dans la barre")
    pg.locator("#hmenu").click(); pg.wait_for_timeout(300)
    check(pg.locator('.dr-row[data-k="bourse"]').count()==1, "Bourse dans le menu (édition Perso)")
    pg.locator('.dr-row[data-k="bourse"]').click(); pg.wait_for_timeout(600)
    check(pg.evaluate("()=>document.querySelector('.htitle') && document.querySelector('.htitle').textContent")=="Bourse", "menu › Bourse ouvre la Bourse")
    for v,t in [("compte","Opérations"),("depenses","Budget"),("communes","Foyer")]:
        pg.locator('#nav .navi[data-view="%s"]' % v).click(); pg.wait_for_timeout(600)
        check(norm(pg.locator(".htitle").first.inner_text())==t, "titre de l'onglet : %s" % t)
    # ---------- 2. « + » : sur l'Accueil et Opérations seulement, posé sur la barre
    check("noplus" in pg.evaluate("()=>document.getElementById('nav').className"), "pas de « + » sur Foyer")
    pg.locator('#nav .navi[data-view="list"]').click(); pg.wait_for_timeout(600)
    check("noplus" not in pg.evaluate("()=>document.getElementById('nav').className"), "« + » sur l'Accueil")
    ks=plus(pg)
    check(ks==["scan","gal","man","vin","vout","frais","imp"], "« + » du propriétaire : %s" % ks)
    pg.locator('.sheet-overlay .dr-row[data-k="vin"]').click(); pg.wait_for_timeout(600)
    t=norm(pg.locator(".sheet-overlay").last.inner_text()) if pg.locator(".sheet-overlay").count() else ""
    check("virement reçu" in t.lower() and pg.evaluate("()=>document.querySelector('.htitle').textContent")=="Opérations", "« Virement reçu » : formulaire ouvert, sur Opérations (avec le « + »)")
    ps=page(base, APP+"?edition=store")
    check(tabs(ps)==["Accueil","Opérations","Budget","À venir","Foyer"], "Store : les mêmes 5 onglets")
    # ---------- 3. membres
    def mem(role, ed):
        m=dict(base); m["fyCfg"]={"role":role,"fid":"F_T","mid":"m1","tok":"T","km":KM,"me":"Marie","owner":"Alex","tabs":["list","communes"],"ed":ed,"accts":None,"tk":"own","snapT":1}
        return m
    pv=page(mem("view", []), code=True)
    check("noplus" in pv.evaluate("()=>document.getElementById('nav').className"), "membre en consultation : pas de « + »")
    check(tabs(pv)==["Accueil","Budget","À venir","Foyer"], "membre (Accueil + Commun) : onglets selon ses droits %s" % tabs(pv))
    pe=page(mem("edit", ["list"]), code=True)
    check(plus(pe)==["scan","gal","man"], "membre, seulement l'Accueil en modification : « + » limité aux tickets")
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
print("\n%d échec(s)"%len(fails)); sys.exit(1 if fails else 0)
