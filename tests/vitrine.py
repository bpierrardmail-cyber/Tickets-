# Captures de l'appli pour l'accueil et le carrousel Tickets Plus (beta/vitrine/*.jpg), avec des données inventées.
# À relancer quand l'interface change : python3 tests/vitrine.py (ce n'est pas un test : run.sh ne lance que t*.py).
# Chaque image : la page à 412 px de large, à partir d'une hauteur donnée, recadrée au format des cartes (272 × 250).
import sys, os, json
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE); sys.path.insert(0, HERE)
from playwright.sync_api import sync_playwright
from PIL import Image
import horloge
OUT=os.path.join(ROOT, "beta", "vitrine"); os.makedirs(OUT, exist_ok=True)
TMP=__import__("tempfile").mkdtemp()
APP='file://'+ROOT+'/beta/index.html?edition=store'
def crop(png, name, y):
    im=Image.open(png); s=im.size[0]/412.0; h=int(250/272*412)
    im=im.crop((0, int(y*s), im.size[0], int((y+h)*s))).convert("RGB").resize((544, 500), Image.LANCZOS)
    im.save(os.path.join(OUT, name+".jpg"), quality=72, optimize=True, progressive=True)
def ent(i, d, mag, amt, cat, who, arts=None, sh=None):
    e={"id":i,"date":d,"marchand":mag,"montant":amt,"categorie":cat,"payePar":who,"articles":arts or []}
    if sh: e["share"]=sh
    return e
E=[]; n=100
import random; R=random.Random(4)
for m in ["2026-05","2026-06","2026-07","2026-08","2026-09","2026-10"]:
    for d,mag,cat in [("04","Intermarché","Alimentation"),("09","Boulangerie","Alimentation"),("13","Pharmacie","Santé"),("18","Carrefour","Alimentation"),("22","Station Total","Carburant"),("26","Cinéma","Loisirs")]:
        n+=1; k=["2026-05","2026-06","2026-07","2026-08","2026-09","2026-10"].index(m)
        if mag=="Intermarché":
            A=[{"label":"Lait demi-écrémé","prix":round(0.99+0.02*k,2),"produit":"Lait"},{"label":"Café moulu 250 g","prix":round(3.89+0.07*k,2),"produit":"Café"},{"label":"Pâtes 500 g","prix":round(1.15+0.03*k,2),"produit":"Pâtes"},{"label":"Beurre doux","prix":round(2.45+0.05*k,2),"produit":"Beurre"}]
            E.append(ent(n, m+"-"+d, mag, round(sum(a["prix"] for a in A),2), cat, "Alex", A))
        else: E.append(ent(n, m+"-"+d, mag, round(R.uniform(12,95),2), cat, R.choice(["Alex","Alex","Marie"])))
E.append(ent(900,"2026-10-17","Pizzeria du Port",53.0,"Restaurant","Alex",[{"label":"Pizza 4 fromages","prix":14.5,"produit":"Plats","commun":True},{"label":"Pizza reine","prix":13,"produit":"Plats","commun":True},{"label":"Boissons","prix":18.5,"produit":"Boissons","commun":True},{"label":"Dessert","prix":7,"produit":"Desserts"}],{"Alex":33.33,"Marie":33.33,"Léa":33.33}))
E.append(ent(901,"2026-10-24","Intermarché",31.26,"Alimentation","Alex",[{"label":"Lait demi-écrémé","prix":1.05,"produit":"Lait"},{"label":"Pain de campagne","prix":2.2,"produit":"Pain"},{"label":"Café moulu 250 g","prix":4.15,"produit":"Café"},{"label":"Poulet rôti","prix":14.6,"produit":"Viande","commun":True},{"label":"Lessive liquide","prix":9.26,"produit":"Lessive"}]))
F=[{"id":1,"label":"Loyer","montant":950,"personne":"Commun","recurrent":True,"startMonth":"2026-01","jour":5},
   {"id":2,"label":"Électricité","montant":94,"personne":"Commun","recurrent":True,"startMonth":"2026-01","jour":12,"compte":"marie"},
   {"id":3,"label":"Internet","montant":29.99,"personne":"Commun","recurrent":True,"startMonth":"2026-01","jour":20},
   {"id":4,"label":"Téléphone","montant":15.99,"personne":"Alex","recurrent":True,"startMonth":"2026-01","jour":27}]
