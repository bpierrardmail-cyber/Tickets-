# Fiche du ticket réorganisée, partage « Qui paie ce ticket ? », corbeille.
# 1. fiche : photo à côté du montant, Date et Payé par côte à côte (liste), 6 catégories + « Autres ▾ », « Options » replié avec son résumé ;
# 2. Options : Compte (Auto · compte de la personne), Groupe, Partage « Non » ; « Qui paie ce ticket ? » : seulement la personne / commun du foyer / certaines personnes ;
#    un article partagé seul : « 1 article · Commun du foyer » ; « Tout le ticket » ;
# 3. ⋯ › Supprimer : le ticket part dans la corbeille (« Annuler » le remet) ; Dépenses › Tickets › Corbeille › « Remettre » le rend avec sa photo ;
#    plus de 30 jours : supprimé pour de bon ; « Vider la corbeille » demande confirmation. Données inventées.
import sys, os, json
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
APP='file://'+ROOT+'/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def norm(t): return t.replace(" "," ").replace("\xa0"," ")
data={"askName":False,"devise":"EUR","personnes":[{"nom":"Sylvette"}],
  "comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True},{"key":"Syl","nom":"Compte Sylvette","payer":"Sylvette"}],
  "groupes":[{"id":5,"nom":"Pour voir","membres":["Alex","Sylvette"],"dep":[],"rembs":[]}],
  "entries":[{"id":1,"date":"2026-10-19","marchand":"Station du Lac","montant":48.69,"categorie":"Carburant","payePar":"Sylvette","articles":[{"label":"SP98","prix":48.69,"produit":"Essence"}]},
             {"id":2,"date":"2026-10-20","marchand":"Primeur","montant":10,"categorie":"Alimentation","payePar":"Alex","articles":[{"label":"Pommes","prix":4,"produit":"Fruits"},{"label":"Salade","prix":6,"produit":"Légumes"}]},
             {"id":3,"date":"2026-10-21","marchand":"Boulangerie","montant":4.6,"categorie":"Alimentation","payePar":"Alex","articles":[]}],
  "corbeille":[{"e":{"id":77,"date":"2026-08-02","marchand":"Vieux ticket","montant":3,"categorie":"Autre","payePar":"Alex","articles":[]},"at":"2026-09-01T10:00:00.000Z","ph":""}]}
