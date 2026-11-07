# Cohérence des chiffres (07/11, après le bug de la grande carte vu par Benoît) : un même montant affiché à plusieurs endroits doit être le même.
# Grand foyer inventé (t137) + mouvements internes : provisions sur un autre compte (mises de côté faites ou non), virements reliés entre comptes,
# vers un livret, vers la Bourse. Pour chaque compte et 3 mois (septembre, octobre, novembre) :
#   grande carte « Solde estimé à la banque » = report du 1er + opérations faites = « solde » du dernier jour de la liste
#                                              = montant du compte dans la liste des comptes ;
#   « Fin de mois » = banque + à venir + pas cochés des mois passés (+ liquide compté) ;
#   « Tous les comptes » = somme des comptes ; Accueil « Banque » = compte principal.
import sys, os, re, json
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
src=open(os.path.join(HERE,'t137.py'),encoding='utf-8').read()
argv=sys.argv; sys.argv=[argv[0]]; exec(src.split("BAD=")[0]); sys.argv=argv
fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def near(a, b, shown=None):   # un montant de 1 000 € et plus est affiché arrondi à l'euro (fmtS)
    tol=0.51 if (shown is not None and "," not in shown.replace("\u202f","")) else 0.011
    return a is not None and b is not None and abs(a-b)<tol
def money(t):
    t=(t or "").replace(" ","").replace("\xa0","").replace(" ","").replace("−","-").replace("€","")
    m=re.search(r"[-+]?\d+(?:,\d+)?", t); return float(m.group(0).replace(",",".")) if m else None
# mouvements internes ajoutés au grand foyer
data["provisions"]=[{"id":11,"nom":"Taxe foncière","mensuel":80,"soldeInitial":400,"startMonth":"2026-05","prelevements":[],"echeance":10,"prevu":960,"ou":"cpt:joint"},
                    {"id":12,"nom":"Vacances","mensuel":50,"soldeInitial":0,"startMonth":"2026-08","prelevements":[],"ou":"ep:301"},
                    {"id":13,"nom":"Voiture","mensuel":40,"soldeInitial":0,"startMonth":"2026-08","prelevements":[],"ou":"cpt:c0"}]
data["fraisCommuns"]=data["fraisCommuns"]+[
  {"id":901,"label":"Provision · Taxe foncière","montant":80,"personne":"Commun","recurrent":True,"startMonth":"2026-08","jour":3,"prov":11,"provFrom":"2026-08","doneMonths":{"2026-08":True,"2026-09":True}},
  {"id":902,"label":"Provision · Vacances","montant":50,"personne":"Alex","recurrent":True,"startMonth":"2026-08","jour":4,"prov":12,"provFrom":"2026-08","doneMonths":{"2026-08":True}},
  {"id":903,"label":"Provision · Voiture","montant":40,"personne":"Commun","recurrent":True,"startMonth":"2026-08","jour":6,"split":True,"prov":13,"provFrom":"2026-08","doneMonths":{"2026-08":True,"2026-09":True,"2026-10":True}}]
data["virements"]=data["virements"]+[
  {"id":951,"person":"Alex","month":"2026-09","label":"Vers le joint","montant":-300,"done":True,"day":10,"vers":"cpt:joint"},
  {"id":952,"person":"Alex","month":"2026-10","label":"Vers le joint","montant":-300,"done":False,"day":10,"vers":"cpt:joint"},
  {"id":953,"person":"c0","month":"2026-10","label":"Remboursement Alex","montant":-45.5,"done":True,"day":12,"vers":"cpt:Alex"},
  {"id":954,"person":"Alex","month":"2026-10","label":"Livret","montant":-100,"done":True,"day":15,"epargneId":301,"epApplied":-0}]
