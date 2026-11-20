    // ---------- Pages à glisser (comme les bureaux du téléphone) ----------
    // Défilement natif aimanté, une page à la fois. Puces jusqu'à 6 pages, « 2 / 11 » au-delà ;
    // flèches ‹ › sur ordinateur (et toujours avec le compteur). La page vue est gardée et reprise à l'affichage suivant.
    var pgPos=store.read("pgPos", {})||{};
    function pagerHTML(id, pages, o){
      o=o||{}; var n=pages.length;
      if(n<2 && !o.nav) return pages[0]||"";
      var h='<div class="pgr'+(o.cls?' '+o.cls:'')+'" data-pgr="'+esc(id)+'" data-start="'+(o.start||0)+'"'+(o.force?' data-force="1"':'')+'><div class="pg-track">'+
        pages.map(function(p,i){ return '<div class="pg-page" aria-label="Page '+(i+1)+' sur '+n+'">'+p+'</div>'; }).join("")+'</div>';
      h+='<div class="pg-nav '+(n<=6?'dots':'count')+'">';
      if(n>1){
        h+='<button type="button" class="pg-a pg-prev" aria-label="Page précédente">‹</button>';
        if(n<=6){ h+='<div class="pg-dots">'; for(var i=0;i<n;i++) h+='<button type="button" class="pg-dot" aria-label="Page '+(i+1)+' sur '+n+'"><i></i></button>'; h+='</div>'; }
        else h+='<div class="pg-count"><b>1</b> / '+n+'</div>';
        h+='<button type="button" class="pg-a pg-next" aria-label="Page suivante">›</button>';
      }
      if(o.tools) h+='<div class="pg-tools">'+o.tools+'</div>';
      return h+'</div></div>';
    }
    function wirePagers(root){
      root=root||document; if(root.isConnected===false) return;   // rendu hors écran (petites cartes de l'Accueil) : rien à brancher
      [].forEach.call(root.querySelectorAll(".pgr"), function(pg){
        if(pg.getAttribute("data-wired")) return; pg.setAttribute("data-wired","1");
        var id=pg.getAttribute("data-pgr"), tr=pg.querySelector(".pg-track"); if(!tr) return;
        var n=tr.children.length, dots=pg.querySelectorAll(".pg-dot"), cnt=pg.querySelector(".pg-count b"), prev=pg.querySelector(".pg-prev"), next=pg.querySelector(".pg-next"), cur=-1;
        // la page vue n'est gardée que si on l'a choisie (glisser, flèches, puces) : un défilement dû à la mise en page
        // (appli qui s'ouvre avant d'avoir sa taille, largeur qui change) ne la remet pas à 1
        var user=false, down=false, userT=0;
        function settle(){ clearTimeout(userT); userT=setTimeout(function(){ if(!down) user=false; }, 300); }   // fin du geste : 0,3 s sans défilement, doigt levé
        function touch(){ user=true; settle(); }
        function clamp(i){ return Math.max(0, Math.min(n-1, i)); }
        function upd(i, save){ if(i!==cur){ cur=i;
            [].forEach.call(dots, function(d,k){ d.classList.toggle("on", k===i); if(k===i) d.setAttribute("aria-current","page"); else d.removeAttribute("aria-current"); });
            if(cnt) cnt.textContent=String(i+1); if(prev) prev.disabled=(i<=0); if(next) next.disabled=(i>=n-1); }
          if(save && id && pgPos[id]!==i){ pgPos[id]=i; store.write("pgPos", pgPos); }
        }
        function place(){ var w=tr.clientWidth; if(w && cur>=0 && Math.abs(tr.scrollLeft-cur*w)>2) tr.scrollLeft=cur*w; }
        function go(i, smooth, save){ i=clamp(i); var w=tr.clientWidth;
          if(w){ if(smooth && tr.scrollTo) tr.scrollTo({ left:i*w, behavior:"smooth" }); else tr.scrollLeft=i*w; } upd(i, save); }
        var st=+pg.getAttribute("data-start")||0, i0=(pg.getAttribute("data-force")==="1" || !id || pgPos[id]==null) ? st : +pgPos[id];
        go(isFinite(i0)?i0:0, false, false);
        ["pointerdown","touchstart"].forEach(function(ev){ tr.addEventListener(ev, function(){ down=true; user=true; clearTimeout(userT); }, { passive:true }); });
        ["pointerup","pointercancel","touchend","touchcancel"].forEach(function(ev){ tr.addEventListener(ev, function(){ down=false; settle(); }, { passive:true }); });
        tr.addEventListener("wheel", touch, { passive:true });
        var raf=0;
        tr.addEventListener("scroll", function(){ if(user) settle(); if(raf) return; raf=requestAnimationFrame(function(){ raf=0; var w=tr.clientWidth; if(!w) return;
          if(!user){ place(); return; }   // pas un geste : on reste sur la page voulue
          upd(clamp(Math.round(tr.scrollLeft/w)), true); }); }, { passive:true });
        // largeur connue plus tard ou qui change : on se remet sur la même page
        if(window.ResizeObserver){ var lw=tr.clientWidth, ro=new ResizeObserver(function(){ if(!tr.isConnected){ ro.disconnect(); return; } var w=tr.clientWidth; if(!w || w===lw) return; lw=w; if(!user) place(); }); ro.observe(tr); }
        setTimeout(function(){ if(!user && tr.isConnected) place(); }, 300);
        [].forEach.call(dots, function(d,k){ d.onclick=function(ev){ ev.stopPropagation(); touch(); go(k, true, true); }; });
        if(prev) prev.onclick=function(ev){ ev.stopPropagation(); touch(); go(cur-1, true, true); };
        if(next) next.onclick=function(ev){ ev.stopPropagation(); touch(); go(cur+1, true, true); };
      });
    }
    // Les grands graphiques glissent pour changer de graphique : pas depuis une zone qui défile elle-même
    function swipeSkip(t, hero){ while(t && t!==hero){ if(t.classList && (t.classList.contains("cch-tabs") || t.classList.contains("pgr"))) return true; if(t.tagName==="SELECT") return true; t=t.parentNode; } return false; }
    // Regroupe les boutons ✎ 🔗 ✕ d'une ligne dans un menu « ⋯ »
    function compactRowActions(){
      [].forEach.call(app.querySelectorAll(".prow"), function(row){
        if(row.getAttribute("data-compact")) return;
        var acts=[].filter.call(row.querySelectorAll("button"), function(b){ var t=(b.textContent||"").trim(); return t==="✎"||t==="✕"||t==="🔗"||t==="▲"||t==="▼"; });
        if(acts.length<2) return;
        row.setAttribute("data-compact","1");
        acts.forEach(function(b){ b.style.display="none"; });
        var more=document.createElement("button"); more.type="button"; more.className="btn ghost more"; more.textContent="⋯"; more.setAttribute("aria-label","Actions");
        row.appendChild(more);
        more.onclick=function(ev){
          ev.stopPropagation();
          var nm=row.querySelector(".pname"), title="Actions";
          if(nm){ var t0=nm.childNodes[0]; title=((t0 && t0.nodeType===3 && t0.textContent.trim()) ? t0.textContent : (nm.firstElementChild?nm.firstElementChild.textContent:nm.textContent)).trim().slice(0,40); }
          var linked=(row.textContent||"").indexOf("● Bourse")>=0, order={"✎":0,"▲":1,"▼":2,"🔗":3,"✕":4};
          uiChoice(title, "", acts.slice().sort(function(a,b){ return order[a.textContent.trim()]-order[b.textContent.trim()]; }).map(function(b){
            var t=b.textContent.trim();
            return { l:(t==="✎"?"Modifier":(t==="▲"?"↑ Monter":(t==="▼"?"↓ Descendre":(t==="🔗"?(linked?"Délier de la Bourse":"Lier à la Bourse"):"Supprimer")))), danger:(t==="✕"), fn:function(){ b.click(); } };
          }));
        };
      });
    }

