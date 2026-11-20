    // ---------- Formulaires intégrés (remplacent les fenêtres du navigateur) ----------
    function uiSheet(inner){
      var ov=document.createElement("div"); ov.className="sheet-overlay";
      ov.innerHTML='<div class="sheet ui-sheet">'+inner+'</div>';
      document.body.appendChild(ov);
      var closed=false, onDismiss=null;
      function close(){ if(closed) return; closed=true; try{ document.body.removeChild(ov); }catch(e){} }
      ov.addEventListener("click", function(e){ if(e.target===ov){ close(); if(onDismiss) onDismiss(); } });
      return { ov:ov, close:close, q:function(sel){ return ov.querySelector(sel); }, qa:function(sel){ return ov.querySelectorAll(sel); }, dismiss:function(fn){ onDismiss=fn; } };
    }
    function moneyStr(v){ return (v===undefined||v===null||v==="")?"":String(Math.round(Number(v)*100)/100).replace(".",","); }
    var MOIS_NOMS=["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
    function uiForm(o, onOk){
      var fs=o.fields||[];
      var h='<div class="sheet-title">'+esc(o.title||"")+'</div>';
      if(o.intro) h+='<div class="ui-intro">'+o.intro+'</div>';
      h+='<form class="ui-form" novalidate autocomplete="off">';
      fs.forEach(function(f,i){
        var id="uif_"+i, v=(f.value===undefined||f.value===null)?"":f.value;
        h+='<div class="ui-field" data-i="'+i+'"'+(f.hidden?' style="display:none"':'')+'>';
        if(f.label) h+='<label class="ui-l" for="'+id+'">'+esc(f.label)+'</label>';
        if(f.type==="seg"){
          h+='<div class="ui-seg" id="'+id+'">';
          f.options.forEach(function(op){ h+='<button type="button" data-v="'+esc(op.v)+'"'+(String(op.v)===String(v)?' class="on"':'')+'>'+esc(op.l)+'</button>'; });
          h+='</div>';
        } else if(f.type==="select"){
          h+='<select class="f" id="'+id+'">';
          f.options.forEach(function(op){ h+='<option value="'+esc(op.v)+'"'+(String(op.v)===String(v)?' selected':'')+'>'+esc(op.l)+'</option>'; });
          h+='</select>';
        } else {
          var typ = (f.type==="money"||f.type==="qty") ? 'type="text" inputmode="decimal"' : f.type==="pin" ? 'type="password" inputmode="numeric" maxlength="6"' : f.type==="month" ? 'type="month"' : 'type="text"';
          h+='<div class="ui-inp'+(f.type==="money"?' money':'')+'"><input class="f" id="'+id+'" '+typ+' value="'+esc(f.type==="money"?moneyStr(v):v)+'"'+(f.placeholder?' placeholder="'+esc(f.placeholder)+'"':'')+'>'+(f.type==="money"?'<span>'+esc(f.suffix||curSym())+'</span>':'')+'</div>';
        }
        if(f.help) h+='<div class="ui-help">'+f.help+'</div>';
        h+='</div>';
      });
      h+='<div class="ui-err" style="display:none"></div>';
      h+='<div class="ui-actions"><button type="button" class="btn ghost ui-cancel">'+esc(o.cancel||"Annuler")+'</button><button type="submit" class="btn '+(o.danger?'danger':'primary')+'">'+esc(o.ok||"Enregistrer")+'</button></div>';
      h+='</form>';
      var s=uiSheet(h);
      function el(i){ return s.q("#uif_"+i); }
      function idx(k){ for(var i=0;i<fs.length;i++){ if(fs[i].key===k) return i; } return -1; }
      function rawOf(i){ var f=fs[i], x=el(i); if(!x) return ""; if(f.type==="seg"){ var on=x.querySelector("button.on"); return on?on.getAttribute("data-v"):""; } return x.value; }
      function valOf(i){ var f=fs[i], r=rawOf(i); if(f.type==="money"||f.type==="qty"){ r=String(r).trim(); return r===""?null:num(r); } return (typeof r==="string")?r.trim():r; }
      var api={
        get:function(k){ var i=idx(k); return i<0?null:valOf(i); },
        set:function(k,v){ var i=idx(k); if(i<0) return; var f=fs[i], x=el(i); if(f.type==="seg"){ [].forEach.call(x.querySelectorAll("button"), function(b){ b.className=(b.getAttribute("data-v")===String(v))?"on":""; }); } else x.value=(f.type==="money"?moneyStr(v):(v==null?"":v)); },
        suffix:function(k,t){ var i=idx(k); if(i<0) return; var sp=s.q('.ui-field[data-i="'+i+'"] .ui-inp span'); if(sp) sp.textContent=t; },
        show:function(k,on){ var i=idx(k); if(i<0) return; s.q('.ui-field[data-i="'+i+'"]').style.display=on?"":"none"; fs[i].hidden=!on; },
        opts:function(k, list, v){ var i=idx(k); if(i<0) return; var x=el(i); if(!x || fs[i].type!=="select") return; fs[i].options=list;
          x.innerHTML=list.map(function(op){ return '<option value="'+esc(op.v)+'"'+(String(op.v)===String(v)?' selected':'')+'>'+esc(op.l)+'</option>'; }).join(""); },
        help:function(k, html){ var i=idx(k); if(i<0) return; var hp=s.q('.ui-field[data-i="'+i+'"] .ui-help'); if(hp) hp.innerHTML=html; },
        error:function(msg){ var er=s.q(".ui-err"); er.textContent=msg||""; er.style.display=msg?"":"none"; },
        close:function(){ s.close(); }
      };
      fs.forEach(function(f,i){
        var x=el(i); if(!x) return;
        if(f.type==="seg"){ [].forEach.call(x.querySelectorAll("button"), function(b){ b.onclick=function(){ [].forEach.call(x.querySelectorAll("button"), function(o){ o.className=""; }); b.className="on"; if(f.onChange) f.onChange(valOf(i), api); }; }); }
        else if(f.onChange){ x.addEventListener("change", function(){ f.onChange(valOf(i), api); }); }
      });
      s.q(".ui-cancel").onclick=function(){ s.close(); if(o.onCancel) o.onCancel(); };
      s.dismiss(function(){ if(o.onCancel) o.onCancel(); });
      s.q("form").onsubmit=function(ev){
        ev.preventDefault();
        var r={};
        for(var i=0;i<fs.length;i++){
          var f=fs[i], v=valOf(i);
          if(!f.hidden && f.required && (v===null || v==="")){ api.error("Indique : "+(f.label||f.key).toLowerCase()); var x=el(i); if(x&&x.focus) x.focus(); return; }
          if(!f.hidden && (f.type==="money"||f.type==="qty") && v!==null && isNaN(v)){ api.error("Montant invalide : "+(f.label||"")); return; }
          r[f.key]=f.hidden?null:v;
        }
        var res=onOk(r, api);
        if(typeof res==="string"){ api.error(res); return; }
        if(res===false) return;
        s.close();
      };
      if(o.focus!==false){ setTimeout(function(){ for(var i=0;i<fs.length;i++){ var f=fs[i]; if(!f.hidden && f.type!=="seg" && f.type!=="select" && f.type!=="month"){ var x=el(i); if(x){ try{ x.focus(); if(x.select) x.select(); }catch(e){} } break; } } }, 60); }
      return api;
    }
    function uiConfirm(msg, onYes, o){
      o=o||{};
      var s=uiSheet((o.title?'<div class="sheet-title">'+esc(o.title)+'</div>':'')+'<div class="ui-msg">'+msg+'</div>'+
        '<div class="ui-actions"><button type="button" class="btn ghost ui-no">'+esc(o.no||"Annuler")+'</button><button type="button" class="btn '+(o.danger?'danger':'primary')+' ui-yes">'+esc(o.ok||"Confirmer")+'</button></div>');
      s.q(".ui-no").onclick=function(){ s.close(); if(o.onNo) o.onNo(); };
      s.dismiss(function(){ if(o.onNo) o.onNo(); });
      s.q(".ui-yes").onclick=function(){ s.close(); onYes(); };
    }
    function uiChoice(title, msg, choices){
      var h='<div class="sheet-title">'+esc(title)+'</div>'+(msg?'<div class="ui-intro">'+msg+'</div>':'')+'<div class="ui-stack">';
      choices.forEach(function(c,i){ h+='<button type="button" class="btn '+(c.danger?'danger':((c.primary!=null?c.primary:i===0)?'primary':''))+'" data-i="'+i+'">'+esc(c.l)+'</button>'; });
      h+='<button type="button" class="btn ghost ui-no">Annuler</button></div>';
      var s=uiSheet(h);
      s.q(".ui-no").onclick=s.close;
      [].forEach.call(s.qa("button[data-i]"), function(b){ b.onclick=function(){ s.close(); choices[+b.getAttribute("data-i")].fn(); }; });
    }
    // Message avec un bouton (« Annuler ») pendant quelques secondes ; fin() est appelé si on n'a pas annulé
    function uiUndoToast(msg, label, onUndo, fin, ms){
      var t=document.createElement("div"); t.className="ui-toast undo"; t.setAttribute("role", "status");
      t.innerHTML='<span>'+esc(msg)+'</span><button type="button">'+esc(label)+'</button>'; document.body.appendChild(t);
      var done=false, tm=setTimeout(function(){ if(done) return; done=true; try{ document.body.removeChild(t); }catch(e){} if(fin) fin(); }, ms||6000);
      t.querySelector("button").onclick=function(){ if(done) return; done=true; clearTimeout(tm); try{ document.body.removeChild(t); }catch(e){} onUndo(); };
    }
    // Supprimer un ticket, avec « Annuler » (la photo n'est effacée qu'à la fin du délai)
