# Reprendre des virements du mois d'avant : mois suivant, un mois, une période, chaque mois (série). Données inventées.
# - « ＋ Ajouter › Reprendre des virements de septembre » : ceux déjà vus le mois d'avant sont cochés, ceux déjà là signalés ;
# - « chaque mois » : l'appli crée le virement de chaque mois (12 mois à l'avance), « ↻ chaque mois » dans la liste ;
#   toucher : modifier ce mois ou à partir de ce mois, retirer un mois (pas recréé), arrêter ;
# - fiche d'un virement : « Reprendre ce virement » ; import d'un relevé : le virement déjà là est « fait » (annulable).
import sys, os, re, tempfile
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
SP=(sys.argv[1] if len(sys.argv)>1 else HERE); APP='file://'+ROOT+'/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def norm(t): return t.replace(" "," ").replace("\xa0"," ")
V=[{"id":11,"person":"Alex","month":"2026-08","label":"CAF","montant":394.96,"day":5,"done":True},
   {"id":12,"person":"Alex","month":"2026-08","label":"Sylvette","montant":80,"day":2,"done":True},
   {"id":21,"person":"Alex","month":"2026-09","label":"CAF","montant":394.96,"day":5,"done":True},
   {"id":22,"person":"Alex","month":"2026-09","label":"Sylvette","montant":80,"day":2,"done":True},
   {"id":23,"person":"Alex","month":"2026-09","label":"Claude ia","montant":-21.6,"day":12,"done":True},
   {"id":24,"person":"Alex","month":"2026-09","label":"BO+","montant":-10,"day":3,"done":True,"epargneId":301,"epApplied":10},
   {"id":25,"person":"Alex","month":"2026-09","label":"impot","montant":1086,"note":"15/09 · relevé","imp":1,"impKey":"x1","done":True},
   {"id":31,"person":"Alex","month":"2026-10","label":"impot","montant":1086,"day":15,"done":True}]
data={"askName":False,"devise":"EUR","comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True}],
  "epargne":[{"id":301,"nom":"Livret A","owner":"Alex","vals":{"2026-10":1000}}],
  "virements":V,"fraisCommuns":[],"entries":[],"soldeInit":{"Alex":{"2026-08":500}}}
