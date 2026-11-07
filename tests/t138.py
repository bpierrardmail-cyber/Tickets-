# Foyer partagé après la refonte (campagne du 06/11) : catégories en arbre et produits, via le relais local.
# Propriétaire avec d'anciennes catégories → migrées ; Marie (Accueil et Produits en modification) reçoit l'arbre (catParent, familles),
# enregistre un ticket dans une sous-catégorie et crée une sous-catégorie : tout arrive chez le propriétaire ;
# le propriétaire renomme une sous-catégorie : Marie le reçoit ; Léa (lecture) reçoit l'arbre mais ne peut rien créer.
import sys, os, json
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
SP=(sys.argv[1] if len(sys.argv)>1 else HERE)
src=open(os.path.join(HERE,'foyer_base.py'),encoding='utf-8').read()
exec(src.split("with sync_playwright() as p:")[0])
data={"askName":False,"devise":"EUR","personnes":[{"nom":"Marie"},{"nom":"Léa"}],
  "cats":["Alimentation","Restaurant","Carburant","Maison","Santé","Transport","Loisirs","Bar","Autre"],
  "comptes":[{"key":"Benoit","nom":"Compte courant","payer":"Benoit","main":True},{"key":"marie","nom":"Compte Marie","payer":"Marie"}],
  "budgets":{"Transport":200},
  "entries":[{"id":1,"date":"2026-10-05","marchand":"Station Fictive","montant":50,"categorie":"Carburant","payePar":"Benoit","articles":[]}]}
def invite(O, name, q, off):
    open_foyer(O); O.locator("#fyAdd").click(); O.wait_for_timeout(300); O.locator('[data-n="%s"]' % name).click(); O.wait_for_timeout(150)
    O.locator('[data-q="%s"]' % q).click(); O.wait_for_timeout(150)
    for t in off: O.locator('.sheet-overlay [data-tm="%s"][data-v="off"]' % t).last.click(); O.wait_for_timeout(150)
    O.locator("#fyOk").click(); O.wait_for_timeout(1500); inv=read_qr(O, "t138_qr.png"); O.locator(".ui-no").last.click(); O.wait_for_timeout(300); return inv
def join(b, errs, tag, inv):
    pg=new_page(b, errs, tag); pg.evaluate("()=>{localStorage.clear(); localStorage.setItem('foyerApi', JSON.stringify('%s'));}" % API)
    pg.reload(); pg.wait_for_timeout(1200); btn(pg, "Rejoindre un foyer (QR code)")
    pg.locator("#fyPaste").fill(inv); pg.locator("#fyGo").click(); pg.wait_for_timeout(1500); setup_lock(pg); pg.wait_for_timeout(1500)
    if pg.locator(".ui-no").count(): pg.locator(".ui-no").last.click(); pg.wait_for_timeout(300)
    return pg
def sync(*pgs):
    for pg in pgs: reload(pg, 3500)
