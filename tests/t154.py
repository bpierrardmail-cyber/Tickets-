# Sécurité du foyer (revue du 08/11) : un membre LIMITÉ (son compte seulement) tente des envois piégés. Relais local, données inventées.
#  C1 : chemin « budgetsP␟__proto__␟intro » (pollution de prototype) → refusé, rien ne s'exécute chez le propriétaire
#  C2 : ticket avec une photo piégée (« data:x" onerror=… ») → photo retirée, rien ne s'exécute en ouvrant le ticket
#  M4 : virement vers le compte du propriétaire ou vers un livret qu'il ne voit pas → refusé ; virement normal → accepté
#  F2 : une « différence du propriétaire » glissée dans la boîte (d:1) → refusée
#  F3 : date du futur → ramenée à l'heure d'arrivée au relais
#  M5 : nouveau QR code → nouvelle clé pour ce membre
#  + Object.prototype figé, CSP par empreinte à jour
import sys, os, json, subprocess, time
HERE=os.path.dirname(os.path.abspath(__file__))
SP=(sys.argv[1] if len(sys.argv)>1 else HERE)
src=open(os.path.join(HERE,'foyer_base.py'),encoding='utf-8').read()
exec(src.split("with sync_playwright() as p:")[0])
S="\u001f"
data={"askName":False,"devise":"EUR","personnes":[{"nom":"Léa"}],
  "comptes":[{"key":"Benoit","nom":"Compte courant","payer":"Benoit","main":True},{"key":"lea","nom":"Compte Léa","payer":"Léa"}],
  "epargne":[{"id":50,"nom":"Livret A","solde":1200}],
  "entries":[{"id":1,"date":"2026-10-05","marchand":"Leclerc","montant":42.5,"categorie":"Alimentation","payePar":"Benoit","articles":[]}],
  "virements":[{"id":2,"person":"Benoit","month":"2026-10","label":"Salaire","montant":2100,"done":True}]}
