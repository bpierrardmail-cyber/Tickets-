    // ---------- À venir › Frais fixes (refonte du 19/11) ----------
    // en haut le total du mois (payé / reste), des pastilles pour filtrer (Commun, chaque personne), d'abord ce qui reste à payer
    // rangé par jour (les mises de côté des provisions en une ligne qui se déplie), les payés repliés, puis ta part du commun et le perso
    function renderFraisAv(){
      var curM=monthKey(todayISO()), month=(state.months&&state.months.communes)||curM, ro=fyRO();
      var CM=communModel(month), D=CM.D, me=CM.me, ppl=CM.ppl, fPct=CM.fPct, persoOf=CM.persoOf;
      var groups=[{ k:"Commun", items:D.byP.Commun?D.byP.Commun.items:[] }];
      ppl.forEach(function(w){ if(D.byP[w] && D.byP[w].items.length) groups.push({ k:w, items:D.byP[w].items }); });
      var who=state.fxWho||"all"; if(who!=="all" && !groups.some(function(g){ return g.k===who && g.items.length; })) who="all";
      var all=[]; groups.forEach(function(g){ if(who==="all" || who===g.k) g.items.forEach(function(f){ all.push(f); }); });
      var tot=0, paid=0, nPaid=0; all.forEach(function(f){ var v=fraisMontant(f, month)||0; tot+=v; if(fraisDone(f, month)){ paid+=v; nPaid++; } });
      var todo=all.filter(function(f){ return !fraisDone(f, month); }), done=all.filter(function(f){ return fraisDone(f, month); });
      function dOf(f){ return fraisDay(f, month)||0; }
      function byDay(a, b){ var x=dOf(a)||99, y=dOf(b)||99; return x!==y ? x-y : fraisMontant(b, month)-fraisMontant(a, month); }
      var mAb=MOIS3[+month.slice(5,7)-1];
      function tagOf(f){ var k=((f.personne||"").trim()||"Commun"), c=k==="Commun" ? "#7c9cf4" : personColor(k); return '<span class="fx2-tag" style="background:color-mix(in srgb, '+c+' 24%, transparent);color:'+c+'">'+esc(k==="Commun"?"Commun":(k===me?"Toi":k))+'</span>'; }
      function row(f){ var dn=fraisDone(f, month), fpv=f.prov!=null?provById(f.prov):null, fpp=f.pp!=null?provById(f.pp):null, d=dOf(f), com=((f.personne||"").trim()||"Commun")==="Commun";
        var sub=fpp ? "payée par « "+fpp.nom+" » · hors parts" : (fpv ? provDest(fpv, f) : (f.recurrent?"chaque mois":"ce mois"))+(f.split?" · chacun sa part":"")+(com && !fpp?" · ta part "+fmtK(fraisMontant(f, month)*fPct(f, me)/100)+(fraisPartsAt(f, month)?" ✦":""):"");
        return '<div class="fxrow fx2-r"><button class="fxdone'+(dn?' on':'')+'" type="button" data-id="'+esc(f.id)+'" aria-label="'+(dn?'Payé · décocher':'Marquer payé')+'">'+(dn?'✓':'')+'</button>'+
          '<span class="fx2-d">'+(d?'<b>'+d+'</b>'+mAb:'—')+'</span><button type="button" class="fxmore fx2-n" data-id="'+esc(f.id)+'"><b>'+esc(f.label)+'</b><small>'+(fpv?'<span class="fxpill">mise de côté</span>':tagOf(f))+esc(sub)+'</small></button><span class="a">'+fmtK(fraisMontant(f, month))+'</span></div>'; }
      var h=header(false, "À venir")+avTabsHTML("frais");
      h+='<section class="paper av2-hero" id="fxHero">'+monthNavHTML(esc(capFirst(monthLabelOf(month))), month, curM)+
        '<div class="av2-big"><b>'+esc(fmtK(tot))+'</b><span>de frais fixes'+(who!=="all"?' · '+esc(who==="Commun"?"commun":(who===me?"toi":who)):'')+'</span></div>'+
        '<div class="av2-bar"><i style="width:'+(tot>0?Math.round(paid/tot*100):0)+'%;background:var(--accent)"></i></div>'+
        '<div class="av2-sub"><span class="ok">'+nPaid+' payé'+(nPaid>1?'s':'')+' · '+esc(fmtK(paid))+'</span><span>reste <b>'+esc(fmtK(Math.max(0, tot-paid)))+'</b> · '+todo.length+' frais</span></div></section>';
      var gN=groups.filter(function(g){ return g.items.length; });
      if(gN.length>1){ var nAll=0; gN.forEach(function(g){ nAll+=g.items.length; });
        h+='<div class="fx2-chips" id="fxWho"><button type="button" data-w="all" class="'+(who==="all"?'on':'')+'">Tout · '+nAll+'</button>'+gN.map(function(g){ return '<button type="button" data-w="'+esc(g.k)+'" class="'+(who===g.k?'on':'')+'">'+esc(g.k==="Commun"?"Commun":(g.k===me?"Toi":g.k))+' · '+g.items.length+'</button>'; }).join("")+'</div>'; }
      // à payer
      var tPv=todo.filter(function(f){ return f.prov!=null; }), tOt=todo.filter(function(f){ return f.prov==null; }).sort(byDay), rest=0; todo.forEach(function(f){ rest+=fraisMontant(f, month)||0; });
      h+='<section class="paper fx2-sec"><div class="fx2-h"><b>À payer · '+todo.length+'</b><b>'+esc(fmtK(rest))+'</b></div>';
      if(!todo.length) h+='<div class="muted" style="font-size:13px;padding:6px 0 12px">'+(all.length?'✓ Tout est payé ce mois-ci.':'Aucun frais fixe ce mois-ci.')+'</div>';
      var pvDay=0, pvSum=0; tPv.forEach(function(f){ var d=dOf(f); if(d && (!pvDay || d<pvDay)) pvDay=d; pvSum+=fraisMontant(f, month)||0; });
      var pvRow=function(){ if(!tPv.length) return ''; var op=!!state.fxPvOpen || tPv.length===1;
        if(tPv.length===1) return row(tPv[0]);
        return '<div class="fxrow fx2-r fx2-pv"><span class="fx2-pvc" aria-hidden="true"></span><span class="fx2-d">'+(pvDay?'<b>'+pvDay+'</b>'+mAb:'—')+'</span><button type="button" class="fx2-n" id="fxPvT" aria-expanded="'+op+'"><b>'+tPv.length+' mises de côté '+(op?'▴':'▾')+'</b><small>'+esc(tPv.map(function(f){ var pv=provById(f.prov); return pv?pv.nom:f.label; }).join(", "))+'</small></button><span class="a" style="color:#c78bd6">'+fmtK(pvSum)+'</span></div>'+(op?'<div class="fx2-sub">'+tPv.sort(byDay).map(row).join("")+'</div>':''); };
      var placed=false; tOt.forEach(function(f){ if(!placed && tPv.length && (dOf(f)||99)>(pvDay||99)){ h+=pvRow(); placed=true; } h+=row(f); });
      if(!placed) h+=pvRow();
      h+='</section>';
      // payés (repliés)
      if(done.length){ var dOp=state.fxPaidOpen!=null ? state.fxPaidOpen : affDet();
        h+='<section class="paper fx2-sec"><button type="button" class="fx2-h fx2-t" id="fxPaidT" aria-expanded="'+dOp+'"><b>Payés · '+done.length+'</b><span><b>'+esc(fmtK(paid))+'</b> '+(dOp?'▴':'▾')+'</span></button>'+(dOp?done.sort(byDay).map(row).join(""):'')+'</section>'; }
      // retirés de ce mois
      var skL=fraisCommuns.filter(function(f){ return f.skipMonths && f.skipMonths[month]; });
      if(skL.length) h+='<section class="paper cacc" style="padding:6px 14px 8px"><div class="muted" style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;margin:6px 2px 2px">Retirés de '+esc(monthLabelOf(month))+'</div>'+
        skL.map(function(f){ return '<div style="display:flex;align-items:center;gap:8px;padding:8px 2px;border-top:1px solid var(--line)"><span style="flex:1;min-width:0;color:var(--ink-soft);text-decoration:line-through;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(f.label)+'</span><button class="btn ghost fxunskip" type="button" data-id="'+esc(f.id)+'" style="padding:6px 10px;font-size:12px;flex:0 0 auto">↺ Rétablir</button></div>'; }).join("")+'</section>';
      // commun · ta part, perso
      var pW=ppl.filter(function(w){ return D.byP[w] && D.byP[w].items.length; }), pTot=0; pW.forEach(function(w){ pTot+=persoOf(w); });
      var myC=0; (D.byP.Commun?D.byP.Commun.items:[]).forEach(function(f){ if(f.pp==null) myC+=(fraisMontant(f, month)||0)*fPct(f, me)/100; });
      h+='<div class="av-side fx2-side"><div><span>Commun · ta part</span><b>'+esc(fmtK(myC))+'</b><small>sur '+esc(fmtK(D.commun))+'</small></div><div><span>Perso</span><b>'+esc(fmtK(pTot))+'</b><small>'+esc(pW.slice(0,3).map(function(w){ return (w===me?"toi":w)+" "+fmtK(persoOf(w)); }).join(" · ")+(pW.length>3?" · …":""))+'</small></div></div>';
      if(!ro) h+='<button type="button" class="btn primary" id="addfrais" style="width:100%;margin-top:10px">＋ Frais fixe</button>';
      app.innerHTML=h; setNav("factures", true); wireAvTabs();
      wireMonthNav(month, curM, "communes");
      [].forEach.call(document.querySelectorAll("#fxWho button"), function(b){ b.onclick=function(){ state.fxWho=b.getAttribute("data-w"); render(); }; });
      var pt=document.getElementById("fxPvT"); if(pt) pt.onclick=function(){ state.fxPvOpen=!state.fxPvOpen; render(); };
      var pd=document.getElementById("fxPaidT"); if(pd) pd.onclick=function(){ state.fxPaidOpen=!(state.fxPaidOpen!=null ? state.fxPaidOpen : affDet()); render(); };
      var af=document.getElementById("addfrais"); if(af) af.onclick=addFraisCommun;
      [].forEach.call(document.querySelectorAll(".fxdone"), function(b){ b.onclick=function(){ toggleFraisDone(b.getAttribute("data-id"), month); }; });
      [].forEach.call(document.querySelectorAll(".fxmore"), function(b){ b.onclick=function(){ var id=b.getAttribute("data-id"), f=fraisCommuns.filter(function(x){ return String(x.id)===String(id); })[0]; if(!f) return;
        uiChoice(f.label, esc(fmtK(fraisMontant(f, month))+" · "+monthLabelOf(month)), [ { l:"Modifier", fn:function(){ editFraisCommun(id); } }, { l:"Supprimer", danger:true, fn:function(){ delFraisCommun(id); } } ]); }; });
      [].forEach.call(document.querySelectorAll(".fxunskip"), function(b){ b.onclick=function(){ var f=fraisCommuns.filter(function(x){ return String(x.id)===b.getAttribute("data-id"); })[0]; if(!f || !f.skipMonths) return;
        if(!fyFraisCanEdit(f)){ uiToast("Frais d'un autre compte : en consultation seulement"); return; } delete f.skipMonths[month]; if(!Object.keys(f.skipMonths).length) delete f.skipMonths;
        var fpv=f.prov!=null && provById(f.prov); if(fpv && fpv.skips){ fpv.skips=fpv.skips.filter(function(x){ return x!==month; }); persistProvisions(); }
        persistFrais(); render(); }; });
    }

    // Montant arrondi à l'euro, séparateur de milliers fin (pour les graphiques)
    function cptK(n){ n=Math.round(Number(n)||0); return (n<0?"−":"")+String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g," "); }
    // Cascade : d'où vient l'argent du mois et où il part
    // Compte : glisser à gauche / à droite dans la carte du haut pour changer de graphique (sauf sur la rangée des onglets, qui défile)
    function wireCptSwipe(cmode, keys){
      var hero=document.querySelector(".thero"), ch=hero && hero.querySelector(".cch"); if(!hero || !ch) return;
      var i=keys.indexOf(cmode), x0=null, y0=0, dx=0, lock=null, moved=false;
      hero.style.touchAction="pan-y";
      hero.addEventListener("click", function(ev){ if(moved){ moved=false; ev.stopPropagation(); ev.preventDefault(); } }, true);
      hero.addEventListener("pointerdown", function(ev){ moved=false; if(swipeSkip(ev.target, hero)) return; x0=ev.clientX; y0=ev.clientY; dx=0; lock=null; });
      hero.addEventListener("pointermove", function(ev){
        if(x0===null) return; dx=ev.clientX-x0; var dy=ev.clientY-y0;
        if(lock===null && (Math.abs(dx)>8 || Math.abs(dy)>8)) lock=(Math.abs(dx)>Math.abs(dy))?"x":"y";
        if(lock!=="x") return;
        var edge=(dx>0 && i===0) || (dx<0 && i===keys.length-1);
        ch.style.transition="none"; ch.style.transform="translateX("+(edge?dx/4:dx)+"px)"; ch.style.opacity=String(1-Math.min(.5, Math.abs(dx)/500));
      });
      function up(){
        if(x0===null) return; x0=null;
        if(lock==="x" && Math.abs(dx)>10) moved=true;
        var ni=i; if(lock==="x" && dx<-50 && i<keys.length-1) ni=i+1; else if(lock==="x" && dx>50 && i>0) ni=i-1;
        if(ni!==i){ state.cptChart=keys[ni]; store.write("cptChart", keys[ni]); state.cptSwipeDir=(ni>i?1:-1); render(); return; }
        ch.style.transition="transform .2s ease, opacity .2s ease"; ch.style.transform=""; ch.style.opacity="";
      }
      hero.addEventListener("pointerup", up); hero.addEventListener("pointercancel", up);
      if(state.cptSwipeDir){   // le nouveau graphique arrive du côté du glissé
        var d=state.cptSwipeDir; state.cptSwipeDir=0;
        ch.style.transition="none"; ch.style.transform="translateX("+(d*60)+"px)"; ch.style.opacity=".2"; ch.getBoundingClientRect();
        ch.style.transition="transform .25s ease, opacity .25s ease"; ch.style.transform=""; ch.style.opacity="";
      }
    }
    function wireComSwipe(cm, keys){
      // même glissé que l'onglet Compte, sur le graphique de l'onglet Commun
      var hero=document.querySelector(".thero"), ch=hero && hero.querySelector(".cch"); if(!hero || !ch) return;
      var i=keys.indexOf(cm), x0=null, y0=0, dx=0, lock=null, moved=false;
      hero.style.touchAction="pan-y";
      hero.addEventListener("click", function(ev){ if(moved){ moved=false; ev.stopPropagation(); ev.preventDefault(); } }, true);
      hero.addEventListener("pointerdown", function(ev){ moved=false; if(swipeSkip(ev.target, hero)) return; x0=ev.clientX; y0=ev.clientY; dx=0; lock=null; });
      hero.addEventListener("pointermove", function(ev){ if(x0===null) return; dx=ev.clientX-x0; var dy=ev.clientY-y0;
        if(lock===null && (Math.abs(dx)>8 || Math.abs(dy)>8)) lock=(Math.abs(dx)>Math.abs(dy))?"x":"y"; if(lock!=="x") return;
        var edge=(dx>0 && i===0) || (dx<0 && i===keys.length-1); ch.style.transition="none"; ch.style.transform="translateX("+(edge?dx/4:dx)+"px)"; ch.style.opacity=String(1-Math.min(.5, Math.abs(dx)/500)); });
      function up(){ if(x0===null) return; x0=null; if(lock==="x" && Math.abs(dx)>10) moved=true;
        var ni=i; if(lock==="x" && dx<-50 && i<keys.length-1) ni=i+1; else if(lock==="x" && dx>50 && i>0) ni=i-1;
        if(ni!==i){ state.comChart=keys[ni]; store.write("comChart", keys[ni]); state.comSwipeDir=(ni>i?1:-1); render(); return; }
        ch.style.transition="transform .2s ease, opacity .2s ease"; ch.style.transform=""; ch.style.opacity=""; }
      hero.addEventListener("pointerup", up); hero.addEventListener("pointercancel", up);
      if(state.comSwipeDir){ var d=state.comSwipeDir; state.comSwipeDir=0; ch.style.transition="none"; ch.style.transform="translateX("+(d*60)+"px)"; ch.style.opacity=".2"; ch.getBoundingClientRect(); ch.style.transition="transform .25s ease, opacity .25s ease"; ch.style.transform=""; ch.style.opacity=""; }
    }
    // Pastilles de graphiques : ★ = graphique affiché à l'ouverture de l'appli ; ☆ sur la pastille active pour le choisir
    function chartTabsHTML(list, cur, defKey, defFallback){
      var def=store.read(defKey, defFallback);
      return '<div class="cch-tabs">'+list.map(function(x){ var on=(x[0]===cur), isDef=(x[0]===def);
        return '<button type="button" data-m="'+x[0]+'"'+(on?' class="on"':'')+'>'+x[1]+
          (isDef?'<span class="cst" aria-label="Par défaut">★</span>':(on?'<span class="cst setdef" role="button" data-def="'+defKey+'" data-v="'+x[0]+'" data-l="'+esc(x[1])+'" aria-label="Afficher par défaut">☆</span>':''))+'</button>'; }).join("")+'</div>';
    }
    function wireChartDefaults(){
      [].forEach.call(document.querySelectorAll(".cch-tabs .setdef"), function(sp){ sp.onclick=function(ev){ ev.stopPropagation(); ev.preventDefault();
        store.write(sp.getAttribute("data-def"), sp.getAttribute("data-v")); uiToast("« "+sp.getAttribute("data-l")+" » s'affichera à l'ouverture"); render(); }; });
    }
    function compteWaterfallSVG(steps){
      var W=340, H=178+CHB, top=20, bot=24, ph=H-top-bot, run=0, pts=[0];
      steps.forEach(function(st){ if(st.t==="base"||st.t==="end"){ st.a=0; st.b=st.v; run=st.v; } else { st.a=run; st.b=run+st.v; run=st.b; } pts.push(st.a, st.b); });
      var lo=Math.min.apply(null,pts), hi=Math.max.apply(null,pts); if(hi-lo<1){ hi=lo+1; }
      function y(v){ return top+(hi-v)/(hi-lo)*ph; }
      var n=steps.length, slot=W/n, bw=Math.min(34, slot*0.62), g='';
      if(lo<0) g+='<line x1="0" x2="'+W+'" y1="'+y(0).toFixed(1)+'" y2="'+y(0).toFixed(1)+'" style="stroke:var(--line2);stroke-width:1"/>';
      var slotW=W/Math.max(1,steps.length);
      steps.forEach(function(st,i){
        var cx=slot*i+slot/2, y1=y(Math.max(st.a,st.b)), y2=y(Math.min(st.a,st.b)), hgt=Math.max(2,y2-y1);
        var col = st.t==="base" ? "#8a92a6" : (st.t==="end" ? (st.v<0?"var(--coral)":"var(--accent)") : (st.v<0?"var(--coral)":"var(--accent)"));
        g+='<rect x="'+(cx-bw/2).toFixed(1)+'" y="'+y1.toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+hgt.toFixed(1)+'" rx="4" style="fill:'+col+';opacity:'+(st.t==="end"?1:0.88)+'"/>';
        if(st.k) g+='<rect class="wfhit" data-k="'+esc(st.k)+'" x="'+(cx-slotW/2).toFixed(1)+'" y="0" width="'+slotW.toFixed(1)+'" height="'+H+'" style="fill:transparent;cursor:pointer"/>';
        if(i<n-1){ var nx=slot*(i+1)+slot/2-bw/2, yy=y(st.b).toFixed(1); g+='<line x1="'+(cx+bw/2).toFixed(1)+'" x2="'+nx.toFixed(1)+'" y1="'+yy+'" y2="'+yy+'" style="stroke:var(--muted);stroke-width:1;stroke-dasharray:2 3"/>'; }
        var lbl=(st.t||st.v<0?"":"+")+cptK(st.v), ly=y1-5;
        g+='<text x="'+cx.toFixed(1)+'" y="'+ly.toFixed(1)+'" text-anchor="middle" style="fill:'+(st.t==="end"?"var(--ink)":"var(--ink-soft)")+';font-size:10.5px;font-weight:'+(st.t==="end"?700:600)+';font-family:var(--sans)">'+lbl+'</text>';
        g+='<text x="'+cx.toFixed(1)+'" y="'+(H-6)+'" text-anchor="middle" style="fill:var(--muted);font-size:10px;font-family:var(--sans)">'+esc(st.l)+'</text>';
      });
      return '<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Cascade du mois">'+g+'</svg>';
    }
    // 6 mois : entrées et sorties de chaque mois, avec le solde de fin de mois
    function compteSixMonthsSVG(rows, sel){
      var W=340, H=178+CHB, top=32, bot=24, ph=H-top-bot, vals=[0];   // place pour deux montants empilés
      rows.forEach(function(r){ vals.push(r.inn, r.out); });
      var lo=Math.min.apply(null,vals), hi=Math.max.apply(null,vals); if(hi-lo<1) hi=lo+1;
      function y(v){ return top+(hi-v)/(hi-lo)*ph; }
      var n=rows.length, slot=W/n, bw=Math.min(14, slot*0.26), g='', line=[];
      if(lo<0) g+='<line x1="0" x2="'+W+'" y1="'+y(0).toFixed(1)+'" y2="'+y(0).toFixed(1)+'" style="stroke:var(--line2);stroke-width:1"/>';
      rows.forEach(function(r,i){
        var cx=slot*i+slot/2, z=y(0);
        g+='<rect x="'+(cx-bw-1.5).toFixed(1)+'" y="'+y(r.inn).toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+Math.max(1,z-y(r.inn)).toFixed(1)+'" rx="3" style="fill:var(--accent);opacity:.85"/>';
        g+='<rect x="'+(cx+1.5).toFixed(1)+'" y="'+y(r.out).toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+Math.max(1,z-y(r.out)).toFixed(1)+'" rx="3" style="fill:var(--coral);opacity:.85"/>';
        // montants empilés au-dessus de la paire de barres (entrée en vert, sortie en rouge dessous) : jamais côte à côte
        var fw=(r.m===sel?700:600), tp=Math.min(y(r.inn), y(r.out));
        function kv(v){ v=Math.round(v); return v>=10000 ? String(Math.round(v/100)/10).replace(".",",")+"k" : String(v); }
        if(r.out>0.5) g+='<text class="vlab" x="'+cx.toFixed(1)+'" y="'+(tp-4).toFixed(1)+'" text-anchor="middle" style="fill:var(--coral);font-size:9px;font-weight:'+fw+';letter-spacing:-.02em;font-family:var(--sans)">'+kv(r.out)+'</text>';
        if(r.inn>0.5) g+='<text class="vlab" x="'+cx.toFixed(1)+'" y="'+(tp-(r.out>0.5?15:4)).toFixed(1)+'" text-anchor="middle" style="fill:var(--accent);font-size:9px;font-weight:'+fw+';letter-spacing:-.02em;font-family:var(--sans)">'+kv(r.inn)+'</text>';
        if(r.m) g+='<rect class="barhit" data-m="'+esc(r.m)+'" x="'+(cx-slot/2).toFixed(1)+'" y="0" width="'+slot.toFixed(1)+'" height="'+H+'" style="fill:transparent"/>';
        line.push(cx.toFixed(1)+','+y(r.sol).toFixed(1));
        g+='<text x="'+cx.toFixed(1)+'" y="'+(H-6)+'" text-anchor="middle" style="fill:'+(r.m===sel?"var(--ink)":"var(--muted)")+';font-size:10px;font-weight:'+(r.m===sel?700:400)+';font-family:var(--sans)">'+esc(r.lbl)+'</text>';
      });

      return '<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="6 derniers mois">'+g+'</svg>';
    }
    function compteDonutSVG(parts, total){
      var R=46, C=2*Math.PI*R, off=0, g='', gap=parts.length>1?1.5:0;
      g+='<circle cx="60" cy="60" r="'+R+'" style="fill:none;stroke:var(--card2);stroke-width:18"/>';
      parts.forEach(function(p){ var L=total>0?p.v/total*C:0, seg=Math.max(0,L-gap);
        g+='<circle cx="60" cy="60" r="'+R+'" transform="rotate(-90 60 60)" style="fill:none;stroke:'+p.col+';stroke-width:18;stroke-dasharray:'+seg.toFixed(2)+' '+(C-seg).toFixed(2)+';stroke-dashoffset:'+(-off).toFixed(2)+(p.k!=null?';cursor:pointer':'')+'"'+(p.k!=null?' class="dseg" data-k="'+esc(p.k)+'"':'')+'/>';
        off+=L; });
      g+='<text x="60" y="58" text-anchor="middle" style="fill:var(--ink);font-size:16px;font-weight:700;font-family:var(--sans)">'+cptK(total)+'</text>';
      g+='<text x="60" y="74" text-anchor="middle" style="fill:var(--muted);font-size:10px;font-family:var(--sans)">'+esc(curSym())+' dépensés</text>';
      return '<svg viewBox="0 0 120 120" role="img" aria-label="Répartition des dépenses">'+g+'</svg>';
    }
    function chartThin(rows, sel){
      var n=rows.length, many=n>8, k=Math.ceil(n/7), imax=0, imin=0;
      rows.forEach(function(r,i){ if(r.v>rows[imax].v) imax=i; if(r.v<rows[imin].v) imin=i; });
      return {
        val:function(i){ return !many || rows[i].m===sel || i===imax || i===imin; },
        lbl:function(i){ if(!many) return rows[i].lbl; if(rows[i].m!==sel && (n-1-i)%k!==0) return ""; var m=rows[i].m||""; return rows[i].lbl+(m.slice(5)==="01"?" "+m.slice(2,4):""); }
      };
    }
    function compteBarsSVG(rows, sel, color){
      var W=340, H=178+CHB, top=22, bot=24, ph=H-top-bot, vals=[0];
      rows.forEach(function(r){ vals.push(r.v); });
      var lo=Math.min.apply(null,vals), hi=Math.max.apply(null,vals); if(hi-lo<1) hi=lo+1;
      function y(v){ return top+(hi-v)/(hi-lo)*ph; }
      var n=rows.length, slot=W/n, bw=Math.min(30, slot*0.55), g='', z=y(0), th=chartThin(rows, sel);
      if(lo<0) g+='<line x1="0" x2="'+W+'" y1="'+z.toFixed(1)+'" y2="'+z.toFixed(1)+'" style="stroke:var(--line2);stroke-width:1"/>';
      rows.forEach(function(r,i){
        var cx=slot*i+slot/2, y1=Math.min(y(r.v),z), hgt=Math.max(2,Math.abs(z-y(r.v))), on=(r.m===sel);
        var col=(typeof color==="function") ? color(r) : (color || (r.v<0?"var(--coral)":"var(--accent)"));
        g+='<rect x="'+(cx-bw/2).toFixed(1)+'" y="'+y1.toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+hgt.toFixed(1)+'" rx="4" style="fill:'+col+';opacity:'+(on?1:0.55)+'"/>';
        if(r.fx>0 && r.v>0){ var fy=y(Math.min(r.fx, r.v)); g+='<rect x="'+(cx-bw/2).toFixed(1)+'" y="'+fy.toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+Math.max(1,z-fy).toFixed(1)+'" rx="4" style="fill:#c78bd6;opacity:'+(on?1:0.6)+'"/>'; }   // frais fixes
        var ly=y1-5;   // toujours au-dessus du rectangle (pour un négatif : juste au-dessus de la ligne zéro)
        if(th.val(i)) g+='<text x="'+cx.toFixed(1)+'" y="'+ly.toFixed(1)+'" text-anchor="middle" style="fill:'+(on?"var(--ink)":"var(--ink-soft)")+';font-size:10px;font-weight:'+(on?700:500)+';font-family:var(--sans)">'+cptK(r.v)+'</text>';
        g+='<text x="'+cx.toFixed(1)+'" y="'+(H-6)+'" text-anchor="middle" style="fill:'+(on?"var(--ink)":"var(--muted)")+';font-size:10px;font-weight:'+(on?700:400)+';font-family:var(--sans)">'+esc(th.lbl(i))+'</text>';
        if(r.m) g+='<rect class="barhit" data-m="'+esc(r.m)+'" x="'+(slot*i).toFixed(1)+'" y="0" width="'+slot.toFixed(1)+'" height="'+H+'" style="fill:transparent"/>';   // zone touchable de la colonne
      });
      return '<svg viewBox="0 0 '+W+' '+H+'" role="img">'+g+'</svg>';
    }
    function compteLineSVG(rows, sel, color){
      var W=340, H=178+CHB, top=24, bot=24, ph=H-top-bot, padX=20, vals=[], has2=rows.some(function(r){ return r.v2!=null; });
      rows.forEach(function(r){ vals.push(r.v); if(has2 && r.v2!=null) vals.push(r.v2); });
      var lo=Math.min.apply(null,vals), hi=Math.max.apply(null,vals);
      var pad=(hi-lo)*0.15 || Math.max(1,Math.abs(hi)*0.1); lo-=pad; hi+=pad; if(lo>0 && Math.min.apply(null,vals)>=0) lo=Math.max(0,lo);
      function y(v){ return top+(hi-v)/(hi-lo)*ph; }
      var n=rows.length, step=(W-2*padX)/Math.max(1,n-1), pts=[], g='', th=chartThin(rows, sel);
      rows.forEach(function(r,i){ pts.push([padX+i*step, y(r.v)]); });
      var line=pts.map(function(p){ return p[0].toFixed(1)+','+p[1].toFixed(1); }).join(" ");
      g+='<polygon points="'+pts[0][0].toFixed(1)+','+(top+ph)+' '+line+' '+pts[n-1][0].toFixed(1)+','+(top+ph)+'" style="fill:'+color+';opacity:.14"/>';
      g+='<polyline points="'+line+'" style="fill:none;stroke:'+color+';stroke-width:2.2;stroke-linejoin:round"/>';
      if(has2){   // deuxième courbe en pointillés (ex. la part de la Bourse dans l'épargne), sa valeur au dernier point
        var p2=rows.map(function(r,i){ return [padX+i*step, y(r.v2||0)]; });
        g+='<polyline points="'+p2.map(function(p){ return p[0].toFixed(1)+','+p[1].toFixed(1); }).join(" ")+'" style="fill:none;stroke:var(--accent);stroke-width:2;stroke-dasharray:5 4;stroke-linejoin:round"/>';
        var lp=p2[n-1]; g+='<circle cx="'+lp[0].toFixed(1)+'" cy="'+lp[1].toFixed(1)+'" r="3.5" style="fill:var(--accent)"/><text x="'+(lp[0]-4).toFixed(1)+'" y="'+(lp[1]-8).toFixed(1)+'" text-anchor="middle" style="fill:var(--accent);font-size:10px;font-weight:700;font-family:var(--sans)">'+cptK(rows[n-1].v2||0)+'</text>';
      }
      rows.forEach(function(r,i){ var on=(r.m===sel), cx=pts[i][0], cy=pts[i][1];
        g+='<circle cx="'+cx.toFixed(1)+'" cy="'+cy.toFixed(1)+'" r="'+(on?4.5:(n>8?2:3))+'" style="fill:'+(on?color:"var(--card)")+';stroke:'+color+';stroke-width:2"/>';
        if(r.m) g+='<rect class="barhit" data-m="'+esc(r.m)+'" x="'+(cx-step/2).toFixed(1)+'" y="0" width="'+step.toFixed(1)+'" height="'+H+'" style="fill:transparent"/>';
        if(th.val(i)) g+='<text x="'+cx.toFixed(1)+'" y="'+(cy-9).toFixed(1)+'" text-anchor="middle" style="fill:'+(on?"var(--ink)":"var(--ink-soft)")+';font-size:10px;font-weight:'+(on?700:500)+';font-family:var(--sans)">'+cptK(r.v)+'</text>';
        g+='<text x="'+cx.toFixed(1)+'" y="'+(H-6)+'" text-anchor="middle" style="fill:'+(on?"var(--ink)":"var(--muted)")+';font-size:10px;font-weight:'+(on?700:400)+';font-family:var(--sans)">'+esc(th.lbl(i))+'</text>';
      });
      return '<svg viewBox="0 0 '+W+' '+H+'" role="img">'+g+'</svg>';
    }
    function acctFigures(key, month){
      var st0=acctStart(key); if(st0 && month<st0) return { banque:0, fin:0, liq:0 };   // compte pas encore suivi ce mois-là (comme son écran)
      var fl=soldeFlow(key, month), lq=liquideAt(key, month), lqV=(lq && liqCounted())?lq.val:0;
      var banque=soldeFlowDone(key, month).opening + virementsSumDone(key, month) - computeDepensesMonthDone(key, month);
      if(month>monthKey(todayISO())) banque=fl.closing;   // mois à venir : ce qui restera en banque à la fin du mois (tout ce qui est prévu)
      return { banque:banque, fin:fl.closing+lqV, liq:lqV };
    }
    function epTotalAtM(m){ var t=0; epargne.forEach(function(c){ var ms=Object.keys(c.vals||{}).filter(function(mm){ return mm<=m; }).sort(); if(ms.length) t+=Number(c.vals[ms[ms.length-1]])||0; }); return t; }
    // Vue « Tous » : total de tous les comptes bancaires, puis avec l'épargne
    function accScrollFix(){
      var sc=document.querySelector(".acc-scroll"); if(!sc) return;
      var on=sc.querySelector("button.on");
      if(on){ var l=on.offsetLeft-sc.offsetLeft, r=l+on.offsetWidth; if(r>sc.scrollLeft+sc.clientWidth-24) sc.scrollLeft=r-sc.clientWidth+24; else if(l<sc.scrollLeft) sc.scrollLeft=l; }
      function upd(){ sc.classList.toggle("ov", sc.scrollWidth>sc.clientWidth+1 && sc.scrollLeft+sc.clientWidth<sc.scrollWidth-2); }
      upd(); sc.onscroll=upd;
    }
    // Couleur propre à chaque compte (13 couleurs distinctes avant de se répéter)
    var ACOLS=["#4fd6a0","#7c9cf4","#e0a458","#c78bd6","#5bc0d4","#e88fb0","#9bd35e","#f4796b","#d6c35c","#9b8cf4","#d68f5c","#6fb3f0","#b8c0cc"];
    function acctCol(a){ var i=comptes.indexOf(a); return ACOLS[(i<0?0:i)%ACOLS.length]; }
    // Titulaire d'un compte : la personne « payé par » ; le compte principal sans titulaire est le tien
    function acctOwner(a){ var p=(a.payer||"").trim(); if(p && p!=="Commun") return p; return a.main ? mePerson() : ""; }
    // Comptes : une page par personne (toi d'abord), « Comptes partagés » si besoin, puis « Foyer » (tous les comptes)
    // Opérations (refonte) : une ligne « ● Compte courant ▾ » + le mois ; toucher le compte ouvre la liste des comptes (par personne, avec le solde)
    function acctRowHTML(sel, month, curM){
      var a=sel==="__all" ? null : acctByKey(sel), nm=sel==="__all" ? "Tous les comptes" : (a ? a.nom : "Mes tickets"), col=a ? acctCol(a) : "var(--ink-soft)";
      var p=month.split("-"), lb=new Date(+p[0], +p[1]-1, 1).toLocaleDateString("fr-FR",{month:"short", year:"numeric"});
      return '<div class="acrow"><button type="button" class="acsel" id="acctSel"><i style="background:'+col+'"></i><span>'+esc(nm)+'</span><em>▾</em></button>'+
        homeMonthNav(month, curM, lb).replace(/id="mn-/g,'id="cm-')+'</div>';
    }
    function acctSheet(sel, month){
      var me=mePerson(), groups={}, order=[];
      comptes.forEach(function(a){ var o=acctOwner(a)||"__shared"; if(!groups[o]){ groups[o]=[]; order.push(o); } groups[o].push(a); });
      order.sort(function(x,y){ if(x===me) return -1; if(y===me) return 1; if(x==="__shared") return 1; if(y==="__shared") return -1; return (groups[y].length-groups[x].length) || x.localeCompare(y,"fr"); });
      function row(key, nom, amt, col, main){ return '<button type="button" class="dr-row acrw'+(key===sel?' on':'')+'" data-acct="'+esc(key)+'"><span class="ic"><i class="hdot" style="background:'+col+';width:10px;height:10px"></i></span><span class="t">'+esc(nom)+(main?' <em style="color:var(--accent);font-style:normal">★</em>':'')+'</span><b'+(amt<0?' style="color:var(--coral)"':'')+'>'+fmtS(amt)+'</b></button>'; }
      var h='<div class="sheet-title">Comptes</div>', grand=0;
      order.forEach(function(o){ if(order.length>1) h+='<div class="acgh">'+(o==="__shared"?"Comptes partagés":esc(o)+(o===me?" · toi":""))+'</div>';
        h+='<div class="dr-grp">'+groups[o].map(function(a){ var v=0; try{ v=acctFigures(a.key, month).banque; }catch(e){} grand+=v; return row(a.key, a.nom, v, acctCol(a), a.main); }).join("")+'</div>'; });
      if(comptes.length>1) h+='<div class="dr-grp" style="margin-top:10px">'+row("__all", "Tous les comptes", grand, "var(--ink-soft)", false)+'</div>';
      if(!fyRO()) h+='<div class="dr-grp" style="margin-top:10px"><button type="button" class="dr-row" data-acct="__add"><span class="ic">＋</span><span class="t">Ajouter un compte</span></button>'+(comptes.length>1?'<button type="button" class="dr-row" data-acct="__manage"><span class="ic">⚙︎</span><span class="t">Gérer les comptes</span></button>':'')+'</div>';
      h+='<div class="ui-stack" style="margin-top:12px"><button type="button" class="btn ghost ui-no">Fermer</button></div>';
      var sh=uiSheet(h); sh.q(".ui-no").onclick=sh.close;
      [].forEach.call(sh.qa("[data-acct]"), function(b){ b.onclick=function(){ var k=b.getAttribute("data-acct"); sh.close();
        if(k==="__add") return acctForm(null);
        if(k==="__manage") return manageAccts();
        state.compteSel=k; store.write("compteSel", k); render(); }; });
    }
    function wireAcctPick(){
      var as=document.getElementById("acctSel"); if(as) as.onclick=function(){ var m=(state.months&&state.months.compte)||monthKey(todayISO()); acctSheet((state.compteSel||store.read("compteSel", null))==="__all" && comptes.length>1 ? "__all" : curAcctKey(), m); };
      // rangée des comptes : le compte choisi bien visible, fondu sur le bord quand la rangée continue
      [].forEach.call(document.querySelectorAll(".ap-strip"), function(sc){
        var on=sc.querySelector(".ap-row.on");
        if(on){ var l=on.offsetLeft-sc.offsetLeft; if(l+on.offsetWidth>sc.scrollLeft+sc.clientWidth-8 || l<sc.scrollLeft) sc.scrollLeft=Math.max(0, l-(sc.clientWidth-on.offsetWidth)/2); }
        function upd(){ sc.classList.toggle("ov", sc.scrollWidth>sc.clientWidth+1 && sc.scrollLeft+sc.clientWidth<sc.scrollWidth-2); sc.classList.toggle("ovl", sc.scrollLeft>2); }
        upd(); sc.addEventListener("scroll", upd, { passive:true });
      });
      [].forEach.call(document.querySelectorAll(".acc-chips button, .ap-row, .ap-tool"), function(bt){ bt.onclick=function(){ var k=bt.getAttribute("data-acct");
        if(k==="__add") return acctForm(null);
        if(k==="__manage") return manageAccts();
        state.compteSel=k; store.write("compteSel", k); render(); }; });
    }
    function renderComptesAll(month, curM, monthLabel){
      var rows=comptes.map(function(a){ return { a:a, f:acctFigures(a.key, month) }; });
      var totB=0, totF=0; rows.forEach(function(r){ totB+=r.f.banque; totF+=r.f.fin; });
      var ep=epTotalAtM(month), prov=0; try{ prov=provTotalAt(month); }catch(e){}
      var h=header(false, "Opérations")+cptSubsHTML(null)+acctRowHTML("__all", month, curM);
      var pos=rows.filter(function(r){ return r.f.banque>0; }), posT=pos.reduce(function(t,r){ return t+r.f.banque; },0);
      var extra=posT>0 ? '<div class="cstack" style="height:10px;margin:16px 0 4px">'+rows.map(function(r,i){ return r.f.banque>0?'<i style="width:'+(r.f.banque/posT*100).toFixed(2)+'%;background:'+acctCol(r.a)+'"></i>':''; }).join("")+'</div>' : '';
      h+=tabHero({ label:"Total des comptes (banque estimée)", big:totB, color:(totB<0?"var(--coral)":"var(--ink)"), sub:"Estimé, sans le liquide", extra:extra,
        stats:[ { l:"Fin de mois", v:fmtS(totF), d:"prévu" }, { l:"Épargne", v:fmtS(ep), d:"totale" }, { l:"Avec épargne", v:fmtS(totB+ep), c:"var(--accent)", d:"au total" } ] });
      var acc='<section class="paper cacc">';
      rows.forEach(function(r,i){
        acc+='<div class="cacc-sec"><div class="cacc-h allGo" data-acct="'+esc(r.a.key)+'"><i class="cdot" style="background:'+acctCol(r.a)+';margin:0"></i><span class="t">'+esc(r.a.nom)+(r.a.main?' <span class="muted" style="font-size:11px;font-weight:500">principal</span>':'')+'</span><span class="v" style="color:'+(r.f.banque<0?"var(--coral)":"var(--ink)")+'">'+fmtS(r.f.banque)+'</span><span class="ch">›</span></div></div>';
      });
      acc+='<div class="cacc-sec"><div class="cacc-h" style="cursor:default"><span class="t">Total des comptes</span><span class="v" style="color:'+(totB<0?"var(--coral)":"var(--accent)")+'">'+fmtS(totB)+'</span><span class="ch"></span></div></div></section>';
      acc+='<section class="paper cacc">';
      acc+='<div class="cacc-sec"><div class="cacc-h allGo" data-acct="'+esc(myAcct().key)+'" data-page="ep"><span class="t"><span class="tic">🐷</span> Épargne<small>'+epargne.length+' compte'+(epargne.length>1?'s':'')+' épargne</small></span><span class="v">'+fmtS(ep)+'</span><span class="ch">›</span></div></div>';
      acc+='<div class="cacc-sec"><div class="cacc-h" id="goprov"><span class="t"><span class="tic">📦</span> Provisions<small>'+provisions.length+' enveloppe'+(provisions.length>1?'s':'')+'</small></span><span class="v">'+fmtS(prov)+'</span><span class="ch">›</span></div></div>';
      acc+='<div class="cacc-sec"><div class="cacc-h" style="cursor:default"><span class="t">Comptes + épargne</span><span class="v" style="color:var(--accent)">'+fmtS(totB+ep)+'</span><span class="ch"></span></div></div></section>';
      h+=acc;
      app.innerHTML=h;
      wireAcctPick(); wireCptSubs();
      [].forEach.call(document.querySelectorAll(".allGo"), function(r){ r.onclick=function(){ var k=r.getAttribute("data-acct"), pg=r.getAttribute("data-page");
        state.compteSel=k; store.write("compteSel", k);
        if(pg){ state.cptPage=pg; state.view="comptedet"; state.cptFromAll=true; } render(); window.scrollTo(0,0); }; });
      var gp=document.getElementById("goprov"); if(gp) gp.onclick=function(){ if(!state.months) state.months={}; state.months.provisions=(month===curM?null:month); state.provFrom=null; state.view="provisions"; render(); window.scrollTo(0,0); };
      if(!state.months) state.months={};
      var cmp=document.getElementById("cm-prev"); if(cmp) cmp.onclick=function(){ state.months.compte=prevMonthKey(month); render(); };
      var cmn=document.getElementById("cm-next"); if(cmn) cmn.onclick=function(){ var nx=nextMonthKey(month); state.months.compte=(nx===curM?null:nx); render(); };
      var cmt=document.getElementById("cm-today"); if(cmt) cmt.onclick=function(){ state.months.compte=null; render(); };
      setNav("compte", true);
    }
    function acctPayerOpts(cur){
      var o=[{v:"",l:"Aucun (choix sur chaque ticket)"}], seen={};
      uniquePersons().concat(["Commun"]).concat(cur?[cur]:[]).forEach(function(p){ if(p && !seen[p]){ seen[p]=1; o.push({v:p, l:p}); } });
      return o;
    }
    function acctForm(a){
      uiForm({ title:a?"Modifier « "+a.nom+" »":"Nouveau compte bancaire", intro:a?"":"Compte joint, compte pro, autre banque…", fields:[
        { key:"nom", label:"Nom du compte", value:a?a.nom:"", required:true, placeholder:"Compte joint, Compte pro…" },
        { key:"payer", label:"Tickets « payé par »", type:"select", value:a?(a.payer||""):"", options:acctPayerOpts(a&&a.payer), help:"Les tickets payés par cette personne vont automatiquement sur ce compte. Tu peux aussi choisir le compte sur chaque ticket." }
      ].concat(!a ? [{ key:"start", label:"Solde en début de mois (optionnel)", type:"money", value:"", help:"Ce qu'il y avait sur le compte au 1er "+esc(monthLabelOf(monthKey(todayISO())))+". Modifiable ensuite." }]
              : (a.since ? [{ key:"start", label:"Solde au 1er "+esc(monthLabelOf(a.since)), type:"money", value:(getSoldeInit(a.key, a.since)!==null?getSoldeInit(a.key, a.since):""), help:"Ce qu'il y avait sur le compte à son démarrage dans l'appli. Vide = 0." }] : [])),
        ok:a?"Enregistrer":"Créer le compte", focus:!a }, function(r){
        var nm=(r.nom||"").trim(); if(!nm) return "Donne un nom au compte.";
        if(a){ a.nom=nm; a.payer=r.payer||"";
          if(a.since){ if(r.start===null || r.start===undefined || isNaN(r.start)) clearSoldeInit(a.key, a.since); else setSoldeInit(a.key, a.since, r.start); } }
        else {
          var m0=monthKey(todayISO());
          a={ key:"acc"+Date.now(), nom:nm, payer:r.payer||"", since:m0 }; comptes.push(a); state.compteSel=a.key; store.write("compteSel", a.key);
          if(r.start!==null && r.start!==undefined && !isNaN(r.start)) setSoldeInit(a.key, m0, r.start);
          state.months=state.months||{}; state.months.compte=null;
        }
        persistComptes(); render();
      });
    }
    function manageAccts(){
      uiChoice("Mes comptes", "Touche un compte pour le modifier.", comptes.map(function(a){
        return { l:a.nom+(a.main?" · principal":""), fn:function(){ acctMenu(a); } };
      }).concat([{ l:"＋ Ajouter un compte", fn:function(){ acctForm(null); } }]));
    }
    function acctMenu(a){ uiChoice(a.nom, a.main?"Compte principal : il reçoit les frais communs et s'affiche sur l'Accueil.":"", acctMenuItems(a)); }
    function acctMenuItems(a){
      var ch=[{ l:"Modifier le compte", fn:function(){ acctForm(a); } }];
      if(!a.main) ch.push({ l:"Définir comme compte principal", fn:function(){ comptes.forEach(function(c){ c.main=(c===a); }); persistComptes(); uiToast("« "+a.nom+" » est le compte principal"); render(); } });
      if(!a.main) ch.push({ l:"Supprimer", danger:true, fn:function(){
        var nv=virements.filter(function(v){ return v.person===a.key; }).length;
        uiConfirm("Supprimer « "+esc(a.nom)+" »"+(nv===1?" et son virement":(nv?" et ses "+nv+" virements":""))+" ?<br>Les tickets et frais rattachés à ce compte repasseront en automatique.", function(){
          virements=virements.filter(function(v){ return v.person!==a.key; }); persistVirements(); virRec=virRec.filter(function(r){ return r.person!==a.key; }); persistVirRec();
          state.entries.forEach(function(e){ if(e.compte===a.key) delete e.compte; }); persist();
          fraisCommuns.forEach(function(f){ if(f.compte===a.key) delete f.compte; }); persistFrais();
          delete liquideMois[a.key]; persistLiquide(); delete soldeInit[a.key]; persistSoldeInit();
          comptes=comptes.filter(function(c){ return c!==a; }); persistComptes();
          state.compteSel=myAcct().key; store.write("compteSel", state.compteSel); render();
        }, { ok:"Supprimer", danger:true });
      } });
      return ch;
    }