with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    O=new_page(b, errs, "O")
    O.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k])); localStorage.setItem('foyerApi', JSON.stringify('%s'));}" % API, data)
    O.reload(); O.wait_for_timeout(1500)
    if O.locator(".sheet-overlay .ui-no").count(): O.locator(".sheet-overlay .ui-no").last.click(); O.wait_for_timeout(300)
    check(ls(O,"catParent").get("Bar")=="Sorties" and ls(O,"catParent").get("Carburant")=="Transport", "propriétaire : anciennes catégories migrées")
    open_foyer(O); O.locator("#fyNew").click(); O.wait_for_timeout(300); O.locator(".ui-yes").click(); setup_lock(O); btn(O, "Je l'ai noté")
    invM=invite(O, "Marie", "w", []); invL=invite(O, "Léa", "r", [])
    M=join(b, errs, "M", invM); L=join(b, errs, "L", invL)
    sync(M, L)
    cpM=ls(M,"catParent") or {}; fM=ls(M,"familles") or []
    check(cpM.get("Bar")=="Sorties" and cpM.get("Carburant")=="Transport", "Marie reçoit l'arbre (catParent)")
    check("Courses" in fM and "Bar" in fM and "Nourriture" not in fM, "Marie reçoit les familles = les catégories %s"%fM[:6])
    check((ls(L,"catParent") or {}).get("Bar")=="Sorties", "Léa (lecture) reçoit l'arbre")
    # Marie : un ticket dans Sorties › Bar et une nouvelle sous-catégorie Péage dans Transport
    M.locator("#navplus").click(); M.wait_for_timeout(300); M.locator('.sheet-overlay .dr-row[data-k="man"]').click(); M.wait_for_timeout(600)
    tiles=M.locator('#chips .chip[data-cat]').count(); check(tiles==10, "Marie : 10 grandes tuiles (%d)"%tiles)
    M.locator('#chips .chip[data-cat="Sorties"]').click(); M.wait_for_timeout(300); M.locator('.catsubs .cs[data-sub="Bar"]').click(); M.wait_for_timeout(300)
    M.locator("#f-montant").fill("14"); M.locator("#f-marchand").fill("Bar Fictif"); M.locator("#save").click(); M.wait_for_timeout(800)
    if M.locator("#cksave").count(): M.locator("#cksave").click(); M.wait_for_timeout(500)
    M.locator("#navplus").click(); M.wait_for_timeout(300); M.locator('.sheet-overlay .dr-row[data-k="man"]').click(); M.wait_for_timeout(600)
    M.locator('#chips .chip[data-cat="Transport"]').click(); M.wait_for_timeout(300)
    M.once("dialog", lambda d: d.accept("Péage Fictif"))
    M.locator("#catSubNew").click(); M.wait_for_timeout(400)
    M.locator("#f-montant").fill("3,20"); M.locator("#f-marchand").fill("Autoroute"); M.locator("#save").click(); M.wait_for_timeout(800)
    if M.locator("#cksave").count(): M.locator("#cksave").click(); M.wait_for_timeout(500)
    M.wait_for_timeout(3000)
    M.locator('#nav .navi[data-view="depenses"]').click(); M.wait_for_timeout(600); M.locator('.dpsub', has_text="Produits").click(); M.wait_for_timeout(500); M.locator("#artprod").click(); M.wait_for_timeout(600)
    check(M.locator(".catren").count()==0 and M.locator(".catdel").count()==0 and M.locator(".catadd").count()>0, "Marie : ajouter une catégorie oui, renommer / supprimer non (propriétaire seulement)")
    sync(O)
    E=ls(O,"entries")
    check(any(e["marchand"]=="Bar Fictif" and e["categorie"]=="Bar" for e in E), "propriétaire : le ticket de Marie arrive dans Bar")
    check(any(e["marchand"]=="Autoroute" and e["categorie"]=="Péage Fictif" for e in E), "propriétaire : le ticket « Péage Fictif » arrive")
    check(ls(O,"catParent").get("Péage Fictif")=="Transport" and "Péage Fictif" in ls(O,"cats"), "propriétaire : la sous-catégorie créée par Marie arrive, rangée dans Transport")
    O.locator('#nav .navi[data-view="depenses"]').click(); O.wait_for_timeout(700)
    t=O.locator("#app").inner_text().replace("\u202f"," ").replace("\xa0"," ")
    i=t.find("Transport"); print("  budgets :", t[max(0,i-60):i+90].replace("\n"," | "))
    check("3,20 € sur 200,00 €" in t, "budget Transport (200 €) du mois : compte le ticket de Marie dans sa sous-catégorie Péage (3,20 €)")
    # Léa : pas de « ＋ Nouvelle » (Produits pas en modification)
    if L.locator("#navplus").is_visible():
        L.locator("#navplus").click(); L.wait_for_timeout(300)
        if L.locator('.sheet-overlay .dr-row[data-k="man"]').count():
            L.locator('.sheet-overlay .dr-row[data-k="man"]').click(); L.wait_for_timeout(500); L.locator('#chips .chip[data-cat="Transport"]').click(); L.wait_for_timeout(300)
    check(L.locator("#catSubNew").count()==0, "Léa (lecture) : pas de « ＋ Nouvelle »")
    # propriétaire : renomme Bar → Bistrot ; Marie le reçoit
    O.locator('.dpsub', has_text="Produits").click(); O.wait_for_timeout(500); O.locator("#artprod").click(); O.wait_for_timeout(600)
    O.once("dialog", lambda d: d.accept("Bistrot"))
    O.evaluate("()=>{ var b=document.querySelector('.cttog[data-cat=\"Sorties\"]'); if(b && b.getAttribute('aria-expanded')==='false') b.click(); }"); O.wait_for_timeout(400)   # grandes catégories repliées (07/11)
    O.evaluate("()=>{ var b=document.querySelector('.catren[data-cat=\"Bar\"]'); b.style.display=''; b.click(); }"); O.wait_for_timeout(2500)
    sync(M)
    check((ls(M,"catParent") or {}).get("Bistrot")=="Sorties" and any(e["marchand"]=="Bar Fictif" and e["categorie"]=="Bistrot" for e in ls(M,"entries")), "Marie reçoit le renommage (Bar → Bistrot, son ticket suit)")
    errs2=[e for e in errs if "Failed to load resource" not in e and "URL scheme \"file\"" not in e]
    check(not errs2, "pas d'erreur %s"%errs2[:3])
    b.close()
print("\n%d échec(s)"%len(fails)); sys.exit(1 if fails else 0)
