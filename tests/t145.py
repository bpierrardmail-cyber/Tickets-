# Virements reliés (07/11, demande de Benoît : un lien pour chaque mouvement interne). Données inventées.
# 1. virement envoyé « Vers » un autre compte : la ligne d'en face (+) est créée, un seul rond « fait », montant modifié des deux côtés, supprimé des deux côtés ;
# 2. « Relier à un compte » après coup : une opération déjà là en face (même mois, montant opposé) est reprise, pas doublée ;
# 3. vers la Bourse (Perso) : « fait » → reste à investir et capital augmentent, décoché → reviennent ;
# 4. relevé : « VIR VERS COMMUN FICTIF » est proposé vers le compte commun, la ligne d'en face est créée ;
# 5. une provision avec deux frais reliés (ancienne erreur) : fusionnés en un seul, les « fait » gardés.
import sys, os, json, tempfile
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
APP='file://'+ROOT+'/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def norm(t): return t.replace(" "," ").replace("\xa0"," ")
data={"askName":False,"devise":"EUR","welcomeSeen":True,"taxoV2":2,"taxoV3":3,"taxoV4":4,"personnes":[{"nom":"Marie"}],
  "comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True},{"key":"commun","nom":"Compte commun Fictif","payer":""},{"key":"marie","nom":"Compte Marie","payer":"Marie"}],
  "soldeInit":{"Alex":{"2026-10":1000},"commun":{"2026-10":100}},
  "bourse":[{"id":501,"nom":"PEA Fictif","vals":{"2026-10":{"capital":1000,"valeur":1100,"cash":50}}}],
  "virements":[{"id":700,"person":"commun","month":"2026-10","label":"VIR RECU ALEX","montant":50,"done":True,"day":3}],
  "provisions":[{"id":11,"nom":"Amazon","mensuel":6,"soldeInitial":0,"startMonth":"2026-07","prelevements":[],"ou":"cpt:commun"}],
  "fraisCommuns":[{"id":1,"label":"Provision · Amazon","montant":6,"personne":"Commun","recurrent":True,"startMonth":"2026-10","prov":11,"provFrom":"2026-10","doneMonths":{"2026-10":True}},
                  {"id":2,"label":"Provision · Amazon","montant":6,"personne":"Commun","recurrent":True,"startMonth":"2026-10","prov":11,"provFrom":"2026-10","doneMonths":{}}],
  "compteSel":"Alex"}