FA=[]
for i,(d,a) in enumerate([("2025-11-14",128.4),("2026-01-14",141.2),("2026-03-14",119.8),("2026-05-14",88.6),("2026-07-14",71.3),("2026-09-14",79.9)]):
    FA.append({"id":500+i,"four":"Énergie Fictive","type":"elec","date":d,"montant":a,"prelev":d,"src":"pdf","conso":round(a*4.1)})
data={"askName":False,"devise":"EUR","plusUnlocked":True,"personnes":[{"nom":"Marie"},{"nom":"Léa"}],
  "comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True},{"key":"marie","nom":"Compte Marie","payer":"Marie"}],
  "communParts":{"Alex":45,"Marie":45,"Léa":10},"entries":E,"fraisCommuns":F,"factures":FA,
  "virements":[v for i,m in enumerate(["2026-05","2026-06","2026-07","2026-08","2026-09","2026-10"]) for v in ({"id":9+i*2,"person":"Alex","month":m,"label":"Salaire","montant":2350,"done":True,"day":1},{"id":10+i*2,"person":"marie","month":m,"label":"Salaire","montant":2100,"done":True,"day":1})],
  "soldeInit":{"Alex":{"2026-05":1800}},"epargne":[{"id":301,"nom":"Livret A","owner":"Alex","vals":{"2026-10":4200}}],
  "provisions":[{"id":11,"nom":"Taxe foncière","mensuel":82,"soldeInitial":410,"startMonth":"2026-05","prelevements":[],"echeance":10,"prevu":980}],
  "commBalFrom":"2026-10","lastBackup":"2026-10-29T18:00:00Z"}
with sync_playwright() as p:
    b=p.chromium.launch(); c=b.new_context(viewport={'width':412,'height':900}, device_scale_factor=2); pg=c.new_page()
    pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    pg.goto(APP); pg.wait_for_timeout(300)
    pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); pg.reload(); pg.wait_for_timeout(1500)
    def snap(name, y, sel=None):
        if sel: y=pg.evaluate("s=>{ const e=document.querySelector(s); return e ? e.getBoundingClientRect().top+window.scrollY : 0; }", sel)+y
        f=os.path.join(TMP, name+".png"); pg.screenshot(path=f, full_page=True); crop(f, name, y)
    snap("accueil", -8, ".dash-hero")
    pg.locator('#nav .navi[data-view="compte"]').click(); pg.wait_for_timeout(500); pg.locator('.cpsub[data-cp="tk"]').click(); pg.wait_for_timeout(500)   # les tickets sont dans Opérations
    pg.locator('.entry[data-id="901"]').first.click(); pg.wait_for_timeout(700); snap("scan", 95)
    pg.locator("#cancel").click(); pg.wait_for_timeout(400)
    pg.locator('#nav .navi[data-view="depenses"]').click(); pg.wait_for_timeout(500); pg.locator('.dpsub', has_text="Analyse").first.click(); pg.wait_for_timeout(600)
    pg.locator("#goAvancee").click(); pg.wait_for_timeout(1200); snap("analyse", 75)
    pg.locator('#nav .navi[data-view="communes"]').click(); pg.wait_for_timeout(700)
    snap("equilibre", -12, "#cbal")
    pg.locator('#nav .navi[data-view="factures"]').click(); pg.wait_for_timeout(500)
    pg.locator('.avtabs button[data-av="fact"]').click(); pg.wait_for_timeout(500)
    pg.locator(".fct-card[data-k]").first.click(); pg.wait_for_timeout(800); snap("factures", 62)
    pg.locator('#nav .navi[data-view="factures"]').click(); pg.wait_for_timeout(400)
    pg.locator('.avtabs button[data-av="mois"]').click(); pg.wait_for_timeout(600); snap("avenir", 140)
    pg.locator('#nav .navi[data-view="compte"]').click(); pg.wait_for_timeout(700)
    csv=os.path.join(TMP, "releve_fictif.csv")
    open(csv,"w",encoding="utf-8").write("Date;Libellé;Montant\n02/10/2026;CARTE 02/10 BOULANGERIE;-4,60\n05/10/2026;PRLV SEPA LOYER;-950,00\n12/10/2026;PRLV SEPA ENERGIE FICTIVE;-94,00\n15/10/2026;CARTE 15/10 PHARMACIE;-18,90\n20/10/2026;PRLV SEPA INTERNET;-29,99\n28/10/2026;VIR SALAIRE;2350,00\n")
    pg.locator("#cptGear").click(); pg.wait_for_timeout(300)
    pg.locator(".sheet-overlay button", has_text="Importer un relevé").first.click(); pg.wait_for_timeout(400)
    with pg.expect_file_chooser() as fc: pg.locator("#impPick").click()
    fc.value.set_files(csv); pg.wait_for_timeout(1200); snap("releve", 62)
    # foyer : propriétaire avec 2 membres (inventés), sans relais (le réseau est coupé)
    h=pg.evaluate("()=>crypto.subtle.digest('SHA-256', new TextEncoder().encode('c2FsdA==:123456')).then(b=>btoa(String.fromCharCode(...new Uint8Array(b))))")
    fy={"role":"owner","fid":"F_VITRINE","tok":"T","km":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=","members":{
        "m1":{"name":"Marie","role":"edit","tabs":["list","articles","analyse","compte","factures","communes"],"ed":["list","compte","communes"],"accts":None,"tk":"all","km":"x"},
        "m2":{"name":"Léa","role":"view","tabs":["list","communes"],"ed":[],"accts":[],"tk":"own","km":"y"}}}
    pg.evaluate("([f, l])=>{ f.srv={ m1:{ joined:Date.now()-86400000, seen:Date.now()-600000 }, m2:{ joined:Date.now()-86400000, seen:Date.now()-3600000 } }; localStorage.setItem('fyCfg', JSON.stringify(f)); localStorage.setItem('lockCfg', JSON.stringify(l)); localStorage.setItem('foyerApi', JSON.stringify('http://localhost:9')); }", [fy, {"hash":h,"salt":"c2FsdA==","len":6,"bioId":None}])
    pg.reload(); pg.wait_for_timeout(1200)
    for k in "123456": pg.locator('#lockscreen button[data-k="%s"]' % k).click(); pg.wait_for_timeout(60)
    pg.wait_for_timeout(800)
    pg.locator("#hmenu").click(); pg.wait_for_timeout(400); pg.locator('.dr-row[data-k="foyer"]').click(); pg.wait_for_timeout(800); snap("foyer", 70)
    b.close()
