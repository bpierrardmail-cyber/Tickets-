# Provisions reliées aux frais fixes, au Commun et aux comptes. Données inventées.
# - la mise de côté d'une provision est un frais fixe « Provision · nom » (un ancien frais « Eau 20 € » est relié, pas doublé) ;
# - l'argent qui reste sur le compte courant n'en sort pas ; vers un livret, il en sort ;
# - une facture payée par la provision : un seul geste (compte + provision, virement du livret en option), hors parts du Commun ;
# - « Sauter ce mois », montant, « Remplie par », « Ne plus la compter » restent d'accord des deux côtés ;
# - import d'un relevé : le versement de plusieurs provisions d'un coup est reconnu (frais fixes déjà là).
import sys, os, re, tempfile
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
SP=(sys.argv[1] if len(sys.argv)>1 else HERE); APP='file://'+ROOT+'/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def norm(t): return t.replace(" "," ").replace("\xa0"," ")
EAU="eau|syndicat des eaux"; GAZ="gaz|gaz du nord"
data={"askName":False,"devise":"EUR","personnes":[{"nom":"Sam"}],"communParts":{"Alex":50,"Sam":50},
  "comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True},{"key":"sam","nom":"Compte Sam","payer":"Sam"}],
  "epargne":[{"id":301,"nom":"Livret A","owner":"Alex","vals":{"2026-10":1000}}],
  "provisions":[
    {"id":11,"nom":"Eau","mensuel":20,"soldeInitial":200,"startMonth":"2026-06","prelevements":[],"ou":"ep:301","fact":EAU},
    {"id":12,"nom":"Taxe","mensuel":50,"soldeInitial":0,"startMonth":"2026-09","prelevements":[],"ou":"cpt"},
    {"id":13,"nom":"Assurance","mensuel":10,"soldeInitial":0,"startMonth":"2026-10","prelevements":[],"noFrais":True},
    {"id":14,"nom":"Chauffage","mensuel":30,"soldeInitial":0,"startMonth":"2026-08","prelevements":[],"ou":"ep:301","fact":GAZ}],
  "fraisCommuns":[
    {"id":1,"label":"Loyer","montant":650,"personne":"Commun","recurrent":True,"startMonth":"2026-01","jour":5},
    # l'ancien frais qui faisait la mise de côté de « Eau » ; une facture l'avait retiré en octobre
    {"id":2,"label":"Eau","montant":20,"personne":"Commun","recurrent":True,"startMonth":"2026-03","skipMonths":{"2026-10":True}},
    {"id":900,"label":"Syndicat des eaux · facture du 03/10","montant":121.9,"personne":"Commun","recurrent":False,"month":"2026-10","fact":EAU,"factNom":"Syndicat des eaux","jour":15}],
  "factures":[
    {"id":801,"four":"Syndicat des eaux","type":"eau","date":"2026-10-03","montant":121.9,"prelev":"2026-10-15","conso":27,"src":"photo","fraisId":900},
    {"id":803,"four":"Gaz du Nord","type":"gaz","date":"2026-10-20","montant":75,"prelev":"2026-11-04","conso":640,"src":"pdf"}],
  "entries":[]}
def ls(pg, k): return pg.evaluate("k=>JSON.parse(localStorage.getItem(k))", k)
def fr(pg, **kw): return [x for x in ls(pg,"fraisCommuns") if all(x.get(k)==v for k,v in kw.items())]
def prov(pg, i): return [x for x in ls(pg,"provisions") if x["id"]==i][0]
def menu(pg, nom, act):   # le ⋯ d'une provision → Modifier / Supprimer
    pg.locator(".pcard", has=pg.locator(".pname", has_text=nom)).locator(".btn.more").click(); pg.wait_for_timeout(250)
    pg.locator(".sheet-overlay button", has_text=act).first.click(); pg.wait_for_timeout(300)
def money(t):
    m=re.search(r"[-−]?\d[\d ]*(?:,\d+)?", norm(t)); return float(m.group(0).replace(" ","").replace("−","-").replace(",",".")) if m else None
