# Version Store : « ✦ Découvrir Tickets Plus » sur chaque carte de l'accueil, carrousel Tickets Plus (6 cartes, captures de l'appli),
# « Plus tard » ramène à la carte de l'accueil où l'on était ; ligne « ✦ Tickets Plus » du menu ; les boutons ✦ ouvrent le carrousel
# à la bonne carte (Qui doit combien à qui, factures) ; avec Plus, plus de lien. Données inventées.
import sys, os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
APP='file://'+ROOT+'/beta/index.html?edition=store'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def norm(t): return t.replace(" "," ").replace("\xa0"," ")
data={"askName":False,"devise":"EUR","personnes":[{"nom":"Marie"}],
  "comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True}],"communParts":{"Alex":50,"Marie":50},
  "fraisCommuns":[{"id":1,"label":"Loyer","montant":800,"personne":"Commun","recurrent":True,"startMonth":"2026-01"}],"entries":[]}
with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    def open_app(extra, welcome):
        c=b.new_context(viewport={'width':412,'height':900})
        if welcome: c.add_init_script('window.__wlcTest=1')
        pg=c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
        pg.goto(APP); pg.wait_for_timeout(300); d=dict(data); d.update(extra)
        pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", d); pg.reload(); pg.wait_for_timeout(1300)
        return c, pg
    W=lambda pg, sel=".wlc:not(.plus)": norm(pg.locator(sel).inner_text()) if pg.locator(sel).count() else ""
    # ---------- accueil : le lien sur chaque carte
    c, pg = open_app({}, True)
    n=0
    for k in range(4):
        if pg.locator(".wlc:not(.plus) #wlcPlus").count(): n+=1
        if k<3: pg.locator("#wlcNext").click(); pg.wait_for_timeout(150)
    check(n==4, "« ✦ Découvrir Tickets Plus » sur les 4 cartes de l'accueil (%d)" % n)
    pg.locator("#wlcPrev").click(); pg.wait_for_timeout(150)   # 3e carte
    pg.locator("#wlcPlus").click(); pg.wait_for_timeout(300)
    t=W(pg, ".wlc.plus")
    check("Foyer partagé" in t and "✦ Plus" in t and pg.locator(".wlc.plus .wlc-dots i").count()==6 and pg.locator(".wlc.plus .wlc-shot img").count()==1, "carrousel Plus : 6 cartes (Drive gratuit depuis le 07/11), la 1re « Foyer partagé » avec sa capture")
    titres=[]
    for k in range(6):
        titres.append(norm(pg.locator(".wlc.plus .wlc-t").inner_text()).replace("✦ Plus","").strip())
        if pg.locator("#plNext").count(): pg.locator("#plNext").click(); pg.wait_for_timeout(120)
    check(titres==["Foyer partagé","Qui doit combien à qui","Tes factures","Analyse avancée","Widgets","Tout le reste est gratuit"], "cartes : %s" % titres)
    t=W(pg, ".wlc.plus"); check("Prix : bientôt" in t and "Prendre Tickets Plus · bientôt" in t, "dernière carte : « Prix : bientôt », « Prendre Tickets Plus · bientôt »")
    imgs=pg.evaluate("()=>[...document.querySelectorAll('.wlc.plus img')].length")
    pg.locator("#plBuy").click(); pg.wait_for_timeout(300)
    check("arrive bientôt" in norm(pg.locator("body").inner_text()), "« Prendre » : l'achat arrive bientôt")
    pg.locator("#plLater").click(); pg.wait_for_timeout(300)
    check(pg.locator(".wlc.plus").count()==0 and "Importe ton relevé" in W(pg), "« Plus tard » : retour à la carte de l'accueil où l'on était")
    pg.locator("#wlcNext").click(); pg.wait_for_timeout(150); pg.locator("#wlcNext").click(); pg.wait_for_timeout(400)
    check(pg.locator(".wlc").count()==0, "« Commencer » ferme l'accueil")
    # images toutes chargées
    ok=pg.evaluate("""()=>Promise.all(['accueil','scan','releve','avenir','foyer','equilibre','factures','analyse','widgets'].map(n=>new Promise(r=>{ const i=new Image(); i.onload=()=>r(i.naturalWidth===544); i.onerror=()=>r(false); i.src='vitrine/'+n+'.jpg'; })))""")
    check(all(ok), "les 9 captures de beta/vitrine existent (544 × 500) %s" % ok)
    # ---------- menu
    pg.locator("#hmenu").click(); pg.wait_for_timeout(400)
    check(pg.locator('.dr-row[data-k="plus"]').count()==1, "menu : « ✦ Tickets Plus »")
    pg.locator('.dr-row[data-k="plus"]').click(); pg.wait_for_timeout(300)
    check("Foyer partagé" in W(pg, ".wlc.plus"), "menu › Tickets Plus : le carrousel")
    pg.locator("#plLater").click(); pg.wait_for_timeout(200)
    # ---------- boutons ✦
    pg.locator('#nav .navi[data-view="communes"]').click(); pg.wait_for_timeout(500)
    pg.locator("#cbalBuy").click(); pg.wait_for_timeout(300)
    check("Qui doit combien à qui" in W(pg, ".wlc.plus"), "Commun › ✦ : le carrousel à « Qui doit combien à qui »")
    pg.locator("#plLater").click(); pg.wait_for_timeout(200)
    pg.locator('#nav .navi[data-view="factures"]').click(); pg.wait_for_timeout(400)
    pg.locator('.avtabs button[data-av="fact"]').click(); pg.wait_for_timeout(400)
    pg.locator("#fctBuy").click(); pg.wait_for_timeout(300)
    check("Tes factures" in W(pg, ".wlc.plus") and "PDF" in W(pg, ".wlc.plus"), "À venir › Factures › ✦ : le carrousel à « Tes factures »")
    c.close()
    # ---------- avec Plus : plus de lien ni de ligne de menu
    c, pg = open_app({"plusUnlocked":True}, True)
    check(pg.locator(".wlc").count()==1 and pg.locator("#wlcPlus").count()==0, "avec Plus : l'accueil sans lien Tickets Plus")
    pg.locator("#wlcSkip").click(); pg.wait_for_timeout(200)
    pg.locator("#hmenu").click(); pg.wait_for_timeout(400)
    check(pg.locator('.dr-row[data-k="plus"]').count()==0, "avec Plus : pas de ligne « Tickets Plus » dans le menu")
    c.close()
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
print("\n%d échec(s)"%len(fails)); sys.exit(1 if fails else 0)
