    // ---------- Analyse avancée (Tickets Plus) ----------
    // Tout est calculé sur le téléphone. Seule l'inflation officielle (INSEE, publique) passe par le relais.
    var avMemo=null;
    function avComptes(){   // comptes pris en compte : tous (foyer) ou ceux de la personne affichée
      var pv=pvCur(), real=comptes.filter(function(a){ return a.key!=="__tickets"; });
      if(pv==="all") return real;
      var who=pvName(pv), l=real.filter(function(a){ return acctOwner(a)===who; });
      return l.length ? l : (pv==="moi" ? [myAcct()] : []);
    }
    function avOwnerOk(x){ var pv=pvCur(); return pv==="all" || ownerOf(x)===pvName(pv); }
    function avNorm(x){ x=String(x||"").toLowerCase(); try{ x=x.normalize("NFD").replace(/[̀-ͯ]/g,""); }catch(e){} return x.replace(/[^a-z ]+/g," ").replace(/\s+/g," ").trim(); }
    function avBack(m, n){ for(var i=0;i<n;i++) m=prevMonthKey(m); return m; }
    function avData(){
      if(avMemo) return avMemo;
      var curM=monthKey(todayISO()), E=vEntries(), i, D={ curM:curM };
      var ms12=[], m=curM; for(i=0;i<12;i++){ ms12.unshift(m); m=prevMonthKey(m); }
      var in12={}; ms12.forEach(function(x){ in12[x]=1; });
      var byM={}; E.forEach(function(e){ var k=monthKey(e.date); (byM[k]=byM[k]||[]).push(e); });
      D.hasData=E.length>0;

      // --- 1. Inflation personnelle : prix d'une ligne, premier mois d'achat → dernier, pondéré par ce qu'on y dépense
      var P={};
      var FUEL=/\b(gasoil|gazole|diesel|essence|sans plomb|carburant|fioul|gpl|superethanol)\b/;   // avNorm retire les chiffres (sp95, e10 → lus par « essence » / la catégorie)
      ms12.forEach(function(mk){ (byM[mk]||[]).forEach(function(e){ if(FUEL.test(avNorm(e.categorie))) return; (e.articles||[]).forEach(function(a){ var c=classifyArticle(a); if(c.fam==="Remise" || !(c.amt>0)) return;
        if(FUEL.test(avNorm(c.name)+" "+avNorm(c.fam)+" "+avNorm(a.label))) return;   // carburant : on paie un volume, pas un prix unitaire
        var lb=avNorm(a.label||""), k=c.fam+"|"+c.name+"|"+(lb||"-")+"|"+(avNorm(e.marchand).split(" ")[0]||"?"),   /* même article dans le même magasin */ o=P[k]||(P[k]={ name:c.name, lbl:(a.label||"").trim(), fam:c.fam, spend:0, m:{}, st:{} }); o.spend+=c.amt;   // même article (même libellé), pas seulement le même produit
        var x=o.m[mk]||(o.m[mk]={ s:0, n:0 }); x.s+=c.amt; x.n++; if(e.marchand) o.st[mk]=e.marchand; }); }); });
      var items=[], sw=0, se=0;
      Object.keys(P).forEach(function(k){ var o=P[k], mm=Object.keys(o.m).sort(); if(mm.length<2) return;
        var p0=o.m[mm[0]].s/o.m[mm[0]].n, p1=o.m[mm[mm.length-1]].s/o.m[mm[mm.length-1]].n; if(!(p0>0)) return;
        var r=p1/p0; if(r<0.77 || r>1.3) return;   // écart de plus de 30 % : autre quantité ou autre article, pas une hausse de prix
        var evo=r-1;
        o.p0=p0; o.p1=p1; o.evo=evo; o.base=p0; o.first=mm[0]; o.lastM=mm[mm.length-1]; o.st1=o.st[mm[mm.length-1]]||""; items.push(o); sw+=o.spend; se+=o.spend*evo; });
      D.infl={ n:items.length, rate:(sw>0?se/sw:null) };
      var ups=items.filter(function(o){ return o.evo>0.005; }).sort(function(a,b){ return b.evo-a.evo; }), dns=items.filter(function(o){ return o.evo<-0.005; }).sort(function(a,b){ return a.evo-b.evo; });
      D.infl.top=ups.slice(0,2).concat(dns.slice(0,1)); D.infl.all=items.slice().sort(function(a,b){ return b.evo-a.evo; });
      // indice mois par mois (base 100 au premier mois)
      var idx=[], lastI=100;
      ms12.forEach(function(mk, j){ var w=0, s=0; items.forEach(function(o){ if(o.first<mk && o.m[mk]){ var p=o.m[mk].s/o.m[mk].n; w+=o.spend; s+=o.spend*Math.max(0.4, Math.min(1.6, p/o.base)); } });
        if(j===0){ idx.push(100); return; } if(w>0) lastI=s/w*100; idx.push(lastI); });
      D.infl.idx=idx; D.ms12=ms12;

      // --- 2. Cette année contre l'an dernier (mêmes mois, tickets par catégorie)
      var Y=+curM.slice(0,4), mo=+curM.slice(5,7), cy={}, py={}, tc=0, tp=0;
      for(i=1;i<=mo;i++){ var k1=Y+"-"+(i<10?"0":"")+i, k0=(Y-1)+"-"+(i<10?"0":"")+i;
        (byM[k1]||[]).forEach(function(e){ var v=Number(e.montant)||0; cy[e.categorie||"Autre"]=(cy[e.categorie||"Autre"]||0)+v; tc+=v; });
        (byM[k0]||[]).forEach(function(e){ var v=Number(e.montant)||0; py[e.categorie||"Autre"]=(py[e.categorie||"Autre"]||0)+v; tp+=v; }); }
      var cats=Object.keys(cy).concat(Object.keys(py)).filter(function(c,ix,a){ return a.indexOf(c)===ix; }).sort(function(a,b){ return Math.max(cy[b]||0,py[b]||0)-Math.max(cy[a]||0,py[a]||0); }).slice(0,5);
      var bigCh=null; cats.forEach(function(c){ var a=py[c]||0, b=cy[c]||0; if(a>=30){ var ch=(b-a)/a; if(!bigCh || Math.abs(ch)>Math.abs(bigCh.ch)) bigCh={ c:c, ch:ch }; } });
      D.yoy={ Y:Y, mo:mo, cats:cats, cy:cy, py:py, tc:tc, tp:tp, big:bigCh, has:tp>0 };

      // --- 3. À surveiller ce mois-ci
      var al=[], catM={}; (byM[curM]||[]).forEach(function(e){ catM[e.categorie||"Autre"]=(catM[e.categorie||"Autre"]||0)+(Number(e.montant)||0); });
      var prev6=[]; m=curM; for(i=0;i<6;i++){ m=prevMonthKey(m); prev6.push(m); }
      var nPrev=prev6.filter(function(x){ return (byM[x]||[]).length; }).length;
      if(nPrev>=3) Object.keys(catM).forEach(function(c){ var s=0; prev6.forEach(function(x){ (byM[x]||[]).forEach(function(e){ if((e.categorie||"Autre")===c) s+=Number(e.montant)||0; }); });
        var avg=s/nPrev, v=catM[c]; if(avg>0 && v>avg*1.3 && v-avg>=30) al.push({ ic:"⚠", sort:v-avg, t:esc(c)+' <span class="up">+'+Math.round((v/avg-1)*100)+' %</span> au-dessus de ta moyenne', d:fmtK(v)+" contre "+fmtK(avg)+" en moyenne sur "+nPrev+" mois" }); });
      fraisCommuns.forEach(function(f){ if(!f.recurrent || !fraisActif(f, curM)) return; var b=fraisMontant(f, curM), m3=avBack(curM,3); if(!fraisActif(f, m3)) return; var a=fraisMontant(f, m3);
        if(b>a+0.005) al.push({ ic:"↗", sort:(b-a)*12, t:'« '+esc(f.label)+' » passé de '+fmtK(a)+' à <span class="am">'+fmtK(b)+'</span>', d:"+"+fmtK((b-a)*12)+" par an" }); });
      var seen={}; for(i=1;i<=12;i++){ (byM[avBack(curM,i)]||[]).forEach(function(e){ seen[avNorm(e.marchand).split(" ")[0]]=1; }); }
      if(Object.keys(seen).length){ var nw={}; (byM[curM]||[]).forEach(function(e){ var k=avNorm(e.marchand).split(" ")[0]; if(!k || seen[k]) return; var o=nw[k]||(nw[k]={ n:e.marchand, v:0 }); o.v+=Number(e.montant)||0; });
        Object.keys(nw).forEach(function(k){ if(nw[k].v>=20) al.push({ ic:"✦", sort:nw[k].v/2, t:'Nouvelle dépense : « '+esc(nw[k].n)+' » '+fmtK(nw[k].v), d:"jamais vue dans les 12 derniers mois" }); }); }
      al.sort(function(a,b){ return b.sort-a.sort; }); D.alerts=al.slice(0,5);

      // --- 4. Épargne et reste à vivre (6 derniers mois terminés, comptes de la personne ou du foyer)
      var per=state.avPer||store.read("avPer","6"); if(["1","6","12","all"].indexOf(per)<0) per="6";
      var A=avComptes(), inc=0, exp=0, fx=0, nInc=0, last6=[], nPer=(per==="all"?120:+per), stA=null;
      A.forEach(function(a){ var s0=acctStart(a.key); if(s0 && (!stA || s0<stA)) stA=s0; });
      m=curM; for(i=0;i<nPer;i++){ m=prevMonthKey(m); if(stA && m<stA) break; last6.unshift(m); }   // mois terminés, depuis le début du suivi au plus
      last6.forEach(function(mk){ var mi=0; A.forEach(function(a){ virementsOf(a.key, mk).forEach(function(v){ var x=Number(v.montant)||0; if(x>0) mi+=x; }); exp+=computeDepensesMonth(a.key, mk);
          fraisCommuns.forEach(function(f){ if(fraisActif(f, mk) && fraisKind(f, a.key)) fx+=fraisAcctAmt(f, a.key, mk); }); });
        if(mi>0){ inc+=mi; nInc++; } });
      D.save={ has:inc>0, rate:(inc>0?(inc-exp)/inc:null), rav:(nInc?(inc-fx)/nInc:null), fx:fx/Math.max(1,last6.length), inc:(nInc?inc/nInc:0), n:nInc, per:per, nM:last6.length, from:last6[0], to:last6[last6.length-1] };

      // --- 5. Pistes d'économies
      var eco=[];
      try{ artHistory(curM).list.forEach(function(Pr){ var sl=Pr.stores||[]; if(sl.length<2) return; var main=sl.slice().sort(function(a,b){ return b.n-a.n; })[0], ch=sl[0]; if(main===ch) return;
        var g=(main.avg-ch.avg)*main.n/12; if(g>=1) eco.push({ v:g, t:esc(Pr.name)+" moins cher chez "+esc(ch.name), d:"même article, "+fmtK(main.avg-ch.avg)+" de moins qu'à "+esc(main.name)+" · "+(Math.round(main.n/12*10)/10).toString().replace(".",",")+" achat(s) / mois" }); }); }catch(e){}
      var l3=[curM, avBack(curM,1), avBack(curM,2)], ly=[]; for(i=12;i<24;i++) ly.push(avBack(curM,i));
      var nLy=ly.filter(function(x){ return (byM[x]||[]).length; }).length;
      if(nLy>=6){ var c3={}, cL={}; l3.forEach(function(x){ (byM[x]||[]).forEach(function(e){ c3[e.categorie||"Autre"]=(c3[e.categorie||"Autre"]||0)+(Number(e.montant)||0)/3; }); });
        ly.forEach(function(x){ (byM[x]||[]).forEach(function(e){ cL[e.categorie||"Autre"]=(cL[e.categorie||"Autre"]||0)+(Number(e.montant)||0)/nLy; }); });
        Object.keys(c3).forEach(function(c){ var a=cL[c]||0, b=c3[c]; if(a>0 && b>a*1.15 && b-a>=15) eco.push({ v:b-a, t:esc(c)+" : revenir à ta moyenne "+(Y-1), d:fmtK(b)+" par mois ces 3 derniers mois contre "+fmtK(a)+" l'an dernier" }); }); }
      eco.sort(function(a,b){ return b.v-a.v; }); D.eco=eco.slice(0,4); D.ecoTot=D.eco.reduce(function(t,x){ return t+x.v; },0);

      // --- 6. Projection : compte(s) + épargne + provisions
      function bankAt(mk){ var t=0; A.forEach(function(a){ try{ t+=soldeFlow(a.key, mk).closing; }catch(e){} }); return t; }
      function epAtAll(mk){ var t=0; epargne.forEach(function(c){ if(avOwnerOk(c)) t+=epAt(c, mk); }); return t; }
      function provAt(mk){ try{ return provTotalAt(mk, avOwnerOk); }catch(e){ return 0; } }
      function provExtAt(mk){ return provSumWhere(mk, function(w, p){ return w==="ext" && avOwnerOk(p); }); }
      var past=[]; m=curM; for(i=0;i<6;i++){ past.unshift(m); m=prevMonthKey(m); }
      // les provisions sont mises de côté sur l'épargne : elles sont déjà dans son solde, on ne les ajoute pas une 2e fois
      var hist=past.map(function(mk){ var b=bankAt(mk), e2=epAtAll(mk), p2=provAt(mk); var px=provExtAt(mk); return { m:mk, bank:b, ep:e2, prov:p2, pext:px, tot:b+e2+px }; });   // seules les provisions « ailleurs » s'ajoutent
      while(hist.length>2 && Math.abs(hist[0].bank)<0.005 && Math.abs(hist[0].ep)<0.005) hist.shift();   // mois d'avant le début du suivi
      var dB=[], dT=[], dE=[]; for(i=hist.length-3;i<hist.length;i++){ if(i<1) continue; dB.push(hist[i].bank-hist[i-1].bank); dT.push(hist[i].tot-hist[i-1].tot); dE.push(hist[i].ep-hist[i-1].ep); }
      function mean(a){ return a.length?a.reduce(function(t,x){ return t+x; },0)/a.length:0; }
      function sd(a){ var mu=mean(a); return a.length>1?Math.sqrt(a.reduce(function(t,x){ return t+(x-mu)*(x-mu); },0)/(a.length-1)):0; }
      var H=12-mo; if(H<2) H=6; var hzM=curM; for(i=0;i<H;i++) hzM=nextMonthKey(hzM);
      var now=hist[hist.length-1], netT=mean(dT), sdT=sd(dT), fut=[];
      for(i=1;i<=H;i++){ var mk2=avBack(hzM, H-i); fut.push({ m:mk2, tot:now.tot+netT*i, lo:now.tot+netT*i-sdT*Math.sqrt(i), hi:now.tot+netT*i+sdT*Math.sqrt(i) }); }
      D.proj={ hist:hist, fut:fut, H:H, hzM:hzM, end:fut[fut.length-1], now:now, netT:netT, netB:mean(dB), netE:mean(dE), ok:A.length>0 };
      // mois les plus chers à venir : frais fixes + tickets attendus (saisonnalité de l'an dernier)
      var tk12=0, n12=0; ms12.forEach(function(x){ if((byM[x]||[]).length){ n12++; (byM[x]||[]).forEach(function(e){ tk12+=Number(e.montant)||0; }); } }); var tkAvg=n12?tk12/n12:0;
      var lyAvg=0, lyN=0; ly.forEach(function(x){ var s=0; (byM[x]||[]).forEach(function(e){ s+=Number(e.montant)||0; }); if(s>0){ lyAvg+=s; lyN++; } }); lyAvg=lyN?lyAvg/lyN:0;
      var nxt=[]; m=curM; for(i=0;i<3;i++){ m=nextMonthKey(m); var fxm=0, notes=[];
        A.forEach(function(a){ fraisCommuns.forEach(function(f){ if(fraisActif(f, m) && fraisKind(f, a.key)) fxm+=fraisAcctAmt(f, a.key, m); }); });
        var lyS=0; (byM[avBack(m,12)]||[]).forEach(function(e){ lyS+=Number(e.montant)||0; }); var seas=(lyAvg>0 && lyS>0)?lyS/lyAvg:1;
        if(seas>=1.2) notes.push("+"+Math.round((seas-1)*100)+" % de tickets l'an dernier ce mois-là");
        provisions.forEach(function(p){ if(!avOwnerOk(p) || !p.echeance) return; if(+m.slice(5,7)===+p.echeance) notes.push(esc(p.nom)+" (provision"+(p.prevu?" "+fmtK(p.prevu):"")+")"); });
        nxt.push({ m:m, v:fxm+tkAvg*seas, fx:fxm, est:seas!==1, notes:notes }); }
      D.next=nxt; D.tkAvg=tkAvg;
      // simulateur : catégorie la plus dépensée
      var cc={}; ms12.slice(-6).forEach(function(x){ (byM[x]||[]).forEach(function(e){ cc[e.categorie||"Autre"]=(cc[e.categorie||"Autre"]||0)+(Number(e.montant)||0)/6; }); });
      var topC=Object.keys(cc).sort(function(a,b){ return cc[b]-cc[a]; })[0]||null; D.topCat=topC?{ c:topC, v:cc[topC] }:null;
      avMemo=D; return D;
    }
    // Inflation officielle (INSEE) : demandée au relais une fois par jour, gardée sur le téléphone ;
    // dans l'appli Store, lue dans l'APK (insee.json, pris au relais à chaque compilation)
    var avInseeAsk=false;
    function avInsee(){
      var c=store.read("inseeIpc", null), cm=monthKey(todayISO()), old=!!(c && c.last && monthsBetween(c.last, cm)>4);   // chiffre trop ancien : on redemande
      if((!c || old || Date.now()-(c.t||0)>86400000) && !avInseeAsk && (appLocal() || coursApi())){ avInseeAsk=true;
        fetch(appLocal() ? "./insee.json" : coursApi()+"/inflation").then(function(r){ return r.json(); }).then(function(j){ if(j && j.ok && isFinite(j.yoy)){ store.write("inseeIpc", { t:Date.now(), yoy:j.yoy, last:j.last, series:j.series||[] }); if(state.view==="avancee") render(); } else store.write("inseeIpc", { t:Date.now()-82800000, none:1 }); }).catch(function(){}); }
      return (c && !c.none && isFinite(c.yoy) && !old) ? c : null;   // pas de comparaison avec un chiffre de plus de 4 mois
    }
    // petits graphiques
    function avLine(series, cols, opt){   // series : [[valeurs…], …] (null = trou) ; opt.band : [[lo,hi]…] sur la dernière série
      opt=opt||{}; var W=360, H=opt.h||90, all=[]; series.forEach(function(s){ s.forEach(function(v){ if(v!=null) all.push(v); }); }); if(opt.band) opt.band.forEach(function(b){ if(b){ all.push(b[0]); all.push(b[1]); } });
      if(!all.length) return ''; var lo=Math.min.apply(null, all), hi=Math.max.apply(null, all); if(hi-lo<1e-9){ hi+=1; lo-=1; } var pad=(hi-lo)*0.12; lo-=pad; hi+=pad;
      var n=opt.n||series[0].length; function X(i){ return n>1 ? i/(n-1)*W : W/2; } function Yv(v){ return H-(v-lo)/(hi-lo)*H; }
      var g='';
      if(opt.zero && lo<0 && hi>0) g+='<line x1="0" x2="'+W+'" y1="'+Yv(0).toFixed(1)+'" y2="'+Yv(0).toFixed(1)+'" stroke="rgba(236,238,243,.2)" stroke-dasharray="4 4"/>';
      if(opt.band){ var up='', dn=''; opt.band.forEach(function(b,i){ if(!b) return; up+=(up?' L':'M')+X(i).toFixed(1)+' '+Yv(b[1]).toFixed(1); dn=' L'+X(i).toFixed(1)+' '+Yv(b[0]).toFixed(1)+dn; }); if(up) g+='<path d="'+up+dn+' Z" fill="'+(opt.bandCol||'rgba(79,214,160,.16)')+'"/>'; }
      series.forEach(function(s, k){ var d=''; s.forEach(function(v,i){ if(v==null){ return; } d+=(d?' L':'M')+X(i).toFixed(1)+' '+Yv(v).toFixed(1); }); if(d) g+='<path d="'+d+'" fill="none" stroke="'+cols[k]+'" stroke-width="'+(k?2:2.6)+'"'+((opt.dash||[])[k]?' stroke-dasharray="6 5"':'')+' stroke-linejoin="round" stroke-linecap="round"/>'; });
      return '<svg viewBox="0 0 '+W+' '+H+'" width="100%" height="'+H+'" preserveAspectRatio="none" style="display:block;margin-top:8px;overflow:visible">'+g+'</svg>';
    }
    function avPct(x, d){ var v=Math.round(x*1000)/10; return (v>0?"+":(v<0?"−":""))+String(Math.abs(v).toFixed(d==null?1:d)).replace(".",",")+" %"; }
    function avCard(title, right, body, cls){ return '<section class="paper avc'+(cls?' '+cls:'')+'"><div class="avt"><span>'+title+'</span>'+(right?'<small>'+right+'</small>':'')+'</div>'+body+'</section>'; }
    function avRow(n, sub, v, cls){ return '<div class="avr"><span class="n">'+n+(sub?'<small>'+sub+'</small>':'')+'</span><span class="v'+(cls?' '+cls:'')+'">'+v+'</span></div>'; }
    function renderAvancee(){
      // Vue d'ensemble depuis Dépenses › Analyse ; Projection et Simuler depuis À venir (state.avFrom="factures")
      var fromAv=(state.avFrom==="factures"), curM=monthKey(todayISO()), sub=state.avSub||"vue";
      if(fromAv && sub==="vue") sub="proj"; if(!fromAv) sub="vue"; state.avSub=sub;
      var SUBS=fromAv ? [["proj","Projection"],["sim","Simuler"]] : [];
      var h=header(true, fromAv ? "Dans 12 mois" : "Analyse avancée")+pvBarHTML();
      if(SUBS.length) h+='<div class="avseg">'+SUBS.map(function(x){ return '<button type="button" data-s="'+x[0]+'"'+(x[0]===sub?' class="on"':'')+'>'+x[1]+'</button>'; }).join("")+'</div>';
      if(!canUse("avancee")){
        h+='<section class="fct-teaser"><h3>'+(fromAv?"Tes comptes dans 12 mois":"Analyse avancée")+'</h3><p>Calculé sur ton téléphone : rien n\'est envoyé.</p><ul>'+(fromAv?
             '<li>Ce qu\'il restera sur tes comptes et ton épargne, mois par mois</li><li>Simuler : « et si je dépensais moins en… ? »</li>':
             '<li>Ton inflation réelle, article par article</li><li>Cette année contre l\'an dernier</li><li>Alertes : hausses, abonnements, dépenses inhabituelles</li><li>Pistes d\'économies chiffrées</li>')+'</ul>'+
           '<button type="button" class="fct-plus" id="avBuy">✦ Débloquer avec '+APP_NAME+' Plus</button></section>';
        app.innerHTML=h; wireAv(); setNav(fromAv ? "factures" : "analyse", true); return;
      }
      var D=avData();
      if(!D.hasData){ h+='<section class="paper avc"><div class="center muted" style="font-size:12.5px;line-height:1.5;padding:16px 4px">Pas encore assez de tickets pour une analyse.<br>Scanne quelques mois de tickets et reviens ici.</div></section>'; app.innerHTML=h; wireAv(); setNav(state.avFrom==="factures" ? "factures" : "analyse", true); return; }
      if(sub==="vue"){
        // inflation
        var I=D.infl, ins=avInsee(), ib='';
        if(I.rate==null) ib='<div class="muted" style="font-size:12px;margin:8px 0 4px">Il faut avoir acheté le même article (même libellé sur le ticket) au moins deux mois différents.</div>';
        else {
          ib='<div class="avbig '+(I.rate>0.0005?'up':(I.rate<-0.0005?'dn':''))+'">'+avPct(I.rate)+'</div>';
          if(ins){ var gap=I.rate*100-ins.yoy; ib+='<div class="avsub">INSEE sur 12 mois : '+avPct(ins.yoy/100)+(Math.abs(gap)>=0.1?' · <span class="'+(gap>0?'up':'dn')+'">tu paies '+String(Math.abs(Math.round(gap*10)/10)).replace(".",",")+' pt'+(Math.abs(gap)>=2?'s':'')+' de '+(gap>0?'plus':'moins')+'</span>':' · comme la moyenne')+'</div>'; }
          else ib+='<div class="avsub">Hausse moyenne des prix de ce que tu achètes vraiment</div>';
          var insS=null; if(ins && ins.series && ins.series.length>=2){ var s0=null; insS=D.ms12.map(function(mk){ var o=ins.series.filter(function(x){ return x.m===mk; })[0]; if(!o) return null; if(s0==null) s0=o.v; return o.v/s0*100; }); if(insS.filter(function(v){ return v!=null; }).length<3) insS=null; }
          ib+=avLine(insS?[D.infl.idx, insS]:[D.infl.idx], ["#f4796b","#7d8492"], { dash:[false,true], h:70 });
          ib+='<div class="avleg"><span><i style="background:#f4796b"></i>Mes prix</span>'+(insS?'<span><i style="background:#7d8492"></i>INSEE</span>':(ins?'<span>INSEE : chiffre de '+esc(monthLabelOf(ins.last||curM))+'</span>':''))+'<span>'+esc(monthLabelOf(D.ms12[0]).split(" ")[0])+' → '+esc(monthLabelOf(curM).split(" ")[0])+'</span></div>';
          ib+=I.top.map(function(o){ return avRow(esc(o.name), (o.lbl && avNorm(o.lbl)!==avNorm(o.name)?esc(o.lbl)+' · ':'')+(o.st1?esc(o.st1)+' · ':'')+fmtK(o.p0)+' → '+fmtK(o.p1), avPct(o.evo,0), o.evo>0?'up':'dn'); }).join("");
          if(I.n>I.top.length) ib+='<div class="avr clk" id="avInflAll"><span class="n" style="color:var(--accent)">Voir les '+I.n+' articles suivis</span><span class="v" style="color:var(--accent)">›</span></div>';
        }
        h+=avCard("Mon inflation · 12 mois", I.n?I.n+" article"+(I.n>1?"s":"")+" suivi"+(I.n>1?"s":""):"", ib, "avhero");
        // cette année / l'an dernier
        var Yy=D.yoy, yb='';
        if(!Yy.has) yb='<div class="muted" style="font-size:12px;margin:8px 0 4px">Pas de tickets l\'an dernier sur la même période : la comparaison viendra l\'an prochain.</div>';
        else {
          var mx=1; Yy.cats.forEach(function(c){ mx=Math.max(mx, Yy.cy[c]||0, Yy.py[c]||0); });
          yb='<div class="avbig">'+avPct(Yy.tp?(Yy.tc-Yy.tp)/Yy.tp:0)+'</div><div class="avsub">'+fmtK(Yy.tc)+' de janvier à '+esc(monthLabelOf(curM).split(" ")[0])+' contre '+fmtK(Yy.tp)+' en '+(Yy.Y-1)+'</div>';
          yb+='<div class="avbars">'+Yy.cats.map(function(c){ return '<div class="b"><div class="bb"><i style="height:'+Math.max(2,Math.round((Yy.py[c]||0)/mx*100))+'%;background:#4a5470"></i><i style="height:'+Math.max(2,Math.round((Yy.cy[c]||0)/mx*100))+'%;background:#7c9cf4"></i></div><span>'+esc(c)+'</span></div>'; }).join("")+'</div>';
          yb+='<div class="avleg"><span><i style="background:#4a5470"></i>'+(Yy.Y-1)+'</span><span><i style="background:#7c9cf4"></i>'+Yy.Y+'</span>'+(Yy.big?'<span class="'+(Yy.big.ch>0?'up':'dn')+'">'+esc(Yy.big.c)+' '+avPct(Yy.big.ch,0)+'</span>':'')+'</div>';
        }
        h+=avCard("Cette année contre l'an dernier", "par catégorie", yb);
        // alertes
        h+=avCard("À surveiller", "ce mois-ci", D.alerts.length ? D.alerts.map(function(a){ return '<div class="aval"><b>'+a.ic+'</b><span>'+a.t+'<small>'+esc(a.d)+'</small></span></div>'; }).join("") : '<div class="muted" style="font-size:12px;margin:8px 0 4px">Rien d\'inhabituel ce mois-ci ✓</div>');
        // épargne et reste à vivre
        var S=D.save;
        var perSeg='<div class="avseg avper" style="margin:8px 0 2px">'+[["1","1 mois"],["6","6 mois"],["12","12 mois"],["all","Tout"]].map(function(x){ return '<button type="button" data-p="'+x[0]+'"'+(x[0]===S.per?' class="on"':'')+'>'+x[1]+'</button>'; }).join("")+'</div>';
        var perTxt=S.nM ? (S.nM===1 ? esc(monthLabelOf(S.to)) : esc(S.from.slice(0,4)===S.to.slice(0,4)?monthLabelOf(S.from).split(" ")[0]:monthLabelOf(S.from))+" → "+esc(monthLabelOf(S.to))+(S.n<S.nM?" · "+S.n+" mois avec rentrées":"")) : "";
        h+=avCard("Épargne et reste à vivre", S.has?(S.n>1?"moyenne par mois":"sur le mois"):"", perSeg+(perTxt?'<div class="avsub" style="margin:2px 0 0">'+perTxt+'</div>':'')+(S.has ? '<div class="av2"><div><small>Taux d\'épargne</small><b class="'+(S.rate>=0.1?'dn':(S.rate<0?'up':'am'))+'">'+avPct(S.rate,0).replace("+","")+'</b><small>conseillé : 10 à 20 %</small></div><div><small>Reste à vivre / mois</small><b>'+fmtK(S.rav)+'</b><small>après frais fixes ('+fmtK(S.fx)+')</small></div></div>'
          : '<div class="muted" style="font-size:12px;margin:8px 0 4px">Aucune rentrée d\'argent sur cette période : ajoute tes virements reçus (salaire…) dans Compte.</div>'));
        // économies
        h+=avCard("Pistes d'économies", D.eco.length?"≈ "+fmtK(D.ecoTot)+" / mois":"", D.eco.length ? D.eco.map(function(x){ return avRow(x.t, x.d, "−"+fmtK(x.v), "dn"); }).join("") : '<div class="muted" style="font-size:12px;margin:8px 0 4px">Aucune piste nette pour l\'instant : tes prix et tes habitudes sont stables.</div>');
      } else if(sub==="proj"){
        var Pj=D.proj;
        if(!Pj.ok) h+='<section class="paper avc"><div class="muted" style="font-size:12.5px;padding:12px 2px">Aucun compte pour cette personne : choisis « Foyer » en haut à droite.</div></section>';
        else {
          var serR=Pj.hist.map(function(x){ return x.tot; }).concat(Pj.fut.map(function(){ return null; })), serP=Pj.hist.map(function(x,i){ return i===Pj.hist.length-1?x.tot:null; }).concat(Pj.fut.map(function(x){ return x.tot; }));
          var band=Pj.hist.map(function(x,i){ return i===Pj.hist.length-1?[x.tot,x.tot]:null; }).concat(Pj.fut.map(function(x){ return [x.lo,x.hi]; }));
          var pb='<div class="avbig '+(Pj.end.tot<0?'up':'')+'">'+fmtK(Pj.end.tot)+'</div><div class="avsub">compte'+(Pj.now.ep?' + épargne':'')+(Pj.now.pext>0.004?' + provisions hors comptes':(Pj.now.prov?' (provisions comprises)':''))+' · si tu continues comme ces 3 derniers mois ('+(Pj.netT>=0?'+':'−')+fmtK(Math.abs(Pj.netT))+' / mois)</div>';
          pb+=avLine([serR, serP], ["#4fd6a0","#4fd6a0"], { dash:[false,true], band:band, h:110, zero:true, n:serR.length });
          pb+='<div class="avleg" style="justify-content:space-between"><span>'+esc(monthLabelOf(Pj.hist[0].m).split(" ")[0])+'</span><span><i style="background:#4fd6a0"></i>réel · <i style="background:rgba(79,214,160,.4)"></i>prévu (fourchette)</span><span>'+esc(monthLabelOf(Pj.hzM).split(" ")[0])+'</span></div>';
          pb+=avRow("Aujourd'hui", "compte "+fmtK(Pj.now.bank)+(Pj.now.ep?" · épargne "+fmtK(Pj.now.ep):"")+(Pj.now.pext>0.004?" · provisions ailleurs "+fmtK(Pj.now.pext):(Pj.now.prov?" · dont provisions "+fmtK(Pj.now.prov):"")), fmtK(Pj.now.tot));
          h+=avCard(Pj.H===12-(+curM.slice(5,7)) ? "Fin d'année prévue" : "Dans "+Pj.H+" mois", esc(monthLabelOf(Pj.hzM)), pb, "avhero");
          h+=avCard("Mois les plus chers à venir", "d'après tes frais fixes et tes habitudes", D.next.map(function(x){ return avRow(esc(capFirst(monthLabelOf(x.m).split(" ")[0])), "frais fixes "+fmtK(x.fx)+" + tickets ≈ "+fmtK(x.v-x.fx)+(x.notes.length?" · "+x.notes.join(" · "):""), (x.est?"≈ ":"")+fmtK(x.v), x.est?"am":""); }).join(""));
          h+=avCard("Partager l'analyse", "", '<div class="avr clk" id="avPdf"><span class="n">📄 Rapport PDF de l\'année<small>bilan de janvier à aujourd\'hui, prêt à imprimer</small></span><span class="v">›</span></div><div class="avr clk" id="avIA"><span class="n">🤖 Analyser avec une IA<small>résumé à coller dans Claude ou une autre IA · rien n\'est envoyé par l\'appli</small></span><span class="v">›</span></div>');
        }
      } else {
        var Ps=D.proj, sv=state.avSim||(state.avSim={ tk:0, cat:0, fx:0, ep:0 }), tc2=D.topCat;
        function sl(id, lab, min, max, step, val){ return '<div class="avsl"><div><span>'+lab+'</span><b id="'+id+'V"></b></div><input type="range" id="'+id+'" min="'+min+'" max="'+max+'" step="'+step+'" value="'+val+'"></div>'; }
        var sb='<div class="avsub" style="margin-bottom:6px">Glisse pour voir l\'effet sur les 12 prochains mois.</div>';
        sb+=sl("avTk", "Toutes les dépenses en tickets", -50, 50, 5, sv.tk);
        if(tc2) sb+=sl("avCat", esc(tc2.c), -50, 50, 5, sv.cat);
        sb+=sl("avFx", "Nouveau frais fixe", 0, 1000, 10, sv.fx)+sl("avEp", "Épargne mensuelle en plus", 0, 1000, 10, sv.ep);
        sb+='<div class="avres"><div><small>Compte dans 6 mois</small><b id="avR6"></b></div><div><small>Dans 12 mois</small><b id="avR12"></b></div><div><small>Épargne dans 12 mois</small><b id="avRe"></b></div><div><small>Reste à vivre</small><b id="avRr"></b></div></div><div class="avsub" id="avWarn" style="margin-top:10px"></div>';
        sb+='<button type="button" class="btn ghost" id="avReset" style="margin-top:10px">Remettre à zéro</button>';
        h+=avCard("Et si… ?", "", sb, "avhero");
        h+='<div class="muted" style="font-size:11px;margin:4px 6px 10px;line-height:1.45">Base : l\'évolution moyenne de '+(Ps.ok?"tes comptes":"ton compte")+' ces 3 derniers mois ('+(Ps.netB>=0?'+':'−')+fmtK(Math.abs(Ps.netB))+' / mois sur le compte). Tickets ≈ '+fmtK(D.tkAvg)+' / mois.</div>';
      }
      app.innerHTML=h; wireAv(); setNav(state.avFrom==="factures" ? "factures" : "analyse", true);
      if(sub==="sim") avSimUpdate();
    }
    function avSimUpdate(){
      var D=avData(), P=D.proj, sv=state.avSim||(state.avSim={ tk:0, cat:0, fx:0, ep:0 });
      function g(id){ var e=document.getElementById(id); return e?(+e.value||0):0; }
      sv.tk=g("avTk"); sv.cat=g("avCat"); sv.fx=g("avFx"); sv.ep=g("avEp");
      function set(id, t, cls){ var e=document.getElementById(id); if(e){ e.innerHTML=t; if(cls!=null) e.className=cls; } }
      set("avTkV", (sv.tk>0?"+":"")+sv.tk+" % · "+(sv.tk>0?"+":(sv.tk<0?"−":""))+fmtK(Math.abs(D.tkAvg*sv.tk/100))+"/mois", sv.tk<0?"dn":(sv.tk>0?"up":""));
      if(D.topCat) set("avCatV", (sv.cat>0?"+":"")+sv.cat+" % · "+(sv.cat>0?"+":(sv.cat<0?"−":""))+fmtK(Math.abs(D.topCat.v*sv.cat/100))+"/mois", sv.cat<0?"dn":(sv.cat>0?"up":""));
      set("avFxV", sv.fx?"+"+fmtK(sv.fx)+"/mois":"aucun", sv.fx?"up":"");
      set("avEpV", sv.ep?"+"+fmtK(sv.ep)+"/mois":"inchangée", sv.ep?"dn":"");
      var delta=D.tkAvg*sv.tk/100+(D.topCat?D.topCat.v*sv.cat/100:0)+sv.fx+sv.ep;   // ce qui sort en plus du compte chaque mois
      var nb=P.netB-delta, b0=P.now.bank, b6=b0+nb*6, b12=b0+nb*12, e12=P.now.ep+(P.netE+sv.ep)*12;
      set("avR6", fmtK(b6), b6<0?"up":""); set("avR12", fmtK(b12), b12<0?"up":""); set("avRe", fmtK(e12), "dn");
      var rav=D.save.has ? D.save.rav-sv.fx-(D.tkAvg*sv.tk/100)-(D.topCat?D.topCat.v*sv.cat/100:0) : null;
      set("avRr", rav==null?"—":fmtK(rav)+"/mois");
      var w=""; if(nb<0 && b0>=0){ var k=Math.floor(b0/(-nb))+1; if(k<=24){ var mz=D.curM; for(var i=0;i<k;i++) mz=nextMonthKey(mz); w='⚠ Le compte passerait sous zéro en <b class="up">'+esc(monthLabelOf(mz))+'</b>.'; } }
      else if(b0<0 && nb>0){ var k2=Math.ceil(-b0/nb), mz2=D.curM; for(var j=0;j<k2 && j<60;j++) mz2=nextMonthKey(mz2); w=k2<=36?'✓ Le compte redeviendrait positif en <b class="dn">'+esc(monthLabelOf(mz2))+'</b>.':''; }
      set("avWarn", w);
    }
    function avIAText(anon){
      var D=avData(), names={}, n=0, me=mePerson();
      function who(p){ if(!anon) return p; if(!names[p]) names[p]=(p===me?"Moi":"Personne "+(++n)); return names[p]; }
      var L=[], curM=D.curM, pv=pvCur();
      L.push("Voici un résumé de mes dépenses (application "+APP_NAME+", suivi d'un foyer). Analyse-le : points forts, points faibles, conseils concrets et chiffrés pour mieux gérer, et questions à me poser si besoin.");
      L.push(""); L.push("Périmètre : "+(pv==="all"?"tout le foyer":who(pvName(pv)))+" · mois en cours : "+monthLabelOf(curM));
      L.push(""); L.push("Dépenses en tickets par mois (12 derniers mois) :");
      var E=vEntries(); D.ms12.forEach(function(mk){ var s=0, c={}; E.forEach(function(e){ if(monthKey(e.date)!==mk) return; var v=Number(e.montant)||0; s+=v; c[e.categorie||"Autre"]=(c[e.categorie||"Autre"]||0)+v; });
        L.push("- "+monthLabelOf(mk)+" : "+fmtK(s)+(s?" ("+Object.keys(c).sort(function(a,b){ return c[b]-c[a]; }).slice(0,5).map(function(k){ return k+" "+fmtK(c[k]); }).join(", ")+")":"")); });
      var fx=fraisCommuns.filter(function(f){ return fraisActif(f, curM); });
      if(fx.length){ L.push(""); L.push("Frais fixes ce mois-ci :"); fx.forEach(function(f){ L.push("- "+f.label+" : "+fmtK(fraisMontant(f, curM))+" ("+((f.personne||"Commun")==="Commun"?"commun":who(f.personne))+")"); }); }
      if(D.save.has){ L.push(""); L.push("Rentrées moyennes : "+fmtK(D.save.inc)+" / mois · taux d'épargne "+avPct(D.save.rate,0).replace("+","")+" · reste à vivre après frais fixes "+fmtK(D.save.rav)+" / mois"); }
      if(D.infl.rate!=null) L.push("Inflation sur mes articles (12 mois) : "+avPct(D.infl.rate));
      if(D.proj.ok){ L.push("Comptes aujourd'hui : "+fmtK(D.proj.now.bank)+(D.proj.now.ep?" · épargne "+fmtK(D.proj.now.ep)+(D.proj.now.prov?" (dont provisions "+fmtK(D.proj.now.prov)+")":""):"")+" · prévision "+monthLabelOf(D.proj.hzM)+" : "+fmtK(D.proj.end.tot)); }
      if(D.alerts.length){ L.push(""); L.push("À surveiller :"); D.alerts.forEach(function(a){ L.push("- "+a.t.replace(/<[^>]+>/g,"")+" ("+a.d+")"); }); }
      return L.join("\n");
    }
    function avOpenIA(){
      var anon=true, s=uiSheet('<div class="avia"></div>'), box=s.q(".avia");
      function paint(){ var t=avIAText(anon);
        box.innerHTML='<div class="sheet-title">Analyser avec une IA</div><div class="ui-intro">Copie ce résumé et colle-le dans Claude ou une autre IA. L\'appli n\'envoie rien elle-même.</div>'+
          '<label style="display:flex;align-items:center;gap:8px;font-size:13px;margin:4px 2px 8px"><input type="checkbox" id="avAnon"'+(anon?' checked':'')+'> Remplacer les prénoms par « Personne 1, 2… »</label>'+
          '<textarea class="f" id="avTxt" readonly style="width:100%;height:38vh;font-size:11.5px;line-height:1.4;font-family:var(--sans)">'+esc(t)+'</textarea>'+
          '<div class="ui-stack" style="margin-top:10px"><button type="button" class="btn primary" id="avCopy">Copier le résumé</button><button type="button" class="btn" id="avShare">Partager…</button><button type="button" class="btn ghost" id="avNo">Fermer</button></div>';
        box.querySelector("#avAnon").onchange=function(){ anon=this.checked; paint(); };
        box.querySelector("#avCopy").onclick=function(){ var ta=box.querySelector("#avTxt");
          function fb(){ try{ ta.removeAttribute("readonly"); ta.select(); document.execCommand("copy"); ta.setAttribute("readonly",""); uiToast("Résumé copié"); }catch(e){ uiToast("Copie impossible : sélectionne le texte"); } }
          try{ navigator.clipboard.writeText(t).then(function(){ uiToast("Résumé copié · colle-le dans ton IA"); }, fb); }catch(e){ fb(); } };
        box.querySelector("#avShare").onclick=function(){ var SH=capPlugin("Share");
          if(SH) SH.share({ title:"Mes dépenses", text:t }).catch(function(){}); else if(navigator.share) navigator.share({ title:"Mes dépenses", text:t }).catch(function(){}); else uiToast("Partage indisponible : utilise « Copier »"); };
        box.querySelector("#avNo").onclick=s.close; }
      paint();
    }
    function wireAv(){
      bindBack(function(){ var f=state.avFrom; state.avFrom=null; state.view=(f==="factures" ? "factures" : "analyse"); render(); window.scrollTo(0,0); });
      [].forEach.call(document.querySelectorAll(".avseg button[data-s]"), function(b){ b.onclick=function(){ state.avSub=b.getAttribute("data-s"); render(); window.scrollTo(0,0); }; });
      [].forEach.call(document.querySelectorAll(".avper button"), function(b){ b.onclick=function(){ var y=window.scrollY; state.avPer=b.getAttribute("data-p"); store.write("avPer", state.avPer); render(); window.scrollTo(0,y); }; });
      var bu=document.getElementById("avBuy"); if(bu) bu.onclick=function(){ plusShow("avancee"); };
      var pdf=document.getElementById("avPdf"); if(pdf) pdf.onclick=function(){ var cm=monthKey(todayISO()); state.bilanFrom=cm.slice(0,4)+"-01"; state.bilanTo=cm; state.bilanMonth=cm; state.view="bilan"; render(); window.scrollTo(0,0); };
      var ia=document.getElementById("avIA"); if(ia) ia.onclick=avOpenIA;
      var ial=document.getElementById("avInflAll"); if(ial) ial.onclick=function(){ var L=avData().infl.all;
        var h='<div class="sheet-title">Articles suivis · 12 mois</div><div class="ui-intro">Prix d\'une ligne du ticket, premier mois d\'achat → dernier. Les écarts de plus de 30 % (autre quantité, autre article) et le carburant sont écartés.</div><div style="max-height:62vh;overflow:auto">'+
          L.map(function(o){ return avRow(esc(o.name)+(o.lbl && avNorm(o.lbl)!==avNorm(o.name)?' <small style="display:inline;color:var(--muted)">'+esc(o.lbl)+'</small>':''), (o.st1?esc(o.st1)+' · ':'')+fmtK(o.p0)+' → '+fmtK(o.p1)+' · '+esc(monthLabelOf(o.first).split(" ")[0])+' → '+esc(monthLabelOf(o.lastM).split(" ")[0]), avPct(o.evo,0), o.evo>0.005?'up':(o.evo<-0.005?'dn':'')); }).join("")+'</div><div class="ui-stack" style="margin-top:10px"><button type="button" class="btn ghost" id="avAllNo">Fermer</button></div>';
        var sh=uiSheet('<div class="avc" style="padding:0">'+h+'</div>'); sh.q("#avAllNo").onclick=sh.close; };
      ["avTk","avCat","avFx","avEp"].forEach(function(id){ var e=document.getElementById(id); if(e) e.oninput=avSimUpdate; });
      var rs=document.getElementById("avReset"); if(rs) rs.onclick=function(){ state.avSim={ tk:0, cat:0, fx:0, ep:0 }; render(); };
    }
    // Glisser à gauche / à droite dans la carte du haut pour changer de graphique (générique)
    function wireHeroSwipe(cur, keys, setKey){
      var hero=document.querySelector(".thero"), ch=hero && hero.querySelector(".cch"); if(!hero || !ch) return;
      var i=keys.indexOf(cur), x0=null, y0=0, dx=0, lock=null, moved=false;
      hero.style.touchAction="pan-y";
      hero.addEventListener("click", function(ev){ if(moved){ moved=false; ev.stopPropagation(); ev.preventDefault(); } }, true);
      hero.addEventListener("pointerdown", function(ev){ moved=false; if(swipeSkip(ev.target, hero)) return; x0=ev.clientX; y0=ev.clientY; dx=0; lock=null; });
      hero.addEventListener("pointermove", function(ev){ if(x0===null) return; dx=ev.clientX-x0; var dy=ev.clientY-y0;
        if(lock===null && (Math.abs(dx)>8 || Math.abs(dy)>8)) lock=(Math.abs(dx)>Math.abs(dy))?"x":"y"; if(lock!=="x") return;
        var edge=(dx>0 && i===0) || (dx<0 && i===keys.length-1); ch.style.transition="none"; ch.style.transform="translateX("+(edge?dx/4:dx)+"px)"; ch.style.opacity=String(1-Math.min(.5, Math.abs(dx)/500)); });
      function up(){ if(x0===null) return; x0=null; if(lock==="x" && Math.abs(dx)>10) moved=true;
        var ni=i; if(lock==="x" && dx<-50 && i<keys.length-1) ni=i+1; else if(lock==="x" && dx>50 && i>0) ni=i-1;
        if(ni!==i){ setKey(keys[ni]); state.heroSwipeDir=(ni>i?1:-1); render(); return; }
        ch.style.transition="transform .2s ease, opacity .2s ease"; ch.style.transform=""; ch.style.opacity=""; }
      hero.addEventListener("pointerup", up); hero.addEventListener("pointercancel", up);
      if(state.heroSwipeDir){ var d=state.heroSwipeDir; state.heroSwipeDir=0; ch.style.transition="none"; ch.style.transform="translateX("+(d*60)+"px)"; ch.style.opacity=".2"; ch.getBoundingClientRect(); ch.style.transition="transform .25s ease, opacity .25s ease"; ch.style.transform=""; ch.style.opacity=""; }
    }

    function renderMonth(){
      // Détail d'un mois : une seule carte, une ligne par catégorie (repliable, avec ses tickets) puis les frais fixes
      var mk=state.histMonth||monthKey(todayISO());
      var entries=vEntries().filter(function(e){ return monthKey(e.date)===mk; })
        .sort(function(a,b){ return String(b.date||"").localeCompare(String(a.date||"")); });
      var parCat={}, byCat={}, total=0;
      entries.forEach(function(e){ var v=Number(e.montant)||0, c=e.categorie||"Autre"; parCat[c]=(parCat[c]||0)+v; (byCat[c]=byCat[c]||[]).push(e); total+=v; });
      var cats=Object.keys(parCat).sort(function(a,b){ return parCat[b]-parCat[a]; });
      var label=capFirst(new Date(mk+"-01T00:00:00").toLocaleDateString("fr-FR",{month:"long",year:"numeric"}));
      var fxL=anFraisOn() ? anFraisLines(mk, pvCur()==="all" ? null : pvName(pvCur())) : [], fxT=fxL.reduce(function(t,x){ return t+x.v; },0);
      var open=state.monOpen||(state.monOpen={}), COLS=["#7c9cf4","#e0a458","#4fd6a0","#c78bd6","#5bc0d4","#e88fb0","#9bd35e","#d4a05b","#8a92e0","#6fcaa8","#d98c5f","#b0b6c2"];
      function grp(key, col, title, sub, val, body){
        return '<div class="dgrp'+(open[key]?' open':'')+'" data-g="'+esc(key)+'"><div class="dgh"><i class="cdot" style="background:'+col+';margin:0"></i><span class="t">'+esc(title)+'<em class="ds">'+sub+'</em></span><span class="v">'+fmtK(val)+'</span><span class="chev">›</span></div><div class="dgb">'+body+'</div></div>';
      }
      var h=header(true, label)+pvBarHTML()+'<section class="paper cacc">';
      h+='<div class="cacc-h" style="cursor:default;padding-bottom:6px"><span class="t">Total du mois<small>'+entries.length+' ticket'+(entries.length>1?'s':'')+(fxL.length?' + '+fxL.length+' frais fixe'+(fxL.length>1?'s':''):'')+' · touche une ligne pour la déplier</small></span><span class="v" style="color:var(--accent)">'+fmtK(total+fxT)+'</span></div>';
      if(!cats.length && !fxL.length) h+='<div class="muted" style="font-size:12px;margin:10px 2px 14px">Aucune dépense ce mois-ci.</div>';
      cats.forEach(function(c, ci){
        var body=byCat[c].map(function(e){ var dd=(e.date||"").split("-");
          return '<div class="entry ecomp" data-id="'+esc(e.id)+'"><span class="n">'+esc(e.marchand||"—")+'<small>'+esc(payerOf(e))+'</small></span><span class="d">'+esc(dd.length===3?dd[2]+"/"+dd[1]:"")+'</span><span class="a">'+fmtK(e.montant)+'</span></div>'; }).join("");
        h+=grp("c|"+c, COLS[ci%COLS.length], c, byCat[c].length+" ticket"+(byCat[c].length>1?"s":"")+" · "+Math.round(parCat[c]/((total+fxT)||1)*100)+" %", parCat[c], body);
      });
      if(fxL.length){
        var fb=fxL.slice().sort(function(a,b){ return b.v-a.v; }).map(function(x){
          var nt=x.kind==="part" ? "part "+pctTxt(x.pct)+" de "+fmtK(x.full) : (x.kind==="paid" && x.others>0.5 ? "dont "+fmtK(x.others)+" pour les autres" : (x.kind==="perso" ? (pvCur()==="all"?x.who:"perso") : "commun"));
          return '<div class="dfrow"><span class="n">'+esc(x.label)+'<small>'+esc(nt)+'</small></span><span class="a">'+fmtK(x.v)+'</span></div>'; }).join("");
        h+=grp("fx", "#c78bd6", "Frais fixes", fxL.length+" frais", fxT, fb);
      }
      h+='</section>';
      app.innerHTML=h;
      bindBack(function(){ state.view="analyse"; render(); window.scrollTo(0,0); });
      [].forEach.call(document.querySelectorAll(".dgrp .dgh"), function(hd){ hd.onclick=function(){ var g=hd.parentNode, k=g.getAttribute("data-g"); open[k]=!open[k]; g.classList.toggle("open", !!open[k]); }; });
      [].forEach.call(document.querySelectorAll(".entry[data-id]"), function(node){ node.onclick=function(){ editEntry(node.getAttribute("data-id")); }; });
      setNav("analyse", true);
    }

    function catPick(title, cur, cb){   // feuille : les grandes catégories et leurs sous-catégories
      var h='<div class="sheet-title">'+esc(title)+'</div><div class="dr-grp">';
      catMains().forEach(function(m){ h+='<button type="button" class="dr-row cpk'+(cur===m?' on':'')+'" data-c="'+esc(m)+'"><span class="ic">'+catIcon(m).e+'</span><span class="t"><b>'+esc(m)+'</b></span></button>';
        catSubs(m).forEach(function(c){ h+='<button type="button" class="dr-row cpk sub'+(cur===c?' on':'')+'" data-c="'+esc(c)+'"><span class="ic"></span><span class="t">↳ '+esc(c)+'</span></button>'; }); });
      h+='</div><div class="ui-stack" style="margin-top:12px"><button type="button" class="btn ghost ui-no">Annuler</button></div>';
      var sh=uiSheet(h); sh.q(".ui-no").onclick=sh.close;
      [].forEach.call(sh.qa(".cpk"), function(b){ b.onclick=function(){ sh.close(); cb(b.getAttribute("data-c")); }; });
    }
    function normName(s){ return (s||"").trim().toLowerCase(); }
    function takenAs(name){
      var n=normName(name); if(!n) return "";
      for(var i=0;i<FAMILLES.length;i++){ if(normName(FAMILLES[i])===n) return "famille de produits"; }
      for(var j=0;j<PRODUITS.length;j++){ if(FAMILLES.indexOf(PRODUITS[j])<0 && PRODUITS[j]!=="Remise" && normName(PRODUITS[j])===n) return "produit"; }
      return "";
    }
    function nameTaken(name){ return takenAs(name)!==""; }
    function addFamille(){
      var name=(window.prompt("Nom de la nouvelle famille de produits :")||"").trim();
      if(!name) return;
      var w=takenAs(name); if(w){ window.alert("« "+name+" » existe déjà comme "+w+".\nSupprime-le d'abord (✕) ou choisis un autre nom."); return; }
      FAMILLES.push(name); FAMILLE_DE[name]=name; if(PRODUITS.indexOf(name)<0) PRODUITS.push(name);
      persistFamilles(); persistFamille(); persistProd(); render();
    }
    function renameFamille(old){
      if(old==="Divers"){ window.alert("« Divers » ne peut pas être renommée (catégorie de repli)."); return; }
      var name=(window.prompt("Renommer la famille de produits :", old)||"").trim();
      if(!name || name===old) return;
      var w=takenAs(name); if(w && normName(name)!==normName(old)){ window.alert("« "+name+" » existe déjà comme "+w+".\nSupprime-le d'abord (✕) ou choisis un autre nom."); return; }
      var idx=FAMILLES.indexOf(old); if(idx>=0) FAMILLES[idx]=name;
      var pidx=PRODUITS.indexOf(old); if(pidx>=0) PRODUITS[pidx]=name;
      for(var k in FAMILLE_DE){ if(FAMILLE_DE[k]===old) FAMILLE_DE[k]=name; }
      delete FAMILLE_DE[old]; FAMILLE_DE[name]=name;
      persistFamilles(); persistFamille(); persistProd(); render();
    }
    function deleteFamille(name){
      if(name==="Divers"){ window.alert("« Divers » ne peut pas être supprimée."); return; }
      for(var k in FAMILLE_DE){ if(FAMILLE_DE[k]===name && k!==name) FAMILLE_DE[k]="Divers"; }
      var idx=FAMILLES.indexOf(name); if(idx>=0) FAMILLES.splice(idx,1);
      var pidx=PRODUITS.indexOf(name); if(pidx>=0) PRODUITS.splice(pidx,1);
      delete FAMILLE_DE[name];
      persistFamilles(); persistFamille(); persistProd(); render();
    }
    function addProduct(){
      var name=(window.prompt("Nom du nouvel article :")||"").trim();
      if(!name) return;
      var w=takenAs(name); if(w){ window.alert("« "+name+" » existe déjà comme "+w+".\nSupprime-le d'abord (✕) ou choisis un autre nom."); return; }
      PRODUITS.push(name); FAMILLE_DE[name]=FAM_FB; persistProd(); persistFamille(); render();
      catPick("Catégorie de « "+name+" »", FAM_FB, function(c){ FAMILLE_DE[name]=c; persistFamille(); render(); });
    }
    function renameProduct(old){
      if(old==="Remise") return;
      var name=(window.prompt("Renommer l'article :", old)||"").trim();
      if(!name || name===old) return;
      var w=takenAs(name); if(w && normName(name)!==normName(old)){ window.alert("« "+name+" » existe déjà comme "+w+".\nSupprime-le d'abord (✕) ou choisis un autre nom."); return; }
      var pidx=PRODUITS.indexOf(old); if(pidx>=0) PRODUITS[pidx]=name;
      if(old in FAMILLE_DE){ FAMILLE_DE[name]=FAMILLE_DE[old]; delete FAMILLE_DE[old]; }
      for(var k in APPRIS){ if(APPRIS[k]===old) APPRIS[k]=name; }
      state.entries.forEach(function(e){ (e.articles||[]).forEach(function(a){ if(a.produit===old) a.produit=name; }); });
      persistProd(); persistFamille(); persistAppris(); persist(); render();
    }
    // Catégories en arbre : ajouter (grande catégorie, ou sous-catégorie d'une grande), renommer, déplacer, supprimer
    function addCat(parent){
      var name=(window.prompt(parent ? "Nouvelle sous-catégorie dans « "+parent+" » :" : "Nom de la nouvelle grande catégorie :")||"").trim();
      if(!name) return;
      if(catNameBad(name)) return;
      catAddRaw(name, parent);
    }
    function catAddRaw(name, parent){
      if(parent){ CATS.push(name); if(!CAT_PARENT) CAT_PARENT={}; CAT_PARENT[name]=parent; persistCatParent(); }
      else { var ai=CATS.indexOf("Autre"); if(ai<0) CATS.push(name); else CATS.splice(ai,0,name); }
      persistCats(); famSync(true); render();
    }
    function catNameBad(name, keep){   // vrai (et message) si le nom est déjà une catégorie, écrite autrement, ou un produit
      var k=ckey(name), same=null; CATS.forEach(function(c){ if(c!==keep && (c===name || ckey(c)===k)) same=c; });
      if(same){ window.alert("« "+same+" » existe déjà"+(catMain(same)!==same?" (dans "+catMain(same)+")":"")+"."); return true; }
      var w=takenAs(name); if(w==="produit"){ window.alert("« "+name+" » est déjà un article. Choisis un autre nom."); return true; }
      return false;
    }
    function catRenameKeys(o, old, name){ if(o && Object.prototype.hasOwnProperty.call(o, old)){ o[name]=o[old]; delete o[old]; return true; } return false; }
    function renameCat(old){
      if(fyMember()) return;
      if(old==="Autre"){ window.alert("« Autre » ne peut pas être renommée (catégorie de repli)."); return; }
      var name=(window.prompt("Renommer la catégorie :", old)||"").trim();
      if(!name || name===old) return;
      if(catNameBad(name, old)) return;
      catRenameRaw(old, name); render();
    }
    function catRenameRaw(old, name){
      var i=CATS.indexOf(old); if(i>=0) CATS[i]=name;
      if(KEYWORDS[old]){ KEYWORDS[name]=KEYWORDS[old]; delete KEYWORDS[old]; }
      if(CAT_PARENT){ catRenameKeys(CAT_PARENT, old, name); Object.keys(CAT_PARENT).forEach(function(k){ if(CAT_PARENT[k]===old) CAT_PARENT[k]=name; }); persistCatParent(); }
      if(catRenameKeys(budgets, old, name)) persistBudgets();
      var bp=false; Object.keys(budgetsP||{}).forEach(function(p){ if(catRenameKeys(budgetsP[p], old, name)) bp=true; }); if(bp) persistBudgetsP();
      state.entries.forEach(function(e){ if(e.categorie===old) e.categorie=name; (e.articles||[]).forEach(function(a){ if(a.produit===old) a.produit=name; }); });
      Object.keys(FAMILLE_DE).forEach(function(k){ if(FAMILLE_DE[k]===old) FAMILLE_DE[k]=name; }); delete FAMILLE_DE[old];
      var pi=PRODUITS.indexOf(old); if(pi>=0) PRODUITS[pi]=name;
      Object.keys(APPRIS||{}).forEach(function(k){ if(APPRIS[k]===old) APPRIS[k]=name; }); persistAppris();
      persistCats(); famSync(true); persist();
    }
    // fusionner « src » dans « to » (même chose sous deux noms) : tickets, articles, produits, budgets (gardés s'il n'y en a pas déjà), sous-catégories
    function catMergeRaw(src, to){
      var i=CATS.indexOf(src); if(i>=0) CATS.splice(i,1);
      if(KEYWORDS[src]){ KEYWORDS[to]=(KEYWORDS[to]||[]).concat(KEYWORDS[src].filter(function(w){ return (KEYWORDS[to]||[]).indexOf(w)<0; })); delete KEYWORDS[src]; }
      if(CAT_PARENT && CAT_PARENT[to]===src) delete CAT_PARENT[to];   // « to » était une sous-catégorie de « src » : elle prend sa place
      if(CAT_PARENT){ delete CAT_PARENT[src]; Object.keys(CAT_PARENT).forEach(function(k){ if(CAT_PARENT[k]===src) CAT_PARENT[k]=(catIsMain(to)?to:catMain(to)); }); }
      function mv(o){ if(!o || !Object.prototype.hasOwnProperty.call(o, src)) return; if(!(o[to]>0)) o[to]=o[src]; delete o[src]; }
      mv(budgets); Object.keys(budgetsP||{}).forEach(function(p){ mv(budgetsP[p]); });
      state.entries.forEach(function(e){ if(e.categorie===src) e.categorie=to; (e.articles||[]).forEach(function(a){ if(a.produit===src) a.produit=to; }); });
      Object.keys(FAMILLE_DE).forEach(function(k){ if(FAMILLE_DE[k]===src) FAMILLE_DE[k]=to; }); delete FAMILLE_DE[src];
      var pi=PRODUITS.indexOf(src); if(pi>=0) PRODUITS.splice(pi,1);
      Object.keys(APPRIS||{}).forEach(function(k){ if(APPRIS[k]===src) APPRIS[k]=to; });
    }
    function moveCat(c){   // une sous-catégorie change de grande catégorie, avec tout son passé
      var cur=catMain(c);
      uiChoice("Déplacer « "+c+" »", "Elle passe sous une autre grande catégorie, avec ses tickets et ses budgets.", catMains().filter(function(m){ return m!==cur; }).map(function(m){
        return { l:catIcon(m).e+"  "+m, primary:false, fn:function(){ CAT_PARENT[c]=m; persistCatParent(); render(); uiToast("« "+c+" » est dans "+m); } }; }));
    }
    function deleteCat(name){
      if(fyMember()) return;
      if(name==="Autre"){ window.alert("« Autre » ne peut pas être supprimée."); return; }
      var main=catIsMain(name), to=main ? "Autre" : catMain(name);
      // rien n'est perdu : tickets, articles et produits vont dans « to » ; son budget aussi s'il n'y en a pas déjà un ; « Annuler » remet tout
      var touched={}; state.entries.forEach(function(e){ if(e.categorie===name || (e.articles||[]).some(function(a){ return a.produit===name; })) touched[e.id]={ c:e.categorie, p:(e.articles||[]).map(function(a){ return a.produit; }) }; });
      var snap=JSON.stringify({ cats:CATS, cp:CAT_PARENT, fd:FAMILLE_DE, pr:PRODUITS, ap:APPRIS, b:budgets, bp:budgetsP, kw:KEYWORDS[name]||null });
      function moveBud(o){ if(!o || !Object.prototype.hasOwnProperty.call(o, name)) return false; if(!(o[to]>0)) o[to]=o[name]; delete o[name]; return true; }
      if(moveBud(budgets)) persistBudgets();
      var bpc=false; Object.keys(budgetsP||{}).forEach(function(p){ if(moveBud(budgetsP[p])) bpc=true; }); if(bpc) persistBudgetsP();
      var i=CATS.indexOf(name); if(i>=0) CATS.splice(i,1);
      if(KEYWORDS[name]) delete KEYWORDS[name];
      if(CAT_PARENT){ delete CAT_PARENT[name]; if(main) Object.keys(CAT_PARENT).forEach(function(k){ if(CAT_PARENT[k]===name) CAT_PARENT[k]="Autre"; }); persistCatParent(); }
      state.entries.forEach(function(e){ if(e.categorie===name) e.categorie=to; (e.articles||[]).forEach(function(a){ if(a.produit===name) a.produit=to; }); });
      Object.keys(FAMILLE_DE).forEach(function(k){ if(FAMILLE_DE[k]===name) FAMILLE_DE[k]=to; }); delete FAMILLE_DE[name];
      var pi=PRODUITS.indexOf(name); if(pi>=0) PRODUITS.splice(pi,1);
      Object.keys(APPRIS||{}).forEach(function(k){ if(APPRIS[k]===name) APPRIS[k]=to; }); persistAppris();
      persistCats(); famSync(true); persist(); render();
      uiUndoToast("« "+name+" » supprimée · ses tickets sont dans "+to, "Annuler", function(){
        var o=JSON.parse(snap); CATS=o.cats; CAT_PARENT=o.cp;
        state.entries.forEach(function(e){ var t=touched[e.id]; if(!t) return; if(e.categorie===to) e.categorie=t.c; (e.articles||[]).forEach(function(a, ai){ if(a.produit===to && t.p[ai]===name) a.produit=name; }); });   // les tickets arrivés depuis restent tels quels
        FAMILLE_DE=o.fd; PRODUITS=o.pr; APPRIS=o.ap; budgets=o.b; budgetsP=o.bp; if(o.kw) KEYWORDS[name]=o.kw;
        persistCats(); persistCatParent(); persist(); persistFamille(); persistProd(); persistAppris(); persistBudgets(); persistBudgetsP(); famSync(true); render(); uiToast("« "+name+" » est revenue"); });
    }
    function renderProduits(){
      var h=header("list")+'<section class="paper">';
      h+='<label class="f" style="margin-top:0">Classement automatique</label>';
      h+='<div class="muted" style="font-size:12px;margin-bottom:4px">Ressemblance minimale : <b id="simval" style="color:var(--accent)">'+SIM_THRESHOLD+'%</b></div>';
      h+='<input type="range" id="simrange" min="50" max="95" step="5" value="'+SIM_THRESHOLD+'" style="width:100%;accent-color:var(--accent)">';
      h+='<div class="muted" style="font-size:10px;margin:2px 2px 22px">Au scan, un article qui ressemble à au moins ce % à un article déjà classé reprend son nom. Plus bas = plus de reprises automatiques, mais plus de risques d\'erreur.</div>';
      h+='<label class="f">Catégories</label><div class="muted" style="font-size:11.5px;margin:-2px 2px 8px">Grandes catégories et leurs sous-catégories. Un ticket compte dans sa sous-catégorie et dans sa grande catégorie.</div>';
      var cMem=fyMember();   // renommer ou supprimer touche tous les tickets et les budgets du foyer : sur le téléphone du propriétaire
      if(cMem) h+='<div class="muted" style="font-size:11px;margin:-4px 2px 8px">Renommer ou supprimer une catégorie se fait sur le téléphone du propriétaire.</div>';
      var cOpen=state.catOpen||{};   // grandes catégories repliées par défaut (07/11) : toucher le nom les déplie
      catMains().forEach(function(m){ var ic=catIcon(m), prot=(m==="Autre"), ns=catSubs(m).length, op=!!cOpen[m];
        h+='<div class="prow ctm"><button type="button" class="pname cttog" data-cat="'+esc(m)+'" aria-expanded="'+op+'"><span class="ctchev'+(op?' on':'')+'">›</span><span style="margin-right:6px">'+ic.e+'</span><b>'+esc(m)+'</b>'+(ns?'<small>'+ns+' sous-catégorie'+(ns>1?'s':'')+'</small>':'')+'</button>'+
           '<button class="btn ghost catadd" type="button" data-cat="'+esc(m)+'" aria-label="Ajouter une sous-catégorie à '+esc(m)+'">＋</button>'+
           (cMem?'':'<button class="btn ghost catren" type="button" data-cat="'+esc(m)+'"'+(prot?' disabled style="opacity:.3"':'')+'>✎</button>'+
           '<button class="btn ghost catdel" type="button"'+(prot?' disabled style="opacity:.3"':'')+' data-cat="'+esc(m)+'">✕</button>')+'</div>';
        if(op) catSubs(m).forEach(function(c){
          h+='<div class="prow cts"><span class="pname">↳ '+esc(c)+'</span>'+
             '<button class="btn ghost catmv" type="button" data-cat="'+esc(c)+'">Déplacer</button>'+
             (cMem?'':'<button class="btn ghost catren" type="button" data-cat="'+esc(c)+'">✎</button>'+
             '<button class="btn ghost catdel" type="button" data-cat="'+esc(c)+'">✕</button>')+'</div>'; });
      });
      h+='<button class="btn ghost" id="addcat" type="button" style="margin-top:10px">+ Nouvelle grande catégorie</button>';
      // plus de familles à part : chaque produit est rangé dans une catégorie de l'arbre ci-dessus
      var list = alphaSort(PRODUITS.filter(function(p){ return FAMILLES.indexOf(p)<0 && p!=="Remise"; }));
      h+='<label class="f" style="margin-top:22px">Articles (appuie sur le nom pour renommer)</label><div class="muted" style="font-size:11.5px;margin:-2px 2px 8px">Chaque article est rangé dans une catégorie ou une sous-catégorie.</div>';
      h+='<input class="f" id="prodsearch" placeholder="Rechercher un article…" style="margin-bottom:8px">';
      if(list.length===0) h+='<div class="muted" style="font-size:12px">Aucun article personnalisé pour l\'instant.</div>';
      // par lettre (07/11) : un titre par lettre, collé en haut pendant qu'on défile dans sa lettre, et une barre pour sauter à une lettre
      var LET=function(p){ var c=norm(String(p).replace(/œ/gi,"oe").replace(/æ/gi,"ae")).charAt(0).toUpperCase(); return /[A-Z]/.test(c) ? c : "#"; }, byL={};
      list.forEach(function(p){ var l=LET(p); byL[l]=(byL[l]||0)+1; });
      if(list.length>12){ h+='<div class="paz" id="paz">'; "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("").forEach(function(l){ if(l==="#" && !byL["#"]) return; h+='<button type="button" class="'+(byL[l]?'':'off')+'" data-l="'+l+'"'+(byL[l]?'':' disabled')+'>'+l+'</button>'; }); h+='</div>'; }
      var curL="";
      list.forEach(function(p){
        var l=LET(p); if(l!==curL){ curL=l; h+='<div class="plet" id="plet-'+(l==="#"?"0":l)+'">'+l+' <small>'+byL[l]+' article'+(byL[l]>1?'s':'')+'</small></div>'; }
        var opts="";
        catMains().forEach(function(m){ opts+='<option value="'+esc(m)+'"'+(familleOf(p)===m?" selected":"")+'>'+esc(m)+'</option>'; catSubs(m).forEach(function(c){ opts+='<option value="'+esc(c)+'"'+(familleOf(p)===c?" selected":"")+'>  ↳ '+esc(c)+'</option>'; }); });
        h+='<div class="prow prodrow" data-s="'+esc(norm(p))+'"><span class="pname pedit" data-p="'+esc(p)+'">'+esc(p)+'</span><select class="f pfam" data-p="'+esc(p)+'">'+opts+'</select><button class="btn ghost pdel" type="button" data-p="'+esc(p)+'">✕</button></div>';
      });
      h+='<button class="btn ghost" id="addprod" type="button" style="margin-top:10px">+ Ajouter un article</button>';

      h+='</section>';
      app.innerHTML=h;

      bindBack(function(){ state.view=(state.prodFrom==="articles"?"articles":"list"); state.prodFrom=null; render(); window.scrollTo(0,0); });
      setNav(null, true);
      var af=document.getElementById("addfam"); if(af) af.onclick=addFamille;
      var ac=document.getElementById("addcat"); if(ac) ac.onclick=function(){ addCat(null); };
      [].forEach.call(document.querySelectorAll(".cttog"), function(b){ b.onclick=function(){ var m=b.getAttribute("data-cat"); state.catOpen=state.catOpen||{}; state.catOpen[m]=!state.catOpen[m]; var y=window.scrollY; render(); window.scrollTo(0,y); }; });
      [].forEach.call(document.querySelectorAll(".catadd"), function(b){ b.onclick=function(){ var m=b.getAttribute("data-cat"); state.catOpen=state.catOpen||{}; if(!state.catOpen[m]){ state.catOpen[m]=true; var y=window.scrollY; render(); window.scrollTo(0,y); } addCat(m); }; });
      [].forEach.call(document.querySelectorAll(".catmv"), function(b){ b.onclick=function(){ moveCat(b.getAttribute("data-cat")); }; });
      [].forEach.call(document.querySelectorAll(".catren"), function(b){ b.onclick=function(){ renameCat(b.getAttribute("data-cat")); }; });
      [].forEach.call(document.querySelectorAll(".catdel"), function(b){ if(!b.disabled) b.onclick=function(){ var c=b.getAttribute("data-cat"); if(window.confirm("Supprimer « "+c+" » ? Rien n'est perdu : "+(catIsMain(c) ? "ses tickets, ses articles et ses sous-catégories passeront dans Autre" : "ses tickets et ses articles passeront dans "+catMain(c))+", son budget aussi s'il n'y en a pas déjà un.")) deleteCat(c); }; });
      var ap=document.getElementById("addprod"); if(ap) ap.onclick=addProduct;
      [].forEach.call(document.querySelectorAll("#paz button[data-l]"), function(b){ b.onclick=function(){ var l=b.getAttribute("data-l"), t=document.getElementById("plet-"+(l==="#"?"0":l)); if(t){ window.scrollTo(0, t.getBoundingClientRect().top+window.scrollY-4); } }; });
      var psearch=document.getElementById("prodsearch"); if(psearch) psearch.oninput=function(){ var on=!!psearch.value.trim(); [].forEach.call(document.querySelectorAll(".plet, #paz"), function(x){ x.style.display=on?"none":""; }); }; if(psearch) psearch.addEventListener("input", function(){ var q=norm(psearch.value); [].forEach.call(document.querySelectorAll(".prodrow"), function(row){ var sv=row.getAttribute("data-s")||""; var ok=(!q)||sv.indexOf(q)===0||sv.split(" ").some(function(w){ return w.indexOf(q)===0; }); row.style.display=ok?"":"none"; }); });
      var sr=document.getElementById("simrange"); if(sr) sr.oninput=function(){ SIM_THRESHOLD=parseInt(sr.value,10)||65; persistSim(); var sv=document.getElementById("simval"); if(sv) sv.textContent=SIM_THRESHOLD+"%"; };
      [].forEach.call(document.querySelectorAll(".pren"), function(b){ b.onclick=function(){ renameFamille(b.getAttribute("data-fam")); }; });
      [].forEach.call(document.querySelectorAll(".pdelfam"), function(b){ if(!b.disabled) b.onclick=function(){ var f=b.getAttribute("data-fam"); if(window.confirm("Supprimer « "+f+" » ? Ses articles passeront dans Divers.")) deleteFamille(f); }; });
      [].forEach.call(document.querySelectorAll(".pedit"), function(sp){ sp.onclick=function(){ renameProduct(sp.getAttribute("data-p")); }; });
      [].forEach.call(document.querySelectorAll(".pfam"), function(sel){ sel.onchange=function(){ FAMILLE_DE[sel.getAttribute("data-p")]=sel.value; persistFamille(); }; });
      [].forEach.call(document.querySelectorAll(".pdel"), function(b){ b.onclick=function(){ var p=b.getAttribute("data-p"); if(!window.confirm("Supprimer l'article « "+p+" » ?")) return; var i=PRODUITS.indexOf(p); if(i>=0){ PRODUITS.splice(i,1); persistProd(); } if(p in FAMILLE_DE){ delete FAMILLE_DE[p]; persistFamille(); } render(); }; });
    }

    function makeCanvas(srcImg, w0, h0){
      var longest=Math.max(w0,h0), scale=1;
      if(w0<1600) scale=1600/w0;
      if(longest*scale>2000) scale=2000/longest;
      var w=Math.max(1,Math.round(w0*scale)), h=Math.max(1,Math.round(h0*scale));
      var c=document.createElement("canvas"); c.width=w; c.height=h;
      c.getContext("2d").drawImage(srcImg,0,0,w,h);
      return c;
    }
    function enhance(c){
      try{
        var ctx=c.getContext("2d"), d=ctx.getImageData(0,0,c.width,c.height), p=d.data, i, g, min=255, max=0;
        var lum=new Uint8ClampedArray(c.width*c.height);
        for(i=0;i<p.length;i+=4){ g=(p[i]*0.299+p[i+1]*0.587+p[i+2]*0.114)|0; lum[i>>2]=g; if(g<min)min=g; if(g>max)max=g; }
        var range=(max-min)||1;
        for(i=0;i<p.length;i+=4){ var v=(lum[i>>2]-min)*255/range; v=(v-128)*1.4+128; if(v<0)v=0; else if(v>255)v=255; p[i]=p[i+1]=p[i+2]=v; }
        ctx.putImageData(d,0,0);
      }catch(e){}
      return c;
    }
    function preprocess(file){
      return new Promise(function(resolve){
        function viaImg(){
          try{
            var img=new Image();
            img.onload=function(){ try{ resolve(enhance(makeCanvas(img,img.width,img.height))); }catch(e){ resolve(file); } };
            img.onerror=function(){ resolve(file); };
            img.src=URL.createObjectURL(file);
          }catch(e){ resolve(file); }
        }
        try{
          if(self.createImageBitmap){
            createImageBitmap(file).then(function(bmp){
              try{ var c=makeCanvas(bmp,bmp.width,bmp.height); try{ bmp.close(); }catch(e){} resolve(enhance(c)); }
              catch(e){ viaImg(); }
            }).catch(viaImg);
          } else viaImg();
        }catch(e){ viaImg(); }
      });
    }

    function canvasToBlob(src){
      return new Promise(function(resolve){
        function compress(canvas){
          var quals=[0.7,0.55,0.42,0.32,0.25], steps=0;
          (function attempt(qi){
            steps++;
            if(qi>=quals.length){
              if(canvas.width<=900 || steps>16){ canvas.toBlob(function(b){ resolve(b||src); }, "image/jpeg", 0.4); return; }
              var nc=document.createElement("canvas");
              nc.width=Math.max(1,Math.round(canvas.width*0.8));
              nc.height=Math.max(1,Math.round(canvas.height*0.8));
              nc.getContext("2d").drawImage(canvas,0,0,nc.width,nc.height);
              canvas=nc; attempt(0); return;
            }
            canvas.toBlob(function(b){
              if(!b){ resolve(src); return; }
              if(b.size<=950000){ resolve(b); return; }
              attempt(qi+1);
            }, "image/jpeg", quals[qi]);
          })(0);
        }
        if(src && src.toBlob){ compress(src); return; }
        function smallFrom(srcImg, w0, h0){ var lo=Math.max(w0,h0), s=lo>2000?2000/lo:1; var c=document.createElement("canvas"); c.width=Math.max(1,Math.round(w0*s)); c.height=Math.max(1,Math.round(h0*s)); c.getContext("2d").drawImage(srcImg,0,0,c.width,c.height); return c; }
        function viaImg(){ try{ var img=new Image(); img.onload=function(){ try{ compress(smallFrom(img,img.width,img.height)); }catch(e){ resolve(src); } }; img.onerror=function(){ resolve(src); }; img.src=URL.createObjectURL(src); }catch(e){ resolve(src); } }
        try{
          if(self.createImageBitmap){ createImageBitmap(src).then(function(bmp){ try{ var c=smallFrom(bmp,bmp.width,bmp.height); try{ bmp.close(); }catch(e){} compress(c); }catch(e){ viaImg(); } }).catch(viaImg); }
          else viaImg();
        }catch(e){ viaImg(); }
      });
    }
