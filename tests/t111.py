# Tickets et relevé :
# 1. ticket saisi alors que le paiement par carte est déjà là (ticket « relevé » sans articles) : « Compléter ce paiement »
#    (montant du relevé pris, même fiche, pas de doublon) ;
# 2. ligne du relevé gardée : total égal → « Retrouvé sur ton relevé » ; un peu différent → « Prendre le relevé » ;
# 3. date dans le futur signalée ;
# 4. import d'un relevé : ticket au même nom avec un total un peu différent → « total corrigé », le ticket prend le montant du relevé ;
#    l'import garde ses lignes (clé releve), « Annuler le dernier import » remet le total.
# Données inventées.
import sys, os, tempfile
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
APP='file://'+ROOT+'/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def norm(t): return t.replace(" "," ").replace("\xa0"," ")
data={"askName":False,"devise":"EUR","comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True}],
  "entries":[{"id":500,"date":"2026-10-03","marchand":"INTERMARCHE LA ROTONDE","montant":31.26,"categorie":"Courses","payePar":"Alex","compte":"Alex","articles":[],"src":"releve","imp":1,"impKey":"k1"},
             {"id":501,"date":"2026-10-05","marchand":"Leclerc","montant":50,"categorie":"Courses","payePar":"Alex","articles":[{"label":"Divers","prix":50,"produit":""}]}],
  "releve":[{"d":"2026-10-10","n":"CARTE CARREFOUR MARKET","a":-12.4,"k":"r2","c":"Alex","i":1}]}