with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    c=b.new_context(viewport={'width':412,'height':900}); pg=c.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    pg.goto(APP); pg.wait_for_timeout(300)
    pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); pg.reload(); pg.wait_for_timeout(1200)
    def ls(k): return pg.evaluate("k=>JSON.parse(localStorage.getItem(k))", k)
    def ops(acct):
        pg.evaluate("k=>localStorage.setItem('compteSel', JSON.stringify(k))", acct); pg.reload(); pg.wait_for_timeout(900)
        pg.locator('#nav .navi[data-view="compte"]').click(); pg.wait_for_timeout(600); return norm(pg.locator("#app").inner_text())
    def V(): return ls("virements")
    # 5. provision : deux frais reliés → un seul, octobre « fait » gardé
    F=[f for f in ls("fraisCommuns") if f.get("prov")==11]
    check(len(F)==1 and F[0]["doneMonths"].get("2026-10"), "provision : les deux frais reliés sont fusionnés, octobre reste « fait » (%d frais)"%len(F))
    # 1. virement envoyé vers le compte commun
    ops("Alex")
    pg.locator("#navplus").click(); pg.wait_for_timeout(300); pg.locator('.sheet-overlay .dr-row[data-k="vout"]').click(); pg.wait_for_timeout(400)
    pg.locator(".ui-field", has_text="Libellé").locator("input").fill("Épargne du mois")
    pg.locator(".ui-field", has_text="Montant").locator("input").fill("100")
    pg.locator(".ui-field", has_text="Vers").locator("select").select_option("cpt:commun")
    pg.locator('.sheet-overlay button[type="submit"]').click(); pg.wait_for_timeout(600)
    src=[v for v in V() if v.get("label")=="Épargne du mois" and v["person"]=="Alex"]; mir=[v for v in V() if src and v.get("pairOf")==src[0]["id"]]
    check(len(src)==1 and len(mir)==1 and mir[0]["person"]=="commun" and mir[0]["montant"]==100, "virement −100 € vers le compte commun : la ligne +100 € est créée en face")
    t=ops("commun")
    check("Épargne du mois" in t and "depuis Compte courant" in t, "compte commun : « Épargne du mois · depuis Compte courant » à venir")
    pg.locator('#opsBody .ops-ck[data-k="v"][data-id="%s"]' % mir[0]["id"]).click(); pg.wait_for_timeout(500)
    s2=[v for v in V() if v["id"]==src[0]["id"]][0]; m2=[v for v in V() if v["id"]==mir[0]["id"]][0]
    check(s2.get("done") and m2.get("done"), "cocher en face coche les deux")
    t=norm(pg.locator("#app").inner_text()); check("256,00" in t, "compte commun : 100 + 50 reçus + 6 (provision Amazon faite) + 100 = 256 € à la banque")
    # montant modifié depuis la ligne d'en face → l'original
    pg.locator('#opsBody .ops-open[data-k="v"][data-id="%s"]' % mir[0]["id"]).first.click(); pg.wait_for_timeout(300)
    pg.locator(".sheet-overlay button", has_text="Modifier").first.click(); pg.wait_for_timeout(300)
    check("modifier le virement" in norm(pg.locator(".sheet-overlay").last.inner_text()).lower(), "modifier la ligne d'en face ouvre le virement d'origine")
    pg.locator(".ui-field", has_text="Montant").locator("input").fill("120"); pg.locator('.sheet-overlay button[type="submit"]').click(); pg.wait_for_timeout(500)
    s2=[v for v in V() if v["id"]==src[0]["id"]][0]; m2=[v for v in V() if v.get("pairOf")==src[0]["id"]][0]
    check(s2["montant"]==-120 and m2["montant"]==120, "montant changé : −120 € / +120 €")
    # supprimer → les deux partent
    pg.locator('#opsBody .ops-open[data-k="v"][data-id="%s"]' % m2["id"]).first.click(); pg.wait_for_timeout(300)
    pg.locator(".sheet-overlay button", has_text="Supprimer").first.click(); pg.wait_for_timeout(300)
    if pg.locator(".sheet-overlay .ui-yes").count(): pg.locator(".sheet-overlay .ui-yes").last.click(); pg.wait_for_timeout(500)
    check(not [v for v in V() if v.get("label")=="Épargne du mois"], "supprimé : le virement et sa ligne d'en face sont partis")
    # 2. « Relier à un compte » : le +50 déjà là sur le commun est repris
    pg.evaluate("()=>{ var v=JSON.parse(localStorage.getItem('virements')); v.push({id:701, person:'Alex', month:'2026-10', label:'VIR VERS COMMUN', montant:-50, done:true, day:3}); localStorage.setItem('virements', JSON.stringify(v)); }")
    ops("Alex")
    pg.locator('#opsBody .ops-open[data-k="v"][data-id="701"]').first.click(); pg.wait_for_timeout(300)
    pg.locator(".sheet-overlay button", has_text="Relier à un compte").first.click(); pg.wait_for_timeout(300)
    pg.locator(".sheet-overlay button", has_text="Compte commun Fictif").first.click(); pg.wait_for_timeout(500)
    on50=[v for v in V() if v["person"]=="commun" and v["montant"]==50]
    check(len(on50)==1 and on50[0]["id"]==700 and on50[0].get("pairOf")==701, "relier après coup : le +50 € déjà sur le compte commun est repris (pas de doublon)")
    # 3. Bourse
    pg.locator("#navplus").click(); pg.wait_for_timeout(300); pg.locator('.sheet-overlay .dr-row[data-k="vout"]').click(); pg.wait_for_timeout(400)
    pg.locator(".ui-field", has_text="Libellé").locator("input").fill("Versement PEA")
    pg.locator(".ui-field", has_text="Montant").locator("input").fill("200")
    pg.locator(".ui-field", has_text="Vers").locator("select").select_option("bourse:501")
    pg.locator('.sheet-overlay button[type="submit"]').click(); pg.wait_for_timeout(500)
    vb=[v for v in V() if v.get("label")=="Versement PEA"][0]
    pg.locator('#opsBody .ops-ck[data-k="v"][data-id="%s"]' % vb["id"]).click(); pg.wait_for_timeout(500)
    bv=ls("bourse")[0]["vals"]["2026-10"]
    check(abs(bv.get("cash",0)-250)<0.01 and abs(bv["capital"]-1200)<0.01, "Bourse : « fait » → reste à investir 250 €, capital 1 200 € (%s)"%bv)
    pg.locator('#opsBody .ops-open[data-k="v"][data-id="%s"]' % vb["id"]).first.click(); pg.wait_for_timeout(300)
    pg.locator(".sheet-overlay button", has_text="Pas encore passé").first.click(); pg.wait_for_timeout(400)
    bv=ls("bourse")[0]["vals"]["2026-10"]
    check(abs(bv.get("cash",0)-50)<0.01 and abs(bv["capital"]-1000)<0.01, "Bourse : décoché → 50 € et 1 000 € (%s)"%bv)
    # 4. relevé du compte courant
    tmp=tempfile.mkdtemp(); csv=os.path.join(tmp,"releve_fictif.csv")
    open(csv,"w",encoding="utf-8").write("Date;Libellé;Montant\n15/10/2026;VIR VERS COMMUN FICTIF;-30,00\n16/10/2026;CB BOULANGERIE FICTIVE;-3,00\n")
    pg.locator("#cptGear").click(); pg.wait_for_timeout(300)
    pg.locator(".sheet-overlay button", has_text="Importer un relevé").first.click(); pg.wait_for_timeout(400)
    with pg.expect_file_chooser() as fcx: pg.locator("#impPick").click()
    fcx.value.set_files(csv); pg.wait_for_timeout(900)
    L=[norm(x) for x in pg.locator(".imp-l").all_inner_texts()]; print("  relevé :", L)
    check(any("Commun Fictif" in l and "Compte commun Fictif" in l for l in L) or any("vers" in l and "Compte commun Fictif" in l for l in L), "relevé : le virement est proposé vers « Compte commun Fictif »")
    pg.locator('[data-imp="go"]').click(); pg.wait_for_timeout(700)
    yes=pg.locator(".sheet-overlay .ui-yes")
    if yes.count(): yes.last.click(); pg.wait_for_timeout(600)
    pg.reload(); pg.wait_for_timeout(900)
    m30=[v for v in V() if v["person"]=="commun" and v["montant"]==30 and v.get("pairOf") is not None]
    check(len(m30)==1 and m30[0].get("done"), "après l'import : +30 € « fait » sur le compte commun")
    c.close()
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
print("\n%d échec(s)"%len(fails)); sys.exit(1 if fails else 0)
