# Étape 1 : onglet À venir (12 mois · Frais fixes · Provisions · Factures), Commun allégé, liens depuis Compte, Store sans Plus
import sys, os, json, re
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
SP=(sys.argv[1] if len(sys.argv)>1 else HERE); APP='file://'+ROOT+'/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def norm(t): return t.replace(" "," ").replace("\xa0"," ")
F=json.load(open(os.path.join(HERE,"donnees","edf_fictif.json"),encoding="utf-8"))
data={"askName":False,"devise":"EUR","personnes":[{"nom":"Sam"}],
  "comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True},{"key":"Sam","nom":"Compte Sam","payer":"Sam"}],
  "fraisCommuns":[{"id":1,"label":"Loyer","montant":650,"personne":"Commun","recurrent":True,"startMonth":"2026-01","jour":5},
                  {"id":2,"label":"Box internet","montant":29.99,"personne":"Commun","recurrent":True,"startMonth":"2026-01","jour":15,"split":True},
                  {"id":3,"label":"Assurance auto","montant":48.2,"personne":"Alex","recurrent":True,"startMonth":"2026-01","jour":28},
                  {"id":4,"label":"Salle de sport","montant":29.9,"personne":"Sam","recurrent":True,"startMonth":"2026-01","jour":2}],
  "provisions":[{"id":11,"nom":"Taxe foncière","mensuel":82,"soldeInitial":410,"startMonth":"2026-10","prelevements":[],"echeance":10,"prevu":980}],
  "factures":F, "entries":[]}
