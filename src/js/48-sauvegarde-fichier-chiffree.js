    // ---------- Sauvegarde fichier chiffrée (08/11, revue M6) ----------
    // Au choix, avec le code de secours (celui de Drive et du foyer) : data.json devient { _app, _enc:1, kf, v } (v = la sauvegarde
    // chiffrée comme sur Drive, clé tirée du code par HKDF « file ») ; dans le ZIP, chaque photo est chiffrée à part (.enc).
    function fileKeys(sec){ return Promise.all([fyHkdf(sec, "file", 32), fyHkdf(sec, "file-kf", 9)]).then(function(a){ return { key:fyB64u(a[0]), kf:fyB64u(a[1]) }; }); }
    function encBlob(b, key){ return Promise.all([fyAes(key), new Response(b).arrayBuffer()]).then(function(a){ var iv=randBytes(12);
      return crypto.subtle.encrypt({ name:"AES-GCM", iv:iv }, a[0], a[1]).then(function(ct){ return new Blob([iv, ct], { type:"application/octet-stream" }); }); }); }
    function decBlob(b, key, type){ return Promise.all([fyAes(key), new Response(b).arrayBuffer()]).then(function(a){ var u=new Uint8Array(a[1]);
      return crypto.subtle.decrypt({ name:"AES-GCM", iv:u.slice(0,12) }, a[0], u.slice(12)).then(function(pt){ return new Blob([pt], { type:type||"image/jpeg" }); }); }); }
    // code de secours demandé pour ouvrir une sauvegarde chiffrée → Promise({ sec, key })
    function encAskCode(kf){
      return new Promise(function(res, rej){
        var sec0=drvSec(), tried=sec0 ? fileKeys(sec0).then(function(k){ return k.kf===kf ? { sec:sec0, key:k.key } : null; }) : Promise.resolve(null);
        tried.then(function(hit){ if(hit){ res(hit); return; }
          uiForm({ title:"Sauvegarde chiffrée", intro:"Cette sauvegarde est chiffrée. Tape ton code de secours (26 caractères) pour l'ouvrir.",
            fields:[{ key:"c", label:"Code de secours", placeholder:"XXXX-XXXX-XXXX-…", required:true }], ok:"Ouvrir", onCancel:function(){ rej(new Error("annulé")); } }, function(r, api){
            var sec=fyUnb32(r.c); if(sec.length!==16) return "Code incomplet : il fait 26 caractères (lettres et chiffres 2 à 7).";
            fileKeys(sec).then(function(k){ if(k.kf!==kf){ api.error("Ce code n'ouvre pas cette sauvegarde."); return; } api.close(); res({ sec:sec, key:k.key }); });
            return false; });
        });
      });
    }
    function encOpen(obj){   // sauvegarde lue : déchiffrée si besoin → Promise({ obj, key, sec })
      if(!obj || obj._enc!==1) return Promise.resolve({ obj:obj });
      return encAskCode(obj.kf).then(function(k){ return fyOpen(k.key, obj.v).then(function(d){ return { obj:d, key:k.key, sec:k.sec }; }); });
    }
    function backupData(mode, enc){
      if(typeof mode!=="string") mode="";
      if(!mode && fyMember()){ drvMemberSheet(); return; }
      if(mode!=="data" && mode!=="full" && !fyMember()){ backupMenu(); return; }
      var dump=backupDump();
      // deux sauvegardes : complète (ZIP : données + photos d'origine) ou données seules (petit fichier JSON, sans photos)
      var nph=photoEntries().length;
      if(mode!=="data" && mode!=="full"){
        if(nph){ uiChoice("Sauvegarder", esc("La sauvegarde complète garde aussi les photos des tickets, en qualité d'origine. Les données seules font un petit fichier, sans photos."), [
            { l:"Sauvegarde complète · données + "+nph+" photo"+(nph>1?"s":"")+" ("+fmtBytes(photosBytes()+dataBytes())+")", fn:function(){ backupData("full"); } },
            { l:"Données seules · fichier léger", primary:false, fn:function(){ backupData("data"); } } ]); return; }
        mode="data";
      }
      var sec=drvSec();
      if(sec && enc===undefined){
        uiChoice("Chiffrer la sauvegarde ?", esc("Chiffrée, personne ne peut lire le fichier sans ton code de secours (26 caractères), même si tu l'envoies par mail ou sur un Drive. Sans chiffrement, il se lit comme un texte."), [
          { l:"🔒 Chiffrée avec mon code de secours (conseillé)", fn:function(){ backupData(mode, true); } },
          { l:"Sans chiffrement", primary:false, fn:function(){ backupData(mode, false); } } ]);
        return;
      }
      if(sec && enc){
        fileKeys(sec).then(function(k){
          if(mode==="full"){ backupZip(dump, k); return; }
          return fySeal(k.key, dump).then(function(v){ backupData._enc={ _app:"tickets", _enc:1, _date:dump._date, kf:k.kf, v:v }; try{ backupData("data", false); } finally { backupData._enc=null; } });
        }).catch(function(e){ window.alert("Sauvegarde impossible : "+((e&&e.message)||e)); });
        return;
      }
      if(backupData._enc) dump=backupData._enc;
      if(mode==="full"){ backupZip(dump); return; }
      var fname="tickets-sauvegarde-"+todayISO()+(dump._enc?"-chiffree":"")+".json";
      if(capPlugin("Filesystem")){ backupNative(dump, fname); return; }
      try{
        var blob=new Blob([JSON.stringify(dump)], {type:"application/json"});
        var fileObj=null; try{ fileObj=new File([blob], fname, {type:"application/json"}); }catch(e){}
        if(fileObj && navigator.canShare && navigator.canShare({files:[fileObj]}) && !backupData._forceDl){
          uiChoice("Sauvegarder mes données", "Envoie le fichier vers Google Drive, un mail… ou garde-le sur le téléphone.", [
            {l:"Envoyer vers… (Drive, mail)", fn:function(){ navigator.share({ files:[fileObj], title:"Sauvegarde "+APP_NAME+"" }).then(function(){ store.write("lastBackup", new Date().toISOString()); uiToast("Sauvegarde envoyée ✓"); render(); }).catch(function(){}); }},
            {l:"Télécharger sur le téléphone", fn:function(){ var ed=dump._enc?dump:null; backupData._forceDl=true; backupData._enc=ed; try{ backupData("data", false); } finally { backupData._forceDl=false; backupData._enc=null; } }}
          ]);
          return;
        }
        var url=URL.createObjectURL(blob);
        var a=document.createElement("a");
        a.href=url; a.download=fname;
        document.body.appendChild(a); a.click();
        store.write("lastBackup", new Date().toISOString());
        uiToast("Sauvegarde téléchargée ✓"); if(state.view==="list") setTimeout(render, 50);
        setTimeout(function(){ try{ document.body.removeChild(a); }catch(e){} URL.revokeObjectURL(url); }, 1500);
      }catch(e){ window.alert("Sauvegarde impossible : "+((e&&e.message)||e)); }
    }
    function restoreData(file){
      if(fyMember()){ uiToast("Tes données viennent du foyer : quitte le foyer avant de restaurer une sauvegarde"); return; }
      if(/\.zip$/i.test(file.name||"") || /zip/i.test(file.type||"")){ restoreZip(file); return; }
      var r=new FileReader();
      r.onload=function(){
        var o0; try{ o0=JSON.parse(r.result); }catch(e){ window.alert("Fichier invalide : "+((e&&e.message)||e)); return; }
        encOpen(o0).then(function(x){ restoreApply(x.obj, null, x.sec ? { sec:x.sec } : undefined); })
          .catch(function(e){ var m=(e&&e.message)||String(e); if(m!=="annulé") window.alert("Fichier invalide : "+m); });
      };
      r.onerror=function(){ window.alert("Lecture du fichier impossible."); };
      r.readAsText(file);
    }
    // Remet les données d'une sauvegarde (JSON, ou data.json d'une sauvegarde complète) ; more() remet ensuite les photos du ZIP
    // o.quiet : sans question ni message (restauration Drive, confirmée avant) ; o.exact : les données absentes de la sauvegarde sont retirées
    function restoreApply(obj, more, o){
      o=o||{};
      if(DEMO){ uiToast("Pas en démo : quitte la démo pour restaurer tes données"); return; }
      var data=(obj && obj.data && typeof obj.data==="object") ? obj.data : obj;
      if(!data || typeof data!=="object") throw new Error("format non reconnu");
      var n=(data.entries && data.entries.length) ? data.entries.length : 0, np={};
      (obj._zip||[]).forEach(function(x){ np[x.id]=1; });
      np=Object.keys(np).length;
      var bad=[];
      if(!o.quiet && !window.confirm("Restaurer cette sauvegarde ?\n"+n+" ticket(s)"+(np?" et "+np+" photo(s)":"")+" vont REMPLACER les données actuelles.")) return;
      ["entries","cats","catParent","taxoV3","taxoV4","familles","produits","familleDe","appris","fraisCommuns","argentMois","liquideMois","budgets","bourseHist","virements","virRec","soldeInit","provisions","factures","factAlias","factAppris","releve","tkAppris","tkMag","photoKeep","commRemb","groupes","epargne","bourse","ocrKey","offlineReady","taxoV2","simThreshold","virEpV2","comptes","devise","personnes","cptChartDef","comChartDef","anChartDef","artChartDef","bView","bChartMode","cptRange","adRange","compteSel","communParts","homeScope","budgetsP","commBalFrom","comProd","cptLiq","anFrais"].forEach(function(k){
        if(k in data){ var v=dataClean(k, data[k]); if(v!==undefined) store.write(k, v); else bad.push(k); }   // forme contrôlée (01a-donnees.js)
        else if(o.exact) store.remove(k);
      });
      if(!("comptes" in data)) store.write("comptes", null);
      if(!("communParts" in data)) store.write("communParts", null);   // ancienne sauvegarde : parts égales   // ancienne sauvegarde : le compte est reconstruit au redémarrage
      store.write("askName", false);
      dataMigReset(data);   // sauvegarde d'avant une migration : elle repasse au redémarrage (liste dans 01a-donnees.js)
      if(bad.length) try{ console.warn("sauvegarde : laissé de côté (forme inattendue)", bad); }catch(e){}
      var photos=(obj && obj.photos && typeof obj.photos==="object") ? obj.photos : null;
      var fyStep=function(){
        if(!data.fyBk || fyCfg) return Promise.resolve();   // ce téléphone a déjà un foyer : on le garde tel quel
        var secs=[o.sec, drvSec()];
        return fyBkRestore(data.fyBk, secs).then(function(ok){
          if(ok || o.quiet) return;
          return new Promise(function(res){   // fichier restauré ailleurs : le code de secours rend aussi le foyer
            uiForm({ title:"Ton foyer partagé", intro:"Cette sauvegarde contient ton foyer partagé. Tape ton code de secours (26 caractères) pour le retrouver : tes membres garderont leur accès. Sans le code, seules tes données sont restaurées.",
              fields:[{ key:"c", label:"Code de secours", placeholder:"XXXX-XXXX-XXXX-…", required:true }], ok:"Retrouver le foyer", cancel:"Sans le foyer", onCancel:function(){ res(); } }, function(r, api){
              var sec=fyUnb32(r.c); if(sec.length!==16) return "Code incomplet : il fait 26 caractères (lettres et chiffres 2 à 7).";
              fyBkRestore(data.fyBk, [sec]).then(function(ok2){ if(!ok2){ api.error("Ce code n'ouvre pas ce foyer : vérifie-le."); return; } api.close(); res(); });
              return false;
            });
          });
        });
      };
      // sans la question, un court délai laisse le navigateur enregistrer les données avant de recharger
      function finishRestore(){ if(!o.quiet){ window.alert("Sauvegarde restaurée ✓"+(bad.length?"\n\nIllisible, laissé de côté : "+bad.join(", "):"")); window.location.reload(); } else setTimeout(function(){ window.location.reload(); }, 700); }
      var ch=Promise.resolve();
      if(photos && IDB) Object.keys(photos).forEach(function(id){ if(!/^\d{1,16}$/.test(id) || !phSafe(photos[id])) return; ch=ch.then(function(){ return idbPut(id, photos[id]); }); });
      if(more) ch=ch.then(more);
      ch=ch.then(fyStep);
      ch.then(finishRestore).catch(finishRestore);
    }
