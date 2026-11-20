    // ---------- Opérations › Épargne (refonte du 19/11) : un compte = une carte (gain du mois, disponible, objectif en cercle) ----------
    function ep2BodyHTML(month){
      var G=byOwner(epargne), who=state.epWho||"all", ro=fyRO(), h='';
      if(who!=="all" && !G.some(function(g){ return g.label===who; })) who="all";
      if(G.length>1) h+='<div class="fx2-chips" id="epWho"><button type="button" data-w="all"'+(who==="all"?' class="on"':'')+'>Tout · '+epargne.length+'</button>'+G.map(function(g){ return '<button type="button" data-w="'+esc(g.label)+'"'+(who===g.label?' class="on"':'')+'>'+esc(g.label)+' · '+g.items.length+'</button>'; }).join("")+'</div>';
      if(!epargne.length) h+='<div class="empty">Aucun compte épargne. Ajoute ton livret pour suivre ce que tu mets de côté.</div>';
      G.forEach(function(g){ if(who!=="all" && g.label!==who) return;
        g.items.forEach(function(c){
          var cur=epAt(c, month), prev=epPrevAt(c, month), d=(prev==null?null:cur-prev), cPv=provSumWhere(month, function(w){ return w==="ep:"+c.id; }), sub=[], ex='';
          sub.push(g.label); if(c.bourseLink) sub.push("automatique · suit l'onglet Bourse"); else if(cPv>0.004) sub.push("dont "+fmtK(cPv)+" de provisions");
          var left='<span class="ep2-ic" aria-hidden="true">'+(c.bourseLink?'📈':'🏦')+'</span>';
          if(c.objectif && c.objectif.montant>0){ var oT=c.objectif.montant, oP=Math.min(100, Math.round(cur/oT*100)), r=22, C=2*Math.PI*r;
            left='<svg width="56" height="56" viewBox="0 0 56 56" role="img" aria-label="'+oP+' % de l\'objectif"><circle cx="28" cy="28" r="'+r+'" fill="none" stroke="var(--card2)" stroke-width="6"></circle><circle cx="28" cy="28" r="'+r+'" fill="none" stroke="#7c9cf4" stroke-width="6" stroke-linecap="round" stroke-dasharray="'+(C*oP/100).toFixed(1)+' '+C.toFixed(1)+'" transform="rotate(-90 28 28)"></circle><text x="28" y="32" text-anchor="middle" font-size="12" font-weight="700" fill="var(--ink)">'+oP+'%</text></svg>';
            sub.push("objectif "+fmtK(oT)+(c.objectif.mois?" en "+monthLabelOf(c.objectif.mois):""));
            ex=cur>=oT ? '✓ objectif atteint' : (c.objectif.mois && monthsBetween(month, c.objectif.mois)>0 ? '≈ '+fmtK((oT-cur)/monthsBetween(month, c.objectif.mois))+' / mois pour y arriver' : 'reste '+fmtK(oT-cur)); }
          else if(cPv>0.004) ex='disponible '+fmtK(cur-cPv);
          else { var pm=pctStr(prev, cur); if(pm) ex=pm+' ce mois'; }
          h+='<button type="button" class="ep2-card'+(c.bourseLink?' epbourse':'')+'" data-id="'+esc(c.id)+'">'+left+'<span class="ep2-n"><b>'+esc(c.nom)+'</b><small>'+esc(sub.join(" · "))+'</small>'+(ex?'<small>'+esc(ex)+'</small>':'')+'</span><span class="ep2-v"><b>'+fmtK(cur)+'</b>'+(d!=null && Math.abs(d)>0.004?'<small style="color:'+(d<0?'var(--coral)':'var(--accent)')+'">'+(d>0?'+':'−')+fmtK(Math.abs(d))+'</small>':'')+'</span></button>';
        }); });
      var provT=0; try{ provT=provTotalAt(month); }catch(e){}
      h+='<div class="ep2-foot">'+(ro?'':'<button type="button" class="btn primary" id="addep">＋ Compte épargne</button>')+'<button type="button" class="paper ep2-prov" id="goprov"><span>Provisions</span><span>'+esc(fmtK(provT))+' ›</span></button></div>';
      return h;
    }
    // Opérations › Graphiques : la phrase à retenir de chaque graphique (clé = mode) et son résumé d'une ligne (clé = mode + "1")
    function cptGraphSums(person, month, liqOn){
      var R={}, pm=prevMonthKey(month), mN=function(m){ return monthLabelOf(m).split(" ")[0]; };
      try{
        var fl=soldeFlow(person, month), lq=function(m){ if(!liqOn) return 0; var l=liquideAt(person, m); return l?l.val:0; };
        var deb=fl.opening, fin=fl.closing+lq(month), gain=fin-deb;
        var inn=provInSum(person, month, false), out=computeDepensesMonth(person, month), fx=0;
        virementsOf(person, month).forEach(function(v){ var x=Number(v.montant)||0; if(x>=0) inn+=x; else out+=-x; });
        fraisCommuns.forEach(function(f){ if(fraisActif(f, month) && fraisKind(f, person)) fx+=fraisAcctAmt(f, person, month)||0; });
        R.mois='<b>'+(gain<0?'Ton compte a perdu ':'Ton compte a gagné ')+esc(fmtK(Math.abs(gain)))+' ce mois.</b> Entrées '+esc(fmtK(inn))+', sorties '+esc(fmtK(out))+(fx>0.004?' (dont '+esc(fmtK(fx))+' de frais fixes)':'')+'.';
        R.mois1=(gain<0?'−':'+')+fmtK(Math.abs(gain))+' ce mois · fin '+fmtK(fin);
        var dp=computeDepensesMonth(person, month), dq=computeDepensesMonth(person, pm), pc=dq>0.004?Math.round((dp-dq)/dq*100):null;
        R.dep='<b>Tu as dépensé '+esc(fmtK(dp))+' ce mois.</b>'+(pc!=null?' C\'est '+(pc===0?'autant qu\'':Math.abs(pc)+' % de '+(pc>0?'plus':'moins')+' qu\'')+'en '+esc(mN(pm))+'.':'');
        R.dep1=fmtK(dp)+(pc!=null?' · '+(pc>0?'+':(pc<0?'−':''))+Math.abs(pc)+' % par rapport à '+mN(pm):'');
        var ms=[], m=month, i; for(i=0;i<6;i++){ ms.unshift(m); m=prevMonthKey(m); }
        var sv=ms.map(function(x){ return { m:x, v:soldeFlow(person, x).closing+lq(x) }; }), lo=sv[0]; sv.forEach(function(x){ if(x.v<lo.v) lo=x; });
        var neg=sv.filter(function(x){ return x.v<0; });
        R.solde='<b>Fin '+esc(mN(month))+' : '+esc(fmtK(fin))+'.</b> Au plus bas sur 6 mois : '+esc(fmtK(lo.v))+' fin '+esc(mN(lo.m))+(neg.length?' · à découvert '+neg.length+' fois':' · jamais à découvert')+'.';
        R.solde1='au plus bas '+fmtK(lo.v)+' fin '+mN(lo.m)+(neg.length?' · à découvert '+neg.length+' fois':' · jamais à découvert');
        var nets=ms.map(function(x){ var a=provInSum(person, x, false), b=computeDepensesMonth(person, x); virementsOf(person, x).forEach(function(v){ var y=Number(v.montant)||0; if(y>=0) a+=y; else b+=-y; }); return a-b; }), avg=nets.reduce(function(t, x){ return t+x; }, 0)/nets.length;
        R.es='<b>'+(avg<0?'En moyenne, il sort plus qu\'il n\'entre : ':'En moyenne, il te reste ')+esc(fmtK(Math.abs(avg)))+' par mois</b> sur les 6 derniers mois.';
        R.es1=(avg<0?'−':'+')+fmtK(Math.abs(avg))+' par mois en moyenne sur 6 mois';
      }catch(e){ try{ console.warn(e); }catch(_){} }
      return R;
    }

