# Ticket payé en espèces (18/11). Données inventées.
# 1. Fiche : « Payé avec » Compte / Espèces ; « Pris dans mes espèces du mois » proposé quand un liquide existe, avec ce qui restera.
# 2. Enregistré : le liquide baisse, le compte en banque ne bouge pas (pas dans la liste des opérations) ; pastille « espèces » dans Tickets.
# 3. Modifier le montant, passer « Pas dans mes espèces », supprimer puis « Annuler » : le liquide suit à chaque fois.
# 4. Payé par une autre personne : son liquide à elle ; partage : « Qui paie ce ticket ? » dit « en espèces ».
# 5. Pas de liquide noté : « Pas dans mes espèces » choisi par défaut, « Les indiquer ».
# 6. Argent liquide : le détail du mois (début, tickets, aujourd'hui) et la correction.
# 7. Lecture d'un ticket : « ESPECES » / « RENDU » → espèces, pas avec une carte bancaire (tkCashWord extrait du fichier).
import sys, os, json, re
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
APP='file://'+ROOT+'/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def norm(t): return t.replace(" "," ").replace("\xa0"," ").replace(" "," ")
base={"askName":False,"devise":"EUR","welcomeSeen":True,"personnes":[{"nom":"Marie"}],"communParts":{"Alex":50,"Marie":50},
  "comptes":[{"key":"Alex","nom":"Compte Alex","payer":"Alex","main":True},{"key":"Marie","nom":"Compte Marie","payer":"Marie"}],
  "liquideMois":{"Alex":{"2026-09":80},"Marie":{"2026-10":30}},
  "entries":[{"id":1,"date":"2026-10-03","marchand":"Boulangerie Fictive","montant":6.4,"categorie":"Courses","payePar":"Alex","articles":[]}]}
def fn_src(src, name):   # source d'une fonction du script (accolades équilibrées)
    i=src.index("function "+name+"("); j=src.index("{", i); d=0
    for k in range(j, len(src)):
        if src[k]=="{": d+=1
        elif src[k]=="}":
            d-=1
            if d==0: return src[i:k+1]
