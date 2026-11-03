# Groupes ponctuels (voyage, sortie) : Commun › Groupes.
# 1. nouveau groupe « Week-end Annecy » : Alex + Marie (foyer) + Julien (ami sans l'appli) ;
# 2. dépenses à la main : bilan « qui doit combien à qui », remboursements minimaux ;
# 3. un ticket mis dans le groupe depuis sa fiche compte dans le groupe ;
# 4. « Remboursé » sans virement : le bilan s'équilibre ; avec virement entre comptes du foyer ;
# 5. récap texte ; clore le groupe ; Store sans Plus : la section demande Plus. Données inventées.
import sys, os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
APP='file://'+ROOT+'/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def norm(t): return t.replace(" "," ").replace("\xa0"," ")
data={"askName":False,"devise":"EUR","personnes":[{"nom":"Marie"}],
  "comptes":[{"key":"Alex","nom":"Compte Alex","payer":"Alex","main":True},{"key":"Marie","nom":"Compte Marie","payer":"Marie"}],
  "entries":[{"id":1,"date":"2026-10-24","marchand":"Restaurant du Lac","montant":90,"categorie":"Loisirs","payePar":"Alex","articles":[]},
             {"id":2,"date":"2026-10-28","marchand":"Boulangerie","montant":12,"categorie":"Alimentation","payePar":"Alex","articles":[]}]}
