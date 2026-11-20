    // ---------- Banc d'essai de lecture (version Perso, 18/11) ----------
    // Relit avec ML Kit la photo d'origine de chaque ticket, compare à ce qui a été enregistré (la bonne réponse)
    // et exporte ce que ML Kit a lu avec le ticket enregistré, pour améliorer la lecture de la version Store.
    // Règles de lecture seules (parseTicket) : pas ce que l'appli a appris (SIRET, total appris), comme un nouvel utilisateur.
    function bancOn(){ return EDITION==="perso" && !DEMO; }
    // tous les tickets qui ont une photo, tous mois confondus ; avant le 03/11, seule la petite photo (600 px) est gardée
    // photos prises dans des sauvegardes ZIP (bancZip) : en mémoire seulement, rien n'est restauré ; d'abord celles du téléphone
    function bancZ(e){ var Z=state.bancZip||{}, z=Z[String(e.id)]; return (z && !ORIGSZ[String(e.id)] && (z.o || !PHOTOS[String(e.id)])) ? z : null; }
    function bancSmall(e){ var k=String(e.id), z=bancZ(e); return z ? !z.o : (!ORIGSZ[k] && !!PHOTOS[k]); }
    function bancPool(){ return state.entries.filter(function(e){ var k=String(e.id); return e.src!=="releve" && !PHDEL[k] && (ORIGSZ[k] || bancZ(e) || (typeof PHOTOS[k]==="string" && PHOTOS[k].indexOf("data:image/")===0)); })
      .sort(function(a, b){ return String(b.date).localeCompare(String(a.date)); }); }
    function bancArts(e){ return (e.articles||[]).filter(function(a){ return !/ · ticket entier$/.test(String(a.label||"")); }); }
    function bancSame(a, b){ a=norm(a); b=norm(b); return !!a && !!b && (a===b || (a.length>=3 && b.indexOf(a)>=0) || (b.length>=3 && a.indexOf(b)>=0)); }
    function bancCheck(e, p){
      var A=bancArts(e), L=p.lignes||[], sum=function(X){ var t=0; X.forEach(function(a){ t+=num(a.prix)||0; }); return t; };
      var r={ total:p.total!=="" && Math.abs(num(p.total)-num(e.montant))<0.005, marchand:bancSame(p.marchand, e.marchand), date:!!p.date && p.date===e.date,
        arts:A.length ? (L.length===A.length && Math.abs(sum(L)-sum(A))<0.05) : null };
      r.ok=r.total && r.marchand && r.date && r.arts!==false; return r;
    }
    function bancRun(){
      var plug=capPlugin("TicketOcr"); if(!plug){ uiToast("Seulement dans l'appli Android"); return; }
      var pool=bancPool(), B=state.banc={ run:true, i:0, n:pool.length, items:[], at:new Date().toISOString() }; render();
      function prog(){ var el=document.getElementById("bcProg"); if(el) el.textContent="Lecture "+Math.min(B.i+1, B.n)+"/"+B.n+"…"; var br=document.getElementById("bcBar"); if(br) br.style.width=Math.round(B.i*100/Math.max(1,B.n))+"%"; }
      function one(){
        if(state.banc!==B) return;
        if(B.stop || B.i>=B.n){ B.run=false; if(state.view==="banc") render(); return; }
        prog(); var e=pool[B.i];
        var sm=bancSmall(e), zz=bancZ(e);
        (zz ? Promise.all(zz.b.map(function(x){ return zz.ek ? decBlob(x, zz.ek, x.type) : x; })).then(function(b){ return { b:b }; })
          : (sm ? Promise.resolve(null) : origGet(e.id))).then(function(o){
          var pages=(sm && !zz) ? [bancThumbBlob(PHOTOS[String(e.id)])] : ((o && o.b) || []), parts=[], k=0;
          function pg(){ if(k>=pages.length) return Promise.resolve();
            return (sm ? bancUpImage(pages[k]) : nativeImage(pages[k])).then(function(b64){ return plug.recognize({ image:b64 }); })
              .then(function(res){ parts.push({ t:mlkitRows(res||{}), res:res||null }); }, function(err){ parts.push({ t:"", res:null, err:String((err&&err.message)||err) }); })
              .then(function(){ k++; return pg(); }); }
          return pg().then(function(){
            var p=parseTicket(parts.map(function(x){ return x.t; }).join("\n"));
            B.items.push({ e:e, parts:parts, p:p, r:bancCheck(e, p), sm:sm });
          });
        }).catch(function(){ B.items.push({ e:e, parts:[], p:null, r:{ ok:false, err:true }, sm:sm }); })
          .then(function(){ B.i++; one(); });
      }
      one();
    }
    // petite photo (dataURL) → Blob agrandi ×2,5 : ML Kit lit mal les petits caractères
    function bancThumbBlob(u){ var b=atob(u.slice(u.indexOf(",")+1)), a=new Uint8Array(b.length); for(var i=0;i<b.length;i++) a[i]=b.charCodeAt(i);
      return new Blob([a], { type:"image/jpeg" }); }
    function bancUpImage(blob){ return new Promise(function(res, rej){ var img=new Image(), url=URL.createObjectURL(blob);
      img.onload=function(){ try{ var w=img.naturalWidth||img.width, h=img.naturalHeight||img.height, k=Math.min(2.5, 2200/Math.max(w,h,1)), c=document.createElement("canvas");
        c.width=Math.max(1,Math.round(w*k)); c.height=Math.max(1,Math.round(h*k)); var g=c.getContext("2d"); g.imageSmoothingQuality="high"; g.drawImage(img,0,0,c.width,c.height);
        var u=c.toDataURL("image/jpeg",0.92); URL.revokeObjectURL(url); res(u.slice(u.indexOf(",")+1)); }catch(e){ rej(e); } };
      img.onerror=function(){ URL.revokeObjectURL(url); rej(new Error("image illisible")); }; img.src=url; }); }
    // « Photos d'une sauvegarde ZIP » : lit les photos du fichier (déchiffrées au moment de la lecture), sans rien restaurer
    function bancZipPick(){
      var inp=document.createElement("input"); inp.type="file"; inp.accept="application/zip,.zip"; inp.multiple=true; inp.id="bcZipIn"; inp.style.display="none"; document.body.appendChild(inp);
      inp.onchange=function(){ var fs=inp.files ? [].slice.call(inp.files) : [], i=0, tot=0; try{ document.body.removeChild(inp); }catch(e){}
        function nx(){ if(i>=fs.length){ if(tot && state.banc && !state.banc.run) state.banc=null; render(); uiToast(tot ? tot+" photo"+(tot>1?"s":"")+" de ticket"+(tot>1?"s":"")+" prise"+(tot>1?"s":"")+" dans "+(fs.length>1?"les sauvegardes":"la sauvegarde") : "Aucune photo de tes tickets dans ce fichier"); return; }
          bancZipRead(fs[i++]).then(function(n){ tot+=n; nx(); }).catch(function(e){ var m=(e&&e.message)||String(e); if(m!=="annulé") window.alert("Sauvegarde illisible : "+m); nx(); }); }
        nx(); };
      inp.click();
    }
    function bancZipRead(file){
      var pr=uiProgress("Lecture de la sauvegarde…");
      return zipRead(file).then(function(Z){
        var d=Z["data.json"]; if(!d || d.m!==0) throw new Error("ce n'est pas une sauvegarde complète");
        return blobText(file.slice(d.o, d.o+d.s)).then(function(txt){ pr.close(); return encOpen(JSON.parse(txt)); }).then(function(X){
          var have={}, by={}, n=0, B=state.bancZip=state.bancZip||{};
          state.entries.forEach(function(e){ have[String(e.id)]=1; });
          ((X.obj && X.obj._zip)||[]).forEach(function(x){ var z=Z[x.p], id=String(x.id); if(!z || z.m!==0 || !have[id]) return;
            var P=by[id]||(by[id]={ o:!!x.o, b:[], ek:X.key||null }); P.b[x.n-1]=file.slice(z.o, z.o+z.s, x.t||"image/jpeg"); });
          Object.keys(by).forEach(function(id){ var P=by[id]; P.b=P.b.filter(function(x){ return x; }); if(!P.b.length) return;
            if(!B[id] || (P.o && !B[id].o)){ B[id]=P; n++; } });   // la photo d'origine l'emporte sur la petite
          return n;
        });
      }).catch(function(e){ pr.close(); throw e; });
    }
    function bancExport(){
      var B=state.banc; if(!B || !B.items.length) return;
      var bm=(document.querySelector('meta[name="build"]')||{}).content||"";
      var out={ banc:1, app:APP_NAME, build:bm, at:B.at, n:B.items.length, ok:B.items.filter(function(x){ return x.r.ok; }).length,
        tickets:B.items.map(function(x){ var e=x.e;
          return { enregistre:{ marchand:e.marchand||"", montant:num(e.montant), date:e.date||"", categorie:e.categorie||"", pay:e.pay||"", articles:(e.articles||[]).map(function(a){ return { lu:a.label||"", prix:a.prix, article:a.produit||"" }; }) },
            lu:x.p ? { marchand:x.p.marchand||"", total:x.p.total, date:x.p.date||"", articles:(x.p.lignes||[]).map(function(a){ return a.label+" | "+a.prix; }) } : null,
            ok:x.r, petite:x.sm||undefined, pages:x.parts.map(function(q){ var res=q.res||{}; return { lignes:q.t, width:res.width||0, height:res.height||0, morceaux:(res.lines||[]).map(function(l){ return { t:l.t, p:(l.p||[]).map(function(v){ return Math.round(v); }) }; }), err:q.err||undefined }; }) }; }) };
      saveFile(new Blob([JSON.stringify(out)], { type:"application/json" }), "banc-lecture-"+todayISO()+".json", { what:"Banc de lecture" });
    }
    function renderBanc(){
      var B=state.banc, pool=bancPool(), plug=!!capPlugin("TicketOcr");
      var h=header("list")+'<section class="paper">';
      h+='<div class="center muted" style="font-size:11px;letter-spacing:.18em;text-transform:uppercase">Tester la lecture</div><hr class="rule">';
      h+='<div class="muted" style="font-size:12px;line-height:1.5">Relit la photo d\'origine de tes tickets sur le téléphone (ML Kit), et compare à ce que tu as enregistré : magasin, total, date, articles. Avec les règles de lecture seules, comme pour un nouvel utilisateur. Rien n\'est modifié.</div>';
      if(!B || (!B.run && !B.items.length)){
        var nSm=pool.filter(bancSmall).length;
        h+='<div class="sto-tot" style="margin-top:14px"><b>'+pool.length+'</b> ticket'+(pool.length>1?"s":"")+' avec une photo, tous mois confondus</div>';
        if(nSm) h+='<div class="muted" style="font-size:12px;line-height:1.5">Dont '+nSm+' avec seulement une petite photo (tickets d\'avant le 3 novembre) : moins bien lus, comptés à part.</div>';
        var nZ=pool.filter(bancZ).length;
        if(nZ) h+='<div class="muted" style="font-size:12px;line-height:1.5" id="bcZn">'+nZ+' photo'+(nZ>1?"s":"")+' prise'+(nZ>1?"s":"")+' dans tes sauvegardes ZIP (rien n\'est restauré).</div>';
        if(!plug) h+='<div class="empty">Seulement dans l\'appli Android : la lecture se fait par ML Kit.</div>';
        else if(pool.length) h+='<button type="button" class="btn" id="bcGo" style="width:100%;margin-top:10px">Lancer le test</button>';
        else h+='<div class="empty">Aucun ticket n\'a encore de photo.</div>';
        if(plug) h+='<button type="button" class="btn ghost" id="bcZip" style="width:100%;margin-top:8px">📦 Photos d\'une sauvegarde ZIP</button><div class="muted" style="font-size:11px;margin-top:6px;line-height:1.5">Les photos de tes anciens tickets, prises dans une sauvegarde complète (OneDrive, Drive, Documents…) : rien n\'est restauré ni modifié, elles servent seulement au test. Tu peux en choisir plusieurs.</div>';
      } else if(B.run){
        h+='<div class="sto-tot" style="margin-top:14px" id="bcProg">Lecture '+Math.min(B.i+1, B.n)+'/'+B.n+'…</div><div class="sto-bar"><i id="bcBar" style="width:'+Math.round(B.i*100/Math.max(1,B.n))+'%"></i></div>';
        h+='<button type="button" class="btn ghost" id="bcStop" style="width:100%;margin-top:10px">Arrêter</button>';
      } else {
        var big=B.items.filter(function(x){ return !x.sm; }), sml=B.items.filter(function(x){ return x.sm; });
        var ok=big.filter(function(x){ return x.r.ok; }), bad=big.filter(function(x){ return !x.r.ok; }), smOk=sml.filter(function(x){ return x.r.ok; }).length;
        h+='<div class="sto-tot" style="margin-top:14px" id="bcRes"><b>'+big.length+'</b> ticket'+(big.length>1?"s":"")+' · <b style="color:var(--accent)">'+ok.length+' bien lu'+(ok.length>1?"s":"")+'</b>'+(bad.length?' · <b style="color:var(--coral)">'+bad.length+' à revoir</b>':'')+'</div>';
        if(sml.length) h+='<div class="muted" style="font-size:12px" id="bcSm">Petites photos (avant le 3 novembre) : '+smOk+' bien lu'+(smOk>1?"s":"")+' sur '+sml.length+'</div>';
        var cnt=function(k){ return big.filter(function(x){ return x.r[k]===false; }).length; };
        h+='<div class="muted" style="font-size:12px">Erreurs : total '+cnt("total")+' · magasin '+cnt("marchand")+' · date '+cnt("date")+' · articles '+cnt("arts")+'</div>';
        bad.forEach(function(x){ var e=x.e, p=x.p||{}, w=[];
          if(x.r.err) w.push("photo illisible");
          else { if(!x.r.total) w.push("total "+(p.total===""?"—":fmtK(num(p.total)))); if(!x.r.marchand) w.push("magasin « "+(p.marchand||"—")+" »"); if(!x.r.date) w.push("date "+(p.date?csvDate(p.date):"—"));
            if(x.r.arts===false) w.push((p.lignes||[]).length+" article"+((p.lignes||[]).length>1?"s":"")+" lu"+((p.lignes||[]).length>1?"s":"")+" sur "+bancArts(e).length); }
          h+='<div class="sto-row bc-bad"><span>'+esc(e.marchand||"Ticket")+'<br><small class="muted">'+esc(csvDate(e.date)+" · "+fmtK(num(e.montant)))+'</small></span><b style="color:var(--coral);white-space:normal;text-align:right">'+esc(w.join(" · "))+'</b></div>'; });
        h+='<button type="button" class="btn" id="bcExp" style="width:100%;margin-top:14px">Exporter pour améliorer la lecture</button>';
        h+='<button type="button" class="btn ghost" id="bcGo" style="width:100%;margin-top:8px">Relancer</button>';
        h+='<button type="button" class="btn ghost" id="bcZip" style="width:100%;margin-top:8px">📦 Photos d\'une sauvegarde ZIP</button>';
        h+='<div class="muted" style="font-size:11px;margin-top:10px;line-height:1.5">Le fichier contient ce que le téléphone a lu et tes tickets enregistrés (sans les photos). Envoie-le seulement pour faire améliorer la lecture.</div>';
      }
      h+='</section>'; app.innerHTML=h; setNav(null,false);
      bindBack(function(){ if(state.banc && state.banc.run) state.banc.stop=true; state.view="list"; render(); });
      var g=document.getElementById("bcGo"); if(g) g.onclick=bancRun;
      var st=document.getElementById("bcStop"); if(st) st.onclick=function(){ B.stop=true; };
      var ex=document.getElementById("bcExp"); if(ex) ex.onclick=bancExport;
      var zb=document.getElementById("bcZip"); if(zb) zb.onclick=bancZipPick;
    }
    function ocrRawSheet(t0, ttl, intro){
      var t=(typeof t0==="string" && t0) || ocrRawText(); if(!t) return;
      var s=uiSheet('<div class="sheet-title">'+esc(typeof ttl==="string" ? ttl : "Lecture du ticket")+'</div><div class="ui-intro">'+esc(typeof intro==="string" ? intro : "Le texte que le téléphone a lu sur la photo. Colle-le avec la photo pour faire corriger la lecture. Tout ce qui est imprimé sur le ticket y est ; l'appli n'envoie rien elle-même.")+'</div>'+
        '<textarea class="f" id="ocrTxt" readonly style="width:100%;height:38vh;font-size:11px;line-height:1.35;font-family:ui-monospace,monospace">'+esc(t)+'</textarea>'+
        '<div class="ui-stack" style="margin-top:10px"><button type="button" class="btn primary" id="ocrCopy">Copier</button><button type="button" class="btn" id="ocrShare">Partager…</button><button type="button" class="btn ghost" id="ocrNo">Fermer</button></div>');
      s.q("#ocrCopy").onclick=function(){ var ta=s.q("#ocrTxt");
        function fb(){ try{ ta.removeAttribute("readonly"); ta.select(); document.execCommand("copy"); ta.setAttribute("readonly",""); uiToast("Lecture copiée"); }catch(e){ uiToast("Copie impossible : sélectionne le texte"); } }
        try{ navigator.clipboard.writeText(t).then(function(){ uiToast("Lecture copiée · colle-la dans la conversation"); }, fb); }catch(e){ fb(); } };
      s.q("#ocrShare").onclick=function(){ var SH=capPlugin("Share");
        if(SH) SH.share({ title:"Lecture du ticket", text:t }).catch(function(){}); else if(navigator.share) navigator.share({ title:"Lecture du ticket", text:t }).catch(function(){}); else uiToast("Partage indisponible : utilise « Copier »"); };
      s.q("#ocrNo").onclick=s.close;
    }
    function fileToThumb(file, cb){
      try{
        var r=new FileReader();
        r.onload=function(){
          var img=new Image();
          img.onload=function(){
            var max=600, w=img.width||1, hh=img.height||1, sc=Math.min(1, max/Math.max(w,hh));
            var cw=Math.max(1,Math.round(w*sc)), ch=Math.max(1,Math.round(hh*sc));
            var cv=document.createElement("canvas"); cv.width=cw; cv.height=ch;
            cv.getContext("2d").drawImage(img,0,0,cw,ch);
            try{ cb(cv.toDataURL("image/jpeg",0.5)); }catch(e){ cb(""); }
          };
          img.onerror=function(){ cb(""); };
          img.src=r.result;
        };
        r.onerror=function(){ cb(""); };
        r.readAsDataURL(file);
      }catch(e){ cb(""); }
    }
    var photoin=document.getElementById("photoin");
    if(photoin) photoin.onchange=function(ev){
      var f=ev.target.files&&ev.target.files[0]; ev.target.value="";
      if(!f || !state.draft) return;
      fileToThumb(f, function(t){ if(!state.draft) return; if(t){ state.draft.photo=t; state.draft.photoFiles=[f]; render(); } else window.alert("Image illisible."); });
    };

    var PHOTOS={}, _db=null, idbReady=false;
    var IDB=(typeof indexedDB!=="undefined")?indexedDB:null;
    function idbOpen(){
      return new Promise(function(res,rej){
        if(_db){ res(_db); return; }
        if(!IDB){ rej(new Error("no-idb")); return; }
        try{ var rq=IDB.open("ticketsdb",2);
          rq.onupgradeneeded=function(){ var db=rq.result; if(!db.objectStoreNames.contains("photos")) db.createObjectStore("photos"); if(!db.objectStoreNames.contains("orig")) db.createObjectStore("orig"); };
          rq.onsuccess=function(){ _db=rq.result; res(_db); };
          rq.onerror=function(){ rej(rq.error); };
        }catch(e){ rej(e); }
      });
    }
    function idbAll(){
      return idbOpen().then(function(db){ return new Promise(function(res){
        var out={};
        try{ var cur=db.transaction("photos","readonly").objectStore("photos").openCursor();
          cur.onsuccess=function(){ var c=cur.result; if(c){ out[c.key]=c.value; c.continue(); } else res(out); };
          cur.onerror=function(){ res(out); };
        }catch(e){ res(out); }
      }); });
    }
    function idbPut(id,val){ return idbOpen().then(function(db){ return new Promise(function(res){ try{ var tx=db.transaction("photos","readwrite"); tx.objectStore("photos").put(val,String(id)); tx.oncomplete=function(){res(true);}; tx.onerror=function(){res(false);}; }catch(e){ res(false); } }); }).catch(function(){ return false; }); }
    function idbDel(id){ return idbOpen().then(function(db){ return new Promise(function(res){ try{ var tx=db.transaction("photos","readwrite"); tx.objectStore("photos").delete(String(id)); tx.oncomplete=function(){res(true);}; tx.onerror=function(){res(false);}; }catch(e){ res(false); } }); }).catch(function(){ return false; }); }
    // photo d'un ticket : seulement une vraie image en base64 (08/11, revue C2 : sinon du code pouvait se glisser dans <img src="…">)
    var PH_RE=/^data:image\/(?:jpeg|jpg|png|webp|gif);base64,[A-Za-z0-9+\/=]+$/;
    function phSafe(u){ return (typeof u==="string" && PH_RE.test(u)) ? u : ""; }
    function photoOf(e){ return phSafe(PHOTOS[String(e.id)]) || phSafe(e.photo); }
    function initPhotos(){
      var migr=[];
      state.entries.forEach(function(e){ if(typeof e.photo==="string" && e.photo.indexOf("data:")===0){ if(phSafe(e.photo)) migr.push(e); else e.photo=false; } });
      var chain=Promise.resolve();
      if(migr.length && IDB){
        migr.forEach(function(e){ chain=chain.then(function(){ return idbPut(e.id, e.photo).then(function(ok){ if(ok){ PHOTOS[String(e.id)]=e.photo; e.photo=true; } }); }); });
        chain=chain.then(function(){ persist(); });
      }
      chain.then(function(){ return IDB?idbAll():{}; }).then(function(map){ for(var k in map){ if(phSafe(map[k])) PHOTOS[k]=map[k]; } return IDB?origSizes():{}; })
        .then(function(sz){ ORIGSZ=sz||{}; photoKeepApply(); idbReady=true; render(); }).catch(function(){ idbReady=true; });
      // photos d'origine : demander au navigateur de ne pas effacer le stockage de l'appli quand le téléphone manque de place
      try{ if(navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function(){}); }catch(e){}
    }
