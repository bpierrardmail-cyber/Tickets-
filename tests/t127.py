# Tickets Plus du propriétaire pour tout le foyer (version Store). Données inventées, relais imité par une route.
# 1. Le propriétaire (Plus) publie la copie de chaque membre avec « plus: true » (déchiffrée ici avec la clé du membre).
# 2. Un membre couvert (plus: true), Commun en modification : « Qui doit combien à qui » et les groupes sans offre Plus,
#    « ＋ Nouveau groupe », pas de ligne « Tickets Plus » ; les widgets restent par téléphone (pas couverts).
# 3. Même membre, Commun en lecture : groupes visibles, pas de « ＋ Nouveau groupe ».
# 4. Propriétaire sans Plus (plus: false) : le membre voit l'offre Plus.
import sys, os, json
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
APP='file://'+ROOT+'/beta/index.html?edition=store'; API='http://localhost:9'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def norm(t): return t.replace(" "," ").replace("\xa0"," ")
KM="A"*43   # clé de copie du membre (32 octets nuls, base64url) : connue du test pour relire la copie
data={"askName":False,"devise":"EUR","personnes":[{"nom":"Marie"}],
  "comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True},{"key":"marie","nom":"Compte Marie","payer":"Marie"}],
  "entries":[{"id":1,"date":"2026-10-12","marchand":"Marché","montant":85,"categorie":"Alimentation","payePar":"Alex","articles":[]}],
  "fraisCommuns":[{"id":5,"label":"Loyer","montant":600,"personne":"Commun","recurrent":True,"startMonth":"2026-01","compte":"Alex"}],
  "groupes":[{"id":7,"nom":"Week-end à la mer","membres":["Alex","Marie"],"dep":[{"id":8,"date":"2026-10-20","label":"Location","montant":120,"payePar":"Alex"}],"rembs":[]}]}
OPEN="""async ([km, str])=>{
  const b64=s=>{ s=s.replace(/-/g,'+').replace(/_/g,'/'); while(s.length%4) s+='='; const b=atob(s), a=new Uint8Array(b.length); for(let i=0;i<b.length;i++) a[i]=b.charCodeAt(i); return a; };
  const key=await crypto.subtle.importKey('raw', b64(km), 'AES-GCM', false, ['decrypt']);
  const p=str.split('.'), all=b64(p[1]);
  let d=new Uint8Array(await crypto.subtle.decrypt({ name:'AES-GCM', iv:all.slice(0,12) }, key, all.slice(12)));
  if(p[0]==='g1') d=new Uint8Array(await new Response(new Blob([d]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  return JSON.parse(new TextDecoder().decode(d));
}"""
with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    def page(ls, puts=None):
        c=b.new_context(viewport={'width':412,'height':900}); pg=c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        def route(r):
            u=r.request.url
            if u.startswith("file:"): return r.continue_()
            if u.startswith(API+"/"):
                if puts is not None and r.request.method=="PUT" and "/snap/" in u: puts.append(json.loads(r.request.post_data)["v"])
                return r.fulfill(status=200, body=json.dumps({"t":1, "items":[], "members":[{"id":"m1"}]}), headers={"Content-Type":"application/json","Access-Control-Allow-Origin":"*"})
            return r.abort()
        pg.route("**/*", route)
        pg.goto(APP); pg.wait_for_timeout(300)
        h=pg.evaluate("()=>crypto.subtle.digest('SHA-256', new TextEncoder().encode('c2FsdA==:123456')).then(b=>btoa(String.fromCharCode(...new Uint8Array(b))))")
        ls=dict(ls); ls["lockCfg"]={"hash":h,"salt":"c2FsdA==","len":6,"bioId":None}; ls["foyerApi"]=API
        pg.evaluate("d=>{ localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k])); }", ls)
        pg.reload(); pg.wait_for_timeout(1200)
        for k in "123456": pg.locator('#lockscreen button[data-k="%s"]' % k).click(); pg.wait_for_timeout(60)
        pg.wait_for_timeout(1200)
        return pg
    def commun(pg):
        pg.locator('nav [data-view="communes"]').first.click(); pg.wait_for_timeout(900)
        return norm(pg.locator("#app").inner_text())
    def menu(pg):
        pg.locator("#hmenu").click(); pg.wait_for_timeout(400); t=""
        for ms in ("gerer","sauv","regl","aide"): pg.locator('.mnsub[data-ms="%s"]' % ms).click(); pg.wait_for_timeout(200); t+=norm(pg.locator(".mn-pg").inner_text())+"\n"
        pg.locator("#hback").click(); pg.wait_for_timeout(300); return t
    # ---------- 1. propriétaire avec Plus : la copie du membre dit « plus »
    puts=[]
    own=dict(data); own["plusUnlocked"]=True
    own["fyCfg"]={"role":"owner","fid":"F_T","tok":"T","key":KM,"sec":KM,"members":{"m1":{"name":"Marie","role":"edit","tabs":["list","communes"],"ed":["list","communes"],"accts":None,"tk":"own","km":KM}}}
    po=page(own, puts)
    for _ in range(20):
        if puts: break
        po.wait_for_timeout(500)
    check(len(puts)>=1, "propriétaire : copie de Marie envoyée au relais")
    snap=po.evaluate(OPEN, [KM, puts[-1]]) if puts else {}
    check(snap.get("plus") is True and snap.get("me")=="Marie" and "groupes" in snap.get("keys",{}), "copie de Marie : « plus: true », ses données et les groupes")
    # ---------- 2. membre couvert, Commun en modification
    def member(plus, ed):
        m=dict(data); m["fyCfg"]={"role":"edit","fid":"F_T","mid":"m1","tok":"T","km":KM,"me":"Marie","owner":"Alex","tabs":["list","communes"],"ed":ed,"accts":None,"tk":"own","plus":plus,"snapT":1}
        return m
    pm=page(member(True, ["list","communes"]))
    t=commun(pm)
    check("Week-end à la mer" in t and pm.locator("#grpNew").count()==1 and pm.locator("#cbalBuy").count()==0 and pm.locator(".fct-teaser").count()==0,
          "membre couvert : groupes, « ＋ Nouveau groupe », qui doit combien à qui, sans offre Plus")
    check("Tickets Plus" not in menu(pm), "membre couvert : pas de ligne « Tickets Plus » dans le menu")
    check(pm.evaluate("()=>JSON.parse(localStorage.getItem('fyCfg')).plus")==True, "fyCfg du membre : plus")
    # ---------- 3. Commun en lecture
    pr=page(member(True, ["list"]))
    t=commun(pr)
    check("Week-end à la mer" in t and pr.locator("#grpNew").count()==0 and pr.locator("#cbalBuy").count()==0, "membre en lecture : groupes visibles, pas de « ＋ Nouveau groupe »")
    # ---------- 4. propriétaire sans Plus
    pn=page(member(False, ["list","communes"]))
    t=commun(pn)
    check(pn.locator("#cbalBuy").count()+pn.locator(".fct-teaser").count()>=1, "propriétaire sans Plus : le membre voit l'offre Plus")
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
print("\n%d échec(s)"%len(fails)); sys.exit(1 if fails else 0)