with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    c=b.new_context(viewport={'width':412,'height':900}); pg=c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    pg.goto(APP); pg.wait_for_timeout(300)
    pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); pg.reload(); pg.wait_for_timeout(900)
    me=pg.evaluate("()=>JSON.parse(localStorage.getItem('fyCfg')||'null')")
    def commun():
        pg.locator('#nav .navi[data-view="communes"]').click(); pg.wait_for_timeout(500)
    def G(): return pg.evaluate("()=>JSON.parse(localStorage.getItem('groupes')||'[]')")
    def app(): return norm(pg.locator("#app").inner_text())
    # ---------- 1. nouveau groupe
    commun()
    check(pg.locator("#grpNew").count()==1 and "Groupes" in app(), "Commun : section « Groupes » avec « ＋ Nouveau groupe »")
    pg.locator("#grpNew").click(); pg.wait_for_timeout(300)
    pg.locator("#grpNom").fill("Week-end Annecy")
    pg.locator('.sheet-overlay input[data-p="Marie"]').check(); pg.locator("#grpAutres").fill("Julien")
    pg.locator("#grpOk").click(); pg.wait_for_timeout(500)
    g=G(); check(len(g)==1 and len(g[0]["membres"])==3 and "Julien" in g[0]["membres"] and "Marie" in g[0]["membres"], "groupe créé : 3 participants dont Julien (hors foyer)")
    check("Week-end Annecy" in app() and "3 personnes" in app(), "écran du groupe ouvert")
    me=[x for x in g[0]["membres"] if x not in ("Marie","Julien")][0]
    # ---------- 2. dépenses à la main
    def dep(label, mt, who):
        pg.locator("#gdAdd").click(); pg.wait_for_timeout(300)
        pg.locator(".sheet-overlay button", has_text="Dépense sans ticket").click(); pg.wait_for_timeout(300)
        ov=pg.locator(".sheet-overlay").last
        ov.locator("input").nth(0).fill(label); ov.locator("input").nth(1).fill(mt); ov.locator("select").select_option(who)
        ov.locator("button.primary").click(); pg.wait_for_timeout(400)
    dep("Location", "300", "Marie"); dep("Courses", "60", "Julien")
    t=app(); print("  ", t[:600].replace("\n"," | "))
    check("360" in t and "120" in t, "total 360 €, 120 € chacun")
    check("Tu dois 120,00 € à Marie" in t and "Julien doit 60,00 € à Marie" in t, "bilan : tu dois 120 € à Marie, Julien 60 €")
    # ---------- 3. un ticket mis dans le groupe
    pg.locator('#nav .navi[data-view="depenses"]').click(); pg.wait_for_timeout(500)
    pg.locator('.entry[data-id="1"]').first.click(); pg.wait_for_timeout(500)
    check(pg.locator("#grpc").count()==1, "fiche du ticket : choix « Groupe »")
    pg.locator('#grpc .chip', has_text="Week-end Annecy").click(); pg.wait_for_timeout(300)
    pg.locator("#save").click(); pg.wait_for_timeout(600)
    if pg.locator("#cksave").count(): pg.locator("#cksave").click(); pg.wait_for_timeout(500)
    g=G(); tk=[d for d in g[0]["dep"] if d.get("ticketId")==1]
    check(len(tk)==1 and tk[0]["montant"]==90 and tk[0]["payePar"]==me, "le ticket de 90 € est une dépense du groupe, payée par toi")
    commun(); pg.locator(".grp-row[data-id]").first.click(); pg.wait_for_timeout(500)
    t=app(); print("  ", t[:700].replace("\n"," | "))
    # 450 → 150 chacun ; toi 90 (−60), Marie 300 (+150), Julien 60 (−90)
    check("Tu dois 60,00 € à Marie" in t and "Julien doit 90,00 € à Marie" in t, "avec le ticket : tu dois 60 € à Marie, Julien 90 € à Marie")
    # ---------- 4. Remboursé
    # Julien → Marie : sans virement
    btns=pg.locator(".gbal-ok"); idx=[i for i in range(btns.count()) if "Julien" in pg.locator(".cbal-tr").nth(i).inner_text()][0]
    btns.nth(idx).click(); pg.wait_for_timeout(300)
    ov=pg.locator(".sheet-overlay").last
    seg=ov.locator("button", has_text="Sans virement")
    if seg.count(): seg.first.click(); pg.wait_for_timeout(150)
    ov.locator("button.primary").click(); pg.wait_for_timeout(500)
    t=app(); check("Julien doit" not in t and "Tu dois 60,00 € à Marie" in t, "Julien a remboursé (sans virement) : il ne doit plus rien")
    # toi → Marie : avec virement
    pg.locator(".gbal-ok").first.click(); pg.wait_for_timeout(300)
    ov=pg.locator(".sheet-overlay").last
    seg=ov.locator("button", has_text="virement")
    print("   options:", ov.inner_text().replace("\n"," | ")[:300])
    ov.locator("button.primary").click(); pg.wait_for_timeout(500)
    t=app(); vir=pg.evaluate("()=>JSON.parse(localStorage.getItem('virements')||'[]')")
    check("Tout est équilibré" in t, "après les deux remboursements : tout est équilibré")
    check(any("Remboursement" in v.get("label","") and "Annecy" in v.get("note","") for v in vir), "virement « Remboursement · Marie », note « Groupe « Week-end Annecy » »")
    # ---------- 5. récap, clore
    rec=pg.evaluate("()=>{ var t=null; return t; }")
    pg.evaluate("()=>{ window.__rec=''; Object.defineProperty(navigator, 'clipboard', { configurable:true, value:{ writeText:function(x){ window.__rec=x; return Promise.resolve(); } } }); Object.defineProperty(navigator, 'share', { configurable:true, value:undefined }); }")
    pg.locator("#gShare").click(); pg.wait_for_timeout(300)
    r=norm(pg.evaluate("()=>window.__rec") or "")
    check("Week-end Annecy" in r and "Location : 300,00 €" in r and "Tout est équilibré" in r, "récap texte : nom, dépenses, équilibre")
    pg.locator("#gMore").click(); pg.wait_for_timeout(300)
    pg.locator(".sheet-overlay button", has_text="Clore le groupe").click(); pg.wait_for_timeout(500)
    t=app(); check(G()[0].get("clos") and "1 groupe clos" in t, "groupe clos : rangé dans « 1 groupe clos »")
    # ---------- 6. ajouter un ticket depuis le groupe
    pg.locator("#grpNew").click(); pg.wait_for_timeout(300)
    pg.locator("#grpNom").fill("Sortie ciné"); pg.locator('.sheet-overlay input[data-p="Marie"]').check(); pg.locator("#grpOk").click(); pg.wait_for_timeout(500)
    pg.locator("#gdAdd").click(); pg.wait_for_timeout(300)
    ch=norm(pg.locator(".sheet-overlay").last.inner_text())
    check("Scanner un ticket" in ch and "Saisir un ticket" in ch and "Un ticket déjà enregistré" in ch and "Dépense sans ticket" in ch, "＋ Dépense : scanner, saisir, ticket déjà enregistré, sans ticket")
    pg.locator(".sheet-overlay button", has_text="Saisir un ticket").click(); pg.wait_for_timeout(500)
    check(pg.locator('#grpc .chip.on', has_text="Sortie ciné").count()==1, "fiche du nouveau ticket : groupe « Sortie ciné » déjà choisi")
    pg.locator("#f-montant").fill("24"); pg.locator("#f-marchand").fill("Cinéma"); pg.locator("#save").click(); pg.wait_for_timeout(600)
    if pg.locator("#cksave").count(): pg.locator("#cksave").click(); pg.wait_for_timeout(500)
    t=app(); ents=pg.evaluate("()=>JSON.parse(localStorage.getItem('entries'))")
    check("Sortie ciné" in t and "Cinéma" in t and "Tu dois" not in t and "Marie te doit 12,00 €" in t, "enregistré : retour au groupe, Cinéma 24 € dedans, Marie te doit 12 €")
    check(any(e["marchand"]=="Cinéma" for e in ents), "le ticket est aussi dans les dépenses")
    pg.locator("#gdAdd").click(); pg.wait_for_timeout(300)
    pg.locator(".sheet-overlay button", has_text="Un ticket déjà enregistré").click(); pg.wait_for_timeout(300)
    ch=norm(pg.locator(".sheet-overlay").last.inner_text())
    check("Boulangerie" in ch and "Restaurant du Lac" not in ch and "Cinéma" not in ch, "tickets proposés : seulement ceux qui ne sont dans aucun groupe")
    pg.locator(".sheet-overlay button", has_text="Boulangerie").click(); pg.wait_for_timeout(500)
    t=app(); check("Boulangerie" in t and "Marie te doit 18,00 €" in t, "Boulangerie ajoutée : Marie te doit 18 €")
    # Store sans Plus
    c2=b.new_context(viewport={'width':412,'height':900}, user_agent="Mozilla/5.0 TicketsApp/store"); p2=c2.new_page(); p2.on('pageerror', lambda e: errs.append(str(e)))
    p2.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    p2.goto(APP+"?edition=store"); p2.wait_for_timeout(300)
    p2.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); p2.reload(); p2.wait_for_timeout(900)
    p2.locator('#nav .navi[data-view="communes"]').click(); p2.wait_for_timeout(500)
    check(p2.locator("#grpBuy").count()==1 and p2.locator("#grpNew").count()==0, "Store sans Plus : « Groupes ✦ » demande Plus")
    p2.locator("#grpBuy").click(); p2.wait_for_timeout(400)
    check("Groupes" in norm(p2.locator("body").inner_text()) and "sortie entre amis" in norm(p2.locator("body").inner_text()), "Plus : la carte parle des groupes")
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
print("\n%d échec(s)"%len(fails)); sys.exit(1 if fails else 0)
