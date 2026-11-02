# Accueil (diapos) :
# 1. premier démarrage : 4 cartes illustrées par des captures (Bienvenue, Scanne, Importe ton relevé OFX/QIF/CSV, Vois ce qui arrive), puis le choix « Je commence / Rejoindre un foyer » ;
# 2. téléphone déjà utilisé : l'accueil s'ouvre une fois (Passer), plus après un redémarrage ;
# 3. Menu › Aide : le guide (parties à déplier, recherche) et « Revoir l'accueil » ;
# 4. membre d'un foyer : 2 diapos à lui (« Tu as rejoint le foyer de Alex », « Ajouter tes tickets »), après le code.
# Données inventées.
import sys, os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
APP='file://'+ROOT+'/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def norm(t): return t.replace(" "," ").replace("\xa0"," ")
data={"askName":False,"devise":"EUR","comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True}],"entries":[]}
with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    def page():
        c=b.new_context(viewport={'width':412,'height':900}); c.add_init_script('window.__wlcTest=1'); pg=c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
        pg.goto(APP); pg.wait_for_timeout(800); pg.evaluate("()=>localStorage.clear()")
        return c, pg
    W=lambda pg: norm(pg.locator(".wlc").inner_text()) if pg.locator(".wlc").count() else ""
    # ---------- 1. premier démarrage
    c, pg = page(); pg.reload(); pg.wait_for_timeout(1200)
    t=W(pg); check("Bienvenue dans Tickets" in t and "Gère tes achats, comptes, frais fixes et le commun" in t and "pas même nous" in t and "*Internet sert seulement au foyer partagé" in t and pg.locator(".wlc-dots i").count()==4 and pg.locator(".wlc-shot img").count()==1, "1er démarrage : « Bienvenue dans Tickets », 4 cartes, avec sa capture")
    check(pg.evaluate("()=>{ const i=document.querySelector('.wlc-shot img'); return i && i.complete && i.naturalWidth===544; }"), "la capture vitrine/accueil.jpg est chargée")
    check(pg.locator("#wlcPlus").count()==0, "version Perso : pas de lien Tickets Plus")
    pg.locator("#wlcNext").click(); pg.wait_for_timeout(200); t=W(pg)
    check("Scanne tes tickets" in t and "Photo" in t and "à plat" in t, "2e carte : « Scanne tes tickets »")
    pg.locator("#wlcNext").click(); pg.wait_for_timeout(200); t=W(pg)
    check("Importe ton relevé" in t and "OFX" in t and "QIF" in t and "CSV" in t, "3e carte : « Importe ton relevé » · OFX, QIF, CSV")
    pg.locator("#wlcNext").click(); pg.wait_for_timeout(200); t=W(pg)
    check("Vois ce qui arrive" in t and "ZIP" in t and "Menu › Aide" in t and pg.locator("#wlcNext").inner_text()=="Commencer", "4e carte : « Vois ce qui arrive », ZIP / JSON, bouton « Commencer »")
    pg.locator("#wlcPrev").click(); pg.wait_for_timeout(200); check("Importe ton relevé" in W(pg), "« ‹ Retour » : carte précédente")
    pg.locator("#wlcNext").click(); pg.wait_for_timeout(200); pg.locator("#wlcNext").click(); pg.wait_for_timeout(500)
    s=norm(pg.locator(".sheet-overlay").last.inner_text()) if pg.locator(".sheet-overlay").count() else ""
    check(pg.locator(".wlc").count()==0 and "Je commence" in s and "Rejoindre un foyer" in s, "« Commencer » : le choix « Je commence / Rejoindre un foyer »")
    check(pg.evaluate("()=>localStorage.getItem('welcomeSeen')")=="1", "accueil noté comme vu")
    c.close()
    # ---------- 2. téléphone déjà utilisé
    c, pg = page(); pg.evaluate("d=>{ for(const k in d) localStorage.setItem(k, JSON.stringify(d[k])); }", data); pg.reload(); pg.wait_for_timeout(1200)
    check("Bienvenue dans Tickets" in W(pg), "téléphone déjà utilisé : l'accueil s'ouvre une fois")
    pg.locator("#wlcSkip").click(); pg.wait_for_timeout(300)
    check(pg.locator(".wlc").count()==0 and pg.locator(".sheet-overlay").count()==0, "« Passer » : l'accueil se ferme (pas de choix de démarrage)")
    pg.reload(); pg.wait_for_timeout(1500); check(pg.locator(".wlc").count()==0, "redémarrage : plus d'accueil")
    # ---------- 3. Menu › Aide
    pg.locator("#hmenu").click(); pg.wait_for_timeout(400); pg.locator('.dr-row[data-k="aide"]').click(); pg.wait_for_timeout(300)
    hs=[norm(x) for x in pg.locator(".aide-h").all_inner_texts()]
    check(len(hs)==9 and hs[0].startswith("Pour commencer") and hs[-1].startswith("Questions fréquentes"), "Menu › Aide : le guide du propriétaire, 9 parties %s" % [h[:14] for h in hs])
    pg.locator(".aide-h").nth(1).click(); pg.wait_for_timeout(200)
    check("Ticket à plat" in norm(pg.locator(".aide-sec.open").inner_text()), "toucher une partie l'ouvre (Scanner un ticket)")
    pg.locator("#aideQ").fill("relevé"); pg.wait_for_timeout(300)
    hs=[norm(x) for x in pg.locator(".aide-h").all_inner_texts()]
    check(0<len(hs)<9 and any(h.startswith("Compte") for h in hs) and pg.locator(".aide-sec.open").count()==len(hs), "recherche « relevé » : les parties qui en parlent, ouvertes %s" % [h[:10] for h in hs])
    pg.locator("#aideQ").fill(""); pg.wait_for_timeout(200)
    pg.locator("#aideWlc").click(); pg.wait_for_timeout(300)
    check("Bienvenue dans Tickets" in W(pg), "« Revoir l'accueil » : les diapos")
    c.close()
    # ---------- 4. membre d'un foyer
    c, pg = page()
    h=pg.evaluate("()=>crypto.subtle.digest('SHA-256', new TextEncoder().encode('c2FsdA==:123456')).then(b=>btoa(String.fromCharCode(...new Uint8Array(b))))")
    mem={"role":"view","fid":"F_TEST","tok":"T_TEST","km":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=","me":"Lou","owner":"Alex","tabs":["list","communes"],"ed":[],"accts":None}
    d=dict(data); d["fyCfg"]=mem; d["lockCfg"]={"hash":h,"salt":"c2FsdA==","len":6,"bioId":None}; d["foyerApi"]="http://localhost:9"
    pg.evaluate("d=>{ for(const k in d) localStorage.setItem(k, JSON.stringify(d[k])); }", d); pg.reload(); pg.wait_for_timeout(1200)
    check(pg.locator("#lockscreen").count()==1 and pg.locator(".wlc").count()==0, "membre : le code d'abord, l'accueil attend")
    for k in "123456": pg.locator('#lockscreen button[data-k="%s"]' % k).click(); pg.wait_for_timeout(60)
    pg.wait_for_timeout(1500); t=W(pg)
    check("Tu as rejoint le foyer de Alex" in t and "Tes modifications partent chez Alex" in t and pg.locator(".wlc-dots i").count()==2, "membre : « Tu as rejoint le foyer de Alex », 2 diapos")
    pg.locator("#wlcNext").click(); pg.wait_for_timeout(200); t=W(pg)
    check("Ajouter tes tickets" in t and "guide du membre" in t.lower(), "2e diapo du membre : « Ajouter tes tickets », le guide du membre")
    pg.locator("#wlcNext").click(); pg.wait_for_timeout(300)
    check(pg.locator(".wlc").count()==0 and pg.evaluate("()=>localStorage.getItem('welcomeFy')")=="1", "« Commencer » : fermé, noté pour le membre")
    pg.locator("#hmenu").click(); pg.wait_for_timeout(400); pg.locator('.dr-row[data-k="aide"]').click(); pg.wait_for_timeout(300)
    hs=[norm(x) for x in pg.locator(".aide-h").all_inner_texts()]
    check(len(hs)==6 and hs[0].startswith("Ce que tu vois") and "Guide du membre" in norm(pg.locator("#app").inner_text()), "membre : Menu › Aide montre le guide du membre (6 parties)")
    c.close()
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
print("\n%d échec(s)"%len(fails)); sys.exit(1 if fails else 0)