PH="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAP/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKAA/9k="
with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    c=b.new_context(viewport={'width':412,'height':900}); pg=c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    pg.goto(APP); pg.wait_for_timeout(300)
    pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); pg.reload(); pg.wait_for_timeout(2200)
    def E(): return pg.evaluate("()=>JSON.parse(localStorage.getItem('entries'))")
    def corb(): return pg.evaluate("()=>JSON.parse(localStorage.getItem('corbeille')||'[]')")
    check(not [x for x in corb() if x["e"]["id"]==77], "ticket de plus de 30 jours dans la corbeille : supprimé pour de bon au démarrage")
    def depenses(): pg.locator('#nav .navi[data-view="depenses"]').click(); pg.wait_for_timeout(400)
    def open_t(i): depenses(); pg.locator('.entry[data-id="%d"]' % i).first.click(); pg.wait_for_timeout(500)
    # ---------- 1. la fiche
    open_t(1)
    t=norm(pg.locator("#app").inner_text())
    check(pg.locator("#f-payer").count()==1 and pg.locator("#f-payer").input_value()=="Sylvette" and pg.locator(".f-two #f-date").count()==1, "Date et Payé par côte à côte, Payé par = Sylvette (liste)")
    check(pg.locator("#photoadd.f-thumb").count()==1 and pg.locator("#del").count()==0 and pg.locator("#fMore").count()==1, "photo à côté du montant ; plus de bouton Supprimer en bas, menu ⋯ en haut")
    check(pg.locator("#chips .chip[data-cat]").count()<=7 and pg.locator("#catMore").count()==1, "6 catégories (+ celle du ticket) et « Autres ▾ »")
    n0=pg.locator("#chips .chip[data-cat]").count(); pg.locator("#catMore").click(); pg.wait_for_timeout(300)
    check(pg.locator("#catMore").count()==0 and pg.locator("#chips .chip[data-cat]").count()>n0, "« Autres ▾ » : toutes les catégories")
    check("compte auto · sans groupe · pas partagé" in norm(pg.locator("#fopt").inner_text()), "Options repliées : « compte auto · sans groupe · pas partagé »")
    # ---------- 2. options
    pg.locator("#fopt").click(); pg.wait_for_timeout(300)
    check("Auto · Compte Sylvette" in norm(pg.locator("#f-acct").inner_text()) and pg.locator("#f-grp").count()==1 and "Non" in pg.locator("#fshare").inner_text(), "Options : Compte « Auto · Compte Sylvette », Groupe, Partage « Non »")
    pg.locator("#fshare").click(); pg.wait_for_timeout(300)
    ov=norm(pg.locator(".sheet-overlay").last.inner_text()); ov=ov.replace("QUI PAIE CE TICKET ?","Qui paie ce ticket ?")
    check("Qui paie ce ticket ?" in ov and "Seulement Sylvette" in ov and "Le commun du foyer" in ov and "Certaines personnes" in ov and pg.locator('.sh-m.on[data-m="seul"]').count()==1, "« Qui paie ce ticket ? » : Seulement Sylvette (choisi), commun du foyer, certaines personnes")
    pg.locator('.sh-m[data-m="all"]').click(); pg.locator("#shOk").click(); pg.wait_for_timeout(300)
    check("Commun du foyer" in pg.locator("#fshare").inner_text() and pg.locator(".art-comc").first.is_checked(), "commun du foyer : l'article est partagé, « Partage : Commun du foyer »")
    pg.locator("#f-grp").select_option("5")
    pg.locator("#save").click(); pg.wait_for_timeout(600)
    if pg.locator("#cksave").count(): pg.locator("#cksave").click(); pg.wait_for_timeout(400)
    e=[x for x in E() if x["id"]==1][0]; g=pg.evaluate("()=>JSON.parse(localStorage.getItem('groupes'))")[0]
    check(e["articles"][0].get("commun") and not e.get("share") and any(d.get("ticketId")==1 for d in g["dep"]), "enregistré : partagé au commun, mis dans le groupe « Pour voir »")
    open_t(1)
    check("partagé : commun du foyer" in norm(pg.locator("#fopt").inner_text()) and "groupe « Pour voir »" in norm(pg.locator("#fopt").inner_text()), "résumé des options : groupe « Pour voir » · partagé : commun du foyer")
    pg.locator("#fopt").click(); pg.wait_for_timeout(200)
    pg.locator("#fshare").click(); pg.wait_for_timeout(300); pg.locator('.sh-m[data-m="seul"]').click(); pg.locator("#shOk").click(); pg.wait_for_timeout(300)
    check("Non" in pg.locator("#fshare").inner_text() and not pg.locator(".art-comc").first.is_checked(), "« Seulement Sylvette » : plus rien de partagé")
    pg.locator("#cancel").click(); pg.wait_for_timeout(400)
    # un article partagé sur deux
    open_t(2)
    pg.locator(".art-comc").first.check(); pg.wait_for_timeout(300)
    pg.locator("#fopt").click(); pg.wait_for_timeout(200)
    check("1 article · Commun du foyer" in norm(pg.locator("#fshare").inner_text()), "un article coché : « 1 article · Commun du foyer »")
    pg.locator("#fshare").click(); pg.wait_for_timeout(300)
    pg.locator('.sh-m[data-m="pick"]').click(); pg.wait_for_timeout(200)
    check(pg.locator("#shWhole").count()==1, "certaines personnes : choix « Tout le ticket » (sinon seulement l'article partagé)")
    pg.locator("#shWhole").check(); pg.locator("#shOk").click(); pg.wait_for_timeout(300)
    check(all(pg.locator(".art-comc").nth(i).is_checked() for i in range(2)) and "Alex" in norm(pg.locator("#fshare").inner_text()) or "Toi" in norm(pg.locator("#fshare").inner_text()), "« Tout le ticket » : les 2 articles partagés entre certaines personnes")
    pg.locator("#cancel").click(); pg.wait_for_timeout(400)
    # ---------- 3. supprimer, corbeille
    pg.evaluate("ph=>{ var p=JSON.parse(localStorage.getItem('entries')); }", PH)
    open_t(3)
    pg.locator("#fMore").click(); pg.wait_for_timeout(300)
    pg.locator(".sheet-overlay button", has_text="Supprimer").click(); pg.wait_for_timeout(500)
    check(not [x for x in E() if x["id"]==3] and [x for x in corb() if x["e"]["id"]==3] and "Ticket mis à la corbeille" in norm(pg.locator("body").inner_text()), "⋯ › Supprimer : le ticket part dans la corbeille")
    pg.locator(".ui-toast button", has_text="Annuler").click(); pg.wait_for_timeout(400)
    check([x for x in E() if x["id"]==3] and not [x for x in corb() if x["e"]["id"]==3], "Annuler : le ticket revient, la corbeille est vide")
    open_t(3); pg.locator("#fMore").click(); pg.wait_for_timeout(300)
    pg.locator(".sheet-overlay button", has_text="Supprimer").click(); pg.wait_for_timeout(500)
    pg.evaluate("()=>document.querySelectorAll('.ui-toast').forEach(x=>x.remove())")
    depenses()
    check(pg.locator("#gocorb").count()==1 and "Corbeille · 1" in norm(pg.locator("#gocorb").inner_text()), "Dépenses › Tickets : « 🗑️ Corbeille · 1 »")
    pg.locator("#gocorb").click(); pg.wait_for_timeout(400)
    t=norm(pg.locator("#app").inner_text())
    check("Boulangerie" in t and "encore 30 jours" in t, "corbeille : Boulangerie, « encore 30 jours »")
    pg.locator(".corb-back").first.click(); pg.wait_for_timeout(400)
    check([x for x in E() if x["id"]==3] and not corb() and "La corbeille est vide" in norm(pg.locator("#app").inner_text()), "« Remettre » : le ticket est de retour")
    # vider
    depenses(); open_t(2); pg.locator("#fMore").click(); pg.wait_for_timeout(300); pg.locator(".sheet-overlay button", has_text="Supprimer").click(); pg.wait_for_timeout(500)
    pg.evaluate("()=>document.querySelectorAll('.ui-toast').forEach(x=>x.remove())")
    depenses(); pg.locator("#gocorb").click(); pg.wait_for_timeout(400)
    pg.locator("#corbMore").click(); pg.wait_for_timeout(300); pg.locator(".sheet-overlay button", has_text="Vider la corbeille").click(); pg.wait_for_timeout(300)
    check("seront supprimés pour de bon" in norm(pg.locator(".sheet-overlay").last.inner_text()), "« Vider la corbeille » demande confirmation")
    pg.locator(".sheet-overlay button", has_text="Vider").first.click(); pg.wait_for_timeout(400)
    check(not corb() and not [x for x in E() if x["id"]==2], "vidée : le ticket est supprimé pour de bon")
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
print("\n%d échec(s)"%len(fails)); sys.exit(1 if fails else 0)
