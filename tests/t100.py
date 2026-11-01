# Une facture payée par une provision : depuis la provision (« + Prélèvement » propose les factures récentes,
# celles de son fournisseur ou de son type d'abord), depuis le détail du fournisseur (« Lier » une provision qui
# existe) ou depuis la fiche de la facture (« Payer avec une provision »). Chaque fois, la même feuille : la facture va
# dans les comptes ET est retirée de la provision (un seul geste). Données inventées.
import sys, os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
SP=(sys.argv[1] if len(sys.argv)>1 else HERE); APP='file://'+ROOT+'/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def norm(t): return t.replace(" "," ").replace("\xa0"," ")
B=[{"id":202,"four":"Vallée Claire","type":"eau","date":"2026-05-06","montant":176.25,"aPayer":True,"conso":44,"src":"photo"},
   {"id":203,"four":"Vallée Claire","type":"eau","date":"2026-10-28","montant":157.77,"aPayer":True,"conso":33,"src":"photo"},
   {"id":301,"four":"EDF","type":"elec","date":"2026-10-21","montant":88.43,"prelev":"2026-11-05","conso":387,"src":"pdf"}]
PV=[{"id":11,"nom":"Eau","mensuel":20,"soldeInitial":200,"startMonth":"2026-01","prelevements":[]},
    {"id":12,"nom":"Énergie","mensuel":40,"soldeInitial":100,"startMonth":"2026-01","prelevements":[]}]
