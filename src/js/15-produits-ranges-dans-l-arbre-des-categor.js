    // ---------- Produits rangés dans l'arbre des catégories (06/11, taxoV3) ----------
    // Plus de « familles » à part : la famille d'un produit (FAMILLE_DE) est une catégorie de l'arbre (grande ou sous-catégorie) ; FAMILLES = CATS.
    // Les anciennes familles deviennent la catégorie du même nom (Hygiène & soins → Hygiène et soins), ou de leur premier mot (Bricolage & outillage → Bricolage),
    // sinon une sous-catégorie à leur nom sous la grande catégorie la plus proche ; « Divers » → « Autre ». Les produits gardent leur nom.
    var FAM_FB="Autre";
    function cnm(x){ return String(x||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/&/g," et ").replace(/[^a-z0-9]+/g,""); }
    // clé d'un nom : sans casse, accents, « et / de / la », séparateurs ni pluriel (« HYGIÈNE- SOINS » = « Hygiène et soins », « BRICOLAGES » = « Bricolage »)
    function ckey(x){ return String(x||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").split(/[^a-z0-9]+/).filter(function(w){ return w && ["et","de","du","des","la","le","les","l","d"].indexOf(w)<0; }).map(function(w){ return w.length>3 ? w.replace(/s$/,"") : w; }).join(""); }
    function ckeySeg(x){ return ckey(String(x||"").split(/\s*(?:\s-\s|-\s|\s-|&|\/|,|\bet\b|\bET\b)\s*/)[0]); }   // le premier morceau : « MULTIMÉDIA - HIGH-TECH » → multimedia
    function catFindLike(f, skip){   // une catégorie existante qui veut dire la même chose ; préfère un nom écrit normalement, puis une grande catégorie
      var k=ckey(f), ks=ckeySeg(f), best=null, sc=-1;
      CATS.forEach(function(c){ if(c===f || c===skip) return; var ck=ckey(c), hit=(ck===k) ? 2 : ((ks.length>=4 && ck===ks) ? 1 : 0); if(!hit) return;
        var v=hit*10+(catUpper(c)?0:4)+(catIsMain(c)?2:0); if(v>sc){ sc=v; best=c; } });
      return best;
    }
    function catUpper(c){ var L=String(c).replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g,""); return L.length>=3 && L===L.toUpperCase(); }
    function catNice(c){ return catUpper(c) ? c.charAt(0)+c.slice(1).toLowerCase() : c; }   // « BOISSONS ALCOOLISÉ » → « Boissons alcoolisé »
    function famTarget(f){
      if(f==="Divers" || f==="Autre") return "Autre";
      if(f==="Nourriture") f="Alimentation";
      var like=catFindLike(f); if(like) return like;
      if(CATS.indexOf(f)>=0) return f;
      var nf=catNice(f); if(CATS.indexOf(nf)>=0) return nf;
      var m=catGuessMain(nf); CATS.push(nf); if(m!==nf){ if(!CAT_PARENT) CAT_PARENT={}; CAT_PARENT[nf]=m; }
      return nf;
    }
    // Réparation (taxoV4) : les familles déjà migrées sous un autre nom (majuscules, « - », pluriel) sont fusionnées avec la catégorie qui veut dire la même chose,
    // et les noms tout en majuscules sont réécrits normalement. Rien n'est perdu : tickets, articles, produits et budgets suivent. La fenêtre « rangées » se rouvre.
    function catWeight(c){ var n=0; (state.entries||[]).forEach(function(e){ if(e.categorie===c) n+=2; (e.articles||[]).forEach(function(a){ if(a.produit===c) n++; }); });
      if(KEYWORDS[c] && KEYWORDS[c].length) n+=5; if(budgets && budgets[c]>0) n+=5; return n; }
    function catRepair(){
      var member=!!(store.read("fyCfg", null) && store.read("fyCfg", null).role!=="owner");
      if(member || store.read("taxoV4", null)===4) return;
      var changed=0, guard=0, again=true;
      while(again && guard++<60){ again=false;
        for(var i=0;i<CATS.length;i++){ var c=CATS[i]; if(c==="Autre" || (catIsMain(c) && CAT_MAINS_DEF.indexOf(c)>=0)) continue;
          var t=catFindLike(c); if(!t) continue;
          if(!catUpper(c) && catUpper(t)) continue;   // on garde le nom écrit normalement : l'autre viendra à lui
          if(catUpper(c)===catUpper(t) && !(catIsMain(t) && CAT_MAINS_DEF.indexOf(t)>=0) && catWeight(c)>=catWeight(t)){ catMergeRaw(t, c); changed++; again=true; break; }   // même écriture : on garde celle qui sert (ou la plus ancienne)
          catMergeRaw(c, t); changed++; again=true; break; } }
      CATS.forEach(function(c){ if(CAT_PARENT && CAT_PARENT[c]==="Autre"){ var g=catGuessMain(c); if(g!=="Autre" && g!==c){ CAT_PARENT[c]=g; changed++; } } });   // rangées dans Autre faute de règle (Véhicule → Transport)
      CATS.slice().forEach(function(c){ if(!catUpper(c)) return; var n=catNice(c); if(n===c) return; if(CATS.indexOf(n)>=0){ catMergeRaw(c, n); } else catRenameRaw(c, n); changed++; });
      store.write("taxoV4", 4);
      if(changed){ persistCats(); persistCatParent(); persist(); persistBudgets(); persistBudgetsP(); try{ persistAppris(); }catch(err){} famSync(true); store.write("catMigShow", true); }
    }
    function famSync(save){   // les catégories servent aussi à ranger les produits
      FAMILLES=CATS.slice();
      var byN={}; CATS.forEach(function(c){ byN[cnm(c)]=c; }); byN[cnm("Nourriture")]=byN[cnm("Alimentation")]||FAM_FB;
      Object.keys(FAMILLE_DE).forEach(function(k){ var v=FAMILLE_DE[k]; if(CATS.indexOf(v)<0) FAMILLE_DE[k]=byN[cnm(v)]||FAM_FB; });   // ancienne famille restée quelque part
      CATS.forEach(function(c){ FAMILLE_DE[c]=c; if(PRODUITS.indexOf(c)<0) PRODUITS.push(c); });
      var seen={}; PRODUITS=PRODUITS.filter(function(x){ if(seen[x]) return false; seen[x]=1; return true; });
      if(save){ persistFamilles(); persistFamille(); persistProd(); }
    }
    function famMerge(){
      var member=!!(store.read("fyCfg", null) && store.read("fyCfg", null).role!=="owner");
      if(store.read("taxoV3", null)===3 || member){ famSync(false); return; }
      var map={}; FAMILLES.forEach(function(f){ map[f]=famTarget(f); });
      Object.keys(FAMILLE_DE).forEach(function(k){ var v=FAMILLE_DE[k]; if(map[v]) FAMILLE_DE[k]=map[v]; });
      Object.keys(map).forEach(function(f){ if(map[f]!==f){ delete FAMILLE_DE[f];
        var ix=PRODUITS.indexOf(f); if(ix>=0){ if(PRODUITS.indexOf(map[f])<0) PRODUITS[ix]=map[f]; else PRODUITS.splice(ix,1); } } });
      Object.keys(APPRIS||{}).forEach(function(k){ var v=APPRIS[k]; if(typeof v==="string" && map[v] && map[v]!==v) APPRIS[k]=map[v]; });
      var ch=false; (state.entries||[]).forEach(function(e){ (e.articles||[]).forEach(function(a){ var t=map[a.produit]; if(a.produit && t && t!==a.produit){ a.produit=t; ch=true; } }); });
      famSync(true); persistCats(); persistCatParent(); try{ persistAppris(); }catch(err){}
      if(ch) store.write("entries", state.entries);
      store.write("taxoV3", 3);
    }
    function classifyArticle(a){
      var amt=Number(a.prix)||0, prod=a.produit||"", fam, name;
      if(prod==="Remise"){ return { fam:"Remise", name:"Remise", amt:amt }; }
      if(prod && FAMILLES.indexOf(prod)<0){ fam=familleOf(prod); name=prod; }
      else { fam=(prod && FAMILLES.indexOf(prod)>=0)?prod:FAM_FB; name=(a.label||"").trim()||"Autres"; }
      return { fam:fam, name:name, amt:amt };
    }

    function guessCat(text){
      var t=(text||"").toLowerCase().replace(/\s+/g," ");
      for(var i=0;i<CATS.length;i++){ var c=CATS[i], kws=KEYWORDS[c]||[]; for(var j=0;j<kws.length;j++){ if(t.indexOf(kws[j])>=0) return c; } }
      return "Autre";
    }

    // Enseigne : on cherche dans le haut du ticket un magasin déjà connu (tes tickets d'abord,
    // puis les grandes enseignes), en tolérant les erreurs de lecture (« IntermaRche » → Intermarché).
    var CHAINS=["Intermarché","E.Leclerc","Carrefour","Carrefour Market","Carrefour City","Carrefour Contact","Auchan","Lidl","Aldi","Super U","Hyper U","U Express","Casino","Géant Casino","Monoprix","Franprix","Netto","Biocoop","Grand Frais","Picard","Cora","Match","Colruyt","Action","Gifi","La Foir'Fouille","Leroy Merlin","Castorama","Brico Dépôt","Bricomarché","Weldom","Mr.Bricolage","Gamm Vert","Jardiland","Truffaut","Norauto","Feu Vert","Decathlon","Intersport","Boulanger","Darty","Fnac","Ikea","Maisons du Monde","Kiabi","Jules","Zara","H&M","Primark","Sephora","Nocibé","Marionnaud","TotalEnergies","Esso","Avia","Shell","McDonald's","Burger King","KFC","Quick","Subway","Starbucks","Paul","Marie Blachère","La Poste"];
    function matchMerchant(lines, guess){
      var cands={};
      try{ (state.entries||[]).forEach(function(e){ var m=(e.marchand||"").trim(); if(m) cands[m]=(cands[m]||0)+1; }); }catch(e){}
      CHAINS.forEach(function(c){ if(!(c in cands)) cands[c]=0; });
      var top=(lines||[]).slice(0,8).map(function(l){ return norm(String(l).replace(/1/g,"i").replace(/0/g,"o").replace(/5/g,"s")); }).filter(function(l){ return l.replace(/ /g,"").length>=3; });
      // morceaux du haut du ticket : la ligne entière et chaque suite de 1 à 3 mots
      var parts=[];
      top.forEach(function(l, i){ var w=l.split(" "); parts.push(l.replace(/ /g,""));
        if(top[i+1]) parts.push(l.replace(/ /g,"")+top[i+1].replace(/ /g,""));   // enseigne sur deux lignes (« BRICOD » / « DEPOT »)
        for(var a=0;a<w.length;a++) for(var b=a+1;b<=Math.min(w.length,a+3);b++) parts.push(w.slice(a,b).join("")); });
      var best=null, bs=0, bl=0, bc=null, bcs=0;
      Object.keys(cands).forEach(function(c){
        var nc=norm(c).replace(/ /g,""); if(nc.length<3) return;
        parts.forEach(function(pc){
          if(pc.length<3) return;
          var sc=1-lev(pc, nc)/Math.max(pc.length, nc.length);
          if(nc.length<5 && sc<1) return;          // noms courts (Lidl, Cora…) : seulement à l'identique
          if(cands[c]>0) sc+=0.03;                  // ta propre orthographe d'abord
          if(sc>bs || (sc===bs && nc.length>bl)){ bs=sc; best=c; bl=nc.length; }
          if(CHAINS.indexOf(c)>=0 && (!bc || sc>bcs)){ bc=c; bcs=sc; }
        });
      });
      // un ancien ticket enregistré avec un nom coupé (« BRICOD ») ne doit pas cacher la grande enseigne lue en entier (« Brico Dépôt »)
      if(best && bc && best!==bc && bcs>=0.86 && cands[best]>0 && CHAINS.indexOf(best)<0){ var nb=norm(best).replace(/ /g,""), nbc=norm(bc).replace(/ /g,""); if(nbc.length>nb.length && nbc.indexOf(nb.slice(0, Math.max(3, nb.length-1)))===0) return bc; }
      if(best && bs>=0.86) return best;
      // sinon : une grande enseigne citée plus bas (« VOTRE MAGASIN GRAND FRAIS ») ; pas celles qui sont aussi des marques ou des mots courants
      var all=" "+norm((lines||[]).join(" "))+" ", hit=null, hn=0;
      CHAINS.forEach(function(c){ var nc=norm(c); if(nc.length<5 || /^(casino|match|action|paul|quick|jules|shell|total|la poste|boulanger|starbucks)$/.test(nc)) return;
        var n=all.split(" "+nc+" ").length-1; if(n>hn || (n && n===hn && nc.length>norm(hit).length)){ hit=c; hn=n; } });
      if(hit) return hit;
      // sinon : casse remise d'aplomb (« IntermaRche » → « Intermarche »)
      return (guess||"").replace(/[A-Za-zÀ-ÿ]+/g, function(w){ return (/[a-zà-ÿ]/.test(w) && /[A-ZÀ-Ý]/.test(w.slice(1))) ? w.charAt(0).toUpperCase()+w.slice(1).toLowerCase() : w; });
    }
    function ticketCat(marchand, text, fuel){
      var nn=norm(marchand), cnt={}, best=null;
      if(nn) (state.entries||[]).forEach(function(e){ if(e.categorie && norm(e.marchand)===nn) cnt[e.categorie]=(cnt[e.categorie]||0)+1; });
      Object.keys(cnt).forEach(function(c){ if(CATS.indexOf(c)>=0 && (!best || cnt[c]>cnt[best])) best=c; });
      if(best) return best;
      if(fuel && CATS.indexOf("Carburant")>=0) return "Carburant";
      var g=guessCat(marchand); return g!=="Autre" ? g : guessCat(text);
    }
    function parseTicket(text){
      var lines = text.split(/\n/).map(function(l){return l.trim();}).filter(Boolean);
      var amtRe = /(\d{1,4}) ?[.,] ?(\d{2})\b/g;   // « 48 ,42 » : la lecture ajoute parfois une espace
      // Lignes de paiement / totaux (tolère les erreurs de lecture : T0TAL, YONTANT…)
      // (« TOT TTC », lu parfois « TOT TIC » ; « Net » = net à payer ou net HT ; carburant : volume et prix au litre ne sont pas des articles)
      // (« carte » en mot entier : « CARTES MAXI TRAD » est un article)
      var key = /somme\s*d[uû]e?\b|[aà]\s*r[eé]gler|t[o0]ta[l1i]|\bt[o0]t\b|[mnyw]{1,2}ontant|ontant\s*d|a payer|à payer|net a|net à|\bcarte\b|\bcb\b|visa|mastercard|sans contact|esp[eè]ces|rendu|rendre|monnaie|tva|\bttc\b|\bht\b|€\s*\/\s*l(?:it(?:re)?s?)?\b|prix\s*(unit|au\s*litre)|\bp\.?u\.?\b/i;
      var totRe = /t[o0]ta[l1i]|\bt[o0]t\b|[mnyw]{1,2}ontant|ontant\s*d|a payer|à payer|net a|net à|somme\s*d[uû]e?\b|[aà]\s*r[eé]gler/i;
      // En-tête du magasin : téléphone, RCS, SIRET… (jamais des articles ni des montants)
      var payRe = /\bcb\b|\bcarte\s+(?:bancaire|bleue|cb|visa)|paiement|visa|mastercard|sans contact|esp[eè]ces/i;
      var skip = /\b(t[eé]l|tel|fax|siret|siren|rcs|naf|ape|www|http|caisse|ticket|op[eé]rateur|h[oô]tesse|vendeur)\b|@/i;
      var all = [], lignes = [], afterTotal = false;
      function cleanLabel(l){
        // « A 1x * » en tête (le « 1x » est parfois lu « IX ») ; « EUR A » ou « EURA » (code TVA) en fin
        l=l.replace(/^\s*[A-D]\s+(?=(?:\d+|[Il|])\s?[xX]\b|\*)/, "").replace(/^\s*(?:\d{1,2}|[Il|])\s?[xX]\s+/, "").replace(/^\s*\*\s*/, "");
        l=l.replace(/^\s*[4+](?=[A-Z]{3})/, "");   // « *ETREZ » lu « 4ETREZ »
        var t=l.replace(/-?\s?(?:\d{1,3}\.(?=\d{3}[.,]))?(\d{1,4}) ?[.,] ?(\d{2})\b/g," ").replace(/\b(?:e[lu]{1,2}a?r|eur)(?:os?)?(?:\s*[a-d])?\b/gi," ").replace(/€/g," ");
        var up=(t.match(/[A-ZÀ-Ý]/g)||[]).length, lo=(t.match(/[a-zà-ÿ]/g)||[]).length;
        // ticket en majuscules : un mot avec des minuscules est du bruit (filigrane lu à l'envers…)
        if(up>=4 && up>=lo*3) t=t.split(/\s+/).filter(function(w){ return !/[a-zà-ÿ]/.test(w); }).join(" ");
        t=t.replace(/\b0(?=[A-ZÀ-Ý])/g,"O").replace(/([A-ZÀ-Ý])0(?=[A-ZÀ-Ý])/g,"$1O");
        return t.replace(/[^0-9A-Za-zÀ-ÿ ]+/g," ").replace(/\s+/g," ").trim().replace(/\s[A-D]$/,"");
      }
      // ticket de carburant : volume, prix au litre, pompe ne sont jamais des articles
      var fuelT=/\b(gazole|gasoil|diesel|sp\s?9[58](?:\s?-?\s?e\s?(?:5|10))?|sans\s*plomb|e\s?10|e\s?85|gpl|carburant|adblue|essence|pompe|esso|avia|agip|shell)\b|total\s*(energ|access)/i.test(text);
      var sawVol=false, pend="", cardV=0, tvaRows=[], espV=0, renduV=0, nbArt=0, nbLu=0, nLines=0;   // espèces données, rendu, nombre d'articles annoncé / lu (18/11)   // cardV : montant payé par carte ; tvaRows : TTC de chaque taux du tableau de TVA   // pend : nom d'un article pesé, dont le prix est sur la ligne suivante (« NET 0,980 kg x 1,99 €/kg 1,95 € »)
      lines.forEach(function(l){
        var am1=/(\d{1,4}) ?[.,] ?(\d{2})\b/.exec(l);   // recoupements : espèces données, monnaie rendue, nombre d'articles annoncé
        if(am1){ var av=parseFloat(am1[1]+"."+am1[2]); if(/esp[eè]ces|num[eé]raire|\bcash\b/i.test(l) && !/rendu|rendre/i.test(l)) espV=Math.max(espV, av); if(/\brendu\b|[aà]\s*rendre|monnaie\s*rendue/i.test(l)) renduV=Math.max(renduV, av); }
        var nb=/(?:nombre|nbre|nb)\.?\s*(?:d\W?\s*)?articles?(?:\s*vendus?)?\D{0,4}(\d{1,3})\b/i.exec(l) || /articles?\s*vendus?\D{0,4}(\d{1,3})\b/i.exec(l) || /^\D{0,3}(\d{1,3})\s*articles?\s*$/i.exec(l);
        if(nb && !nbArt) nbArt=+nb[1];
        var lv=[], m, last=null, lastV=0, neg=false, nAmt=0, isSkip=skip.test(l) || /\b\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}\b/.test(l); amtRe.lastIndex=0;
        // la même ligne sans ses espaces : la lecture coupe parfois les mots (« Vo lume », « T OT TIC », « N et »)
        var cmp=l.toLowerCase().replace(/\s+/g,"");
        var weightL=/(?:€|eur(?:os?)?)\s*\/\s*k?g\b|\d[.,]\d{3}\s*k\s?g\b/i.test(l);   // ligne de pesée : poids net, prix au kilo (« 2,99 €/kg », « 2,99EURO/kg »)
        var cTot=/^t[o0]t(?:a[l1i])?(?:ttc|tic|t1c|apayer|àpayer)?[0-9:€.,]/.test(cmp) || (/^net(?:ht|ttc|apayer|àpayer)?[0-9:€.,]/.test(cmp) && !weightL);
        var volL=fuelT && /^\d{1,3}[.,]\d{2,3}(?:l|lit|litres?)(?![a-z])/.test(cmp);   // « 24,33 lit » : le volume pris à la pompe
        var cFuel=volL || /^volume/.test(cmp) || (/volume|litre|prixunit|prixaulitre|€\/l|eur\/l|pompe|quantit/.test(cmp) && (fuelT || /\d\s*l\b/i.test(l)));   // « Volume » en début de ligne : une quantité, pas un article
        while((m=amtRe.exec(l))){
          if(/^[.,]\d/.test(l.substr(m.index+m[0].length, 2)) || (m[1].length!==3 && /\d[.,]$/.test(l.slice(Math.max(0, m.index-2), m.index)))) continue;   // « 7.19.15 », « 3.0.16 » (version), « 04.70.08 » (téléphone) : pas un montant
          var ng=/-\s?$/.test(l.slice(Math.max(0, m.index-2), m.index));   // « -0,73 » : une remise
          var v=parseFloat(m[1]+"."+m[2]), th=m[1].length===3 && /(?:^|[^\d.,])(\d{1,3})\.$/.exec(l.slice(Math.max(0, m.index-5), m.index));   // « 1.234,56 »
          if(th) v+=1000*th[1];
          if(!isSkip && !ng) all.push({ value: v, line:l, tot:cTot, pay:payRe.test(l) }); if(!ng) lv.push(v); last=m; lastV=v; neg=ng; nAmt++;
        }
        if(cFuel && (volL || /^volume|litre/.test(cmp))) sawVol=true;
        // paiement par carte (« CB 31,26 », « CARTE BANCAIRE », « SANS CONTACT ») : une 2e source du total
        if(lv.length && /\bcb\b|\bcarte\b|visa|mastercard|sans\s*contact|\bemv\b/i.test(l) && !/esp[eè]ces|rendu|fid[eé]lit|cagnotte|points?\b|avantage/i.test(l)){ var cm=Math.max.apply(null, lv); if(cm>cardV) cardV=cm; }
        // tableau de TVA (« A 5,5% 42,15 € 2,32 € 44,47 € ») : ni un article, ni la fin des articles ; le plus grand montant de la ligne = TTC du taux
        if(nAmt>=2 && /^[^A-Za-zÀ-ÿ]*(?:[A-Za-z]\b[^A-Za-zÀ-ÿ\d]*)?\d{1,2}(?:[.,]\d{1,2})?\s*%/.test(l)){ if(lv.length>=3) tvaRows.push(Math.max.apply(null, lv)); return; }
        var isKey=(key.test(l) || cTot || cFuel) && !weightL;
        if(isKey && last && (totRe.test(l) || cTot || payRe.test(l))) afterTotal=true;   // après le total (ou le paiement, si le total est mal lu) : TVA, pied de ticket
        if(afterTotal || isSkip || isKey){ if(!afterTotal) pend=""; return; }   // une ligne de total, de paiement ou d'en-tête n'est jamais le nom de l'article suivant
        var lsrc=l;
        // pesée « 0,170 kg X 2,99EURO/kg » : le prix se calcule si la lecture l'a manqué (« 0,5 EUR A »)
        var wp=weightL && /(\d{1,3})[.,](\d{3})\s*k\s?g\s*[xX*×]\s*(\d{1,3})[.,](\d{2})/i.exec(l);
        if(wp){ var up=+(wp[3]+"."+wp[4]), wv=Math.round((+(wp[1]+"."+wp[2]))*up*100+1e-6)/100;
          if(wv>0 && (!last || (Math.abs(lastV-up)<0.005 && Math.abs(wv-up)>0.01))){ last=true; lastV=wv; neg=false; } }
        // prix d'article lu sans sa virgule ou avec une lettre : « 142 EUR » = 1,42 ; « A84 EUR » = 4,84
        var fx=!last && !weightL && /(?:^|\s)([0-9OoASB])([0-9OoASB]{2})\s*(?:E[LU]{1,2}A?R|EUR|€)/.exec(l);
        if(fx && /\d/.test(fx[1]+fx[2])){ lsrc=l.slice(0, fx.index); var dg=(fx[1]+fx[2]).replace(/[Oo]/g,"0").replace(/A/g,"4").replace(/S/g,"5").replace(/B/g,"8"); last=true; lastV=+(dg.charAt(0)+"."+dg.slice(1)); neg=false; }
        // article dont le prix n'a pas été lu (« *AIGUILLETTE POULET  EUR A ») : gardé, prix à remplir
        if(!last && !weightL && /(?:\bE[LU]{1,2}A?R|\bEUR|€)\s?[A-D]\s*$/.test(l)){ var lb=cleanLabel(l); pend="";
          if(lb.replace(/[^A-Za-zÀ-ÿ]/g,"").length>=3) lignes.push({ label:lb.slice(0,28), prix:"", produit:"", remise:false });
          return; }
        if(!last){ if(!weightL && !/^\s*p[tnu]\b/i.test(l) && /[A-Za-zÀ-ÿ]{3,}/.test(l)) pend=l; return; }   // sans prix : peut-être un article pesé
        var prix = lastV;
        if(!(prix>0)) return;
        // nom et prix sur deux lignes : « 2  GRILLE PERSIENNES D125 » puis « 3127600331284 17,90  35,80 V5 » (Brico Dépôt), « YAOURT NATURE » puis « 2 x 1,20  2,40 »…
        // une ligne de prix sans mot prend le nom de la ligne du dessus (qui n'avait pas de prix)
        var twoL=!weightL && !!pend && cleanLabel(lsrc).replace(/[^A-Za-zÀ-ÿ]/g,"").length<2;
        var qm=twoL ? /^\s*(\d{1,3})\s+(?=[A-Za-zÀ-ÿ])/.exec(pend) : null, qx=/(?:^|\s)(\d{1,3})\s*[xX*×]\s*\d/.exec(lsrc) || /^\s*(\d{1,3})\s?[xX×]\s+/.exec(lsrc);
        var qty=qm ? +qm[1] : (qx ? +qx[1] : 1); if(!(qty>=1 && qty<=99)) qty=1;
        if(qm) pend=pend.slice(qm[0].length);   // la quantité en tête du nom
        var label = cleanLabel((weightL || twoL) && pend ? pend : lsrc); pend="";
        if(label.replace(/[^A-Za-zÀ-ÿ]/g,"").length < 2) return;
        if(neg){ var pc=/^\s*-?(\d{1,2})\s*%/.exec(l); if(pc) label=label.replace(/^\d{1,2}\s+/, "-"+pc[1]+"% "); }
        lignes.push({ label: label.slice(0,28), prix: prix.toFixed(2).replace(".",","), produit:"", remise:neg });
        if(!neg){ nbLu+=qty; nLines++; }
      });
      var flagged = all.filter(function(a){ return a.tot || totRe.test(a.line); });
      var total = "";
      var paid = all.filter(function(a){ return a.pay; });   // total illisible : le montant payé
      if(flagged.length) total = Math.max.apply(null, flagged.map(function(a){return a.value;}));
      else if(paid.length) total = Math.max.apply(null, paid.map(function(a){return a.value;}));
      else if(all.length) total = Math.max.apply(null, all.map(function(a){return a.value;}));
      // retrait au distributeur, montant rond : « RETRAIT : 50 EUR »
      if(total===""){ lines.some(function(l){ var mi=/(?:retrait|montant|total|a payer|à payer|somme)\D{0,20}?(\d{1,5})\s*(?:eur\b|euros?\b|€)/i.exec(l); if(mi && !skip.test(l)){ total=+mi[1]; return true; } }); }
      // Date : la première date valide (jour/mois cohérents, pas dans le futur), de préférence avec l'année sur 4 chiffres
      // (« 16/1072026 » = « 16/10/2026 » dont le second « / » a été lu comme un 7)
      var date="", best=null, dm, today=todayISO(), dateFix=false;
      function isoAdd(iso, n){ var t=new Date(iso+"T12:00:00"); t.setDate(t.getDate()+n); return t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0")+"-"+String(t.getDate()).padStart(2,"0"); }
      var recent=isoAdd(today, -45);
      var dre=/\b(\d{1,2}) ?[\/.\-] ?(\d{1,2}) ?(?:[\/.\-]|[71lI|](?=20\d\d\b)) ?(\d{4}|\d{2})\b/g;
      var oldest=(function(){ var t=new Date(today+"T12:00:00"); t.setDate(t.getDate()-400); return t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0")+"-"+String(t.getDate()).padStart(2,"0"); })();
      while((dm=dre.exec(text))){
        var d=+dm[1], mo=+dm[2], y=dm[3].length===2?2000+(+dm[3]):+dm[3];
        if(d<1 || d>31 || mo<1 || mo>12) continue;
        var iso=y+"-"+(mo<10?"0":"")+mo+"-"+(d<10?"0":"")+d, fx=false;
        if(iso<recent){ var iso2=today.slice(0, 4)+iso.slice(4); if(iso2<=today && iso2>=recent){ iso=iso2; fx=true; } }   // ticket scanné juste après l'achat : l'année a été mal lue
        if(iso>today || iso<oldest) continue;
        if(!best || (dm[3].length===4 && best.n!==4) || (dm[3].length===best.n && iso>best.v)) best={ v:iso, n:dm[3].length, fx:fx };   // la plus récente
      }
      if(best){ date=best.v; dateFix=best.fx; }
      var marchand="";
      for(var i=0;i<lines.length;i++){ if(/[A-Za-zÀ-ÿ]{3,}/.test(lines[i]) && !skip.test(lines[i])){ marchand=lines[i].replace(/\s+/g," ").slice(0,32); break; } }
      marchand=matchMerchant(lines, marchand);
      var fuel=/\b(gazole|gasoil|diesel|sp\s?9[58](?:\s?-?\s?e\s?(?:5|10))?|sans\s*plomb|e\s?85|gpl|carburant|adblue)\b/i.exec(text);
      if((fuel || fuelT || sawVol) && !lignes.length && total>0) lignes.push({ label:(fuel ? fuel[1].toUpperCase().replace(/\s+/g," ") : "CARBURANT"), prix:total.toFixed(2).replace(".",","), produit:"" });
      var tvaT=0; tvaRows.forEach(function(v){ tvaT+=v; }); tvaT=Math.round(tvaT*100)/100;
      return { total: total, date: date, dateFix: dateFix, marchand: marchand, categorie: ticketCat(marchand, text, !!(fuel || sawVol)), lignes: lignes, carte: cardV||"", tva: tvaRows.length ? tvaT : "",
        esp: espV>0 ? Math.round((espV-renduV)*100)/100 : "", nbArt: nbArt||"", nbLu: nbLu, nLines: nLines };
    }


    function todayISO(){ var d=new Date(), m=d.getMonth()+1, j=d.getDate(); return d.getFullYear()+"-"+(m<10?"0":"")+m+"-"+(j<10?"0":"")+j; }
    function fmt(n){ n=Math.round((Number(n)||0)*100)/100; if(n===0) n=0; return n.toFixed(2).replace(".",",")+" "+curSym(); }
    function monthKey(iso){ return (iso||todayISO()).slice(0,7); }
    function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]; }); }
    // montant tapé : espaces (le clavier en ajoute après la virgule), symbole, virgule ou point, « 1 234,56 », « 1.234,56 »
    function num(x){
      if(typeof x==="number") return isFinite(x)?x:0;
      var t=String(x==null?"":x).replace(/[\s\u00a0\u202f'’]/g,"").replace(/[٫·]/g,",").replace(/[^0-9,.\-−]/g,"").replace(/−/g,"-");
      var c=t.lastIndexOf(","), d=t.lastIndexOf(".");
      if(c>=0 && d>=0){ if(c>d) t=t.replace(/\./g,"").replace(",","."); else t=t.replace(/,/g,""); }
      else if(c>=0){ t=(t.split(",").length>2)?t.replace(/,/g,""):t.replace(",","."); }
      else if(t.split(".").length>2){ t=t.replace(/\./g,""); }
      return parseFloat(t)||0;
    }

    var state = {
      entries: store.read("entries", []),
      view: "list", draft: null,
      offline: store.read("offlineReady", false) ? "ready" : "idle",
      busy: false, prog: 0, scanMsg: "", note: "", graphSel: null, graphView: "depenses", graphPeriod: "cur", graphDim: "fam", graphType: "donut", graphHide: {}, histCat: "", histMonth: null, artSel: null, prixActuel: "", solPrice: null, solLoading: false, solError: "", solTime: "", stockPrices: {}, stockLoading: {}, stockError: {}
    };
    function persist(){ entriesVer++; store.write("entries", state.entries); }

    var app = document.getElementById("app");
    var filein = document.getElementById("filein");
