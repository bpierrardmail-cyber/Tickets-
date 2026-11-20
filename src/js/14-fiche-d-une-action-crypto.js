    // ---------- Fiche d'une action / crypto : cours en direct + graphique ----------
    var ADR=[["1J","1d"],["1S","5d"],["1M","1mo"],["1A","1y"],["5A","5y"],["Max","max"]];
    var CUR_SYM={ EUR:"€", USD:"$", GBP:"£", GBp:"p", CHF:"CHF", JPY:"¥", CAD:"$ CA" };
    function fmtPx(v, cur, ref){
      if(v===null || v===undefined || !isFinite(v)) return "—";
      var a=Math.abs(ref!=null?ref:v), d=a>=1?2:(a>=0.01?4:6);
      return Number(v).toLocaleString("fr-FR",{ minimumFractionDigits:d, maximumFractionDigits:d })+" "+(CUR_SYM[cur]||cur||"");
    }
    function fmtVol(v){ if(!v) return "—"; if(v>=1e9) return (v/1e9).toFixed(2).replace(".",",")+" Md"; if(v>=1e6) return (v/1e6).toFixed(2).replace(".",",")+" M"; if(v>=1e3) return (v/1e3).toFixed(1).replace(".",",")+" k"; return String(v); }
    function adLoad(p, range){
      var api=coursApi();
      function yahoo(sym){ if(!api) return Promise.reject(new Error("api")); return fetch(api+"/chart?symbol="+encodeURIComponent(sym)+"&range="+range).then(function(r){ return r.json(); }).then(function(j){ if(!j || !j.t || j.t.length<2) throw new Error("vide"); return j; }); }
      if(p.src==="yf") return yahoo(p.ref);
      // Crypto : cours Yahoo en € (SYMBOLE-EUR) s'il correspond bien à la même crypto, sinon CoinGecko
      var days={ "1d":"1", "5d":"7", "1mo":"30", "1y":"365" }[range], known=pxCache[posKey(p)];
      return yahoo(String(p.sym).toUpperCase()+"-EUR").then(function(j){
        if(known && known.p && j.price && Math.abs(j.price/known.p-1)>0.15) throw new Error("autre crypto");
        j.currency="EUR"; j.crypto=1; delete j.exch; return j;
      }).catch(function(){
        if(!days) throw new Error("indisponible");
        return cgGet("/coins/"+encodeURIComponent(p.ref)+"/market_chart?vs_currency=eur&days="+days, "/crypto/chart?id="+encodeURIComponent(p.ref)+"&days="+days, function(j){ return j && Array.isArray(j.prices) && j.prices.length>1; })
        .then(function(j){ var t=[], c=[]; j.prices.forEach(function(x){ if(x && x[1]!=null){ t.push(x[0]); c.push(x[1]); } }); return { t:t, c:c, currency:"EUR", price:c[c.length-1], time:t[t.length-1], crypto:1 }; });
      });
    }
    function openAssetDetail(accId, posId){
      var f=findPosition(accId, posId); if(!f) return;
      var p=f.p;
      if(p.src==="man"){ positionForm(p, f); return; }
      var range=store.read("adRange","1d"); if(!ADR.some(function(r){ return r[1]===range; })) range="1d";
      var px0=pxCache[posKey(p)]||null;
      var s=uiSheet('<div class="ad">'+
        '<div class="ad-head">'+posIcon(p)+'<div class="ad-name"><b>'+esc(p.nom)+'</b><small id="adSub">'+esc(String(p.sym))+(p.type==="crypto"?" · Crypto":"")+'</small></div><button type="button" class="ad-x" aria-label="Fermer">✕</button></div>'+
        '<div class="ad-px" id="adPx">'+(px0?fmtPx(px0.p, px0.cur):"…")+'</div><div class="ad-chg" id="adChg"></div><div class="ad-time" id="adTime"></div>'+
        '<div class="bch-read" id="adRead"></div>'+
        '<div class="bch-plot ad-plot" id="adPlot"><div class="ad-load">Chargement du graphique…</div></div>'+
        '<div class="bch-x" id="adX"></div>'+
        '<div class="bch-ranges" id="adR">'+ADR.map(function(r){ return '<button type="button" data-r="'+r[1]+'"'+(r[1]===range?' class="on"':'')+'>'+r[0]+'</button>'; }).join("")+'</div>'+
        '<div class="ad-box" id="adPos"></div><div class="ad-box" id="adStats" style="display:none"></div>'+
        '<button type="button" class="btn ghost" id="adEdit">✎ Modifier la position</button></div>');
      s.ov.firstChild.classList.add("ad-sheet");
      s.q(".ad-x").onclick=s.close;
      s.q("#adEdit").onclick=function(){ s.close(); positionForm(p, f); };
      var day=null, data=null, ch=null, seq=0;
      function cur(){ return (data&&data.currency)||(day&&day.currency)||(px0&&px0.cur)||"EUR"; }
      function lbl(t, long){
        var d=new Date(t);
        if(range==="1d") return d.toLocaleTimeString("fr-FR",{ hour:"2-digit", minute:"2-digit" });
        if(range==="5d") return d.toLocaleDateString("fr-FR",{ weekday:"short", day:"numeric" })+(long?" "+d.toLocaleTimeString("fr-FR",{ hour:"2-digit", minute:"2-digit" }):"");
        if(range==="1mo") return d.toLocaleDateString("fr-FR",{ day:"numeric", month:"short" })+(long?" "+d.toLocaleTimeString("fr-FR",{ hour:"2-digit", minute:"2-digit" }):"");
        if(range==="1y") return d.toLocaleDateString("fr-FR",{ day:"numeric", month:"short", year:"2-digit" });
        return d.toLocaleDateString("fr-FR",{ month:"short", year:"numeric" });
      }
      function dayPrev(){ if(!day) return null; if(day.prev!=null) return day.prev; return day.crypto?day.c[0]:null; }
      function head(){
        var price=(day&&day.price!=null)?day.price:(data&&data.price!=null?data.price:(px0?px0.p:null));
        s.q("#adPx").textContent=fmtPx(price, cur());
        var pv=dayPrev(), el=s.q("#adChg");
        if(pv!=null && price!=null){ var d=price-pv, pc=pv?d/pv*100:0; el.style.color=d>=0?"var(--accent)":"var(--coral)"; el.textContent=(d>=0?"▲ +":"▼ ")+fmtPx(d, cur(), price)+" ("+(pc>=0?"+":"")+pc.toFixed(2).replace(".",",")+" %) "+(day&&day.crypto&&day.prev==null?"sur 24 h":"aujourd'hui"); }
        else if(px0 && px0.chg!=null){ el.style.color=px0.chg>=0?"var(--accent)":"var(--coral)"; el.textContent=(px0.chg>=0?"▲ +":"▼ ")+px0.chg.toFixed(2).replace(".",",")+" % aujourd'hui"; }
        var tm=(day&&day.time)||null, fresh=tm && (Date.now()-tm<20*60000);
        s.q("#adTime").innerHTML=(fresh?'<span class="ad-live"></span>':'')+(tm?(fresh?"En direct · ":"Dernier cours · ")+esc(new Date(tm).toLocaleString("fr-FR",{ weekday:"short", hour:"2-digit", minute:"2-digit" })):"")+(cur()!==BASE?" · cours en "+esc(cur()):"");
        // ma position (en €)
        var v=posValue(p), q=Number(p.qte)||0, h='<h5>Ma position</h5>';
        h+='<div class="ad-row"><span>Quantité</span><b>'+String(Math.round(q*1e8)/1e8).replace(".",",")+'</b></div>';
        h+='<div class="ad-row"><span>Valeur</span><b>'+(v!==null?fmt(v):"—")+'</b></div>';
        if(p.pru>0){ var pe=pruBase(p), ce=costBase(p); h+='<div class="ad-row"><span>Prix d\'achat moyen</span><b>'+fmtCur(p.pru,p.pruCur)+((p.pruCur&&p.pruCur!==BASE)&&pe!==null?' <span style="color:var(--muted);font-weight:500">≈ '+fmt(pe)+'</span>':'')+'</b></div>';
          if(v!==null && ce!==null){ var g=v-ce, gp=ce?g/ce*100:0; h+='<div class="ad-row"><span>Plus-value</span><b style="color:'+(g>=0?"var(--accent)":"var(--coral)")+'">'+signK(g)+' ('+(gp>=0?"+":"")+gp.toFixed(1).replace(".",",")+' %)</b></div>'; } }
        s.q("#adPos").innerHTML=h;
        // statistiques clés
        if(day){
          var st='<h5>Statistiques clés</h5>', mn, mx;
          if(day.crypto && day.dayHigh==null){ mn=Math.min.apply(null, day.c); mx=Math.max.apply(null, day.c);
            st+='<div class="ad-row"><span>Plus bas / haut 24 h</span><b>'+fmtPx(mn,"EUR")+' – '+fmtPx(mx,"EUR")+'</b></div>';
            st+='<div class="ad-row"><span>Il y a 24 h</span><b>'+fmtPx(day.c[0],"EUR")+'</b></div>';
          } else {
            st+='<div class="ad-row"><span>Clôture précédente</span><b>'+fmtPx(day.prev, cur())+'</b></div>';
            st+='<div class="ad-row"><span>Ouverture</span><b>'+fmtPx(day.open, cur())+'</b></div>';
            st+='<div class="ad-row"><span>Écart du jour</span><b>'+fmtPx(day.dayLow, cur())+' – '+fmtPx(day.dayHigh, cur())+'</b></div>';
            st+='<div class="ad-row"><span>Écart 52 semaines</span><b>'+fmtPx(day.w52Low, cur())+' – '+fmtPx(day.w52High, cur())+'</b></div>';
            if(day.volume) st+='<div class="ad-row"><span>Volume</span><b>'+fmtVol(day.volume)+'</b></div>';
            if(day.exch) st+='<div class="ad-row"><span>Place</span><b>'+esc(day.exch)+'</b></div>';
          }
          if(data && data!==day && data.c && data.c.length){ mn=Math.min.apply(null, data.c); mx=Math.max.apply(null, data.c);
            var rl=ADR.filter(function(r){ return r[1]===range; })[0][0];
            st+='<div class="ad-row"><span>Plus bas / haut ('+rl+')</span><b>'+fmtPx(mn, cur())+' – '+fmtPx(mx, cur())+'</b></div>'; }
          var sb=s.q("#adStats"); sb.innerHTML=st; sb.style.display="";
        }
      }
      function readDefault(){
        var rd=s.q("#adRead"); if(!ch){ rd.innerHTML=""; return; }
        if(range==="1d"){ rd.innerHTML='<span class="bch-cap" style="color:var(--muted)">Glisse le doigt sur la courbe pour voir le cours à chaque instant</span>'; return; }
        var last=data.c[data.c.length-1], d=last-ch.base, pc=ch.base?d/ch.base*100:0;
        var rl={ "1d":"aujourd'hui", "5d":"sur 5 jours", "1mo":"sur 1 mois", "1y":"sur 1 an", "5y":"sur 5 ans", "max":"depuis le début" }[range];
        rd.innerHTML='<span class="bch-badge" style="color:'+ch.col+';background:'+(d>=0?"rgba(79,214,160,.14)":"rgba(244,121,107,.14)")+'">'+(d>=0?"▲ +":"▼ ")+pc.toFixed(2).replace(".",",")+' %</span><span class="bch-cap">'+esc((d>=0?"+":"")+fmtPx(d, cur(), last))+' '+rl+'</span>';
      }
      function draw(){
        var plot=s.q("#adPlot"), t=data.t, c=data.c, n=c.length;
        var prev=(range==="1d" && data.prev!=null)?data.prev:null, base=(prev!=null)?prev:c[0];
        var vmin=Math.min.apply(null, c), vmax=Math.max.apply(null, c);
        if(prev!=null){ vmin=Math.min(vmin, prev); vmax=Math.max(vmax, prev); }
        var pad=(vmax-vmin)*0.1 || Math.abs(vmax)*0.01 || 1, lo=vmin-pad, hi=vmax+pad, W=1000, H=170, t0=t[0], t1=Math.max(t[n-1], t0+1);
        var byIdx=(range==="1d"||range==="5d");
        function X(i){ return byIdx?(n>1?i/(n-1)*W:0):(t[i]-t0)/(t1-t0)*W; }
        function Y(v){ return H-(v-lo)/(hi-lo)*H; }
        var line=c.map(function(v,i){ return (i?"L":"M")+X(i).toFixed(1)+" "+Y(v).toFixed(1); }).join(" ");
        var col=(c[n-1]>=base)?"#4fd6a0":"#f4796b";
        var ref=(prev!=null)?'<line x1="0" x2="'+W+'" y1="'+Y(prev).toFixed(1)+'" y2="'+Y(prev).toFixed(1)+'" stroke="rgba(236,238,243,.3)" stroke-width="1" stroke-dasharray="5 5" vector-effect="non-scaling-stroke"/>':'';
        plot.innerHTML='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" aria-label="Cours '+esc(p.nom)+'"><defs><linearGradient id="adG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+col+'" stop-opacity=".30"/><stop offset="1" stop-color="'+col+'" stop-opacity="0"/></linearGradient></defs>'+
          '<path d="'+line+' L'+X(n-1).toFixed(1)+' '+H+' L'+X(0).toFixed(1)+' '+H+' Z" fill="url(#adG)"/>'+ref+
          '<path d="'+line+'" fill="none" stroke="'+col+'" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>'+
          '<span class="bch-yl" style="top:2px">'+esc(fmtPx(vmax, cur()))+'</span><span class="bch-yl" style="bottom:2px">'+esc(fmtPx(vmin, cur()))+'</span>'+
          '<div class="bch-end" style="left:'+(X(n-1)/W*100).toFixed(2)+'%;top:'+Y(c[n-1]).toFixed(1)+'px;background:'+col+'"></div>'+
          '<div class="bch-cross"></div><div class="bch-dot" style="background:'+col+'"></div>';
        s.q("#adX").innerHTML='<span>'+esc(lbl(t[0]))+'</span><span>'+esc(lbl(t[n-1]))+'</span>';
        ch={ X:X, Y:Y, n:n, W:W, col:col, base:base };
        readDefault();
      }
      (function wire(){
        var plot=s.q("#adPlot");
        function at(ev){
          if(!ch || !data) return;
          var r=plot.getBoundingClientRect(), x=Math.max(0, Math.min(r.width, ev.clientX-r.left)), xs=x/r.width*ch.W, best=0;
          for(var i=1;i<ch.n;i++){ if(Math.abs(ch.X(i)-xs)<Math.abs(ch.X(best)-xs)) best=i; }
          var v=data.c[best], cr=plot.querySelector(".bch-cross"), dt=plot.querySelector(".bch-dot");
          cr.style.display="block"; cr.style.left=(ch.X(best)/ch.W*r.width)+"px";
          dt.style.display="block"; dt.style.left=(ch.X(best)/ch.W*r.width)+"px"; dt.style.top=ch.Y(v)+"px";
          var d=v-ch.base, pc=ch.base?d/ch.base*100:0;
          s.q("#adRead").innerHTML='<span class="bch-val">'+esc(fmtPx(v, cur()))+'</span><span class="bch-cap" style="color:'+(d>=0?"var(--accent)":"var(--coral)")+'">'+(pc>=0?"+":"")+pc.toFixed(2).replace(".",",")+' %</span><span class="bch-cap">'+esc(lbl(data.t[best], true))+'</span>';
        }
        function end(){ var cr=plot.querySelector(".bch-cross"), dt=plot.querySelector(".bch-dot"); if(cr) cr.style.display="none"; if(dt) dt.style.display="none"; readDefault(); }
        plot.addEventListener("pointerdown", at);
        plot.addEventListener("pointermove", function(ev){ if(ev.pointerType==="mouse" || ev.buttons || ev.pressure>0) at(ev); });
        plot.addEventListener("pointerup", end); plot.addEventListener("pointerleave", end); plot.addEventListener("pointercancel", end);
      })();
      function load(showLoading){
        var my=++seq, r0=range;
        if(showLoading){ s.q("#adPlot").innerHTML='<div class="ad-load">Chargement du graphique…</div>'; s.q("#adRead").innerHTML=""; s.q("#adX").innerHTML=""; ch=null; }
        var pDay=adLoad(p, "1d").then(function(j){ day=j; return j; }, function(){ return null; });
        var pRange=(r0==="1d")?pDay:adLoad(p, r0).catch(function(){ return null; });
        Promise.all([pDay, pRange]).then(function(res){
          if(my!==seq || !document.body.contains(s.ov)) return;
          data=res[1];
          if(data && data.t && data.c && data.c.length>1) draw();
          else { s.q("#adPlot").innerHTML='<div class="ad-load">Graphique indisponible pour le moment.</div>'; s.q("#adRead").innerHTML=""; s.q("#adX").innerHTML=""; ch=null; }
          head();
        });
      }
      [].forEach.call(s.qa("#adR button"), function(b){ b.onclick=function(){
        range=b.getAttribute("data-r"); store.write("adRange", range);
        [].forEach.call(s.qa("#adR button"), function(x){ x.className=(x===b)?"on":""; });
        load(true);
      }; });
      head(); load(true);
      var timer=setInterval(function(){
        if(!document.body.contains(s.ov)){ clearInterval(timer); return; }
        if(document.hidden || s.q(".bch-cross[style*='block']")) return;
        if(range==="1d") load(false);
        else adLoad(p, "1d").then(function(j){ if(document.body.contains(s.ov)){ day=j; head(); } }, function(){});
      }, 30000);
    }
    var BRANGES=[["1J",1,"sur 24 h"],["1S",7,"sur 7 jours"],["1M",30,"sur 1 mois"],["3M",91,"sur 3 mois"],["6M",182,"sur 6 mois"],["1A",365,"sur 1 an"],["Max",0,"depuis le début"]];
    var bChart=null;
    function bDateLabel(t, long){
      var d=new Date(t);
      return long ? d.toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"})+" · "+d.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})
                  : d.toLocaleDateString("fr-FR",{day:"numeric",month:"short"});
    }
    function bourseBarsHTML(month, curM){
      var allM={}; bourse.forEach(function(c){ bMonths(c).forEach(function(mk){ allM[mk]=1; }); });
      var ms=Object.keys(allM).sort(); if(!ms.length) return "";
      function perf(mk){
        var pk=prevMonthKey(mk), g=0, base=0, any=false;
        bourse.forEach(function(c){
          if(bClosedAt(c,mk)) return; var a=bAt(c,mk); if(!a) return; var p=bAt(c,pk);
          var v=Number(a.valeur)||0, k=Number(a.capital)||0, pv=p?Number(p.valeur)||0:0, pc=p?Number(p.capital)||0:0;
          g+=(v-k)-(pv-pc); base+=pv+Math.max(0,k-pc); any=true;
        });
        return (any && base>0)?g/base*100:null;
      }
      var y=month.slice(0,4), years={}; ms.forEach(function(m){ years[m.slice(0,4)]=1; }); years[curM.slice(0,4)]=1;
      var ys=Object.keys(years).sort(), vals=[], mx=0, ytd=1, hasY=false;
      for(var i=1;i<=12;i++){ var mk=y+"-"+(i<10?"0":"")+i, r=(mk<=curM && mk>ms[0])?perf(mk):null; vals.push({mk:mk,r:r}); if(r!==null){ mx=Math.max(mx,Math.abs(r)); ytd*=1+r/100; hasY=true; } }
      if(!mx) mx=1;
      var sel=vals.filter(function(v){ return v.mk===month; })[0], LET="JFMAMJJASOND";
      function pc(r){ return (r>=0?"+":"−")+Math.abs(r).toFixed(1).replace(".",",")+" %"; }
      var H=70+Math.round(CHB/2), cols='';
      vals.forEach(function(v,i){
        var on=v.mk===month, fut=v.mk>curM, r=v.r, col=r===null?"":(r>=0?"var(--accent)":"var(--coral)");
        var hh=r===null?0:Math.max(3,Math.abs(r)/mx*(H-16));
        var bar=r===null?'':'<i style="position:absolute;left:0;right:0;'+(r>=0?'bottom:'+H+'px;height:'+hh+'px;border-radius:5px 5px 2px 2px':'top:'+H+'px;height:'+hh+'px;border-radius:2px 2px 5px 5px')+';background:'+col+';opacity:'+(on?1:.38)+'"></i>';
        var lab=(on&&r!==null)?'<b style="position:absolute;left:50%;transform:translateX(-50%);white-space:nowrap;font-size:10.5px;color:'+col+';'+(r>=0?'bottom:'+(H+hh+3)+'px':'top:'+(H+hh+3)+'px')+'">'+pc(r)+'</b>':'';
        cols+='<div class="bmonth" data-m="'+v.mk+'" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;cursor:'+(fut?'default':'pointer')+'">'+
          '<div style="position:relative;width:100%;height:'+(2*H)+'px;border-radius:6px;background:'+(on?'rgba(255,255,255,.07)':'rgba(255,255,255,.025)')+'">'+
          '<span style="position:absolute;left:0;right:0;top:'+H+'px;border-top:1px solid var(--line2)"></span>'+bar+lab+'</div>'+
          '<span style="font-size:10.5px;font-weight:'+(on?700:500)+';color:'+(on?'var(--ink)':fut?'rgba(255,255,255,.22)':'var(--muted)')+'">'+LET[i]+'</span></div>';
      });
      var head='<div class="bch-read">'+(hasY?'<span class="bch-badge" style="color:'+(ytd>=1?'var(--accent)':'var(--coral)')+';background:'+(ytd>=1?'var(--accent-dim)':'var(--coral-dim)')+'">'+(ytd>=1?'▲ ':'▼ ')+pc((ytd-1)*100)+'</span><span class="bch-cap">en '+y+'</span>':'<span class="bch-cap">Pas encore de mois complet en '+y+'</span>')+
        (sel&&sel.r!==null?'<span class="bch-cap" style="margin-left:auto">'+esc(capFirst(monthLabelOf(month).split(" ")[0]))+' <b style="color:'+(sel.r>=0?'var(--accent)':'var(--coral)')+'">'+pc(sel.r)+'</b></span>':'')+'</div>';
      var yrs=ys.length<2?'':'<div class="bch-ranges" style="justify-content:center">'+ys.map(function(yy){ return '<button type="button" class="bmyear'+(yy===y?' on':'')+'" data-y="'+yy+'" style="flex:0 0 auto;padding:8px 16px">'+yy+'</button>'; }).join("")+'</div>';
      return '<div class="bch">'+head+'<div style="display:flex;gap:5px;margin-top:10px">'+cols+'</div>'+yrs+'</div>';
    }
    function bourseSlides(curve, bars){
      if(!curve || !bars) return curve||bars;
      if(!state.bView) state.bView=store.read("bView","curve");
      var v=state.bView==="bars"?"bars":"curve", mode='';
      curve=curve.replace(/<button type="button" class="bch-mode"[^]*?<\/button>/, function(m){ mode=m; return ""; });
      if(v==="bars") mode=mode.replace('class="bch-mode"','class="bch-mode" style="display:none"');
      var IC='<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 14 L7 9 L11 12 L18 5"/></svg>';
      var IB='<svg viewBox="0 0 20 20" fill="currentColor"><rect x="2" y="9" width="4" height="9" rx="1.2"/><rect x="8" y="3" width="4" height="15" rx="1.2"/><rect x="14" y="11" width="4" height="7" rx="1.2"/></svg>';
      return mode+'<div class="bsl" id="bsl"><div class="bsl-track" id="bslT" style="transform:translateX('+(v==="bars"?"-50%":"0")+')"><div class="bsl-pane">'+curve+'</div><div class="bsl-pane">'+bars+'</div></div></div>'+
        '<div class="bsl-tog"><span><button type="button" data-v="curve" class="'+(v==="curve"?"on":"")+'" aria-label="Courbe">'+IC+'</button><button type="button" data-v="bars" class="'+(v==="bars"?"on":"")+'" aria-label="Mois par mois">'+IB+'</button></span></div>';
    }
    function wireBourseSlides(curM){
      var sl=document.getElementById("bsl"), tr=document.getElementById("bslT"); if(!sl||!tr) return;
      function go(v){ state.bView=v; store.write("bView", v); render(); }
      [].forEach.call(document.querySelectorAll(".bsl-tog button"), function(b){ b.onclick=function(){ go(b.getAttribute("data-v")); }; });
      var x0=null, y0=0, dx=0, moved=false, base=(state.bView==="bars")?-sl.clientWidth:0;
      sl.addEventListener("click", function(ev){ if(moved){ moved=false; ev.stopPropagation(); ev.preventDefault(); } }, true);
      sl.addEventListener("pointerdown", function(ev){ moved=false; var t=ev.target; while(t&&t!==sl){ if(t.id==="bchPlot") return; t=t.parentNode; } x0=ev.clientX; y0=ev.clientY; dx=0; });
      sl.addEventListener("pointermove", function(ev){ if(x0===null) return; dx=ev.clientX-x0; if(Math.abs(dx)>8 && Math.abs(dx)>Math.abs(ev.clientY-y0)){ tr.classList.add("drag"); tr.style.transform="translateX("+Math.max(-sl.clientWidth,Math.min(0,base+dx))+"px)"; } });
      function up(){ if(x0===null) return; x0=null; tr.classList.remove("drag"); if(Math.abs(dx)>10) moved=true;
        if(dx<-50 && state.bView!=="bars") return go("bars"); if(dx>50 && state.bView==="bars") return go("curve");
        tr.style.transform="translateX("+(state.bView==="bars"?"-50%":"0")+")"; }
      sl.addEventListener("pointerup", up); sl.addEventListener("pointercancel", up);
      [].forEach.call(document.querySelectorAll(".bmyear"), function(b){ b.onclick=function(){ var yy=b.getAttribute("data-y"), mk=(yy===curM.slice(0,4))?curM:yy+"-12"; if(!state.months) state.months={}; state.months.bourse=(mk===curM?null:mk); render(); }; });
    }
    // 1J : courbe de la journée reconstituée avec les cours intrajournaliers de chaque position (comptes manuels et liquidités fixes)
    var bDay=null, bDayBusy=false;
    function bDaySeries(p){
      var api=coursApi();
      function yahoo(sym){ if(!api) return Promise.reject(new Error("api")); return fetch(api+"/chart?symbol="+encodeURIComponent(sym)+"&range=5d").then(function(r){ return r.json(); }).then(function(j){ if(!j || !j.t || j.t.length<2) throw new Error("vide"); return { t:j.t, c:j.c }; }); }
      if(p.src==="yf") return yahoo(p.ref);
      return cgGet("/coins/"+encodeURIComponent(p.ref)+"/market_chart?vs_currency=eur&days=1", "/crypto/chart?id="+encodeURIComponent(p.ref)+"&days=1", function(j){ return j && Array.isArray(j.prices) && j.prices.length>1; })
        .then(function(j){ var t=[], c=[]; j.prices.forEach(function(x){ if(x && x[1]!=null){ t.push(x[0]); c.push(x[1]); } }); return { t:t, c:c }; })
        .catch(function(){ return yahoo(String(p.sym||"").toUpperCase()+"-EUR"); });
    }
    function loadBourseDay(){
      if(!FEAT.bourse) return;
      if(bDayBusy) return; bDayBusy=true;
      var items=[], fixed=0;
      bourse.forEach(function(c){
        if(c.sol && c.solQty && state.solPrice){ fixed+=bCash(bLast(c)); items.push({ p:{ src:"cg", ref:"solana", sym:"SOL" }, nowV:c.solQty*state.solPrice }); return; }
        var tot=bTot(bLast(c));
        if(bOpen(c)) (c.positions||[]).forEach(function(p){ if(p.src==="man") return; var v=posValue(p); if(v===null || !(v>0)) return; items.push({ p:p, nowV:v }); tot-=v; });
        fixed+=tot;
      });
      if(!items.length){ bDayBusy=false; bDay={ t:Date.now(), none:1 }; return; }
      Promise.all(items.map(function(it){ return bDaySeries(it.p).then(function(s){ it.s=s; }, function(){ it.fail=1; }); })).then(function(){
        var now=Date.now(), from=now-86400000, cap=bourseCapNow(), pts=[], fail=0;
        items.forEach(function(it){ if(it.fail || !it.s){ fail++; return; } it.last=it.s.c[it.s.c.length-1]; it.i=0; });
        for(var t=from; t<=now; t+=10*60000){
          var v=fixed;
          items.forEach(function(it){
            if(it.fail || !it.s || !it.last){ v+=it.nowV; return; }
            var s=it.s; while(it.i+1<s.t.length && s.t[it.i+1]<=t) it.i++;
            var px=s.c[0];
            if(s.t[it.i]<=t){ px=s.c[it.i]; var j=it.i+1; if(j<s.t.length && s.t[j]-s.t[it.i]<=2*3600000) px+=(s.c[j]-s.c[it.i])*(t-s.t[it.i])/(s.t[j]-s.t[it.i]); }
            v+=it.nowV*px/it.last;
          });
          pts.push({ t:t, v:Math.round(v*100)/100, c:cap });
        }
        pts.push({ t:now, v:Math.round(bourseTotalLive()*100)/100, c:cap });
        bDay=(fail===items.length)?{ t:now, none:1 }:{ t:now, pts:pts, fail:fail, n:items.length };
        bDayBusy=false;
        if((state.view==="bourse" && state.bRange==="1J") || state.view==="list") render();
      });
    }
    function bourseChartHTML(){
      var mode=state.bMode||store.read("bChartMode","pl"); state.bMode=mode;
      if(!state.bRange) state.bRange="1J";   // période affichée par défaut : la journée
      var rk=state.bRange, R=BRANGES.filter(function(r){ return r[0]===rk; })[0]||BRANGES[BRANGES.length-1];
      var src=bourseSeries();
      if(R[1]===1){
        if(bDay && bDay.pts && Date.now()-bDay.t<5*60000) src=bDay.pts;
        else if(!(bDay && bDay.none && Date.now()-bDay.t<5*60000)) setTimeout(loadBourseDay, 0);
      }
      var all=src.map(function(p){ return { t:p.t, v:(mode==="pl"?p.v-(p.c||0):p.v), c:p.c, m:p.m }; });
      if(!all.length){ bChart=null; return ""; }
      var now=Date.now(), from=R[1]?now-R[1]*86400000:all[0].t;
      var pts=all.filter(function(p){ return p.t>=from; });
      var before=all.filter(function(p){ return p.t<from; }).pop();
      if(before) pts.unshift({ t:from, v:before.v, c:before.c, start:1 });
      if(pts.length===1) pts.unshift({ t:Math.min(from, pts[0].t-86400000), v:pts[0].v, c:pts[0].c, start:1 });
      var t0=pts[0].t, t1=Math.max(pts[pts.length-1].t, t0+1);
      var vmin=Infinity, vmax=-Infinity; pts.forEach(function(p){ if(p.v<vmin) vmin=p.v; if(p.v>vmax) vmax=p.v; });
      var pad=(vmax-vmin)*0.12 || Math.max(1, vmax*0.02); vmin-=pad; vmax+=pad;
      var W=1000, H=160+CHB;
      function X(t){ return (t-t0)/(t1-t0)*W; } function Y(v){ return H-(v-vmin)/(vmax-vmin)*H; }
      var line=pts.map(function(p,i){ return (i?"L":"M")+X(p.t).toFixed(1)+" "+Y(p.v).toFixed(1); }).join(" ");
      var area=line+" L"+W+" "+H+" L0 "+H+" Z";
      var first=pts[0].v, lastV=pts[pts.length-1].v, diff=lastV-first, pct=first?diff/first*100:0;
      var col=diff>=0?"#4fd6a0":"#f4796b", bg=diff>=0?"rgba(79,214,160,.14)":"rgba(244,121,107,.14)";
      bChart={ pts:pts, t0:t0, t1:t1, vmin:vmin, vmax:vmax, H:H, first:first, col:col, bg:bg, label:R[2], mode:mode };
      var zero=(mode==="pl" && vmin<0 && vmax>0)?'<line x1="0" x2="'+W+'" y1="'+Y(0).toFixed(1)+'" y2="'+Y(0).toFixed(1)+'" stroke="rgba(236,238,243,.22)" stroke-width="1" stroke-dasharray="5 5" vector-effect="non-scaling-stroke"/>':'';
      var lp=pts[pts.length-1];
      var h='<button type="button" class="bch-mode" id="bchMode">Courbe : <b>'+(mode==="pl"?"plus-value":"valeur")+'</b> ⇄</button><div class="bch">';
      h+='<div class="bch-read" id="bchRead">'+bReadDefault()+'</div>';
      h+='<div class="bch-plot" id="bchPlot" style="height:'+H+'px"><svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" aria-label="Évolution du portefeuille '+esc(R[2])+'">'+
         '<defs><linearGradient id="bchG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+col+'" stop-opacity=".30"/><stop offset="1" stop-color="'+col+'" stop-opacity="0"/></linearGradient></defs>'+
         '<path d="'+area+'" fill="url(#bchG)"/>'+zero+
         '<path d="'+line+'" fill="none" stroke="'+col+'" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>'+
         '<span class="bch-yl" style="top:2px">'+(mode==="pl"?signS(vmax-pad):fmtS(vmax-pad))+'</span><span class="bch-yl" style="bottom:2px">'+(mode==="pl"?signS(vmin+pad):fmtS(vmin+pad))+'</span>'+
         '<div class="bch-end" style="left:'+(X(lp.t)/W*100).toFixed(2)+'%;top:'+(Y(lp.v)/H*100).toFixed(2)+'%;background:'+col+'"></div>'+
         '<div class="bch-cross" id="bchCross"></div><div class="bch-dot" id="bchDot" style="background:'+col+'"></div></div>';
      function xl(t){ if(R[1]!==1) return bDateLabel(t); var d=new Date(t), hm=d.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}); return (d.toDateString()===new Date().toDateString()?"":"hier ")+hm; }
      h+='<div class="bch-x"><span>'+esc(xl(t0))+'</span><span>'+esc(xl(t1))+'</span></div>';
      h+='<div class="bch-ranges">'+BRANGES.map(function(r){ return '<button type="button" class="bchr'+(r[0]===R[0]?' on':'')+'" data-r="'+r[0]+'">'+r[0]+'</button>'; }).join("")+'</div>';
      var since=bourseHist.length?bourseHist[0].t:null;
      return h+'</div>';
    }
    function bReadDefault(){
      if(!bChart) return "";
      var lp=bChart.pts[bChart.pts.length-1], diff=lp.v-bChart.first;
      if(bChart.mode==="pl"){
        return '<span class="bch-badge" style="color:'+bChart.col+';background:'+bChart.bg+'">'+(diff>=0?"▲ ":"▼ ")+signK(diff)+'</span><span class="bch-cap">de plus-value '+esc(bChart.label)+'</span>';
      }
      var pct=bChart.first?diff/bChart.first*100:0;
      return '<span class="bch-badge" style="color:'+bChart.col+';background:'+bChart.bg+'">'+(diff>=0?"▲ +":"▼ ")+pct.toFixed(2).replace(".",",")+' %</span><span class="bch-cap">'+signK(diff)+' '+esc(bChart.label)+'</span>';
    }
    function wireBourseChart(){
      var plot=document.getElementById("bchPlot"); if(!plot || !bChart) return;
      var cross=document.getElementById("bchCross"), dot=document.getElementById("bchDot"), read=document.getElementById("bchRead");
      [].forEach.call(document.querySelectorAll(".bchr"), function(b){ b.onclick=function(){ state.bRange=b.getAttribute("data-r"); render(); }; });
      var bm=document.getElementById("bchMode"); if(bm) bm.onclick=function(){ state.bMode=(state.bMode==="pl"?"val":"pl"); store.write("bChartMode", state.bMode); render(); };
      function at(ev){
        var r=plot.getBoundingClientRect(), x=Math.max(0, Math.min(r.width, ev.clientX-r.left));
        var t=bChart.t0+(x/r.width)*(bChart.t1-bChart.t0), best=bChart.pts[0];
        bChart.pts.forEach(function(p){ if(Math.abs(p.t-t)<Math.abs(best.t-t)) best=p; });
        var px=(best.t-bChart.t0)/(bChart.t1-bChart.t0)*r.width, py=bChart.H-(best.v-bChart.vmin)/(bChart.vmax-bChart.vmin)*bChart.H;
        cross.style.display="block"; cross.style.left=px+"px";
        dot.style.display="block"; dot.style.left=px+"px"; dot.style.top=py+"px";
        var d=best.v-bChart.first, pc, colr;
        if(bChart.mode==="pl"){ pc=best.c?best.v/best.c*100:0; colr=(best.v>=0?"var(--accent)":"var(--coral)"); }
        else { pc=bChart.first?d/bChart.first*100:0; colr=(d>=0?"var(--accent)":"var(--coral)"); }
        read.innerHTML='<span class="bch-val"></span><span class="bch-cap" style="color:'+colr+'">'+(pc>=0?"+":"")+pc.toFixed(2).replace(".",",")+' %'+(bChart.mode==="pl"?" du capital":"")+'</span><span class="bch-cap bch-when"></span>';
        read.querySelector(".bch-val").textContent=(bChart.mode==="pl"?signK(best.v):fmtK(best.v));
        read.querySelector(".bch-when").textContent=(best.start?"début de période":(best.m?"fin "+new Date(best.t).toLocaleDateString("fr-FR",{month:"long",year:"numeric"}):bDateLabel(best.t,true)));
      }
      function end(){ cross.style.display="none"; dot.style.display="none"; read.innerHTML=bReadDefault(); }
      plot.addEventListener("pointerdown", function(ev){ at(ev); });
      plot.addEventListener("pointermove", function(ev){ if(ev.pointerType==="mouse" || ev.buttons || ev.pressure>0) at(ev); });
      plot.addEventListener("pointerup", end); plot.addEventListener("pointerleave", end); plot.addEventListener("pointercancel", end);
    }
    function persistBourse(){ store.write("bourse", bourse); if(bourse.length){ try{ store.write("bourseSafe", { t:new Date().toISOString(), bourse:bourse }); }catch(e){} } }
    function bMonths(c){ return Object.keys(c.vals||{}).sort(); }
    function bLast(c){ var ms=bMonths(c); return ms.length?c.vals[ms[ms.length-1]]:null; }
    function bPrev(c){ var ms=bMonths(c); return ms.length>1?c.vals[ms[ms.length-2]]:null; }
    function bFirst(c){ var ms=bMonths(c); return ms.length?c.vals[ms[0]]:null; }
    function bourseTotalLive(){ var t=0; bourse.forEach(function(c){ if(c.sol && c.solQty && state.solPrice){ t+=c.solQty*state.solPrice+bCash(bLast(c)); } else { t+=bTot(bLast(c)); } }); return t; }
    // La Bourse est une ligne automatique de l'épargne (bourseLink), une seule, qui suit le portefeuille : elle compte une fois dans tous les totaux.
    // Créée dès qu'il y a un compte Bourse ; s'il y en avait plusieurs (ancienne liaison manuelle), les autres reprennent leur valeur d'avant la liaison.
    function ensureBourseEp(){
      if(!FEAT.bourse || fyMember()) return false;
      var L=epargne.filter(function(c){ return c.bourseLink; }), ch=false;
      L.slice(1).forEach(function(c){ c.bourseLink=false; var pl=c.preLink; delete c.preLink; ch=true;
        if(pl && pl.month && c.vals){ Object.keys(c.vals).forEach(function(k){ if(k>=pl.month) delete c.vals[k]; }); if(pl.had) c.vals[pl.month]=pl.val; } });
      if(!L.length && bourse.length){   // avec l'historique du portefeuille, mois par mois
        var v={}, ms={}; bourse.forEach(function(c){ bMonths(c).forEach(function(m){ ms[m]=1; }); });
        Object.keys(ms).sort().forEach(function(m){ var t=0; bourse.forEach(function(c){ var u=bMonthsUpto(c, m); if(u.length) t+=bTot(c.vals[u[u.length-1]]); }); v[m]=Math.round(t*100)/100; });
        v[monthKey(todayISO())]=bourseTotalLive();
        epargne.push({ id:Date.now(), nom:"Bourse", vals:v, bourseLink:true, auto:1 }); ch=true; }
      return ch;
    }
    function bourseEpAt(m, keep){ var t=0; epargne.forEach(function(c){ if(c.bourseLink && (!keep || keep(c))) t+=epAt(c, m); }); return t; }
    function syncBourseEpargne(){ if(!FEAT.bourse || fyMember()) return; try{ recordBourseHist(); }catch(err){} var m=monthKey(todayISO()), ch=ensureBourseEp(), tot=bourseTotalLive(); epargne.forEach(function(c){ if(c.bourseLink){ if(!c.vals) c.vals={}; if(Number(c.vals[m])!==tot){ c.vals[m]=tot; ch=true; } } }); if(ch) persistEpargne(); }
    function bPct(from,to){ if(!from||from===0) return null; var p=(to-from)/Math.abs(from)*100; return (p>=0?"+":"")+p.toFixed(1).replace(".",",")+" %"; }
    function bPctCol(from,to){ return (to-from)>=0?"#4fd6a0":"#f4796b"; }
    function bBadge(from,to,label){
      if(from===null||from===undefined) return "";
      var diff=to-from, pct=bPct(from,to), col=bPctCol(from,to);
      return '<span style="color:var(--ink-soft)">'+label+'</span> <span style="color:'+col+';font-weight:600">'+(diff>=0?"+":"")+fmtK(diff)+(pct?" ("+pct+")":"")+'</span>';
    }
    function addBourse(){
      uiForm({ title:"Nouveau compte bourse", fields:[
        {key:"nom", label:"Nom du compte", placeholder:"eToro, PEA, Boursorama…", required:true},
        {key:"cap", label:"Capital investi", type:"money", value:"", help:"Ce que tu as placé en actions / cryptos."},
        {key:"val", label:"Valeur actuelle des placements", type:"money", value:"", help:"Vide = égale au capital. Si tu ajoutes ensuite des actions ou cryptos, elle se calcule toute seule."},
        {key:"cash", label:"Reste à investir (optionnel)", type:"money", value:"", help:"Argent disponible sur le compte, pas encore placé."}
      ]}, function(r){
        var m=monthKey(todayISO()), o={ capital:r.cap||0, valeur:(r.val!==null?r.val:(r.cap||0)) }, v={};
        if(r.cash>0) o.cash=r.cash;
        v[m]=o; bourse.push({ id:Date.now(), nom:r.nom, vals:v });
        persistBourse(); syncBourseEpargne(); render();
      });
    }
    function editBourse(id){
      var c=bourse.filter(function(x){ return String(x.id)===String(id); })[0]; if(!c) return;
      if(!c.vals) c.vals={};
      var m0=monthKey(todayISO()), mv=(state.months&&state.months.bourse)||m0, hasPos=!!(c.positions&&c.positions.length);
      function snapAt(m){ return c.vals[m]||bAt(c,m)||{}; }
      function autoVal(m){ return m===m0 && !!(hasPos || (c.sol&&c.solQty&&state.solPrice) || (c.stock&&c.stock.symbol&&state.stockPrices[c.stock.symbol])); }
      function nz(v){ return (v===undefined||v===null)?"":v; }
      function autoCap(){ if(!hasPos) return null; var t=0; for(var i=0;i<c.positions.length;i++){ var p=c.positions[i]; if(p.src==="man"){ if(!(p.investi>0)) return null; t+=Number(p.investi); continue; } var ce=costBase(p); if(ce===null) return null; t+=ce; } return Math.round(t*100)/100; }
      var aCap=autoCap();
      var s0=snapAt(mv), cc0=s0.cashCur||BASE;
      uiForm({ title:"Modifier « "+c.nom+" »", fields:[
        {key:"nom", label:"Nom du compte", value:c.nom, required:true},
        {key:"mois", label:"Mois", type:"month", value:mv,
          onChange:function(v,api){ if(!/^[0-9]{4}-[0-9]{2}$/.test(v||"")) return; var s=snapAt(v), cc=s.cashCur||BASE; api.set("cap", nz(s.capital)); api.set("val", nz(s.valeur)); api.set("cashCur", cc); api.suffix("cash", curSym(cc)); api.set("cash", (cc!==BASE?s.cashOrig:bCash(s))||""); api.show("val", !autoVal(v)); }},
        {key:"cap", label:"Capital investi", type:"money", value:nz(s0.capital), help:(aCap!==null?"Calculé depuis le prix d'achat de tes positions ("+fmt(aCap)+"). Tape un autre montant pour le fixer toi-même, vide = calcul automatique.":"Ce que tu as placé en actions / cryptos.")},
        {key:"val", label:"Valeur des placements", type:"money", value:nz(s0.valeur), hidden:autoVal(mv), help:"Sans le reste à investir."},
        {key:"sol", label:"Nombre de SOL détenus", type:"qty", value:nz(c.solQty), hidden:!c.sol},
        {key:"cashCur", label:"Devise du reste à investir", type:"seg", value:cc0, options:curOpts(cc0), onChange:function(v,api){ api.suffix("cash", curSym(v)); }},
        {key:"cash", label:"Reste à investir", type:"money", suffix:curSym(cc0), value:((cc0!==BASE?s0.cashOrig:bCash(s0))||""), help:"Argent disponible sur le compte, pas encore placé. Vide = rien."+(BASE!=="USD"?" Sur eToro, il est en $.":"")}
      ], focus:false }, function(r){
        c.nom=r.nom||c.nom;
        if(c.sol && r.sol>0) c.solQty=r.sol;
        var m=(r.mois && /^[0-9]{4}-[0-9]{2}$/.test(r.mois))?r.mois:mv, s=snapAt(m);
        if(bClosedAt(c,m)) return "Ce compte est clôturé depuis "+monthLabelOf(c.closed)+" : choisis un mois avant.";
        var valeur=(r.val===null)?(Number(s.valeur)||0):r.val;
        if(m===m0 && c.stock && c.stock.symbol && state.stockPrices[c.stock.symbol]) valeur=(c.stock.qty||0)*state.stockPrices[c.stock.symbol]+(Number(c.stock.cash)||0);
        else if(m===m0 && c.sol && c.solQty && state.solPrice) valeur=c.solQty*state.solPrice;
        if(aCap!==null && m===m0){
          if(r.cap===null || (!c.capManual && Math.abs(r.cap-aCap)<0.005)){ delete c.capManual; if(r.cap===null) r.cap=aCap; }
          else c.capManual=true;
        }
        var o={ capital:(r.cap===null?(Number(s.capital)||0):r.cap), valeur:valeur };
        if(r.cash>0){
          if(r.cashCur && r.cashCur!==BASE){ var cv=toBase(r.cash, r.cashCur); o.cashCur=r.cashCur; o.cashOrig=r.cash; o.cash=(cv!==null?Math.round(cv*100)/100:r.cash); }
          else o.cash=r.cash;
        }
        c.vals[m]=o;
        persistBourse(); applyPositions(); syncBourseEpargne(); render();
      });
    }
    function delBourse(id){
      var c=bourse.filter(function(x){ return String(x.id)===String(id); })[0]; if(!c) return;
      var m0=monthKey(todayISO()), mv=(state.months&&state.months.bourse)||m0;
      var hasPast=bMonths(c).some(function(m){ return m<mv; });
      function wipe(){ bourse=bourse.filter(function(x){ return x!==c; }); persistBourse(); syncBourseEpargne(); render(); uiToast("Compte supprimé"); }
      if(c.closed || !hasPast){
        uiConfirm("Supprimer « "+esc(c.nom)+" »"+(c.closed?" et tout son historique ?<br>Les mois passés ne le compteront plus.":" ?"), wipe, { ok:"Supprimer", danger:true });
        return;
      }
      uiChoice(c.nom, "Tu ne l'as plus ? <b>Clôture-le</b> : il reste dans l'historique jusqu'à "+monthLabelOf(prevMonthKey(mv))+" et ne compte plus à partir de "+monthLabelOf(mv)+".", [
        { l:"Clôturer le compte", fn:function(){ closeBourse(c, mv); persistBourse(); syncBourseEpargne(); render(); uiToast("Compte clôturé · historique conservé"); } },
        { l:"Supprimer avec tout l'historique", danger:true, fn:function(){ uiConfirm("Supprimer aussi son historique ?<br>Les mois passés ne le compteront plus.", wipe, { ok:"Supprimer", danger:true }); } }
      ]);
    }
    // Restaure depuis une sauvegarde : toute la Bourse, ou seulement les comptes supprimés depuis (ils reviennent clôturés)
    function restoreBourseOnly(){
      var inp=document.createElement("input"); inp.type="file"; inp.accept="application/json,.json";
      inp.onchange=function(){
        var f=inp.files && inp.files[0]; if(!f) return;
        var rd=new FileReader();
        rd.onload=function(){
          var obj=null, data=null; try{ obj=JSON.parse(rd.result); data=(obj && obj.data && typeof obj.data==="object")?obj.data:obj; }catch(e){}
          if(!data || !Array.isArray(data.bourse) || !data.bourse.length){ uiToast("Pas de Bourse dans ce fichier"); return; }
          var nPos=0; data.bourse.forEach(function(c){ nPos+=(c.positions||[]).length; });
          var dt=(obj && obj._date)?new Date(obj._date).toLocaleString("fr-FR",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):"";
          function replaceAll(){
            uiConfirm("Remplacer l'onglet Bourse par celui de la sauvegarde"+(dt?" du "+esc(dt):"")+" ?<br><b>"+data.bourse.length+" compte"+(data.bourse.length>1?"s":"")+"</b>, "+nPos+" position"+(nPos>1?"s":"")+".<br>Tickets, comptes bancaires et épargne ne bougent pas.", function(){
              bourse=data.bourse; persistBourse();
              if(Array.isArray(data.bourseHist)){ bourseHist=data.bourseHist; store.write("bourseHist", bourseHist); }
              applyPositions(); syncBourseEpargne(); render(); uiToast("Bourse restaurée ✓");
            }, { ok:"Restaurer la Bourse" });
          }
          // Comptes présents dans la sauvegarde mais supprimés depuis : ils peuvent revenir seuls, clôturés
          var m0=monthKey(todayISO()), ids={}; bourse.forEach(function(c){ ids[String(c.id)]=1; });
          var miss=data.bourse.filter(function(c){ return c && c.vals && !ids[String(c.id)] && Object.keys(c.vals).some(function(m){ return m<m0; }); });
          if(!miss.length) return replaceAll();
          var names=miss.map(function(c){ return "« "+esc(c.nom)+" »"; }).join(", ");
          uiChoice("Sauvegarde"+(dt?" du "+dt:""), (miss.length>1?"Comptes supprimés depuis : ":"Compte supprimé depuis : ")+names+".<br><b>Récupérer</b> le remet dans l'historique des mois passés, clôturé à partir de "+monthLabelOf(m0)+", sans toucher à tes comptes actuels.", [
            { l:(miss.length>1?"Récupérer les "+miss.length+" comptes supprimés":"Récupérer ce compte"), fn:function(){
              miss.forEach(function(c){ if(!c.closed || c.closed>m0) closeBourse(c, m0); bourse.push(c); });
              persistBourse(); syncBourseEpargne(); render(); uiToast("Historique récupéré ✓");
            } },
            { l:"Remplacer toute la Bourse", danger:true, fn:replaceAll }
          ]);
        };
        rd.onerror=function(){ uiToast("Lecture du fichier impossible"); };
        rd.readAsText(f);
      };
      inp.click();
    }
    function epMonthsOf(c){ return Object.keys(c.vals||{}).sort(); }
    function epCurrent(c){ var ms=epMonthsOf(c); return ms.length?(Number(c.vals[ms[ms.length-1]])||0):0; }
    function epPrev(c){ var ms=epMonthsOf(c); return ms.length>1?(Number(c.vals[ms[ms.length-2]])||0):null; }
    function epFirst(c){ var ms=epMonthsOf(c); return ms.length?(Number(c.vals[ms[0]])||0):null; }
    function epAt(c, mk){ var ms=epMonthsOf(c).filter(function(m){ return m<=mk; }); return ms.length?(Number(c.vals[ms[ms.length-1]])||0):0; }
    function epPrevAt(c, mk){ var ms=epMonthsOf(c).filter(function(m){ return m<=mk; }); return ms.length>1?(Number(c.vals[ms[ms.length-2]])||0):null; }
    function pctStr(from,to){ if(from===null||from===0) return null; var p=(to-from)/Math.abs(from)*100; return (p>=0?"+":"-")+Math.abs(p).toFixed(1).replace(".",",")+" %"; }
    function pctColor(from,to){ if(from===null) return "var(--ink-soft)"; return (to-from)>=0?"#4fd6a0":"#f4796b"; }
    function addEpargne(){
      uiForm({ title:"Nouveau compte épargne", fields:[
        {key:"nom", label:"Nom du compte", placeholder:"Livret A, assurance vie…", required:true}
      ].concat(ownerField(null)).concat([
        {key:"montant", label:"Montant actuel", type:"money", value:""},
        {key:"obj", label:"Objectif (optionnel)", type:"money", value:"", help:"Un montant à atteindre, avec une date si tu veux."},
        {key:"objMois", label:"Pour quand (optionnel)", type:"month", value:""}
      ])}, function(r){
        var m=monthKey(todayISO()), v={}, c={ id:Date.now(), nom:r.nom, vals:v };
        setOwner(c, r);
        v[m]=r.montant||0;
        if(r.obj && r.obj>0) c.objectif={ montant:r.obj, mois:r.objMois||"" };
        epargne.push(c); persistEpargne(); render();
      });
    }
    function editEpargne(id){
      var c=epargne.filter(function(x){ return String(x.id)===String(id); })[0]; if(!c) return;
      if(!c.vals) c.vals={};
      var m0=monthKey(todayISO());
      function valAt(m){ return (m in c.vals)?c.vals[m]:epCurrent(c); }
      var ob=c.objectif||{};
      uiForm({ title:"Modifier « "+c.nom+" »", fields:[
        {key:"nom", label:"Nom du compte", value:c.nom, required:true}
      ].concat(ownerField(c.owner||"")).concat([
        {key:"mois", label:"Mois à corriger", type:"month", value:m0, hidden:!!c.bourseLink,
          onChange:function(v,api){ if(/^[0-9]{4}-[0-9]{2}$/.test(v||"")) api.set("montant", valAt(v)); }},
        {key:"montant", label:"Montant ce mois-là", type:"money", value:valAt(m0), hidden:!!c.bourseLink, help:"Vide = effacer la valeur saisie pour ce mois."},
        {key:"obj", label:"Objectif (optionnel)", type:"money", value:(ob.montant||""), help:"Vide = pas d'objectif."},
        {key:"objMois", label:"Pour quand (optionnel)", type:"month", value:(ob.mois||"")}
      ])}, function(r){
        c.nom=r.nom||c.nom; setOwner(c, r);
        if(!c.bourseLink){
          var m=(r.mois && /^[0-9]{4}-[0-9]{2}$/.test(r.mois))?r.mois:m0;
          if(r.montant===null){ if(m in c.vals) delete c.vals[m]; } else c.vals[m]=r.montant;
        }
        if(r.obj && r.obj>0) c.objectif={ montant:r.obj, mois:r.objMois||"" }; else delete c.objectif;
        persistEpargne(); render();
      });
    }
    function toggleEpargneLink(id){
      var c=epargne.filter(function(x){ return String(x.id)===String(id); })[0]; if(!c) return;
      var m=monthKey(todayISO());
      if(!c.vals) c.vals={};
      if(c.bourseLink){
        c.bourseLink=false;
        var pl=c.preLink; delete c.preLink;
        persistEpargne(); render();
        uiConfirm("« "+esc(c.nom)+" » n'est plus lié à la Bourse.<br>Revenir à la valeur d'avant la liaison ?", function(){
          if(pl && pl.month===m && pl.had) c.vals[m]=pl.val; else delete c.vals[m];
          persistEpargne(); render();
        }, {ok:"Revenir à la valeur d'avant", no:"Garder la valeur"});
        return;
      }
      uiConfirm("Lier « "+esc(c.nom)+" » au total de l'onglet Bourse ?<br>Sa valeur suivra le portefeuille automatiquement.", function(){
        c.preLink={ month:m, had:(m in c.vals), val:c.vals[m] }; c.bourseLink=true; c.vals[m]=bourseTotalLive();
        persistEpargne(); render();
      }, {ok:"Lier"});
    }
    function delEpargne(id){
      var c=epargneById(id); if(!c) return;
      uiConfirm("Supprimer le compte « "+esc(c.nom)+" » ?", function(){
        epargne=epargne.filter(function(x){ return String(x.id)!==String(id); });
        persistEpargne(); render();
      }, {ok:"Supprimer", danger:true});
    }

    var APPRIS = store.read("appris", {});
    function persistAppris(){ store.write("appris", APPRIS); }
    var SIM_THRESHOLD = store.read("simThreshold", 65);
    function persistSim(){ store.write("simThreshold", SIM_THRESHOLD); }
    function norm(s){ return (s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z ]/g," ").replace(/\s+/g," ").trim(); }
    function alphaSort(arr){ return arr.slice().sort(function(a,b){ return String(a).localeCompare(String(b),"fr",{sensitivity:"base"}); }); }
    function lev(a,b){
      var m=a.length, n=b.length; if(!m) return n; if(!n) return m;
      var prev=[], cur=[], i, j;
      for(j=0;j<=n;j++) prev[j]=j;
      for(i=1;i<=m;i++){
        cur[0]=i;
        for(j=1;j<=n;j++){ var cost=a.charAt(i-1)===b.charAt(j-1)?0:1; cur[j]=Math.min(prev[j]+1, cur[j-1]+1, prev[j-1]+cost); }
        for(j=0;j<=n;j++) prev[j]=cur[j];
      }
      return prev[n];
    }
    function simRatio(a,b){
      if(!a||!b) return 0;
      var lr=1 - lev(a,b)/Math.max(a.length,b.length);
      var wa=a.split(" "), wb=b.split(" "), setb={}, uni={}, inter=0, seen={}, k;
      for(k=0;k<wb.length;k++){ setb[wb[k]]=1; uni[wb[k]]=1; }
      for(k=0;k<wa.length;k++){ uni[wa[k]]=1; if(setb[wa[k]] && !seen[wa[k]]){ inter++; seen[wa[k]]=1; } }
      var tot=0; for(var u in uni) tot++;
      var wr=tot? inter/tot : 0;
      return Math.max(lr, wr);
    }
    // Produits appris : propres à chaque personne, tirés de ses tickets (pour un article, le produit qu'elle lui a donné la dernière fois)
    var apprisMemo={ arr:null, v:-1, p:null, m:null }, entriesVer=0;
    function apprisOf(person){
      if(apprisMemo.arr===state.entries && apprisMemo.v===entriesVer && apprisMemo.p===person) return apprisMemo.m;
      var m={};
      state.entries.filter(function(e){ return payerOf(e)===person; })
        .sort(function(a, b){ return String(a.date||"").localeCompare(String(b.date||"")) || ((Number(a.id)||0)-(Number(b.id)||0)); })
        .forEach(function(e){ (e.articles||[]).forEach(function(a){ var n=norm(a.label); if(n && a.produit && a.produit!=="Remise") m[n]=a.produit; }); });
      apprisMemo={ arr:state.entries, v:entriesVer, p:person, m:m }; return m;
    }
    function lookupAppris(label, person){
      var D=person ? apprisOf(person) : APPRIS;
      var n=norm(label); if(!n) return "";
      if(D[n]) return D[n];
      var best="", bestKey="";
      var sn=" "+n+" ";   // mots entiers seulement : « eur » ne doit pas trouver « beurre »
      for(var k in D){ if(k.length>=3 && (sn.indexOf(" "+k+" ")>=0 || (n.length>=4 && (" "+k+" ").indexOf(sn)>=0)) && k.length>bestKey.length){ bestKey=k; best=D[k]; } }
      if(best) return best;
      var bestScore=0, bestSim="";
      for(var k2 in D){ if(k2.length<3) continue; var sc=simRatio(n,k2); if(sc>bestScore){ bestScore=sc; bestSim=D[k2]; } }
      if(bestScore>=SIM_THRESHOLD/100) return bestSim;
      return "";
    }

    var DEFAULT_FAMILLE_DE = { "Tomates":"Nourriture","Yaourts":"Nourriture","Pain":"Nourriture","Lait":"Nourriture","Œufs":"Nourriture","Fromage":"Nourriture","Pâtes":"Nourriture","Riz":"Nourriture","Café":"Boissons","Fruits":"Nourriture","Légumes":"Nourriture","Viande":"Nourriture","Éponges":"Divers","Lessive":"Divers","Produits ménagers":"Divers","Remise":"Divers" };
    var FAMILLE_DE = store.read("familleDe", null) || {};
    (function(){ for(var k in DEFAULT_FAMILLE_DE){ if(!(k in FAMILLE_DE)) FAMILLE_DE[k]=DEFAULT_FAMILLE_DE[k]; } FAMILLES.forEach(function(f){ FAMILLE_DE[f]=f; }); })();
    function persistFamille(){ store.write("familleDe", FAMILLE_DE); }
    function familleOf(p){ return FAMILLE_DE[p] || FAM_FB; }
    var CANON_FAM=["Alimentation","Fruits & légumes","Boissons","Hygiène & soins","Entretien & maison","Animaux","Bricolage & outillage","Multimédia & high-tech","Vêtements","Santé","Restaurant & bar","Divers"];
    var CANON_MAP={
      "Pain":"Alimentation","Pâtes / Riz":"Alimentation","Œufs":"Alimentation","Fromage":"Alimentation","Yaourts":"Alimentation","Lait":"Alimentation","Viande":"Alimentation","Poisson":"Alimentation","Conserves":"Alimentation","Surgelés":"Alimentation","Épicerie sucrée":"Alimentation","Épicerie salée":"Alimentation",
      "Fruits":"Fruits & légumes","Légumes":"Fruits & légumes",
      "Eau":"Boissons","Jus":"Boissons","Sodas":"Boissons","Café / Thé":"Boissons","Bière":"Boissons","Vin":"Boissons","Apéritif":"Boissons",
      "Savon":"Hygiène & soins","Shampoing":"Hygiène & soins","Dentifrice":"Hygiène & soins","Papier toilette":"Hygiène & soins","Produit corps":"Hygiène & soins","Cosmétique":"Hygiène & soins",
      "Lessive":"Entretien & maison","Produits ménagers":"Entretien & maison","Éponges":"Entretien & maison","Sacs poubelle":"Entretien & maison","Vaisselle":"Entretien & maison",
      "Nourriture chat":"Animaux","Litière":"Animaux",
      "Visserie":"Bricolage & outillage","Quincaillerie":"Bricolage & outillage","Peinture":"Bricolage & outillage","Outils":"Bricolage & outillage","Matériaux":"Bricolage & outillage",
      "Électronique":"Multimédia & high-tech","Câbles":"Multimédia & high-tech","Abonnement":"Multimédia & high-tech","Jeux":"Multimédia & high-tech",
      "Vêtements":"Vêtements","Chaussures":"Vêtements",
      "Médicaments":"Santé","Parapharmacie":"Santé",
      "Repas":"Restaurant & bar","Boissons bar":"Restaurant & bar"
    };
    var CANON_LEGACY={ "Nourriture":"Alimentation","Corps et soins":"Hygiène & soins","Soins":"Hygiène & soins","Hygiène":"Hygiène & soins","Outillage":"Bricolage & outillage","Bricolage":"Bricolage & outillage","Multimédia":"Multimédia & high-tech","high-tech":"Multimédia & high-tech","High-tech":"Multimédia & high-tech","Restaurant":"Restaurant & bar","Bar":"Restaurant & bar","Chat":"Animaux","Ménage":"Entretien & maison","Maison":"Entretien & maison" };
    if(store.read("taxoV2",null)!==2){
      FAMILLES=CANON_FAM.slice();
      var _prod=FAMILLES.slice();
      for(var _k in CANON_MAP){ if(_prod.indexOf(_k)<0) _prod.push(_k); }
      if(_prod.indexOf("Remise")<0) _prod.push("Remise");
      PRODUITS=_prod;
      FAMILLE_DE={};
      for(var _m in CANON_MAP){ FAMILLE_DE[_m]=CANON_MAP[_m]; }
      for(var _l in CANON_LEGACY){ FAMILLE_DE[_l]=CANON_LEGACY[_l]; }
      FAMILLES.forEach(function(f){ FAMILLE_DE[f]=f; });
      FAMILLE_DE["Remise"]="Divers";
      persistFamilles(); persistProd(); persistFamille();
      store.write("taxoV2",2);
    }