with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    def page(ls):
        c=b.new_context(viewport={'width':412,'height':900}); pg=c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
        pg.goto(APP); pg.wait_for_timeout(300)
        pg.evaluate("d=>{ localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k])); }", ls); pg.wait_for_timeout(200)
        pg.reload(); pg.wait_for_timeout(1300); return pg
    def get(pg, k, d=None): v=pg.evaluate("k=>localStorage.getItem(k)", k); return json.loads(v) if v else d
    def liq(pg, who, m="2026-10"): return (get(pg, "liquideMois", {}).get(who) or {}).get(m)
    def ent(pg, mag): return [x for x in get(pg, "entries", []) if x["marchand"]==mag]
    def newTicket(pg, amt, mag, cat="Courses"):
        pg.locator("#navplus").click(); pg.wait_for_timeout(300); pg.locator('.sheet-overlay .dr-row[data-k="man"]').click(); pg.wait_for_timeout(500)
        pg.locator("#f-montant").fill(amt); pg.locator("#f-marchand").fill(mag)
        if pg.locator('#chips .chip[data-cat="'+cat+'"]').count()==0: pg.locator("#catMore").click(); pg.wait_for_timeout(300)
        pg.locator('#chips .chip[data-cat="'+cat+'"]').click(); pg.wait_for_timeout(300)
    def save(pg):
        pg.locator("button:has-text('Enregistrer')").first.click(); pg.wait_for_timeout(700)
        if pg.locator(".sheet-overlay #cksave").count(): pg.locator(".sheet-overlay #cksave").click(); pg.wait_for_timeout(600)
    def openT(pg, mag):
        pg.evaluate("()=>{ window.scrollTo(0,0); }")
        pg.locator('#nav .navi[data-view="compte"]').click(); pg.wait_for_timeout(400)
        pg.locator('.avtabs .cpsub[data-cp="tk"]').click(); pg.wait_for_timeout(400)
        pg.locator('.entry[data-id]', has_text=mag).first.click(); pg.wait_for_timeout(500)

    pg=page(base)
    newTicket(pg, "37,50", "Marché couvert")
    check(pg.locator("#fpay button.on").inner_text().strip().endswith("Compte") and pg.locator("#fliq").count()==0, "fiche : « Payé avec » sur Compte par défaut")
    pg.locator('#fpay button[data-pay="esp"]').click(); pg.wait_for_timeout(400)
    t1=norm(pg.locator("#fliq").inner_text()) if pg.locator("#fliq").count() else ""
    check(pg.locator('#fliq input[value="1"]').is_checked() and "Pris dans mes espèces du mois" in t1 and "Il te restera 42,50 € en liquide (sur 80,00 €)" in t1, "Espèces : « Pris dans mes espèces » coché, il restera 42,50 € (« "+t1.replace("\n"," / ")+" »)")
    pg.locator("#f-montant").fill("100"); pg.wait_for_timeout(200)
    t2=norm(pg.locator("#fliqTxt").inner_text())
    check("passerait à −20,00 €" in t2 and pg.locator("#fliqTxt.bad").count()==1 and pg.locator("#fliqSet").count()==1, "pas assez d'espèces : averti sans bloquer (« "+t2.replace("\n"," / ")+" »)")
    pg.locator("#f-montant").fill("37,50"); pg.wait_for_timeout(200)
    save(pg)
    E=ent(pg, "Marché couvert")
    check(len(E)==1 and E[0].get("pay")=="esp" and E[0].get("liq")=={"k":"Alex","m":"2026-10","a":37.5}, "enregistré : payé en espèces, pris dans le liquide d'Alex %s" % (E[0] if E else None))
    check(liq(pg, "Alex")==42.5, "liquide d'octobre : 80 − 37,50 = 42,50 (%s)" % liq(pg, "Alex"))
    pg.locator('#nav .navi[data-view="compte"]').click(); pg.wait_for_timeout(500)
    ops=norm(pg.locator("#app").inner_text())
    check("Boulangerie Fictive" in ops and "Marché couvert" not in ops, "Opérations du compte : le ticket en espèces n'y est pas")
    pg.locator('.avtabs .cpsub[data-cp="tk"]').click(); pg.wait_for_timeout(400)
    row=norm(pg.locator('.entry[data-id]', has_text="Marché couvert").first.inner_text())
    check("espèces" in row and "hors liquide" not in row, "Opérations › Tickets : pastille « espèces » (« "+row.replace("\n"," / ")+" »)")
    # modifier le montant
    openT(pg, "Marché couvert")
    check(pg.locator('#fpay button[data-pay="esp"].on').count()==1 and pg.locator('#fliq input[value="1"]').is_checked(), "ticket rouvert : Espèces et « Pris dans mes espèces » gardés")
    t3=norm(pg.locator("#fliqTxt").inner_text())
    check("(sur 80,00 €)" in t3, "ticket rouvert : son propre montant compte encore comme disponible (« "+t3+" »)")
    pg.locator("#f-montant").fill("40"); pg.locator("#arts .art-prix").first.fill("40") if pg.locator("#arts .art-prix").count() else None
    save(pg)
    check(liq(pg, "Alex")==40, "montant passé à 40 € : liquide 40 (%s)" % liq(pg, "Alex"))
    # pas dans mes espèces
    openT(pg, "Marché couvert"); pg.locator('#fliq input[value="0"]').check(); pg.wait_for_timeout(200); save(pg)
    E=ent(pg, "Marché couvert")
    check(liq(pg, "Alex")==80 and E[0].get("pay")=="esp" and "liq" not in E[0], "« Pas dans mes espèces » : liquide rendu (80), ticket en espèces sans liquide (%s)" % liq(pg, "Alex"))
    pg.locator('#nav .navi[data-view="compte"]').click(); pg.wait_for_timeout(400); pg.locator('.avtabs .cpsub[data-cp="tk"]').click(); pg.wait_for_timeout(400)
    check("espèces hors liquide" in norm(pg.locator('.entry[data-id]', has_text="Marché couvert").first.inner_text()), "pastille « espèces hors liquide »")
    # de nouveau pris, puis supprimé et remis
    openT(pg, "Marché couvert"); pg.locator('#fliq input[value="1"]').check(); pg.wait_for_timeout(200); save(pg)
    check(liq(pg, "Alex")==40, "de nouveau pris dans le liquide : 40 (%s)" % liq(pg, "Alex"))
    openT(pg, "Marché couvert"); pg.locator("#fMore").click(); pg.wait_for_timeout(300)
    pg.locator(".sheet-overlay button", has_text="Supprimer").click(); pg.wait_for_timeout(500)
    check(liq(pg, "Alex")==80 and not ent(pg, "Marché couvert"), "supprimé : le liquide revient à 80 (%s)" % liq(pg, "Alex"))
    pg.locator(".ui-toast.undo button").click(); pg.wait_for_timeout(500)
    check(liq(pg, "Alex")==40 and len(ent(pg, "Marché couvert"))==1, "« Annuler » : ticket remis, liquide 40 (%s)" % liq(pg, "Alex"))
    # payé par Marie
    newTicket(pg, "18", "Fleuriste Test", "Maison")
    pg.locator("#f-payer").select_option("Marie"); pg.wait_for_timeout(400)
    pg.locator('#fpay button[data-pay="esp"]').click(); pg.wait_for_timeout(400)
    t4=norm(pg.locator("#fliq").inner_text())
    check("Pris dans les espèces de Marie" in t4 and "Il lui restera 12,00 €" in t4 and "Pas dans ses espèces du mois" in t4, "payé par Marie : son liquide (« "+t4.replace("\n"," / ")+" »)")
    if pg.locator("#fopt").count() and pg.locator("#fshare").count()==0: pg.locator("#fopt").click(); pg.wait_for_timeout(300)
    opt=norm(pg.locator(".f-opt").inner_text()) if pg.locator(".f-opt").count() else ""
    check("Liquide de" in opt, "Options : « Liquide de » à la place de « Compte »")
    if pg.locator("#fshare").count():
        pg.locator("#fshare").click(); pg.wait_for_timeout(400)
        sh=norm(pg.locator(".sheet-overlay").last.inner_text())
        check("en espèces" in sh and "qui paie ce ticket" in sh.lower(), "« Qui paie ce ticket ? » : « payé par Marie · en espèces »")
        pg.locator('.sheet-overlay .sh-m[data-m="all"]').click(); pg.wait_for_timeout(200); pg.locator(".sheet-overlay #shOk").click(); pg.wait_for_timeout(400)
    else: check(False, "bouton Partage absent")
    save(pg)
    E=ent(pg, "Fleuriste Test")
    check(liq(pg, "Marie")==12 and E and E[0].get("liq",{}).get("k")=="Marie" and any(a.get("commun") for a in E[0].get("articles",[])), "Marie : liquide 30 − 18 = 12, ticket partagé (%s)" % liq(pg, "Marie"))
    # Argent liquide : détail et correction
    pg.locator('#nav .navi[data-view="compte"]').click(); pg.wait_for_timeout(500)
    pg.locator("#opsLiq").click(); pg.wait_for_timeout(300)
    ch=norm(pg.locator(".sheet-overlay").last.inner_text())
    check("tickets payés en espèces" in ch, "bouton Liquide : « Dont −40,00 € de tickets payés en espèces » (« "+ch.replace("\n"," / ")[:160]+" »)")
    pg.locator(".sheet-overlay button", has_text="Détail du mois").click(); pg.wait_for_timeout(400)
    d=norm(pg.locator(".sheet-overlay").last.inner_text())
    check("Début du mois" in d and "repris de septembre" in d and "80,00 €" in d and "Marché couvert" in d and "−40,00 €" in d and "Aujourd'hui" in d and "40,00 €" in d, "détail du liquide (« "+d.replace("\n"," / ")[:220]+" »)")
    pg.locator(".sheet-overlay #lqV").fill("35"); pg.locator(".sheet-overlay #lqOk").click(); pg.wait_for_timeout(400)
    check(liq(pg, "Alex")==35, "correction : liquide 35 (%s)" % liq(pg, "Alex"))
    # pas de liquide noté
    pg2=page(dict(base, liquideMois={}))
    newTicket(pg2, "9,90", "Marché sans liquide")
    pg2.locator('#fpay button[data-pay="esp"]').click(); pg2.wait_for_timeout(400)
    t5=norm(pg2.locator("#fliq").inner_text())
    check(pg2.locator('#fliq input[value="0"]').is_checked() and "pas encore indiqué tes espèces" in t5 and pg2.locator("#fliqSet").count()==1, "sans liquide noté : « Pas dans mes espèces » par défaut, « Les indiquer »")
    save(pg2)
    E=ent(pg2, "Marché sans liquide")
    check(E and E[0].get("pay")=="esp" and "liq" not in E[0] and not get(pg2, "liquideMois", {}).get("Alex"), "enregistré hors liquide, rien de noté dans le liquide")
    # lecture d'un ticket
    src=open(ROOT+"/beta/index.html", encoding="utf-8").read()
    js=fn_src(src, "num")+"\n"+fn_src(src, "tkCashWord")+"\nreturn tkCashWord;"
    cases=[(["MARCHE","TOTAL 37,50","ESPECES 40,00","RENDU 2,50"], "ESPÈCES"), (["TOTAL 12,00","CB 12,00","ESPECES 0,00"], None), (["TOTAL 8,00","A RENDRE 2,00"], "RENDU"), (["TOTAL 8,00","CARTE BANCAIRE 8,00","SANS CONTACT"], None)]
    res=pg.evaluate("([js, cases])=>{ const f=(new Function(js))(); return cases.map(c=>f(c[0])); }", [js, cases])
    check(res==[c[1] for c in cases], "tkCashWord : espèces lues, pas avec une carte (%s)" % res)
    check(not errs, "aucune erreur JS (%s)" % errs[:3])
    b.close()
print("\n%d échec(s)" % len(fails)); sys.exit(1 if fails else 0)
