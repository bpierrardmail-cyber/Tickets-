    // ---------- Catégories en arbre (06/11) ----------
    // Deux niveaux : une dizaine de grandes catégories (Courses, Sorties, Transport…) et leurs sous-catégories (Carburant, Bar…).
    // Un ticket garde son nom de catégorie dans e.categorie (grande catégorie ou sous-catégorie) ; CAT_PARENT = {sous-catégorie: grande catégorie}.
    // CATS = toutes les catégories (grandes et sous) ; une catégorie sans parent est une grande catégorie.
    var CAT_MAINS_DEF=["Courses","Sorties","Transport","Maison","Santé","Loisirs","Shopping","Enfants","Animaux","Autre"];
    var CAT_RULES=[["Courses",["aliment","course","boisson","hygi","entretien","épicerie","epicerie","supermarch","drive","boulang","fruit","légum","legum","surgel","conserve","viande","poisson","nourriture"]],
      ["Sorties",["restau","bar","café","cafe","fast","pizz","sortie","traiteur","resto"]],
      ["Transport",["carbur","essence","gazole","péage","peage","parking","train","taxi","bus","métro","metro","avion","voiture","garage","transport","auto","véhicule","vehicule","moto","entretien voiture"]],
      ["Maison",["brico","meuble","jardin","déco","deco","électroménager","electromenager","maison","travaux","ameublement"]],
      ["Santé",["pharma","médec","medec","dent","opti","mutuelle","santé","sante","kiné","kine","docteur"]],
      ["Loisirs",["ciné","cine","sport","livre","jeu","vacance","voyage","loisir","concert","musée","musee","culture","abonnement"]],
      ["Shopping",["vêtement","vetement","prêt","pret","chaussure","mode","multimédia","multimedia","high","informatique","tech","cadeau","shopping","beauté","beaute","textile"]],
      ["Enfants",["enfant","école","ecole","cantine","crèche","creche","jouet","bébé","bebe","nounou","scolaire"]],
      ["Animaux",["anima","véto","veto","croquette","chien","chat"]]];
    var CAT_WORD=["bar","chat","mode","bus","jeu","tech","high","fast","drive"];   // mots courts : seulement en mot entier (« Achats », « Barbier »)
    function catGuessMain(c){ var x=" "+(c||"").toLowerCase().replace(/[^a-z0-9à-ÿ]+/g," ")+" "; if(CAT_MAINS_DEF.indexOf(c)>=0) return c;
      function hit(k){ return CAT_WORD.indexOf(k)>=0 ? (x.indexOf(" "+k+" ")>=0 || x.indexOf(" "+k+"s ")>=0) : x.indexOf(k)>=0; }
      for(var p=0;p<2;p++) for(var i=0;i<CAT_RULES.length;i++){ var kw=CAT_RULES[i][1]; for(var j=0;j<kw.length;j++){ if((kw[j].indexOf(" ")>=0)===(p===0) && hit(kw[j])) return CAT_RULES[i][0]; } }   // expressions (« entretien voiture ») d'abord
      return "Autre"; }
    var CAT_PARENT=store.read("catParent", null), CAT_MIG=null;
    function persistCatParent(){ store.write("catParent", CAT_PARENT); }
    function catSetup(){
      if(CAT_PARENT && typeof CAT_PARENT==="object") return;
      var P={};
      if(!CATS0){   // nouvel utilisateur : l'arbre de départ
        CATS=CAT_MAINS_DEF.concat(["Alimentation","Boissons","Restaurant","Bar","Carburant","Péage","Parking","Bricolage","Pharmacie","Médecin","Vêtements","Multimédia"]);
        P={ Alimentation:"Courses", Boissons:"Courses", Restaurant:"Sorties", Bar:"Sorties", Carburant:"Transport", "Péage":"Transport", Parking:"Transport", Bricolage:"Maison", Pharmacie:"Santé", "Médecin":"Santé", "Vêtements":"Shopping", "Multimédia":"Shopping" };
      } else {   // catégories d'avant : chacune devient une sous-catégorie, rangée sous la grande catégorie la plus proche (rien n'est renommé)
        var mig=[];
        CATS.forEach(function(c){ if(CAT_MAINS_DEF.indexOf(c)>=0) return; var m=catGuessMain(c); P[c]=m; mig.push([c, m]); });
        CATS=CAT_MAINS_DEF.concat(CATS.filter(function(c){ return CAT_MAINS_DEF.indexOf(c)<0; }));
        CAT_MIG=mig;
      }
      CAT_PARENT=P;
      if(!(store.read("fyCfg", null) && store.read("fyCfg", null).role!=="owner")){ persistCats(); persistCatParent(); if(CAT_MIG && CAT_MIG.length) store.write("catMigShow", true); }   // un membre reçoit l'arbre du propriétaire
    }
    catSetup();
    function catMain(c){ if(!c) return "Autre"; var p=CAT_PARENT && CAT_PARENT[c]; return p || c; }
    function catIsMain(c){ return !(CAT_PARENT && CAT_PARENT[c]); }
    function catMains(){ var out=[];
      CATS.forEach(function(c){ var m=catMain(c); if(out.indexOf(m)<0) out.push(m); });
      var a=out.indexOf("Autre"); if(a>=0){ out.splice(a,1); out.push("Autre"); }   // Autre en dernier
      return out; }
    function catSubs(m){ return CATS.filter(function(c){ return CAT_PARENT && CAT_PARENT[c]===m; }); }
    function catLabel(c){ var m=catMain(c); return m===c ? c : m+" › "+c; }
    function catIn(c, key){ return c===key || catMain(c)===key; }   // un ticket compte dans sa sous-catégorie et dans sa grande catégorie
    function catRoll(map){ var o={}; Object.keys(map).forEach(function(k){ var v=map[k]; o[k]=(o[k]||0)+v; var m=catMain(k); if(m!==k) o[m]=(o[m]||0)+v; }); return o; }
    var KEYWORDS = {
      "Alimentation":["carrefour","leclerc","lidl","aldi","intermarch","super u","hyper u","casino","monoprix","auchan","netto","cora","biocoop","grand frais","franprix"],
      "Carburant":["totalenerg","total energ","total access","relais total","station total","esso"," bp ","station service","station-service","avia","agip","gasoil","gazole","diesel","sp95","sp98","carburant"],
      "Restaurant":["restaurant","mcdo","mcdonald","burger","kebab","pizz","boulang","cafe","brasserie"],
      "Maison":["leroy merlin","castorama","brico","weldom","mr bricolage","point p","gedimat","ikea"],
      "Santé":["pharmacie","parapharm","optique","mutuelle"],
      "Transport":["sncf","peage","autoroute","parking","ratp"],
      "Loisirs":["fnac","decathlon","cultura","micromania"]
    };
    var FAMILLES = store.read("familles", null) || ["Nourriture","Boissons","Vêtements","Divers"];
    if(FAMILLES.indexOf("Autre")<0) FAMILLES.push("Autre");
    function persistFamilles(){ store.write("familles", FAMILLES); }
    var DEFAULT_PROD = FAMILLES.concat(["Tomates","Yaourts","Pain","Lait","Œufs","Fromage","Pâtes","Riz","Café","Fruits","Légumes","Viande","Éponges","Lessive","Produits ménagers"]);
    var PRODUITS = store.read("produits", null) || DEFAULT_PROD.slice();
    (function(){ var miss=FAMILLES.filter(function(f){ return PRODUITS.indexOf(f)<0; }); if(miss.length) PRODUITS = miss.concat(PRODUITS); })();
    if(PRODUITS.indexOf("Remise")<0) PRODUITS.push("Remise");
    function persistProd(){ store.write("produits", PRODUITS); }
    var fraisCommuns = store.read("fraisCommuns", []);
    function persistFrais(){ store.write("fraisCommuns", fraisCommuns); }
    var argentMois = store.read("argentMois", {});
    function persistArgent(){ store.write("argentMois", argentMois); }
    function getArgent(p,m){ return (argentMois[p] && argentMois[p][m]) || 0; }
    function setArgent(p,m,v){ if(!argentMois[p]) argentMois[p]={}; argentMois[p][m]=v; persistArgent(); }
    var liquideMois = store.read("liquideMois", {});
    function persistLiquide(){ store.write("liquideMois", liquideMois); }
    function liquideAt(p, m){
      var o=liquideMois[p]||{}, best=null;
      for(var k in o){ if(k<=m && (best===null||k>best)) best=k; }
      return best===null ? null : { val:Number(o[best])||0, month:best };
    }
    // Bouton « Liquide » de l'onglet Compte : compter ou non l'argent liquide dans les soldes (Compte, Accueil, widgets, Bilan)
    function liqCounted(){ var v=state.cptLiq; if(v==null) v=store.read("cptLiq", true); return !!v; }
    var virements = store.read("virements", []);
    if(store.read("virEpV2", null)!==1){
      virements.forEach(function(v){ if(v.epargneId) v.done=true; });
      store.write("virements", virements);
      store.write("virEpV2", 1);
    }
    function persistVirements(){ store.write("virements", virements); }
