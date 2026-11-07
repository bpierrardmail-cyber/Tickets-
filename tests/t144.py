# Provision : la mise de côté va d'un compte à l'autre (07/11, demande de Benoît). Données inventées.
# 1. « Provision · Amazon » sort du compte courant et ENTRE sur le compte commun (où est l'argent) : soldes, Opérations, un seul rond « fait » ;
# 2. provision sur un livret : cocher la mise de côté augmente la valeur du livret, décocher la remet ;
# 3. réglage « Chaque mois » : Qui paie ? · Prélevé sur · Mis de côté sur · Suivre, avec le trajet de l'argent ; changer qui paie change le compte prélevé ;
# 4. relevé du compte commun : l'entrée de 6 € est reconnue comme la mise de côté (déjà là) et la coche.
import sys, os, json, tempfile
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
APP='file://'+ROOT+'/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def norm(t): return t.replace(" "," ").replace("\xa0"," ")
def fig(t, lbl, n=60):
    i=t.find(lbl); return t[i:i+n].replace("\n"," ") if i>=0 else ""
data={"askName":False,"devise":"EUR","welcomeSeen":True,"taxoV2":2,"taxoV3":3,"taxoV4":4,"personnes":[{"nom":"Marie"}],
  "comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True},{"key":"commun","nom":"Compte commun","payer":""},{"key":"marie","nom":"Compte Marie","payer":"Marie"}],
  "soldeInit":{"Alex":{"2026-07":1000},"commun":{"2026-07":100},"marie":{"2026-07":500}},
  "epargne":[{"id":301,"nom":"Livret A","owner":"Alex","vals":{"2026-07":1000}}],
  "provisions":[{"id":11,"nom":"Amazon","mensuel":6,"soldeInitial":0,"startMonth":"2026-07","prelevements":[],"ou":"cpt:commun"},
                {"id":12,"nom":"Eau","mensuel":20,"soldeInitial":0,"startMonth":"2026-07","prelevements":[],"ou":"ep:301"}],
  "fraisCommuns":[{"id":1,"label":"Provision · Amazon","montant":6,"personne":"Commun","recurrent":True,"startMonth":"2026-07","jour":5,"prov":11,"provFrom":"2026-07",
                   "doneMonths":{"2026-07":True,"2026-08":True,"2026-09":True}},
                  {"id":2,"label":"Provision · Eau","montant":20,"personne":"Commun","recurrent":True,"startMonth":"2026-07","jour":5,"prov":12,"provFrom":"2026-07",
                   "doneMonths":{"2026-07":True,"2026-08":True,"2026-09":True}}],
  "compteSel":"commun"}
