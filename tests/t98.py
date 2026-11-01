# Factures d'un fournisseur : nombre de factures sur sa carte ; dans son détail, toucher une facture la modifie,
# appui long → Modifier / Supprimer ; suppression annulable (avec son prélèvement à venir). Données inventées.
import sys, os, re
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
SP=(sys.argv[1] if len(sys.argv)>1 else HERE); APP='file://'+ROOT+'/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def norm(t): return t.replace(" "," ").replace("\xa0"," ")
B=[{"id":201,"four":"Vallée Claire","type":"eau","date":"2025-11-05","montant":198.4,"aPayer":True,"du":"2025-03-05","au":"2025-08-20","conso":41,"src":"photo"},
   {"id":202,"four":"Vallée Claire","type":"eau","date":"2026-05-06","montant":176.25,"aPayer":True,"du":"2025-08-20","au":"2026-01-30","conso":44,"src":"photo"},
   {"id":203,"four":"Vallée Claire","type":"eau","date":"2026-10-03","montant":121.9,"aPayer":True,"du":"2026-01-30","au":"2026-08-05","conso":27,"src":"photo","fraisId":901},
   {"id":301,"four":"EDF","type":"elec","date":"2026-10-21","montant":162.75,"prelev":"2026-11-05","conso":534,"src":"pdf"}]
data={"askName":False,"devise":"EUR","comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True}],"entries":[],"factures":B,
  "fraisCommuns":[{"id":901,"label":"Vallée Claire · à payer","montant":121.9,"personne":"Commun","recurrent":False,"month":"2026-10","fact":"eau|vallee claire","factNom":"Vallée Claire","aPayer":True}]}
def ls(pg, k): return pg.evaluate("k=>JSON.parse(localStorage.getItem(k))", k)
with sync_playwright() as p:
    b=p.chromium.launch(); c=b.new_context(viewport={'width':412,'height':900}); pg=c.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    pg.goto(APP); pg.wait_for_timeout(300)
    pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); pg.reload(); pg.wait_for_timeout(900)
    pg.locator('#nav .navi[data-view="factures"]').click(); pg.wait_for_timeout(400)
    pg.locator('.avtabs button[data-av="fact"]').click(); pg.wait_for_timeout(400)
    cards=[norm(x) for x in pg.locator(".fct-card").all_inner_texts()]
    print("  cartes :", [x.replace("\n"," · ")[:90] for x in cards])
    check(any("Vallée Claire" in x and "3 factures" in x for x in cards) and any("EDF" in x and "1 facture" in x and "1 factures" not in x for x in cards), "cartes : « 3 factures », « 1 facture »")
    pg.locator(".fct-card", has_text="Vallée Claire").click(); pg.wait_for_timeout(500)
    rows=lambda: [norm(x) for x in pg.locator(".fct-row").all_inner_texts()]
    check(len(rows())==3 and "03/10/2026" in rows()[0], "détail : 3 factures, la plus récente en haut")
    # toucher : modifier
    pg.locator(".fct-row").nth(0).click(); pg.wait_for_timeout(300)
    check(pg.locator("#fe-mt").count()==1 and pg.locator("#fe-date").input_value()=="2026-10-03" and pg.locator("#fe-conso").input_value()=="27", "toucher une facture : sa fiche à modifier")
    pg.locator("#fe-mt").fill("125,40"); pg.locator("#fe-conso").fill("28")
    pg.locator("#feOk").click(); pg.wait_for_timeout(500)
    f=[x for x in ls(pg,"factures") if x["id"]==203][0]; fr=[x for x in ls(pg,"fraisCommuns") if x["id"]==901][0]
    check(abs(f["montant"]-125.4)<0.001 and f["conso"]==28 and abs(fr["montant"]-125.4)<0.001, "Enregistrer : montant et m³ changés, le « à payer » suit (125,40 €)")
    check("125,40" in rows()[0], "la liste montre 125,40 €")
    # appui long : Modifier / Supprimer
    pg.locator(".fct-row").nth(0).click(button="right"); pg.wait_for_timeout(300)
    ch=[norm(x) for x in pg.locator(".sheet-overlay .ui-stack button").all_inner_texts()]
    check(pg.locator("#fe-mt").count()==0 and any("Modifier" in x for x in ch) and any("Supprimer" in x for x in ch), "appui long : menu Modifier / Supprimer %s"%ch)
    pg.locator(".sheet-overlay button", has_text="Supprimer").click(); pg.wait_for_timeout(400)
    check(len(rows())==2 and not any(x["id"]==203 for x in ls(pg,"factures")) and not any(x["id"]==901 for x in ls(pg,"fraisCommuns")), "Supprimer : la facture et son « à payer » disparaissent")
    check(pg.locator(".ui-toast.undo").count()==1, "message avec « Annuler »")
    pg.locator(".ui-toast.undo button").click(); pg.wait_for_timeout(400)
    check(len(rows())==3 and any(x["id"]==203 for x in ls(pg,"factures")) and any(x["id"]==901 for x in ls(pg,"fraisCommuns")), "Annuler : tout revient")
    # supprimer depuis la fiche, la plus ancienne
    pg.locator(".fct-row").nth(2).click(); pg.wait_for_timeout(300)
    pg.locator("#feDel").click(); pg.wait_for_timeout(400)
    check(len(rows())==2 and not any(x["id"]==201 for x in ls(pg,"factures")), "« Supprimer » dans la fiche")
    pg.wait_for_timeout(6500)
    check(not any(x["id"]==201 for x in ls(pg,"factures")), "… et elle reste supprimée après le message")
    # renommer le fournisseur : la série suit
    pg.locator(".fct-row").nth(0).click(); pg.wait_for_timeout(300)
    pg.locator("#fe-four").fill("Syndicat Vallée Claire"); pg.locator("#feOk").click(); pg.wait_for_timeout(400)
    ch=[norm(x) for x in pg.locator(".sheet-overlay .ui-stack button").all_inner_texts()]
    check(any("Toutes ses factures (2)" in x for x in ch) and any("Seulement celle-ci" in x for x in ch), "renommer : « Toutes ses factures (2) » ou « Seulement celle-ci » %s"%ch)
    pg.locator(".sheet-overlay button", has_text="Toutes ses factures").click(); pg.wait_for_timeout(500)
    F=[x for x in ls(pg,"factures") if x["type"]=="eau"]
    check(len(F)==2 and all(x["four"]=="Syndicat Vallée Claire" for x in F) and "Syndicat Vallée Claire" in norm(pg.locator(".htitle").inner_text()) and len(rows())==2, "toutes renommées, la page suit (une seule série)")
    check(all(x.get("fact")=="eau|syndicat vallee claire" for x in ls(pg,"fraisCommuns") if x["id"]==901) and ls(pg,"factAlias").get("vallee claire")=="Syndicat Vallée Claire", "le « à payer » suit, et les prochaines factures lues prendront ce nom")
    # renommer une seule facture : elle part dans une autre série
    pg.locator(".fct-row").nth(1).click(); pg.wait_for_timeout(300)
    pg.locator("#fe-four").fill("Autre Syndicat"); pg.locator("#feOk").click(); pg.wait_for_timeout(400)
    pg.locator(".sheet-overlay button", has_text="Seulement celle-ci").click(); pg.wait_for_timeout(500)
    check(len(rows())==1 and sorted(x["four"] for x in ls(pg,"factures") if x["type"]=="eau")==["Autre Syndicat","Syndicat Vallée Claire"], "« Seulement celle-ci » : elle seule change de fournisseur")
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
print("\n%d échec(s)"%len(fails))
