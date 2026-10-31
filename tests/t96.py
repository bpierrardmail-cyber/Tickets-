# Factures d'eau en photos : 3 factures (recto + verso) prises d'un coup, lues par un ML Kit factice avec les erreurs
# du téléphone (« 03/10I2026 », « 0508/2026 », « 202s », « deau », « (m3) », nom sur deux lignes, « SVOM … - TIP »).
# La plus récente est à vérifier, les deux autres vont dans l'historique ; même résultat avec les photos dans le désordre.
# Données inventées.
import sys, os, re, random
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
SP=(sys.argv[1] if len(sys.argv)>1 else HERE); APP='file://'+ROOT+'/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def norm(t): return t.replace(" "," ").replace("\xa0"," ")
IMG=os.path.join(HERE,"donnees","images","ticket_fictif.jpg")

TETE="""Référence a  N du contrat : 9000123
rappeler :  Occupant : M. ALEX MARTIN
VALLÉE
Adresse du  1 RUE DE L'ESSAI
CLAIRE  lieu desservi  00000 TESTVILLE
service eau et assainissement
CENTRE DES FINANCES PUBLIQUES
2 place du Test  00000 TESTVILLE
Tél : 00.00.00.00.00
Horaires d'ouverture du SYNDICAT:  ALEX MARTIN
du lundi au vendredi : 9H00-12H00 et 13H00-16H00"""
DOS="""Détail de votre facture  Quantité  Prix unitaire  Montant HT  TVA  Montant TTC
Distribution de l'eau
Abonnement eau potable  182 jours  97,40000  48,57  2,67 (5,5%)  51,24
Organismes publics
La synthèse annuelle sur la qualité de l'eau distribuée est consultable sur le site internet de l'agence régionale de santé.
Modalités de paiement : par TIP SEPA, par chèque à l'ordre du Trésor Public, par Internet sur www.payfip.gouv.fr
ou en espèces (dans la limite de 300€) auprès d'un buraliste ou partenaire agréé."""
def recto(date, tipi, du, au, conso_l, total, extra=""):
    return TETE+"\n"+f"""Facture réelle du {date}
Référence TIPI : {tipi}
Tarifs applicables au 1er Janvier
Tarifs à disposition sur notre site Internet ou au siège du Syndicat.  Eau
Consommation du {du} au {au}
Voici la présentation simplifiée de votre facture  Détail au verso
{conso_l}
Montants
Abonnement  51,24
Total de la facture  {total}
Montant total à payer à réception  {total} €
En espèces (dans la limite de 300€) ou en carte bancaire, muni du présent avis, auprès d'un buraliste.
{extra}"""
def verso(date, tipi, conso, ht, tva, total):
    return f"""Facture réelle du {date} Référence TIPI: {tipi}
Ancien  Index  Nouvel  Conso. en
Point de consommation  Relevé le  index  index  m3
Consommation totale relevée
Consommation facture (m3)
Eau potable  {conso} m3  2,50000
"""+DOS+f"""
Total de votre facture  {ht}  {tva}  {total}
Montant total à payer à réception  {ht}  {tva}  {total}"""
PAGES=[  # (facture A : novembre 2025) (B : mai 2026) (C : octobre 2026)
  recto("05/11/2025", "2025-XX-00-11111", "05/03/2025", "20/08/2025", "Votre consommation d'eau  41 m3", "198,40"),
  verso("05/11/202s", "2025-XX-00-11111", 41, "188,06", "10,34", "198,40"),
  recto("06/05/2026", "2026-XX-00-22222", "20/08/2025", "30/01/2026", "Votre consommation d'eau  44 m", "176,25", "Créancier : SVOM VALLEE CLAIRE- TIP"),
  verso("06/05/2026", "2026-XX-00-22222", 44, "167,06", "9,19", "176,25"),
  recto("03/10I2026", "2026-XX-00-33333", "30/01/2026", "0508/2026", "Votre consommation deau  27 m3", "121,90", "Créancier: SIVOM VALLEE CLAIRE- TIP"),
  verso("03/1 0/2026", "2026-XX-00-33333", 27, "115,55", "6,35", "121,90"),
]
def mlkit(text, seed):
    rows=[l for l in text.split("\n") if l.strip()]; out=[]; rnd=random.Random(seed); W=1400
    for r,row in enumerate(rows):
        parts=[q for q in row.split("  ") if q.strip()]; y=80+r*24
        for i,t in enumerate(parts):
            t=t.strip(); w=len(t)*11; x=60 if i==0 else (W-60-w if i==len(parts)-1 else 60+(W-120)*i/(len(parts)-1)-w/2)
            out.append({"t":t,"p":[round(v+rnd.uniform(-1,1)) for v in (x,y,x+w,y,x+w,y+18,x,y+18)]})
    rnd.shuffle(out); return {"lines":out}
