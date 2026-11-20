// Lecture des tickets et des factures, et lecture des montants tapés : fonctions sans écran.
T("num : « 1 234,56 » (espace des milliers)", function(){ return near(num("1 234,56"), 1234.56); });
T("num : « 12,50 € »", function(){ return near(num("12,50 €"), 12.5); });
T("num : « 3.4 » (point)", function(){ return near(num("3.4"), 3.4); });
T("num : espace après la virgule (clavier Android)", function(){ return near(num("7, 25"), 7.25); });
T("mlkitRows : deux morceaux à la même hauteur forment une ligne, de gauche à droite", function(){
  var r=mlkitRows({ width:1000, height:400, lines:[ {t:"4,20", p:[800,100,860,100,860,118,800,118]}, {t:"PAIN", p:[60,101,120,101,120,119,60,119]}, {t:"TOTAL", p:[60,150,130,150,130,168,60,168]} ] });
  return eq(r.split("\n").map(function(l){ return l.replace(/\s+/g, " ").trim(); }), ["PAIN 4,20", "TOTAL"]); });
(U.tickets||[]).forEach(function(t, i){
  var A=t.attendu;
  T("ticket "+(i+1)+" ("+(A.marchand||"magasin inconnu")+") : total"+(A.marchand?", magasin":"")+" et date", function(){
    var p=parseTicket(mlkitRows(t.res));
    var tot=Number(String(A.montant).replace(",", "."));
    if(Math.abs(Number(p.total)-tot)>0.005) return "total "+p.total+" au lieu de "+tot;
    if(A.marchand && norm(p.marchand||"").indexOf(norm(A.marchand))<0 && norm(A.marchand).indexOf(norm(p.marchand||"@"))<0) return "magasin « "+p.marchand+" » au lieu de « "+A.marchand+" »";
    if(A.date && p.date!==A.date) return "date "+p.date+" au lieu de "+A.date;
    return true; });
});
T("factTxtFix : accents détachés d'un PDF (« pr ´elev ´ee » → « prélevée »)", function(){ return factTxtFix("pr ´elev ´ee").indexOf("prélevée")>=0 || "obtenu « "+factTxtFix("pr ´elev ´ee")+" »"; });
T("factDatesIdx : date en lettres « 27 octobre 2026 »", function(){ return eq(factDate("Facture du 27 octobre 2026"), "2026-10-27"); });
T("factDatesIdx : date en chiffres « 05/11/26 »", function(){ return eq(factDate("Prélevé le 05/11/26"), "2026-11-05"); });
T("parseBill : facture inventée (fournisseur, date, montant à payer)", function(){
  var r=parseBill(["EDF", "Facture du 20/10/2026", "Montant total à payer 161,50 €", "Prélevé le 04/11/2026"].join("\n"));
  if(Math.abs(Number(r.montant)-161.5)>0.005) return "montant "+r.montant;
  if(r.date!=="2026-10-20") return "date "+r.date;
  if(!/edf/i.test(r.four||"")) return "fournisseur "+r.four;
  return true; });
