# Commun › « Qui doit combien à qui » (✦ Plus) :
# 1. couple 50/50 : loyer payé en entier par le compte d'Alex, produits partagés payés par Marie → « Marie te doit 470,00 € » ;
# 2. « Remboursé » avec virement : un virement sur chaque compte, « Tout est équilibré » ; Annuler remet tout ;
# 3. « Sans virement » : rien dans les comptes, noté dans l'historique ; supprimer depuis l'historique ;
# 4. le reste d'un mois passe au suivant ;
# 5. famille de 4 : 3 remboursements au plus ;
# 6. version Store sans Plus : la fonction est présentée, le bouton demande Plus.
# Données inventées.
import sys, os, json
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
APP='file://'+ROOT+'/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def norm(t): return t.replace(" "," ").replace("\xa0"," ")
base={"askName":False,"devise":"EUR","personnes":[{"nom":"Marie"}],
  "comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True},{"key":"marie","nom":"Compte Marie","payer":"Marie"}],
  "communParts":{"Alex":50,"Marie":50},
  "fraisCommuns":[{"id":1,"label":"Loyer","montant":1000,"personne":"Commun","recurrent":True,"startMonth":"2026-01","jour":5}],
  "entries":[{"id":10,"date":"2026-10-08","marchand":"Marché","montant":60,"categorie":"Courses","payePar":"Marie","compte":"marie","articles":[{"label":"Légumes","prix":60,"produit":"","commun":True}]}],
  "commBalFrom":"2026-10"}
