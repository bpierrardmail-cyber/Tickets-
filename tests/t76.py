# Onglet Compte : la liste des opérations du mois (relevé), filtres, recherche, « fait », jours, graphiques sur leur page
import sys, os, re, json, copy, time
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
os.environ.setdefault("TICKETS_NOW", "2026-10-27T10:00:00")   # données écrites pour ce jour-là (« Hier », « habituellement le 28 »)
import horloge
SP=(sys.argv[1] if len(sys.argv)>1 else HERE); APP='file://'+ROOT+'/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def F(i,l,m,done=True,**k): d={"id":i,"label":l,"montant":m,"personne":"Benoit","recurrent":True,"startMonth":"2026-01","doneMonths":({"2026-10":True} if done else {})}; d.update(k); return d
def V(i,l,m,done=True,**k): d={"id":i,"person":"Benoit","month":"2026-10","label":l,"montant":m,"done":done}; d.update(k); return d
def T(i,d,mc,m,c): return {"id":i,"date":d,"marchand":mc,"montant":m,"categorie":c,"payePar":"Benoit","articles":[]}
data={"askName":False,"devise":"EUR","personnes":[],
  "comptes":[{"key":"Benoit","nom":"Compte courant","payer":"Benoit","main":True}],
  "soldeInit":{"Benoit":{"2026-09":400,"2026-10":412.30}},"homeCharts":["compte:mois","compte:solde"],
  "virements":[V(1,"Salaire",1850,day=1),V(2,"CAF",180,note="05/10 · relevé"),V(3,"Sylvette",200,day=15),V(4,"Provisions du mois",-26,day=5),V(5,"Épargne",-100,False)],
  "fraisCommuns":[F(11,"Loyer",640,jour=2),F(12,"EDF",78,doneDays={"2026-10":6}),F(13,"Mutuelle",48.90,jour=10),F(14,"Free",15.99),F(15,"Assurance auto",42.30,False,jour=28)],
  "entries":[T(21,"2026-10-03","Leclerc",62.40,"Alimentation"),T(22,"2026-10-08","Boulangerie",4.20,"Alimentation"),T(23,"2026-10-12","Brico Dépôt",68.21,"Bricolage"),
             T(24,"2026-10-16","Intermarché",43.12,"Alimentation"),T(25,"2026-10-19","Pharmacie",12.80,"Santé"),T(26,"2026-10-20","Total",55.00,"Transport"),
             T(27,"2026-10-24","Leclerc",38.75,"Alimentation"),T(28,"2026-10-26","Intermarché",21.35,"Alimentation")]}