with sync_playwright() as p:
    b=p.chromium.launch(); c=b.new_context(viewport={'width':412,'height':900}); pg=c.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    pg.goto(APP); pg.wait_for_timeout(300)
    pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); pg.reload(); pg.wait_for_timeout(900)
    E=lambda: pg.evaluate("()=>JSON.parse(localStorage.getItem('entries'))")
    def form(amt, mag, date):
        if pg.locator("#cancel").count(): pg.locator("#cancel").click(); pg.wait_for_timeout(300)
        if not pg.locator('#nav .navi[data-view="list"]').is_visible(): pg.reload(); pg.wait_for_timeout(900)
        pg.locator('#nav .navi[data-view="list"]').click(); pg.wait_for_timeout(300)
        pg.locator("#manual2").first.click(); pg.wait_for_timeout(500)
        pg.locator("#f-montant").fill(amt); pg.locator("#f-montant").dispatch_event("change")
        pg.locator("#f-marchand").fill(mag); pg.locator("#f-marchand").dispatch_event("change")
        pg.locator("#f-date").fill(date); pg.locator("#f-date").dispatch_event("change"); pg.wait_for_timeout(300)
        return norm(pg.locator("#bankchk").inner_text())
    # ---------- 1. compléter le paiement du relevé
    t=form("31,20", "Intermarché", "2026-10-03")
    check("Ce paiement est déjà dans tes comptes (relevé)" in t and "−31,26 € le 03/10" in t and "lu 31,20 €" in t, "paiement déjà là : « déjà dans tes comptes (relevé) : … −31,26 € le 03/10 · lu 31,20 € »")
    pg.locator("#bkMerge").click(); pg.wait_for_timeout(300)
    check(pg.locator("#f-montant").input_value()=="31,26" and "Ce ticket le complétera" in norm(pg.locator("#bankchk").inner_text()), "« Compléter ce paiement » : montant 31,26 €, « Ce ticket le complétera, sans doublon »")
    pg.locator("#save").click(); pg.wait_for_timeout(500)
    L=E(); m=[e for e in L if e["id"]==500]
    check(len(L)==2 and m and m[0]["marchand"]=="Intermarché" and m[0]["montant"]==31.26 and m[0].get("src")!="releve" and m[0].get("impKey")=="k1" and m[0].get("compte")=="Alex", "enregistré : même fiche (id 500), plus de doublon, clé du relevé gardée %s" % [(e["id"], e["marchand"], e["montant"]) for e in L])
    # ---------- 2. ligne du relevé gardée
    t=form("12,40", "Carrefour", "2026-10-10")
    check("Retrouvé sur ton relevé" in t and "−12,40 € le 10/10" in t, "total égal au relevé : « Retrouvé sur ton relevé : CARTE CARREFOUR MARKET −12,40 € le 10/10 »")
    t=form("12,10", "Carrefour", "2026-10-10")
    check("Sur ton relevé" in t and "lu 12,10 €" in t and pg.locator("#bkTake").count()==1, "total différent : « Sur ton relevé : −12,40 € … lu 12,10 € » et « Prendre le relevé »")
    pg.locator("#bkTake").click(); pg.wait_for_timeout(300)
    check(pg.locator("#f-montant").input_value()=="12,40", "« Prendre le relevé » : 12,40 €")
    pg.locator("#cancel").click(); pg.wait_for_timeout(300)
    # ---------- 3. date dans le futur
    t=form("5,00", "Boulangerie", "2026-11-15")
    check("Date dans le futur" in t, "date dans le futur signalée")
    pg.locator("#cancel").click(); pg.wait_for_timeout(300)
    # ---------- 4. import : total corrigé
    tmp=tempfile.mkdtemp(); csv=os.path.join(tmp,"releve_fictif.csv")
    open(csv,"w",encoding="utf-8").write("Date;Libellé;Montant\n05/10/2026;CARTE 05/10 LECLERC;-50,40\n27/10/2026;PRLV SEPA FREE MOBILE;-15,99\n")
    pg.locator('#nav .navi[data-view="compte"]').click(); pg.wait_for_timeout(500)
    pg.locator("#cptGear").click(); pg.wait_for_timeout(300)
    pg.locator(".sheet-overlay button", has_text="Importer un relevé").first.click(); pg.wait_for_timeout(400)
    with pg.expect_file_chooser() as fcx: pg.locator("#impPick").click()
    fcx.value.set_files(csv); pg.wait_for_timeout(900)
    Ls=[norm(x) for x in pg.locator(".imp-l").all_inner_texts()]; print("  lignes :", Ls)
    hit=[l for l in Ls if "LECLERC" in l.upper()]
    check(hit and "total corrigé : 50,00 € → 50,40 €" in hit[0], "import : « Déjà dans tes tickets (Leclerc · 05/10) · total corrigé : 50,00 € → 50,40 € »")
    pg.locator('[data-imp="go"]').click(); pg.wait_for_timeout(700)
    yes=pg.locator(".sheet-overlay .ui-yes")
    if yes.count(): yes.last.click(); pg.wait_for_timeout(600)
    L=E(); lc=[e for e in L if e["id"]==501]
    check(lc and lc[0]["montant"]==50.4 and len([e for e in L if "eclerc" in e["marchand"].lower()])==1, "après l'import : le ticket Leclerc vaut 50,40 €, pas de doublon")
    R=pg.evaluate("()=>JSON.parse(localStorage.getItem('releve')||'[]')")
    check(any(x["n"].upper().find("FREE")>=0 and x["a"]==-15.99 for x in R) and any("LECLERC" in x["n"].upper() for x in R), "l'import garde ses lignes (relevé) pour les factures et les tickets %s" % [(x["n"], x["a"]) for x in R])
    # annuler le dernier import
    pg.locator('#nav .navi[data-view="compte"]').click(); pg.wait_for_timeout(500)
    pg.locator("#cptGear").click(); pg.wait_for_timeout(300)
    pg.locator(".sheet-overlay button", has_text="Annuler le dernier import").first.click(); pg.wait_for_timeout(400)
    yes=pg.locator(".sheet-overlay .ui-yes")
    if yes.count(): yes.last.click(); pg.wait_for_timeout(600)
    L=E(); lc=[e for e in L if e["id"]==501]; R=pg.evaluate("()=>JSON.parse(localStorage.getItem('releve')||'[]')")
    check(lc and lc[0]["montant"]==50 and not any("LECLERC" in x["n"].upper() for x in R), "« Annuler le dernier import » : le ticket revient à 50,00 €, les lignes de l'import retirées")
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
print("\n%d échec(s)"%len(fails)); sys.exit(1 if fails else 0)
