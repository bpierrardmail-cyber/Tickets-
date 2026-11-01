# Provisions : graphique « De côté » / « Avec les factures prévues » et liste des factures prévues sur 12 mois. Données inventées.
# - un mois futur ne repart plus de 0 (le graphique part des sommes déjà de côté) ;
# - factures prévues : montant prévu (✎), factures estimées du fournisseur suivi, sinon le même mois l'an dernier ;
#   échéance sans montant : « montant non indiqué » ; ce qui manquera, et « Passer à … / mois » ;
# - les 12 mois d'À venir comptent aussi ces factures (mois en jaune s'il manquera).
import sys, os, re
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
SP=(sys.argv[1] if len(sys.argv)>1 else HERE); APP='file://'+ROOT+'/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def norm(t): return t.replace(" "," ").replace("\xa0"," ")
def money(t):
    m=re.search(r"[-−]?\d[\d ]*(?:,\d+)?", norm(t)); return float(m.group(0).replace(" ","").replace("−","-").replace(",",".")) if m else None
EAU="eau|vallee claire"
data={"askName":False,"devise":"EUR","comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True}],
  "epargne":[{"id":301,"nom":"Livret A","owner":"Alex","vals":{"2026-10":1000}}],
  "provisions":[
    {"id":11,"nom":"Impôt foncier","mensuel":30,"soldeInitial":900,"startMonth":"2025-06","ou":"ep:301","prelevements":[{"id":1,"month":"2025-11","montant":1000,"label":"Foncier"}]},
    {"id":12,"nom":"Eau","mensuel":20,"soldeInitial":200,"startMonth":"2026-06","ou":"ep:301","prelevements":[],"fact":EAU},
    {"id":13,"nom":"Assurance","mensuel":50,"soldeInitial":0,"startMonth":"2026-10","ou":"ep:301","prelevements":[],"echeance":3,"prevu":300},
    {"id":14,"nom":"Taxe","mensuel":10,"soldeInitial":0,"startMonth":"2026-10","ou":"ep:301","prelevements":[],"echeance":6}],
  "factures":[
    {"id":201,"four":"Vallée Claire","type":"eau","date":"2025-11-05","montant":150,"aPayer":True,"conso":40,"src":"photo"},
    {"id":202,"four":"Vallée Claire","type":"eau","date":"2026-05-06","montant":176.25,"aPayer":True,"conso":44,"src":"photo"}],
  "fraisCommuns":[],"entries":[]}
with sync_playwright() as p:
    b=p.chromium.launch(); c=b.new_context(viewport={'width':412,'height':900}); pg=c.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    pg.goto(APP); pg.wait_for_timeout(300)
    pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); pg.reload(); pg.wait_for_timeout(1000)
    pg.locator('#nav .navi[data-view="factures"]').click(); pg.wait_for_timeout(300)
    pg.locator('.avtabs button[data-av="prov"]').click(); pg.wait_for_timeout(500)
    def hero(): return money(pg.locator(".thero .dash-big").inner_text())
    def fin(): return money(pg.locator(".pvread .l b").first.inner_text())
    def tab(): return norm(pg.locator(".thero .cch-tabs button.on").inner_text()).replace("★","").replace("☆","").strip()
    check(tab()=="De côté", "onglet par défaut : « De côté »")
    h0=hero(); check(abs(fin()-h0)<0.01, "octobre : la fin du mois = le total mis de côté (%s / %s)"%(fin(), h0))
    # ---------- un mois futur : le graphique part des sommes déjà de côté
    pg.locator("#mn-next").click(); pg.wait_for_timeout(400)
    h1=hero(); check(abs(fin()-h1)<0.01 and h1>h0, "novembre (futur) : « Fin novembre » = le total (%s), plus 0 + la mise de côté du mois"%fin())
    pg.locator("#mn-today").click(); pg.wait_for_timeout(400)
    # ---------- avec les factures prévues
    pg.locator('.thero .cch-tabs button[data-m="prevu"]').click(); pg.wait_for_timeout(400)
    t=norm(pg.locator(".thero").inner_text())
    check(tab().startswith("Avec les factures prévues") and "Après factures" in t and "Factures prévues" in t and "Le plus bas" in t and "À compléter" in t, "onglet « Avec les factures prévues » : légende et chiffres (factures prévues, le plus bas, à compléter)")
    pg.screenshot(path=os.path.join(SP,"t102_prevu.png"), full_page=True)
    nov=pg.locator('.pvcol[data-m="2026-11"]')
    check("~" in nov.locator(".c").inner_text() or "−" in nov.locator(".c").inner_text(), "novembre : une facture prévue sur la colonne (%s)"%nov.locator(".c").inner_text())
    nov.click(); pg.wait_for_timeout(300)
    r=norm(pg.locator(".pvread .l").inner_text())
    check("Impôt foncier" in r and "manque" in r and "Eau" in r, "détail de novembre : impôt foncier (manque) et facture d'eau estimée : %s"%r.replace("\n"," | "))
    check(fin()<h1-500, "novembre après factures (%s) bien plus bas que sans (%s)"%(fin(), h1))
    rows=[norm(x) for x in pg.locator(".pvlist .row").all_inner_texts()]
    for x in rows: print("  ", x.replace("\n"," | "))
    fo=[x for x in rows if "Impôt foncier" in x]; eau=[x for x in rows if "Eau" in x]; ass=[x for x in rows if "Assurance" in x]; tx=[x for x in rows if "Taxe" in x]
    check(fo and "comme en novembre 2025" in fo[0] and "il manquera 590" in fo[0] and "Passer à 620" in fo[0], "foncier : comme l'an dernier (1 000 €), il manquera 590 €, « Passer à 620 € / mois »")
    check(len(eau)>=2 and all("estimée d'après tes factures" in x for x in eau), "eau : les prochaines factures estimées du fournisseur suivi (%d)"%len(eau))
    check(ass and "montant prévu" in ass[0] and "il manquera 50" in ass[0] and "Passer à 60" in ass[0], "assurance : montant prévu 300 € en mars, il manquera 50 €, « Passer à 60 € / mois »")
    check(tx and "montant non indiqué" in tx[0], "taxe : échéance sans montant → « montant non indiqué »")
    pg.locator(".pvlist .row", has_text="Assurance").locator(".prapply").click(); pg.wait_for_timeout(400)
    P=[x for x in pg.evaluate("()=>JSON.parse(localStorage.getItem('provisions'))") if x["id"]==13][0]
    ass=[norm(x) for x in pg.locator(".pvlist .row").all_inner_texts() if "Assurance" in x]
    check((P.get("mensuelChanges") or {}).get("2026-11")==60 and ass and "couverte" in ass[0], "« Passer à 60 € / mois » : à partir de novembre, l'assurance est couverte")
    check(tab().startswith("Avec les factures prévues"), "l'onglet choisi reste affiché")
    # ---------- 12 mois d'À venir : le foncier prévu compte, novembre en jaune
    pg.locator('.avtabs button[data-av="mois"]').click(); pg.wait_for_timeout(400)
    check(pg.locator('.fct-col[data-m="2026-11"] i.e.w').count()==1, "12 mois : novembre en jaune (il manquera dans une provision)")
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
print("\n%d échec(s)"%len(fails))
