    // ---------- Graphiques plein écran ----------
    // Commun, Articles, Analyse, Bourse (page principale) : la carte du haut remplit l'écran ; CHB = hauteur ajoutée aux graphiques
    var CHB=0, fitMemo={}, fitting=0;
    function fitView(){ var v=state.view;
      if(v==="communes") return !state.comSub; if(v==="articles") return !state.artSub; if(v==="analyse") return !state.anSub; if(v==="bourse") return !state.bSub; if(v==="compte") return comptes.length>1 && (state.compteSel||store.read("compteSel", null))==="__all"; if(v==="comptedet") return state.cptPage==="graph"; return false; }
    function fitHero(){
      var hero=document.querySelector(".thero"); if(!fitView() || !hero){ CHB=0; app.style.paddingBottom=""; return; }
      var nav=document.getElementById("nav"), navH=(nav && nav.offsetHeight)||0;
      // la carte + les lignes du dessous (Frais fixes, Par famille, Mes comptes…) tiennent ensemble dans l'écran
      // la page s'arrête juste au-dessus du menu : plus rien à faire défiler
      app.style.paddingBottom=(navH+12)+"px";
      var hr=hero.getBoundingClientRect(), last=app.lastElementChild, after=last ? Math.max(0, last.getBoundingClientRect().bottom-hr.bottom) : 0;
      var top=hr.top+(window.scrollY||0), target=Math.floor(window.innerHeight-navH-top-after-12);
      if(target<200) target=200;
      // mesure faite avec la mise en page finale (colonne flexible : les marges ne se chevauchent plus), sinon il manque quelques pixels
      hero.classList.add("fit"); hero.style.setProperty("--chb", CHB+"px");
      // le graphique n'est jamais réduit sous sa hauteur normale (CHB ≥ 0) : s'il manque de place, c'est la page qui défile
      var diff=target-hero.offsetHeight, nb=Math.max(0, Math.min(420, CHB+diff));
      if(fitting<5 && Math.abs(nb-CHB)>1){ fitting++; CHB=nb; fitMemo[v0key()]=nb; try{ render(); }finally{ fitting--; } return; }
      hero=document.querySelector(".thero");
      if(hero && hero.offsetHeight>target+1){ hero.style.height=""; return; }   // pas la place : carte entière, la page défile
      if(hero){ hero.classList.add("fit"); hero.style.setProperty("--chb", CHB+"px"); hero.style.height=target+"px";
        // 1 à 3 px de trop (arrondis) : on bloque le défilement interne, sinon le graphique « bouge » au toucher
        [].forEach.call(hero.children, function(x){ if(x.classList.contains("cch")) fitDonut(x); });
        [].forEach.call(hero.children, function(x){ if((x.classList.contains("cch") || x.classList.contains("bsl")) && x.scrollHeight-x.clientHeight<=3) x.style.overflowY="hidden"; });
        fitMore(hero); }
      // polices chargées après coup : les textes changent un peu de taille, on refait le calcul une fois
      if(!fitFontsHooked && document.fonts && document.fonts.ready){ fitFontsHooked=true; document.fonts.ready.then(function(){ if(fitView() && !document.querySelector(".sheet-overlay")){ fitMemo={}; render(); } }); }
    }
    var fitFontsHooked=false;
    // Camembert qui dépasse : légende resserrée puis anneau plus petit, pour qu'il tienne entièrement dans la carte
    function fitDonut(c){
      function ov(){ return c.scrollHeight-c.clientHeight; }
      var cd=c.querySelector(".cdon-big"); if(!cd || ov()<=3) return;
      cd.classList.add("tight"); if(ov()<=3) return;
      var sv=cd.querySelector("svg"), lg=cd.querySelector(".cdon-l"); if(!sv) return;
      function size(n){ sv.style.flexBasis=n+"px"; sv.style.width=n+"px"; sv.style.height=n+"px"; }
      var sH=sv.getBoundingClientRect().height;
      size(Math.max(100, sH-ov())); if(ov()<=3 || !lg) return;   // 1) anneau un peu plus petit
      // 2) les plus petites lignes de la légende regroupées en « + N autres »
      var rows=[].slice.call(lg.querySelectorAll(".cdon-r")), hid=0, more=document.createElement("div");
      more.className="cdon-r cdon-more"; more.style.color="var(--muted)"; lg.appendChild(more);
      while(ov()>3 && rows.length-hid>3){ hid++; rows[rows.length-hid].style.display="none"; more.textContent="+ "+hid+" autre"+(hid>1?"s":"")+" · touche l'anneau"; }
      if(!hid) lg.removeChild(more);
      // 3) en dernier recours, anneau encore plus petit
      if(ov()>3) size(Math.max(64, sv.getBoundingClientRect().height-ov()));
    }
    // Graphique trop long pour la carte : fondu en bas + « ⌄ Voir la suite » tant qu'il reste quelque chose plus bas
    function fitMore(hero){
      var c=null; [].forEach.call(hero.children, function(x){ if(x.classList.contains("cch")) c=x; }); if(!c) return;
      var hint=document.createElement("button"); hint.type="button"; hint.className="cch-hint"; hint.textContent="⌄ Voir la suite";
      c.parentNode.insertBefore(hint, c.nextSibling);
      function upd(){ hero.classList.toggle("cmore", c.scrollHeight-c.scrollTop-c.clientHeight>4); }
      c.addEventListener("scroll", upd, { passive:true });
      hint.onclick=function(ev){ ev.stopPropagation(); try{ c.scrollBy({ top:Math.round(c.clientHeight*.7), behavior:"smooth" }); }catch(e){ c.scrollTop+=Math.round(c.clientHeight*.7); } };
      upd();
    }
    (function(){ var t=null, w0=window.innerWidth, h0=window.innerHeight;
      window.addEventListener("resize", function(){ clearTimeout(t); t=setTimeout(function(){
        var w=window.innerWidth, h=window.innerHeight, a=document.activeElement, typing=a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
        if(w===w0 && Math.abs(h-h0)<4) return; if(typing && w===w0) return; w0=w; h0=h;
        (function redo(){ if(!fitView()) return; if(document.querySelector(".sheet-overlay")){ t=setTimeout(redo, 400); return; } fitMemo={}; render(); })(); }, 200); });
    })();
    function v0key(){ var on=document.querySelector(".thero .cch-tabs button.on"); return state.view+"|"+(on?on.getAttribute("data-m"):""); }
    document.addEventListener("click", function(ev){ var t=ev.target; if(t && t.id==="persoPill"){ ev.preventDefault(); espaceAsk(); } if(t && t.id==="demoPill"){ ev.preventDefault(); demoMenu(); } });
    function render(){ calcMemo=null; try{ document.body.classList.toggle("det", affDet()); }catch(err){} pvMemo=null; fsMemo={}; pvWanted=false; avMemo=null; setTimeout(function(){ try{ wireTicketLongPress(); }catch(err){} }, 0); pvLockMe=false; if(!fitting) CHB=fitView()?(fitMemo[state.view+"|"+(state.view==="communes"?(state.comChart||store.read("comChartDef","rep")):state.view==="articles"?(state.artChart||store.read("artChartDef","prod")):state.view==="analyse"?(state.anChart||store.read("anChartDef","mois")):(state.view==="compte"||state.view==="comptedet")?(function(){ var c=state.cptChart||store.read("cptChartDef","mois"); return c==="6m"?"es":c; })():"")]||0):0; fyRendering=true; try{ renderView(); }finally{ fyRendering=false; } try{ compactRowActions(); fyRoStrip(); wirePV(); }catch(err){ console.warn(err); } try{ wirePagers(app); }catch(err){ console.warn(err); } pushWidgets(); try{ fitHero(); }catch(err){ console.warn(err); } try{ fitTexts(); }catch(err){ console.warn(err); } }
    function renderView(){
      armBack();
      fyViewGuard();
      syncBourseEpargne();
      try{ provFraisSync(); }catch(err){}
      try{ virRecSync(); }catch(err){}
      try{ virLinkSync(); }catch(err){}
      try{ rapSync(false); }catch(err){}
      if(state.view==="foyer") return renderFoyer();
      if(state.view==="form") return renderForm();
      if(state.view==="articles") return renderArticles();
      if(state.view==="tickets") return renderList();
      if(state.view==="produits") return renderProduits();
      if(state.view==="graph" || state.view==="history") state.view="analyse";
      if(state.view==="analyse") return renderAnalyse();
      if(state.view==="month") return renderMonth();
      if(state.view==="artDetail") return renderArtDetail();
      if(state.view==="communes") return renderCommunes();
      if(state.view==="compte" || state.view==="comptedet") return renderCompte();
      if(state.view==="import") return renderImport();
      if(state.view==="bourse"){ if(!FEAT.bourse){ state.view="list"; return renderList(); } return renderBourse(); }
      if(state.view==="gallery") return renderGallery();
      if(state.view==="photo") return renderPhoto();
      if(state.view==="menu") return renderMenu();
      if(state.view==="gerer") return renderGerer();
      if(state.view==="mkpage") return renderMkpage();
      if(state.view==="stockage") return renderStockage();
      if(state.view==="banc") return renderBanc();
      if(state.view==="drive") return renderDrive();
      if(state.view==="sauvaide") return renderSauvAide();
      if(state.view==="driverest") return renderDriveRest();
      if(state.view==="aide") return renderAide();
      if(state.view==="groupe") return renderGroupe();
      if(state.view==="corbeille") return renderCorbeille();
      if(state.view==="patrimoine") return renderPatrimoine();
      if(state.view==="provisions"){ state.view="factures"; state.avnSub="prov"; }   // la page Provisions est dans À venir
      if(state.view==="factures") return renderFactures();
      if(state.view==="factlue") return renderFactLue();
      if(state.view==="factserie") return renderFactSerie();
      if(state.view==="provdet") return renderProvDet();
      if(state.view==="avancee") return renderAvancee();
      if(state.view==="bilan") return renderBilan();
      return renderList();
    }

    function hexA(h,a){ var n=parseInt(h.slice(1),16); return "rgba("+((n>>16)&255)+","+((n>>8)&255)+","+(n&255)+","+a+")"; }
    function catIcon(cat){
      var CM={ "courses":{e:"🛒",col:"#4fd6a0"}, "sorties":{e:"🍽️",col:"#f4796b"}, "transport":{e:"🚗",col:"#f2a65a"}, "maison":{e:"🏠",col:"#c9a27a"}, "santé":{e:"💊",col:"#5cc8e6"},
        "loisirs":{e:"🎬",col:"#8b9cff"}, "shopping":{e:"🛍️",col:"#e88fc7"}, "enfants":{e:"🧸",col:"#f2c76b"}, "animaux":{e:"🐾",col:"#9bd35e"}, "autre":{e:"🧾",col:"#9aa1b2"} };
      var c=(cat||"").toLowerCase();
      if(CM[c]) return CM[c];
      function m(){ for(var i=0;i<arguments.length;i++){ if(c.indexOf(arguments[i])>=0) return true; } return false; }
      if(m("aliment","course","super","market","épicerie","epicerie","boulang","lidl","leclerc","carrefour","intermarch","auchan","casino")) return {e:"🛒",col:"#4fd6a0"};
      if(m("carbur","essence","station","gazole","diesel","fuel","total energ")) return {e:"⛽",col:"#f4796b"};
      if(m("brico","outil","quincaill","matériaux","materiaux","castorama","leroy","plomb")) return {e:"🔧",col:"#7c9cf4"};
      if(m("resto","restaur"," bar","café","cafe","pizz","mcdo","kebab","boisson")) return {e:"🍽️",col:"#e0a458"};
      if(m("pharma","santé","sante","médec","medec","docteur","hôpital","hopital","mutuelle")) return {e:"💊",col:"#e88fb0"};
      if(m("transp","train","sncf","péage","peage","autorout"," bus","métro","metro","parking")) return {e:"🚗",col:"#5bc0d4"};
      if(m("élect","elect","edf","énergie","energie","gaz")) return {e:"⚡",col:"#e0a458"};
      if(m("eau","veolia","saur","sivom")) return {e:"💧",col:"#5bc0d4"};
      if(m("vêt","vet","habill","chauss","textile")) return {e:"👕",col:"#c78bd6"};
      if(m("loisir","ciné","cine","jeu","sport","spotify","netflix","abonnement")) return {e:"🎬",col:"#c78bd6"};
      if(m("tél","tel","internet","mobile","forfait","orange","sfr","free","bouygues")) return {e:"📱",col:"#7c9cf4"};
      if(m("jardin","plante","graine","végét","veget","semence")) return {e:"🌱",col:"#9bd35e"};
      if(m("maison","déco","deco","meuble","ikea","ameublement")) return {e:"🏠",col:"#6fcaa8"};
      if(m("anim","véto","veto","chien","chat")) return {e:"🐾",col:"#d4a05b"};
      if(CAT_PARENT && CAT_PARENT[cat] && CAT_PARENT[cat]!==cat) return catIcon(CAT_PARENT[cat]);
      return {e:"🧾",col:"#9298a5"};
    }
