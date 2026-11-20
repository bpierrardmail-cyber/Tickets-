// Calculs (données de calculs.json, inventées) : ce qui sort de chaque compte, parts du commun, espèces, provisions.
var M="2026-10";
T("ticket payé par carte : il sort du compte", function(){ return eq(tkBank(state.entries.filter(function(e){ return e.id===1; })[0], "Alex"), true); });
T("ticket payé en espèces : il ne sort pas du compte", function(){ return eq(tkBank(state.entries.filter(function(e){ return e.id===2; })[0], "Alex"), false); });
T("frais commun sans « chacun sa part » : en entier sur le compte principal", function(){
  var f=fraisCommuns.filter(function(x){ return x.id===11; })[0]; return near(fraisAcctAmt(f, "Alex", M), 800); });
T("frais commun sans « chacun sa part » : pas sur l'autre compte (fraisKind décide du compte)", function(){
  var f=fraisCommuns.filter(function(x){ return x.id===11; })[0]; return eq(fraisKind(f, "Marie"), null); });
T("frais « chacun sa part » : 60 % sur le compte d'Alex", function(){
  var f=fraisCommuns.filter(function(x){ return x.id===12; })[0]; return near(fraisAcctAmt(f, "Alex", M), 18); });
T("frais « chacun sa part » : 40 % sur le compte de Marie", function(){
  var f=fraisCommuns.filter(function(x){ return x.id===12; })[0]; return near(fraisAcctAmt(f, "Marie", M), 12); });
T("frais perso de Marie : sur son compte", function(){
  var f=fraisCommuns.filter(function(x){ return x.id===13; })[0]; return near(fraisAcctAmt(f, "Marie", M), 12); });
T("part du commun : 60 % du loyer et d'internet pour Alex", function(){
  var f=fraisCommuns.filter(function(x){ return x.id===11; })[0]; return near(fraisPct(f, "Alex", M), 60); });
T("provision hors frais fixes : créée en juillet (solde de départ), puis 50 €/mois d'août à octobre → 150 €", function(){
  return near(provBalance(provisions[0], M), 150); });
T("provision : rien avant son premier mois", function(){ return near(provBalance(provisions[0], "2026-06")||0, 0); });
T("cohérence : « Il te reste » (fin) = solde du soir de la liste du mois", function(){
  var A=acctFigures("Alex", M), F=soldeFlow("Alex", M); return near(A.fin, F.closing, 0.01); });
T("dépenses du mois d'Alex : ticket par carte 30 + loyer 800 + sa part d'internet 18 (pas le ticket en espèces)", function(){
  return near(computeDepensesMonth("Alex", M), 848); });
T("calculs gardés : un ticket ajouté (store.write) change tout de suite le solde", function(){
  var avant=soldeFlow("Alex", M).closing;
  state.entries.push({id:99,date:M+"-20",marchand:"Essai",montant:10,categorie:"Courses",payePar:"Alex",articles:[]}); store.write("entries", state.entries);
  var apres=soldeFlow("Alex", M).closing; state.entries.pop(); store.write("entries", state.entries);
  return near(avant-apres, 10); });
T("calculs gardés : même chiffre avec ou sans mémoire (mois d'avant puis ce mois, et l'inverse)", function(){
  calcReset(); var a=soldeFlow("Alex", "2026-09").closing, b=soldeFlow("Alex", M).closing;
  calcReset(); var b2=soldeFlow("Alex", M).closing, a2=soldeFlow("Alex", "2026-09").closing;
  return eq([a,b], [a2,b2]); });
T("tickets d'un mois : entriesOfMonth = filtre sur la date", function(){
  return eq(entriesOfMonth(M).map(function(e){ return e.id; }), state.entries.filter(function(e){ return monthKey(e.date)===M; }).map(function(e){ return e.id; })); });