# widgets : ce sont des écrans d'Android ; dessinés ici dans le style de l'appli
html="""<html><head><meta charset="utf-8"><style>body{margin:0;width:272px;height:250px;font-family:Inter,system-ui,sans-serif;color:#e8eaf0;background:#1d2c42}
.wrap{height:250px;display:flex;flex-direction:column;gap:10px;justify-content:center;padding:14px;box-sizing:border-box}
.w{background:rgba(20,22,28,.9);border-radius:18px;padding:12px 14px}.t{font-size:11px;color:#9aa1b2}.b{font-size:24px;font-weight:800;margin-top:4px}.b.s{font-size:20px}.b small{font-size:11px;font-weight:500;color:#9aa1b2}.h{font-size:11px;color:#4fd6a0;margin-top:2px}
.bars{display:flex;gap:6px;align-items:flex-end;height:38px;margin-top:6px}.bars i{flex:1;background:#3a4150;border-radius:3px}.bars i.on{background:#4fd6a0}</style></head><body><div class="wrap">
<div class="w"><div class="t">Tickets · Compte courant</div><div class="b">•••• €</div><div class="h">Touche pour afficher · empreinte</div></div>
<div class="w"><div class="t">Tickets · Ce mois</div><div class="b s">367 € <small>dépensés</small></div><div class="bars"><i style="height:40%"></i><i style="height:62%"></i><i style="height:55%"></i><i style="height:78%"></i><i style="height:48%"></i><i class="on" style="height:70%"></i></div></div></div></body></html>"""
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':272,'height':250}, device_scale_factor=2)
    f=os.path.join(TMP, "w.html"); open(f,"w",encoding="utf-8").write(html); pg.goto("file://"+f); pg.wait_for_timeout(300)
    pg.screenshot(path=os.path.join(TMP, "w.png")); b.close()
Image.open(os.path.join(TMP, "w.png")).convert("RGB").resize((544, 500), Image.LANCZOS).save(os.path.join(OUT, "widgets.jpg"), quality=72, optimize=True, progressive=True)
print("\n".join("%s %d Ko" % (n, os.path.getsize(os.path.join(OUT, n))//1024) for n in sorted(os.listdir(OUT))))
