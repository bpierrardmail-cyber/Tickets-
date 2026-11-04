# Ticket partagé avec plusieurs personnes (« Partagé avec ») :
# 1. fiche d'un ticket : « Partagé avec : Tout le foyer », « Choisir » → décocher Tom et Lou → parts égales 33,33 % ;
#    les articles passent en « Dépense commune », on en décoche un (le dessert) ; enregistré avec share ;
# 2. Commun › Qui doit combien à qui : seuls Marie et Léa doivent leur part ; Produits partagés « · avec Toi, Marie, Léa » ;
# 3. total différent de 100 % refusé ; revenir à « Tout le foyer » ;
# 4. « Tout le ticket en commun » sur un ticket sans articles : un article « Divers » commun.
# Données inventées.
import sys, os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
APP='file://'+ROOT+'/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def norm(t): return t.replace(" "," ").replace("\xa0"," ")
data={"askName":False,"devise":"EUR","personnes":[{"nom":"Marie"},{"nom":"Léa"},{"nom":"Tom"},{"nom":"Lou"}],
  "comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True}],
  "entries":[{"id":20,"date":"2026-10-17","marchand":"Pizzeria fictive","montant":53,"categorie":"Restaurant","payePar":"Alex","articles":[
     {"label":"Pizza 4 fromages","prix":14.5,"produit":""},{"label":"Pizza reine","prix":13,"produit":""},{"label":"Boissons","prix":18.5,"produit":""},{"label":"Dessert de Léa","prix":7,"produit":""}]}],
  "commBalFrom":"2026-10"}
