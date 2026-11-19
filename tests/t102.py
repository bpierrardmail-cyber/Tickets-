# Provisions (refonte du 19/11) : enveloppes avec la prochaine facture prévue et ce qui manquera, détail d'une enveloppe,
# frise des factures, « Tout remettre à l'heure » (annulable). Données inventées.
# - factures prévues : montant prévu (✎), factures estimées du fournisseur suivi, sinon le même mois l'an dernier ;
#   échéance sans montant : « montant de la facture ? » ; ce qui manquera, et « Passer à … / mois » ;
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
    # refonte du 19/11 : enveloppes (cercle, prochaine facture, manque), détail d'une enveloppe, frise des factures
    hero=money(pg.locator("#pvHero .av2-big b").inner_text())
    check(hero>0 and "total provisions" in pg.locator("#pvHero").inner_text().lower(), "Provisions : le total en haut (%s)"%hero)
    def card(nom): return norm(pg.locator(".pv2-env", has_text=nom).inner_text())
    fo=card("Impôt foncier"); ass=card("Assurance"); tx=card("Taxe"); eau=card("Eau")
    for x in (fo, ass, tx, eau): print("  ", x.replace("\n"," | "))
    check("manque 590" in fo and "le mois prochain" in fo, "foncier : facture le mois prochain, manque 590 €")
    check("manque 50" in ass, "assurance : manque 50 €")
    check("montant de la facture ?" in tx, "taxe : échéance sans montant → « montant de la facture ? »")
    check("à l'heure" in eau, "eau : à l'heure")
    check("2 enveloppes à renforcer" in pg.locator("#pvHero").inner_text() and pg.locator("#pvFixAll").count()==1, "en haut : « 2 enveloppes à renforcer » et « Tout remettre à l'heure »")
    tl=pg.locator('.pvtl[data-m="2026-11"]')
    check(tl.count()==1 and tl.locator(".bb.w").count()==1, "frise : novembre en orange (il manquera)")
    pg.screenshot(path=os.path.join(SP,"t102_prov.png"), full_page=True)
    # détail du foncier
    pg.locator(".pv2-env", has_text="Impôt foncier").click(); pg.wait_for_timeout(400)
    d=norm(pg.locator("#app").inner_text())
    check("comme en novembre 2025" in d and "il manquera 590" in d and pg.locator(".prapply").count()==1 and "620" in pg.locator(".prapply").inner_text(), "détail du foncier : comme l'an dernier, il manquera 590 €, « Passer à 620 € / mois »")
    pg.locator("#hback").click(); pg.wait_for_timeout(300)
    # détail de l'eau : la prochaine facture estimée d'après les factures du fournisseur
    pg.locator(".pv2-env", has_text="Eau").click(); pg.wait_for_timeout(400)
    check("estimée d'après tes factures" in norm(pg.locator("#app").inner_text()), "détail de l'eau : facture estimée d'après le fournisseur suivi")
    pg.locator("#hback").click(); pg.wait_for_timeout(300)
    # assurance : « Passer à 60 € / mois » → à l'heure
    pg.locator(".pv2-env", has_text="Assurance").click(); pg.wait_for_timeout(400)
    pg.locator(".prapply").click(); pg.wait_for_timeout(400)
    P=[x for x in pg.evaluate("()=>JSON.parse(localStorage.getItem('provisions'))") if x["id"]==13][0]
    check((P.get("mensuelChanges") or {}).get("2026-11")==60 and "à l'heure" in norm(pg.locator(".pvd-top").inner_text()), "« Passer à 60 € / mois » : à partir de novembre, l'assurance est à l'heure")
    pg.locator("#hback").click(); pg.wait_for_timeout(300)
    check("1 enveloppe à renforcer" in pg.locator("#pvHero").inner_text(), "il ne reste que le foncier à renforcer")
    # « Tout remettre à l'heure » puis Annuler
    pg.locator("#pvFixAll").click(); pg.wait_for_timeout(400)
    P=[x for x in pg.evaluate("()=>JSON.parse(localStorage.getItem('provisions'))") if x["id"]==11][0]
    check((P.get("mensuelChanges") or {}).get("2026-11")==620 and "à l'heure" in card("Impôt foncier"), "« Tout remettre à l'heure » : foncier à 620 € / mois")
    pg.locator(".ui-toast button, #uiToast button", has_text="Annuler").first.click(); pg.wait_for_timeout(400)
    P=[x for x in pg.evaluate("()=>JSON.parse(localStorage.getItem('provisions'))") if x["id"]==11][0]
    check(not (P.get("mensuelChanges") or {}).get("2026-11") and "manque 590" in card("Impôt foncier"), "Annuler remet le foncier comme avant")
    # ---------- Factures : « prête pour novembre · il restera … » (carte du fournisseur et son détail)
    pg.locator('.avtabs button[data-av="fact"]').click(); pg.wait_for_timeout(400)
    cd=norm(pg.locator(".fct-card", has_text="Vallée Claire").inner_text())
    check("prête pour novembre" in cd and "il restera 128,00" in cd, "carte du fournisseur : « prête pour novembre · il restera 128 € » : %s"%cd.replace("\n"," | "))
    pg.locator(".fct-card", has_text="Vallée Claire").click(); pg.wait_for_timeout(400)
    pv=norm(pg.locator(".fct-pv").inner_text())
    check("prête" in pv and "il restera 128,00 € après celle de novembre" in pv, "détail : « prête · il restera 128 € après celle de novembre »")
    pg.locator("#hback").click(); pg.wait_for_timeout(300)
    # ---------- 12 mois d'À venir : le foncier prévu compte, novembre en jaune
    pg.locator('.avtabs button[data-av="mois"]').click(); pg.wait_for_timeout(400)
    check(pg.locator('.fct-col[data-m="2026-11"]').get_attribute("data-dot") in ("o","r"), "12 mois : novembre en orange ou rouge (il manquera dans une provision)")
    pg.locator('.fct-col[data-m="2026-11"]').click(); pg.wait_for_timeout(300)
    check("Impôt foncier" in pg.locator(".av2-warn").first.inner_text() and pg.locator(".avgoprov").count()>=1, "12 mois, novembre : « Il manquera » pour le foncier et « Voir la provision »")
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
print("\n%d échec(s)"%len(fails))
