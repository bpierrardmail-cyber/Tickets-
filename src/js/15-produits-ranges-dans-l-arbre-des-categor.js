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
