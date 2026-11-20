    // ---------- Articles : même présentation que Compte, Commun et Analyse ----------
    var ARTPAL=["#7c9cf4","#e0a458","#4fd6a0","#c78bd6","#5bc0d4","#e88fb0","#9bd35e","#d4a05b","#8a92e0","#6fcaa8","#d98c5f","#b0b6c2","#f4796b"];
    // Historique des articles (12 derniers mois jusqu'au mois affiché) : prix d'une ligne, magasins, évolution, économies possibles
    function artHistory(month){
      var mk=month, ms={}; for(var i=0;i<12;i++){ ms[mk]=1; mk=prevMonthKey(mk); }
      var pOn=artProdOn(), by={}, sm={};
      function sk(x){ x=String(x||"").toLowerCase(); try{ x=x.normalize("NFD").replace(/[\u0300-\u036f]/g,""); }catch(e){} return x.replace(/[^a-z ]+/g," ").replace(/\b(sas|sarl|sa|magasin|store|super|hyper|market)\b/g," ").replace(/\s+/g," ").trim(); }
      // magasins presque identiques regroupés : même premier mot à une lettre près (« INTERMACHE » = « Intermarché La Rotonde »)
      function lev(a,b){ if(Math.abs(a.length-b.length)>2) return 9; var d=[], i, j; for(i=0;i<=a.length;i++) d[i]=[i]; for(j=1;j<=b.length;j++) d[0][j]=j;
        for(i=1;i<=a.length;i++) for(j=1;j<=b.length;j++) d[i][j]=Math.min(d[i-1][j]+1, d[i][j-1]+1, d[i-1][j-1]+(a.charAt(i-1)===b.charAt(j-1)?0:1)); return d[a.length][b.length]; }
      var cnt={}; vEntries().forEach(function(e){ if(!ms[monthKey(e.date)]) return; var k=sk(e.marchand); if(k) cnt[k]=(cnt[k]||0)+1; });
      var heads=[], ali={}; Object.keys(cnt).sort(function(a,b){ return cnt[b]-cnt[a]; }).forEach(function(k){ var f=k.split(" ")[0], hit=null;
        for(var q=0;q<heads.length;q++){ var g=heads[q].split(" ")[0], m0=Math.min(f.length,g.length); if((m0>=5 && lev(f,g)<=(m0>=9?2:1)) || k===heads[q]){ hit=heads[q]; break; } }
        if(hit) ali[k]=hit; else heads.push(k); });
      vEntries().forEach(function(e){ var m=monthKey(e.date); if(!ms[m]) return; var st=(e.marchand||"").trim(), k=sk(st); k=ali[k]||k;
        (e.articles||[]).forEach(function(a){ if(a.commun && !pOn) return; var c=classifyArticle(a); if(c.fam==="Remise" || !(c.amt>0)) return;
          if(m===month){ var S0=sm[k||"?"]||(sm[k||"?"]={ name:st||"?", names:{}, sum:0, nA:0, t:{} }); S0.sum+=c.amt; S0.nA++; S0.t[e.id]=1; S0.names[st||"?"]=(S0.names[st||"?"]||0)+1; }
          var key=c.fam+"|"+c.name; if(!by[key]) by[key]={ fam:c.fam, name:c.name, lines:[] };
          by[key].lines.push({ d:e.date||"", m:m, p:c.amt, sk:k, st:st }); }); });
      var list=[], saveMonth=0, saveYear=0;
      Object.keys(by).forEach(function(key){ var P=by[key], L=P.lines.sort(function(a,b){ return a.d<b.d?-1:(a.d>b.d?1:0); });
        var stores={}; L.forEach(function(l){ if(!l.sk) return; var o=stores[l.sk]||(stores[l.sk]={ name:l.st, sum:0, n:0, names:{} }); o.sum+=l.p; o.n++; o.names[l.st]=(o.names[l.st]||0)+1; });
        var sl=Object.keys(stores).map(function(k){ var o=stores[k]; o.avg=o.sum/o.n; o.name=Object.keys(o.names).sort(function(a,b){ return o.names[b]-o.names[a]; })[0]; return o; }).sort(function(a,b){ return a.avg-b.avg; });
        var inM=L.filter(function(l){ return l.m===month; }), last=L[L.length-1], first=L[0];
        // évolution : dans le magasin du dernier achat si on y a acheté avant (sinon tous magasins confondus)
        var same=L.filter(function(l){ return l.sk===last.sk; }), f0=(same.length>1 ? same[0] : first);
        // comparaison utile seulement si l'écart entre magasins dépasse 2 % (sinon c'est l'évolution du prix, pas le magasin)
        // comparable si l'écart est réel (≥ 2 %) mais pas énorme (≤ 50 %) : au-delà, ce n'est pas le même produit ou pas la même quantité (gasoil, matériaux…)
        var lo0=sl.length?sl[0].avg:0, hi0=sl.length?sl[sl.length-1].avg:0;
        var cheap=(sl.length>=2 && hi0-lo0>=Math.max(0.01, lo0*0.02) && hi0<=lo0*1.5) ? lo0 : null; if(cheap==null) sl=[];
        if(cheap!=null) L.forEach(function(l){ var d=l.p-cheap; if(d>0.004){ saveYear+=d; if(l.m===month) saveMonth+=d; } });
        list.push({ fam:P.fam, name:P.name, nBuy:L.length, nMonth:inM.length, totMonth:inM.reduce(function(t,l){ return t+l.p; },0),
          firstPrice:f0.p, lastPrice:(inM.length?inM[inM.length-1].p:last.p), lastStore:(inM.length?inM[inM.length-1].st:last.st), evo:(L.length>1 && f0!==last && f0.p>0 ? (last.p-f0.p)/f0.p*100 : 0), stores:sl });
      });
      Object.keys(sm).forEach(function(k){ var o=sm[k]; o.nT=Object.keys(o.t).length; o.name=Object.keys(o.names).sort(function(a,b){ return o.names[b]-o.names[a]; })[0]; });
      return { list:list, saveMonth:saveMonth, saveYear:saveYear, storesMonth:sm };
    }
    function artProdOn(){ var v=state.artProd; if(v==null) v=store.read("artProd", true); return !!v; }
    function artMonthData(m){
      var fams={}, grand=0, nArt=0, top=null, most=null, prods={};
      var pOn=artProdOn();
      vEntries().filter(function(e){ return monthKey(e.date)===m; }).forEach(function(e){   // filtre par personne
        (e.articles||[]).forEach(function(a){
          if(a.commun && !pOn) return;   // bouton « Articles partagés » désactivé
          var c=classifyArticle(a);
          if(!fams[c.fam]) fams[c.fam]={ total:0, n:0, items:{} };
          var F=fams[c.fam]; F.total+=c.amt; F.n++; grand+=c.amt; nArt++;
          if(!F.items[c.name]) F.items[c.name]={ n:0, total:0 };
          F.items[c.name].n++; F.items[c.name].total+=c.amt;
          var pk=c.fam+"|"+c.name; if(!prods[pk]) prods[pk]={ fam:c.fam, name:c.name, n:0, total:0 }; prods[pk].n++; prods[pk].total+=c.amt;
          if(c.amt>0 && (!top || c.amt>top.amt)) top={ name:((a.label||"").trim()||c.name), amt:c.amt };
        });
      });
      var plist=Object.keys(prods).map(function(k){ return prods[k]; });
      plist.forEach(function(p){ if(p.fam!=="Remise" && (!most || p.n>most.n || (p.n===most.n && p.total>most.total))) most=p; });
      var famKeys=Object.keys(fams).sort(function(a,b){ return fams[b].total-fams[a].total; });
      return { fams:fams, famKeys:famKeys, grand:grand, nArt:nArt, top:top, most:most, prods:plist };
    }
    function artAvgBars(rows, sel){   // barres sur 6 mois : bleu sous la moyenne, ambre au-dessus (comme Analyse)
      var act=rows.filter(function(r){ return r.v>0; }), avg=act.length?act.reduce(function(t,r){ return t+r.v; },0)/act.length:0;
      return compteBarsSVG(rows, sel, function(r){ return r.v>avg?"#e0a458":"#7c9cf4"; })+'<div class="cch-leg"><span><i style="background:#7c9cf4"></i>Sous la moyenne</span><span><i style="background:#e0a458"></i>Au-dessus</span></div>';
    }
    // Graphes sur 6 mois : on ne montre pas les mois d'avant les premières données (mois vides en tête retirés, le mois affiché reste)
    function firstDataMonth(){ if(fsMemo.fdm===undefined){ var f0=null; state.entries.forEach(function(e){ var k=e.date && monthKey(e.date); if(k && (!f0 || k<f0)) f0=k; }); fsMemo.fdm=f0; } return fsMemo.fdm; }
    function trimLead(rows, val){ var f0=firstDataMonth(), r=rows.filter(function(x,i){ return i===rows.length-1 || !f0 || x.m>=f0; }); while(r.length>1 && !(val(r[0])>0)) r.shift(); return r; }
    function artMShort(m){ var pm=m.split("-"); return new Date(+pm[0], +pm[1]-1, 1).toLocaleDateString("fr-FR",{month:"short"}).replace(".",""); }
    // Budgets par catégorie de tickets (ex-« Où part l'argent » de l'accueil) : barres, % du budget, dépassements
    function budgetsChart(month){
      var allMois=state.entries.filter(function(e){ return monthKey(e.date)===month; }), mois=allMois.filter(inView);
      var pvv=pvCur(), pvn=pvName(pvv), PB=(pvv==="all") ? budgets : (budgetsP[pvn]||{});
      var fyFb=false;   // pas de budget à soi mais des budgets du foyer : on montre ceux du foyer (avec les dépenses de tout le foyer)
      if(pvv!=="all" && !Object.keys(PB).some(function(c){ return PB[c]>0; }) && Object.keys(budgets).some(function(c){ return budgets[c]>0; })){ fyFb=true; pvv="all"; PB=budgets; mois=allMois; }
      var parCat={}, totalMois=0; mois.forEach(function(e){ var v=Number(e.montant)||0; parCat[e.categorie]=(parCat[e.categorie]||0)+v; totalMois+=v; });
      parCat=catRoll(parCat);   // arbre : une grande catégorie compte ses sous-catégories
      var parCatAll={}, parCatP={};
      allMois.forEach(function(e){ var v=Number(e.montant)||0, p=payerOf(e); parCatAll[e.categorie]=(parCatAll[e.categorie]||0)+v; if(!parCatP[p]) parCatP[p]={}; parCatP[p][e.categorie]=(parCatP[p][e.categorie]||0)+v; });
      parCatAll=catRoll(parCatAll); Object.keys(parCatP).forEach(function(p){ parCatP[p]=catRoll(parCatP[p]); });
      var budCats=Object.keys(PB).filter(function(c){ return PB[c]>0; });
      // lignes : par grande catégorie (avec budget d'abord, les plus entamées en haut), et sous elle ses sous-catégories qui ont un budget
      var mains=catMains().filter(function(m){ return (parCat[m]||0)>0 || PB[m]>0 || catSubs(m).some(function(c){ return PB[c]>0; }); });
      Object.keys(parCat).forEach(function(k){ if(catIsMain(k) && mains.indexOf(k)<0 && (parCat[k]||0)>0) mains.push(k); });   // catégorie inconnue (import)
      function mRatio(m){ if(PB[m]>0) return (parCat[m]||0)/PB[m]; var r=-1; catSubs(m).forEach(function(c){ if(PB[c]>0) r=Math.max(r, (parCat[c]||0)/PB[c]); }); return r; }
      mains.sort(function(a,b){ var ra=mRatio(a), rb=mRatio(b); if((ra>=0)!==(rb>=0)) return ra>=0?-1:1; return ra>=0 ? rb-ra : (parCat[b]||0)-(parCat[a]||0); });
      var allCats=[], isSub={};
      mains.forEach(function(m){ allCats.push(m); catSubs(m).filter(function(c){ return PB[c]>0; }).forEach(function(c){ allCats.push(c); isSub[c]=1; }); });
      var cats=mains.filter(function(m){ return (parCat[m]||0)>0; });
      var bSpent=0, bTot=0, nOver=0;   // une grande catégorie avec budget compte pour elle ; sinon ses sous-catégories avec budget
      budCats.forEach(function(c){ if((parCat[c]||0)>PB[c]) nOver++; var m=catMain(c); if(m!==c && PB[m]>0) return; bTot+=PB[c]; bSpent+=(parCat[c]||0); });
      var maxC=1; cats.forEach(function(m){ maxC=Math.max(maxC, parCat[m]||0); }); var h='';
      if(!allCats.length) h+='<div class="cch-note" style="margin:24px 0">Aucune dépense ce mois-ci.</div>';
      allCats.forEach(function(c){
        var ic=catIcon(c), sp=parCat[c]||0, bud=PB[c]||0, top, w, col, sub="";
        if(bud>0){
          var r=sp/bud; w=Math.min(100, Math.round(r*100)); col=budgetColor(r, "var(--accent)");
          top='<span class="v" style="color:'+(r>1?"var(--coral)":(r>=0.8?"#e6b450":"var(--ink)"))+'">'+(r>1?'dépassé de '+fmtK(sp-bud):'reste '+fmtK(bud-sp))+'</span>';
          sub = '<div class="cb-sub">'+fmtK(sp)+' sur '+fmtK(bud)+' · '+Math.round(r*100)+' %</div>';
        } else {
          var pc=totalMois?Math.round(sp/totalMois*100):0; w=Math.max(2,Math.round(sp/maxC*100)); col=ic.col;
          top='<span class="v">'+fmtK(sp)+'</span><span class="p">'+pc+' %</span>';
        }
        var other=[];
        if(pvv!=="all"){ if(budgets[c]>0){ var rf=(parCatAll[c]||0)/budgets[c]; other.push('<span style="color:'+budgetColor(rf,"var(--ink-soft)")+'">Foyer '+fmtK(parCatAll[c]||0)+' / '+Math.round(budgets[c])+' '+curSym()+'</span>'); } }
        else Object.keys(budgetsP).forEach(function(p){ var b=(budgetsP[p]||{})[c]; if(b>0){ var s2=(parCatP[p]||{})[c]||0, rp=s2/b; other.push('<span style="color:'+budgetColor(rp,"var(--ink-soft)")+'">'+esc(p===mePerson()?"Moi":p)+' '+fmtK(s2)+' / '+Math.round(b)+' '+curSym()+'</span>'); } });
        if(other.length) sub+='<div class="cb-sub cb-oth">'+other.join(" · ")+'</div>';
        h+='<div class="bar-row cbar catrow'+(isSub[c]?' csub':'')+'" data-cat="'+esc(c)+'" style="cursor:pointer;margin:4px 2px"><div class="cb-top"><span>'+(isSub[c]?'↳':ic.e)+'</span><span class="n">'+esc(c)+'</span>'+top+'</div><div class="cb-bar"><i style="width:'+Math.max(2,w)+'%;background:'+col+'"></i></div>'+sub+'</div>';
      });
      if(allCats.length) h+='<div class="cch-note">Touche une catégorie pour ses tickets</div>';
      var who=(pvv==="all"?"du foyer":(pvv==="moi"?"":"de "+pvn));
      if(fyFb) h+='<div class="cch-note">Budgets du foyer : tu n\'as pas de budget à toi</div>';
      return { who:who, html:h, spent:(budCats.length?bSpent:totalMois), tot:bTot, nBud:budCats.length, nOver:nOver, total:totalMois, label:(budCats.length?"Budgets "+(who||"du mois"):"Dépenses par catégorie"+(who?" "+who:"")),
        sub:(budCats.length?"sur "+fmtK(bTot)+" de budget · "+Math.round(bTot?bSpent/bTot*100:0)+" %":cats.length+" catégorie"+(cats.length>1?"s":"")+" · aucun budget fixé") };
    }
    function renderArticles(){
      var curM = monthKey(todayISO());
      var month = (state.months&&state.months.articles)||curM;
      var D=artMonthData(month), col={};
      D.famKeys.forEach(function(f,i){ col[f]=(f==="Remise")?"#8a92a6":ARTPAL[i%ARTPAL.length]; });
      // sous-pages (la bulle du bas suit le graphique) : Par famille, Produits du mois, Prix suivis, Par magasin
      var ASUB={ fam:"Par catégorie", prods:"Articles du mois", prix:"Prix suivis", mags:"Par magasin" };
      var aSub=(ASUB[state.artSub] && D.famKeys.length) ? state.artSub : null;
      var budOnly=(!aSub && state.depSub==="budgets");
      var h=(aSub ? header(true, ASUB[aSub]) : header(false, "Budget")+depTabsHTML())+pvBarHTML()+'<div class="tabtop">'+monthNavHTML(esc(capFirst(monthLabelOf(month))), month, curM)+'</div>';
      // Produits : réglage des produits ; Budgets : fixer les budgets (les budgets ne dépendent pas des articles rangés)
      var artTools=budOnly ? [["budEdit",artBudLbl()]] : [["artprod","⚙︎ Articles & catégories"]];
      if(!D.famKeys.length && !budOnly) h+=tabTools(artTools);
      if(!D.famKeys.length && !budOnly){
        h+='<section class="paper cacc" style="padding:18px 16px"><div class="center muted" style="font-size:12.5px;line-height:1.5">Aucun article rangé ce mois-ci.<br>Scanne un ticket pour voir tes articles et leurs prix.</div>'+(!artProdOn()?'<div class="center" style="margin-top:12px"><button type="button" class="anfx" id="artProdBtn">＋ Articles partagés</button><div class="muted" style="font-size:11px;margin-top:6px">Les articles partagés sont masqués</div></div>':'')+'</section>';
      } else {
        // Articles = ce que j'achète et à quel prix : Mes produits (du mois), Hausses, Moins cher (12 derniers mois)
        var TABS=budOnly ? [["bud","Budgets"]] : [["prod","Mes articles"],["hausse","Hausses"],["mag","Magasins"],["fam","Catégories"]];   // Budgets : son sous-onglet de Dépenses
        var mode=budOnly ? "bud" : (state.artChart||store.read("artChartDef","prod")); if(!TABS.some(function(x){ return x[0]===mode; })) mode="prod";
        var apOn=artProdOn(), apAny=state.entries.some(function(e){ return (e.articles||[]).some(function(a){ return a.commun; }); });
        var AH=artHistory(month);
        var chart=(apAny && !budOnly?'<button type="button" class="anfx anfx-corner'+(apOn?' on':'')+'" id="artProdBtn" aria-pressed="'+apOn+'">'+(apOn?'✓':'＋')+' Articles partagés</button>':'')+(budOnly ? '' : chartTabsHTML(TABS, mode, "artChartDef", "prod").replace('<div class="cch-tabs">','<div class="cch-tabs wrap2">'))+'<div class="cch cch-top">';
        function evoTxt(x){ return Math.abs(x)>=0.5 ? ' <small style="color:'+(x>0?'var(--coral)':'var(--accent)')+';font-weight:700">'+(x>0?'▲ +':'▼ ')+String(Math.round(x*10)/10).replace(".",",")+' %</small>' : ''; }
        function line(P, sub, right, rightCol){ return '<div class="bar-row artclk" data-fam="'+esc(P.fam)+'" data-name="'+esc(P.name)+'" style="margin:10px 2px;cursor:pointer"><div class="bar-top"><span class="bl">'+esc(P.name)+' <small class="muted">'+sub+'</small></span><span class="bv"'+(rightCol?' style="color:'+rightCol+'"':'')+'>'+right+'</span></div></div>'; }
        var heroO;
        if(mode==="prod"){
          var mp=AH.list.filter(function(P){ return P.nMonth>0; }).sort(function(a,b){ return b.totMonth-a.totMonth; });
          chart+=mp.length ? mp.map(function(P){ return line(P, '×'+P.nMonth+(P.lastStore?' · '+esc(P.lastStore):'')+evoTxt(P.evo), fmtK(P.lastPrice)); }).join("")+'<div class="cch-note">Dernier prix payé · ▲▼ depuis le premier achat (12 mois) · touche un article pour sa fiche</div>'
                           : '<div class="cch-note" style="margin:24px 0">Aucun article ce mois-ci.</div>';
          var hz=AH.list.filter(function(P){ return P.nMonth>0 && P.evo>0.5; }).sort(function(a,b){ return b.evo-a.evo; })[0];
          heroO={ label:"Achats du mois", big:D.grand, sub:D.nArt+" achat"+(D.nArt>1?"s":"")+" · "+mp.length+" article"+(mp.length>1?"s":""),
            stats:[ {l:"Plus forte hausse", keep:1, v:(hz?esc(hz.name):"—"), d:(hz?"+"+String(Math.round(hz.evo*10)/10).replace(".",",")+" %":"")}, {l:"Le plus acheté", keep:1, v:(D.most?esc(D.most.name):"—"), d:(D.most?"×"+D.most.n:"")}, {l:"Magasins", v:String(Object.keys(AH.storesMonth).length), d:"ce mois"} ] };
        } else if(mode==="hausse"){
          var hs=AH.list.filter(function(P){ return P.nBuy>=2 && Math.abs(P.evo)>=0.5; }).sort(function(a,b){ return b.evo-a.evo; });
          chart+=hs.length ? hs.map(function(P){ return line(P, esc(fmtK(P.firstPrice))+' → '+esc(fmtK(P.lastPrice)), (P.evo>0?'▲ +':'▼ ')+String(Math.round(P.evo*10)/10).replace(".",",")+' %', (P.evo>0?'var(--coral)':'var(--accent)')); }).join("")+'<div class="cch-note">Prix d\'une ligne, premier achat → dernier, sur 12 mois · les hausses en premier</div>'
                           : '<div class="cch-note" style="margin:24px 0">Pas encore d\'évolution : il faut avoir acheté un article au moins deux fois.</div>';
          var nUp=hs.filter(function(P){ return P.evo>0; }).length, nDn=hs.length-nUp;
          heroO={ label:"Évolution des prix · 12 mois", big:null, bigTxt:(hs.length?(nUp+" en hausse"):"—"), sub:nDn+" en baisse · "+AH.list.filter(function(P){ return P.nBuy>=2; }).length+" articles suivis",
            stats:[ {l:"Plus forte hausse", keep:1, v:(hs[0]&&hs[0].evo>0?esc(hs[0].name):"—"), d:(hs[0]&&hs[0].evo>0?"+"+String(Math.round(hs[0].evo*10)/10).replace(".",",")+" %":"")}, {l:"Plus forte baisse", keep:1, v:(nDn?esc(hs[hs.length-1].name):"—"), d:(nDn?String(Math.round(hs[hs.length-1].evo*10)/10).replace(".",",")+" %":"")}, {l:"Hausse moyenne", v:(hs.length?(function(){ var t=0; hs.forEach(function(P){ t+=P.evo; }); var m=t/hs.length; return (m>=0?"+":"")+String(Math.round(m*10)/10).replace(".",",")+" %"; })():"—"), d:"des articles suivis"} ] };
        } else if(mode==="bud"){
          // Budgets : catégories de tickets du mois, avec leur budget
          var BG=budgetsChart(month);
          chart+=BG.html+(fyRO()?'':'<button type="button" class="bud-edit" id="budEdit">'+(BG.nBud||Object.keys(budgetsP).length?"✎ Modifier les budgets":"＋ Fixer des budgets")+'</button>');
          // refonte : « Dépensé en octobre · 1 338 € sur 1 485 € · Encore 147 € pour 25 jours » (plus de cases Budgets / Dépassés / Reste)
          var bLeft=BG.tot-BG.spent, bDays=(month===curM)?(new Date(+month.slice(0,4), +month.slice(5,7), 0).getDate()-new Date(todayISO()).getDate()+1):0, bLine="";
          if(BG.nBud) bLine = bLeft<0 ? '<span style="color:var(--coral)">Dépassé de '+fmtK(-bLeft)+'</span>' : '<span style="color:var(--accent)">Encore '+fmtK(bLeft)+'</span>'+(bDays>0?' pour '+bDays+' jour'+(bDays>1?'s':''):(month<curM?' · mois terminé':''));
          heroO={ label:(BG.nBud?"Dépensé en "+esc(monthLabelOf(month).split(" ")[0])+(BG.who?" · "+esc(BG.who.replace(/^du /,"").replace(/^de /,"")):""):BG.label), big:BG.spent, sub:(BG.nBud?"sur "+fmtK(BG.tot)+" de budget"+(BG.nOver?' · <span style="color:var(--coral)">'+BG.nOver+' dépassé'+(BG.nOver>1?'s':'')+'</span>':''):BG.sub)+(bLine?'<div class="bud-left">'+bLine+'</div>':''),
            stats:(affDet() ? [ {l:"Budgets", v:String(BG.nBud)}, {l:"Dépassés", v:String(BG.nOver), c:(BG.nOver?"var(--coral)":"")}, {l:"Reste", v:(BG.nBud?fmtS(Math.max(0,BG.tot-BG.spent)):"—")} ] : []) };
        } else if(mode==="fam"){
          // Familles : camembert du mois
          var pos=D.famKeys.filter(function(f){ return D.fams[f].total>0; }), pt=pos.reduce(function(t,f){ return t+D.fams[f].total; },0);
          chart+='<div class="cdon cdon-big">'+compteDonutSVG(pos.map(function(f){ return { v:D.fams[f].total, col:col[f], k:f }; }), pt).replace("dépensés","d'articles")+'<div class="cdon-l">'+
            pos.map(function(f){ return '<div class="cdon-r" data-k="'+esc(f)+'" style="cursor:pointer"><i class="cdot" style="background:'+col[f]+';margin:0"></i><span class="n">'+esc(f)+'</span><span class="p">'+Math.round(D.fams[f].total/(pt||1)*100)+' %</span><span class="a">'+cptK(D.fams[f].total)+'</span></div>'; }).join("")+'</div></div>';
          chart+='<div class="cch-note">Répartition des articles du mois par catégorie · touche une catégorie pour son détail</div>';
          heroO={ label:"Catégories des articles", big:D.grand, sub:D.nArt+" article"+(D.nArt>1?"s":"")+" · "+pos.length+" catégorie"+(pos.length>1?"s":""),
            stats:[ {l:"Le plus acheté", keep:1, v:(D.most?esc(D.most.name):"—"), d:(D.most?"×"+D.most.n:"")}, {l:"Le plus cher", v:(D.top?esc(D.top.name):"—"), d:(D.top?fmtS(D.top.amt):"")}, {l:"Prix moyen", v:fmtS(D.nArt?D.grand/D.nArt:0), d:"par article"} ] };
        } else {
          // Magasins : où partent les achats d'articles du mois (noms de magasin regroupés)
          var SM=AH.storesMonth, sl2=Object.keys(SM).map(function(k){ return SM[k]; }).sort(function(a,b){ return b.sum-a.sum; }), smT=0, smN=0, smMax=sl2.length?sl2[0].sum:1;
          sl2.forEach(function(x){ smT+=x.sum; smN+=x.nT; });
          chart+=sl2.length ? sl2.map(function(x, ix){ var pc=Math.max(2, Math.round(x.sum/smMax*100));
              return '<div class="bar-row magrow" data-s="'+esc(x.name)+'" style="margin:10px 2px;cursor:pointer"><div class="bar-top"><span class="bl">'+esc(x.name)+' <small class="muted">'+x.nT+' passage'+(x.nT>1?'s':'')+' · '+x.nA+' article'+(x.nA>1?'s':'')+'</small></span><span class="bv">'+fmtK(x.sum)+' <small class="muted">'+Math.round(x.sum/(smT||1)*100)+' %</small></span></div><div class="bar-track"><i style="width:'+pc+'%;background:'+["#7c9cf4","#e0a458","#4fd6a0","#c78bd6","#5bc0d4","#e88fb0","#9bd35e","#d4a05b"][ix%8]+'"></i></div></div>'; }).join("")+'<div class="cch-note">Montant des articles achetés dans chaque magasin ce mois-ci · touche un magasin pour ses passages</div>'
                            : '<div class="cch-note" style="margin:24px 0">Aucun article ce mois-ci.</div>';
          var top2=sl2.slice().sort(function(a,b){ return b.nT-a.nT; })[0];
          heroO={ label:"Magasins du mois", big:smT, sub:sl2.length+" magasin"+(sl2.length>1?"s":"")+" · "+smN+" passage"+(smN>1?"s":""),
            stats:[ {l:"Magasin principal", v:(sl2[0]?esc(sl2[0].name):"—"), d:(sl2[0]?Math.round(sl2[0].sum/(smT||1)*100)+" % des achats":"")}, {l:"Le plus fréquenté", v:(top2?esc(top2.name):"—"), d:(top2?top2.nT+" passage"+(top2.nT>1?"s":""):"")}, {l:"Panier moyen", v:fmtS(smN?smT/smN:0), d:"par passage"} ] };
        }
        chart+='</div>';
        if(!aSub && !budOnly) h+=tabTools(artTools);   // Budgets : « Modifier les budgets » est en bas de la carte
        if(!aSub){ var ho={ label:heroO.label, big:(heroO.big==null?0:heroO.big), sub:heroO.sub, extra:chart, stats:heroO.stats }, hh=tabHero(ho);
          if(heroO.big==null) hh=hh.replace(/<div class="dash-big"[^>]*>[\s\S]*?<\/div>/, '<div class="dash-big" style="margin-top:6px;color:var(--ink)">'+esc(heroO.bigTxt)+'</div>');
          h+=hh; }
        // ---- familles repliables
        var open=state.artOpen||(state.artOpen={});
        var famH='<section class="paper cacc">';
        D.famKeys.forEach(function(f){
          var F=D.fams[f], names=Object.keys(F.items).sort(function(a,b){ return F.items[b].total-F.items[a].total; }), pc=D.grand?Math.round(F.total/D.grand*100):0;
          var body=names.map(function(nm){ var it=F.items[nm]; return '<div class="arow artclk" data-fam="'+esc(f)+'" data-name="'+esc(nm)+'"><span class="n">'+esc(nm)+'</span><span class="q">×'+it.n+'</span><span class="a">'+fmtK(it.total)+'</span><span class="c">›</span></div>'; }).join("");
          famH+='<div class="dgrp'+(open[f]?' open':'')+'" data-g="'+esc(f)+'"><div class="dgh"><i class="cdot" style="background:'+col[f]+';margin:0"></i><span class="t">'+esc(f)+'<em class="ds">'+names.length+' article'+(names.length>1?'s':'')+' · '+F.n+' achat'+(F.n>1?'s':'')+(f!=="Remise"?' · '+pc+' %':'')+'</em></span><span class="v">'+fmtK(F.total)+'</span><span class="chev">›</span></div><div class="dgb">'+body+'</div></div>';
        });
        famH+='</section>';
        if(aSub==="fam") h+='<div class="muted" style="font-size:12px;margin:12px 4px 0">Touche une catégorie pour la déplier, puis un article pour son détail.</div>'+famH;
        // ---- autres sous-pages
        function prow(P, sub, right){ return '<div class="arow artclk" data-fam="'+esc(P.fam)+'" data-name="'+esc(P.name)+'"><span class="n">'+esc(P.name)+'<small style="display:block;font-size:10.5px;color:var(--muted);font-weight:500">'+sub+'</small></span><span class="a">'+right+'</span><span class="c">›</span></div>'; }
        if(aSub==="prods"){ var mp2=AH.list.filter(function(P){ return P.nMonth>0; }).sort(function(a,b){ return b.totMonth-a.totMonth; });
          h+='<div class="muted" style="font-size:12px;margin:12px 4px 0">'+mp2.length+' article'+(mp2.length>1?'s':'')+' ce mois · touche un article pour sa fiche</div><section class="paper cacc" style="padding:4px 14px">'+
            mp2.map(function(P){ return prow(P, esc(P.fam)+' · ×'+P.nMonth+(P.lastStore?' · '+esc(P.lastStore):'')+' · dernier '+esc(fmtK(P.lastPrice)), fmtK(P.totMonth)); }).join("")+'</section>'; }
        if(aSub==="prix"){ var ps2=AH.list.filter(function(P){ return P.nBuy>=2; }).sort(function(a,b){ return b.evo-a.evo; });
          h+='<div class="muted" style="font-size:12px;margin:12px 4px 0">'+ps2.length+' article'+(ps2.length>1?'s':'')+' achetés au moins 2 fois (12 mois) · touche un article pour sa fiche</div><section class="paper cacc" style="padding:4px 14px">'+
            ps2.map(function(P){ var ev=Math.abs(P.evo)>=0.5 ? '<span style="color:'+(P.evo>0?'var(--coral)':'var(--accent)')+'">'+(P.evo>0?'▲ +':'▼ ')+String(Math.round(P.evo*10)/10).replace(".",",")+' %</span>' : '<span class="muted">=</span>';
              return prow(P, esc(fmtK(P.firstPrice))+' → '+esc(fmtK(P.lastPrice))+' · '+P.nBuy+' achats', ev); }).join("")+'</section>'; }
        if(aSub==="mags"){ var byId={}; state.entries.forEach(function(e){ byId[e.id]=e; }); var mo2=state.magOpen||(state.magOpen={});
          var SMl=Object.keys(AH.storesMonth).map(function(k){ return AH.storesMonth[k]; }).sort(function(a,b){ return b.sum-a.sum; });
          h+='<div class="muted" style="font-size:12px;margin:12px 4px 0">Touche un magasin pour voir ses passages du mois, puis un passage pour ouvrir le ticket.</div><section class="paper cacc">';
          SMl.forEach(function(x, ix){ var tk=Object.keys(x.t).map(function(id){ return byId[id]; }).filter(Boolean).sort(function(a,b){ return String(b.date||"").localeCompare(String(a.date||"")); });
            var body=tk.map(function(e){ var dd=(e.date||"").split("-"), na=(e.articles||[]).length; return '<div class="entry ecomp" data-id="'+esc(e.id)+'"><span class="n">'+esc(dd.length===3?dd[2]+"/"+dd[1]:"")+' · '+esc(e.marchand||"")+'<small>'+na+' article'+(na>1?'s':'')+'</small></span><span class="a">'+fmtK(e.montant)+'</span></div>'; }).join("");
            h+='<div class="dgrp'+(mo2[x.name]?' open':'')+'" data-g="'+esc(x.name)+'" data-k="mag"><div class="dgh"><i class="cdot" style="background:'+["#7c9cf4","#e0a458","#4fd6a0","#c78bd6","#5bc0d4","#e88fb0","#9bd35e","#d4a05b"][ix%8]+';margin:0"></i><span class="t">'+esc(x.name)+'<em class="ds">'+x.nT+' passage'+(x.nT>1?'s':'')+' · '+x.nA+' article'+(x.nA>1?'s':'')+'</em></span><span class="v">'+fmtK(x.sum)+'</span><span class="chev">›</span></div><div class="dgb">'+body+'</div></div>'; });
          h+='</section>'; }
      }
      if(!aSub && !budOnly && D.famKeys.length){ var bm=state.artChart||store.read("artChartDef","prod"), bb;
        if(bm==="prod"){ var np=AH.list.filter(function(P){ return P.nMonth>0; }).length; bb=["prods","🛒","Articles du mois · "+np, fmtK(D.grand)]; }
        else if(bm==="hausse"){ bb=["prix","📈","Prix suivis · "+AH.list.filter(function(P){ return P.nBuy>=2; }).length, ""]; }
        else if(bm==="mag"){ bb=["mags","🏪","Par magasin · "+Object.keys(AH.storesMonth).length, fmtK(D.grand)]; }
        else bb=["fam","🛒","Par catégorie · "+D.famKeys.length, fmtK(D.grand)];
        h+='<section class="paper cacc"><div class="cacc-sec"><div class="cacc-h" id="artfam" data-sub="'+bb[0]+'"><span class="t"><span class="tic">'+bb[1]+'</span> '+esc(bb[2])+'</span><span class="v">'+bb[3]+'</span><span class="ch">›</span></div></div></section>'; }

      app.innerHTML=h;
      if(aSub) bindBack(function(){ state.artSub=null; render(); window.scrollTo(0,0); });
      var arOn=document.querySelector(".thero .cch-tabs button.on"); if(arOn && arOn.parentNode){ var artb=arOn.parentNode; artb.scrollLeft=Math.max(0, arOn.offsetLeft-(artb.clientWidth-arOn.offsetWidth)/2); }
      var apb=document.getElementById("artProdBtn"); if(apb) apb.onclick=function(ev){ ev.stopPropagation(); state.artProd=!artProdOn(); store.write("artProd", state.artProd); render(); };
      var afm=document.getElementById("artfam"); if(afm) afm.onclick=function(){ state.artSub=afm.getAttribute("data-sub"); render(); window.scrollTo(0,0); };
      // graphiques touchables : un magasin → Par magasin (déplié) ; une famille → Par famille (dépliée)
      [].forEach.call(document.querySelectorAll(".thero .magrow"), function(r){ r.onclick=function(){ state.magOpen={}; state.magOpen[r.getAttribute("data-s")]=true; state.artSub="mags"; render(); window.scrollTo(0,0); }; });
      [].forEach.call(document.querySelectorAll(".thero .dseg, .thero .cdon-r[data-k]"), function(b){ b.style.cursor="pointer"; b.addEventListener("click", function(){ state.artOpen={}; state.artOpen[b.getAttribute("data-k")]=true; state.artSub="fam"; render(); window.scrollTo(0,0); }); });
      [].forEach.call(document.querySelectorAll(".entry[data-id]"), function(n){ n.onclick=function(){ editEntry(n.getAttribute("data-id")); }; });
      [].forEach.call(document.querySelectorAll(".dgrp .dgh"), function(hd){ hd.onclick=function(){ var g=hd.parentNode, k=g.getAttribute("data-g"), O=(g.getAttribute("data-k")==="mag") ? (state.magOpen||(state.magOpen={})) : (state.artOpen||(state.artOpen={})); O[k]=!O[k]; g.classList.toggle("open", !!O[k]); }; });
      [].forEach.call(document.querySelectorAll(".artclk"), function(row){ row.onclick=function(){ state.artSel={ fam:row.getAttribute("data-fam"), name:row.getAttribute("data-name") }; state.artDetM=null; state.view="artDetail"; render(); window.scrollTo(0,0); }; });
      wireChartDefaults();
      [].forEach.call(document.querySelectorAll(".cch-tabs button"), function(bt){ bt.onclick=function(){ state.artChart=bt.getAttribute("data-m"); render(); }; });
      [].forEach.call(document.querySelectorAll(".thero .catrow"), function(r){ r.onclick=function(){ if(!state.months) state.months={}; state.months.list=(month===curM?null:month); state.catFilter=r.getAttribute("data-cat"); state.listSub="tickets"; state.view="list"; render(); window.scrollTo(0,0); }; });
      var abe=document.getElementById("budEdit"); if(abe) abe.onclick=function(ev){ ev.stopPropagation(); editBudgets(month); };
      var ap=document.getElementById("artprod"); if(ap) ap.onclick=function(){ state.prodFrom="articles"; state.view="produits"; render(); window.scrollTo(0,0); };
      if(D.famKeys.length && !aSub) wireHeroSwipe(state.artChart||store.read("artChartDef","prod"), ["prod","hausse","mag","fam"], function(k){ state.artChart=k; });
      wireMonthNav(month, curM, "articles");
      if(!aSub) wireDepTabs();
      setNav("articles", true);
    }

    function renderArtDetail(){
      // Fiche produit : tous ses achats (anciens compris), regroupés par mois ; toucher une barre filtre sur ce mois
      var curM = monthKey(todayISO());
      var sel = state.artSel || {};
      var rows=[]; vEntries().forEach(function(e){ (e.articles||[]).forEach(function(a){ var c=classifyArticle(a); if(c.fam===sel.fam && c.name===sel.name) rows.push({ id:e.id, marchand:e.marchand, date:e.date||"", m:monthKey(e.date), label:(a.label||"").trim(), prix:c.amt }); }); });
      rows.sort(function(a,b){ return String(b.date).localeCompare(String(a.date)); });
      var byM={}; rows.forEach(function(r){ byM[r.m]=(byM[r.m]||0)+r.prix; });
      var ms=[], mk=curM; for(var i=0;i<12;i++){ ms.unshift(mk); mk=prevMonthKey(mk); }
      var fm=state.artDetM && byM[state.artDetM]!=null ? state.artDetM : null;
      var shown=fm ? rows.filter(function(r){ return r.m===fm; }) : rows;
      var tot=0; shown.forEach(function(r){ tot+=r.prix; });
      var last=rows[0];
      var h=header("articles");
      h+=tabHero({ label:esc(sel.name||"")+' · '+esc(sel.fam||"")+(fm?' · '+esc(monthLabelOf(fm)):' · tous les achats'), big:tot,
        sub:shown.length+" achat"+(shown.length>1?"s":"")+(shown.length?" · "+fmtK(tot/shown.length)+" en moyenne":"")+(last&&!fm?" · dernier "+fmtK(last.prix)+" chez "+esc(last.marchand||"?"):""),
        extra:'<div class="cch" style="margin-top:12px">'+artAvgBars(trimLead(ms.map(function(m){ return { m:m, lbl:artMShort(m), v:byM[m]||0 }; }), function(r){ return r.v; }), fm||curM)+'<div class="cch-note">Ce que cet article t\'a coûté par mois, sur 12 mois au plus · touche une barre pour ce mois</div></div>' });
      h+='<div class="bsec-h">'+(fm?'Achats de '+esc(monthLabelOf(fm)):'Tous les achats')+'<small>'+(fm?'<a href="#" id="artDetAll" style="color:var(--accent)">tout afficher</a>':'touche pour ouvrir le ticket')+'</small></div><section class="paper cacc" style="padding:2px 14px 6px">';
      if(!shown.length) h+='<div class="muted" style="font-size:12px;margin:12px 2px">Aucun achat de cet article.</div>';
      var curMo="";
      shown.forEach(function(r){ var dd=r.date.split("-");
        if(!fm && r.m!==curMo){ curMo=r.m; h+='<div class="dsub" style="display:flex;justify-content:space-between;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:12px 2px 4px"><span>'+esc(monthLabelOf(r.m))+'</span><span>'+fmtK(byM[r.m])+'</span></div>'; }
        h+='<div class="entry ecomp" data-id="'+esc(r.id)+'"><span class="n">'+esc(r.label||sel.name||"—")+'<small>'+esc(r.marchand||"")+'</small></span><span class="d">'+esc(dd.length===3?dd[2]+"/"+dd[1]+"/"+dd[0].slice(2):"")+'</span><span class="a">'+fmtK(r.prix)+'</span></div>'; });
      h+='</section>';
      app.innerHTML=h;
      bindBack(function(){ state.artDetM=null; state.view=state.artFrom||"articles"; state.artFrom=null; render(); window.scrollTo(0,0); });
      [].forEach.call(document.querySelectorAll(".entry[data-id]"), function(node){ node.onclick=function(){ editEntry(node.getAttribute("data-id")); }; });
      [].forEach.call(document.querySelectorAll(".barhit"), function(b){ b.style.cursor="pointer"; b.addEventListener("click", function(){ var m=b.getAttribute("data-m"); state.artDetM=(state.artDetM===m?null:m); render(); }); });
      var ada=document.getElementById("artDetAll"); if(ada) ada.onclick=function(ev){ ev.preventDefault(); state.artDetM=null; render(); };
      setNav("articles", true);
    }

    function uniquePersons(withArchived){
      var set={}, arr=[];
      function add(w){ w=(w||"").trim(); if(w && w!=="Commun" && !set[w] && (withArchived || !isArchived(w))){ set[w]=1; arr.push(w); } }
      personnes.forEach(function(x){ add(x.nom); });
      fraisCommuns.forEach(function(f){ add(f.personne); });
      state.entries.forEach(function(e){ add(e.payePar); });
      arr.sort(); return arr;
    }
    function addFraisCommun(){
      // Le frais commence au mois affiché (Commun ou Compte), passé ou futur ; il dure un mois, plusieurs mois ou sans fin
      var vm=(state.months && (state.view==="compte" ? state.months.compte : state.months.communes)) || monthKey(todayISO()), okM=/^[0-9]{4}-[0-9]{2}$/;
      uiForm({ title:"Nouveau frais fixe", fields:[
        {key:"label", label:"Nom", placeholder:"Loyer, Internet…", required:true},
        {key:"montant", label:"Montant", type:"money", required:true}
      ].concat(whoFields(null)).concat(payFields(null)).concat(acctFields("", "Commun")).concat([
        {key:"debut", label:"À partir de", type:"month", value:vm},
        {key:"dur", label:"Durée", type:"seg", value:"inf", options:[{v:"1",l:"Un mois"},{v:"n",l:"Plusieurs mois"},{v:"inf",l:"Sans fin"}],
          onChange:function(v,api){ api.show("fin", v==="n"); }},
        {key:"fin", label:"Jusqu'au mois (inclus)", type:"month", value:nextMonthKey(nextMonthKey(vm)), hidden:true},
        dayField(null, "Jour du prélèvement (facultatif)", "Range le frais dans la liste du compte. Vide : le jour où tu le coches « fait ».")
      ])}, function(r){
        var jd=dayRead(r); if(jd.err) return jd.err;
        var deb=okM.test(r.debut||"")?r.debut:vm, fin=null;
        if(r.dur==="n"){ if(!okM.test(r.fin||"")) return "Choisis le dernier mois."; if(r.fin<deb) return "Le dernier mois est avant le premier."; fin=r.fin; }
        var rec=(r.dur!=="1" && fin!==deb);
        var nf={ id:Date.now(), label:r.label, montant:r.montant, personne:whoOf(r), recurrent:rec, month: rec?null:deb };
        if(rec){ nf.startMonth=deb; if(fin) nf.endMonth=fin; }
        if(jd.v) nf.jour=jd.v;
        if(nf.personne==="Commun" && r.pay==="split") nf.split=true;
        else { var ak=acctPicked(r, nf.personne); if(ak) nf.compte=ak; }
        fraisCommuns.push(nf);
        persistFrais(); render();
      });
    }
    function editFraisCommun(id, mo){
      var f=fraisCommuns.filter(function(x){ return String(x.id)===String(id); })[0]; if(!f) return; if(!fyFraisCanEdit(f)){ uiToast("Frais d'un autre compte : en consultation seulement"); return; }
      var emonth=mo||(state.months&&state.months.communes)||monthKey(todayISO());
      var fpv=(f.prov!=null && provById(f.prov)) || null; if(fpv && f.provFrom && emonth<f.provFrom) emonth=f.provFrom;
      var cur=f.recurrent?fraisMontant(f, emonth):Number(f.montant)||0;
      // Parts de ce frais (frais Commun) : à partir du mois en cours
      var pm0=monthKey(todayISO()), P0=fraisPartsAt(f, pm0), isCom=((f.personne||"").trim()||"Commun")==="Commun";
      var pNames=uniquePersons(); if(pNames.indexOf(mePerson())<0) pNames.unshift(mePerson()); if(P0) Object.keys(P0).forEach(function(n){ if(pNames.indexOf(n)<0) pNames.push(n); });
      var partsFields=[{key:"rep", label:"Répartition de ce frais", type:"seg", value:(P0?"f":"g"), hidden:!isCom, options:[{v:"g",l:"Parts du commun"},{v:"f",l:"Parts de ce frais"}],
        help:"À partir de "+esc(monthLabelOf(pm0))+". Les mois précédents ne changent pas.",
        onChange:function(v,api){ pNames.forEach(function(n,i){ api.show("pp"+i, v==="f"); }); }}].concat(pNames.map(function(n,i){
          return {key:"pp"+i, label:n+" (%)", type:"qty", value:(P0?String(Math.round(partsPct(P0, n)*10)/10).replace(".",","):String(Math.round(communPct(n, pm0)*10)/10).replace(".",",")), hidden:!(isCom && P0)}; }));
      uiForm({ title:"Modifier le frais", fields:[
        {key:"label", label:"Nom", value:f.label, required:true},
        {key:"montant", label:"Montant", type:"money", value:cur, required:true, help:(fpv?"Mise de côté de la provision « "+esc(fpv.nom)+" », à partir de "+esc(monthLabelOf(emonth))+" : la provision suit.":(f.recurrent?"À partir de "+esc(monthLabelOf(emonth))+". Les mois précédents ne changent pas.":""))}
      ].concat(fpv?[]:f.recurrent?[{key:"debut", label:"Depuis le mois", type:"month", value:(fraisStart(f)||""), help:"Le frais n'est compté ni dans les comptes ni dans l'analyse avant ce mois."},
        {key:"fin", label:"Jusqu'au mois (inclus)", type:"month", value:(f.endMonth||""), help:"Vide = sans fin."}]:[{key:"mois", label:"Mois", type:"month", value:(f.month||"")}]).concat([dayField(f.jour||"", "Jour du prélèvement (facultatif)", "Range le frais dans la liste du compte. Vide : le jour où tu le coches « fait ».")]).concat(whoFields(f.personne||"Commun")).concat(payFields(f)).concat(acctFields(f.compte||"", f.personne||"Commun").map(function(x){ if(x.key==="acct" && f.split) x.hidden=true; return x; })).concat(partsFields)}, function(r){
        if(f.recurrent && /^[0-9]{4}-[0-9]{2}$/.test(r.fin||"")){ var d0=/^[0-9]{4}-[0-9]{2}$/.test(r.debut||"")?r.debut:fraisStart(f); if(d0 && r.fin<d0) return "Le dernier mois est avant le premier."; }
        var jd=dayRead(r); if(jd.err) return jd.err;
        f.label=r.label||f.label;
        if(jd.v) f.jour=jd.v; else delete f.jour;
        if(((whoOf(r)||"").trim()||"Commun")==="Commun"){
          var NP=null; if(r.rep==="f"){ NP={}; var nt=0; pNames.forEach(function(n,i){ var x=Number(r["pp"+i])||0; if(x>0){ NP[n]=x; nt+=x; } }); if(!(nt>0)) NP=null; }
          if(JSON.stringify(NP)!==JSON.stringify(P0)){ if(!f.parts) f.parts={}; f.parts[pm0]=NP; }
        }
        if(f.recurrent && /^[0-9]{4}-[0-9]{2}$/.test(r.debut||"")) f.startMonth=r.debut;
        if(f.recurrent){ if(/^[0-9]{4}-[0-9]{2}$/.test(r.fin||"")){ f.endMonth=r.fin; delete f.endByArchive; } else if(!r.fin && f.endMonth && !f.endByArchive) delete f.endMonth; }
        else if(/^[0-9]{4}-[0-9]{2}$/.test(r.mois||"")) f.month=r.mois;
        if(fpv){ if(Math.abs(r.montant-cur)>0.001){ if(!fpv.mensuelChanges) fpv.mensuelChanges={}; fpv.mensuelChanges[emonth]=r.montant; }
          var nn=String(r.label||"").replace(/^\s*provision\s*[·:\-]\s*/i, "").trim(); if(nn) fpv.nom=nn; persistProvisions(); }
        else if(f.recurrent){ if(Math.abs(r.montant-cur)>0.001){ if(!f.amounts) f.amounts={}; f.amounts[emonth]=r.montant; } }
        else f.montant=r.montant;
        f.personne=whoOf(r);
        if(f.personne==="Commun" && r.pay==="split"){ f.split=true; delete f.compte; }
        else { delete f.split; var ak=acctPicked(r, f.personne); if(ak) f.compte=ak; else delete f.compte; }
        persistFrais(); render();
      });
    }
    function delFraisCommun(id){
      var f=fraisCommuns.filter(function(x){ return String(x.id)===String(id); })[0]; if(!f) return; if(!fyFraisCanEdit(f)){ uiToast("Frais d'un autre compte : en consultation seulement"); return; }
      var fpv=f.prov!=null ? provById(f.prov) : null;
      if(fpv){
        var pm=(state.months&&state.months.communes)||monthKey(todayISO());
        uiChoice("« "+f.label+" »", "C'est la mise de côté de la provision « "+esc(fpv.nom)+" ».", [
          {l:"Sauter "+monthLabelOf(pm), fn:function(){ if(!fpv.skips) fpv.skips=[]; if(fpv.skips.indexOf(pm)<0) fpv.skips.push(pm); persistProvisions(); render(); uiToast("Rien mis de côté pour « "+fpv.nom+" » en "+monthLabelOf(pm)); }},
          {l:"Ne plus la compter dans les frais fixes", fn:function(){ fpv.noFrais=true; provFraisDetach(f); persistProvisions(); persistFrais(); render(); uiToast("« "+fpv.nom+" » continue, sans frais fixe"); }},
          {l:"Supprimer la provision « "+fpv.nom+" »", danger:true, fn:function(){ delProvision(fpv.id); }}
        ]);
        return;
      }
      if(f.recurrent){
        var dm=(state.months&&state.months.communes)||monthKey(todayISO());
        uiChoice("Arrêter « "+f.label+" »", "Les montants des mois passés peuvent être gardés.", [
          {l:"Retirer seulement en "+monthLabelOf(dm), fn:function(){ if(!f.skipMonths) f.skipMonths={}; f.skipMonths[dm]=1; persistFrais(); render(); uiToast("« "+f.label+" » retiré de "+monthLabelOf(dm)); }},
          {l:"Arrêter à partir de "+monthLabelOf(dm), fn:function(){ f.endMonth=prevMonthKey(dm); persistFrais(); render(); }},
          {l:"Supprimer de tous les mois", danger:true, fn:function(){ fraisCommuns=fraisCommuns.filter(function(x){ return String(x.id)!==String(id); }); persistFrais(); render(); }}
        ]);
        return;
      }
      uiConfirm("Supprimer le frais « "+esc(f.label)+" » ?", function(){
        fraisCommuns=fraisCommuns.filter(function(x){ return String(x.id)!==String(id); });
        persistFrais(); render();
      }, {ok:"Supprimer", danger:true});
    }
    // Réglage des parts du commun (en %) : − / + par 5 %, saisie directe, « Parts égales » ; le total doit faire 100 %
    function openCommunParts(ctx){
      var me=ctx.me, cands=[me], rest=[];
      function addR(n){ n=(n||"").trim(); if(n && n!=="Commun" && n!==me && rest.indexOf(n)<0) rest.push(n); }
      ctx.ppl.forEach(addR); uniquePersons().forEach(addR);
      if(communParts) Object.keys(communParts).forEach(function(p){ if((Number(communParts[p])||0)>0) addR(p); });
      cands=cands.concat(rest.sort(function(a,b){ return a.localeCompare(b,"fr"); }));
      function num2(v){ return Math.round(v*100)/100; }
      var draft={}; cands.forEach(function(p){ draft[p]=num2(ctx.pct(p)); });
      var h='<div class="sheet-title">Parts du commun</div><div class="ui-intro">Part de chacun dans les frais communs et les articles partagés. À 0 %, la personne ne paie que ses frais perso.</div>'+
        '<div class="cp-top"><button type="button" class="cp-eq">Parts égales</button><span class="cp-tot"></span></div><div class="cp-list">'+
        cands.map(function(p,i){ return '<div class="cp-r" data-i="'+i+'"><div class="cp-n"><span>'+esc(p)+(p===me?'<small>toi</small>':'')+'</span><div class="cp-bar"><i></i></div><em></em></div>'+
          '<button type="button" class="cp-m" aria-label="Baisser la part de '+esc(p)+'">−</button><span class="cp-in"><input type="text" inputmode="decimal" aria-label="Part de '+esc(p)+' en %"><i>%</i></span>'+
          '<button type="button" class="cp-p" aria-label="Augmenter la part de '+esc(p)+'">+</button></div>'; }).join("")+'</div>'+
        '<div class="ui-err" style="display:none"></div><div class="ui-actions"><button type="button" class="btn ghost ui-cancel">Annuler</button><button type="button" class="btn primary cp-ok">Valider</button></div>';
      var s=uiSheet(h);
      function total(){ var t=0; cands.forEach(function(p){ t+=draft[p]||0; }); return num2(t); }
      function paint(keepInp){
        var t=total(), ok=Math.abs(t-100)<0.05, tt=s.q(".cp-tot");
        tt.textContent= ok ? "Total 100 % ✓" : "Total "+pctTxt(t)+" · "+(t<100?"il manque "+pctTxt(100-t):pctTxt(t-100)+" en trop");
        tt.style.color= ok ? "var(--accent)" : "var(--coral)";
        [].forEach.call(s.qa(".cp-r"), function(r){ var p=cands[+r.getAttribute("data-i")], v=draft[p]||0, inp=r.querySelector("input");
          r.querySelector(".cp-bar i").style.width=Math.min(100,v)+"%";
          r.querySelector("em").textContent="≈ "+fmtK(ctx.perso(p)+ctx.pot*v/100)+" ce mois";
          if(inp!==keepInp) inp.value=String(num2(v)).replace(".",",");
          r.querySelector(".cp-m").disabled=(v<=0); r.querySelector(".cp-p").disabled=(v>=100); });
        s.q(".cp-ok").style.opacity=ok?"":".45";
        s.q(".ui-err").style.display="none";
      }
      [].forEach.call(s.qa(".cp-r"), function(r){ var p=cands[+r.getAttribute("data-i")], inp=r.querySelector("input");
        function step(d){ var v=draft[p]||0; v=(d>0) ? Math.floor((v+0.001)/5)*5+5 : Math.ceil((v-0.001)/5)*5-5; draft[p]=Math.max(0, Math.min(100, v)); paint(); }
        r.querySelector(".cp-m").onclick=function(){ step(-1); };
        r.querySelector(".cp-p").onclick=function(){ step(1); };
        inp.addEventListener("input", function(){ var v=num(inp.value); draft[p]=(isNaN(v)||v===null)?0:Math.max(0, Math.min(100, v)); paint(inp); });
        inp.addEventListener("blur", function(){ paint(); });
      });
      s.q(".cp-eq").onclick=function(){ var e=num2(100/cands.length); cands.forEach(function(p){ draft[p]=e; }); paint(); };
      s.q(".ui-cancel").onclick=s.close;
      s.q(".cp-ok").onclick=function(){ var t=total();
        if(Math.abs(t-100)>=0.05){ var er=s.q(".ui-err"); er.textContent="Le total doit faire 100 % (il fait "+pctTxt(t)+")."; er.style.display=""; return; }
        var np={}; cands.forEach(function(p){ if((draft[p]||0)>0) np[p]=num2(draft[p]); });
        communParts=np; persistParts(); s.close(); render(); uiToast("Parts du commun enregistrées"); };
      paint();
    }
    // Commun d'un mois : frais, articles partagés, personnes et parts (utilisé par l'onglet Commun et les widgets)
    function communModel(month){
      function monthData(m){
        var frais=fraisCommuns.filter(function(f){ return fraisActif(f, m); }), byP={}, fraisTot=0;
        frais.forEach(function(f){ var who=(f.personne||"").trim()||"Commun"; if(!byP[who]) byP[who]={ total:0, items:[] }; var v=fraisPartV(f, m); byP[who].total+=v; byP[who].items.push(f); fraisTot+=v; });
        var rows=[], prod=0;
        entriesOfMonth(m).forEach(function(e){
          (e.articles||[]).forEach(function(a){ if(!a.commun) return; var amt=Number(a.prix)||0;
            rows.push({ id:e.id, marchand:e.marchand, date:e.date, label:artName(a), prix:amt, sh:e.share||null }); prod+=amt; });
        });
        rows.sort(function(a,b){ return String(b.date||"").localeCompare(String(a.date||"")); });
        return { frais:frais, byP:byP, fraisTot:fraisTot, rows:rows, prod:prod, commun:(byP.Commun?byP.Commun.total:0) };
      }
      var D=monthData(month);
      var totPersons=[];
      fraisCommuns.forEach(function(f){ var fp=(f.personne||"").trim(); if(fp && fp!=="Commun" && totPersons.indexOf(fp)<0) totPersons.push(fp); });
      ticketPayers().forEach(function(pp){ if(totPersons.indexOf(pp)<0) totPersons.push(pp); });
      totPersons=totPersons.filter(function(p){ var r=personRec(p); return !(r && r.archived) || month<r.archived || (D.byP[p] && D.byP[p].items.length); });
      totPersons.sort();
      var me=mePerson(); if(totPersons.indexOf(me)<0) totPersons.unshift(me);
      var ppl=[me].concat(totPersons.filter(function(p){ return p!==me; }));
      function persoOf(who){ return D.byP[who]?D.byP[who].total:0; }
      // Parts du commun : celles réglées (en %), sinon parts égales entre les personnes du commun
      var CP=(communParts && typeof communParts==="object") ? communParts : null;
      if(CP){ var CPa={}; Object.keys(CP).forEach(function(n){ var r=personRec(n); if(r && r.archived && month>r.archived) return; CPa[n]=CP[n]; }); CP=CPa; }   // supprimée : plus de part après son dernier mois
      if(CP) Object.keys(CP).forEach(function(n){ if((Number(CP[n])||0)>0 && ppl.indexOf(n)<0) ppl.push(n); });
      (D.byP.Commun?D.byP.Commun.items:[]).forEach(function(f){ var P=fraisPartsAt(f, month); if(P) Object.keys(P).forEach(function(n){ if((Number(P[n])||0)>0 && ppl.indexOf(n)<0) ppl.push(n); }); });
      D.rows.forEach(function(r){ if(r.sh) Object.keys(r.sh).forEach(function(n){ if((Number(r.sh[n])||0)>0 && ppl.indexOf(n)<0) ppl.push(n); }); });
      var cpSum=0; if(CP) Object.keys(CP).forEach(function(n){ cpSum+=Math.max(0, Number(CP[n])||0); });
      if(CP && cpSum<=0) CP=null;
      // ramené à 100 % pile (3 × 33,33 % = 99,99 %) pour que les parts fassent exactement le total
      function pctOf(who){ if(CP) return Math.max(0, Number(CP[who])||0)/cpSum*100; return ppl.indexOf(who)>=0 ? 100/ppl.length : 0; }
      function fPct(f, who){ var P=fraisPartsAt(f, month); return P ? partsPct(P, who) : pctOf(who); }
      // Part des frais communs : frais par frais (chacun peut avoir ses parts)
      function communShareOf(who){ var t=0; (D.byP.Commun?D.byP.Commun.items:[]).forEach(function(f){ t+=fraisPartV(f, month)*fPct(f, who)/100; }); return t; }
      // Articles partagés : entre les personnes choisies sur le ticket (« Partagé avec »), sinon selon les parts du commun
      function prodPartIn(d, who){ var t=0; d.rows.forEach(function(r){ t+=r.prix*(r.sh ? partsPct(r.sh, who) : pctOf(who))/100; }); return t; }
      function prodShareOf(who){ return prodPartIn(D, who); }
      function shareOf(who){ return communShareOf(who)+prodShareOf(who); }
      function partOf(who){ return persoOf(who)+shareOf(who); }
      // Part réelle sur tout le commun (frais + produits), en %
      function effPct(who){ var pot=D.commun+D.prod; return pot>0 ? shareOf(who)/pot*100 : pctOf(who); }
      return { monthData:monthData, D:D, me:me, ppl:ppl, CP:CP, persoOf:persoOf, pctOf:pctOf, fPct:fPct, communShareOf:communShareOf, effPct:effPct, shareOf:shareOf, partOf:partOf, prodShareOf:prodShareOf, prodPartIn:prodPartIn };
    }
