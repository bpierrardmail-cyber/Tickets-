    // ---------- Photos d'origine et stockage ----------
    // Deux copies par ticket : la petite photo (600 px, store « photos », toute dans PHOTOS) pour les listes, et la photo
    // d'origine, toutes ses pages (store « orig » : {b:[Blob], s:taille}), lue seulement quand on l'ouvre ou la sauvegarde.
    // Supprimer des photos garde toujours les tickets ; la galerie du téléphone n'est jamais touchée.
    var ORIGSZ={}, PHDEL={};
    function origPut(id, blobs){
      blobs=[].slice.call(blobs||[]).filter(function(b){ return b && b.size; }); if(!blobs.length || !IDB) return Promise.resolve(false);
      var sz=0; blobs.forEach(function(b){ sz+=b.size; });
      return idbOpen().then(function(db){ return new Promise(function(res){ try{ var tx=db.transaction("orig","readwrite"); tx.objectStore("orig").put({ b:blobs, s:sz }, String(id));
        tx.oncomplete=function(){ ORIGSZ[String(id)]=sz; res(true); }; tx.onerror=tx.onabort=function(){ res(false); }; }catch(e){ res(false); } }); }).catch(function(){ return false; });
    }
    function origGet(id){
      if(!IDB) return Promise.resolve(null);
      return idbOpen().then(function(db){ return new Promise(function(res){ try{ var rq=db.transaction("orig","readonly").objectStore("orig").get(String(id));
        rq.onsuccess=function(){ res(rq.result||null); }; rq.onerror=function(){ res(null); }; }catch(e){ res(null); } }); }).catch(function(){ return null; });
    }
    function origDel(id){
      delete ORIGSZ[String(id)]; if(!IDB) return Promise.resolve(false);
      return idbOpen().then(function(db){ return new Promise(function(res){ try{ var tx=db.transaction("orig","readwrite"); tx.objectStore("orig").delete(String(id));
        tx.oncomplete=function(){ res(true); }; tx.onerror=tx.onabort=function(){ res(false); }; }catch(e){ res(false); } }); }).catch(function(){ return false; });
    }
    function origSizes(){   // tailles seulement : les photos elles-mêmes ne sont pas lues
      return idbOpen().then(function(db){ return new Promise(function(res){ var out={};
        try{ var cur=db.transaction("orig","readonly").objectStore("orig").openCursor();
          cur.onsuccess=function(){ var c=cur.result; if(c){ out[c.key]=(c.value&&c.value.s)||0; c.continue(); } else res(out); };
          cur.onerror=function(){ res(out); }; }catch(e){ res(out); } }); }).catch(function(){ return {}; });
    }
    function fmtBytes(n){ n=Math.max(0, n||0);
      if(n<1048576) return Math.round(n/1024)+" Ko";
      if(n<1073741824) return (n/1048576).toFixed(n<10485760?1:0).replace(".", ",")+" Mo";
      return (n/1073741824).toFixed(1).replace(".", ",")+" Go"; }
    function hasPhoto(e){ var k=String(e.id); return !PHDEL[k] && !!(PHOTOS[k] || ORIGSZ[k]); }
    function photoBytesOf(id){ var k=String(id), t=PHOTOS[k]; return (t?Math.round(t.length*0.75):0)+(ORIGSZ[k]||0); }
    function photoEntries(){ return state.entries.filter(hasPhoto); }
    function photosBytes(){ var n=0; photoEntries().forEach(function(e){ n+=photoBytesOf(e.id); }); return n; }
    function dataBytes(){   // taille des données (mesure seulement : la mémoire locale est lue telle quelle)
      var n=0; try{ for(var i=0;i<localStorage.length;i++){ var k=localStorage.key(i); n+=k.length+(localStorage.getItem(k)||"").length; } }catch(e){}
      for(var k2 in KVONLY){ n+=k2.length+String(KVONLY[k2]||"").length; } return n; }
    function photoGroups(){   // [{y, n, s, ids, months:[{m, n, s, ids}]}], du plus récent au plus ancien
      var Y={};
      photoEntries().forEach(function(e){ var m=(e.date||"").slice(0,7)||"????-??", y=m.slice(0,4), sz=photoBytesOf(e.id);
        var G=Y[y]||(Y[y]={ y:y, n:0, s:0, ids:[], m:{} }), M=G.m[m]||(G.m[m]={ m:m, n:0, s:0, ids:[] });
        G.n++; G.s+=sz; G.ids.push(e.id); M.n++; M.s+=sz; M.ids.push(e.id); });
      return Object.keys(Y).sort().reverse().map(function(y){ var G=Y[y]; G.months=Object.keys(G.m).sort().reverse().map(function(k){ return G.m[k]; }); return G; });
    }
    function photoMonthName(m){ return /^\d{4}-\d{2}$/.test(m) ? capFirst(monthLabelOf(m)) : "Sans date"; }
    // « Garder les photos d'origine » : Toujours (0), 5 ans, 2 ans ; au-delà la photo d'origine est retirée, la petite reste
    function photoKeepYears(){ var y=+store.read("photoKeep", 0); return (y===2 || y===5) ? y : 0; }
    function photoKeepOld(y){ var t=todayISO(), cut=(+t.slice(0,4)-y)+t.slice(4);
      return state.entries.filter(function(e){ return ORIGSZ[String(e.id)] && (e.date||"")<cut; }); }
    function photoKeepApply(){ var y=photoKeepYears(); if(!y) return 0; var L=photoKeepOld(y); L.forEach(function(e){ origDel(e.id); }); return L.length; }
    function photosDelete(ids){
      var keep=[];
      ids.forEach(function(id){ var k=String(id); keep.push({ k:k, ph:PHOTOS[k] }); PHDEL[k]=1; delete PHOTOS[k]; });
      state.entries.forEach(function(e){ if(PHDEL[String(e.id)]) e.photo=false; });
      persist(); render();
      var n=ids.length;
      uiUndoToast(n+" photo"+(n>1?"s":"")+" supprimée"+(n>1?"s":"")+" · tickets gardés", "Annuler", function(){
        keep.forEach(function(x){ delete PHDEL[x.k]; if(x.ph) PHOTOS[x.k]=x.ph; });
        state.entries.forEach(function(e){ var k=String(e.id); if(PHOTOS[k] || ORIGSZ[k]) e.photo=true; });
        persist(); render(); uiToast("Photos remises");
      }, function(){ keep.forEach(function(x){ idbDel(x.k); origDel(x.k); delete PHDEL[x.k]; }); }, 7000);
    }
    function photosAskDelete(ids, what){
      ids=ids.filter(function(id){ return !PHDEL[String(id)]; }); if(!ids.length) return;
      var sz=0; ids.forEach(function(id){ sz+=photoBytesOf(id); });
      var lf=backupAge("lastBackupFull"), n=ids.length;
      var msg=esc(n+" photo"+(n>1?"s":"")+" · "+fmtBytes(sz)+". Les tickets restent (montant, articles…), seules leurs photos sont retirées de l'appli. Les photos de la galerie du téléphone ne sont pas touchées.")+"<br><br>"+
        (lf.days===null ? '<b style="color:var(--coral)">Tu n\'as jamais fait de sauvegarde complète : ces photos seront perdues.</b>' : esc("Dernière sauvegarde complète : "+lf.label+"."));
      uiChoice("Supprimer les photos "+what+" ?", msg, [
        { l:"Supprimer les photos", danger:true, fn:function(){ photosDelete(ids); } },
        { l:"Faire une sauvegarde complète d'abord", primary:false, fn:function(){ backupData("full"); } }
      ]);
    }
    function photosMenu(m){   // ⋯ ou appui long sur un mois de la galerie : supprimer les photos du mois ou de l'année
      var G=photoGroups(), y=m.slice(0,4), Gy=G.filter(function(g){ return g.y===y; })[0]; if(!Gy) return;
      var M=Gy.months.filter(function(x){ return x.m===m; })[0]; if(!M) return;
      var mn=photoMonthName(m), ch=[{ l:"Supprimer les photos de "+mn.toLowerCase()+" ("+M.n+")", danger:true, fn:function(){ photosAskDelete(M.ids, "de "+mn.toLowerCase()); } }];
      if(Gy.n>M.n) ch.push({ l:"Supprimer les photos de "+y+" ("+Gy.n+")", danger:true, fn:function(){ photosAskDelete(Gy.ids, "de "+y); } });
      uiChoice(mn, esc("Les tickets restent ; seules les photos sont retirées de l'appli."), ch);
    }
    function renderStockage(){
      var G=photoGroups(), nph=0, sp=0;
      G.forEach(function(g){ nph+=g.n; sp+=g.s; });
      var sd=dataBytes(), tot=sp+sd, pp=tot ? Math.round(sp*100/tot) : 0;
      if(sp && pp<2) pp=2;
      var h=header("list")+'<section class="paper">';
      h+='<div class="center muted" style="font-size:11px;letter-spacing:.18em;text-transform:uppercase">Stockage</div><hr class="rule">';
      h+='<div class="sto-tot"><b>'+fmtBytes(tot)+'</b> utilisés par l\'appli</div>';
      h+='<div class="sto-bar"><i style="width:'+pp+'%"></i></div>';
      h+='<div class="sto-leg"><span><i class="dot ph"></i>Photos · '+nph+' · '+fmtBytes(sp)+'</span><span><i class="dot da"></i>Données · '+fmtBytes(sd)+'</span></div>';
      h+='<div class="muted sto-free" id="stoFree"></div>';
      var y=photoKeepYears(), lf=backupAge("lastBackupFull");
      h+='<button type="button" class="sto-row" id="stoKeep"><span>Garder les photos d\'origine</span><b>'+(y?y+" ans":"Toujours")+' ›</b></button>';
      if(!fyMember()) h+='<button type="button" class="sto-row" id="stoBk"><span>Sauvegarde complète<br><small class="muted">données + photos, dans un fichier ZIP</small></span><b style="color:'+((lf.days===null || lf.days>=30)?"var(--coral)":"var(--accent)")+'">'+esc(lf.label)+' ›</b></button>';
      h+='<div class="sto-h">Photos des tickets</div>';
      if(!G.length) h+='<div class="empty">Aucune photo de ticket pour le moment.</div>';
      var open=state.stoOpen||{};
      G.forEach(function(g){
        h+='<div class="sto-y"><button type="button" class="sto-yh" data-y="'+esc(g.y)+'"><span>'+(open[g.y]?"▾":"▸")+'</span><b>'+esc(g.y)+'</b><span class="muted">'+g.n+' photo'+(g.n>1?"s":"")+' · '+fmtBytes(g.s)+'</span></button>'+
           '<button type="button" class="btn ghost sto-del" data-y="'+esc(g.y)+'">Supprimer</button></div>';
        if(open[g.y]) g.months.forEach(function(M){
          h+='<div class="sto-m"><span class="mn">'+esc(photoMonthName(M.m))+'</span><span class="muted">'+M.n+' · '+fmtBytes(M.s)+'</span>'+
             '<button type="button" class="btn ghost sto-del" data-m="'+esc(M.m)+'">Supprimer</button></div>'; });
      });
      h+='<div class="muted" style="font-size:11px;margin-top:14px;line-height:1.5">Supprimer des photos garde les tickets. Les photos de la galerie du téléphone sont à part : l\'appli n\'y touche jamais.</div>';
      h+='</section>';
      app.innerHTML=h;
      setNav(null,false);
      bindBack(function(){ state.view="list"; render(); });
      try{ if(navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then(function(r){ var el=document.getElementById("stoFree");
        if(el && r && r.quota) el.textContent="Place encore libre pour l'appli : "+fmtBytes(Math.max(0, r.quota-(r.usage||0))); }).catch(function(){}); }catch(e){}
      document.getElementById("stoKeep").onclick=function(){
        var cur=photoKeepYears();
        function set(v){ var L=v?photoKeepOld(v):[];
          function go(){ store.write("photoKeep", v); var n=photoKeepApply(); render(); uiToast(v ? "Photos d'origine gardées "+v+" ans"+(n?" · "+n+" retirée"+(n>1?"s":""):"") : "Photos d'origine gardées toujours"); }
          if(!L.length) return go();
          uiChoice("Retirer "+L.length+" photo"+(L.length>1?"s":"")+" d'origine ?", esc("Celles des tickets de plus de "+v+" ans. Les petites photos et les tickets restent."), [{ l:"Retirer", danger:true, fn:go }]);
        }
        uiChoice("Garder les photos d'origine", esc("Au-delà, la photo d'origine est retirée de l'appli ; la petite photo et le ticket restent."), [
          { l:"Toujours"+(cur===0?" ✓":""), primary:cur===0, fn:function(){ set(0); } },
          { l:"5 ans"+(cur===5?" ✓":""), primary:cur===5, fn:function(){ set(5); } },
          { l:"2 ans"+(cur===2?" ✓":""), primary:cur===2, fn:function(){ set(2); } } ]);
      };
      var bk=document.getElementById("stoBk"); if(bk) bk.onclick=function(){ backupData("full"); };
      [].forEach.call(app.querySelectorAll(".sto-yh"), function(b){ b.onclick=function(){ var k=b.getAttribute("data-y"); state.stoOpen=state.stoOpen||{}; state.stoOpen[k]=!state.stoOpen[k]; render(); }; });
      [].forEach.call(app.querySelectorAll(".sto-del"), function(b){ b.onclick=function(){
        var yy=b.getAttribute("data-y"), m=b.getAttribute("data-m"), g;
        if(yy){ g=G.filter(function(x){ return x.y===yy; })[0]; if(g) photosAskDelete(g.ids, "de "+yy); }
        else { G.forEach(function(x){ x.months.forEach(function(M){ if(M.m===m) g=M; }); }); if(g) photosAskDelete(g.ids, "de "+photoMonthName(m).toLowerCase()); }
      }; });
    }
    function delPhotoFor(id){
      idbDel(id); origDel(id); delete PHOTOS[String(id)];
      state.entries=state.entries.map(function(e){ if(String(e.id)===String(id)) e.photo=false; return e; });
      persist(); render();
    }
    function renderGallery(){
      var list=state.entries.filter(function(e){ return photoOf(e); });
      var h=header("list")+'<section class="paper">';
      h+='<div class="center muted" style="font-size:11px;letter-spacing:.18em;text-transform:uppercase">Galerie · '+list.length+' photo'+(list.length>1?"s":"")+'</div><hr class="rule">';
      if(!list.length){ h+='<div class="empty">Aucune photo de ticket pour le moment.<br>Scanne un ticket ou ajoute une photo depuis un ticket.</div>'; }
      else{
        h+='<button type="button" class="sto-link" id="gSto">Stockage · '+fmtBytes(photosBytes()+dataBytes())+' ›</button>';
        list.sort(function(a,b){ return (b.date||"").localeCompare(a.date||"") || (+b.id||0)-(+a.id||0); });
        var gm=null;
        list.forEach(function(e){
          var m=(e.date||"").slice(0,7)||"????-??";
          if(m!==gm){ var nm=list.filter(function(x){ return ((x.date||"").slice(0,7)||"????-??")===m; }).length;
            h+=(gm!==null?'</div>':'')+'<div class="gmh" data-m="'+esc(m)+'"><b>'+esc(photoMonthName(m))+'</b><span class="muted">· '+nm+' photo'+(nm>1?"s":"")+'</span><button type="button" class="gmore" data-m="'+esc(m)+'" aria-label="Supprimer les photos…">⋯</button></div><div class="gallery">';
            gm=m; }
          var ph=photoOf(e);
          h+='<div class="gtile">'+
               '<div class="gimg" data-id="'+esc(e.id)+'" style="background-image:url(\''+ph+'\')"></div>'+
               '<button class="gdel" type="button" data-id="'+esc(e.id)+'">✕</button>'+
               '<div class="gcap"><span class="gn">'+esc(e.marchand)+'</span><span class="ga">'+fmt(e.montant)+'</span></div>'+
             '</div>';
        });
        h+='</div>';
        h+='<div class="muted" style="font-size:10px;margin-top:12px;text-align:center">Touche une photo pour l\'agrandir · ✕ pour la supprimer · ⋯ pour un mois ou une année</div>';
      }
      h+='</section>';
      app.innerHTML=h;
      setNav(null,false);
      bindBack(function(){ state.view="tickets"; state.depSub="tickets"; render(); });
      [].forEach.call(document.querySelectorAll(".gimg"), function(el){ el.onclick=function(){ state.photoId=el.getAttribute("data-id"); state.view="photo"; render(); }; });
      var gs=document.getElementById("gSto"); if(gs) gs.onclick=function(){ state.view="stockage"; render(); window.scrollTo(0,0); };
      [].forEach.call(document.querySelectorAll(".gmore"), function(b){ b.onclick=function(){ photosMenu(b.getAttribute("data-m")); }; });
      [].forEach.call(document.querySelectorAll(".gmh"), function(el){ onLongPress(el, function(){ photosMenu(el.getAttribute("data-m")); }); });
      [].forEach.call(document.querySelectorAll(".gdel"), function(b){ b.onclick=function(){ var id=b.getAttribute("data-id"); if(!window.confirm("Supprimer la photo de ce ticket ?\n(le ticket est conservé)")) return; delPhotoFor(id); }; });
    }
    function renderPhoto(){
      var e=state.entries.filter(function(x){ return String(x.id)===String(state.photoId); })[0];
      var ph=e?photoOf(e):"";
      if(!ph){ state.view="gallery"; return renderGallery(); }
      var dt=(e.date||"").split("-").reverse().join("/");
      var h='<div class="lightbox">';
      h+='<div class="lbtop"><button class="lbx" id="lbclose" type="button">‹</button><div class="lbcap"><div class="lbn">'+esc(e.marchand)+' · '+fmt(e.montant)+'</div><div class="lbm">'+esc(dt)+' · '+esc(e.categorie)+'</div></div></div>';
      h+='<div class="lbimg"><img src="'+ph+'" alt=""></div>';
      h+='<div class="lbbtns"><button class="btn ghost" id="lbopen" type="button">Ouvrir le ticket</button><button class="btn ghost" id="lbdel" type="button">Supprimer la photo</button></div>';
      h+='</div>';
      app.innerHTML=h;
      setNav(null,false);
      var box=app.querySelector(".lbimg"), eid=e.id;
      if(box) box.onclick=function(){ box.classList.toggle("zoom"); };
      origGet(eid).then(function(o){
        if(!o || !o.b || !o.b.length || !box || state.view!=="photo" || String(state.photoId)!==String(eid)) return;
        var hh=""; o.b.forEach(function(b){ try{ hh+='<img src="'+URL.createObjectURL(b)+'" alt="">'; }catch(x){} }); if(!hh) return;
        box.innerHTML=hh; box.setAttribute("data-orig", "1"); if(o.b.length>1) box.classList.add("multi");
        var lm=app.querySelector(".lbm"); if(lm) lm.textContent+=" · photo d'origine"+(o.b.length>1?" · "+o.b.length+" pages":"")+" · "+fmtBytes(o.s);
      });
      document.getElementById("lbclose").onclick=function(){ state.view="gallery"; render(); };
      document.getElementById("lbopen").onclick=function(){ editEntry(state.photoId); };
      document.getElementById("lbdel").onclick=function(){ if(!window.confirm("Supprimer la photo de ce ticket ?\n(le ticket est conservé)")) return; state.view="gallery"; delPhotoFor(state.photoId); };
    }
    function renderPatrimoine(){
      var month=monthKey(todayISO());
      var solde=computeCompteMonth(myAcct().key, month).solde;
      var epManuel=0, epLies=0;
      epargne.forEach(function(c){ if(c.bourseLink) epLies+=epCurrent(c); else epManuel+=epCurrent(c); });
      var bourseTot=FEAT.bourse?bourseTotalLive():0;
      var net=solde+epManuel+bourseTot;
      var h=header("list")+'<section class="paper">';
      h+='<div class="center muted" style="font-size:11px;letter-spacing:.18em;text-transform:uppercase">Patrimoine</div><hr class="rule">';
      h+='<div class="leader fam"><span class="lbl">Compte courant</span><span class="fill"></span><span class="val">'+fmt(solde)+'</span></div>';
      h+='<div class="leader fam"><span class="lbl">'+(FEAT.bourse?'Épargne (hors Bourse)':'Épargne')+'</span><span class="fill"></span><span class="val">'+fmt(epManuel)+'</span></div>';
      if(FEAT.bourse) h+='<div class="leader fam"><span class="lbl">Bourse (portefeuille)</span><span class="fill"></span><span class="val">'+fmt(bourseTot)+'</span></div>';
      h+='<hr class="rule"><div class="leader total"><span class="lbl">Patrimoine net</span><span class="fill"></span><span class="val" style="font-size:22px;color:'+(net<0?"#f4796b":"#4fd6a0")+'">'+fmt(net)+'</span></div>';
      if(epLies>0) h+='<div class="muted" style="font-size:10px;margin:6px 2px 0">Ton compte épargne lié à la Bourse ('+fmt(epLies)+') n\'est pas recompté ici : il est déjà inclus dans la ligne « Bourse ».</div>';
      h+='<hr class="rule"><div class="muted" style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;margin:0 2px 6px">Répartition</div>';
      h+=gBlock([{name:"Compte",value:solde},{name:"Épargne",value:epManuel}].concat(FEAT.bourse?[{name:"Bourse",value:bourseTot}]:[]));
      h+='</section>';
      app.innerHTML=h;
      setNav(null,false);
      bindBack(function(){ state.view="list"; render(); });
    }
    var provisions = store.read("provisions", []);
    function persistProvisions(){ store.write("provisions", provisions); }
    function monthsBetween(a,b){ var pa=a.split("-"), pb=b.split("-"); return (parseInt(pb[0],10)*12+parseInt(pb[1],10)) - (parseInt(pa[0],10)*12+parseInt(pa[1],10)); }
    function mensuelAt(p, mk){
      if(p.startMonth && mk<p.startMonth) return 0;   // pas encore créée ce mois-là
      var v=Number(p.mensuel)||0;
      if(p.mensuelChanges){ var best=null; for(var k in p.mensuelChanges){ if(k<=mk && (best===null||k>best)) best=k; } if(best!==null) v=Number(p.mensuelChanges[best])||0; }
      return v;
    }
    // Solde calculé mois par mois : jamais sous 0, le surplus d'une facture est noté comme dépassement (payé depuis le compte)
    function provState(p, month, excludePrId, planCur){   // planCur : la mise de côté du mois en cours comptée même pas encore faite (projections)
      var m=month||monthKey(todayISO());
      var start=p.startMonth||m;
      if(m<start) return { bal:0, over:{} };   // avant sa création : rien de côté
      var sk=p.skips||[], prs=p.prelevements||[];
      function outOf(fn){ var o=0; prs.forEach(function(pr){ if(excludePrId!=null && String(pr.id)===String(excludePrId)) return; if(fn(pr.month||"")) o+=Number(pr.montant)||0; }); return o; }
      var acc=Number(p.soldeInitial)||0, over={}, pf=p.noFrais ? null : provFraisOf(p), cm=monthKey(todayISO());
      // suivie dans les frais fixes : un mois passé ou en cours ne compte que quand sa mise de côté est cochée « fait » (07/11) ; les mois à venir sont prévus
      function accrues(c){ return !pf || !pf.provFrom || c<pf.provFrom || c>cm || fraisDone(pf, c) || (c===cm && (m>cm || planCur)); }   // vu depuis un mois à venir : le mois en cours est encore prévu
      var cur=start, guard=0;
      acc-=outOf(function(pm){ return pm<=start; });
      if(acc<0){ over[start]=-acc; acc=0; }
      while(cur<m && guard<600){
        cur=nextMonthKey(cur); guard++;
        if(sk.indexOf(cur)<0 && accrues(cur)) acc+=mensuelAt(p, cur);
        var c=cur; acc-=outOf(function(pm){ return pm===c; });
        if(acc<0){ over[cur]=-acc; acc=0; }
      }
      return { bal:acc, over:over };
    }
    function provBalance(p, month){ return provState(p, month).bal; }
    function renderBilan(){
      var curM=monthKey(todayISO());
      var from=state.bilanFrom, to=state.bilanTo;
      if(!from || !to){ from=to=(state.bilanMonth||curM); }
      var ms=[], mk=from; while(mk<=to && ms.length<120){ ms.push(mk); mk=nextMonthKey(mk); }
      var single=(ms.length===1), month=to, inP={}; ms.forEach(function(m){ inP[m]=1; });
      var label=single?monthLabelOf(month):((from.slice(0,4)===to.slice(0,4)?monthLabelOf(from).split(" ")[0]:monthLabelOf(from))+" – "+monthLabelOf(to)), person=myAcct().key;
      var mois=state.entries.filter(function(x){ return inP[monthKey(x.date)]; });
      var tickets=mois.reduce(function(t,x){ return t+(Number(x.montant)||0); },0);
      var parCat={}; mois.forEach(function(x){ parCat[x.categorie]=(parCat[x.categorie]||0)+(Number(x.montant)||0); });
      var cats=Object.keys(parCat).sort(function(a,b){ return parCat[b]-parCat[a]; });
      var cb={ argent:0, depenses:0, solde:computeCompteMonth(person, to).solde }, lq=liquideAt(person, to), lqV=(lq && liqCounted())?lq.val:0;
      ms.forEach(function(m){ var x=computeCompteMonth(person, m); cb.argent+=x.argent; cb.depenses+=x.depenses; });
      var epTot=0; epargne.forEach(function(c){ epTot+=epAt(c, month); });
      var prTot=provTotalAt(month);
      // Frais fixes et virements additionnés sur la période
      var ffMap={}, ff=[];
      ms.forEach(function(m){ fraisCommuns.forEach(function(f){ if(!fraisActif(f, m)) return; var k=f.label+"|"+((f.personne||"").trim()||"Commun"); if(!ffMap[k]){ ffMap[k]={ label:f.label, who:((f.personne||"").trim()||"Commun"), tot:0, n:0 }; ff.push(ffMap[k]); } ffMap[k].tot+=fraisMontant(f, m); ffMap[k].n++; }); });
      var vMap={}, virs=[];
      ms.forEach(function(m){ virementsOf(person, m).forEach(function(v){ if(single){ virs.push({ label:v.label, montant:v.montant, info:(v.done?'fait':'prévu') }); return; } var k=v.label; if(!vMap[k]){ vMap[k]={ label:v.label, montant:0, n:0 }; virs.push(vMap[k]); } vMap[k].montant+=Number(v.montant)||0; vMap[k].n++; }); });
      if(!single) virs.forEach(function(v){ v.info=v.n+" fois"; });
      var parPay={}; mois.forEach(function(x){ var p=(x.payePar||"").trim()||"Non renseigné"; parPay[p]=(parPay[p]||0)+(Number(x.montant)||0); });
      var mesTickets=parPay[person]||0;
      var h=header("list")+'<section class="paper bilan">';
      h+='<div class="no-print">'+(single?monthNavHTML('Bilan du mois', month, curM):'')+'<button class="btn ghost" id="blPer" type="button" style="width:100%;margin-top:'+(single?'10':'0')+'px">📅 Changer la période</button><hr class="rule"></div>';
      h+='<h2>Bilan · '+esc(label)+'</h2><div class="bl-sub">Édité le '+new Date().toLocaleDateString("fr-FR")+'</div>';
      h+='<div class="bl-kpis">'+
         '<div class="bl-k"><span>Solde de fin de '+(single?'mois':'période')+'</span><b>'+fmt(cb.solde+lqV)+'</b></div>'+
         '<div class="bl-k"><span>Virements (net)</span><b>'+fmt(cb.argent)+'</b></div>'+
         '<div class="bl-k"><span>Dépenses de ton compte</span><b>'+fmt(cb.depenses)+'</b></div>'+
         '<div class="bl-k"><span>dont tes tickets</span><b>'+fmt(mesTickets)+'</b></div>'+
         '<div class="bl-k"><span>Épargne'+(single?'':' (fin)')+'</span><b>'+fmt(epTot)+'</b></div>'+
         '<div class="bl-k"><span>Provisions'+(single?'':' (fin)')+'</span><b>'+fmt(prTot)+'</b></div></div>';
      if(cats.length){
        h+='<h3>Tickets par catégorie (tous payeurs)</h3><table>';
        cats.forEach(function(c){ var b=budgets[c]?budgets[c]*ms.length:0; h+='<tr><td>'+esc(c)+'</td><td class="m">'+(b?'budget '+fmt(b)+(parCat[c]>b?' · dépassé':''):'')+'</td><td class="r">'+fmt(parCat[c])+'</td></tr>'; });
        h+='<tr><td><b>Total</b></td><td></td><td class="r"><b>'+fmt(tickets)+'</b></td></tr></table>';
      }
      if(ff.length){
        h+='<h3>Frais fixes</h3><table>';
        ff.forEach(function(f){ h+='<tr><td>'+esc(f.label)+'</td><td class="m">'+esc(f.who)+(single?'':' · '+f.n+' mois')+'</td><td class="r">'+fmt(f.tot)+'</td></tr>'; });
        h+='</table>';
      }
      if(virs.length){
        h+='<h3>Virements</h3><table>';
        virs.forEach(function(v){ h+='<tr><td>'+esc(v.label)+'</td><td class="m">'+esc(v.info)+'</td><td class="r">'+(v.montant>0?"+":"")+fmt(v.montant)+'</td></tr>'; });
        h+='</table>';
      }
      var pk=Object.keys(parPay);
      if(pk.length){
        h+='<h3>Qui a payé les tickets</h3><table>';
        pk.sort(function(a,b){ return parPay[b]-parPay[a]; }).forEach(function(p){ h+='<tr><td>'+esc(p)+'</td><td></td><td class="r">'+fmt(parPay[p])+'</td></tr>'; });
        h+='</table>';
      }
      if(epargne.length){
        h+='<h3>Épargne</h3><table>';
        epargne.forEach(function(c){ var v=epAt(c, month), o=c.objectif; h+='<tr><td>'+esc(c.nom)+'</td><td class="m">'+(o&&o.montant?'objectif '+fmt(o.montant)+' · '+Math.min(100,Math.round(v/o.montant*100))+' %':'')+'</td><td class="r">'+fmt(v)+'</td></tr>'; });
        h+='</table>';
      }
      if(mois.length){
        var top=mois.slice().sort(function(a,b){ return (Number(b.montant)||0)-(Number(a.montant)||0); }).slice(0,10);
        h+='<h3>Plus gros tickets</h3><table>';
        top.forEach(function(x){ h+='<tr><td>'+esc(x.marchand)+'</td><td class="m">'+esc((x.date||"").split("-").reverse().join("/"))+' · '+esc(x.categorie)+'</td><td class="r">'+fmt(x.montant)+'</td></tr>'; });
        h+='</table>';
      }
      h+='<div class="no-print" style="margin-top:18px"><button class="btn primary" id="blPrint" type="button" style="width:100%">📄 Enregistrer en PDF</button>'+
         '<div class="ui-help center" style="margin-top:6px">Dans la fenêtre d\'impression, choisis « Enregistrer au format PDF ».</div></div>';
      h+='</section>';
      app.innerHTML=h;
      setNav(null,false);
      bindBack(function(){ state.view="list"; render(); });
      var pb=document.getElementById("blPrint"); if(pb) pb.onclick=function(){ var t=document.title; document.title="Bilan "+label;
        var NP=capPlugin("TicketsNative");   // appli Android : impression Android (« Enregistrer au format PDF » ou imprimante)
        if(NP){ NP.print({ name:"Bilan "+label }).catch(function(e){ uiToast((e&&e.message)||"Impression impossible"); }); }
        else window.print();
        setTimeout(function(){ document.title=t; }, 1000); };
      if(!state.months) state.months={};
      function setM(m){ state.bilanMonth=m; state.bilanFrom=m; state.bilanTo=m; render(); }
      var p=document.getElementById("mn-prev"); if(p) p.onclick=function(){ setM(prevMonthKey(month)); };
      var n=document.getElementById("mn-next"); if(n) n.onclick=function(){ setM(nextMonthKey(month)); };
      var t=document.getElementById("mn-today"); if(t) t.onclick=function(){ setM(curM); };
      var bp=document.getElementById("blPer"); if(bp) bp.onclick=choosePdfPeriod;
    }
    function provEcheance(p, month){
      if(!p.echeance) return null;
      var y=+month.split("-")[0], mm=+p.echeance, pad=(mm<10?"0":"")+mm;
      var d=y+"-"+pad;
      var paid=(p.prelevements||[]).some(function(pr){ return pr.month===d; });
      if(d<month || (d===month && paid)) d=(y+1)+"-"+pad;
      var n=monthsBetween(month, d);
      var bal=provState(p, month).bal, sk=p.skips||[], proj=bal, cur=month;
      for(var i=0;i<n;i++){ cur=nextMonthKey(cur); if(sk.indexOf(cur)<0) proj+=mensuelAt(p, cur); }
      var prevu=Number(p.prevu)||0;
      return { due:d, n:n, bal:bal, proj:proj, prevu:prevu, manque:(prevu>0?Math.max(0, prevu-proj):0),
               conseil:(prevu>0 && n>0 ? Math.ceil((prevu-bal)/n*100)/100 : null), mens:mensuelAt(p, month) };
    }
    function provTotalAt(month, keep){ var t=0; provisions.forEach(function(p){ if(keep && !keep(p)) return; var st=provState(p, month); t+=st.bal; for(var k in st.over){ if(k<=month) t-=st.over[k]; } }); return t; }
    function echOptions(){ return [{v:"",l:"Aucune"}].concat(MOIS_NOMS.map(function(n,i){ return {v:String(i+1), l:n.charAt(0).toUpperCase()+n.slice(1)}; })); }
    // Où est l'argent d'une provision : sur un compte épargne (« ep:<id> »), sur le compte courant (« cpt ») ou ailleurs (« ext », non suivi)
    // Par défaut : le premier compte épargne de la même personne, sinon le premier compte épargne, sinon le compte courant.
    function provWhere(p){
      var o=String((p&&p.ou)||"");
      if(o.indexOf("ep:")===0){ var id=o.slice(3); if(epargne.some(function(c){ return String(c.id)===id; })) return o; }
      else if(o.indexOf("cpt:")===0){ var ak=o.slice(4), ac=acctByKey(ak); if(ac) return ac.main ? "cpt" : o; }   // un autre compte bancaire
      else if(o==="cpt" || o==="ext") return o;
      var mine=epargne.filter(function(c){ return ownerOf(c)===ownerOf(p); })[0]||epargne[0];
      return mine ? "ep:"+mine.id : "cpt";
    }
    function provWhereLabel(p){ var w=provWhere(p); if(w==="cpt") return (mainAcct()||{}).nom||"compte courant"; if(w.indexOf("cpt:")===0) return (acctByKey(w.slice(4))||{}).nom||"compte"; if(w==="ext") return "ailleurs"; var c=epargne.filter(function(x){ return "ep:"+x.id===w; })[0]; return c?c.nom:"épargne"; }
    function provWhereOptions(){ return epargne.map(function(c){ return { v:"ep:"+c.id, l:c.nom+(byOwner(epargne).length>1?" · "+ownerOf(c):"") }; }).concat(comptes.filter(function(a){ return a.key!=="__tickets"; }).map(function(a){ return { v:(a.main?"cpt":"cpt:"+a.key), l:a.nom+(comptes.length>1 && acctOwner(a)?" · "+acctOwner(a):"")+" (compte bancaire)" }; })).concat([{ v:"ext", l:"Ailleurs (livret non suivi dans l'appli)" }]); }
    function provSumWhere(m, test){ var t=0; provisions.forEach(function(p){ if(!test(provWhere(p), p)) return; try{ t+=provBalance(p, m); }catch(e){} }); return t; }
