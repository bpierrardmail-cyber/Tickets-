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

# Fournisseur au format inconnu (t108) : ni les règles ni la lecture générale ne trouvent la date ni le montant ;
# corrigés une fois, ils sont relus au même endroit.
def odd(path, jj_mm, montant):
    c=canvas.Canvas(path, pagesize=(595, 842)); y=800
    for s in ["BIZARRE ÉNERGIE", "Coopérative locale de chaleur", "Adhérent : ALEX MARTIN", "1 RUE DE L'ESSAI  00000 TESTVILLE",
              "Testville, %s/2026" % jj_mm, "Votre relevé de participation", "Chaleur livrée  1 200 unités",
              "Contribution mensuelle  € %s" % montant, "Merci de votre fidélité."]:
        c.setFont("Helvetica", 10); c.drawString(57, y, s); y-=14
    c.showPage(); c.save()

odd(os.path.join(HERE, "facture_inconnue_09.pdf"), "03/09", "45,10")
odd(os.path.join(HERE, "facture_inconnue_10.pdf"), "03/10", "47,80")
odd(os.path.join(HERE, "facture_inconnue_11.pdf"), "03/11", "52,30")

# Facture avec données Factur-X jointes (t110) : le texte est volontairement trompeur (montant HT seul, pas de date lisible),
# les données jointes donnent la date, le montant et l'échéance exacts.
def facturx(path):
    from pypdf import PdfReader, PdfWriter
    tmp=path+".tmp"
    c=canvas.Canvas(tmp, pagesize=(595, 842)); y=800
    for s in ["ATELIER FICTIF", "Facture n° FX-0001", "Prestation de test  100,00", "Total HT  100,00 €", "Merci."]:
        c.setFont("Helvetica", 10); c.drawString(57, y, s); y-=14
    c.showPage(); c.save()
    xml='''<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
 <rsm:ExchangedDocument><ram:ID>FX-0001</ram:ID><ram:IssueDateTime><udt:DateTimeString format="102">20261012</udt:DateTimeString></ram:IssueDateTime></rsm:ExchangedDocument>
 <rsm:SupplyChainTradeTransaction>
  <ram:ApplicableHeaderTradeAgreement><ram:SellerTradeParty><ram:Name>Atelier Fictif</ram:Name></ram:SellerTradeParty></ram:ApplicableHeaderTradeAgreement>
  <ram:ApplicableHeaderTradeSettlement>
   <ram:SpecifiedTradePaymentTerms><ram:DueDateDateTime><udt:DateTimeString format="102">20261112</udt:DateTimeString></ram:DueDateDateTime></ram:SpecifiedTradePaymentTerms>
   <ram:SpecifiedTradeSettlementHeaderMonetarySummation><ram:TaxBasisTotalAmount>100.00</ram:TaxBasisTotalAmount><ram:GrandTotalAmount>120.00</ram:GrandTotalAmount><ram:DuePayableAmount>120.00</ram:DuePayableAmount></ram:SpecifiedTradeSettlementHeaderMonetarySummation>
  </ram:ApplicableHeaderTradeSettlement>
 </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>'''
    w=PdfWriter(clone_from=PdfReader(tmp)); w.add_attachment("factur-x.xml", xml.encode("utf-8"))
    with open(path, "wb") as f: w.write(f)
    os.remove(tmp)

facturx(os.path.join(HERE, "facture_facturx_fictive.pdf"))
