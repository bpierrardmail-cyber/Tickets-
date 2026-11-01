# Factures d'eau en photos : 3 factures (recto + verso) prises d'un coup, lues par un ML Kit factice avec les erreurs
# du téléphone (« 03/10I2026 », « 0508/2026 », « 202s », « deau », « (m3) », nom sur deux lignes, « SVOM … - TIP »).
# Écran de contrôle : « 6 photos · 6 lues · 3 factures trouvées », la plus récente vérifiée en entier, les plus anciennes
# listées (fiche de contrôle, décocher) ; rien d'enregistré avant « Appliquer » ; photo illisible puis « Reprendre » ;
# plusieurs PDF (dont un sans texte). Même résultat avec les photos dans le désordre. Données inventées.
import sys, os, re, random
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
from playwright.sync_api import sync_playwright
import horloge
SP=(sys.argv[1] if len(sys.argv)>1 else HERE); APP='file://'+ROOT+'/beta/index.html'; fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def norm(t): return t.replace(" "," ").replace("\xa0"," ")
IMG=os.path.join(HERE,"donnees","images","ticket_fictif.jpg")
PJ=os.environ.get('PDFJS_DIR','/opt/npm-tools/node_modules/pdfjs-dist/legacy/build/').rstrip('/')+'/'
def route(r):
    u=r.request.url
    if u.startswith("file:"): return r.continue_()
    m=re.search(r"pdfjs-dist@[^/]+/legacy/build/(pdf(?:\.worker)?\.min\.mjs)$", u)
    if m and os.path.exists(PJ+m.group(1)): return r.fulfill(status=200, body=open(PJ+m.group(1),'rb').read(), headers={"Content-Type":"text/javascript","Access-Control-Allow-Origin":"*"})
    return r.abort()

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
EMPTY={"lines":[]}
with sync_playwright() as p:
    b=p.chromium.launch()
    def open_app():
        c=b.new_context(viewport={'width':412,'height':900})
        c.add_init_script("""window.__ml=[]; window.Capacitor={ isNativePlatform:function(){ return true; }, Plugins:{ TicketOcr:{ recognize:function(){ return Promise.resolve(window.__ml.shift()||{lines:[]}); } } } };""")
        pg=c.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.route("**/*", route)
        pg.goto(APP); pg.wait_for_timeout(300)
        pg.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k]));}", data); pg.reload(); pg.wait_for_timeout(900)
        pg.locator('#nav .navi[data-view="factures"]').click(); pg.wait_for_timeout(400)
        pg.locator('.avtabs button[data-av="fact"]').click(); pg.wait_for_timeout(400)
        return c, pg, errs
    def pick(pg, what, files):
        pg.locator("#fctImp").click(); pg.wait_for_timeout(300)
        with pg.expect_file_chooser() as fc: pg.locator(".sheet-overlay button", has_text=what).first.click()
        fc.value.set_files(files); pg.wait_for_selector("#fctApply", timeout=30000); pg.wait_for_timeout(300)
    def bills(pg): return pg.evaluate("()=>[].map.call(document.querySelectorAll('.fbill'), r=>r.innerText.replace(/\\s+/g,' '))")
    v=lambda pg, i: pg.locator(i).input_value()
    def amt(x): return float(x.replace(",",".")) if x else None

    # ---------- 1. six photos dans l'ordre : contrôler une ancienne, tout garder
    c, pg, errs = open_app()
    pg.evaluate("r=>{ window.__ml=r; }", [mlkit(PAGES[i], i) for i in range(6)])
    pick(pg, "photos", [IMG]*6)
    t=norm(pg.locator("#app").inner_text()); B=bills(pg)
    print("  lignes :", B)
    check("6 photos · 6 lues" in t and "3 factures trouvées" in t and pg.locator(".htitle").inner_text()=="Factures lues", "« 6 photos · 6 lues · 3 factures trouvées »")
    check(len(B)==3 and "05/11/2025" in B[0] and "photos 1 et 2" in B[0] and "41 m³" in B[0] and "198,40" in B[0] and "06/05/2026" in B[1] and "LA PLUS RÉCENTE" in B[2] and "03/10/2026" in B[2], "la liste : 2 plus anciennes puis « LA PLUS RÉCENTE »")
    check("À VÉRIFIER" not in t, "rien « à vérifier » quand toutes les pages sont lues")
    check(abs(amt(v(pg,"#fp-mt"))-121.9)<0.001 and v(pg,"#fp-date")=="2026-10-03" and v(pg,"#fp-conso")=="27" and norm(v(pg,"#fp-four")).lower().startswith("vallée claire"), "la plus récente vérifiée dessous (Vallée Claire, 121,90 €, 03/10/2026, 27 m³)")
    check("2 pages" in t, "la plus récente : ses 2 pages")
    check(not (ls(pg,"factures") or []), "rien n'est enregistré avant « Appliquer »")
    check(pg.locator("#fctApply").inner_text()=="Appliquer · 3 factures", "bouton « Appliquer · 3 factures »")
    # contrôler la plus ancienne
    pg.locator('.fbill[data-i="0"] .bt').click(); pg.wait_for_timeout(300)
    check(pg.locator(".fold").count()==1 and "1 sur 3" in pg.locator(".fold").inner_text() and "Photos 1 et 2" in pg.locator(".fold").inner_text(), "toucher une ancienne : sa fiche « 1 sur 3 · Photos 1 et 2 »")
    check(abs(amt(v(pg,"#fo-mt"))-198.4)<0.001 and v(pg,"#fo-date")=="2025-11-05" and v(pg,"#fo-conso")=="41" and v(pg,"#fo-du")=="2025-03-05" and v(pg,"#fo-au")=="2025-08-20", "fiche : montant, date, m³, période")
    pg.locator("#fo-mt").fill("199,40")
    pg.locator("#foNext").click(); pg.wait_for_timeout(300)
    check(pg.locator(".fold").count()==1 and "2 sur 3" in pg.locator(".fold").inner_text(), "« Suivante » : la 2e")
    pg.locator("#foPrev").click(); pg.wait_for_timeout(300)
    check(abs(amt(v(pg,"#fo-mt"))-199.4)<0.001, "« Précédente » : la correction est gardée")
    pg.locator("#foOk").click(); pg.wait_for_timeout(300)
    check(pg.locator(".fold").count()==0 and "199,40" in bills(pg)[0], "OK : la liste montre 199,40 €")
    effs=norm(pg.locator("#app").inner_text())
    check("Par rapport à l'an dernier" in effs, "comparaison avec l'an dernier grâce aux anciennes (pas encore enregistrées)")
    pg.screenshot(path=os.path.join(SP,"t96_liste.png"), full_page=True)
    pg.locator("#fctApply").click(); pg.wait_for_timeout(700)
    F=sorted(ls(pg,"factures") or [], key=lambda f: f["date"])
    print("  enregistrées :", [(f["date"], f["montant"], f.get("conso"), f.get("du"), f.get("au"), f["type"], f["four"]) for f in F])
    check([(f["date"], f["montant"]) for f in F]==[("2025-11-05",199.4),("2026-05-06",176.25),("2026-10-03",121.9)], "« Appliquer » : les 3 factures, avec la correction")
    check(all(f["type"]=="eau" and f.get("aPayer") for f in F) and [f.get("conso") for f in F]==[41,44,27], "eau, à payer à réception, 41, 44 et 27 m³")
    check([(f.get("du"), f.get("au")) for f in F[:2]]==[("2025-03-05","2025-08-20"),("2025-08-20","2026-01-30")], "périodes de consommation des anciennes")
    check(len(set(f["four"] for f in F))==1 and len(set(f["id"] for f in F))==3, "un seul fournisseur, 3 identifiants différents")
    check(not errs, "pas d'erreur %s"%errs[:3]); c.close()

    # ---------- 2. rectos puis versos ; décocher une ancienne
    c, pg, errs = open_app()
    order=[0,2,4,1,3,5]
    pg.evaluate("r=>{ window.__ml=r; }", [mlkit(PAGES[i], i) for i in order])
    pick(pg, "photos", [IMG]*6)
    B=bills(pg)
    check(len(B)==3 and "198,40" in B[0] and "176,25" in B[1] and "LA PLUS RÉCENTE" in B[2] and "121,90" in B[2], "dans le désordre : les mêmes 3 factures")
    pg.locator('.fbill input[data-i="1"]').uncheck(); pg.wait_for_timeout(300)
    check("off" in pg.locator('.fbill[data-i="1"]').get_attribute("class") and pg.locator("#fctApply").inner_text()=="Appliquer · 2 factures", "décocher : barrée, « Appliquer · 2 factures »")
    pg.locator("#fctOnly").click(); pg.wait_for_timeout(700)
    F=sorted(ls(pg,"factures") or [], key=lambda f: f["date"])
    check([(f["date"], f["montant"]) for f in F]==[("2025-11-05",198.4),("2026-10-03",121.9)], "« Garder seulement les factures » : sans celle décochée")
    check(not errs, "pas d'erreur %s"%errs[:3]); c.close()

    # ---------- 3. une photo illisible, puis « Reprendre »
    c, pg, errs = open_app()
    # la photo 4 ne donne rien (et pas plus dans les autres sens : 3 essais de plus)
    pg.evaluate("r=>{ window.__ml=r; }", [mlkit(PAGES[i], i) for i in range(3)]+[EMPTY]*4+[mlkit(PAGES[i], i) for i in (4,5)])
    pick(pg, "photos", [IMG]*6)
    t=norm(pg.locator("#app").inner_text()); B=bills(pg)
    check("6 photos · 5 lues" in t and "Photo 4 illisible" in t and pg.locator('[data-retake="4"]').count()==1, "« 6 photos · 5 lues », « Photo 4 illisible » avec « Reprendre »")
    check("À VÉRIFIER" in B[1] and "photo 3" in B[1] and "À VÉRIFIER" not in B[0], "la facture lue sur une seule page : « À VÉRIFIER »")
    pg.evaluate("r=>{ window.__ml=r; }", [mlkit(PAGES[3], 3)])
    with pg.expect_file_chooser() as fc: pg.locator('[data-retake="4"]').click()
    fc.value.set_files(IMG); pg.wait_for_timeout(1200); pg.wait_for_selector("#fctApply", timeout=30000)
    t=norm(pg.locator("#app").inner_text()); B=bills(pg)
    check("6 photos · 6 lues" in t and "illisible" not in t and "photos 3 et 4" in B[1] and "À VÉRIFIER" not in t, "après « Reprendre » : 6 lues, la facture retrouve ses 2 pages")
    pg.screenshot(path=os.path.join(SP,"t96_reprise.png"), full_page=True)
    check(not errs, "pas d'erreur %s"%errs[:3]); c.close()

    # ---------- 4. plusieurs PDF, dont un sans texte
    if os.path.exists(PJ+"pdf.min.mjs"):
        c, pg, errs = open_app()
        D=os.path.join(HERE,"donnees")
        pick(pg, "PDF", [os.path.join(D,"facture_edf_fictive_2.pdf"), os.path.join(D,"pdf_sans_texte.pdf"), os.path.join(D,"facture_edf_fictive.pdf")])
        t=norm(pg.locator("#app").inner_text()); B=bills(pg)
        print("  PDF :", B)
        check("3 PDF · 2 lus" in t and "PDF 2 illisible" in t and pg.locator("[data-retake]").count()==0, "« 3 PDF · 2 lus », « PDF 2 illisible » (sans « Reprendre »)")
        check(len(B)==2 and "21/08/2026" in B[0] and "PDF 1" in B[0] and "LA PLUS RÉCENTE" in B[1] and "21/10/2026" in B[1], "la plus récente est le PDF du 21/10/2026")
        pg.locator("#fbadOff").click(); pg.wait_for_timeout(300)
        check("illisible" not in norm(pg.locator("#app").inner_text()), "« Ignorer » cache l'avertissement")
        pg.locator("#fctApply").click(); pg.wait_for_timeout(700)
        F=sorted(ls(pg,"factures") or [], key=lambda f: f["date"])
        check([(f["date"], f["montant"], f["src"]) for f in F]==[("2026-08-21",116.96,"pdf"),("2026-10-21",162.75,"pdf")], "« Appliquer » : les 2 factures EDF")
        check(not errs, "pas d'erreur %s"%errs[:3]); c.close()
    else: print("  (pdf.js absent : partie PDF sautée)")
    b.close()
print("\n%d échec(s)"%len(fails))
