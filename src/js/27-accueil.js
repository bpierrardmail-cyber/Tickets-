    // ---------- Accueil ----------
    // Le tableau de bord (graphiques au choix) est retiré le 09/11 : l'Accueil est le Résumé. homeMonthNav sert encore à Foyer.
    function homeMonthNav(month, curM, label){
      if(window.innerWidth<400 && /^\d{4}-\d{2}$/.test(month||"")){ var mp=month.split("-"); label=new Date(+mp[0], +mp[1]-1, 1).toLocaleDateString("fr-FR",{month:"short", year:"numeric"}); }   // « oct. 2026 » : le mois entier ne tient pas
      return '<div class="hmn"><button type="button" id="mn-prev" class="hmn-a" aria-label="Mois précédent">‹</button><b>'+esc(capFirst(label))+'</b><button type="button" id="mn-next" class="hmn-a" aria-label="Mois suivant">›</button>'+
        (month!==curM?'<button type="button" id="mn-today" class="hmn-a hmn-t" aria-label="Revenir au mois en cours">↩</button>':'')+'</div>';
    }
    // Tableau de bord : tout tient dans l'écran, sans défilement. Les petites cartes prennent la place qui reste au-dessus du « + » ;
    // si elle manque, leurs chiffres du bas sont retirés puis le graphique est coupé (jamais sous 130 px : un très petit écran défile).
    // Textes qui doivent rester entiers (montants, titres, onglets, mois, tuiles) : la police rapetisse jusqu'à tenir ; un montant passe à la ligne plutôt que d'être coupé
    var FIT_SEL=".hstat b, .hstat span, .hstat small, .dash-split.h3 span b, .head .htitle, .avtabs button, .hmn b, .chips.cattiles.cat5 .chip span:last-child, .acsel span, .hm-s, .ep-cases span, .epc span";
    function fitOver(el){   // le texte dépasse-t-il sa place (marges intérieures comprises) ?
      var cs=getComputedStyle(el), av=el.clientWidth-(parseFloat(cs.paddingLeft)||0)-(parseFloat(cs.paddingRight)||0);
      if(el.scrollWidth>el.clientWidth) return true;
      if(el.children.length) return false;   // texte seul : mesuré à la police (un texte terminé par « … » ne dit pas sa vraie largeur)
      var cv=fitOver.cv||(fitOver.cv=document.createElement("canvas")), cx=cv.getContext("2d");
      cx.font=cs.fontStyle+" "+cs.fontWeight+" "+cs.fontSize+" "+cs.fontFamily;
      var ls=parseFloat(cs.letterSpacing)||0, t=el.textContent||"";
      return cx.measureText(t).width+ls*t.length>av-1;   // un peu de marge : mieux vaut un demi-point plus petit qu’un « … »
    }
    function fitTexts(){
      [].forEach.call(document.querySelectorAll(FIT_SEL), function(el){
        el.style.fontSize=""; el.style.whiteSpace=""; el.style.textOverflow="";
        if(!(el.clientWidth>0) || !fitOver(el)) return;
        var fs=parseFloat(getComputedStyle(el).fontSize)||14, min=Math.max(9.5, fs*0.7), g=0;
        while(fitOver(el) && fs>min && g++<20){ fs-=0.5; el.style.fontSize=fs+"px"; }
        if(fitOver(el) && el.matches(".hstat b, .hstat span, .hstat small, .dash-split.h3 span b, .hm-s")){ el.style.whiteSpace="normal"; el.style.textOverflow="clip"; }   // libellé ou montant : sur deux lignes plutôt que coupé
      });
    }
    function homeMode(){ return "resume"; }
    function homeModeHTML(){ return ""; }
    function rsMoisFin(m){ var p=m.split("-"), d=new Date(+p[0], +p[1], 0); return d.getDate()+" "+d.toLocaleDateString("fr-FR",{month:"long"}); }
    function rsDebt(m, me){   // « Marie te doit 153 € » (✦ équilibre) : la ligne qui concerne « me », sinon null
      if(!canUse("equilibre") || !(personnes||[]).length) return null;
      var B=null; try{ B=commBal(m); }catch(e){ return null; }
      var t=(B.T||[]).filter(function(x){ return x.from===me || x.to===me; })[0];
      if(!t) return (B.T||[]).length ? null : { txt:"Vous êtes quittes", ok:true };
      return { txt:t.from===me ? "Tu dois "+fmtS(t.v)+" à "+t.to : t.from+" te doit "+fmtS(t.v), ok:false };
    }
    function rsAlerts(m, me, fin){
      var A=[], today=todayISO(), td=+today.slice(8,10);
      if(fin!=null && fin<-0.5) A.push({ c:"bad", i:"!", t:"Découvert prévu", s:"Fin de mois à "+fmtS(fin)+" sur ton compte", go:"compte" });
      var spent={}; state.entries.forEach(function(e){ if(monthKey(e.date)===m && (!fyMember() || payerOf(e)===me)) spent[e.categorie]=(spent[e.categorie]||0)+(Number(e.montant)||0); });
      var B=fyMember() ? ((budgetsP||{})[me]||{}) : (budgets||{}); spent=catRoll(spent);   // une grande catégorie compte ses sous-catégories
      Object.keys(B).forEach(function(c){ var b=Number(B[c])||0, v=spent[c]||0; if(b<=0) return; var r=v/b;
        if(r>1) A.push({ c:"bad", i:"!", t:c+" : budget dépassé", s:fmtS(v)+" sur "+fmtS(b)+" ce mois-ci", go:"budget", r:r });
        else if(r>=0.8) A.push({ c:"warn", i:"!", t:c+" : "+Math.round(r*100)+" % du budget", s:"reste "+fmtS(b-v)+" ce mois-ci", go:"budget", r:r }); });
      factSoon().forEach(function(x){ if(x.m!==m || !x.d || x.d<td || x.d>td+3) return; if(fyMember() && (x.f.personne||"")!=="Commun") return;
        var j=x.d-td; A.push({ c:"warn", i:"⏱", t:(j===0?"Aujourd'hui":(j===1?"Demain":"Dans "+j+" jours"))+" : "+(x.f.label||"Frais fixe"), s:fmtS(x.v)+(x.f.aPayer?" · à payer toi-même":" · prélèvement"), go:"factures" }); });
      return A.slice(0, 3);
    }
    function rsAlertsHTML(A){ return A.map(function(a){ return '<button type="button" class="rs-al '+a.c+'" data-rs="'+a.go+'"><span class="ic">'+esc(a.i)+'</span><span><b>'+esc(a.t)+'</b><small>'+esc(a.s)+'</small></span></button>'; }).join(""); }
    function rsOwnerHTML(m, me){
      var a=myAcct(), h='', F=null, O={ done:[], todo:[] };
      try{ F=acctFigures(a.key, m); O=cptOps(a.key, m); }catch(e){}
      var inS=0, outS=0, todoOut=0, nTodo=0;
      O.done.forEach(function(x){ if(x.a>0) inS+=x.a; else outS-=x.a; });
      O.todo.forEach(function(x){ if(x.a<0){ todoOut-=x.a; nTodo++; } });
      var fin=F ? F.fin : 0, pct=inS>0 ? Math.min(100, Math.round(outS/inS*100)) : 0;
      h+='<section class="rs-hero'+(fin<-0.5?' neg':'')+'"><span class="l">'+(fin<-0.5?'Il te manquera':'Il te reste')+'</span><span class="v">'+esc(fmtS(Math.abs(fin)))+'</span>'+
        '<span class="s">jusqu\'au '+esc(rsMoisFin(m))+' sur '+esc(a.nom||"ton compte")+(nTodo ? ', après '+nTodo+' prélèvement'+(nTodo>1?'s':'')+' à venir ('+esc(fmtS(todoOut))+')' : ', rien d\'autre de prévu ce mois-ci')+'</span>'+
        (inS>0 ? '<div class="rs-bar"><i style="width:'+pct+'%"></i></div><div class="rs-barl"><span>'+esc(fmtS(outS))+' dépensés</span><span>sur '+esc(fmtS(inS))+' reçus</span></div>' : '')+'</section>';
      h+=rsAlertsHTML(rsAlerts(m, me, fin));
      var L=O.done.slice().sort(function(x,y){ return (y.d-x.d) || (x.k==="t" ? -1 : 1); }).slice(0, 5);
      h+='<div class="rs-h">Dernières opérations<button type="button" data-rs="compte">Tout voir</button></div>';
      if(!L.length) h+='<div class="rs-list"><div class="muted" style="padding:14px 0;font-size:13px">Rien encore ce mois-ci. Touche ＋ pour scanner un ticket ou importer ton relevé.</div></div>';
      else h+='<div class="rs-list">'+L.map(function(x){ return '<button type="button" class="rs-row" data-rs="'+(x.k==="t"?"t":"compte")+'" data-id="'+esc(x.id)+'"><span class="n">'+esc(x.n)+'<small>'+(x.d?x.d+'/'+m.slice(5,7)+' · ':'')+esc(x.s)+'</small></span><span class="a" style="color:'+(x.a>0?'var(--accent)':'var(--ink)')+'">'+(x.a>0?'+ ':'− ')+esc(fmtS(Math.abs(x.a)))+'</span></button>'; }).join("")+'</div>';
      if((personnes||[]).filter(function(p){ return !p.archived; }).length){
        var dbt=rsDebt(m, me), sh=0; try{ var CB=commMonthBal(m); sh=(CB.P[me]||{}).share||0; }catch(e){}
        h+='<button type="button" class="rs-al ok" data-rs="communes"><span class="ic">≡</span><span><b>Foyer'+(dbt ? ' · '+esc(dbt.txt) : '')+'</b><small>Ta part du commun en '+esc(monthLabelOf(m).split(" ")[0])+' : '+esc(fmtS(sh))+'</small></span></button>';
      }
      return h;
    }
    // Accueil d'un membre (09/11, maquette « Accueil membre ») : sa part du commun (ou ses tickets s'il n'a pas de part), qui doit quoi,
    // cases Mon compte · Fin du mois · Mes tickets (selon ses droits), alertes, prochaines dépenses communes avec sa part, ses derniers tickets
    function rsMemberHTML(m, me){
      var h='', CB=null, mn=monthLabelOf(m).split(" ")[0], today=todayISO(), dNow=(m===monthKey(today)) ? +today.slice(8,10) : 0;
      var comOn=!fyCfg || fyTabOn(fyCfg, "communes"); if(comOn){ try{ CB=commMonthBal(m); }catch(e){} }
      var sh=CB && CB.P[me] ? CB.P[me].share : 0, tot=CB ? CB.tot : 0, pct=0; try{ pct=Number((communParts||{})[me])||0; }catch(e){}
      var FC=comOn ? fraisCommuns.filter(function(f){ return (f.personne||"")==="Commun" && fraisActif(f, m); }) : [];
      var hasPart=comOn && (sh>0.004 || (pct>0 && FC.length>0));
      var mine=state.entries.filter(function(e){ return monthKey(e.date)===m && payerOf(e)===me; }), mt=mine.reduce(function(t,e){ return t+(Number(e.montant)||0); }, 0);
      var pm=prevMonthKey(m), pt=state.entries.filter(function(e){ return monthKey(e.date)===pm && payerOf(e)===me; }).reduce(function(t,e){ return t+(Number(e.montant)||0); }, 0);
      if(hasPart){
        var nDone=FC.filter(function(f){ return fraisDone(f, m); }).length;
        h+='<section class="rs-hero" data-rs="communes"><span class="l">Ta part du commun · '+esc(mn)+'</span><span class="v">'+esc(fmtS(sh))+'</span><span class="s">sur '+esc(fmtS(tot))+' de dépenses communes'+(FC.length?' · '+nDone+' sur '+FC.length+' déjà payée'+(nDone>1?'s':''):'')+'</span></section>';
      } else {
        var dif=mt-pt;
        h+='<section class="rs-hero" data-rs="tickets"><span class="l">Mes tickets · '+esc(mn)+'</span><span class="v">'+esc(fmtS(mt))+'</span><span class="s">'+mine.length+' ticket'+(mine.length>1?'s':'')+(pt>0 ? ' · '+esc(fmtS(Math.abs(dif)))+(dif>=0?' de plus':' de moins')+' qu\'en '+esc(monthLabelOf(pm).split(" ")[0]) : '')+'</span></section>';
      }
      var dbt=comOn ? rsDebt(m, me) : null;
      if(dbt) h+='<button type="button" class="rs-al '+(dbt.ok?'ok':'warn')+'" data-rs="communes"><span class="ic">'+(dbt.ok?'✓':'⇄')+'</span><span><b>'+esc(dbt.txt)+'</b><small>'+(dbt.ok?'rien à rembourser':'toucher pour « Remboursé »')+'</small></span></button>';
      var a=myAcct(), F=null; if(a && a.key!=="__tickets" && (!fyCfg || fyTabOn(fyCfg, "compte"))){ try{ F=acctFigures(a.key, m); }catch(e){} }
      var T=[];
      if(F){ T.push('<button type="button" class="rs-tile" data-rs="compte"><span>Mon compte</span><b>'+esc(fmtS(F.banque))+'</b><small>banque</small></button>');
             T.push('<button type="button" class="rs-tile" data-rs="compte"><span>Fin du mois</span><b>'+esc(fmtS(F.fin))+'</b><small>prévu</small></button>'); }
      if(hasPart || F) T.push('<button type="button" class="rs-tile" data-rs="tickets"><span>Mes tickets</span><b>'+mine.length+'</b><small>'+esc(fmtS(mt))+'</small></button>');
      if(!hasPart && comOn) T.push('<button type="button" class="rs-tile" data-rs="communes"><span>Ma part du commun</span><b>'+esc(fmtS(sh))+'</b><small>'+(sh>0.004?esc(mn):'pas de part')+'</small></button>');
      if(T.length) h+='<div class="rs-tiles'+(T.length===3?' t3':'')+'">'+T.join("")+'</div>';
      h+=rsAlertsHTML(rsAlerts(m, me, null));
      if(FC.length){
        var up=FC.filter(function(f){ return !fraisDone(f, m) && (!dNow || !fraisDay(f, m) || fraisDay(f, m)>=dNow); });
        up.sort(function(x,y){ return (fraisDay(x, m)||40)-(fraisDay(y, m)||40); });
        if(up.length) h+='<div class="rs-h">Prochainement<small>ta part</small></div><div class="rs-list">'+up.slice(0, 4).map(function(f){ var v=fraisMontant(f, m)||0, p=fraisPct(f, me, m)||0, d=fraisDay(f, m);
          return '<button type="button" class="rs-row" data-rs="communes"><span class="n">'+esc(f.label||"Frais commun")+'<small>'+(d?'le '+d+' · ':'')+(f.split?'chacun sa part':'payé par '+esc(fraisPayer(f)===me?'toi':fraisPayer(f)))+'</small></span><span class="a">'+esc(fmtS(v*p/100))+'<small>sur '+esc(fmtS(v))+'</small></span></button>'; }).join("")+'</div>';
      }
      var last=state.entries.filter(function(e){ return payerOf(e)===me && (e.date||"")<=today; }).sort(function(x,y){ return (y.date||"").localeCompare(x.date||"") || (Number(y.id)||0)-(Number(x.id)||0); }).slice(0, 3);
      h+='<div class="rs-h">Mes derniers tickets<button type="button" data-rs="tickets">Tout voir</button></div>';
      if(last.length) h+='<div class="rs-list">'+last.map(function(e){ return '<button type="button" class="rs-row" data-rs="t" data-id="'+esc(e.id)+'"><span class="n">'+esc(e.marchand||"Ticket")+'<small>'+esc(e.categorie||"")+' · '+esc((e.date||"").slice(8,10)+"/"+(e.date||"").slice(5,7))+'</small></span><span class="a">− '+esc(fmtS(Number(e.montant)||0))+'</span></button>'; }).join("")+'</div>';
      else h+='<div class="rs-list"><div class="muted" style="padding:14px 0;font-size:13px">Pas encore de ticket. Touche ＋ pour en scanner un.</div></div>';
      if(!F && !hasPart && (fyCfg && fyCfg.role==="edit" && fyTabEd("list"))) h+='<button type="button" class="rs-al ok" data-rs="scan"><span class="ic">📷</span><span><b>Scanner un ticket</b><small>ou le « + » en bas</small></span></button>';
      return h;
    }
    function renderHomeResume(){
      var m=monthKey(todayISO()), me=mePerson(), h=header(), drvB=drvBannerHTML(), bkAge=backupAgeDays();
      if(drvB) h+=drvB;
      else if(!fyMember() && !drvOn() && (bkAge===null || bkAge>=7))
        h+='<div class="bk-banner bk-plain"><span style="font-size:20px">💾</span><div>'+(bkAge===null?'<b>Aucune sauvegarde</b> de tes données pour l\'instant.':'<b>Dernière sauvegarde il y a '+bkAge+' jours.</b>')+'</div><button type="button" class="btn" id="bkNow">Sauvegarder</button></div>';
      h+=homeModeHTML()+(fyMember() ? rsMemberHTML(m, me) : rsOwnerHTML(m, me));
      app.innerHTML=h; setNav("list", true);   // la barre du bas (sinon cachée au démarrage sur le Résumé)
      drvBannerWire(); var bkn=document.getElementById("bkNow"); if(bkn) bkn.onclick=backupData;
      [].forEach.call(document.querySelectorAll("[data-rs]"), function(b){ b.onclick=function(){ var g=b.getAttribute("data-rs");
        if(g==="t"){ editEntry(b.getAttribute("data-id")); return; }
        if(g==="scan"){ plusDo("scan"); return; }
        if(g==="budget"){ state.depSub="budgets"; state.view=depView(); }
        else if(g==="tickets"){ state.view="tickets"; state.depSub="tickets"; }
        else { state.view=g; if(g==="compte") state.cptPage=null; }
        render(); window.scrollTo(0,0); }; });
    }
    function renderList(){
      if(state.view==="list" && state.listSub==="tickets"){ state.listSub=null; state.view="tickets"; state.depSub="tickets"; }   // la page Tickets est dans Dépenses
      var depMode=(state.view==="tickets");
      pvLockMe=fyMember(); pvMemo=null;
      if(!depMode){ renderHomeResume(); return; }
      var curM = monthKey(todayISO());
      var month = (state.months&&state.months.list)||curM;
      var allMois = state.entries.filter(function(e){ return monthKey(e.date)===month; }), mois = allMois.filter(inView);   // filtre par personne
      var totalMois = mois.reduce(function(s,e){ return s+(Number(e.montant)||0); }, 0);
      var parCat = {};
      mois.forEach(function(e){ parCat[e.categorie]=(parCat[e.categorie]||0)+(Number(e.montant)||0); });
      var cats = Object.keys(parCat).sort(function(a,b){ return parCat[b]-parCat[a]; });
      var monthLabel = monthLabelOf(month);

      var h='';   // l'Accueil est le Résumé (renderHomeResume) ; ici : la page Tickets d'Opérations

      // --- Tickets du mois : lignes simples, recherche + filtres catégorie / date
      var listE = state.catFilter ? mois.filter(function(e){ return catIn(e.categorie, state.catFilter); }) : mois;
      if(state.dateFrom) listE = listE.filter(function(e){ return (e.date||"")>=state.dateFrom; });
      if(state.dateTo) listE = listE.filter(function(e){ return (e.date||"")<=state.dateTo; });
      listE = listE.slice().sort(function(x,y){ return (y.date||"")<(x.date||"")?-1:((y.date||"")>(x.date||"")?1:0); });
      var hasDate=!!(state.dateFrom||state.dateTo), dateOpen=!!state.dateFilterOpen;
      var artSum=0, gaps=[];
      mois.forEach(function(e){ if(!(e.articles||[]).length){ artSum+=Number(e.montant)||0; return; }   // ticket sans article (relevé, carburant…) : pas d'écart
        var as=(e.articles||[]).reduce(function(ss,a){ return ss+(Number(a.prix)||0); },0); artSum+=as; if(Math.abs(as-(Number(e.montant)||0))>0.005) gaps.push({ e:e, as:as }); });
      var diff=totalMois-artSum, hasGap=Math.abs(diff)>0.005;
      function dmy(d){ var p=(d||"").split("-"); return p.length===3?p[2]+"/"+p[1]:""; }
      var tSub='', tB='';
      if(!mois.length) tSub = state.entries.length ? 'Aucun ticket ce mois-ci · change de mois avec ‹ › en haut.' : 'Rien d\'enregistré pour l\'instant · appuie sur <b>Scanner</b> en bas pour commencer.';
      else {
        var fl=[]; if(state.catFilter) fl.push(esc(state.catFilter)); if(hasDate) fl.push("période");
        if(hasGap) tSub='<span style="color:var(--coral)">⚠ Écart avec Articles : '+fmtK(diff)+'</span>';
        else if(fl.length) tSub='Filtre : '+fl.join(" · ")+' · '+listE.length+' ticket'+(listE.length>1?"s":"");
        tB += '<div class="tkbar"><input class="f" id="search" placeholder="Magasin, article, catégorie…" value="'+esc(state.search||"")+'"><button type="button" class="tkd'+((dateOpen||hasDate)?' on':'')+'" id="datebtn" aria-label="Filtrer par date">📅</button></div>';
        // pastilles : Tout + les catégories du mois (refonte du 19/11)
        var chC=cats.slice(0, 6); if(state.catFilter && chC.indexOf(state.catFilter)<0) chC.unshift(state.catFilter);
        if(cats.length>1 || state.catFilter) tB += '<div class="fx2-chips tk2-chips" id="tkCats"><button type="button" data-cat=""'+(!state.catFilter?' class="on"':'')+'>Tout</button>'+chC.map(function(c){ return '<button type="button" data-cat="'+esc(c)+'"'+(state.catFilter===c?' class="on"':'')+'>'+esc(c)+'</button>'; }).join("")+'</div>';
        if(dateOpen||hasDate){
          tB += '<div class="tkdate"><input class="f" type="date" id="dateFrom" value="'+esc(state.dateFrom||"")+'"><span class="muted" style="font-size:11px">au</span><input class="f" type="date" id="dateTo" value="'+esc(state.dateTo||"")+'"></div>';
          if(hasDate){ var dsum=listE.reduce(function(t,e){ return t+(Number(e.montant)||0); },0);
            tB += '<div class="tkper"><span>'+listE.length+' ticket'+(listE.length>1?"s":"")+' sur la période · <b>'+fmtK(dsum)+'</b></span><span class="x" id="dateclear">Effacer</span></div>'; }
        }
        tB += '<div id="results-empty" class="muted" style="display:none;font-size:12px;text-align:center;padding:12px">Aucun ticket ne correspond.</div>';
        if(!listE.length) tB += '<div class="muted" style="text-align:center;padding:12px;font-size:12px">'+(state.catFilter?'Aucun ticket en « '+esc(state.catFilter)+' »':'Aucun ticket')+(hasDate?' sur cette période.':' ce mois-ci.')+'</div>';
        var dayLast="", dayTot={}; listE.forEach(function(e){ dayTot[e.date]=(dayTot[e.date]||0)+(Number(e.montant)||0); });
        if(listE.length) tB += '<div class="tk2-list">';
        listE.forEach(function(e){
          if(e.date!==dayLast){ dayLast=e.date; var dd=e.date ? new Date(e.date+"T12:00:00").toLocaleDateString("fr-FR",{ weekday:"long", day:"numeric", month:"long" }) : "sans date";
            tB += '<div class="tk2-day" data-d="'+esc(e.date||"")+'"><span>'+esc(dd)+'</span><span>'+fmtK(dayTot[e.date])+'</span></div>'; }
          var payer=(e.payePar||"").trim(), ic=catIcon(e.categorie), nA=(e.articles||[]).filter(function(a){ return !/ · ticket entier$/.test(String(a.label||"")); }).length;
          var mk=[]; if(nA) mk.push(nA+" article"+(nA>1?"s":"")); if(e.share || (e.articles||[]).some(function(a){ return a.commun; })) mk.push("partagé"); if(e.pay==="esp") mk.push(e.liq ? 'espèces' : 'espèces hors liquide');
          var sdata2=((e.marchand||"")+" "+(e.categorie||"")+" "+payer+" "+(e.pay==="esp"?"espèces especes ":"")+((e.date||"").split("-").reverse().join("/"))+" "+(e.articles||[]).map(function(a){ return artName(a); }).join(" ")).toLowerCase();
          tB += '<div class="entry ecomp tk2-r" data-id="'+esc(e.id)+'" data-d="'+esc(e.date||"")+'" data-s="'+esc(sdata2)+'"><span class="tk2-ic" style="background:'+hexA(ic.col||"#7c9cf4",.16)+'">'+ic.e+'</span><span class="n">'+esc(e.marchand||"Ticket")+'<small>'+esc((e.categorie||"")+(payer?' · '+payer:'')+(mk.length?' · '+mk.join(' · '):''))+'</small></span>'+(hasPhoto(e.id)?'<span class="tk2-ph">photo</span>':'')+'<span class="a">'+fmtK(e.montant)+'</span></div>';
          return;
          var sdata=((e.marchand||"")+" "+(e.categorie||"")+" "+payer+" "+(e.pay==="esp"?"espèces especes ":"")+((e.date||"").split("-").reverse().join("/"))).toLowerCase();
          tB += '<div class="entry ecomp" data-id="'+esc(e.id)+'" data-s="'+esc(sdata)+'"><span class="n">'+esc(e.marchand||"Ticket")+'<small>'+ic.e+' '+esc(e.categorie||"")+(payer?' · '+esc(payer):'')+(e.pay==="esp" ? ' · 💶 '+(e.liq ? 'espèces' : 'espèces hors liquide') : '')+'</small></span><span class="d">'+esc(dmy(e.date))+'</span><span class="a">'+fmtK(e.montant)+'</span></div>';
        });
        if(listE.length) tB += '</div>';
        tB += '<div class="tkfoot">'+mois.length+' ticket'+(mois.length>1?"s":"")+' ce mois · total des articles '+fmtK(artSum)+'</div>';
        if(hasGap){
          tB += '<div class="tkgap"><b>Écart avec Articles : '+fmtK(diff)+'</b><small>'+gaps.length+' ticket'+(gaps.length>1?"s":"")+' dont le détail ne correspond pas au total. Touche pour corriger.</small></div>';
          gaps.sort(function(x,y){ return Math.abs((y.e.montant||0)-y.as)-Math.abs((x.e.montant||0)-x.as); });
          gaps.forEach(function(g){ tB += '<div class="gapfix" data-id="'+esc(g.e.id)+'"><span class="n">'+esc(g.e.marchand||"Ticket")+'<small>'+esc((g.e.date||"").split("-").reverse().join("/"))+' · ticket '+fmtK(g.e.montant)+' · articles '+fmtK(g.as)+'</small></span><span class="a">'+fmtK((Number(g.e.montant)||0)-g.as)+'</span></div>'; });
        }
      }
      // Page « Tickets » : la liste du mois (recherche, filtres) sur une page à part
      var tkPage=depMode, tkH='';
      if(tkPage){
        var pmK=prevMonthKey(month), prevT=0; state.entries.forEach(function(e){ if(monthKey(e.date)===pmK && inView(e)) prevT+=Number(e.montant)||0; });
        var TKC=["var(--accent)","#e6b450","var(--coral)","#7c9cf4","#c78bd6"], top=cats.slice(0, 4), rest=totalMois;
        top.forEach(function(c){ rest-=parCat[c]; });
        var bar='', leg='';
        top.forEach(function(c, i){ var w=totalMois>0?parCat[c]/totalMois*100:0; bar+='<i style="width:'+w.toFixed(1)+'%;background:'+TKC[i]+'"></i>'; leg+='<span><span class="av2-dot" style="background:'+TKC[i]+'"></span> '+esc(c)+' <b>'+fmtK(parCat[c])+'</b></span>'; });
        if(rest>0.004){ bar+='<i style="width:'+(rest/totalMois*100).toFixed(1)+'%;background:'+TKC[4]+'"></i>'; leg+='<span><span class="av2-dot" style="background:'+TKC[4]+'"></span> Autres <b>'+fmtK(rest)+'</b></span>'; }
        var cmp=''; if(prevT>0.004 && totalMois>0.004){ var pc=Math.round((totalMois-prevT)/prevT*100); cmp=(pc>0?'+':(pc<0?'−':''))+Math.abs(pc)+' % par rapport à '+monthLabelOf(pmK).split(" ")[0]; }
        tkH=header(false, "Opérations")+cptSubsHTML("tk")+pvBarHTML()+
          '<section class="paper av2-hero" id="tkHero">'+monthNavHTML(esc(capFirst(monthLabel)), month, curM)+
          '<div class="av2-big"><b>'+esc(fmtK(totalMois))+'</b><span>'+mois.length+' ticket'+(mois.length>1?'s':'')+(mois.length?' · '+esc(fmtK(totalMois/mois.length))+' en moyenne':'')+'</span></div>'+
          (totalMois>0.004?'<div class="av2-bar" style="height:12px">'+bar+'</div><div class="tk2-leg">'+leg+'</div>':'')+(cmp?'<div class="muted" style="font-size:12px">'+esc(cmp)+'</div>':'')+'</section>'+
          (tSub?'<div class="dgs" style="margin:0 4px 8px">'+tSub+'</div>':'')+'<div class="tk2-body">'+tB+'</div>'+
          '<div class="paper av-side tk2-side"><button type="button" id="gogallery"><span>Photos des tickets</span><b>Galerie</b><small>›</small></button>'+
          (corbList().length ? '<button type="button" id="gocorb"><span>Corbeille · '+corbList().length+'</span><b>'+corbList().length+' ticket'+(corbList().length>1?'s':'')+'</b><small>gardés '+CORB_J+' jours ›</small></button>' : '')+'</div>';
      }
      h=tkH;

      app.innerHTML = h;
      if(tkPage) wireCptSubs();

      var manual2=document.getElementById("manual2"); if(manual2) manual2.onclick=newDraft;
      var gogallery=document.getElementById("gogallery"); if(gogallery) gogallery.onclick=function(){ state.view="gallery"; render(); };
      var gocorb=document.getElementById("gocorb"); if(gocorb) gocorb.onclick=function(){ state.view="corbeille"; render(); window.scrollTo(0,0); };
      var db=document.getElementById("datebtn"); if(db) db.onclick=function(){ state.dateFilterOpen=!state.dateFilterOpen; render(); };
      var dFrom=document.getElementById("dateFrom"); if(dFrom) dFrom.onchange=function(){ state.dateFrom=dFrom.value||null; render(); };
      var dTo=document.getElementById("dateTo"); if(dTo) dTo.onchange=function(){ state.dateTo=dTo.value||null; render(); };
      var dc=document.getElementById("dateclear"); if(dc) dc.onclick=function(){ state.dateFrom=null; state.dateTo=null; state.dateFilterOpen=false; render(); };
      var search=document.getElementById("search");
      if(search){ search.oninput=function(){
        state.search=search.value; var q=search.value.trim().toLowerCase(), any=false;
        var vis={}; [].forEach.call(document.querySelectorAll(".entry[data-s]"), function(n){ var ok=!q || n.getAttribute("data-s").indexOf(q)>=0; n.style.display=ok?"":"none"; if(ok){ any=true; vis[n.getAttribute("data-d")||""]=1; } });
        [].forEach.call(document.querySelectorAll(".tk2-day"), function(d){ d.style.display=vis[d.getAttribute("data-d")]?"":"none"; });
        var re=document.getElementById("results-empty"); if(re) re.style.display=any?"none":"block";
      }; if(state.search){ search.oninput(); } }
      var bkp=document.getElementById("backup"); if(bkp) bkp.onclick=backupData;
      var rst=document.getElementById("restore"); if(rst) rst.onclick=function(){ restorein.click(); };
      var goprod=document.getElementById("goprod"); if(goprod) goprod.onclick=function(){ state.view="produits"; render(); };
      [].forEach.call(document.querySelectorAll(".entry"), function(node){
        node.onclick=function(){ editEntry(node.getAttribute("data-id")); };
      });
      [].forEach.call(document.querySelectorAll(".gapfix"), function(node){
        node.onclick=function(){ editEntry(node.getAttribute("data-id")); };
      });
      var ct=document.getElementById("catsToggle"); if(ct) ct.onclick=function(){ state.catsOpen=!state.catsOpen; render(); };
      [].forEach.call(document.querySelectorAll(".tile"), function(t){ t.onclick=function(){ var g=t.getAttribute("data-go");
        if(g==="tickets"){ state.listSub="tickets"; render(); window.scrollTo(0,0); }
        else { state.view=g; render(); window.scrollTo(0,0); } }; });
      var be=document.getElementById("budEdit"); if(be) be.onclick=function(ev){ ev.stopPropagation(); editBudgets(month); };
      var bkn=document.getElementById("bkNow"); if(bkn) bkn.onclick=backupData;
      drvBannerWire();
      var rt=document.getElementById("recToggle"); if(rt) rt.onclick=function(){ state.recOpen=!state.recOpen; render(); };
      var gf=document.getElementById("goFrais"); if(gf) gf.onclick=function(){ state.view="communes"; render(); };
      var gb=document.getElementById("goBilan"); if(gb) gb.onclick=function(){ state.bilanMonth=month; state.bilanFrom=month; state.bilanTo=month; state.view="bilan"; render(); window.scrollTo(0,0); };
      var lkSet=document.getElementById("lockSetup"); if(lkSet) lkSet.onclick=lockSetup;
      var devB=document.getElementById("devBtn"); if(devB) devB.onclick=chooseCurrency;
      var lkOff=document.getElementById("lockOff"); if(lkOff) lkOff.onclick=lockDisable;
      var lkBio=document.getElementById("lockBio"); if(lkBio) lkBio.onclick=lockEnableBio;
      [].forEach.call(document.querySelectorAll(".mcol"), function(c){ c.onclick=function(){ var m=c.getAttribute("data-m"); if(!state.months) state.months={}; state.months.list=(m===curM?null:m); render(); }; });
      [].forEach.call(document.querySelectorAll(".catrow"), function(row){ row.onclick=function(){ state.catFilter=row.getAttribute("data-cat"); state.listSub="tickets"; render(); window.scrollTo(0,0); }; });   // une catégorie → ses tickets du mois
      var cc=document.getElementById("catclear"); if(cc) cc.onclick=function(){ state.catFilter=null; render(); };
      [].forEach.call(document.querySelectorAll("#tkCats button"), function(b){ b.onclick=function(){ state.catFilter=b.getAttribute("data-cat")||null; render(); }; });
      wireMonthNav(month, curM, "list");
      setNav("tickets", true);
    }

    // Nouveau produit tapé dans un ticket (07/11) : sa catégorie est proposée sous l'article, devinée d'après le nom, sinon celle du ticket
    function prodIsNew(p){ p=(p||"").trim(); return !!p && p!=="Remise" && PRODUITS.indexOf(p)<0 && FAMILLES.indexOf(p)<0; }
    function prodCatGuess(p, d){
      var g=guessCat(p); if(g!=="Autre" && CATS.indexOf(g)>=0) return g;
      var m=catGuessMain(p); if(m!=="Autre" && CATS.indexOf(m)>=0) return m;
      return (d && d.categorie && CATS.indexOf(d.categorie)>=0) ? d.categorie : FAM_FB;
    }
    function prodNewCat(p, d){ p=(p||"").trim(); return (d && d.newCats && d.newCats[p] && CATS.indexOf(d.newCats[p])>=0) ? d.newCats[p] : prodCatGuess(p, d); }
    function artNewHTML(p, d){
      if(!prodIsNew(p)) return "";
      var c=prodNewCat(p, d);
      return '<span>Nouvel article, rangé dans</span> <button type="button" class="art-newcat" data-p="'+esc(p.trim())+'">'+esc(catLabel(c))+' ›</button>';
    }
    // Nom affiché d'un article : son nom (produit), sinon ce qui a été lu sur le ticket
    function artName(a){ var p=String(a.produit||"").trim(); if(p && p!=="Remise" && FAMILLES.indexOf(p)<0) return p; return String(a.label||"").trim() || p || "Article"; }
    // Article lu mais pas reconnu : les noms qui lui ressemblent (appris par la personne, ou ses articles dont le nom est dans le texte lu)
    function artSuggest(label, person){
      var n=norm(label); if(!n) return [];
      var D=apprisOf(person), sc={}, sn=" "+n+" ";
      function add(p, v){ if(!p || p==="Remise" || FAMILLES.indexOf(p)>=0) return; if(!(sc[p]>=v)) sc[p]=v; }
      for(var k in D){ if(k.length>=3) add(D[k], simRatio(n, k)); }
      PRODUITS.forEach(function(p){ var np=norm(p); if(np.length<3) return; add(p, sn.indexOf(" "+np+" ")>=0 ? 0.9 : simRatio(n, np)); });
      return Object.keys(sc).filter(function(p){ return sc[p]>=0.4; }).sort(function(a, b){ return sc[b]-sc[a]; }).slice(0, 3);
    }
    // Un article = un seul nom à donner (a.produit) et son prix ; a.label = ce qui a été lu sur le ticket (gardé, en petit), a.commun = partagé
    // (le partage se choisit dans « Qui paie ce ticket ? »)
    function artRow(a, d){
      var lab=String(a.label||"").trim(), pr=String(a.produit||"").trim(), lu=lab && norm(lab)!==norm(pr) && pr!=="Remise" && !/ · ticket entier$/.test(lab);
      var sug=(!pr && lab && !state.draftRO) ? artSuggest(lab, payerOf(d)) : [];
      var meta=[]; if(lu) meta.push('lu : <span>'+esc(lab)+'</span>'); if(a.commun) meta.push('<b>partagé</b>');
      return '<div class="art" data-l="'+esc(a.label||"")+'"'+(a.commun?' data-c="1"':'')+'>'+
        '<div class="art-row">'+
          '<div class="combo">'+
            '<input class="f art-prod" autocomplete="off" aria-label="Article" value="'+esc(a.produit)+'"'+(a.auto && a.produit ? ' data-autov="'+esc(a.produit)+'"' : '')+' placeholder="'+(lab && !pr ? 'Quel article ?' : 'Article — tape ou choisis')+'">'+
            '<div class="combo-pop"></div>'+
          '</div>'+
          '<input class="f art-prix" inputmode="decimal" aria-label="Prix" value="'+esc(a.prix)+'" placeholder="0,00">'+
          '<button class="btn ghost art-del" type="button" aria-label="Retirer l\'article">✕</button>'+
        '</div>'+
        (meta.length ? '<div class="art-lu">'+meta.join(' · ')+(sug.length ? ' · c\'est peut-être :' : '')+'</div>' : '')+
        (sug.length ? '<div class="art-sug">'+sug.map(function(p){ return '<button type="button" class="art-sugb" data-v="'+esc(p)+'">'+esc(p)+'</button>'; }).join("")+'</div>' : '')+
        '<div class="art-new">'+artNewHTML(a.produit, d)+'</div>'+
      '</div>';
    }

