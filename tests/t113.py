# Stockage : quand la mémoire locale (localStorage) est pleine, la donnée part dans le stockage du téléphone (IndexedDB)
# et rien n'est perdu au redémarrage ; quand il y a de nouveau de la place, elle revient dans localStorage.
# La « mémoire pleine » est imitée : setItem refuse les tickets tant que sessionStorage.__q vaut 1. Données inventées.
import sys, os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
APP='file://'+ROOT+'/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
QUOTA="""(function(){ var o=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k, v){ if(this===window.localStorage && k==="entries" && sessionStorage.getItem("__q")==="1"){ var e=new Error("QuotaExceededError"); e.name="QuotaExceededError"; throw e; } return o.call(this, k, v); }; })();"""
data={"askName":False,"devise":"EUR","comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True}],
  "entries":[{"id":1,"date":"2026-10-03","marchand":"Boulangerie","montant":3.4,"categorie":"Courses","payePar":"Alex","articles":[]},
             {"id":2,"date":"2026-10-05","marchand":"Pharmacie","montant":18.9,"categorie":"Santé","payePar":"Alex","articles":[]}]}
with sync_playwright() as p:
    b=p.chromium.launch(); c=b.new_context(viewport={'width':412,'height':900}); c.add_init_script(QUOTA)
    pg=c.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    pg.goto(APP); pg.wait_for_timeout(300)
    pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); pg.reload(); pg.wait_for_timeout(900)
    def add(mag, amt):
        pg.locator('#nav .navi[data-view="list"]').click(); pg.wait_for_timeout(300)
        pg.locator("#manual2").first.click(); pg.wait_for_timeout(400)
        pg.locator("#f-montant").fill(amt); pg.locator("#f-marchand").fill(mag); pg.locator("#f-date").fill("2026-10-20")
        pg.locator("#save").click(); pg.wait_for_timeout(500)
    def tickets():
        pg.locator('#nav .navi[data-view="compte"]').click(); pg.wait_for_timeout(300); (pg.locator('.cpsub[data-cp="tk"]').click() if pg.locator('.cpsub[data-cp="tk"]').count() else None); pg.wait_for_timeout(400)
        return pg.locator("#app").inner_text()
    # mémoire pleine : le nouveau ticket part dans IndexedDB
    pg.evaluate("()=>sessionStorage.setItem('__q','1')")
    add("Quincaillerie", "12,40")
    st=pg.evaluate("()=>({ only:localStorage.getItem('__idbOnly'), ls:localStorage.getItem('entries') })")
    check(st["only"]=='["entries"]' and st["ls"] is None, "mémoire pleine : les tickets passent dans le stockage du téléphone (%s)" % st)
    t=tickets(); check("Quincaillerie" in t and "Boulangerie" in t and "Pharmacie" in t, "les 3 tickets sont là")
    check("Mémoire" not in t and "plein" not in t.lower(), "pas de bandeau « mémoire pleine »")
    # redémarrage : rien n'est perdu
    pg.reload(); pg.wait_for_timeout(1500)
    t=tickets(); check("Quincaillerie" in t and "Boulangerie" in t and "Pharmacie" in t, "après redémarrage : les 3 tickets sont toujours là (lus dans le stockage du téléphone)")
    add("Fleuriste", "25,00")
    pg.reload(); pg.wait_for_timeout(1500)
    t=tickets(); check("Fleuriste" in t and "Quincaillerie" in t, "un 4e ticket ajouté et retrouvé après redémarrage")
    # de nouveau de la place : retour dans localStorage
    pg.evaluate("()=>sessionStorage.setItem('__q','0')")
    add("Primeur", "6,10")
    st=pg.evaluate("()=>({ only:localStorage.getItem('__idbOnly'), n:(JSON.parse(localStorage.getItem('entries')||'[]')).length })")
    check(st["only"]=="[]" and st["n"]==5, "place libérée : les 5 tickets reviennent dans la mémoire locale (%s)" % st)
    pg.reload(); pg.wait_for_timeout(1200)
    t=tickets(); check(all(x in t for x in ["Primeur","Fleuriste","Quincaillerie","Boulangerie","Pharmacie"]), "après redémarrage : les 5 tickets")
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
print("\n%d échec(s)"%len(fails)); sys.exit(1 if fails else 0)