data={"askName":False,"devise":"EUR","comptes":[{"key":"Alex","nom":"Compte courant","payer":"Alex","main":True}],"entries":[]}
def ls(pg, k): return pg.evaluate("k=>JSON.parse(localStorage.getItem(k))", k)
with sync_playwright() as p:
    b=p.chromium.launch()
    def run(order, label):
        c=b.new_context(viewport={'width':412,'height':900})
        c.add_init_script("""window.__ml=[]; window.Capacitor={ isNativePlatform:function(){ return true; }, Plugins:{ TicketOcr:{ recognize:function(){ return Promise.resolve(window.__ml.shift()||{lines:[]}); } } } };""")
        pg=c.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
        pg.goto(APP); pg.wait_for_timeout(300)
        pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); pg.reload(); pg.wait_for_timeout(900)
        pg.evaluate("r=>{ window.__ml=r; }", [mlkit(PAGES[i], i) for i in order])
        pg.locator('#nav .navi[data-view="factures"]').click(); pg.wait_for_timeout(400)
        pg.locator('.avtabs button[data-av="fact"]').click(); pg.wait_for_timeout(400)
        pg.locator("#fctImp").click(); pg.wait_for_timeout(300)
        with pg.expect_file_chooser() as fc: pg.locator(".sheet-overlay button", has_text="photos").first.click()
        fc.value.set_files([IMG]*len(order)); pg.wait_for_selector("#fctApply", timeout=30000); pg.wait_for_timeout(300)
        v=lambda i: pg.locator(i).input_value()
        t=norm(pg.locator("#app").inner_text())
        print("  "+label+" :", v("#fp-four"), v("#fp-date"), v("#fp-mt"), v("#fp-conso"))
        check(abs(float(v("#fp-mt").replace(",","."))-121.9)<0.001 and v("#fp-date")=="2026-10-03" and v("#fp-conso")=="27", label+" : la plus récente à vérifier (121,90 €, 03/10/2026, 27 m³)")
        check(norm(v("#fp-four")).lower().startswith("vallée claire"), label+" : fournisseur « Vallée Claire » (%s)"%v("#fp-four"))
        check("2 pages" in t, label+" : ses 2 pages seulement")
        F=sorted(ls(pg,"factures") or [], key=lambda f: f["date"])
        print("  historique :", [(f["date"], f["montant"], f.get("conso"), f.get("du"), f.get("au"), f["type"], f["four"]) for f in F])
        check([(f["date"], f["montant"]) for f in F]==[("2025-11-05",198.4),("2026-05-06",176.25)], label+" : les 2 plus anciennes dans l'historique")
        check(all(f["type"]=="eau" and f.get("aPayer") for f in F) and [f.get("conso") for f in F]==[41,44], label+" : eau, à payer à réception, 41 et 44 m³")
        check([(f.get("du"), f.get("au")) for f in F]==[("2025-03-05","2025-08-20"),("2025-08-20","2026-01-30")], label+" : périodes de consommation")
        check(len(set(f["four"] for f in F))==1, label+" : un seul fournisseur")
        pg.locator("#fctApply").click(); pg.wait_for_timeout(600)
        F=ls(pg,"factures")
        check(len(F)==3 and len(set((f["type"], f["four"].lower().replace("è","e").replace("é","e")) for f in F))==1, label+" : 3 factures, une seule série")
        check(not errs, label+" : pas d'erreur %s"%errs[:3]); c.close()
    run(list(range(6)), "dans l'ordre")
    run([0,2,4,1,3,5], "rectos puis versos")
    b.close()
print("\n%d échec(s)"%len(fails))