with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    c=b.new_context(viewport={'width':412,'height':900}); pg=c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    pg.goto(APP); pg.wait_for_timeout(300)
    pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); pg.reload(); pg.wait_for_timeout(900)
    E=lambda: pg.evaluate("()=>JSON.parse(localStorage.getItem('entries'))")
    pg.locator('#nav .navi[data-view="depenses"]').click(); pg.wait_for_timeout(400)
    pg.locator('.entry[data-id="20"]').first.click(); pg.wait_for_timeout(500)
    pg.locator("#fopt").click(); pg.wait_for_timeout(300)
    t=norm(pg.locator("#fshare").inner_text()); check("Partage" in t and "Non" in t, "fiche : Options › « Partage · Non »")
    check("partager cet article" in pg.locator("#arts").inner_text(), "case de l'article : « partager cet article »")
    pg.locator("#fshare").click(); pg.wait_for_timeout(300)
    pg.locator('#shMode button[data-m="pick"]').click(); pg.wait_for_timeout(200)
    for n in ("Tom","Lou"): pg.locator('.sh-r[data-p="%s"] .sh-c' % n).click(); pg.wait_for_timeout(150)
    vals=pg.evaluate("()=>[...document.querySelectorAll('.sh-r .sh-p')].map(i=>i.value)")
    check(vals==["33,33","33,33","33,33"], "Tom et Lou décochés : 33,33 %% chacun pour les 3 autres %s" % vals)
    pg.locator(".sh-r .sh-p").first.fill("50"); pg.locator(".sh-r .sh-p").first.dispatch_event("change"); pg.wait_for_timeout(150)
    pg.locator("#shOk").click(); pg.wait_for_timeout(200)
    check("100 %" in norm(pg.locator(".sheet-overlay .ui-err").inner_text()), "total 116,66 % refusé : « Le total doit faire 100 % »")
    pg.locator('.sh-r[data-p="Tom"] .sh-c').click(); pg.wait_for_timeout(150); pg.locator('.sh-r[data-p="Tom"] .sh-c').click(); pg.wait_for_timeout(150)   # recocher / décocher : parts égales
    pg.locator("#shOk").click(); pg.wait_for_timeout(300)
    t=norm(pg.locator("#app").inner_text())
    import re; m=re.search(r"Toi, (\w+), (\w+)", t); check(m and {m.group(1), m.group(2)}=={"Marie","Léa"} and ("Tom et Lou ne paient rien" in t or "Lou et Tom ne paient rien" in t), "fiche : « Toi, Marie, Léa · parts égales · Tom et Lou ne paient rien »")
    cks=pg.evaluate("()=>[...document.querySelectorAll('#arts .art-comc')].map(x=>x.checked)")
    check(cks==[True,True,True,True], "les articles passent en « Dépense commune »")
    pg.locator("#arts .art-comc").nth(3).uncheck(); pg.wait_for_timeout(100)
    pg.locator("#save").click(); pg.wait_for_timeout(500)
    if pg.locator("#cksave").count(): pg.locator("#cksave").click(); pg.wait_for_timeout(500)
    e=[x for x in E() if x["id"]==20][0]
    check(set(e.get("share",{}).keys())=={"Alex","Marie","Léa"} and [a.get("commun") for a in e["articles"]]==[True,True,True,False], "enregistré : partagé avec Alex, Marie, Léa ; dessert pas commun %s" % e.get("share"))
    # ---------- 2. Commun
    pg.locator('#nav .navi[data-view="communes"]').click(); pg.wait_for_timeout(500)
    t=norm(pg.locator("#cbal").inner_text()); print("  ", t.replace("\n"," | "))
    check("Marie te doit 15,33 €" in t and "Léa te doit 15,33 €" in t and "Tom" not in t and "Lou" not in t, "équilibre : Marie et Léa doivent 15,33 € chacune (46 € à 3), Tom et Lou rien")
    pg.locator('.cfx-sec[data-k="pp"] .cfx-h').click(); pg.wait_for_timeout(300)
    tp=norm(pg.locator("#app").inner_text())
    check(re.search(r"avec Toi, (Marie, Léa|Léa, Marie)", tp), "Produits partagés : « · avec Toi, Marie, Léa »")
    # ---------- 3. retour à « Tout le foyer »
    pg.locator('#nav .navi[data-view="depenses"]').click(); pg.wait_for_timeout(400)
    pg.locator('.entry[data-id="20"]').first.click(); pg.wait_for_timeout(500)
    pg.locator("#fopt").click(); pg.wait_for_timeout(300)
    pg.locator("#fshare").click(); pg.wait_for_timeout(300); pg.locator('#shMode button[data-m="all"]').click(); pg.locator("#shOk").click(); pg.wait_for_timeout(300)
    pg.locator("#save").click(); pg.wait_for_timeout(500)
    if pg.locator("#cksave").count(): pg.locator("#cksave").click(); pg.wait_for_timeout(500)
    e=[x for x in E() if x["id"]==20][0]; check("share" not in e, "« Tout le foyer » : plus de partage particulier")
    # ---------- 4. tout le ticket en commun
    pg.locator('#nav .navi[data-view="list"]').click(); pg.wait_for_timeout(300)
    pg.locator("#manual2").first.click(); pg.wait_for_timeout(400)
    pg.locator("#f-montant").fill("30"); pg.locator("#f-marchand").fill("Boulangerie fictive")
    pg.locator("#fopt").click(); pg.wait_for_timeout(300)
    pg.locator("#fshare").click(); pg.wait_for_timeout(300); pg.locator('#shMode button[data-m="all"]').click(); pg.locator("#shOk").click(); pg.wait_for_timeout(300)
    arts=pg.evaluate("()=>[...document.querySelectorAll('#arts .art')].map(n=>[n.querySelector('.art-name').value, n.querySelector('.art-prix').value, n.querySelector('.art-comc').checked])")
    check(arts==[["Divers","30",True]] and "Commun du foyer" in pg.locator("#fshare").inner_text(), "ticket sans articles au « commun du foyer » : article Divers 30 € partagé %s" % arts)
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
print("\n%d échec(s)"%len(fails)); sys.exit(1 if fails else 0)
