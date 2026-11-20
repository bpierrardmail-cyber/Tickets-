    // ---------- Dépenses qui reviennent ----------
    function detectRecurrents(month){
      var ms=[], mk=month; for(var i=0;i<6;i++){ ms.unshift(mk); mk=prevMonthKey(mk); }
      var by={};
      state.entries.forEach(function(x){
        var m=monthKey(x.date); if(ms.indexOf(m)<0) return;
        var k=(x.marchand||"").trim().toLowerCase(); if(!k) return;
        if(!by[k]) by[k]={ nom:(x.marchand||"").trim(), cat:x.categorie, m:{} };
        by[k].m[m]=(by[k].m[m]||0)+(Number(x.montant)||0);
      });
      var out=[];
      Object.keys(by).forEach(function(k){
        var o=by[k], vals=Object.keys(o.m).map(function(x){ return o.m[x]; });
        if(vals.length<3) return;
        var avg=vals.reduce(function(a,b){ return a+b; },0)/vals.length; if(avg<=0) return;
        var sd=Math.sqrt(vals.reduce(function(a,b){ return a+(b-avg)*(b-avg); },0)/vals.length);
        if(sd/avg>0.2) return;
        out.push({ nom:o.nom, cat:o.cat, n:vals.length, avg:avg });
      });
      out.sort(function(a,b){ return b.avg-a.avg; });
      return out;
    }
    function fraisFixesMois(person, month){
      var t=0, n=0;
      fraisCommuns.forEach(function(f){ if(!f.recurrent || !fraisActif(f, month)) return; if(fraisKind(f, person)){ t+=fraisAcctAmt(f, person, month); n++; } });
      return { total:t, n:n };
    }