r=subprocess.run(["python3", os.path.join(HERE,"..","outils","csp.py"), "--check"], capture_output=True, text=True)
check(r.returncode==0, "CSP : empreinte du script à jour")
with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    O=new_page(b, errs, "O")
    O.add_init_script("window.__x=function(t){ (window.__xs=window.__xs||[]).push(String(t)); };")
    O.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k])); localStorage.setItem('foyerApi', JSON.stringify('%s'));}" % API, data)
    O.reload(); O.wait_for_timeout(1200)
    check(O.evaluate("()=>Object.isFrozen(Object.prototype)"), "Object.prototype figé")
    open_foyer(O); O.locator("#fyNew").click(); O.wait_for_timeout(300); O.locator(".ui-yes").click(); setup_lock(O); btn(O, "Je l'ai noté")
    while O.locator(".sheet-overlay .ui-no").count(): O.locator(".sheet-overlay .ui-no").last.click(); O.wait_for_timeout(300)
    open_foyer(O); O.locator("#fyAdd").click(); O.wait_for_timeout(300); O.locator('[data-n="Léa"]').click(); O.wait_for_timeout(150)
    O.locator('[data-q="w"]').click(); O.wait_for_timeout(150); O.locator('.sheet-overlay [data-a="lea"]').click(); O.wait_for_timeout(150)
    O.locator("#fyOk").click(); O.wait_for_timeout(1500); inv=read_qr(O, "t154_qr.png"); O.locator(".ui-no").last.click(); O.wait_for_timeout(300)
    mid, m=list(ls(O, "fyCfg")["members"].items())[0]
    check(m.get("accts")==["lea"], "Léa : seulement son compte")
    now=int(time.time()*1000)
    tk=lambda i, mt, **k: dict({"id":i,"date":"2026-10-20","marchand":mt,"montant":3.2,"categorie":"Alimentation","payePar":"Léa","compte":"lea","articles":[]}, **k)
    sends=[
      {"recs":[{"p":"budgetsP"+S+"__proto__"+S+"intro","x":"<img src=x onerror=__x('proto')>","t":now}]},
      {"recs":[{"p":"budgetsP"+S+"constructor"+S+"x","x":1,"t":now}]},
      {"recs":[{"p":"entries"+S+"777","x":tk(777,"Boulangerie piège",photo="data:x\" onerror=\"__x('photo')"),"t":now}]},
      {"recs":[{"p":"virements"+S+"888","x":{"id":888,"person":"lea","month":"2026-10","label":"Vers Benoit","montant":-500,"vers":"cpt:Benoit","done":True},"t":now}]},
      {"recs":[{"p":"virements"+S+"889","x":{"id":889,"person":"lea","month":"2026-10","label":"Livret caché","montant":-50,"epargneId":50},"t":now}]},
      {"d":1,"recs":[{"p":"entries"+S+"999","x":tk(999,"Faux propriétaire"),"t":now}]},
      {"recs":[{"p":"entries"+S+"778","x":tk(778,"Dans le futur"),"t":now+3*86400000}]},
      {"recs":[{"p":"virements"+S+"890","x":{"id":890,"person":"lea","month":"2026-10","label":"Courses","montant":-20},"t":now}]},
    ]
    out=subprocess.run(["node", os.path.join(HERE,"t154_membre.mjs"), inv, json.dumps(sends)], capture_output=True, text=True).stdout
    check(out.count("inbox 200")==len(sends), "envois du faux membre déposés ("+out.replace(chr(10)," ")+")")
    reload(O, 5000)
    check(O.evaluate("()=>typeof ({}).intro==='undefined' && typeof ({}).x==='undefined'"), "C1 : rien n'est ajouté à tous les objets")
    E={str(e["id"]):e for e in ls(O,"entries")}
    check("777" in E and E["777"].get("photo") in (False, None), "C2 : ticket gardé, photo piégée retirée")
    V={str(v["id"]) for v in ls(O,"virements")}
    check("888" not in V and "889" not in V, "M4 : virements vers un compte ou un livret caché refusés")
    check("890" in V, "M4 : virement normal de Léa accepté")
    check("999" not in E, "F2 : une « différence du propriétaire » glissée dans la boîte est refusée")
    mt=(ls(O,"fyMt") or {}).get("entries"+S+"778", 0)
    check("778" in E and 0 < mt <= int(time.time()*1000)+60000, "F3 : date du futur ramenée à l'arrivée au relais")
    # le propriétaire ouvre les écrans : rien ne s'exécute
    for _ in range(4):
        if not O.locator(".sheet-overlay").count(): break
        O.keyboard.press("Escape"); O.wait_for_timeout(250)
        try: O.locator(".sheet-overlay .ui-no, .sheet-overlay .ui-cancel").last.click(timeout=1500); O.wait_for_timeout(250)
        except Exception as e: print("fenêtre :", O.locator(".sheet-overlay").last.inner_text()[:120].replace(chr(10)," | "))
    try:
        O.locator("#navplus").click(timeout=3000); O.wait_for_timeout(400); O.get_by_text("Virement reçu").first.click(timeout=3000); O.wait_for_timeout(600)
    except Exception as e: print("virement reçu :", str(e)[:200])
    O.keyboard.press("Escape"); O.wait_for_timeout(300)
    for _ in range(4):
        if not O.locator(".sheet-overlay").count(): break
        O.keyboard.press("Escape"); O.wait_for_timeout(250)
        try: O.locator(".sheet-overlay .ui-no, .sheet-overlay .ui-cancel").last.click(timeout=1500); O.wait_for_timeout(250)
        except Exception as e: print("fenêtre :", O.locator(".sheet-overlay").last.inner_text()[:120].replace(chr(10)," | "))
    O.evaluate("()=>{ localStorage.setItem('personView', JSON.stringify('all')); }"); reload(O, 2500)
    O.locator('#nav .navi[data-view="compte"]').click(); O.wait_for_timeout(400)
    try:
        O.locator('.cpsub[data-cp="tk"]').first.click(timeout=3000); O.wait_for_timeout(500)
        if not O.get_by_text("Boulangerie piège").count():
            O.get_by_text("‹", exact=True).first.click(timeout=3000); O.wait_for_timeout(500)
        O.get_by_text("Boulangerie piège").first.click(timeout=3000); O.wait_for_timeout(800)
        check(O.locator("#f-payer").count()>0, "fiche du ticket piégé ouverte")
    except Exception as e: check(False, "ouverture du ticket piégé : "+str(e)[:100])
    check(O.evaluate("()=>window.__xs||[]")==[], "aucun code piégé exécuté "+str(O.evaluate("()=>window.__xs||[]")))
    # M5 : nouveau QR code → nouvelle clé
    km0=m.get("km")
    open_foyer(O); O.locator('[data-m="%s"]' % mid).first.click(); O.wait_for_timeout(300)
    O.get_by_text("nouveau QR code").first.click(); O.wait_for_timeout(400)
    if O.locator(".sheet-overlay .ui-yes").count(): O.locator(".sheet-overlay .ui-yes").last.click()
    O.wait_for_timeout(1500)
    km1=ls(O,"fyCfg")["members"][mid].get("km")
    check(km1 and km1!=km0, "M5 : nouvelle clé à chaque invitation")
    errs=[e for e in errs if "illisible" not in e and "Fetch API cannot load file" not in e]
    check(not errs, "pas d'erreur "+str(errs[:3]))
    b.close()
print("\n%d échec(s)" % len(fails)); sys.exit(1 if fails else 0)
