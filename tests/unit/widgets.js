// Widget Épargne (28/11) : ce que l'appli donne à Android (widgetSnapshot().epargne). Données de widgets.json, inventées.
var S=widgetSnapshot().epargne, M=S.months;
function it(id){ return S.items.filter(function(x){ return x.id===String(id); })[0]; }
T("mois : du premier mois d'épargne (oct. 2025) au mois en cours (oct. 2026)", function(){ return eq([M[0], M[M.length-1], M.length], ["2025-10", "2026-10", 13]); });
T("les lignes clôturées ne partent pas", function(){ return eq(S.items.map(function(x){ return x.id; }), ["501", "502"]); });
T("chaque ligne : sa valeur de chaque mois (dernière valeur connue)", function(){ var h=it(501).h; return eq([h[0], h[5], h[6], h[12]], [9000, 9000, 10500, 12400]); });
T("avant sa première valeur, une ligne vaut 0", function(){ var h=it(502).h; return eq([h[7], h[8], h[12]], [0, 3000, 3600]); });
T("propriétaire et « moi »", function(){ return eq([it(501).o, it(502).o, S.me], ["Alex", "Marie", "Alex"]); });
T("objectif du Livret A", function(){ return near(it(501).obj, 20000); });
T("provision rangée sur le Livret A : sa part (« dont provisions »)", function(){ return near(it(501).p, provBalance(provisions[0], M[M.length-1])) === true && it(501).p > 0 ? true : "p = "+it(501).p; });
T("gagné sur 6 et 12 mois, comme le calcule le widget (Alex)", function(){ var h=it(501).h, L=h.length-1; return eq([h[L]-h[L-6], h[L]-h[L-12]], [1900, 3400]); });