def tabs(pg): return pg.evaluate("()=>[].map.call(document.querySelectorAll('#nav .navi'), b=>b.offsetParent?b.textContent:null).filter(Boolean)")
def avtabs(pg): return pg.evaluate("()=>[].map.call(document.querySelectorAll('.avtabs button'), b=>b.textContent.trim())")
def avon(pg): return pg.evaluate("()=>{ var b=document.querySelector('.avtabs button.on'); return b?b.textContent.trim():null; }")
with sync_playwright() as p:
    b=p.chromium.launch()
    def ctx_for(url, extra=None):
        c=b.new_context(viewport={'width':412,'height':900}); pg=c.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
        pg.goto(url); pg.wait_for_timeout(300)
        d=dict(data); d.update(extra or {})
        pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", d); pg.reload(); pg.wait_for_timeout(900)
        return c, pg, errs
    # ---------- Perso ----------
    c, pg, errs = ctx_for(APP)
    check(tabs(pg)==["Accueil","Dépenses","Compte","À venir","Commun","Bourse"], "barre : « À venir » à la place de « Factures » %s"%tabs(pg))
    pg.locator('#nav .navi[data-view="factures"]').click(); pg.wait_for_timeout(500)
    t=norm(pg.locator("#app").inner_text())
    check(avtabs(pg)==["12 mois","Frais fixes","Provisions","Factures"] and avon(pg)=="12 mois", "À venir : 4 sous-onglets, 12 mois d'abord %s"%avtabs(pg))
    check(pg.locator(".htitle").inner_text()=="À venir" and "les 12 prochains mois" in t.lower() and "à payer bientôt" in t.lower(), "12 mois : graphique et « À payer bientôt »")
    check(pg.locator("#fctImp").count()==1 and pg.locator("#avAddFrais").count()==1, "12 mois : boutons Importer une facture et + Frais fixe")
    pg.screenshot(path=os.path.join(SP,"t92_mois.png"), full_page=True)
    pg.locator('.avtabs button[data-av="frais"]').click(); pg.wait_for_timeout(400)
    t=norm(pg.locator("#app").inner_text())
    check(avon(pg)=="Frais fixes" and "Frais communs" in t and "Loyer" in t and "Assurance auto" in t and "Salle de sport" in t, "Frais fixes : communs et perso au même endroit")
    check(pg.locator("#hback").count()==0 and pg.evaluate("()=>document.querySelector('#nav .navi.on').dataset.view")=="factures", "Frais fixes : pas de retour, onglet À venir allumé")
    pg.locator("#addfrais").click(); pg.wait_for_timeout(300)
    check(pg.locator(".sheet-overlay, .ui-form, .uiform").count()>0 or "Nouveau frais fixe" in pg.locator("body").inner_text(), "Frais fixes : « Ajouter un frais fixe » ouvre le formulaire")
    pg.keyboard.press("Escape"); pg.wait_for_timeout(200)
    pg.reload(); pg.wait_for_timeout(700)
    pg.locator('#nav .navi[data-view="factures"]').click(); pg.wait_for_timeout(300)
    pg.locator('.avtabs button[data-av="prov"]').click(); pg.wait_for_timeout(400)
    t=norm(pg.locator("#app").inner_text())
    check(avon(pg)=="Provisions" and "Taxe foncière" in t and "Total mis de côté" in t and pg.locator("#addprov").count()==1, "Provisions : la page des provisions dans À venir")
    pg.screenshot(path=os.path.join(SP,"t92_prov.png"), full_page=True)
    pg.locator('.avtabs button[data-av="fact"]').click(); pg.wait_for_timeout(400)
    t=norm(pg.locator("#app").inner_text())
    check(avon(pg)=="Factures" and pg.locator(".fct-card[data-k]").count()==1 and "EDF" in t and re.search(r"≈ \d+ €", t), "Factures : la carte EDF avec son estimation")
    pg.locator(".fct-card[data-k]").first.click(); pg.wait_for_timeout(400)
    check("Prochaine facture" in norm(pg.locator("#app").inner_text()), "Factures : le détail EDF s'ouvre")
    pg.locator("#hback").click(); pg.wait_for_timeout(300)
    check(avon(pg)=="Factures", "retour du détail : on revient sur Factures")
    # Commun : frais communs à voir, lien vers À venir
    pg.locator('#nav .navi[data-view="communes"]').click(); pg.wait_for_timeout(400)
    t=norm(pg.locator("#app").inner_text())
    check("Frais communs · 2" in t and "à modifier dans À venir" in t and "Loyer" in t and "Salle de sport" not in t, "Commun : les frais communs du mois, à modifier dans À venir")
    check(pg.locator("#addfrais").count()==0 and pg.locator("#comParts").count()>=1, "Commun : plus de « + Frais fixe », Parts reste")
    pg.screenshot(path=os.path.join(SP,"t92_commun.png"), full_page=True)
    # le titre « Frais communs » replie et déplie la liste (choix gardé)
    h0=pg.evaluate("()=>document.querySelector('.thero').offsetHeight")
    pg.locator(".cfx-h").click(); pg.wait_for_timeout(400)
    check(not pg.locator(".cfx-r").first.is_visible() and "Frais communs · 2" in norm(pg.locator("#app").inner_text()), "Commun : toucher « Frais communs » replie la liste")
    h1=pg.evaluate("()=>document.querySelector('.thero').offsetHeight")
    check(h1>h0+40, "… et le graphique du haut reprend la place libérée (%d → %d px)"%(h0, h1))
    pg.reload(); pg.wait_for_timeout(900); pg.locator('#nav .navi[data-view="communes"]').click(); pg.wait_for_timeout(400)
    check(not pg.locator(".cfx-r").first.is_visible(), "… et elle reste repliée en revenant")
    pg.locator(".cfx-h").click(); pg.wait_for_timeout(400)
    check(pg.locator(".cfx-r").first.is_visible() and pg.evaluate("()=>document.querySelector('.thero').offsetHeight")<h1-40, "toucher encore : elle se déplie, le graphique se resserre")
    pg.locator(".cfx-r.avgo").first.click(); pg.wait_for_timeout(400)
    check(pg.evaluate("()=>document.querySelector('#nav .navi.on').dataset.view")=="factures" and avon(pg)=="Frais fixes", "Commun › un frais commun → À venir › Frais fixes")
    # Compte › Configuration › Provisions → À venir › Provisions
    pg.locator('#nav .navi[data-view="compte"]').click(); pg.wait_for_timeout(400)
    pg.locator('.avtabs .cpsub[data-cp="ep"]').click(); pg.wait_for_timeout(400)
    if pg.locator("#goprov").count(): pg.locator("#goprov").first.click(); pg.wait_for_timeout(400)
    check(avon(pg)=="Provisions", "Compte › Épargne › Provisions → À venir › Provisions")
    check(not errs, "Perso : pas d'erreur %s"%errs[:3]); c.close()
    # ---------- Store sans Plus ----------
    c, pg, errs = ctx_for(APP+"?edition=store", {"factures":[], "plusUnlocked":False})
    check(tabs(pg)==["Accueil","Dépenses","Compte","À venir","Commun"], "Store : 5 onglets %s"%tabs(pg))
    pg.locator('#nav .navi[data-view="factures"]').click(); pg.wait_for_timeout(500)
    t=norm(pg.locator("#app").inner_text())
    check("les 12 prochains mois" in t.lower() and "Débloquer" not in t and avtabs(pg)[3].startswith("Factures") and "✦" in avtabs(pg)[3], "Store : 12 mois ouverts, Factures marqué ✦")
    pg.locator('.avtabs button[data-av="frais"]').click(); pg.wait_for_timeout(300)
    check("Loyer" in norm(pg.locator("#app").inner_text()), "Store : Frais fixes gratuits")
    pg.locator('.avtabs button[data-av="prov"]').click(); pg.wait_for_timeout(300)
    check("Taxe foncière" in norm(pg.locator("#app").inner_text()), "Store : Provisions gratuites")
    pg.locator('.avtabs button[data-av="fact"]').click(); pg.wait_for_timeout(300)
    t=norm(pg.locator("#app").inner_text())
    check("Tes factures, lues sur ton téléphone" in t and pg.locator("#fctBuy").count()==1 and "restent gratuits" in t, "Store : Factures montre ce que Plus apporte, seul le bouton est bloqué")
    pg.screenshot(path=os.path.join(SP,"t92_store.png"), full_page=True)
    pg.locator("#fctBuy").click(); pg.wait_for_timeout(300)
    check("Tickets Plus" in norm(pg.locator("body").inner_text()), "Store : le bouton explique Tickets Plus")
    check(not errs, "Store : pas d'erreur %s"%errs[:3]); c.close()
    b.close()
print("\n%d échec(s)"%len(fails))
