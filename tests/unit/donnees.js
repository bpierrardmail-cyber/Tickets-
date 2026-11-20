// Forme des données restaurées (01a-donnees.js) et versions des migrations.
T("dataClean : une liste de tickets garde les tickets valables", function(){
  var v=dataClean("entries", [{id:1, date:"2026-10-01", montant:3, articles:[]}, "n'importe quoi", {date:"2026-10-02"}, {id:"x", date:"2026-10-03", articles:"pas une liste"}]);
  return eq(v.map(function(e){ return e.id; }), [1, "x"]) === true && Array.isArray(v[1].articles) ? true : "obtenu "+JSON.stringify(v); });
T("dataClean : des tickets qui ne sont pas une liste sont refusés", function(){ return eq(dataClean("entries", {a:1}), undefined); });
T("dataClean : un objet attendu (parts du commun) refuse une liste", function(){ return eq(dataClean("communParts", [1,2]), undefined); });
T("dataClean : une fiche illisible est retirée des frais fixes", function(){ return eq(dataClean("fraisCommuns", [{id:1}, 5, null]).length, 1); });
T("dataClean : un réglage simple passe tel quel", function(){ return eq(dataClean("devise", "EUR"), "EUR"); });
T("dataClean : null reste null (pas de valeur)", function(){ return eq(dataClean("budgets", null), null); });
T("migrations : une sauvegarde d'avant l'arbre retire les marques à refaire", function(){
  store.write("taxoV3", 3); store.write("taxoV4", 4); store.write("taxoV2", 2); store.write("virEpV2", 1); store.write("catParent", {a:"b"});
  dataMigReset({ taxoV2:2, virEpV2:1 });
  return eq([store.read("taxoV2", null), store.read("virEpV2", null), store.read("taxoV3", null), store.read("taxoV4", null), store.read("catParent", null)], [2, 1, null, null, null]); });
