# Appui long sur un ticket : menu Ouvrir / Supprimer, suppression avec « Annuler »
import sys, os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
SP=(sys.argv[1] if len(sys.argv)>1 else HERE); APP='file://'+ROOT+'/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def T(i,d,mc,m): return {"id":i,"date":d,"marchand":mc,"montant":m,"categorie":"Alimentation","payePar":"Benoit","articles":[]}
data={"askName":False,"devise":"EUR","personnes":[{"nom":"Sylvette"}],"comptes":[{"key":"Benoit","nom":"Compte courant","payer":"Benoit","main":True}],
  "entries":[T(1,"2026-10-20","Leclerc",62.40),T(2,"2026-10-22","Intermarché",12.30),T(3,"2026-10-25","Boulangerie",4.20)]}
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':412,'height':900}, has_touch=True, is_mobile=True); pg=ctx.new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    pg.goto(APP); pg.wait_for_timeout(300)
    pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); pg.reload(); pg.wait_for_timeout(900)
    def ls(k): return pg.evaluate("k=>JSON.parse(localStorage.getItem(k))", k)
    def longpress(sel):
        el=pg.locator(sel).first; bb=el.bounding_box(); x=bb["x"]+bb["width"]/2; y=bb["y"]+bb["height"]/2
        pg.evaluate("""([sel,x,y])=>{ const el=document.querySelector(sel); const t=new Touch({identifier:1,target:el,clientX:x,clientY:y});
          el.dispatchEvent(new TouchEvent('touchstart',{touches:[t],targetTouches:[t],changedTouches:[t],bubbles:true,cancelable:true})); }""", [sel, x, y])
        pg.wait_for_timeout(700)
        pg.evaluate("""([sel,x,y])=>{ const el=document.querySelector(sel); const t=new Touch({identifier:1,target:el,clientX:x,clientY:y});
          el.dispatchEvent(new TouchEvent('touchend',{touches:[],targetTouches:[],changedTouches:[t],bubbles:true,cancelable:true}));
          el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); }""", [sel, x, y])
        pg.wait_for_timeout(400)
    # page Tickets de l'Accueil
    pg.locator("#pvCap").first.click() if pg.locator("#pvCap").count() else None; pg.wait_for_timeout(500)
    n=pg.locator('#app .entry[data-id]').count(); print("  tickets listés :", n)
    longpress('#app .entry[data-id="2"]')
    sh=pg.locator(".sheet-overlay").last.inner_text() if pg.locator(".sheet-overlay").count() else ""
    print("  menu :", sh.replace("\n"," | "))
    check("intermarché" in sh.lower() and "Ouvrir le ticket" in sh and "Supprimer" in sh, "appui long : menu « Ouvrir le ticket » / « Supprimer »")
    check(pg.locator("#f-montant").count()==0, "l'appui long n'ouvre pas en plus le ticket")
    pg.locator(".sheet-overlay button", has_text="Supprimer").click(); pg.wait_for_timeout(400)
    check(len(ls("entries"))==2 and pg.locator(".ui-toast.undo").count()==1 and "Ticket mis à la corbeille" in pg.locator(".ui-toast.undo").inner_text(), "supprimé, message « Ticket mis à la corbeille · Annuler »")
    pg.locator(".ui-toast.undo button").click(); pg.wait_for_timeout(400)
    E=ls("entries"); check(len(E)==3 and [e["id"] for e in E]==[1,2,3], "« Annuler » : le ticket revient, à sa place")
    # supprimé pour de bon : le message disparaît après le délai
    longpress('#app .entry[data-id="3"]'); pg.locator(".sheet-overlay button", has_text="Supprimer").click(); pg.wait_for_timeout(6600)
    check(len(ls("entries"))==2 and pg.locator(".ui-toast.undo").count()==0, "sans annuler : supprimé, le message part")
    # simple toucher : ouvre toujours le ticket
    pg.locator('#app .entry[data-id="1"]').first.click(); pg.wait_for_timeout(500)
    check(pg.locator("#f-montant").count()==1, "un simple toucher ouvre toujours le ticket")
    pg.locator("#hback").click(); pg.wait_for_timeout(400)
    # liste du Compte
    pg.locator('#nav .navi[data-view="compte"]').click(); pg.wait_for_timeout(600)
    longpress('#opsBody .ops-open[data-k="t"][data-id="1"]')
    check("leclerc" in (pg.locator(".sheet-overlay").last.inner_text().lower() if pg.locator(".sheet-overlay").count() else ""), "Compte : appui long sur un ticket → même menu")
    pg.locator(".sheet-overlay button", has_text="Ouvrir").click(); pg.wait_for_timeout(500)
    check(pg.locator("#f-montant").count()==1, "« Ouvrir le ticket » ouvre la fiche")
    print("errors:", errs); check(not errs, "aucune erreur")
    b.close()
print(len(fails), "échec(s)")
