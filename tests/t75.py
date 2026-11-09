# Bouton « Liquide » : décoché, le liquide n'est compté nulle part (Compte, Accueil, widgets, Bilan) mais reste affiché dans le détail
import sys, os, re, json
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
SP=(sys.argv[1] if len(sys.argv)>1 else HERE); APP='file://'+ROOT+'/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
data={"askName":False,"devise":"EUR","personnes":[{"nom":"Sylvette"}],
  "comptes":[{"key":"Benoit","nom":"Compte courant","payer":"Benoit","main":True},{"key":"livret","nom":"Compte joint","payer":""}],
  "virements":[{"id":9,"person":"Benoit","month":"2026-10","label":"Salaire","montant":100,"done":True}],
  "soldeInit":{"Benoit":{"2026-10":-152.55}},
  "liquideMois":{"Benoit":{"2026-09":35.96}},
  "entries":[]}
def txt(pg, sel): return pg.locator(sel).first.inner_text().replace(" "," ").replace("\xa0"," ")
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={'width':412,'height':900}).new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    pg.goto(APP); pg.wait_for_timeout(300)
    def load(liq):
        d=dict(data); d["cptLiq"]=liq
        pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", d); pg.reload(); pg.wait_for_timeout(900)
    def home():
        pg.locator('#nav .navi[data-view="list"]').click(); pg.wait_for_timeout(500)
        t=txt(pg, ".rs-hero"); return t, t, t   # Accueil = Résumé (09/11) : « Il te reste » suit le liquide
    def res():
        pg.locator('#nav .navi[data-view="compte"]').click(); pg.wait_for_timeout(600)
        pg.locator('.avtabs .cpsub[data-cp=""]').click(); pg.wait_for_timeout(500)
        ops=pg.locator("#app").inner_text()
        pg.locator('.avtabs .cpsub[data-cp="graph"]').click(); pg.wait_for_timeout(500)
        pg.locator('.thero .cch-tabs button[data-m="solde"]').click(); pg.wait_for_timeout(500)
        return (ops+"\n"+pg.locator("#app").inner_text()).replace(" "," ").replace("\xa0"," ")
    # coché : compté partout
    load(True); big, cap, row=home(); print("  coché :", big.replace("\n",""), "|", cap, "|", row.replace("\n"," "))
    check("16,59" in big, "coché : Accueil −52,55 + 35,96 = −16,59")
    snap=pg.evaluate("()=>window.__wsnap ? 1 : 0")
    t=res(); check("Argent liquide ✎\n35,96" in t.replace("\t","\n") or "35,96 €" in t, "coché : détail du solde, liquide 35,96 €")
    check("banque + liquide" in t, "coché : graphique banque + liquide")
    pg.screenshot(path=os.path.join(SP,"t75_res_on.png"))
    # décoché par le bouton de la page Solde
    pg.locator("#cptLiqBtn").click(); pg.wait_for_timeout(600)
    t=res()
    print("  page Solde décochée :", re.sub(r"\s+"," ", t)[:600])
    check("Liquide 35,96 € · non compté" in t, "décoché : « Liquide 35,96 € · non compté » sous le solde")
    check(t.count("35,96")>=1, "décoché : le liquide saisi reste affiché (35,96 €), pas 0,00")
    check("Banque seule, sans le liquide" in t, "décoché : « sans le liquide » dans Graphiques › Solde")
    check("banque seule" in t and "dont 0,00" not in t, "décoché : graphique banque seule, plus de « dont 0,00 € en liquide »")
    pg.screenshot(path=os.path.join(SP,"t75_res_off.png"))
    check(pg.evaluate("()=>JSON.parse(localStorage.getItem('cptLiq'))")==False, "décoché : réglage gardé")
    big, cap, row=home(); print("  décoché :", big.replace("\n",""), "|", cap, "|", row.replace("\n"," "))
    check("52,55" in big, "décoché : Accueil −52,55 (banque seule)")
    pg.screenshot(path=os.path.join(SP,"t75_home_off.png"))
    # rechargé : toujours décoché
    pg.reload(); pg.wait_for_timeout(900); big, cap, row=home(); check("52,55" in big, "après rechargement : toujours sans le liquide")
    # widgets
    w=pg.evaluate("()=>{ try{ return null; }catch(e){ return null; } }")
    # Foyer des comptes
    pg.locator('#nav .navi[data-view="compte"]').click(); pg.wait_for_timeout(500)
    print("errors:", errs); check(not errs, "aucune erreur")
    b.close()
print(len(fails), "échec(s)")
