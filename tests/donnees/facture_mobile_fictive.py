# Fabrique deux factures de mobile fictives au format des PDF Free : accents détachés comme dans un PDF LaTeX
# (« pr ´ » puis « elev ´ » puis « ee … », « Somme ` » puis « a payer »), montants « 15.99 e », date en lettres.
# Données inventées. Lancer : python3 tests/donnees/facture_mobile_fictive.py
import os
from reportlab.pdfgen import canvas
from reportlab.pdfbase.pdfmetrics import stringWidth
HERE=os.path.dirname(os.path.abspath(__file__))

def line(c, x, y, s, size=8):
    # coupe après chaque accent seul, comme le PDF d'origine : le morceau suivant chevauche un peu le précédent
    parts, cur = [], ""
    for ch in s:
        cur+=ch
        if ch in "´`ˆ": parts.append(cur); cur=""
    if cur: parts.append(cur)
    for p in parts:
        c.setFont("Helvetica", size); c.drawString(x, y, p); x+=stringWidth(p, "Helvetica", size)-size*0.45

def bill(path, mois, mois_num, montant, ht, tva):
    c=canvas.Canvas(path, pagesize=(595, 842)); y=800
    for s in ["Site Internet : mobile.free.fr", "Service abonn ´e au 3244 (appel gratuit depuis une ligne Free)",
              "Forfait Free 5G+  ALEX MARTIN", "Ligne : 0600000000", "1 RUE DE L'ESSAI  00000 TESTVILLE",
              "• Facture no 2700000%s du 27 %s 2026" % (mois_num, mois), "Total de la facture HT  %s e" % ht, "TVA [20.00%%]  %s e" % tva,
              "Somme `a payer TTC*  %s e" % montant, "*Cette somme sera pr ´elev ´ee sur votre carte bancaire le 27-%s-2026." % mois_num,
              "Les sommes ´etant arrondies, le total des sommes unitaires peut diff ´erer du montant total pr ´elev ´e.",
              "Sans escompte. En cas de retard de paiement, d’un taux ´egal `a trois fois le taux d’int ´er ˆet l ´egal",
              "calcul ´e sur le montant des sommes dues TTC `a compter du 1er jour de retard suivant la date limite de paiement.",
              "• D ´etails de votre facture", "Abonnements, forfaits et options du 27-%s au 26-%02d  Co ˆut en e TTC (HT)" % (mois_num, int(mois_num)+1),
              "Abonnement Forfait  19.99 (16.66)", "Free Mobile – SAS – Si `ege social : 00000 Testville  1 / 1"]:
        line(c, 57, y, s); y-=12
    c.showPage(); c.save()

bill(os.path.join(HERE, "facture_mobile_fictive_09.pdf"), "septembre", "09", "9.99", "8.33", "1.66")
bill(os.path.join(HERE, "facture_mobile_fictive_10.pdf"), "octobre", "10", "15.99", "13.33", "2.66")
