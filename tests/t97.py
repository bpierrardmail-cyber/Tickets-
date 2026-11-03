# Accueil : la page des petits graphiques (« 3 / 8 ») est gardée — changement d'onglet, relance, et surtout
# quand la mise en page fait défiler sans geste (appli dessinée avant d'avoir sa taille, largeur qui change).
# Données inventées.
import sys, os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
SP=(sys.argv[1] if len(sys.argv)>1 else HERE); APP='file://'+ROOT+'/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
data={"askName":False,"devise":"EUR","comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True}],
  "fraisCommuns":[{"id":1,"label":"Loyer","montant":650,"personne":"Commun","recurrent":True,"startMonth":"2026-01","jour":5}],
  "bourse":[{"id":501,"nom":"PEA","vals":{"2026-10":{"valeur":1000,"capital":900}}}],
  "epargne":[{"id":301,"nom":"Livret A","owner":"Alex","vals":{"2026-06":800,"2026-08":900,"2026-10":1000}}],
  "provisions":[{"id":11,"nom":"Taxe","mensuel":50,"soldeInitial":100,"startMonth":"2026-10","prelevements":[]}],
  "homeCharts":["bourse","epargne","provisions","compte:ep","compte:prov","compte:mois","compte:dep","compte:solde","compte:es","analyse:mois","analyse:rep","analyse:rec","analyse:pay","communes:rep","communes:postes","communes:6m"],
  "entries":[{"id":1,"date":"2026-10-03","marchand":"Supermarché","montant":3.3,"categorie":"Courses","payePar":"Alex","articles":[]}]}
# [compteur affiché, page vraiment visible, nombre de pages]
def state(pg): return pg.evaluate("()=>{ var p=document.querySelector('.pgr[data-pgr=home]'); if(!p) return null; var b=p.querySelector('.pg-count b'), tr=p.querySelector('.pg-track'); return [b?+b.textContent:null, Math.round(tr.scrollLeft/(tr.clientWidth||1))+1, p.querySelectorAll('.pg-page').length]; }")
def saved(pg): return pg.evaluate("()=>(JSON.parse(localStorage.getItem('pgPos')||'{}')).home")
with sync_playwright() as p:
    b=p.chromium.launch(); c=b.new_context(viewport={'width':412,'height':900}, is_mobile=True, has_touch=True)
    pg=c.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    pg.goto(APP); pg.wait_for_timeout(300)
    pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); pg.reload(); pg.wait_for_timeout(1200)
    s0=state(pg); check(s0 and s0[2]>=7 and s0[:2]==[1,1], "Accueil : petits graphiques en pages, la 1re d'abord %s"%s0)
    pg.locator('.pgr[data-pgr=home] .pg-next').click(); pg.wait_for_timeout(500)
    pg.locator('.pgr[data-pgr=home] .pg-next').click(); pg.wait_for_timeout(800)
    check(state(pg)[:2]==[3,3] and saved(pg)==2, "flèche › deux fois : page 3, gardée %s"%state(pg))
    # défilement sans geste (la mise en page bouge) : on reste sur la page 3, rien n'est effacé
    pg.evaluate("()=>{ document.querySelector('.pgr[data-pgr=home] .pg-track').scrollLeft=0; }"); pg.wait_for_timeout(500)
    check(state(pg)[:2]==[3,3] and saved(pg)==2, "défilement sans geste : toujours la page 3 %s"%state(pg))
    # Accueil dessiné alors que l'appli n'a pas encore de taille (écran caché), puis affiché
    pg.locator('#nav .navi[data-view="communes"]').click(); pg.wait_for_timeout(500)
    pg.evaluate("()=>{ document.getElementById('app').style.display='none'; }")
    pg.locator('#nav .navi[data-view="list"]').click(); pg.wait_for_timeout(300)
    pg.evaluate("()=>{ document.getElementById('app').style.display=''; }"); pg.wait_for_timeout(700)
    check(state(pg)[:2]==[3,3] and saved(pg)==2, "Accueil dessiné sans taille puis affiché : page 3 visible %s"%state(pg))
    # largeur qui change
    pg.set_viewport_size({'width':360,'height':800}); pg.wait_for_timeout(600)
    check(state(pg)[:2]==[3,3], "largeur qui change : toujours la page 3 %s"%state(pg))
    pg.set_viewport_size({'width':412,'height':900}); pg.wait_for_timeout(600)
    # un vrai geste (doigt posé puis glissé) jusqu'à la page 5 : elle est gardée
    pg.evaluate("()=>{ var tr=document.querySelector('.pgr[data-pgr=home] .pg-track'); tr.dispatchEvent(new Event('touchstart')); tr.scrollLeft=4*tr.clientWidth; setTimeout(function(){ tr.dispatchEvent(new Event('touchend')); }, 150); }"); pg.wait_for_timeout(800)
    check(state(pg)[:2]==[5,5] and saved(pg)==4, "glisser jusqu'à la page 5 : gardée %s"%state(pg))
    # changement d'onglet puis retour, et relance de l'appli
    pg.locator('#nav .navi[data-view="compte"]').click(); pg.wait_for_timeout(500)
    pg.locator('#nav .navi[data-view="list"]').click(); pg.wait_for_timeout(800)
    check(state(pg)[:2]==[5,5], "retour sur l'Accueil : page 5 %s"%state(pg))
    pg.reload(); pg.wait_for_timeout(1500)
    check(state(pg)[:2]==[5,5], "appli relancée : page 5 %s"%state(pg))
    # anciennes cartes « Compte · Épargne » et « Compte · Provisions » (retirées le 03/11) : remplacées par Épargne et Provisions, sans doublon
    ids=pg.evaluate("()=>[...document.querySelectorAll('.hmini[data-id]')].map(x=>x.getAttribute('data-id'))")
    check("compte:ep" not in ids and ids.count("epargne")==1 and ids.count("provisions")==1, "Accueil : plus de « Compte · Épargne / Provisions », une seule carte Épargne et Provisions %s"%ids)
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
print("\n%d échec(s)"%len(fails))