with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    c=b.new_context(viewport={'width':412,'height':900}); pg=c.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    def load():
        pg.goto(APP); pg.wait_for_timeout(300)
        pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); pg.reload(); pg.wait_for_timeout(1200)
    def ls(k): return pg.evaluate("k=>JSON.parse(localStorage.getItem(k))", k)
    def ops(acct):
        pg.evaluate("k=>localStorage.setItem('compteSel', JSON.stringify(k))", acct); pg.reload(); pg.wait_for_timeout(900)
        pg.locator('#nav .navi[data-view="compte"]').click(); pg.wait_for_timeout(600); return norm(pg.locator("#app").inner_text())
    load()
    # 1. compte commun : 100 + 3 × 6 € reçus (juillet à septembre), octobre à venir
    t=ops("commun")
    print("  commun :", fig(t, "Solde estimé", 50), "|", fig(t, "Provision · Amazon", 70))
    check("118,00" in t, "compte commun : 100 € + 3 mises de côté reçues = 118 € à la banque")
    check("Provision · depuis Compte courant" in t and "+6,00" in fig(t, "Provision · Amazon", 80), "compte commun : « Provision · Amazon · depuis Compte courant +6 € » à venir")
    pg.locator('#opsBody .ops-ck[data-k="f"][data-id="1"]').click(); pg.wait_for_timeout(500); t=norm(pg.locator("#app").inner_text())
    hero=norm(pg.locator(".ops-sum .dash-big").inner_text()).replace(" ","")
    check("124,00" in t and hero.startswith("124"), "cocher sur le compte commun : 124 € à la banque, dans la grande carte aussi (%s)"%hero)
    check(ls("fraisCommuns")[0]["doneMonths"].get("2026-10")==True, "un seul rond : le frais est « fait » en octobre (des deux côtés)")
    t=ops("Alex")
    check("Provision · Amazon" in t and "−6,00" in fig(t, "Provision · Amazon", 60), "compte courant : la mise de côté est sortie (−6 €)")
    check(pg.locator('#opsBody .ops-ck[data-k="f"][data-id="1"]').count()==0, "compte courant : plus « à venir » (coché depuis le compte commun)")
    # 2. livret : cocher la mise de côté de l'Eau → +20 € sur le Livret A, décocher → retiré
    pg.locator('#opsBody .ops-ck[data-k="f"][data-id="2"]').click(); pg.wait_for_timeout(500)
    ep=ls("epargne")[0]; v=ep["vals"][max(ep["vals"])]
    check(abs(v-1020)<0.01, "livret : cocher la mise de côté (20 €) → Livret A 1 020 € (%s)"%v)
    pg.locator('#opsBody .ops-open[data-k="f"][data-id="2"][data-done="1"]').first.click(); pg.wait_for_timeout(400)
    pg.locator(".sheet-overlay button", has_text="Pas encore passé").first.click(); pg.wait_for_timeout(500)
    ep=ls("epargne")[0]; v=ep["vals"][max(ep["vals"])]
    check(abs(v-1000)<0.01 and not ls("fraisCommuns")[1]["doneMonths"].get("2026-10"), "livret : décocher → Livret A revient à 1 000 € (%s)"%v)
    # 2 bis. le solde de la provision ne grandit qu'au « fait » (décision du 07/11) : mois de départ (juillet) = montant de départ ; août, septembre, octobre
    pg2=pg
    pg2.locator('#nav .navi[data-view="factures"]').click(); pg2.wait_for_timeout(500)
    pg2.locator('.avtabs button', has_text="Provisions").click(); pg2.wait_for_timeout(600)
    card=norm(pg2.locator(".pcard", has=pg2.locator(".pname", has_text="Amazon")).inner_text())
    print("  provision :", card.replace("\n"," | ")[:200])
    check("18,00" in card and "fait ce mois-ci" in card, "provision Amazon cochée en octobre (sur le compte commun) : 3 × 6 = 18 € de côté, « ✓ fait ce mois-ci »")
    card=norm(pg2.locator(".pcard", has=pg2.locator(".pname", has_text="Eau")).inner_text())
    check("40,00" in card and "pas encore fait" in card, "provision Eau décochée en octobre : 40 € (août, septembre), octobre pas compté, « pas encore fait ce mois-ci »")
    c.close()
    # 3. le réglage d'une provision
    c=b.new_context(viewport={'width':412,'height':900}); pg=c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    load()
    pg.locator('#nav .navi[data-view="factures"]').click(); pg.wait_for_timeout(500)
    pg.locator('.avtabs button', has_text="Provisions").click(); pg.wait_for_timeout(600)
    pg.locator(".pcard", has=pg.locator(".pname", has_text="Amazon")).locator(".btn.more").click(); pg.wait_for_timeout(250)
    pg.locator(".sheet-overlay button", has_text="Modifier").first.click(); pg.wait_for_timeout(400)
    sh=norm(pg.locator(".sheet-overlay").last.inner_text()) if pg.locator(".sheet-overlay").count() else ""
    print("  réglage :", sh[sh.find("Qui paie"):sh.find("Qui paie")+330].replace("\n"," | ") if "Qui paie" in sh else sh[:200])
    check("Qui paie ?" in sh and "Prélevé sur" in sh and "Mis de côté sur" in sh and "Suivre dans les frais fixes" in sh and "Remplie par" not in sh, "réglage : Qui paie ? · Prélevé sur · Mis de côté sur · Suivre (plus de « Remplie par »)")
    check("Compte courant −6,00 € → Compte commun +6,00 €" in sh and "parts du foyer" in sh, "réglage : le trajet « Compte courant −6 € → Compte commun +6 € », compté dans les parts du foyer")
    if "Qui paie ?" in sh:
        pg.locator('.sheet-overlay .ui-seg button[data-v="Marie"]').click(); pg.wait_for_timeout(300)
        sh=norm(pg.locator(".sheet-overlay").last.inner_text())
        check("Compte Marie −6,00 € → Compte commun" in sh and "dépenses de Marie" in sh, "Qui paie ? Marie : prélevé sur Compte Marie")
        pg.locator('.sheet-overlay button[type="submit"]').click(); pg.wait_for_timeout(600)
        f=[x for x in ls("fraisCommuns") if x.get("prov")==11][0]
        check(f["personne"]=="Marie" and f.get("compte")=="marie", "enregistré : la mise de côté est payée par Marie, depuis son compte")
    # 4. relevé du compte commun : l'entrée de 6 € d'octobre
    load()
    tmp=tempfile.mkdtemp(); csv=os.path.join(tmp,"releve_fictif.csv")
    open(csv,"w",encoding="utf-8").write("Date;Libellé;Montant\n06/10/2026;VIR DEPUIS COMPTE COURANT;6,00\n12/10/2026;CB BOULANGERIE FICTIVE;-3,00\n")
    pg.evaluate("()=>localStorage.setItem('compteSel', JSON.stringify('commun'))"); pg.reload(); pg.wait_for_timeout(900)
    pg.locator('#nav .navi[data-view="compte"]').click(); pg.wait_for_timeout(500)
    pg.locator("#cptGear").click(); pg.wait_for_timeout(300)
    pg.locator(".sheet-overlay button", has_text="Importer un relevé").first.click(); pg.wait_for_timeout(400)
    with pg.expect_file_chooser() as fcx: pg.locator("#impPick").click()
    fcx.value.set_files(csv); pg.wait_for_timeout(900)
    L=[norm(x) for x in pg.locator(".imp-l").all_inner_texts()]; print("  relevé :", L)
    check(any("Déjà en provision" in l and "+6,00" in l for l in L), "relevé : l'entrée de 6 € est reconnue comme la mise de côté Amazon")
    pg.locator('[data-imp="go"]').click(); pg.wait_for_timeout(700)
    yes=pg.locator(".sheet-overlay .ui-yes")
    if yes.count(): yes.last.click(); pg.wait_for_timeout(600)
    check(ls("fraisCommuns")[0]["doneMonths"].get("2026-10")==True and not [v for v in (ls("virements") or []) if v.get("montant")==6], "après l'import : mise de côté d'octobre « faite », pas de virement en double")
    c.close()
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
print("\n%d échec(s)"%len(fails)); sys.exit(1 if fails else 0)
