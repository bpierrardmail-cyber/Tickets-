# Retirer un membre du foyer : s'il n'est pas à jour depuis plus d'un jour, la confirmation prévient que ce qui a été ajouté
# sur son téléphone depuis sera perdu (et propose le nouveau QR code) ; à jour, pas d'avertissement. Sans relais (réseau coupé).
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
data={"askName":False,"devise":"EUR","personnes":[{"nom":"Marie"},{"nom":"Léa"}],"comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True}],"entries":[]}
with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    c=b.new_context(viewport={'width':412,'height':900}); pg=c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    pg.goto(APP); pg.wait_for_timeout(300)
    h=pg.evaluate("()=>crypto.subtle.digest('SHA-256', new TextEncoder().encode('c2FsdA==:123456')).then(b=>btoa(String.fromCharCode(...new Uint8Array(b))))")
    fy={"role":"owner","fid":"F_T","tok":"T","km":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=","members":{
        "m1":{"name":"Marie","role":"edit","tabs":["list","communes"],"ed":["list"],"accts":None,"tk":"all","km":"x"},
        "m2":{"name":"Léa","role":"view","tabs":["list"],"ed":[],"accts":[],"tk":"own","km":"y"}}}
    pg.evaluate("""([d, f, l])=>{ localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));
        f.srv={ m1:{ joined:Date.now()-5*86400000, seen:Date.now()-3*86400000 }, m2:{ joined:Date.now()-86400000, seen:Date.now()-600000 } };
        localStorage.setItem('fyCfg', JSON.stringify(f)); localStorage.setItem('lockCfg', JSON.stringify(l)); localStorage.setItem('foyerApi', JSON.stringify('http://localhost:9')); }""",
        [data, fy, {"hash":h,"salt":"c2FsdA==","len":6,"bioId":None}])
    pg.reload(); pg.wait_for_timeout(1200)
    for k in "123456": pg.locator('#lockscreen button[data-k="%s"]' % k).click(); pg.wait_for_timeout(60)
    pg.wait_for_timeout(800)
    def ask(mid):
        pg.locator("#hmenu").click(); pg.wait_for_timeout(400); pg.locator('.dr-row[data-k="foyer"]').click(); pg.wait_for_timeout(600)
        pg.locator('.fy-mrow[data-m="%s"]' % mid).click(); pg.wait_for_timeout(300)
        pg.locator(".sheet-overlay button", has_text="Retirer du foyer").click(); pg.wait_for_timeout(300)
        t=norm(pg.locator(".sheet-overlay").last.inner_text()); pg.evaluate("()=>document.querySelectorAll('.sheet-overlay').forEach(x=>x.remove())"); return t
    t=ask("m1"); print("  ", t.replace("\n"," | ")[:300])
    check("Marie n'est pas à jour depuis le 27/10/2026" in t and "sera perdu" in t and "nouveau QR code" in t, "Marie, à jour il y a 3 jours : « n'est pas à jour depuis le 27/10/2026 : … sera perdu », nouveau QR code proposé")
    check("Ses tickets déjà arrivés chez toi restent" in t, "« Ses tickets déjà arrivés chez toi restent »")
    t=ask("m2")
    check("pas à jour" not in t and "Retirer Léa du foyer" in t, "Léa, à jour il y a 10 min : pas d'avertissement")
    check(not errs, "pas d'erreur %s"%errs[:3])
    b.close()
print("\n%d échec(s)"%len(fails)); sys.exit(1 if fails else 0)
