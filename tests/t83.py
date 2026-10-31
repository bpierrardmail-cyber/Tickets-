# Ticket : articles comparés au montant (bandeau, rappel, cartes en orange), question à l'enregistrement, photo en vignette
import sys, os, json
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
SP=(sys.argv[1] if len(sys.argv)>1 else HERE); APP='file://'+ROOT+'/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def norm(t): return t.replace(" "," ").replace("\xa0"," ")
data={"askName":False,"devise":"EUR","personnes":[{"nom":"Sylvette"}],"comptes":[{"key":"Benoit","nom":"Compte courant","payer":"Benoit","main":True}],"entries":[]}
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={'width':412,'height':900}).new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    pg.goto(APP); pg.wait_for_timeout(300)
    def load():
        pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); pg.reload(); pg.wait_for_timeout(900)
    def ls(k): return pg.evaluate("k=>JSON.parse(localStorage.getItem(k))", k)
    def form(montant, arts):
        pg.locator("#manual2").click(); pg.wait_for_timeout(400)
        pg.locator("#f-montant").fill(montant)
        for lab, pr in arts:
            pg.locator("#addart").click(); pg.wait_for_timeout(250)
            a=pg.locator("#arts .art").last; a.locator(".art-name").fill(lab); a.locator(".art-prix").fill(pr)
        pg.wait_for_timeout(200)
    def chk(): return norm(pg.locator("#artchk").inner_text())
    load()
    # 1. écart : bandeau orange, rappel, cartes en orange
    form("48,69", [("Volume e","21,45"),("TOT TIC","48,69"),("Net","40,58")])
    c=chk(); print("  bandeau :", c.replace("\n"," | "))
    check("3 articles · 110,72 € ≠ 48,69 €" in c and "écart 62,03 €" in c and pg.locator("#artchk .chk.bad").count()==1, "écart : bandeau orange « 3 articles · 110,72 € ≠ 48,69 € · écart 62,03 € »")
    check(norm(pg.locator("#artsum").inner_text())=="110,72 € sur 48,69 €" and pg.locator("#arts .art.warn").count()==3, "rappel au-dessus des articles, 3 cartes en orange")
    pg.screenshot(path=os.path.join(SP,"t83_ecart.png"))
    # 2. on corrige : supprime TOT TIC et Net → 21,45 sur 48,69 ; met 48,69 sur Volume → vert
    pg.locator("#arts .art").nth(0).locator(".art-prix").fill("48,69"); pg.locator("#arts .art").nth(0).locator(".art-name").fill("Gazole")
    pg.locator("#arts .art").nth(2).locator(".art-del").click(); pg.wait_for_timeout(300); pg.locator("#arts .art").nth(1).locator(".art-del").click(); pg.wait_for_timeout(300)
    c=chk(); check("1 article = total 48,69 €" in c and pg.locator("#artchk .chk.ok").count()==1 and pg.locator("#arts .art.warn").count()==0, "corrigé : bandeau vert « 1 article = total 48,69 € »")
    pg.locator("#save").click(); pg.wait_for_timeout(500)
    E=ls("entries"); check(len(E)==1 and pg.locator(".sheet-overlay").count()==0, "tout juste : enregistré sans question")
    # 3. il manque 8,11 : « Ajouter en Divers »
    form("48,69", [("Net","40,58")]); pg.locator("#save").click(); pg.wait_for_timeout(400)
    sh=norm(pg.locator(".sheet-overlay").last.inner_text()); print("  question :", sh.replace("\n"," | "))
    check("Il manque" in sh and "8,11 €" in sh and "Ajouter 8,11 € en « Divers »" in sh and "Enregistrer quand même" in sh, "question : il manque 8,11 €, Vérifier / Ajouter en Divers / Enregistrer quand même")
    pg.screenshot(path=os.path.join(SP,"t83_question.png"))
    pg.locator("#ckfix").click(); pg.wait_for_timeout(600)
    E=ls("entries"); e=E[0]; print("  ticket :", e["montant"], [(a["label"], a["prix"]) for a in e["articles"]])
    check(len(E)==2 and any(a["label"]=="Divers" and abs(a["prix"]-8.11)<0.001 for a in e["articles"]), "« Ajouter en Divers » : ligne Divers 8,11 et enregistré")
    # 4. en trop : « Mettre le montant à … »
    form("48,69", [("A","60,00")]); pg.locator("#save").click(); pg.wait_for_timeout(400)
    sh=norm(pg.locator(".sheet-overlay").last.inner_text()); check("En trop" in sh and "Mettre le montant à 60,00 €" in sh, "en trop : « Mettre le montant à 60,00 € »")
    pg.locator("#ckfix").click(); pg.wait_for_timeout(600); check(ls("entries")[0]["montant"]==60, "montant mis à 60")
    # 5. « Vérifier les articles » : reste sur la fiche
    form("10", [("B","3")]); pg.locator("#save").click(); pg.wait_for_timeout(400); pg.locator("#ckv").click(); pg.wait_for_timeout(500)
    check(pg.locator("#f-montant").count()==1 and len(ls("entries"))==3, "« Vérifier » : on reste sur la fiche, rien d'enregistré")
    pg.locator("#save").click(); pg.wait_for_timeout(400); pg.locator("#cksave").click(); pg.wait_for_timeout(500)
    check(len(ls("entries"))==4, "« Enregistrer quand même »")
    # 6. sans article : rien
    form("12,30", []); check(chk()=="" and norm(pg.locator("#artsum").inner_text())=="", "sans article : pas de bandeau")
    pg.locator("#save").click(); pg.wait_for_timeout(500); check(len(ls("entries"))==5, "sans article : enregistré sans question")
    # 7. remise comptée en moins ; 3 centimes d'arrondi = juste
    form("10,00", [("C","12,03")]); pg.locator("#addremise").click(); pg.wait_for_timeout(250); pg.locator("#arts .art").last.locator(".art-prix").fill("2"); pg.wait_for_timeout(200)
    check(pg.locator("#artchk .chk.ok").count()==1, "remise de 2 € déduite, 3 centimes d'écart = juste")
    # 8. photo : vignette à côté du montant, agrandie au toucher, supprimable
    pg.locator("#photoadd").click(); pg.locator("#photoin").set_input_files(os.path.join(HERE,"donnees","images","ticket.png")); pg.wait_for_timeout(800)
    check(pg.locator("#photoview img").count()==1 and pg.locator("#photoadd").count()==0, "photo : vignette à côté du montant")
    pg.screenshot(path=os.path.join(SP,"t83_photo.png"))
    pg.locator("#photoview").click(); pg.wait_for_timeout(400)
    check(pg.locator(".sheet-overlay img").count()==1 and pg.locator("#pvdel").count()==1, "toucher la vignette : la photo en grand, Changer / Supprimer")
    pg.locator("#pvdel").click(); pg.wait_for_timeout(400)
    check(pg.locator("#photoview").count()==0 and pg.locator("#photoadd").count()==1 and num_ok if (num_ok:=True) else True, "photo supprimée : « Ajouter une photo » revient")
    check(norm(pg.locator("#f-montant").input_value())=="10,00", "le montant tapé est gardé")
    print("errors:", errs); check(not errs, "aucune erreur")
    b.close()
print(len(fails), "échec(s)")
