# Outils communs aux tests du foyer partagé (relais local, verrou, invitation par QR code), repris par t93.py
import sys, json, time, base64, os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
import numpy as np, cv2
from playwright.sync_api import sync_playwright
os.environ.setdefault("TICKETS_NOW", "")   # foyer : vraie heure (le relais local la compare)
import horloge
SP=(sys.argv[1] if len(sys.argv)>1 else HERE)
APP = 'file://'+ROOT+'/beta/index.html'
API = 'http://localhost:8787'
CODE = "246810"
fails = []
def check(c, msg):
    print(("OK   " if c else "FAIL ") + msg)
    if not c: fails.append(msg)

owner_data = {
  "askName": False, "devise": "EUR",
  "comptes": [{"key": "Benoit", "nom": "Compte courant", "payer": "Benoît", "main": True},
              {"key": "marie", "nom": "Compte Marie", "payer": "Marie"},
              {"key": "lea", "nom": "Compte jeune Léa", "payer": "Léa"}],
  "personnes": [{"nom": "Marie"}, {"nom": "Léa"}],
  "entries": [
    {"id": 101, "date": "2026-10-05", "marchand": "Leclerc", "montant": 42.5, "categorie": "Alimentation", "payePar": "Benoît", "articles": []},
    {"id": 102, "date": "2026-10-06", "marchand": "Pharmacie", "montant": 18.2, "categorie": "Santé", "payePar": "Marie", "articles": []},
    {"id": 103, "date": "2026-10-07", "marchand": "Cinéma", "montant": 12.5, "categorie": "Loisirs", "payePar": "Léa", "articles": []},
    {"id": 104, "date": "2026-10-08", "marchand": "Total", "montant": 60, "categorie": "Carburant", "payePar": "Benoît", "articles": []}],
  "virements": [{"id": 201, "person": "lea", "month": "2026-10", "label": "Argent de poche", "montant": 40, "done": True},
                {"id": 202, "person": "Benoit", "month": "2026-10", "label": "Salaire", "montant": 2100, "done": True}],
  "epargne": [{"id": 301, "nom": "Livret A", "vals": {"2026-10": 1500}}, {"id": 302, "nom": "Tirelire", "owner": "Léa", "vals": {"2026-10": 80}}],
  "fraisCommuns": [{"id": 401, "label": "Loyer", "montant": 800, "personne": "Commun", "recurrent": True},
                   {"id": 402, "label": "Cantine", "montant": 60, "personne": "Léa", "recurrent": True}],
  "soldeInit": {"lea": {"2026-09": 150}, "Benoit": {"2026-09": 1000}},
  "bourse": [{"id": 501, "nom": "PEA", "vals": {"2026-10": {"capital": 1000, "valeur": 1200}}}],
  "budgets": {"Alimentation": 400},
}
marie_old = {"askName": False, "comptes": [{"key": "principal", "nom": "Mon compte", "payer": "Marie", "main": True}],
             "entries": [{"id": 9001, "date": "2026-10-01", "marchand": "Ancien", "montant": 5, "categorie": "Autre", "payePar": "Marie", "articles": []}]}

def ls(pg, k):
    return pg.evaluate("k=>JSON.parse(localStorage.getItem(k))", k)
def put(pg, k, v):
    pg.evaluate("([k,v])=>localStorage.setItem(k, JSON.stringify(v))", [k, v])
def keypad(pg, digits):
    for d in digits:
        pg.locator('#lockscreen button[data-k="%s"]' % d).click()
        pg.wait_for_timeout(40)
def unlock(pg):
    try:
        pg.wait_for_selector("#lockscreen:not([data-setup])", timeout=2500)
    except Exception:
        return False
    keypad(pg, CODE); pg.wait_for_timeout(500)
    return True
def setup_lock(pg):
    pg.wait_for_selector("#lockscreen[data-setup]", timeout=8000)
    keypad(pg, CODE); pg.wait_for_timeout(150); keypad(pg, CODE); pg.wait_for_timeout(700)
def btn(pg, name):
    pg.get_by_role("button", name=name).first.click(); pg.wait_for_timeout(350)
def reload(pg, wait=2600):
    pg.reload(); pg.wait_for_timeout(700); unlock(pg); pg.wait_for_timeout(wait)
def open_foyer(pg):
    pg.locator("#hmenu").click(); pg.wait_for_timeout(300)
    pg.locator('.mnsub[data-ms="gerer"]').click(); pg.wait_for_timeout(200); pg.locator('.dr-row[data-k="foyer"]').click(); pg.wait_for_timeout(500)
def read_qr(pg, name):
    path = os.path.join(SP, name)
    pg.locator(".fy-qr").screenshot(path=path)
    img = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
    det = cv2.QRCodeDetector()
    for sc in (1, 2, 3):
        v, _, _ = det.detectAndDecode(cv2.resize(img, None, fx=sc, fy=sc, interpolation=cv2.INTER_NEAREST))
        if v: return v
    return ""
def new_page(b, errs, tag):
    ctx = b.new_context(viewport={'width': 412, 'height': 900})
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(tag + ": " + str(e)))
    pg.on('console', lambda m: (m.type == "error") and errs.append(tag + " console: " + m.text))
    pg.route("**/*", lambda r: r.continue_() if (r.request.url.startswith("file:") or r.request.url.startswith(API)) else r.abort())
    pg.goto(APP); pg.wait_for_timeout(300)
    return pg