with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    def open_app(d, url=APP):
        c=b.new_context(viewport={'width':412,'height':900}); pg=c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
        pg.goto(url); pg.wait_for_timeout(300)
        pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", d); pg.reload(); pg.wait_for_timeout(900)
        pg.locator('#nav .navi[data-view="communes"]').click(); pg.wait_for_timeout(500)
        return c, pg
    T=lambda pg: norm(pg.locator("#cbal").inner_text()) if pg.locator("#cbal").count() else ""
    LS=lambda pg, k: pg.evaluate("k=>JSON.parse(localStorage.getItem(k)||'null')", k)
    # ---------- 1. couple
    c, pg = open_app(base); t=T(pg); print("  ", t.replace("\n"," | "))
    check("Qui doit combien à qui" in t and "Marie te doit 470,00 €" in t, "couple : « Marie te doit 470,00 € » (loyer 1 000 € payé par Alex, 60 € de produits payés par Marie)")
    rows=[norm(x) for x in pg.locator(".cbal-r").all_inner_texts()]
    check(len(rows)==2 and rows[0].startswith("Toi") and "+470" in rows[0] and "−470" in rows[1], "barres : Toi +470, Marie −470 %s" % rows)
    # ---------- 2. remboursé avec virement
    pg.locator(".cbal-ok").first.click(); pg.wait_for_timeout(300)
    s=norm(pg.locator(".sheet-overlay").last.inner_text())
    check("Créer le virement" in s and "Sans virement" in s and "Depuis le compte de Marie" in s, "fenêtre : créer le virement (depuis / vers le compte) ou sans virement")
    pg.locator(".sheet-overlay .ui-ok, .sheet-overlay button.primary").last.click(); pg.wait_for_timeout(500)
    V=LS(pg, "virements") or []; R=LS(pg, "commRemb") or []
    check(len(V)==2 and any(v["person"]=="marie" and v["montant"]==-470 and v.get("done") for v in V) and any(v["person"]=="Alex" and v["montant"]==470 for v in V), "2 virements créés : −470 € sur le compte de Marie, +470 € sur celui d'Alex %s" % [(v["person"], v["montant"]) for v in V])
    check(len(R)==1 and R[0]["from"]=="Marie" and R[0]["to"]=="Alex" and len(R[0].get("vir",[]))==2, "remboursement noté (avec ses virements)")
    check("Tout est équilibré" in T(pg), "« ✓ Tout est équilibré »")
    pg.locator(".ui-toast.undo button").click(); pg.wait_for_timeout(400)
    check(not (LS(pg, "virements") or []) and not (LS(pg, "commRemb") or []) and "Marie te doit 470,00 €" in T(pg), "Annuler : virements et remboursement retirés")
    # ---------- 3. sans virement, partiel
    pg.wait_for_timeout(300); pg.locator(".cbal-ok").first.click(); pg.wait_for_timeout(300)
    pg.locator(".sheet-overlay").last.locator("input").first.fill("400")
    pg.locator(".sheet-overlay button", has_text="Sans virement").last.click(); pg.wait_for_timeout(150)
    pg.locator(".sheet-overlay .ui-ok, .sheet-overlay button.primary").last.click(); pg.wait_for_timeout(500)
    check(not (LS(pg, "virements") or []) and len(LS(pg, "commRemb") or [])==1 and "Marie te doit 70,00 €" in T(pg), "sans virement, 400 € : rien dans les comptes, « Marie te doit 70,00 € »")
    pg.wait_for_timeout(6500)
    pg.locator("#cbalHist").click(); pg.wait_for_timeout(300)
    s=norm(pg.locator(".sheet-overlay").last.inner_text()); check("Marie → toi" in s and "sans virement" in s and "400,00 €" in s, "historique : « Marie → toi · sans virement · 400,00 € »")
    # ---------- 4. report sur le mois suivant
    pg.keyboard.press("Escape"); pg.evaluate("()=>document.querySelectorAll('.sheet-overlay').forEach(x=>x.remove())")
    pg.locator("#mn-next").click(); pg.wait_for_timeout(400); t=T(pg)
    check("Marie te doit 570,00 €" in t and "reportés" in t, "novembre : 500 € de loyer + 70 € reportés → « Marie te doit 570,00 € » (%s)" % t.replace("\n"," | ")[-120:])
    pg.locator("#mn-today").click(); pg.wait_for_timeout(300)
    # supprimer depuis l'historique
    pg.locator("#cbalHist").click(); pg.wait_for_timeout(300); pg.locator(".sheet-overlay .dr-row[data-id]").first.click(); pg.wait_for_timeout(300)
    pg.locator(".sheet-overlay .btn.danger").last.click(); pg.wait_for_timeout(400)
    check(not (LS(pg, "commRemb") or []) and "Marie te doit 470,00 €" in T(pg), "historique › Supprimer : retiré, la dette revient")
    c.close()
    # ---------- 5. famille de 4
    fam=json.loads(json.dumps(base)); fam["personnes"]=[{"nom":"Marie"},{"nom":"Léa"},{"nom":"Tom"}]
    fam["communParts"]={"Alex":35,"Marie":35,"Léa":15,"Tom":15}
    fam["comptes"]+= [{"key":"lea","nom":"Compte Léa","payer":"Léa"},{"key":"tom","nom":"Compte Tom","payer":"Tom"}]
    fam["fraisCommuns"].append({"id":2,"label":"Électricité","montant":720,"personne":"Commun","recurrent":True,"startMonth":"2026-01","compte":"marie"})
    fam["entries"]=[{"id":11,"date":"2026-10-08","marchand":"Boulangerie","montant":50,"categorie":"Courses","payePar":"Léa","articles":[{"label":"Pain","prix":50,"produit":"","commun":True}]},
                    {"id":12,"date":"2026-10-09","marchand":"Cinéma","montant":40,"categorie":"Loisirs","payePar":"Tom","articles":[{"label":"Places","prix":40,"produit":"","commun":True}]}]
    c, pg = open_app(fam); t=T(pg); print("  ", t.replace("\n"," | "))
    n=pg.locator(".cbal-ok").count()
    check(pg.locator(".cbal-r").count()==4 and 1<=n<=3 and "remboursements suffisent" in t, "famille de 4 : %d remboursements au plus 3" % n)
    c.close()
    # ---------- 6. Store sans Plus
    c, pg = open_app(base, APP+"?edition=store")
    check(pg.locator("#cbal").count()==0 and pg.locator("#cbalBuy").count()==1, "Store sans Plus : présentation et bouton ✦")
    pg.locator("#cbalBuy").click(); pg.wait_for_timeout(300)
    check(pg.locator(".wlc.plus").count()==1 and "Qui doit combien à qui" in pg.locator(".wlc.plus").inner_text(), "le bouton ouvre le carrousel Tickets Plus à « Qui doit combien à qui »")
    c.close()
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
print("\n%d échec(s)"%len(fails)); sys.exit(1 if fails else 0)