def norm(t): return t.replace(" "," ").replace("\xa0"," ")
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':412,'height':900}); pg=ctx.new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    pg.goto(APP); pg.wait_for_timeout(300)
    def load(d):
        pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", d); pg.reload(); pg.wait_for_timeout(900)
    def compte():
        pg.locator('#nav .navi[data-view="compte"]').click(); pg.wait_for_timeout(600)
    def body(): return norm(pg.locator("#opsBody").inner_text())
    def ls(k): return pg.evaluate("k=>JSON.parse(localStorage.getItem(k))", k)
    load(data); compte()
    top=norm(pg.locator(".ops-sum").inner_text()); print("  haut :", top.replace("\n"," | "))
    check("1 527,58" in top.replace("\n","") or "1 527,58" in top, "solde estimé 1 527,58 €")
    check("+2 230 €" in top and "−1 115 €" in top and "1 385 €" in top, "Entrées +2 230 · Sorties −1 115 · Fin de mois 1 385")
    check(pg.evaluate("()=>[].map.call(document.querySelectorAll('.avtabs .cpsub'), b=>b.textContent)")==["Opérations","Tickets","Épargne","Graphiques"] and pg.locator("#cptGear").count()==1 and pg.locator('.cptGo[data-page="cfg"]').count()==0, "sous-onglets Opérations · Épargne · Graphiques et roue du compte")
    check(pg.locator(".thero .cch-tabs").count()==0, "plus de graphique sur la page principale")
    t=body(); print("  liste :", t[:900].replace("\n"," | "))
    av=norm(pg.locator(".ops-av").inner_text())
    check("À venir ce mois-ci" in av and "Assurance auto" in av and "vers le 28" in av and "Épargne" in av and "−142,30" in av, "À venir : Assurance auto (vers le 28) et Épargne, −142,30")
    heads=[norm(x) for x in pg.locator(".ops-dh").all_inner_texts()]; print("  jours :", heads)
    check(heads[0].startswith("Hier") and "1 527,58" in heads[0], "le plus récent en haut : Hier, solde 1 527,58")
    check(any(h.startswith("Jeudi 1er octobre") and "2 246,31" in h for h in heads), "1er octobre : Salaire et Free (sans jour), solde 2 246,31")
    check(any(h.startswith("Lundi 5 octobre") for h in heads) and any(h.startswith("Mardi 6 octobre") for h in heads), "CAF au 5 (date d'un ancien import), EDF au 6 (jour où il a été payé)")
    check(heads[-1].startswith("Début du mois") and "Report de septembre" in t and "412,30" in t, "en bas : Report de septembre 412,30")
    order=[x for x in re.findall(r"(Salaire|Loyer|Leclerc|CAF|Provisions du mois|EDF|Mutuelle|Free|Sylvette|Intermarché)", t)]
    check(order.index("Sylvette")<order.index("CAF")<order.index("Loyer")<order.index("Salaire"), "ordre : du plus récent au plus ancien")
    pg.screenshot(path=os.path.join(SP,"t76_liste.png"), full_page=True)
    # filtres
    pg.locator('.ops-f button[data-f="in"]').click(); pg.wait_for_timeout(300); t=body()
    check("3 opérations" in t and "+2 230,00" in t and "Leclerc" not in t and "À venir" not in t, "Entrées : 3 opérations, +2 230,00")
    pg.locator('.ops-f button[data-f="out"]').click(); pg.wait_for_timeout(300); t=body()
    check("13 opérations" in t and "2 à venir" in t and "−1 114,72" in t and "Salaire" not in t, "Sorties : 13 opérations · 2 à venir, −1 114,72 (%s)" % t[:60].replace("\n"," "))
    pg.locator('.ops-f button[data-f="av"]').click(); pg.wait_for_timeout(300); t=body()
    check("Assurance auto" in t and "Leclerc" not in t and "Report" not in t, "À venir seulement")
    pg.locator('.ops-sum .hstat[data-f="in"]').click(); pg.wait_for_timeout(300)
    check(pg.locator('.ops-f button.on').get_attribute("data-f")=="in", "toucher « Entrées » en haut filtre les entrées")
    pg.locator('.ops-sum .hstat[data-f="in"]').click(); pg.wait_for_timeout(300)
    check(pg.locator('.ops-f button.on').get_attribute("data-f")=="tout", "… et le retoucher remet « Tout »")
    # recherche
    (pg.locator("#opsQ").count()==0 and pg.locator("#opsQBtn").click()); pg.wait_for_timeout(200); q=pg.locator("#opsQ"); q.click(); q.type("lecl"); pg.wait_for_timeout(300); t=body()
    check("2 opérations" in t and "−101,15" in t and "Intermarché" not in t, "recherche « lecl » : 2 opérations, −101,15")
    check(pg.evaluate("()=>document.activeElement && document.activeElement.id")=="opsQ", "la recherche garde le clavier pendant la frappe")
    q.fill(""); q.type("43.12"); pg.wait_for_timeout(300); t=body()
    check("1 opération" in t and "Intermarché" in t, "recherche « 43.12 » : l'Intermarché de 43,12")
    q.fill(""); q.type("electricite xyz"); pg.wait_for_timeout(300); check("Rien ne correspond" in body(), "rien trouvé : « Rien ne correspond »")
    q.fill(""); q.type("assurance"); pg.wait_for_timeout(300); t=body(); check("Assurance auto" in t and "0 opération" in t, "la recherche cherche aussi dans À venir")
    q.fill(""); pg.wait_for_timeout(200); q.dispatch_event("input"); pg.wait_for_timeout(200)
    # rond « fait »
    pg.locator('.ops-ck[data-k="v"]').click(); pg.wait_for_timeout(500)
    V5=[v for v in ls("virements") if v["id"]==5][0]; today=horloge.today().day
    check(V5["done"] and V5.get("day")==today, "Épargne cochée : faite aujourd'hui (jour %s)" % V5.get("day"))
    heads=[norm(x) for x in pg.locator(".ops-dh").all_inner_texts()]
    check(heads[0].startswith("Aujourd'hui") and "1 427,58" in heads[0], "elle rejoint la liste : Aujourd'hui, solde 1 427,58 (%s)" % heads[0])
    pg.locator('.ops-ck[data-k="f"]').click(); pg.wait_for_timeout(500)
    F15=[f for f in ls("fraisCommuns") if f["id"]==15][0]
    check(F15["doneMonths"].get("2026-10") and (F15.get("doneDays") or {}).get("2026-10")==today, "Assurance auto (habituellement le 28) cochée aujourd'hui : rangée aujourd'hui")
    check(pg.locator(".ops-av").count()==0, "plus rien à venir")
    top=norm(pg.locator(".ops-sum").inner_text()); check("1 385,28" in top and "1 385 €" in top, "solde estimé = fin de mois prévue 1 385,28")
    # fiche d'un frais : le jour
    pg.locator('#opsBody .ops-open[data-k="f"][data-id="13"]').click(); pg.wait_for_timeout(400)
    pg.locator(".sheet-overlay button", has_text="Modifier").click(); pg.wait_for_timeout(400)
    fm=norm(pg.locator(".sheet-overlay").last.inner_text()); check("Jour du prélèvement" in fm, "fiche du frais : « Jour du prélèvement »")
    jv=pg.locator(".sheet-overlay input").nth(2)
    inp=[i for i in pg.locator(".sheet-overlay .ui-inp input").all() if i.input_value()=="10"]
    check(len(inp)==1, "le jour 10 est prérempli")
    inp[0].fill("12"); pg.locator('.sheet-overlay button[type="submit"]').last.click(); pg.wait_for_timeout(500)
    F13=[f for f in ls("fraisCommuns") if f["id"]==13][0]; check(F13.get("jour")==12, "jour changé : 12")
    check(any(h.startswith("Lundi 12 octobre") for h in [norm(x) for x in pg.locator(".ops-dh").all_inner_texts()]), "la Mutuelle passe au 12")
    # fiche d'un virement : le jour, et un jour faux refusé
    pg.locator('#opsBody .ops-open[data-k="v"][data-id="3"]').click(); pg.wait_for_timeout(400)
    pg.locator(".sheet-overlay button", has_text="Modifier").click(); pg.wait_for_timeout(400)
    inp=[i for i in pg.locator(".sheet-overlay .ui-inp input").all() if i.input_value()=="15"]; check(len(inp)==1, "fiche du virement : jour 15")
    inp[0].fill("40"); pg.locator('.sheet-overlay button[type="submit"]').last.click(); pg.wait_for_timeout(400)
    check("1 à 31" in norm(pg.locator(".sheet-overlay").last.inner_text()), "jour 40 refusé")
    pg.locator(".sheet-overlay .ui-cancel").last.click(); pg.wait_for_timeout(300)
    # ticket : la fiche, puis retour au compte
    pg.locator('#opsBody .ops-open[data-k="t"][data-id="23"]').click(); pg.wait_for_timeout(600)
    check(pg.evaluate("()=>!!document.querySelector('#app input, #app .fmerch, #app form')"), "ticket touché : sa fiche s'ouvre")
    pg.locator("#hback").first.click() if pg.locator("#hback").count() else None; pg.wait_for_timeout(600)
    check(pg.locator("#opsBody").count()==1, "retour : la liste du compte")
    # Graphiques
    pg.locator('.avtabs .cpsub[data-cp="graph"]').click(); pg.wait_for_timeout(700)
    check(pg.locator(".thero .cch-tabs").count()==1 and pg.locator(".avtabs .cpsub.on").inner_text()=="Graphiques", "Graphiques : les graphiques d'avant, en sous-onglet")
    pg.screenshot(path=os.path.join(SP,"t76_graph.png"))
    pg.locator('.thero .cch-tabs button[data-m="dep"]').click(); pg.wait_for_timeout(500)
    check(pg.locator(".thero .cch-tabs button.on").get_attribute("data-m")=="dep", "changer de graphique")
    pg.locator(".thero .hstat").first.click() if False else None
    pg.locator('.avtabs .cpsub[data-cp=""]').click(); pg.wait_for_timeout(600)
    check(pg.locator("#opsBody").count()==1, "Opérations : la liste")
    # la roue du compte
    pg.locator("#cptGear").click(); pg.wait_for_timeout(400)
    wt=pg.locator(".sheet-overlay").last.inner_text(); print("  roue :", wt.replace("\n"," | "))
    check("Modifier le compte" in wt and "Solde reporté" in wt and "Importer un relevé" in wt, "la roue du compte : modifier, solde reporté, import")
    pg.evaluate("()=>document.querySelectorAll('.sheet-overlay').forEach(x=>x.remove())"); pg.wait_for_timeout(300)
    # Graphiques › Solde (l'Accueil n'a plus de cartes de graphiques depuis le 09/11)
    pg.locator('.avtabs .cpsub[data-cp="graph"]').click(); pg.wait_for_timeout(500)
    pg.locator('.thero .cch-tabs button[data-m="solde"]').click(); pg.wait_for_timeout(500)
    check(pg.locator(".avtabs .cpsub.on").inner_text()=="Graphiques" and pg.locator(".thero .cch-tabs button.on").get_attribute("data-m")=="solde", "toucher la carte « Solde » ouvre ce graphique")
    pg.locator('.avtabs .cpsub[data-cp=""]').click(); pg.wait_for_timeout(500); check(pg.locator("#opsBody").count()==1, "Opérations : la liste")
    # mois passé et mois à venir
    compte(); pg.locator("#cm-prev").click(); pg.wait_for_timeout(500); t=body(); print("  septembre :", t[:300].replace("\n"," | "))
    check("Pas encore passé à la banque" in t, "septembre : les frais non payés « Pas encore passés à la banque »")
    pg.locator("#cm-next").click(); pg.wait_for_timeout(300); pg.locator("#cm-next").click(); pg.wait_for_timeout(500); t=body(); print("  novembre :", t[:200].replace("\n"," | "))
    check("Prévu en novembre" in t and pg.locator(".ops-ck").count()==0 and "Report" not in t, "novembre : « Prévu en novembre », sans rond")
    pg.screenshot(path=os.path.join(SP,"t76_nov.png"), full_page=True)
    print("errors:", errs); check(not errs, "aucune erreur")
    # 360 px
    pg.set_viewport_size({"width":360,"height":740}); load(data); compte()
    sw=pg.evaluate("()=>document.documentElement.scrollWidth"); check(sw<=360, "360 px : pas de défilement de côté (%d)" % sw)
    fb=pg.evaluate("()=>{const r=document.querySelector('.ops-f').getBoundingClientRect(), b=[...document.querySelectorAll('.ops-f button')].pop().getBoundingClientRect(); return [r.right, b.right]}")
    check(fb[1]<=fb[0]+1, "360 px : les 4 filtres tiennent (%s)" % fb)
    pg.screenshot(path=os.path.join(SP,"t76_360.png"))
    # grosse famille : 400 tickets dans le mois
    big=copy.deepcopy(data); big["entries"]=[T(1000+i,"2026-10-%02d" % (1+i%26),"Magasin %d" % (i%37),round(3+(i*7.3)%90,2),"Alimentation") for i in range(400)]
    pg.set_viewport_size({"width":412,"height":900}); load(big)
    t0=time.time(); compte(); dt=time.time()-t0
    n=pg.locator("#opsBody .ops-r.ops-open").count(); check(n==400+8, "400 tickets + 8 lignes : %d lignes" % n)
    t0=time.time(); (pg.locator("#opsQ").count()==0 and pg.locator("#opsQBtn").click()); pg.wait_for_timeout(200); q=pg.locator("#opsQ"); q.click(); q.type("magasin 3"); dq=time.time()-t0
    print("  ouverture %.2fs, recherche tapée %.2fs" % (dt, dq))
    check(dq<4, "recherche fluide avec 400 tickets")
    print("errors:", errs); check(not errs, "aucune erreur")
    b.close()
print(len(fails), "échec(s)")
