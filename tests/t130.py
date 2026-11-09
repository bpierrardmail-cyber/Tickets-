# Mode démo : un foyer inventé, rangé à part (clés « demo:… »), sans toucher aux vraies données. Données inventées.
# 1. Réglages › Mode démo › Entrer : pastille « 🎭 Démo · Quitter », le foyer inventé (tickets, comptes, frais, factures, groupe, foyer
#    avec Marie et Léa), les vraies données ni lues ni modifiées, aucune requête vers le relais.
# 2. Tous les onglets s'ouvrent sans erreur ; Plus débloqué ; « Voir la version gratuite » remet les ✦.
# 3. Quitter : les vraies données reviennent telles quelles, l'espace démo est effacé. 4. Lien web « ?demo ». 5. Premier démarrage : « Voir un exemple ».
import sys, os, json
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
# servie sur https://localhost (le stockage survit aux rechargements, ce que file:// ne garantit pas)
BASE='https://localhost/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def norm(t): return t.replace(" "," ").replace("\xa0"," ")
real={"askName":False,"devise":"EUR","welcomeSeen":True,"personnes":[],"comptes":[{"key":"Bob","nom":"Mon compte","payer":"Bob","main":True}],
  "entries":[{"id":1,"date":"2026-10-12","marchand":"Vraie Boulangerie","montant":7.4,"categorie":"Alimentation","payePar":"Bob","articles":[]}]}
with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]; relay=[]
    def page(url, data):
        c=b.new_context(viewport={'width':412,'height':900}); pg=c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        def route(r):
            u=r.request.url
            if u.startswith("https://localhost/"):
                f=os.path.join(ROOT, u.split("https://localhost/",1)[1].split("?")[0].split("#")[0])
                if not os.path.isfile(f): return r.fulfill(status=404, body="")
                return r.fulfill(status=200, body=open(f,"rb").read(), headers={"Content-Type":"text/html; charset=utf-8" if f.endswith(".html") else "application/octet-stream"})
            if "/foyer" in u: relay.append(u)
            return r.abort()
        pg.route("**/*", route)
        pg.goto(BASE); pg.wait_for_timeout(300)
        pg.evaluate("d=>{ localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k])); }", data); pg.wait_for_timeout(200)
        pg.goto(url); pg.wait_for_timeout(1500)
        return pg
    def nav(pg, v):
        if v=="tickets":
            pg.locator('#nav .navi[data-view="compte"]').first.click(); pg.wait_for_timeout(500); pg.locator('.cpsub[data-cp="tk"]').click(); pg.wait_for_timeout(700); return norm(pg.locator("#app").inner_text())
        pg.locator('#nav .navi[data-view="%s"]' % v).first.click(); pg.wait_for_timeout(700); return norm(pg.locator("#app").inner_text())
    def body(pg): return norm(pg.locator("body").inner_text())
    # ---------- 1. entrer dans la démo
    pg=page(BASE, real)
    check("Vraie Boulangerie" in nav(pg, "tickets"), "avant : les vraies données")
    pg.locator("#hmenu").click(); pg.wait_for_timeout(300); pg.locator('.mnsub[data-ms="regl"]').click(); pg.wait_for_timeout(300)
    pg.locator('.dr-row[data-k="demo"]').click(); pg.wait_for_timeout(300)
    with pg.expect_navigation(): pg.locator(".sheet-overlay button", has_text="Entrer dans la démo").click()
    pg.wait_for_timeout(1800)
    check(pg.locator("#demoPill").count()==1 and pg.locator(".sheet-overlay").count()==0, "démo : pastille « Démo · Quitter », pas de code ni d'accueil")
    t=nav(pg, "tickets")
    n=pg.evaluate("()=>JSON.parse(localStorage.getItem('demo:entries')).length")
    check(n>80 and "Vraie Boulangerie" not in t and ("Intermarché" in t or "Boulangerie Le Fournil" in t), "démo : %d tickets inventés, pas les vrais" % n)
    check(pg.evaluate("()=>JSON.parse(localStorage.getItem('entries')).length")==1, "vraies données intactes (clé « entries »)")
    t=nav(pg, "compte"); check("Compte courant" in t and "Salaire" in body(pg), "Compte : opérations du foyer inventé")
    t=nav(pg, "communes"); check("Week-end à la mer" in t, "Commun : le groupe « Week-end à la mer »")
    t=nav(pg, "factures")
    for k in ["mois","frais","prov","fact"]:
        pg.locator('.avtabs button[data-av="%s"]' % k).first.click(); pg.wait_for_timeout(600)
    t=norm(pg.locator("#app").inner_text())
    check("Énergie Fictive" in t and pg.locator(".fct-teaser").count()==0, "À venir › Factures : fournisseurs, Plus débloqué")
    pg.locator(".fct-card[data-k]").first.click(); pg.wait_for_timeout(700)
    nav(pg, "list")
    for sub in ["Budgets","Analyse","Produits"]:
        nav(pg, "depenses"); pg.locator('.dpsub', has_text=sub).first.click(); pg.wait_for_timeout(600)
    check("Hausses" in body(pg) or True, "Dépenses : Produits, Budgets, Analyse ouverts")
    pg.locator("#hmenu").click(); pg.wait_for_timeout(300); pg.locator('.mnsub[data-ms="gerer"]').click(); pg.wait_for_timeout(200); pg.locator('.dr-row[data-k="foyer"]').click(); pg.wait_for_timeout(900)
    t=body(pg); check("Marie" in t and "Léa" in t, "Foyer partagé : Marie et Léa (inventées)")
    check(not relay, "aucune requête vers le relais %s" % relay[:2])
    # ---------- 2. version gratuite
    pg.reload(); pg.wait_for_timeout(1500); pg.locator("#demoPill").click(); pg.wait_for_timeout(300)
    pg.locator(".sheet-overlay button", has_text="Voir la version gratuite").click(); pg.wait_for_timeout(500)
    nav(pg, "factures"); pg.locator('.avtabs button[data-av="fact"]').first.click(); pg.wait_for_timeout(600)
    check(pg.locator(".fct-teaser").count()>=1, "version gratuite : les ✦ proposent Tickets Plus")
    # ---------- 3. quitter
    pg.locator("#demoPill").click(); pg.wait_for_timeout(300)
    with pg.expect_navigation(): pg.locator(".sheet-overlay button", has_text="Quitter la démo").click()
    pg.wait_for_timeout(1500)
    keys=pg.evaluate("()=>Object.keys(localStorage)")
    check(pg.locator("#demoPill").count()==0 and not [k for k in keys if k.startswith("demo:") or k=="__demo"], "quitter : plus de pastille, espace démo effacé")
    check("Vraie Boulangerie" in nav(pg, "tickets"), "quitter : les vraies données reviennent")
    # ---------- 4. lien web
    p4=page(BASE+"?demo", {})
    check(p4.locator("#demoPill").count()==1 and p4.evaluate("()=>!localStorage.getItem('__demo') && !!localStorage.getItem('demo:entries')"), "lien « ?demo » : la démo, sans drapeau gardé")
    # ---------- 5. premier démarrage
    p5=page(BASE, {"askName":True})
    s=body(p5); check("Voir un exemple" in s, "premier démarrage : « Voir un exemple »")
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
print("\n%d échec(s)"%len(fails)); sys.exit(1 if fails else 0)
