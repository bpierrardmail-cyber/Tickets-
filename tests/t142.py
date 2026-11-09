# Campagne de cas limites (07/11) : bugs de calcul trouvés par la relecture indépendante. Données inventées.
# 1. installation neuve : un ticket saisi par le titulaire (payé par vide) sort bien de son compte ;
# 2. renommer une personne : parts du commun, partage d'un ticket, parts d'un frais, épargne, remboursement et groupe suivent ;
# 3. une personne supprimée n'a plus de part du commun après son dernier mois ;
# 4. un compte neuf sans opération reporte ses frais fixes d'un mois sur l'autre ;
# 5. la sauvegarde emporte les réglages qui changent des montants (commBalFrom, comProd, cptLiq, anFrais) ; pas de « -0,00 € ».
import sys, os, json
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
APP='file://'+ROOT+'/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def txt(pg): return pg.locator("#app").inner_text().replace(" "," ").replace("\xa0"," ")
with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    def start(d):
        c=b.new_context(viewport={'width':412,'height':900}); pg=c.new_page()
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda x: x.dismiss())
        pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
        pg.goto(APP); pg.wait_for_timeout(300)
        pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", d); pg.reload(); pg.wait_for_timeout(1300)
        return c, pg
    def ls(pg, k): return pg.evaluate("k=>JSON.parse(localStorage.getItem(k))", k)
    base={"askName":False,"devise":"EUR","welcomeSeen":True,"taxoV2":2,"taxoV3":3,"taxoV4":4}
    # 1. ticket du titulaire saisi par l'interface (payé par vide)
    d=dict(base); d.update({"comptes":[{"key":"principal","nom":"Compte courant","payer":"Camille","main":True}],"soldeInit":{"principal":{"2026-10":1000}}})
    c, pg = start(d)
    pg.locator("#navplus").click(); pg.wait_for_timeout(300); pg.locator('.sheet-overlay .dr-row[data-k="man"]').click(); pg.wait_for_timeout(500)
    pg.locator("#f-montant").fill("1 234,56"); pg.locator("#f-marchand").fill("Magasin Fictif"); pg.locator('#chips .chip[data-cat="Loisirs"]').click(); pg.wait_for_timeout(200)
    pg.locator("#save").click(); pg.wait_for_timeout(700)
    if pg.locator("#cksave").count(): pg.locator("#cksave").click(); pg.wait_for_timeout(500)
    E=ls(pg,"entries"); print("  payé par enregistré :", repr(E[-1].get("payePar")))
    pg.locator('#nav .navi[data-view="compte"]').click(); pg.wait_for_timeout(600); t=txt(pg)
    check("−1 234,56" in t or "-1 234,56" in t, "1. le ticket du titulaire sort du compte (Sorties −1 234,56 €)")
    check("−234,56" in t or "-234,56" in t, "1. solde estimé 1 000 − 1 234,56 = −234,56 €")
    c.close()
    # 2. renommer Marie → Mia
    d=dict(base); d.update({"comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True}],"personnes":[{"nom":"Marie"}],"communParts":{"Alex":60,"Marie":40},
      "fraisCommuns":[{"id":1,"label":"Loyer","montant":1000,"personne":"Commun","recurrent":True,"startMonth":"2026-01","parts":{"2026-01":{"Alex":20,"Marie":80}}}],
      "entries":[{"id":5,"date":"2026-10-05","marchand":"Épicerie","montant":20,"categorie":"Courses","payePar":"Alex","share":{"Alex":50,"Marie":50},"articles":[]}],
      "epargne":[{"id":3,"nom":"Livret Marie","owner":"Marie","vals":{"2026-10":100}}],"commRemb":[{"id":7,"month":"2026-10","from":"Marie","to":"Alex","montant":10,"date":"2026-10-06"}],
      "groupes":[{"id":1,"nom":"Week-end","membres":["Alex","Marie"],"dep":[{"id":1,"date":"2026-10-10","label":"Gîte","montant":40,"payePar":"Marie","pour":["Marie"]}],"rembs":[]}]})
    c, pg = start(d)
    pg.locator("#hmenu").click(); pg.wait_for_timeout(400); pg.locator('.mnsub[data-ms="gerer"]').click(); pg.wait_for_timeout(200); pg.locator('.dr-row[data-k="persons"]').click(); pg.wait_for_timeout(400)
    pg.locator('.sheet-overlay [data-p="Marie"]').click(); pg.wait_for_timeout(300); pg.locator('.sheet-overlay button[data-i="0"]').click(); pg.wait_for_timeout(300)
    pg.locator(".sheet-overlay input").first.fill("Mia"); pg.locator('.sheet-overlay button[type="submit"]').click(); pg.wait_for_timeout(500)
    cp=ls(pg,"communParts"); f=ls(pg,"fraisCommuns")[0]; e=ls(pg,"entries")[0]; ep=ls(pg,"epargne")[0]; rb=ls(pg,"commRemb")[0]; g=ls(pg,"groupes")[0]
    check(cp=={"Alex":60,"Mia":40}, "2. parts du commun %s"%cp)
    check(f["parts"]["2026-01"]=={"Alex":20,"Mia":80} and e["share"]=={"Alex":50,"Mia":50}, "2. parts du frais et partage du ticket suivent")
    check(ep["owner"]=="Mia" and rb["from"]=="Mia", "2. épargne et remboursement suivent")
    check(g["membres"]==["Alex","Mia"] and g["dep"][0]["payePar"]=="Mia" and g["dep"][0]["pour"]==["Mia"], "2. groupe suit")
    pg.locator('#nav .navi[data-view="communes"]').click(); pg.wait_for_timeout(600); t=txt(pg)
    check("Marie" not in t, "2. plus de « Marie » fantôme dans le Foyer")
    c.close()
    # 3. Marie supprimée en août : en octobre, Alex paie seul sa part du Loyer
    d=dict(base); d.update({"comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True}],"personnes":[{"nom":"Marie","archived":"2026-08"}],"communParts":{"Alex":50,"Marie":50},
      "fraisCommuns":[{"id":1,"label":"Loyer","montant":1000,"personne":"Commun","recurrent":True,"startMonth":"2026-01"}]})
    c, pg = start(d)
    pg.locator('#nav .navi[data-view="communes"]').click(); pg.wait_for_timeout(600); t=txt(pg)
    i=t.find("Ta part"); print("  Foyer :", t[max(0,i-10):i+60].replace("\n"," | "))
    check(("1 000,00" in t[i:i+80] or "1000,00" in t[i:i+80]) and "500,00" not in t, "3. octobre : Marie (supprimée en août) n'a plus de part, Alex a 1 000 €")
    c.close()
    # 4. compte neuf depuis septembre, frais perso de 30 €/mois, aucune opération
    d=dict(base); d.update({"comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True},{"key":"accN","nom":"Compte neuf","payer":"Marie","since":"2026-09"}],"personnes":[{"nom":"Marie"}],
      "fraisCommuns":[{"id":2,"label":"Abonnement","montant":30,"personne":"Marie","recurrent":True,"startMonth":"2026-09","jour":3}],"compteSel":"accN"})
    c, pg = start(d)
    pg.locator('#nav .navi[data-view="compte"]').click(); pg.wait_for_timeout(600)
    if pg.locator("#acctSel").count():
        pg.locator("#acctSel").click(); pg.wait_for_timeout(300)
        if pg.locator('.sheet-overlay [data-acct="accN"]').count(): pg.locator('.sheet-overlay [data-acct="accN"]').click(); pg.wait_for_timeout(500)
    t=txt(pg); i=t.find("Fin de mois"); print("  compte neuf :", t[max(0,i-20):i+40].replace("\n"," | "))
    check("−60,00" in t[i:i+40] or "-60,00" in t[i:i+40], "4. compte neuf : fin d'octobre = −60 € (septembre reporté)")
    c.close()
    # 5. sauvegarde et -0,00
    src=open(os.path.join(ROOT,'beta','index.html'),encoding='utf-8').read()
    check(src.count('"budgetsP","commBalFrom","comProd","cptLiq","anFrais"]')==2, "5. sauvegarde et restauration : commBalFrom, comProd, cptLiq, anFrais")
    d=dict(base); d.update({"comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True}],"entries":[{"id":9,"date":"2026-10-05","marchand":"Gratuit","montant":-0.004,"categorie":"Autre","payePar":"Alex","articles":[]}]})
    c, pg = start(d)
    pg.locator('#nav .navi[data-view="compte"]').click(); pg.wait_for_timeout(500)
    check("-0,00" not in txt(pg), "5. pas de « -0,00 € »")
    c.close()
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
print("\n%d échec(s)"%len(fails)); sys.exit(1 if fails else 0)
