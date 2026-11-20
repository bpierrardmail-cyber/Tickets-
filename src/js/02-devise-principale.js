    // ---------- Devise principale (tous les montants de l'appli sont dans cette devise) ----------
    var CURS={ EUR:{s:"€",l:"Euro",c:"€ Euro"}, USD:{s:"$",l:"Dollar US",c:"$ Dollar"}, GBP:{s:"£",l:"Livre sterling",c:"£ Livre"}, CHF:{s:"CHF",l:"Franc suisse",c:"CHF Franc"}, CAD:{s:"$ CA",l:"Dollar canadien",c:"$ CA"} };
    var BASE=store.read("devise","EUR"); if(!CURS[BASE]) BASE="EUR";
    function curSym(c){ c=c||BASE; return (CURS[c]&&CURS[c].s)||c; }
    // Devises proposées quand on saisit un montant étranger : la devise principale, puis $ et €
    function closeMenu(){ var ov=document.querySelector(".drawer-ov"); if(ov && ov.parentNode) ov.parentNode.removeChild(ov); }
