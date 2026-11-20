    // ---------- Geste / bouton retour d'Android ----------
    // Une entrée d'historique « garde » : le geste retour ferme d'abord la fenêtre ouverte,
    // puis revient à l'écran précédent, puis à l'accueil ; depuis l'accueil, un 2e geste quitte l'app.
    var backArmed=false, backExitAt=0;
    function armBack(){ if(backArmed) return; try{ history.pushState({tk:Date.now()}, ""); backArmed=true; }catch(e){} }
    // Une étape de retour : true = traitée dans la page, false = rien à faire (quitter)
    function backStep(){
      if(document.getElementById("lockscreen")) return true;
      if(document.querySelector(".drawer-ov")){ closeMenu(); return true; }
      var ovs=document.querySelectorAll(".sheet-overlay");
      if(ovs.length){ var top=ovs[ovs.length-1]; top.dispatchEvent(new MouseEvent("click", {bubbles:true})); if(top.parentNode) top.parentNode.removeChild(top); return true; }
      var lb=document.getElementById("lbclose"); if(lb){ lb.click(); return true; }
      var hb=document.getElementById("hback"); if(hb){ hb.click(); return true; }
      var home=fyMember()?fyFirstTab():"list";
      if(state.view!==home){ state.view=home; render(); window.scrollTo(0,0); return true; }
      if(Date.now()-backExitAt<2500) return false;
      backExitAt=Date.now(); uiToast("Refais le geste retour pour quitter"); return true;
    }
    // Appli Android : le geste appelle directement la page (l'historique n'est pas fiable avant le premier toucher)
    window.tkBack=function(){ try{ return backStep(); }catch(e){ return false; } };
    window.addEventListener("popstate", function(){
      backArmed=false;
      if(backStep()){ armBack(); return; }
      try{ history.back(); }catch(e){}
    });

    function personOptions(current){
      var ex=uniquePersons(); if(ex.indexOf("Commun")<0) ex.unshift("Commun");
      if(current && ex.indexOf(current)<0) ex.push(current);
      return ex.map(function(p){ return {v:p,l:p}; }).concat([{v:"__autre",l:"Autre personne…"}]);
    }
    function whoFields(current){
      return [
        {key:"who", label:"Pour qui", type:"select", value:current||"Commun", options:personOptions(current), help:"« Commun » = dépense partagée.",
          onChange:function(v,api){ api.show("whoNew", v==="__autre"); api.show("pay", v==="Commun"); api.show("rep", v==="Commun"); api.show("acct", !(v==="Commun" && api.get("pay")==="split")); if(!acctPick.touched) api.set("acct", acctDefKey(v==="__autre" ? "" : v)); }},
        {key:"whoNew", label:"Nom", hidden:true, placeholder:"Prénom"}
      ];
    }
    // Frais commun : payé en entier par un compte, ou chacun sa part (selon les parts du commun) depuis son compte
    function payFields(f){
      if(!uniquePersons().filter(function(x){ return x!==mePerson(); }).length && !(f && f.split)) return [];   // seul : rien à partager
      var who=f ? ((f.personne||"").trim()||"Commun") : "Commun";
      return [{ key:"pay", label:"Payé", type:"seg", value:(f && f.split)?"split":"one", hidden:who!=="Commun",
        options:[{v:"one",l:"Un compte, en entier"},{v:"split",l:"Chacun sa part"}],
        help:"En entier : retiré de « "+esc(((f && f.compte && acctByKey(f.compte)) || mainAcct() || {nom:"ton compte"}).nom)+" ». Chacun sa part : chacun paie sa part du commun (onglet Commun › Parts) depuis son propre compte.",
        onChange:function(v, api){ api.show("acct", v!=="split"); } }];
    }
    // Compte d'où part un frais par défaut : le compte principal pour un frais commun, le compte de la personne pour un frais perso
    function acctDefKey(who){ who=(who||"").trim()||"Commun"; var a=(who==="Commun") ? mainAcct() : (payAcctOf(who) || comptes.filter(function(c){ return c.payer===who; })[0] || null); return a ? a.key : ""; }
    // « Prélevé sur » : la liste des comptes, celui par défaut déjà choisi (il suit « Pour qui » tant qu'on n'y touche pas)
    var acctPick={ touched:false };
    function acctFields(cur, who){
      if(comptes.length<2) return [];
      acctPick={ touched:false };
      return [{ key:"acct", label:"Prélevé sur", type:"select", value:(cur && acctByKey(cur)) ? cur : acctDefKey(who),
        options:comptes.filter(function(a){ return a.key!=="__tickets"; }).map(function(a){ return {v:a.key, l:a.nom}; }),
        help:"Le compte d'où part ce frais.", onChange:function(){ acctPick.touched=true; } }];
    }
    // à l'enregistrement : le compte choisi, sauf s'il est celui par défaut (le frais suit alors le compte habituel de la personne)
    function acctPicked(r, who){ var k=r.acct||""; return (k && k!==acctDefKey(who)) ? k : ""; }
    function whoOf(r){ return (r.who==="__autre") ? ((r.whoNew||"").trim()||"Commun") : (r.who||"Commun"); }
    function epargneById(id){ return epargne.filter(function(c){ return String(c.id)===String(id); })[0]; }
    var SENS_OPTS=[{v:"in",l:"Entrée +"},{v:"out",l:"Sortie −"}];

    function openScanChooser(){
      if(fyMember() && (fyCfg.role==="view" || !fyTabEd("list"))){ uiToast("Lecture seule : tu ne peux pas ajouter de ticket"); return; }
      var manual=fyRole()==="edit" && !fyTabOn(fyCfg,"list");   // sans l'Accueil, la saisie à la main passe par ici
      var ov=document.createElement("div");
      ov.className="sheet-overlay";
      ov.innerHTML='<div class="sheet">'+
        '<div class="sheet-title">Ajouter un ticket</div>'+
        '<button class="btn primary" id="sc-cam" type="button">📷 Prendre une photo</button>'+
        '<button class="btn" id="sc-gal" type="button">🖼️ Choisir dans la galerie</button>'+
        (manual?'<button class="btn" id="sc-man" type="button">✏️ Saisir sans photo</button>':'')+
        '<button class="btn ghost" id="sc-cancel" type="button">Annuler</button>'+
        '</div>';
      document.body.appendChild(ov);
      function close(){ try{ document.body.removeChild(ov); }catch(e){} }
      ov.addEventListener("click", function(e){ if(e.target===ov) close(); });
      document.getElementById("sc-cam").onclick=function(){ close(); docScan(3, function(fs){ filein.onchange({ target:{ files:fs, value:"" } }); }, function(){ filein.setAttribute("capture","environment"); filein.click(); }); };
      document.getElementById("sc-gal").onclick=function(){ close(); filein.removeAttribute("capture"); filein.click(); };
      document.getElementById("sc-cancel").onclick=close;
      var scm=document.getElementById("sc-man"); if(scm) scm.onclick=function(){ close(); newDraft(); };
    }
    // Scanner de documents de Google (appli Android) : photo recadrée, redressée et contrastée avant la lecture ;
    // pas de scanner (navigateur, téléphone trop ancien, module pas encore téléchargé) : l'appareil photo, comme avant.
    function docScan(max, onFiles, fallback){
      var NP=capPlugin("TicketsNative"); if(!NP || typeof NP.scanDoc!=="function"){ fallback(); return; }
      NP.scanDoc({ pages:max }).then(function(r){
        var files=((r && r.images) || []).map(function(b, i){ var bin=atob(b), arr=new Uint8Array(bin.length); for(var k=0;k<bin.length;k++) arr[k]=bin.charCodeAt(k); return new File([arr], "scan-"+(i+1)+".jpg", { type:"image/jpeg" }); });
        if(files.length) onFiles(files);
      }).catch(function(e){ var m=String((e && (e.code || e.message)) || e || ""); if(/cancel|annul/i.test(m)) return;
        uiChoice("Scanner indisponible", "Le scanner de documents n'est pas disponible sur ce téléphone pour l'instant (il se télécharge avec les services Google la première fois).", [{ l:"Prendre une photo", primary:true, fn:fallback }, { l:"Annuler", fn:function(){} }]); });
    }
    var restorein = document.getElementById("restorein");

    var navEl=document.createElement("nav"); navEl.className="nav hidden"; navEl.id="nav";
    // Barre du bas (refonte du 05/11) : 5 onglets Accueil · Opérations · Budget · À venir · Foyer (+ Bourse dans la version Perso) et un seul « + ».
    var NAV_IC={ list:"M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z", compte:"M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01",
      depenses:"M12 3a9 9 0 1 0 9 9h-9zM15 3.5A9 9 0 0 1 20.5 9H15z", factures:"M4 5h16v16H4zM4 10h16M9 3v4M15 3v4",
      communes:"M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M17 3.5a4 4 0 0 1 0 7.5M22 21a7 7 0 0 0-4-6.3",
      bourse:"M3 17l6-6 4 4 8-8M15 7h6v6" };
    function navBtn(v, l){ return '<button class="navi" type="button" data-view="'+v+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+NAV_IC[v]+'"/></svg><span>'+l+'</span></button>'; }
    navEl.innerHTML=
      '<div class="navplusrow"><button id="navplus" class="navplus" type="button" aria-label="Ajouter"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button></div>'+
      '<div class="navtabs">'+navBtn("list","Accueil")+navBtn("compte","Opérations")+navBtn("depenses","Budget")+navBtn("factures","À venir")+navBtn("communes","Foyer")+(FEAT.bourse ? navBtn("bourse","Bourse") : "")+'</div>';
    document.body.appendChild(navEl);
    [].forEach.call(navEl.querySelectorAll(".navi"), function(b){
      b.onclick=function(){ var v=b.getAttribute("data-view"); if(v==="depenses") v=depView(); if(v==="compte" && !cptTabOn()) v="tickets"; if(v==="list"){ state.listSub=null; state.catFilter=null; } if(v==="analyse") state.histMonth=null; state.artFrom=null; if(v==="articles"){ state.artSel=null; state.artSub=null; } if(v==="analyse") state.anSub=null; if(v==="communes") state.comSub=null; if(v==="bourse") state.bSub=null; state.view=v; render(); window.scrollTo(0,0); };
    });
    document.getElementById("navplus").onclick=function(){ plusSheet(); };
    // « + » : tout ce qu'on peut ajouter, selon les droits (membre : onglet en modification)
    function plusOpts(){
      var M=fyMember(), L=[];
      var tk=!M || (fyCfg.role==="edit" && fyTabEd("list")), cpt=!M || (fyCfg.role==="edit" && fyTabEd("compte")), fr=!M || (fyCfg.role==="edit" && fyTabEd("communes"));
      if(tk){ L.push(["scan","📷","Scanner un ticket","le montant, le magasin et les articles sont lus"]); L.push(["gal","🖼️","Ticket depuis la galerie","une photo déjà prise"]); L.push(["man","✏️","Saisir une dépense","montant, magasin, catégorie"]); }
      if(cpt && comptes.some(function(a){ return a.key!=="__tickets"; })){ L.push(["vin","↙️","Virement reçu","salaire, remboursement…"]); L.push(["vout","↗️","Virement envoyé","vers l'épargne, quelqu'un…"]); }
      if(fr) L.push(["frais","🔁","Frais fixe","loyer, abonnement, crédit…"]);
      if(impCan()) L.push(["imp","📄","Importer un relevé","OFX, QIF ou CSV de ta banque"]);
      return L;
    }
    function plusSheet(){
      var L=plusOpts(); if(!L.length){ uiToast("Lecture seule : rien à ajouter ici"); return; }
      var h='<div class="sheet-title">Ajouter</div><div class="dr-grp" style="margin-top:6px">'+L.map(function(x){ return '<button type="button" class="dr-row tall" data-k="'+x[0]+'"><span class="ic">'+x[1]+'</span><span class="t">'+esc(x[2])+'<small>'+esc(x[3])+'</small></span></button>'; }).join("")+'</div>'+
        '<div class="ui-stack" style="margin-top:12px"><button type="button" class="btn ghost ui-no">Fermer</button></div>';
      var sh=uiSheet(h); sh.q(".ui-no").onclick=sh.close;
      [].forEach.call(sh.qa(".dr-row"), function(b){ b.onclick=function(){ var k=b.getAttribute("data-k"); sh.close(); plusDo(k); }; });
    }
    function plusDo(k){
        if(k==="scan") docScan(3, function(fs){ filein.onchange({ target:{ files:fs, value:"" } }); }, function(){ filein.setAttribute("capture","environment"); filein.click(); });
        else if(k==="gal"){ filein.removeAttribute("capture"); filein.click(); }
        else if(k==="man"){ var onC=(state.view==="compte" && !state.cptPage), ck=onC ? curAcctKey() : null, ac=ck ? acctByKey(ck) : null;
          newDraft(); if(ac && ck!=="__tickets"){ state.draft.compte=ck; if(ac.payer) state.draft.payePar=ac.payer; render(); } }   // depuis Opérations : sur le compte affiché
        else if(k==="vin" || k==="vout"){ if(state.view!=="compte"){ state.view="compte"; state.cptPage=null; render(); } addVirement(k==="vin" ? "in" : "out"); }
        else if(k==="frais") addFraisCommun();
        else if(k==="imp") impStart(null);
    }
    // Premier démarrage, étape 3 : « Remplis ton appli en une minute » (après le prénom et la monnaie)
    function startFillSheet(){
      var L=[["imp","📄","Importer mon relevé","le plus rapide : tes derniers mois d'un coup (OFX, QIF ou CSV, depuis l'appli de ta banque : Partager › "+APP_NAME+")"],
        ["scan","📷","Scanner un ticket","le montant, le magasin et les articles sont lus"],
        ["frais","🔁","Ajouter mes frais fixes","loyer, abonnements, crédits : ce qui revient chaque mois"]];
      var h='<div class="sheet-title">Remplis ton appli en une minute</div><div class="muted" style="font-size:13px;margin:-4px 2px 10px">Choisis par où commencer. Tu pourras tout faire ensuite avec le bouton vert ＋.</div><div class="dr-grp">'+
        L.map(function(x){ return '<button type="button" class="dr-row tall" data-k="'+x[0]+'"><span class="ic">'+x[1]+'</span><span class="t">'+esc(x[2])+'<small>'+esc(x[3])+'</small></span></button>'; }).join("")+'</div>'+
        '<div class="ui-stack" style="margin-top:12px"><button type="button" class="btn ghost ui-no">Plus tard</button></div>';
      var sh=uiSheet(h); sh.q(".ui-no").onclick=sh.close;
      [].forEach.call(sh.qa(".dr-row"), function(b){ b.onclick=function(){ var k=b.getAttribute("data-k"); sh.close(); plusDo(k); }; });
    }
    function setNav(active, show){
      var raw=active;
      if(active==="articles" || active==="analyse") active="depenses";   // Budget = Budgets · Analyse · Produits
      if(active==="tickets") active="compte";   // Opérations = Opérations · Tickets · Épargne · Graphiques (refonte, étape 3)
      var plusHere = (raw==="list" || raw==="tickets" || raw==="compte") && plusOpts().length>0;   // « + » sur l'Accueil et Opérations seulement (05/11), s'il y a quelque chose à ajouter
      navEl.className = "nav" + (show ? "" : " hidden") + (plusHere ? "" : " noplus");
      [].forEach.call(navEl.querySelectorAll(".navi"), function(b){
        if(b.getAttribute("data-view")===active) b.classList.add("on"); else b.classList.remove("on");
      });
      fyNavFilter();
    }

    var VIEW_TITLES={ sauvaide:"Tes sauvegardes", drive:"Sauvegarde Drive", driverest:"Restaurer", import:"Import", avancee:"Analyse avancée", list:"Accueil", form:"Ticket", articles:"Articles", produits:"Articles & catégories", graph:"Analyse", history:"Analyse", analyse:"Analyse", month:"Analyse", artDetail:"Articles", communes:"Foyer", compte:"Opérations", bourse:"Bourse", gallery:"Galerie", photo:"Photo", patrimoine:"Patrimoine", provisions:"Provisions", bilan:"Bilan", foyer:"Foyer partagé" };
    function capFirst(t){ t=String(t||""); return t.charAt(0).toUpperCase()+t.slice(1); }
    // Onglet Dépenses : Tickets (vue « tickets ») · Produits et Budgets (vue « articles ») · Analyse (vue « analyse »)
    // Foyer : Produits et Budgets suivent les droits de l'ancien onglet Articles, Analyse ceux d'Analyse ; Tickets est toujours là.
    // Refonte, étape 3 : Budget = Budgets · Analyse · Produits ; les Tickets sont dans Opérations (cptSubsHTML).
    function depSubs(){ var m=fyMember() ? fyCfg : null, out=[], art=!m || fyTabOn(m, "articles");
      if(art) out.push(["budgets","Budgets"]);
      if(!m || fyTabOn(m, "analyse")) out.push(["analyse","Analyse"]);
      if(art) out.push(["produits","Articles"]);
      return out; }
    function depView(){ var s=state.depSub||"budgets"; if(s==="tickets" || !depSubs().some(function(x){ return x[0]===s; })) s=(depSubs()[0]||["tickets"])[0]; state.depSub=s;
      if(s==="analyse"){ state.histMonth=null; state.anSub=null; return "analyse"; } if(s==="tickets"){ state.catFilter=null; return "tickets"; } state.artSel=null; state.artSub=null; return "articles"; }
    function depCur(){ return state.view==="analyse" ? "analyse" : (state.depSub==="produits" ? "produits" : (state.depSub==="budgets" ? "budgets" : "produits")); }
    // Opérations : sous-onglets ; un membre sans l'onglet Compte n'a que Tickets
    function cptTabOn(){ return !fyMember() || fyTabOn(fyCfg, "compte"); }
    function cptSubsHTML(page){ var L=cptTabOn() ? [["","Opérations"],["tk","Tickets"],["ep","Épargne"],["graph","Graphiques"]] : [["tk","Tickets"]];
      if(L.length<2) return '';
      return '<div class="avtabs" role="tablist">'+L.map(function(x){ var on=(x[0]||null)===page; return '<button type="button" role="tab" class="cpsub'+(on?' on':'')+'" aria-selected="'+on+'" data-cp="'+x[0]+'">'+x[1]+'</button>'; }).join("")+'</div>'; }
    function cptSubGo(k){ if(k==="tk"){ state.view="tickets"; state.depSub="tickets"; state.catFilter=null; render(); window.scrollTo(0,0); return; }
      state.cptPage=k||null; state.view="compte"; render(); window.scrollTo(0,0); }
    function wireCptSubs(){ [].forEach.call(document.querySelectorAll(".avtabs .cpsub"), function(b){ b.onclick=function(){ cptSubGo(b.getAttribute("data-cp")||null); }; }); }
    function depTabsHTML(){ var cur=depCur();
      return '<div class="avtabs" role="tablist">'+depSubs().map(function(x){ var on=x[0]===cur; return '<button type="button" role="tab" class="dpsub'+(on?' on':'')+'" aria-selected="'+on+'" data-dp="'+x[0]+'">'+x[1]+'</button>'; }).join("")+'</div>'; }
    function wireDepTabs(){ [].forEach.call(document.querySelectorAll(".avtabs .dpsub"), function(b){ b.onclick=function(){ state.depSub=b.getAttribute("data-dp"); state.view=depView(); state.artFrom=null; render(); window.scrollTo(0,0); }; }); }
    function header(back, title){
      var b = back ? '<button class="hback" id="hback" type="button" aria-label="Retour">‹</button>' : '';
      var lb=store.read("lastBackup", null), bkOld=!fyMember() && (!lb || (Date.now()-new Date(lb).getTime())>=7*86400000);
      b='<div class="hleft"><button class="hmenu" id="hmenu" type="button" aria-label="Menu"><span></span>'+(bkOld?'<i class="hdot"></i>':'')+'</button>'+b+'</div>';
      var pp=DEMO ? '<button type="button" class="perso-pill demo-pill" id="demoPill">🎭 Démo · Quitter</button>' : (persoOn() ? '<button type="button" class="perso-pill" id="persoPill">🔒 Mes comptes · privé</button>' : '');
      return '<header class="head'+(back?' hasback':'')+(pp?' hasperso':'')+'">'+b+'<div class="htitle">'+esc(title||VIEW_TITLES[state.view]||""+APP_NAME+"")+'</div>'+pp+'</header>';
    }
    // Rangée d'actions au-dessus du graphique : [[id, libellé], …]
    function tabTools(list){ return '<div class="com-tools">'+list.map(function(x){ return '<button type="button" class="ap-tool com-add" id="'+x[0]+'">'+x[1]+'</button>'; }).join("")+'</div>'; }
    function bindBack(fn){ var hb=document.getElementById("hback"); if(hb) hb.onclick=function(){ var m=state.fromMenu; if(m && state.view===m.v){ state.fromMenu=null; openMenu(m.sub); return; } fn(); }; }

    var fyRendering=false;
