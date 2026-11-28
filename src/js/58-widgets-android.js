    // ---------- Widgets Android (écran d'accueil) ----------
    // L'appli prépare un résumé de tes chiffres et le donne à Android, qui l'affiche dans les widgets.
    // Envoyé après chaque changement (regroupé sur 1,5 s) et quand on quitte l'appli. Version Store : réservé à Plus.
    function widgetSnapshot(){
      var m=monthKey(todayISO()), pm=prevMonthKey(m), me=mePerson(), mainK=myAcct().key;
      function r2(n){ return Math.round((Number(n)||0)*100)/100; }
      var lc=liqCounted();
      function fig(keys, mm){ var t=0; keys.forEach(function(k){ t+=computeCompteMonth(k, mm).solde; var q=liquideAt(k, mm); if(q && lc) t+=q.val; }); return t; }
      var allK=comptes.map(function(a){ return a.key; }), sMe=fig([mainK], m), sAll=fig(allK, m);
      var _p=m.split("-"), dim=new Date(+_p[0], +_p[1], 0).getDate();
      var snap={ v:1, t:Date.now(), edition:EDITION, plus:canUse("widgets"), lock:!!lockCfg, sym:curSym(), multi:comptes.length>1,
        month:m, monthName:monthLabelOf(m).split(" ")[0], prevName:monthLabelOf(pm).split(" ")[0], dim:dim,
        solde:{ moi:{ v:r2(sMe), d:r2(sMe-fig([mainK], pm)), acct:myAcct().nom }, foyer:{ v:r2(sAll), d:r2(sAll-fig(allK, pm)), n:comptes.length } } };
      // Commun : ta part du mois et les frais communs pas encore payés
      try{ var CM=communModel(m), ci=(CM.D.byP.Commun?CM.D.byP.Commun.items:[]), todo=0, pc=CM.effPct(CM.me);
        ci.forEach(function(f){ if(!fraisDone(f, m)) todo++; });
        snap.commun={ part:r2(CM.partOf(CM.me)), pct:Math.round(pc*10)/10, todo:todo, n:ci.length, perso:r2(CM.persoOf(CM.me)), com:r2(CM.communShareOf(CM.me)), prod:r2(CM.prodShareOf(CM.me)) }; }catch(e){}
      // Mois en cours : tickets du mois, budget, 3 plus grosses catégories
      var mois=state.entries.filter(function(e){ return monthKey(e.date)===m; }), spent=0, byCat={}, bud=0, day=new Date().getDate();
      mois.forEach(function(e){ var v=Number(e.montant)||0, c=e.categorie||"Autre"; spent+=v; byCat[c]=(byCat[c]||0)+v; });
      Object.keys(budgets).forEach(function(c){ if(budgets[c]>0) bud+=budgets[c]; });
      function cumOf(mm, upto){ var p2=mm.split("-"), nd=new Date(+p2[0], +p2[1], 0).getDate(), per=[], out=[], t=0, i;
        for(i=0;i<nd;i++) per.push(0);
        state.entries.forEach(function(e){ if(monthKey(e.date)!==mm) return; var dd=+String(e.date).slice(8,10); if(dd>=1 && dd<=nd) per[dd-1]+=Number(e.montant)||0; });
        for(i=0;i<Math.min(upto||nd, nd);i++){ t+=per[i]; out.push(r2(t)); } return out; }
      snap.mois={ spent:r2(spent), budget:r2(bud), perDay:r2(day?spent/day:0), n:mois.length, cum:cumOf(m, day), prevCum:cumOf(pm),
        cats:Object.keys(byCat).sort(function(a,b){ return byCat[b]-byCat[a]; }).slice(0,5).map(function(c){ return { n:c, v:r2(byCat[c]), c:catIcon(c).col }; }) };
      // Foyer : ce qu'il y a sur les comptes de chacun aujourd'hui (banque estimée)
      var own={}, order=[], tot=0, epT=0;
      comptes.forEach(function(a){ var o=acctOwner(a)||"Comptes partagés", v=0; try{ v=acctFigures(a.key, m).banque; }catch(e){} if(!(o in own)){ own[o]=0; order.push(o); } own[o]+=v; tot+=v; });
      order.sort(function(x,y){ if(x===me) return -1; if(y===me) return 1; return own[y]-own[x]; });
      epargne.forEach(function(c){ epT+=epAt(c, m); });
      var prT=0; try{ prT=provTotalAt(m); }catch(e){}
      snap.foyer={ total:r2(tot), accts:comptes.length, n:order.filter(function(o){ return o!=="Comptes partagés"; }).length, ep:r2(epT), prov:r2(prT),
        bo:r2((FEAT.bourse && bourse.length)?bourseTotalLive():0),
        ppl:order.map(function(o,i){ return { n:o, v:r2(own[o]), c:ACOLS[i%ACOLS.length] }; }),
        list:comptes.map(function(a){ var v=0; try{ v=acctFigures(a.key, m).banque; }catch(e){} return { n:a.nom, v:r2(v), c:acctCol(a) }; }) };
      // Épargne (widget Épargne, 28/11) : chaque ligne d'épargne avec sa valeur mois par mois (36 mois au plus) ;
      // le widget fait lui-même les totaux selon ses réglages (moi / foyer, lignes comptées, provisions retirées ou non)
      try{
        const ms=[]; let mk=m; for(let i=0;i<37;i++){ ms.unshift(mk); mk=prevMonthKey(mk); }
        const first=epargne.filter(c=>!c.closed).reduce((f, c)=>{ const k=epMonthsOf(c)[0]; return k && (!f || k<f) ? k : f; }, null);
        let months=first ? ms.filter(k=>k>=first) : []; if(!months.length) months=[m];
        const provOn=c=>{ let t=0; provisions.forEach(p=>{ if(provWhere(p)==="ep:"+c.id){ try{ t+=provBalance(p, m); }catch(e){} } }); return t; };
        snap.epargne={ me:me, months:months, items:epargne.filter(c=>!c.closed).map(c=>{
          const it={ id:String(c.id), n:c.nom||"Épargne", o:ownerOf(c), h:months.map(k=>r2(epAt(c, k))) };
          if(c.bourseLink) it.b=1;
          const pv=provOn(c); if(pv) it.p=r2(pv);
          if(c.objectif && c.objectif.montant>0) it.obj=r2(c.objectif.montant);
          return it; }) };
      }catch(e){}
      // Bourse (appli perso) : le total et de quoi le recalculer sans ouvrir l'appli (positions, taux de change, relais des cours)
      if(FEAT.bourse && bourse.length){
        var fixed=0, items=[], ref=null, hist=[];
        bourse.forEach(function(c){ if(!bOpen(c)) return; var l=bLast(c);
          if(c.sol && c.solQty){ items.push({ s:"cg", r:"solana", q:Number(c.solQty)||0 }); fixed+=bCash(l); return; }
          if(c.positions && c.positions.length){ fixed+=bCash(l);
            c.positions.forEach(function(p){ if(p.src==="man") fixed+=Number(p.valeur)||0; else if(p.src==="cg"||p.src==="yf") items.push({ s:p.src, r:p.ref, q:Number(p.qte)||0 }); }); return; }
          fixed+=bTot(l); });
        var lim=Date.now()-86400000;
        if(bDay && bDay.pts && bDay.pts.length>1 && Date.now()-bDay.t<6*3600000){ bDay.pts.forEach(function(q){ if(q.t>=lim) hist.push([q.t, r2(q.v)]); }); }
        else bourseHist.forEach(function(h){ if(h.t<lim) ref=h.v; else hist.push([h.t, r2(h.v)]); });
        if(ref==null && hist.length) ref=hist[0][1];
        snap.bourse={ total:r2(bourseTotalLive()), ref:(ref!=null?r2(ref):null), hist:hist.slice(-160), fixed:r2(fixed), items:items, base:BASE, fx:(fxCache&&fxCache.rates)||{}, api:coursApi() };
      }
      return snap;
    }
