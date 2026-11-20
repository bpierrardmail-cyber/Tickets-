    // ---------- Corbeille : un ticket supprimé y reste 30 jours (photos gardées), « Remettre » le rend tel quel ----------
    var CORB_J=30;
    function corbList(){ return store.read("corbeille", [])||[]; }
    function corbPurge(all){
      var L=corbList(), lim=Date.now()-CORB_J*86400000, keep=[], out=[];
      L.forEach(function(x){ if(all || !(new Date(x.at).getTime()>lim)) out.push(x); else keep.push(x); });
      if(!out.length) return 0;
      out.forEach(function(x){ var id=x.e && x.e.id; if(id==null) return; idbDel(id); origDel(id);
        groupes.forEach(function(g){ g.dep=(g.dep||[]).filter(function(d){ return String(d.ticketId)!==String(id); }); }); });
      persistGroupes(); store.write("corbeille", keep); return out.length;
    }
    function corbPut(e, ph){ var L=corbList().filter(function(x){ return !(x.e && String(x.e.id)===String(e.id)); }); L.unshift({ e:e, at:new Date().toISOString(), ph:ph||"" }); store.write("corbeille", L.slice(0, 500)); }
    function corbRestore(id){
      var L=corbList(), x=L.filter(function(y){ return y.e && String(y.e.id)===String(id); })[0]; if(!x) return false;
      if(!state.entries.some(function(e){ return String(e.id)===String(id); })){ state.entries.push(x.e); tkLiqDo(x.e); }
      if(phSafe(x.ph)) PHOTOS[String(id)]=x.ph;
      store.write("corbeille", L.filter(function(y){ return y!==x; })); persist(); return true;
    }
    function corbForget(id){ store.write("corbeille", corbList().filter(function(y){ return !(y.e && String(y.e.id)===String(id)); })); }
    function renderCorbeille(){
      var L=corbList(), now=Date.now();
      var h=header(true, "Corbeille").replace('</header>', L.length && !fyRO() ? '<button type="button" class="hgear" id="corbMore" aria-label="Plus">⋯</button></header>' : '</header>')+
        '<section class="paper cacc"><div class="muted" style="font-size:12.5px;margin:4px 2px 8px">Les tickets supprimés restent ici '+CORB_J+' jours, avec leur photo, puis partent tout seuls.</div>';
      if(!L.length) h+='<div class="muted" style="margin:20px 2px">La corbeille est vide.</div>';
      L.forEach(function(x){ var e=x.e||{}, j=Math.max(0, CORB_J-Math.floor((now-new Date(x.at).getTime())/86400000));
        h+='<div class="grp-row corb-r" data-id="'+esc(e.id)+'"><span class="n">'+esc(e.marchand||"Ticket")+'<small>'+esc(csvDate(e.date).slice(0,5)+" · "+fmtS(e.montant)+" · supprimé le "+csvDate(String(x.at).slice(0,10)).slice(0,5)+" · encore "+j+" jour"+(j>1?"s":""))+'</small></span>'+
           (fyRO() ? '' : '<button type="button" class="cbal-ok corb-back" data-id="'+esc(e.id)+'">Remettre</button>')+'</div>'; });
      h+='</section>';
      app.innerHTML=h; setNav("tickets", true);
      bindBack(function(){ state.view="tickets"; render(); window.scrollTo(0,0); });
      [].forEach.call(document.querySelectorAll(".corb-back"), function(b){ b.onclick=function(ev){ ev.stopPropagation(); if(corbRestore(b.getAttribute("data-id"))){ render(); uiToast("Ticket remis"); } }; });
      var cm=document.getElementById("corbMore"); if(cm) cm.onclick=function(){ uiChoice("Corbeille", "", [{ l:"Vider la corbeille", danger:true, fn:function(){
        uiChoice("Vider la corbeille ?", esc(L.length+" ticket"+(L.length>1?"s":"")+" et leurs photos seront supprimés pour de bon."), [{ l:"Vider", danger:true, fn:function(){ corbPurge(true); render(); uiToast("Corbeille vidée"); } }]); } }]); };
    }
    function delEntryUndo(id){
      var i=-1; state.entries.forEach(function(x, k){ if(String(x.id)===String(id)) i=k; }); if(i<0) return;
      var e=state.entries[i], ph=PHOTOS[String(e.id)];
      state.entries.splice(i, 1); delete PHOTOS[String(e.id)]; corbPut(e, ph); tkLiqUndo(e); persist(); render();
      uiUndoToast("Ticket mis à la corbeille", "Annuler", function(){
        corbForget(e.id); state.entries.splice(Math.min(i, state.entries.length), 0, e); tkLiqDo(e); if(ph) PHOTOS[String(e.id)]=ph; persist(); render(); uiToast("Ticket remis");
      });
    }
    // Appui long sur un ticket (listes, Compte, Analyse, Articles) : Ouvrir ou Supprimer
    function wireTicketLongPress(root){
      [].forEach.call((root||app).querySelectorAll('.entry[data-id], .ops-open[data-k="t"]'), function(node){
        if(node.getAttribute("data-lp")) return; node.setAttribute("data-lp", "1");
        var t=null, x0=0, y0=0, fired=false;
        function stop(){ if(t){ clearTimeout(t); t=null; } }
        function fire(){ t=null; fired=true; try{ if(navigator.vibrate) navigator.vibrate(15); }catch(e){} ticketMenu(node.getAttribute("data-id")); }
        node.addEventListener("touchstart", function(ev){ var p=ev.touches[0]; x0=p.clientX; y0=p.clientY; fired=false; stop(); t=setTimeout(fire, 520); }, { passive:true });
        node.addEventListener("touchmove", function(ev){ var p=ev.touches[0]; if(Math.abs(p.clientX-x0)>10 || Math.abs(p.clientY-y0)>10) stop(); }, { passive:true });
        node.addEventListener("touchend", stop); node.addEventListener("touchcancel", stop);
        node.addEventListener("contextmenu", function(ev){ ev.preventDefault(); stop(); if(!fired){ fired=true; ticketMenu(node.getAttribute("data-id")); } });
        node.addEventListener("click", function(ev){ if(fired){ fired=false; ev.preventDefault(); ev.stopImmediatePropagation(); } }, true);   // l'appui long n'ouvre pas en plus le ticket
      });
    }
    // Appui long sur un élément (au doigt, ou clic droit) ; le toucher qui suit n'ouvre pas en plus l'élément
    function onLongPress(node, fn){
      if(node.getAttribute("data-lp")) return; node.setAttribute("data-lp", "1");
      var t=null, x0=0, y0=0, fired=false;
      function stop(){ if(t){ clearTimeout(t); t=null; } }
      function fire(){ t=null; fired=true; try{ if(navigator.vibrate) navigator.vibrate(15); }catch(e){} fn(); }
      node.addEventListener("touchstart", function(ev){ var p=ev.touches[0]; x0=p.clientX; y0=p.clientY; fired=false; stop(); t=setTimeout(fire, 520); }, { passive:true });
      node.addEventListener("touchmove", function(ev){ var p=ev.touches[0]; if(Math.abs(p.clientX-x0)>10 || Math.abs(p.clientY-y0)>10) stop(); }, { passive:true });
      node.addEventListener("touchend", stop); node.addEventListener("touchcancel", stop);
      node.addEventListener("contextmenu", function(ev){ ev.preventDefault(); stop(); if(!fired){ fired=true; fn(); } });
      node.addEventListener("click", function(ev){ if(fired){ fired=false; ev.preventDefault(); ev.stopImmediatePropagation(); } }, true);
    }
    function ticketMenu(id){
      var e=state.entries.filter(function(x){ return String(x.id)===String(id); })[0]; if(!e) return;
      var dd=String(e.date||"").split("-"), can=!fyRO() && fyCanEdit(e);
      var ch=[{ l:"✎ Ouvrir le ticket", fn:function(){ editEntry(e.id); } }];
      if(can) ch.push({ l:"🗑 Supprimer", danger:true, fn:function(){ delEntryUndo(e.id); } });
      uiChoice((e.marchand||"Ticket")+" · "+fmtK(Number(e.montant)||0), esc((dd.length===3?dd[2]+"/"+dd[1]+"/"+dd[0]:"")+(e.categorie?" · "+e.categorie:"")+(can?"":" · en consultation seulement")), ch);
    }
    function uiToast(msg){
      var t=document.createElement("div"); t.className="ui-toast"; t.textContent=msg; document.body.appendChild(t);
      setTimeout(function(){ try{ document.body.removeChild(t); }catch(e){} }, 2600);
    }