data["bourse"]=[{"id":501,"nom":"PEA Fictif","vals":{"2026-10":{"capital":1000,"valeur":1100,"cash":50}}}]
data["virements"].append({"id":955,"person":"Alex","month":"2026-10","label":"Versement PEA","montant":-200,"done":True,"day":16,"bourseId":"501","bApplied":200})
data["liquideMois"]={"Alex":{"2026-10":45}}
nmonths=0
with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    c=b.new_context(viewport={'width':412,'height':900}); pg=c.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.dismiss())
    pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    pg.goto(APP); pg.wait_for_timeout(300)
    pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); pg.reload(); pg.wait_for_timeout(1500)
    accts=[a["key"] for a in data["comptes"]]
    def goto(acct, month):
        pg.evaluate("([k,m])=>{ localStorage.setItem('compteSel', JSON.stringify(k)); }", [acct, month]); pg.reload(); pg.wait_for_timeout(700)
        pg.locator('#nav .navi[data-view="compte"]').click(); pg.wait_for_timeout(500)
        for _ in range({"2026-09":1,"2026-10":0,"2026-11":-1}[month] if month!="2026-11" else 0): pg.locator("#cm-prev").click(); pg.wait_for_timeout(350)
        if month=="2026-11": pg.locator("#cm-next").click(); pg.wait_for_timeout(350)
    def read():
        return pg.evaluate("""()=>{
          const T=s=>{const x=document.querySelector(s); return x?x.textContent:null;};
          const stat=l=>{ const b=[...document.querySelectorAll('.ops-sum .hstat')].find(x=>x.textContent.includes(l)); return b? b.querySelector('b').textContent:null; };
          return { hero:T('.ops-sum .dash-big'), fin:stat('Fin de mois'), report:T('#opsReport .ops-a'), past:T('#opsPast .ops-a'),
            done:[...document.querySelectorAll('.ops-list .ops-r.ops-open .ops-a')].map(x=>x.textContent),
            todo:[...document.querySelectorAll('.ops-av .ops-r .ops-a')].map(x=>x.textContent),
            last:(document.querySelector('.ops-list .ops-dh span:nth-child(2)')||{}).textContent||null,
            liq:T('#opsLiq'), futur:(T('.ops-sum .dash-cap')||'').includes('prévu') };
        }""")
    tot={}
    for m in ["2026-09","2026-10","2026-11"]:
        for a in accts:
            goto(a, m); r=read(); nmonths+=1
            H=money(r["hero"]); tag="%s %s"%(a, m)
            if H is None: check(False, "%s : pas de grande carte"%tag); continue
            tot[(a,m)]=H
            done=sum(money(x) for x in r["done"]); todo=sum(money(x) for x in r["todo"]); past=money(r["past"]) or 0
            if not r["futur"]:
                if r["report"] is not None:
                    check(abs(money(r["report"])+done-H)<0.011, "%s : grande carte %.2f = report %.2f + opérations faites %.2f"%(tag, H, money(r["report"]), done))
                if r["last"]: check(abs(money(r["last"])-H)<0.011, "%s : grande carte %.2f = solde du dernier jour %.2f"%(tag, H, money(r["last"])))
                F=money(r["fin"]); liq=money(r["liq"]) if (r["liq"] and "non compté" not in r["liq"]) else 0
                check(near(F, H+todo+past+liq, r["fin"]), "%s : fin de mois %.2f = banque %.2f + à venir %.2f + pas cochés %.2f + liquide %.2f"%(tag, F or 0, H, todo, past, liq))
            # la liste des comptes dit la même chose
            pg.locator("#acctSel").click(); pg.wait_for_timeout(300)
            rows=pg.evaluate("()=>Object.fromEntries([...document.querySelectorAll('.sheet-overlay .acrw')].map(x=>[x.getAttribute('data-acct'), (x.querySelector('b')||{}).textContent]))")
            check(near(money(rows.get(a)), H, rows.get(a)), "%s : liste des comptes %.2f = grande carte %.2f"%(tag, money(rows.get(a)), H))
            if a==accts[-1]:
                allv=money(rows.get("__all")); s=sum(money(rows[k]) for k in rows if k!="__all")
                check(abs(allv-s)<0.51*len(rows), "%s : « Tous les comptes » %.2f = somme des comptes %.2f"%(m, allv, s))
            pg.keyboard.press("Escape"); pg.evaluate("()=>document.querySelectorAll('.sheet-overlay').forEach(x=>x.remove())")
    # Accueil : « Banque » du compte principal = sa grande carte (octobre)
    pg.evaluate("()=>localStorage.setItem('homeMode', JSON.stringify('dash'))"); pg.reload(); pg.wait_for_timeout(900)
    pg.locator('#nav .navi[data-view="list"]').click(); pg.wait_for_timeout(600)
    bk=pg.evaluate("()=>{ const s=[...document.querySelectorAll('#heroCpt span')].find(x=>x.textContent.startsWith('Banque')); return s? s.querySelector('b').textContent:null; }")
    print("  octobre :", {k[0]:v for k,v in tot.items() if k[1]=="2026-10"})
    if bk is not None: check(abs(money(bk)-tot[("Alex","2026-10")])<0.011, "Accueil : Banque %.2f = grande carte du compte principal %.2f"%(money(bk), tot[("Alex","2026-10")]))
    else: print("  (pas de carte Banque sur l'Accueil avec ces graphiques)")
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
print("%d comptes × mois vérifiés"%nmonths)
print("\n%d échec(s)"%len(fails)); sys.exit(1 if fails else 0)
