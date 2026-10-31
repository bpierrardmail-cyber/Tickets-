# La Bourse : une ligne automatique de l'épargne, comptée une fois (liée ou non), « dont Bourse »
import sys, os, re, json, copy
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
SP=(sys.argv[1] if len(sys.argv)>1 else HERE); APP='file://'+ROOT+'/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def norm(t): return t.replace(" "," ").replace("\xa0"," ")
BV={"2026-05":11000,"2026-06":11400,"2026-07":11900,"2026-08":11700,"2026-09":12100,"2026-10":12340}
base={"askName":False,"devise":"EUR","personnes":[],
  "comptes":[{"key":"Benoit","nom":"Compte courant","payer":"Benoit","main":True}],
  "soldeInit":{"Benoit":{"2026-10":412.30}},
  "bourse":[{"id":501,"nom":"PEA","vals":{m:{"valeur":v,"capital":10000} for m,v in BV.items()}}],
  "epargne":[{"id":301,"nom":"Livret A","vals":{"2026-05":16800,"2026-06":16900,"2026-07":17000,"2026-08":17100,"2026-09":17200,"2026-10":17276.90}},
             {"id":302,"nom":"Mon PEA","bourseLink":True,"vals":dict(BV)}],
  "entries":[]}
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={'width':412,'height':900}).new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    pg.goto(APP); pg.wait_for_timeout(300)
    def load(d, url=APP):
        pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", d); pg.goto(url); pg.wait_for_timeout(1000)
    def ls(k): return pg.evaluate("k=>JSON.parse(localStorage.getItem(k))", k)
    def hero(): return norm(pg.locator("#heroCpt").inner_text()) if pg.locator("#heroCpt").count() else ""
    def ep_page():
        pg.locator('#nav .navi[data-view="compte"]').click(); pg.wait_for_timeout(600)
        pg.locator('.avtabs .cpsub[data-cp="ep"]').click(); pg.wait_for_timeout(600)
        return norm(pg.locator("#app").inner_text())
    # A. déjà liée (comme Benoît)
    load(base); h=hero(); print("  Accueil :", h.replace("\n"," | "))
    check("29 616,90" in h and "dont Bourse 12 340" in h, "Accueil : Épargne 29 616,90 dont Bourse 12 340")
    t=ep_page(); print("  Épargne :", t[:500].replace("\n"," | "))
    check("dont Bourse 12 340" in t and "automatique" in t and "suit l'onglet Bourse" in t, "page Épargne : « dont Bourse », ligne automatique")
    check(pg.locator(".epbourse button").count()==0 and pg.locator(".eplink").count()==0, "plus de bouton 🔗 ni de ✎ sur la ligne Bourse")
    check(pg.locator(".thero svg polyline[style*='dasharray']").count()==1, "graphique : la Bourse en pointillés")
    pg.screenshot(path=os.path.join(SP,"t81_ep.png"), full_page=True)
    pg.locator(".epbourse").click(); pg.wait_for_timeout(600)
    check(pg.evaluate("()=>document.querySelector('#nav .navi.on') && document.querySelector('#nav .navi.on').getAttribute('data-view')")=="bourse", "toucher la ligne Bourse ouvre l'onglet Bourse")
    # B. pas liée : la ligne est créée toute seule
    d=copy.deepcopy(base); d["epargne"]=[d["epargne"][0]]
    load(d); E=ls("epargne"); print("  épargne :", [(c["nom"], c.get("bourseLink"), c["vals"]) for c in E])
    check(len(E)==2 and E[1].get("bourseLink") and E[1]["nom"]=="Bourse" and abs(E[1]["vals"]["2026-10"]-12340)<0.01 and E[1]["vals"].get("2026-06")==11400, "sans liaison : ligne « Bourse » créée avec son historique (juin 11 400, oct 12 340)")
    h=hero(); check("29 616,90" in h and "dont Bourse 12 340" in h, "… et comptée dans l'épargne de l'Accueil")
    pg.reload(); pg.wait_for_timeout(900); check(len(ls("epargne"))==2, "pas de doublon au rechargement")
    # C. deux comptes liés (ancienne version) : un seul garde la Bourse
    d=copy.deepcopy(base); x=copy.deepcopy(base["epargne"][1]); x["id"]=303; x["nom"]="Assurance vie"; x["preLink"]={"month":"2026-09","had":True,"val":5000}; d["epargne"].append(x)
    load(d); E={c["id"]:c for c in ls("epargne")}
    check(E[302].get("bourseLink") and not E[303].get("bourseLink") and E[303]["vals"].get("2026-09")==5000 and "2026-10" not in E[303]["vals"], "deux liées : la 2e reprend sa valeur d'avant (5 000 en septembre)")
    h=hero(); check("34 616,90" in h, "… total 17 276,90 + 12 340 + 5 000 = 34 616,90 (%s)" % h.replace("\n"," "))
    # D. version Store : rien ne change
    d=copy.deepcopy(base); d["epargne"]=[d["epargne"][0]]
    load(d, APP+"?edition=store"); E=ls("epargne"); h=hero()
    check(len(E)==1 and "dont Bourse" not in h, "version Store : pas de ligne Bourse")
    # E. nouveau compte épargne : plus de choix « Suit la Bourse »
    load(base); ep_page(); pg.locator("#addep").click(); pg.wait_for_timeout(400)
    check("Suit la Bourse" not in pg.locator(".sheet-overlay").last.inner_text(), "nouveau compte épargne : plus de choix « Suit la Bourse »")
    pg.locator(".sheet-overlay .ui-cancel").last.click()
    # 360 px avec liquide (4 colonnes)
    d=copy.deepcopy(base); d["liquideMois"]={"Benoit":{"2026-10":35.96}}
    pg.set_viewport_size({"width":360,"height":740}); load(d); h=hero(); print("  360 :", h.replace("\n"," | "))
    check(pg.evaluate("()=>document.documentElement.scrollWidth")<=360, "360 px avec liquide : pas de défilement de côté")
    pg.screenshot(path=os.path.join(SP,"t81_home360.png"))
    print("errors:", errs); check(not errs, "aucune erreur")
    b.close()
print(len(fails), "échec(s)")
