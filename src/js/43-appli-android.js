    // ---------- Appli Android (Capacitor) : lecture ML Kit sur le téléphone ----------
    function capNative(){ try{ var C=window.Capacitor; return !!(C && C.isNativePlatform && C.isNativePlatform()); }catch(e){ return false; } }
    // Appli Store complète : la page est dans l'APK (https://localhost), rien n'est chargé en ligne
    function appLocal(){ return location.protocol==="https:" && location.hostname==="localhost" && capNative(); }
    // Lecteur de tickets du navigateur (Tesseract) : chargé seulement s'il sert (dans l'appli, ML Kit lit sur le téléphone)
    var tessP=null;
    // Moteur, données de langue et worker pris dans l'appli (lib/tesseract), jamais sur un autre site
    function tessOpts(o){ var b=new URL("./lib/tesseract/", location.href).href; o.workerPath=b+"worker.min.js"; o.corePath=b+"core"; o.langPath=b+"lang"; return o; }
    function loadTesseract(){
      if(typeof Tesseract!=="undefined") return Promise.resolve(true);
      if(appLocal() || location.protocol==="file:") return Promise.resolve(false);   // un worker ne se charge pas depuis un fichier local
      if(tessP) return tessP;
      tessP=new Promise(function(res){
        var sc=document.createElement("script"), done=false, to=setTimeout(function(){ fin(false); }, 30000);
        function fin(ok){ if(done) return; done=true; clearTimeout(to); ok=ok && typeof Tesseract!=="undefined"; if(!ok) tessP=null; res(ok); }
        sc.onload=function(){ fin(true); }; sc.onerror=function(){ fin(false); };
        sc.src="./lib/tesseract/tesseract.min.js"; document.head.appendChild(sc);   // dans l'appli, version figée (07/11, workflow deps : lib/VERSIONS.txt)
      });
      return tessP;
    }
    var capPlugs={};
    function capPlugin(name){
      if(!capNative()) return null;
      if(!(name in capPlugs)){ try{ var C=window.Capacitor; capPlugs[name]=(C.Plugins && C.Plugins[name]) || (C.registerPlugin ? C.registerPlugin(name) : null); }catch(e){ capPlugs[name]=null; } }
      return capPlugs[name];
    }
    // Photo d'origine (en couleurs, ML Kit lit mieux sans retouche), réduite à 2200 px, en JPEG base64
    function nativeImage(file){
      return new Promise(function(resolve, reject){
        function draw(src, w, h){ var lo=Math.max(w,h), k=lo>2200?2200/lo:1, c=document.createElement("canvas"); c.width=Math.max(1,Math.round(w*k)); c.height=Math.max(1,Math.round(h*k));
          c.getContext("2d").drawImage(src,0,0,c.width,c.height); var u=c.toDataURL("image/jpeg",0.9); resolve(u.slice(u.indexOf(",")+1)); }
        function viaImg(){ var img=new Image(); img.onload=function(){ try{ draw(img, img.naturalWidth||img.width, img.naturalHeight||img.height); }catch(e){ reject(e); } }; img.onerror=function(){ reject(new Error("image illisible")); }; img.src=URL.createObjectURL(file); }
        try{ if(self.createImageBitmap) createImageBitmap(file).then(function(b){ try{ draw(b,b.width,b.height); try{ b.close(); }catch(e){} }catch(e){ viaImg(); } }).catch(viaImg); else viaImg(); }
        catch(e){ viaImg(); }
      });
    }
    // ML Kit rend des morceaux de texte (souvent le libellé et le prix séparément) :
    // on redresse la photo d'après l'inclinaison moyenne, puis on regroupe les morceaux
    // qui sont à la même hauteur pour retrouver les lignes du ticket, de gauche à droite.
    function mlkitRows(res){
      var L=[];
      (res && res.lines || []).forEach(function(l){ if(!l || !l.t) return; var q=l.p; if(!q || q.length<8) return; L.push({ t:String(l.t), q:q }); });
      if(!L.length) return (res && res.text) || "";
      var ang=L.map(function(l){ return Math.atan2(l.q[3]-l.q[1], l.q[2]-l.q[0]); }).sort(function(a,b){ return a-b; });
      var a=ang[Math.floor(ang.length/2)]||0;   // même tournée d'un quart de tour ou à l'envers : on redresse
      var ca=Math.cos(-a), sa=Math.sin(-a);
      L.forEach(function(l){ var xs=[], ys=[]; for(var i=0;i<8;i+=2){ xs.push(l.q[i]*ca-l.q[i+1]*sa); ys.push(l.q[i]*sa+l.q[i+1]*ca); }
        l.x=Math.min.apply(null,xs); var y0=Math.min.apply(null,ys), y1=Math.max.apply(null,ys); l.h=Math.max(1,y1-y0); l.cy=(y0+y1)/2; });
      var hs=L.map(function(l){ return l.h; }).sort(function(a,b){ return a-b; }), mh=hs[Math.floor(hs.length/2)]||10;
      L.sort(function(a,b){ return a.cy-b.cy; });
      var rows=[];
      L.forEach(function(l){ var r=rows[rows.length-1];
        if(r && Math.abs(l.cy-r.cy)<mh*0.6){ r.it.push(l); r.cy=(r.cy*(r.it.length-1)+l.cy)/r.it.length; }
        else rows.push({ cy:l.cy, it:[l] }); });
      return rows.map(function(r){ return r.it.sort(function(a,b){ return a.x-b.x; }).map(function(i){ return i.t; }).join("  "); }).join("\n");
    }
    // Sauvegarde dans l'appli Android : fichier dans Documents/Tickets, ou envoi vers Drive / mail
    function backupNative(dump, fname){
      var FS=capPlugin("Filesystem"), SH=capPlugin("Share"), json=JSON.stringify(dump);
      function ok(msg){ store.write("lastBackup", new Date().toISOString()); uiToast(msg); if(state.view==="list") setTimeout(render, 50); }
      function toPhone(){
        FS.writeFile({ path:""+APP_NAME+"/"+fname, data:json, directory:"DOCUMENTS", encoding:"utf8", recursive:true })
          .then(function(){ ok("Sauvegardé dans Documents/"+APP_NAME+" ✓"); })
          .catch(function(e){ window.alert("Sauvegarde impossible dans Documents : "+((e&&e.message)||e)+"\nEssaie « Envoyer vers… »."); });
      }
      function toShare(){
        FS.writeFile({ path:fname, data:json, directory:"CACHE", encoding:"utf8" })
          .then(function(r){ return SH.share({ title:"Sauvegarde "+APP_NAME+"", files:[r.uri] }); })
          .then(function(){ ok("Sauvegarde envoyée ✓"); })
          .catch(function(e){ var m=(e&&e.message)||String(e); if(!/cancel|annul/i.test(m)) window.alert("Envoi impossible : "+m); });
      }
      if(!SH){ toPhone(); return; }
      uiChoice("Sauvegarder mes données", "Garde le fichier sur le téléphone, ou envoie-le vers Google Drive, un mail…", [
        { l:"Sur le téléphone (Documents/"+APP_NAME+")", fn:toPhone },
        { l:"Envoyer vers… (Drive, mail)", fn:toShare }
      ]);
    }
    filein.onchange=function(ev){
      var files=ev.target.files ? [].slice.call(ev.target.files) : []; ev.target.value="";
      if(!files.length) return;
      state.busy=true; state.prog=0; state.note=""; state.ocrRaw=null;
      state.scanMsg = files.length>1 ? ("Lecture 1/"+files.length+"…") : (capPlugin("TicketOcr") ? "Lecture du ticket sur le téléphone…" : "Lecture du ticket en cours…");
      state.draftRO=false; state.draft={id:null,montant:"",date:todayISO(),marchand:"",categorie:"",articles:[],payePar:fyDefPayer(),photo:""};
      grpDraftHook(); state.view="form"; render();
      state.draft.photoFiles=files.slice(0, 6);   // photo d'origine (toutes les pages), gardée à l'enregistrement
      if(files[0]) fileToThumb(files[0], function(t){ if(t && state.draft && state.view==="form"){ state.draft.photo=t; render(); } });
      function tessText(src){ return Tesseract.recognize(src, "fra+eng", tessOpts({ logger:function(m){
          if(m.status==="recognizing text"){ state.prog=Math.round(m.progress*100); var bar=document.getElementById("bar"); if(bar) bar.style.width=state.prog+"%"; }
        }})).then(function(r){ return (r.data&&r.data.text)||""; }); }
      var diag=[];
      function localOne(src){ return loadTesseract().then(function(ok){ if(!ok){ diag.push("local:absent"); return ""; } return tessText(src).then(function(t){ diag.push("local:"+(t||"").length); return t; }); }); }
      var lastRes=null, raws=[];   // ce que ML Kit a rendu (morceaux et positions), pour « Copier la lecture »
      function ocrOne(file){
        var plug=capPlugin("TicketOcr"); lastRes=null;
        if(!plug) return ocrClassic(file);
        return nativeImage(file).then(function(b64){ return plug.recognize({ image:b64 }); }).then(function(res){
          lastRes=res||null;
          var t=mlkitRows(res||{}); diag.push("mlkit:"+((res&&res.lines)||[]).length+" morceaux");
          if(t && t.replace(/\s/g,"").length>=8) return t;
          throw new Error("lecture vide");
        }).catch(function(e){ diag.push("mlkit KO("+((e&&e.message)||e)+")"); return ocrClassic(file); });
      }
      function ocrClassic(file){
        return preprocess(file).then(function(src){
          if(!(src && src.toBlob)) diag.push("preproc-KO");
          return localOne(src);
        });
      }
      var texts=[], idx=0;
      function step(){
        if(idx>=files.length){
          var p=parseTicket(texts.join("\n")), tkL=texts.join("\n").split(/\n/).map(function(l){ return l.trim(); }).filter(Boolean), tkMg=tkMagFind(tkL);
          if(tkMg && tkMg!==p.marchand){ p.marchand=tkMg; p.categorie=ticketCat(tkMg, texts.join("\n"), p.categorie==="Carburant"); }   // ce magasin (SIRET, téléphone) : le nom que tu lui as donné
          var tkA=(store.read("tkAppris", {})||{})[norm(p.marchand||"")], tkLearnt=false;
          if(tkA && tkA.amt){ var tv=factAnchorFind(tkL, "tamt", tkA.amt); if(tv>0){ p.total=tv; tkLearnt=true;   // ce magasin : le total lu au même endroit que la dernière fois
            var aw=" "+tkA.amt.a+" "; p.lignes=(p.lignes||[]).filter(function(a){ return !(Math.abs(num(a.prix)-tv)<0.005 && aw.indexOf(" "+norm(a.label)+" ")>=0); }); } }   // et sa ligne n'est pas un article
          state.draft.scan={ lines:tkL, four:p.marchand||"", total:p.total, carte:p.carte, tva:p.tva, learnt:tkLearnt, esp:p.esp, nbArt:p.nbArt, nbLu:p.nbLu, nLines:p.nLines, mag:!!tkMg,
            date:p.date||"", arts:(p.lignes||[]).map(function(a){ return a.label+" | "+a.prix; }) };
          state.draft.montant = (p.total==="")?"":String(p.total).replace(".",",");
          state.draft.date = p.date || state.draft.date;
          state.draft.marchand = p.marchand || state.draft.marchand;
          state.draft.categorie = p.categorie;
          if(state.draft.id==null && !state.draft.pay && !p.carte){ var cw=tkCashWord(tkL); if(cw){ state.draft.pay="esp"; state.draft.payRead=cw; var cwA=tkLiqAcct(state.draft); state.draft.liqOn=!!(tkLiqCan(cwA) && tkLiqAvail(state.draft, cwA)!=null); } }   // payé en espèces (18/11)
          var who=payerOf(state.draft);
          state.draft.articles = (p.lignes||[]).map(function(a){ if(a.remise) return {label:a.label, prix:a.prix, produit:"Remise"}; var pr=lookupAppris(a.label, who); return {label:a.label, prix:a.prix, produit:pr, auto:!!pr}; });
          var hasData = state.draft.montant || (state.draft.articles && state.draft.articles.length);
          var eng = diag.some(function(d){ return /^mlkit:/.test(d); }) ? "sur le téléphone (ML Kit)" : (diag.some(function(d){ return /^cloud \d/.test(d); }) ? "par OCR.space" : "par Tesseract");
          var ko = diag.filter(function(d){ return /KO/.test(d); }).join(" · ");
          state.note = hasData ? ("Lu "+eng+(ko?" — "+ko:"")+" · vérifie les montants"+(p.dateFix?" · année de la date corrigée en "+p.date.slice(0, 4):"")) : ("Lecture vide ["+diag.join(" · ")+"]. Réessaie avec une photo plus nette, ou recadrée sur le ticket.");
          state.ocrRaw={ eng:eng, diag:diag.join(" · "), parts:raws };
          state.busy=false; state.scanMsg=""; render(); return;
        }
        if(files.length>1){ var sm=document.getElementById("scanmsg"); if(sm) sm.textContent="Lecture "+(idx+1)+"/"+files.length+"…"; state.prog=0; var bar=document.getElementById("bar"); if(bar) bar.style.width="0%"; }
        ocrOne(files[idx]).then(function(t){ texts.push(t||""); raws.push({ t:t||"", res:lastRes }); idx++; step(); })
          .catch(function(e){ console.warn("OCR indisponible:", e); texts.push(""); idx++; step(); });
      }
      step();
    };

    // Ce que le téléphone a lu sur la photo (lignes reconstituées, puis chaque morceau avec ses coins),
    // à copier ou partager pour faire corriger la lecture. Rien n'est envoyé par l'appli.
    function ocrRawText(){
      var R=state.ocrRaw; if(!R) return "";
      var bm=document.querySelector('meta[name="build"]'), L=["Lecture d'un ticket · "+APP_NAME+" "+(bm?bm.content:"")+" · "+R.eng+(R.diag?" · "+R.diag:"")];
      R.parts.forEach(function(p, i){
        if(R.parts.length>1) L.push("", "=== Photo "+(i+1)+" ===");
        L.push("--- Lignes lues ---", p.t||"(rien)");
        var ls=(p.res && p.res.lines) || [];
        if(ls.length){ L.push("--- Morceaux (texte | coins x,y) ---"+(p.res.width?" photo "+p.res.width+"x"+p.res.height:""));
          ls.forEach(function(l){ if(l && l.t) L.push(String(l.t).replace(/\s+/g," ")+" | "+(l.p||[]).map(function(v){ return Math.round(v); }).join(",")); }); }
      });
      return L.join("\n");
    }
    // « Signaler une lecture » (18/11) : ce qui a été lu, ce que tu as corrigé, et la lecture complète, à coller pour faire corriger la lecture
    function tkReportSheet(){
      readForm(); var d=state.draft, S=d.scan||{}, L=[], v=function(x){ return String(x==null?"":x).trim()||"—"; };
      L.push("Signalement de lecture · "+APP_NAME+" "+((document.querySelector('meta[name="build"]')||{}).content||""));
      L.push("--- Lu → corrigé ---");
      L.push("Montant : "+v(S.total===""?"":String(S.total).replace(".", ","))+" → "+v(d.montant));
      L.push("Magasin : "+v(S.four)+" → "+v(d.marchand));
      L.push("Date : "+v(S.date)+" → "+v(d.date));
      L.push("Articles lus ("+(S.arts||[]).length+") :"); (S.arts||[]).forEach(function(a){ L.push("  "+a); });
      L.push("Articles enregistrés ("+(d.articles||[]).length+") :"); (d.articles||[]).forEach(function(a){ L.push("  "+v(a.label)+" | "+v(a.prix)+" → "+v(a.produit)); });
      if(S.nbArt) L.push("Nombre d'articles annoncé : "+S.nbArt+" · lus : "+S.nbLu);
      ocrRawSheet(L.join("\n")+"\n\n"+ocrRawText(), "Signaler une lecture", "Ce qui a été lu, ce que tu as corrigé, puis la lecture complète. Colle-le avec la photo pour faire corriger la lecture ; l\'appli n\'envoie rien elle-même.");
    }