with sync_playwright() as p:
    b=p.chromium.launch(); c=b.new_context(viewport={'width':412,'height':900}); pg=c.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    pg.goto(APP); pg.wait_for_timeout(300)
    pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); pg.reload(); pg.wait_for_timeout(1000)
    def av(sub):
        pg.locator('#nav .navi[data-view="factures"]').click(); pg.wait_for_timeout(300)
        pg.locator('.avtabs button[data-av="%s"]'%sub).click(); pg.wait_for_timeout(400)
    # ---------- 1. la mise de côté devient un frais fixe
    eau=fr(pg, prov=11); taxe=fr(pg, prov=12); ch=fr(pg, prov=14)
    check(len(eau)==1 and eau[0]["id"]==2 and eau[0]["label"]=="Provision · Eau" and eau[0].get("provFrom")=="2026-10" and not (eau[0].get("skipMonths") or {}).get("2026-10"),
          "l'ancien frais « Eau 20 € » est relié à la provision (pas de doublon), la facture ne le retire plus en octobre")
    check(len(taxe)==1 and taxe[0]["personne"]=="Commun" and taxe[0]["startMonth"]=="2026-10" and taxe[0]["montant"]==50 and len(ch)==1,
          "« Provision · Taxe » et « Provision · Chauffage » créés (Commun, à partir d'octobre)")
    check(not fr(pg, prov=13), "« Assurance » (pas dans les frais fixes) : aucun frais")
    av("frais")
    t=norm(pg.locator("#app").inner_text())
    check("Provision · Eau" in t and "vers Livret A" in t and "reste sur Compte courant" in t and pg.locator(".fxpill").count()==3, "Frais fixes : « mise de côté », vers Livret A / reste sur le compte courant")
    pg.screenshot(path=os.path.join(SP,"t101_frais.png"), full_page=True)
    # le compte : la Taxe (argent gardé sur le compte courant) n'en sort pas, l'Eau et le Chauffage (vers le livret) oui
    pg.locator('#nav .navi[data-view="compte"]').click(); pg.wait_for_timeout(500)
    t=norm(pg.locator("#app").inner_text())
    check("Provision · Eau" in t and "Provision · Chauffage" in t and "Provision · Taxe" not in t, "Compte : la mise de côté vers le livret sort du compte, celle qui reste sur le compte courant non")
    # ---------- 2. Commun : avant / après le retrait de la facture d'eau
    pg.locator('#nav .navi[data-view="communes"]').click(); pg.wait_for_timeout(400)
    v0=money(pg.locator('.cfx-sec[data-k="fc"] .cfx-h .v').inner_text())
    check(abs(v0-(650+20+50+30+121.9))<0.01, "Commun avant : la facture d'eau compte encore dans les parts (%s)"%v0)
    # la provision signale la facture déjà dans les comptes mais pas retirée
    av("prov")
    card=pg.locator(".pcard", has_text="Eau").first
    check("1 facture pas encore retirée" in norm(card.inner_text()) and "frais fixe Commun" in norm(card.inner_text()), "provision « Eau » : « 1 facture pas encore retirée », remplie par le Commun")
    card.locator(".pvret").click(); pg.wait_for_timeout(400)
    sh=norm(pg.locator(".sheet-overlay").last.inner_text())
    check("Déjà dans tes comptes" in sh and pg.locator('.sheet-overlay input[data-k="prov"]').is_checked() and pg.locator('.sheet-overlay input[data-k="acc"]').count()==0 and pg.locator('.sheet-overlay input[data-k="vir"]').count()==1,
          "« Retirer » : déjà dans les comptes ; retrait de la provision coché ; virement du livret proposé")
    pg.screenshot(path=os.path.join(SP,"t101_retirer.png"))
    pg.locator("#fpfOk").click(); pg.wait_for_timeout(500)
    P=prov(pg, 11); f=[x for x in ls(pg,"factures") if x["id"]==801][0]
    check(len(P["prelevements"])==1 and abs(P["prelevements"][0]["montant"]-121.9)<0.001 and f.get("prId")==P["prelevements"][0]["id"] and fr(pg, id=900)[0].get("pp")==11,
          "retirée de « Eau » (121,90 €), la facture est « payée par la provision »")
    check("pas encore retirée" not in norm(pg.locator("#app").inner_text()), "plus de facture à retirer")
    pg.locator('#nav .navi[data-view="communes"]').click(); pg.wait_for_timeout(400)
    v1=money(pg.locator('.cfx-sec[data-k="fc"] .cfx-h .v').inner_text())
    check(abs(v1-(650+20+50+30))<0.01 and "hors parts" in norm(pg.locator("#app").inner_text()), "Commun après : la facture payée par la provision est hors parts (%s), la mise de côté y reste"%v1)
    # ---------- 3. une facture pas encore dans les comptes : « Ajouter » fait les deux côtés (+ virement du livret)
    av("fact")
    pg.locator(".fct-card", has_text="Gaz du Nord").click(); pg.wait_for_timeout(400)
    ban=norm(pg.locator(".fct-miss").inner_text())
    check("Pas dans tes comptes ni retirée de « Chauffage »" in ban, "fournisseur : « Pas dans tes comptes ni retirée de « Chauffage » »")
    pg.locator("[data-addacc]").click(); pg.wait_for_timeout(400)
    check(pg.locator('.sheet-overlay input[data-k="acc"]').is_checked() and pg.locator('.sheet-overlay input[data-k="prov"]').is_checked() and not pg.locator('.sheet-overlay input[data-k="vir"]').is_checked(),
          "« Ajouter » : compte et provision cochés, virement du livret en option")
    pg.locator('.sheet-overlay input[data-k="vir"]').check()
    pg.screenshot(path=os.path.join(SP,"t101_ajouter.png"))
    pg.locator("#fpfOk").click(); pg.wait_for_timeout(500)
    f=[x for x in ls(pg,"factures") if x["id"]==803][0]; x=fr(pg, id=f.get("fraisId")); P=prov(pg, 14)
    v=[y for y in ls(pg,"virements") or [] if y.get("epargneId")==301]
    check(len(x)==1 and x[0]["month"]=="2026-11" and x[0].get("pp")==14 and x[0]["personne"]=="Commun" and len(P["prelevements"])==1 and P["prelevements"][0]["month"]=="2026-11",
          "le prélèvement de novembre dans le compte (hors parts) et le retrait de « Chauffage » en novembre")
    check(len(v)==1 and v[0]["montant"]==75 and v[0]["month"]=="2026-11" and v[0]["person"]=="Alex" and not v[0].get("done"), "virement Livret A → compte courant de 75 € en novembre (à cocher « fait »)")
    check(not fr(pg, prov=14)[0].get("skipMonths"), "la mise de côté de novembre continue")
    check(pg.locator(".fct-miss").count()==0, "plus de bandeau")
    # ---------- 4. sauter un mois, changer le montant, « Remplie par »
    av("prov")
    pg.locator('.prskip[data-id="11"]').click(); pg.wait_for_timeout(300)
    check((fr(pg, prov=11)[0].get("skipMonths") or {}).get("2026-10"), "« Sauter ce mois » sur la provision : le frais est retiré d'octobre")
    av("frais")
    check("Retirés de octobre 2026" in norm(pg.locator("#app").inner_text()), "Frais fixes : « Provision · Eau » dans les retirés du mois")
    pg.locator(".fxunskip").click(); pg.wait_for_timeout(300)
    check("2026-10" not in (prov(pg, 11).get("skips") or []) and not (fr(pg, prov=11)[0].get("skipMonths") or {}).get("2026-10"), "« Rétablir » sur le frais : la provision suit")
    row=pg.locator(".fxrow", has_text="Provision · Eau")
    row.locator(".fxmore").click(); pg.wait_for_timeout(200)
    pg.locator(".sheet-overlay button", has_text="Modifier").click(); pg.wait_for_timeout(300)
    check(pg.locator(".ui-field", has_text="Depuis le mois").count()==0 and "Mise de côté de la provision « Eau »" in norm(pg.locator(".sheet-overlay").last.inner_text()), "modifier le frais : pas de début / fin, c'est la provision qui décide")
    inp=pg.locator(".ui-field", has_text="Montant").first.locator("input"); inp.fill("25")
    pg.locator(".sheet-overlay .ui-actions button[type=submit]").click(); pg.wait_for_timeout(400)
    check((prov(pg, 11).get("mensuelChanges") or {}).get("2026-10")==25 and fr(pg, prov=11)[0]["amounts"].get("2026-10")==25, "montant changé sur le frais (25 €) : la provision suit")
    av("prov")
    menu(pg, "Taxe", "Modifier")
    pg.locator(".ui-field", has_text="Remplie par").locator("select").select_option("Sam")
    pg.locator(".sheet-overlay .ui-actions button[type=submit]").click(); pg.wait_for_timeout(400)
    check(fr(pg, prov=12)[0]["personne"]=="Sam", "« Remplie par » Sam : la mise de côté de « Taxe » devient un frais de Sam")
    # « Ne plus la compter dans les frais fixes » (depuis le frais)
    av("frais")
    pg.locator(".fxrow", has_text="Provision · Eau").locator(".fxmore").click(); pg.wait_for_timeout(200)
    pg.locator(".sheet-overlay button", has_text="Supprimer").click(); pg.wait_for_timeout(300)
    ch2=norm(pg.locator(".sheet-overlay").last.inner_text())
    check("C'est la mise de côté de la provision « Eau »" in ch2 and "Sauter octobre 2026" in ch2 and "Supprimer la provision « Eau »" in ch2, "supprimer le frais relié : sauter le mois, ne plus le compter, ou supprimer la provision")
    pg.locator(".sheet-overlay button", has_text="Ne plus la compter").click(); pg.wait_for_timeout(400)
    old=fr(pg, id=2)[0]
    check(prov(pg, 11).get("noFrais") and old.get("prov") is None and old.get("endMonth")=="2026-09" and not fr(pg, prov=11), "« Ne plus la compter » : l'ancien frais garde son passé et s'arrête, la provision continue")
    av("prov")
    menu(pg, "Eau", "Modifier")
    check(pg.locator(".ui-field", has_text="Remplie par").locator("select").input_value()=="__none", "la provision : « Remplie par » = « Pas dans les frais fixes »")
    pg.locator(".ui-field", has_text="Remplie par").locator("select").select_option("Commun")
    pg.locator(".sheet-overlay .ui-actions button[type=submit]").click(); pg.wait_for_timeout(400)
    nf=fr(pg, prov=11)
    check(len(nf)==1 and nf[0]["id"]!=2 and nf[0]["startMonth"]=="2026-10" and nf[0]["montant"]==25, "remise dans les frais fixes : un nouveau frais à partir du mois en cours (25 €)")
    # ---------- 5. supprimer la provision : son frais disparaît (sans passé)
    menu(pg, "Chauffage", "Supprimer")
    check("Sa mise de côté sort des frais fixes" in norm(pg.locator(".sheet-overlay").last.inner_text()), "supprimer la provision : prévient que sa mise de côté sort des frais fixes")
    pg.locator(".sheet-overlay .ui-yes").click(); pg.wait_for_timeout(400)
    check(not [x for x in ls(pg,"fraisCommuns") if x.get("label")=="Provision · Chauffage"], "provision supprimée : « Provision · Chauffage » (sans passé) n'est plus dans les frais fixes")
    check(not errs, "pas d'erreur %s"%errs[:3])
    # ---------- 6. import : le versement de 2 provisions d'un coup (Eau 20 + Chauffage 30) est reconnu
    pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); pg.reload(); pg.wait_for_timeout(900)
    tmp=tempfile.mkdtemp(); csv=os.path.join(tmp,"releve_fictif.csv")
    open(csv,"w",encoding="utf-8").write("Date;Libellé;Montant\n28/10/2026;VIR PERMANENT LIVRET;-50,00\n05/10/2026;LOYER;-650,00\n")
    pg.locator('#nav .navi[data-view="compte"]').click(); pg.wait_for_timeout(500)
    pg.locator("#cptGear").click(); pg.wait_for_timeout(300)
    pg.locator(".sheet-overlay button", has_text="Importer un relevé").first.click(); pg.wait_for_timeout(400)
    with pg.expect_file_chooser() as fcx: pg.locator("#impPick").click()
    fcx.value.set_files(csv); pg.wait_for_timeout(900)
    L=[norm(x) for x in pg.locator(".imp-l").all_inner_texts()]; print("  lignes :", L)
    hit=[l for l in L if "Livret" in l]
    check(hit and "Déjà en frais fixes (tes 2 provisions du mois)" in hit[0], "relevé : le virement de 50 € = les mises de côté « Eau » + « Chauffage », déjà là")
    pg.locator('[data-imp="go"]').click(); pg.wait_for_timeout(700)
    yes=pg.locator(".sheet-overlay .ui-yes")
    if yes.count(): yes.last.click(); pg.wait_for_timeout(600)
    check(all((x.get("doneMonths") or {}).get("2026-10") for x in [fr(pg, prov=11)[0], fr(pg, prov=14)[0]]), "après l'import : les deux mises de côté d'octobre sont « faites »")
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
print("\n%d échec(s)"%len(fails))
