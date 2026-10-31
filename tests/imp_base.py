# Outils communs aux tests d'import de relevé (données fictives), repris par t70.py
import sys, os, re, json
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
SP=(sys.argv[1] if len(sys.argv)>1 else HERE)
APP='file://'+ROOT+'/beta/index.html'
fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def ls(pg, k): return pg.evaluate("k=>JSON.parse(localStorage.getItem(k))", k)
data={"askName":False,"devise":"EUR","personnes":[{"nom":"Sylvette"}],"communParts":{"Benoit":60,"Sylvette":40},
  "comptes":[{"key":"Benoit","nom":"Compte courant","payer":"Benoit","main":True},
             {"key":"csv","nom":"Compte CSV","payer":""},{"key":"qif","nom":"Compte QIF","payer":""},{"key":"ofx","nom":"Compte OFX","payer":""}],
  "entries":[{"id":1,"date":"2026-10-12","marchand":"Brico Dépôt","montant":68.21,"categorie":"Maison","payePar":"Benoit","articles":[{"label":"Vis","prix":68.21,"produit":"Vis"}]},
             {"id":2,"date":"2026-10-03","marchand":"Leclerc","montant":50,"categorie":"Alimentation","payePar":"Benoit","articles":[]}],
  "epargne":[{"id":301,"nom":"Livret A","owner":"Benoit","vals":{"2026-10":1000}}],
  "virements":[{"id":9,"person":"Benoit","month":"2026-10","label":"Salaire","montant":2100,"done":True}],
  "soldeInit":{"Benoit":{"2026-09":500}}}
def money(t):
    t=t.replace(" ","").replace("\xa0","").replace(" ","").replace("−","-"); m=re.search(r"[-+]?\d+(?:,\d+)?", t); return float(m.group(0).replace(",",".")) if m else None
def open_cfg(pg, acct):
    pg.evaluate("k=>localStorage.setItem('compteSel', JSON.stringify(k))", acct); pg.reload(); pg.wait_for_timeout(900)
    pg.locator('#nav .navi[data-view="compte"]').click(); pg.wait_for_timeout(700)
def wheel(pg, txt):
    pg.locator("#cptGear").click(); pg.wait_for_timeout(300)
    pg.locator(".sheet-overlay button", has_text=txt).first.click()
def start(pg, acct, f):
    open_cfg(pg, acct)
    wheel(pg, "Importer un relevé"); pg.wait_for_timeout(400)
    with pg.expect_file_chooser() as fc: pg.locator("#impPick").click()
    fc.value.set_files(f); pg.wait_for_timeout(900)
def lines(pg): return pg.evaluate("()=>[...document.querySelectorAll('.imp-l')].map(l=>({t:l.textContent, on:l.querySelector('.imp-ck').classList.contains('on'), k:l.querySelector('.imp-ck').getAttribute('data-k')}))")
def line(pg, txt, amt=None):
    for l in lines(pg):
        if txt in l["t"] and (amt is None or amt in l["t"]): return l
    return None
def click_line(pg, k): pg.locator('.imp-l .imp-ck[data-k="%s"]' % k).click(); pg.wait_for_timeout(250)
def result(pg):
    t=pg.locator(".sheet-overlay .ui-msg").last.inner_text(); return t
