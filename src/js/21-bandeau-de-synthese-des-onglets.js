    // ---------- Bandeau de synthèse des onglets ----------
    function fmtK(n){ return fmt(n).replace(/\B(?=(\d{3})+,)/g, " "); }
    function moneyBig(n){ var neg=n<0; n=Math.abs(Number(n)||0); var e=Math.floor(n), c=Math.round((n-e)*100); if(c===100){ e++; c=0; }
      return (neg?"−":"")+String(e).replace(/\B(?=(\d{3})+(?!\d))/g," ")+'<span class="cts">,'+(c<10?"0":"")+c+' '+curSym()+'</span>'; }
    function signK(n){ return (n>0?"+":"")+fmtK(n); }
    function fmtS(n){ n=Number(n)||0; return Math.abs(n)>=1000 ? (n<0?"−":"")+String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g,"\u202f")+" "+curSym() : fmt(n); }
    function signS(n){ return (n>0?"+":"")+fmtS(n); }
    function tabHero(o){
      var h='<section class="dash-hero thero"><div class="dash-cap">'+o.label+'</div>';
      h+='<div class="dash-big" style="margin-top:6px;color:'+(o.color||"var(--ink)")+'">'+moneyBig(o.big)+'</div>';
      if(o.sub) h+='<div class="dash-cap" style="margin-top:2px">'+o.sub+'</div>';
      if(o.extra) h+=o.extra;
      if(o.stats && o.stats.length){
        h+='<div class="hstats">';
        o.stats.forEach(function(s){ h+='<div class="hstat"><span>'+s.l+'</span><b'+(s.c?' style="color:'+s.c+'"':'')+'>'+s.v+'</b>'+(s.keep && s.d?'<i'+(s.c?' style="color:'+s.c+'"':'')+'>'+s.d+'</i>':'')+'</div>'; });   // deux lignes seulement (titre + valeur) : plus de place pour le graphique
        h+='</div>';
      }
      return h+'</section>';
    }
    function heroCol(n){ return n>0.004?"var(--accent)":(n<-0.004?"var(--coral)":"var(--ink)"); }
    function pctTxt(v){ v=Math.round((Number(v)||0)*10)/10; return String(v).replace(".",",")+" %"; }