data={"askName":False,"devise":"EUR","comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True}],"entries":[],"factures":B,"provisions":PV,"fraisCommuns":[]}
def ls(pg, k): return pg.evaluate("k=>JSON.parse(localStorage.getItem(k))", k)
with sync_playwright() as p:
    b=p.chromium.launch()
    def start(d):
        c=b.new_context(viewport={'width':412,'height':900}); pg=c.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
        pg.goto(APP); pg.wait_for_timeout(300)
        pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", d); pg.reload(); pg.wait_for_timeout(900)
        return c, pg, errs
    def choices(pg): return [norm(x) for x in pg.locator(".sheet-overlay .ui-stack button").all_inner_texts()]
    # ---------- 1. depuis la provision
    c, pg, errs = start(data)
    pg.locator('#nav .navi[data-view="factures"]').click(); pg.wait_for_timeout(300)
    pg.locator('.avtabs button[data-av="prov"]').click(); pg.wait_for_timeout(400)
    pg.locator('.addprl[data-id="11"]').click(); pg.wait_for_timeout(300)
    ch=choices(pg); print("  choix :", ch)
    check(len(ch)>=3 and ch[0].startswith("Vallée Claire · 28/10/2026") and any(x.startswith("EDF") for x in ch) and "Autre montant…" in ch and not any("06/05/2026" in x for x in ch), "« + Prélèvement » de « Eau » : la facture d'eau d'abord, puis les autres récentes, « Autre montant… »")
    pg.locator(".sheet-overlay button", has_text="Vallée Claire · 28/10/2026").click(); pg.wait_for_timeout(500)
    sh=norm(pg.locator(".sheet-overlay").last.inner_text())
    check("Payée avec la provision « Eau »" in sh and pg.locator('.sheet-overlay input[data-k="acc"]').is_checked() and pg.locator('.sheet-overlay input[data-k="prov"]').is_checked(), "une seule feuille : dans le compte et retirée de « Eau », les deux cochés")
    pg.locator("#fpfOk").click(); pg.wait_for_timeout(500)
    P=[x for x in ls(pg,"provisions") if x["id"]==11][0]; f=[x for x in ls(pg,"factures") if x["id"]==203][0]
    fr=[x for x in ls(pg,"fraisCommuns") if str(x["id"])==str(f.get("fraisId"))]
    check(len(fr)==1 and fr[0].get("pp")==11 and abs(fr[0]["montant"]-157.77)<0.001, "et la facture est dans les comptes (« payée par « Eau » », hors parts)")
    check(len(P["prelevements"])==1 and abs(P["prelevements"][0]["montant"]-157.77)<0.001 and P["prelevements"][0]["month"]=="2026-10" and f.get("prId")==P["prelevements"][0]["id"], "prélèvement de 157,77 € en octobre, lié à la facture")
    check(P.get("fact")=="eau|vallee claire", "la provision suit maintenant ce fournisseur")
    pg.locator('.addprl[data-id="11"]').click(); pg.wait_for_timeout(300)
    check(not any("28/10/2026" in x for x in choices(pg)), "la facture payée n'est plus proposée")
    pg.locator(".sheet-overlay .ui-no").click(); pg.wait_for_timeout(200)
    pg.locator('.avtabs button[data-av="fact"]').click(); pg.wait_for_timeout(300)
    pg.locator(".fct-card", has_text="Vallée Claire").click(); pg.wait_for_timeout(400)
    check("Provision « Eau »" in norm(pg.locator("#app").inner_text()) and "payée par « Eau »" in norm(pg.locator(".fct-row").nth(0).inner_text()), "détail : la provision « Eau » en haut, la facture « payée par « Eau » »")
    pg.locator(".fct-row").nth(0).click(); pg.wait_for_timeout(300)
    check("Payée par la provision « Eau »" in norm(pg.locator(".sheet-overlay").last.inner_text()) and pg.locator("#fePrv").count()==0, "fiche : « Payée par la provision « Eau » »")
    pg.locator(".sheet-overlay .ui-actions .btn.primary").click(); pg.wait_for_timeout(300)
    # supprimer la facture retire son prélèvement
    pg.locator(".fct-row").nth(0).click(button="right"); pg.wait_for_timeout(300)
    pg.locator(".sheet-overlay button", has_text="Supprimer").click(); pg.wait_for_timeout(400)
    check(len([x for x in ls(pg,"provisions") if x["id"]==11][0]["prelevements"])==0, "supprimer la facture retire le prélèvement de la provision")
    check(not errs, "pas d'erreur %s"%errs[:3]); c.close()
    # ---------- 2. depuis le fournisseur : « Lier »
    c, pg, errs = start(data)
    pg.locator('#nav .navi[data-view="factures"]').click(); pg.wait_for_timeout(300)
    pg.locator('.avtabs button[data-av="fact"]').click(); pg.wait_for_timeout(300)
    pg.locator(".fct-card", has_text="Vallée Claire").click(); pg.wait_for_timeout(400)
    check(pg.locator("#fsLink").count()==1 and pg.locator("#fsProv").count()==1, "détail sans provision : « Lier » et « Créer »")
    pg.locator("#fsLink").click(); pg.wait_for_timeout(300)
    pg.locator(".sheet-overlay button", has_text="Eau").first.click(); pg.wait_for_timeout(500)
    sh=norm(pg.locator(".sheet-overlay").last.inner_text())
    check("Facture du 28/10/2026 · 157,77" in sh and "Payée avec la provision « Eau »" in sh, "« Lier » « Eau » : la feuille pour la dernière facture (28/10/2026, 157,77 €)")
    pg.locator("#fpfOk").click(); pg.wait_for_timeout(500)
    P=[x for x in ls(pg,"provisions") if x["id"]==11][0]
    check(P.get("fact")=="eau|vallee claire" and len(P["prelevements"])==1 and "Provision « Eau »" in norm(pg.locator("#app").inner_text()), "liée et payée ; le détail montre la provision")
    check(not errs, "pas d'erreur %s"%errs[:3]); c.close()
    # ---------- 3. depuis la fiche d'une facture
    c, pg, errs = start(data)
    pg.locator('#nav .navi[data-view="factures"]').click(); pg.wait_for_timeout(300)
    pg.locator('.avtabs button[data-av="fact"]').click(); pg.wait_for_timeout(300)
    pg.locator(".fct-card", has_text="EDF").click(); pg.wait_for_timeout(400)
    pg.locator(".fct-row").nth(0).click(); pg.wait_for_timeout(300)
    pg.locator("#fePrv").click(); pg.wait_for_timeout(300)
    pg.locator(".sheet-overlay button", has_text="Énergie").click(); pg.wait_for_timeout(500)
    pg.locator("#fpfOk").click(); pg.wait_for_timeout(500)
    P=[x for x in ls(pg,"provisions") if x["id"]==12][0]
    check(len(P["prelevements"])==1 and P["prelevements"][0]["month"]=="2026-11" and abs(P["prelevements"][0]["montant"]-88.43)<0.001 and P.get("fact")=="elec|edf", "« Payer avec une provision » → « Énergie » : prélèvement de novembre (mois du prélèvement EDF)")
    check(not errs, "pas d'erreur %s"%errs[:3]); c.close()
    b.close()
print("\n%d échec(s)"%len(fails))