def ls(pg, k): return pg.evaluate("k=>JSON.parse(localStorage.getItem(k))", k)
def virs(pg, **kw): return [x for x in ls(pg,"virements") if all(x.get(k)==v for k,v in kw.items())]
with sync_playwright() as p:
    b=p.chromium.launch(); c=b.new_context(viewport={'width':412,'height':900}); pg=c.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    pg.goto(APP); pg.wait_for_timeout(300)
    pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); pg.reload(); pg.wait_for_timeout(900)
    pg.locator('#nav .navi[data-view="compte"]').click(); pg.wait_for_timeout(500)
    def ajouter():
        pg.locator("#cptGear").click(); pg.wait_for_timeout(300)
    def rows(): return [(norm(r.inner_text()), r.locator("input").is_checked()) for r in pg.locator(".vr-r").all()]
    def row(txt): return pg.locator(".vr-r", has_text=txt).locator("input")
    def mode(v): pg.locator('#vrWhen button[data-v="%s"]'%v).click(); pg.wait_for_timeout(150)
    # ---------- 1. mois suivant
    ajouter()
    check(pg.locator(".sheet-overlay button", has_text="Reprendre des virements de septembre").count()==1, "roue du compte : « ↻ Reprendre des virements de septembre »")
    pg.locator(".sheet-overlay button", has_text="Reprendre des virements de septembre").click(); pg.wait_for_timeout(400)
    R=rows(); print("  lignes :", R)
    d={t.split("\n")[0]:on for t,on in R}
    check(len(R)==5 and d.get("CAF") and d.get("Sylvette") and not d.get("Claude ia") and not d.get("BO+"), "5 virements ; CAF et Sylvette (déjà en août) cochés, les autres non")
    check(any("impot" in t and "déjà en octobre" in t for t,_ in R), "« impot » signalé « déjà en octobre »")
    row("Claude ia").check(); pg.wait_for_timeout(150)
    check(norm(pg.locator("#vrOk").inner_text())=="Ajouter 3 virements · en octobre", "bouton : « Ajouter 3 virements · en octobre »")
    pg.screenshot(path=os.path.join(SP,"t103_reprendre.png"))
    pg.locator("#vrOk").click(); pg.wait_for_timeout(500)
    oc=virs(pg, month="2026-10")
    caf=[x for x in oc if x["label"]=="CAF"]; cl=[x for x in oc if x["label"]=="Claude ia"]
    check(len(oc)==4 and caf and caf[0]["day"]==5 and abs(caf[0]["montant"]-394.96)<0.001 and not caf[0].get("done") and cl and cl[0]["montant"]==-21.6, "octobre : CAF, Sylvette, Claude ia ajoutés au même jour, à venir")
    check("CAF" in norm(pg.locator(".ops-av").inner_text()), "ils sont dans « À venir »")
    # ---------- 2. une période (BO+ vers le Livret A)
    ajouter(); pg.locator(".sheet-overlay button", has_text="Reprendre des virements").click(); pg.wait_for_timeout(300)
    for t,on in rows():
        if on: row(t.split("\n")[0]).uncheck()
    row("BO+").check(); mode("per")
    pg.locator("#vrPF").fill("2026-11"); pg.locator("#vrPT").fill("2027-01"); pg.locator("#vrPT").dispatch_event("change"); pg.wait_for_timeout(150)
    check("Ajouter 1 virement · de novembre à janvier 2027" in norm(pg.locator("#vrOk").inner_text()), "période : « de novembre à janvier 2027 » (%s)"%norm(pg.locator("#vrOk").inner_text()))
    pg.locator("#vrOk").click(); pg.wait_for_timeout(500)
    bo=sorted([x["month"] for x in virs(pg, label="BO+") if x["month"]>"2026-10"])
    bo1=[x for x in virs(pg, label="BO+") if x["month"]=="2026-11"][0]
    check(bo==["2026-11","2026-12","2027-01"] and bo1.get("epargneId")==301 and bo1.get("epApplied")==0 and not bo1.get("done"), "BO+ en novembre, décembre, janvier, toujours vers le Livret A (rien versé avant « fait »)")
    # ---------- 3. chaque mois (CAF, déjà en octobre)
    ajouter(); pg.locator(".sheet-overlay button", has_text="Reprendre des virements").click(); pg.wait_for_timeout(300)
    for t,on in rows():
        if on: row(t.split("\n")[0]).uncheck()
    row("CAF").check(); mode("rec")
    check(pg.locator("#vrRF").input_value()=="2026-10" and pg.locator("#vrRT").input_value()=="" and "chaque mois" in norm(pg.locator("#vrOk").inner_text()), "chaque mois : à partir d'octobre, sans fin")
    pg.locator("#vrOk").click(); pg.wait_for_timeout(500)
    R=ls(pg,"virRec"); cafs=sorted([x["month"] for x in virs(pg, label="CAF") if x.get("rec")])
    check(len(R)==1 and R[0]["from"]=="2026-10" and len([x for x in virs(pg, label="CAF") if x["month"]=="2026-10"])==1 and cafs[0]=="2026-11" and cafs[-1]=="2027-09" and len(cafs)==11,
          "une série ; pas de 2e CAF en octobre ; un CAF par mois de novembre à septembre 2027 (%d)"%len(cafs))
    pg.locator("#cm-next").click(); pg.wait_for_timeout(400)
    t=norm(pg.locator("#opsBody").inner_text())
    check("↻ chaque mois" in t, "novembre : « ↻ chaque mois » dans la liste")
    cn=[x for x in virs(pg, label="CAF") if x["month"]=="2026-11"][0]
    pg.locator('#opsBody .ops-open[data-k="v"][data-id="%s"]'%cn["id"]).click(); pg.wait_for_timeout(300)
    ch=[norm(x) for x in pg.locator(".sheet-overlay .ui-stack button").all_inner_texts()]; print("  menu :", ch)
    check("✎ Modifier ce mois-ci seulement" in ch and "✎ Modifier à partir de ce mois" in ch and "⏸ Retirer seulement en novembre" in ch and "⏹ Arrêter à partir de novembre" in ch, "toucher un CAF de la série : ce mois, à partir de ce mois, retirer, arrêter")
    pg.locator(".sheet-overlay button", has_text="Modifier à partir de ce mois").click(); pg.wait_for_timeout(300)
    pg.locator(".ui-field", has_text="Montant").locator("input").fill("400")
    pg.locator(".sheet-overlay .ui-actions button[type=submit]").click(); pg.wait_for_timeout(400)
    am={x["month"]:x["montant"] for x in virs(pg, label="CAF")}
    check(am["2026-11"]==400 and am["2027-03"]==400 and abs(am["2026-10"]-394.96)<0.001, "« à partir de novembre » : 400 € en novembre et après, octobre inchangé")
    # retirer décembre seulement : pas recréé
    pg.locator("#cm-next").click(); pg.wait_for_timeout(400)
    cd=[x for x in virs(pg, label="CAF") if x["month"]=="2026-12"][0]
    pg.locator('#opsBody .ops-open[data-k="v"][data-id="%s"]'%cd["id"]).click(); pg.wait_for_timeout(300)
    pg.locator(".sheet-overlay button", has_text="Retirer seulement en décembre").click(); pg.wait_for_timeout(400)
    pg.reload(); pg.wait_for_timeout(900)
    check(not [x for x in virs(pg, label="CAF") if x["month"]=="2026-12"] and [x for x in virs(pg, label="CAF") if x["month"]=="2027-01"], "décembre retiré, pas recréé à la relance ; janvier toujours là")
    # arrêter à partir de février
    pg.locator('#nav .navi[data-view="compte"]').click(); pg.wait_for_timeout(400)
    for _ in range(4): pg.locator("#cm-next").click(); pg.wait_for_timeout(250)
    cf=[x for x in virs(pg, label="CAF") if x["month"]=="2027-02"][0]
    pg.locator('#opsBody .ops-open[data-k="v"][data-id="%s"]'%cf["id"]).click(); pg.wait_for_timeout(300)
    pg.locator(".sheet-overlay button", has_text="Arrêter à partir de février").click(); pg.wait_for_timeout(300)
    pg.locator(".sheet-overlay .ui-yes").click(); pg.wait_for_timeout(400)
    left=sorted([x["month"] for x in virs(pg, label="CAF") if x.get("rec")])
    check(left==["2026-11","2027-01"] and ls(pg,"virRec")[0].get("to")=="2027-01", "arrêté à partir de février : il reste novembre et janvier (%s)"%left)
    # ---------- 4. fiche d'un virement : « Reprendre ce virement »
    pg.locator("#cm-today").click(); pg.wait_for_timeout(400)
    sy=[x for x in virs(pg, label="Sylvette") if x["month"]=="2026-10"][0]
    pg.locator('#opsBody .ops-open[data-k="v"][data-id="%s"]'%sy["id"]).click(); pg.wait_for_timeout(300)
    pg.locator(".sheet-overlay button", has_text="Reprendre ce virement").click(); pg.wait_for_timeout(300)
    check("reprendre « sylvette »" in norm(pg.locator(".sheet-overlay").last.inner_text()).lower() and len(rows())==1 and rows()[0][1], "« Reprendre « Sylvette » » : lui seul, coché")
    mode("one"); pg.locator("#vrM1").fill("2027-02"); pg.locator("#vrM1").dispatch_event("change")
    pg.locator("#vrOk").click(); pg.wait_for_timeout(400)
    check([x for x in virs(pg, label="Sylvette") if x["month"]=="2027-02"], "Sylvette ajoutée en février 2027")
    check(not errs, "pas d'erreur %s"%errs[:3])
    # ---------- 5. import : le CAF de novembre est sur le relevé → « fait » ; annuler l'import le remet à venir
    tmp=tempfile.mkdtemp(); csv=os.path.join(tmp,"releve_fictif.csv")
    open(csv,"w",encoding="utf-8").write("Date;Libellé;Montant\n06/11/2026;VIR CAF;400,00\n09/11/2026;VIR CLUB DE FOOT;-15,00\n")
    pg.locator("#cptGear").click(); pg.wait_for_timeout(300)
    pg.locator(".sheet-overlay button", has_text="Importer un relevé").first.click(); pg.wait_for_timeout(400)
    with pg.expect_file_chooser() as fcx: pg.locator("#impPick").click()
    fcx.value.set_files(csv); pg.wait_for_timeout(900)
    L=[norm(x) for x in pg.locator(".imp-l").all_inner_texts()]; print("  relevé :", L)
    check(any("déjà dans les virements (CAF" in x for x in L), "relevé : « déjà dans les virements (CAF…) »")
    ck=pg.locator(".imp-l", has_text="CAF").locator(".imp-ck")
    if "on" in (ck.get_attribute("class") or ""): ck.click(); pg.wait_for_timeout(250)   # « peut-être » : on dit que c'est lui
    pg.locator('[data-imp="go"]').click(); pg.wait_for_timeout(700)
    yes=pg.locator(".sheet-overlay .ui-yes")
    if yes.count(): yes.last.click(); pg.wait_for_timeout(600)
    cn=[x for x in virs(pg, label="CAF") if x["month"]=="2026-11"][0]
    check(cn.get("done") and cn.get("day")==6, "après l'import : le CAF de novembre est fait, le 6")
    pg.locator('#nav .navi[data-view="compte"]').click(); pg.wait_for_timeout(400)
    pg.locator("#cptGear").click(); pg.wait_for_timeout(300)
    pg.locator(".sheet-overlay button", has_text="Annuler le dernier import").first.click(); pg.wait_for_timeout(400)
    pg.locator(".sheet-overlay .ui-yes").last.click(); pg.wait_for_timeout(600)
    cn=[x for x in virs(pg, label="CAF") if x["month"]=="2026-11"][0]
    check(not cn.get("done") and cn.get("day")==5, "import annulé : le CAF de novembre est de nouveau à venir, au 5")
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
print("\n%d échec(s)"%len(fails))
