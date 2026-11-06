# Étape 2 : Compte en sous-onglets, roue du compte, graphiques touchables, menu sans import
import sys, os, json
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
SP=(sys.argv[1] if len(sys.argv)>1 else HERE); APP='file://'+ROOT+'/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def norm(t): return t.replace(" "," ").replace("\xa0"," ")
data={"askName":False,"devise":"EUR",
  "comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True}],
  "virements":[{"id":21,"person":"Alex","month":"2026-10","label":"Salaire","montant":1850,"done":True,"day":2},{"id":22,"person":"Alex","month":"2026-10","label":"Livret A","montant":-200,"done":True,"day":5}],
  "epargne":[{"id":301,"nom":"Livret A","vals":{"2026-09":3040,"2026-10":3240}}],
  "provisions":[{"id":11,"nom":"Taxe foncière","mensuel":82,"soldeInitial":410,"startMonth":"2026-10","prelevements":[],"echeance":10,"prevu":980,"ou":"ep:301"}],
  "fraisCommuns":[{"id":1,"label":"Loyer","montant":650,"personne":"Commun","recurrent":True,"startMonth":"2026-01","jour":5}],
  "entries":[{"id":1,"date":"2026-10-03","marchand":"Supermarché","montant":54.12,"categorie":"Courses","payePar":"Alex","articles":[]}]}
with sync_playwright() as p:
    b=p.chromium.launch(); c=b.new_context(viewport={'width':412,'height':900}); pg=c.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    pg.goto(APP); pg.wait_for_timeout(300)
    pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); pg.reload(); pg.wait_for_timeout(900)
    pg.locator("#hmenu").click(); pg.wait_for_timeout(300)
    check(pg.locator('.dr-row[data-k="import"]').count()==0, "menu : plus d'« Importer un relevé »"); pg.locator(".dr-x").click(); pg.wait_for_timeout(300)
    pg.locator('#nav .navi[data-view="compte"]').click(); pg.wait_for_timeout(600)
    check(pg.locator(".htitle").inner_text()=="Opérations" and pg.locator("#hback").count()==0 and pg.locator("#cptGear").count()==1, "Compte : titre, pas de retour, roue en haut à droite")
    check(pg.locator(".avtabs .cpsub.on").inner_text()=="Opérations" and pg.locator("#opsBody").count()==1 and pg.locator("#cptGraph").count()==0, "Opérations par défaut, sans les boutons Graphiques / Configuration")
    pg.screenshot(path=os.path.join(SP,"t94_ops.png"))
    # plus d'onglet Virements : « ＋ Ajouter » dans les Opérations
    check(pg.evaluate("()=>[].map.call(document.querySelectorAll('.avtabs .cpsub'), b=>b.textContent)")==["Opérations","Tickets","Épargne","Graphiques"], "4 sous-onglets : Opérations · Tickets · Épargne · Graphiques")
    pg.locator("#opsAdd").click(); pg.wait_for_timeout(300)
    ch=[norm(x) for x in pg.locator(".sheet-overlay .ui-stack button").all_inner_texts()]
    check([x for x in ch if x!="Annuler"]==["⬇️ Virement reçu","⬆️ Virement envoyé","📅 Frais fixe","🧾 Ticket"], "« ＋ Ajouter » : virement reçu, envoyé, frais fixe, ticket %s"%ch)
    pg.locator(".sheet-overlay button", has_text="Virement envoyé").click(); pg.wait_for_timeout(300)
    check(norm(pg.locator(".sheet-overlay .sheet-title").last.inner_text()).lower()=="virement envoyé" and pg.locator('.sheet-overlay .ui-seg button.on').last.get_attribute("data-v")=="out", "« Virement envoyé » : le sens est déjà « envoyé »")
    pg.locator(".sheet-overlay .ui-form input").nth(0).fill("Vers le livret"); pg.locator(".sheet-overlay .ui-inp.money input").fill("50")
    pg.locator(".sheet-overlay .ui-actions button[type=submit]").click(); pg.wait_for_timeout(500)
    t=norm(pg.locator("#opsBody").inner_text())
    check("Vers le livret" in t and "−50" in t, "le virement arrive dans la liste du mois")
    pg.screenshot(path=os.path.join(SP,"t94_ops_ajout.png"))
    pg.locator('.avtabs .cpsub[data-cp="ep"]').click(); pg.wait_for_timeout(500)
    t=norm(pg.locator("#app").inner_text())
    check("Épargne totale" in t and "Livret A" in t and pg.locator("#goprov").count()==1, "Épargne : total, comptes épargne et la ligne Provisions")
    pg.screenshot(path=os.path.join(SP,"t94_ep.png"))
    pg.locator('.avtabs .cpsub[data-cp="graph"]').click(); pg.wait_for_timeout(500)
    pg.locator('.thero .cch-tabs button[data-m="mois"]').click(); pg.wait_for_timeout(500)
    pg.screenshot(path=os.path.join(SP,"t94_graph.png"))
    hits=pg.evaluate("()=>[].map.call(document.querySelectorAll('.thero .wfhit'), b=>b.getAttribute('data-k'))"); print("  cascade :", hits)
    pg.locator('.thero .wfhit[data-k="in"]').first.dispatch_event("click"); pg.wait_for_timeout(500)
    on=pg.evaluate("()=>{ var b=document.querySelector('.ops-f button.on'); return b?b.textContent:null; }")
    check(pg.locator(".avtabs .cpsub.on").inner_text()=="Opérations" and on=="Entrées", "graphique « Ce mois » : la barre Reçu ouvre les Opérations filtrées sur les entrées (%s)"%on)
    pg.locator('.avtabs .cpsub[data-cp="graph"]').click(); pg.wait_for_timeout(400)
    pg.locator('.thero .wfhit[data-k="dep"]').first.dispatch_event("click"); pg.wait_for_timeout(500)
    on=pg.evaluate("()=>{ var b=document.querySelector('.ops-f button.on'); return b?b.textContent:null; }")
    check(pg.locator(".avtabs .cpsub.on").inner_text()=="Opérations" and on=="Sorties", "la barre Tickets ouvre les Opérations filtrées sur les sorties (%s)"%on)
    pg.locator("#cptGear").click(); pg.wait_for_timeout(400)
    wt=norm(pg.locator(".sheet-overlay").last.inner_text()); print("  roue :", wt.replace("\n"," | "))
    check("Modifier le compte" in wt and "Solde reporté" in wt and "Importer un relevé" in wt and "Compte principal" in wt, "roue : modifier, solde reporté, importer")
    pg.screenshot(path=os.path.join(SP,"t94_roue.png"))
    pg.locator(".sheet-overlay button", has_text="Importer un relevé").first.click(); pg.wait_for_timeout(400)
    check("importer un relevé" in pg.locator(".sheet-overlay").last.inner_text().lower() and pg.locator("#impPick").count()==1, "roue › Importer un relevé : la fenêtre d'import")
    check(not errs, "pas d'erreur %s"%errs[:3]); b.close()
print("\n%d échec(s)"%len(fails))
