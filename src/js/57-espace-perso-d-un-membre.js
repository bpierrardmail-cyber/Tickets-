    // ---------- Espace perso d'un membre : « Mes comptes » (privé, sur ce téléphone) ou le foyer ----------
    // Passer dans « Mes comptes » met le foyer de côté tel quel (fyPerso = {cfg, data}) et remet les données d'avant le foyer (fyAvant) ;
    // revenir au foyer fait l'inverse (les données perso repartent dans fyAvant). Rien de l'espace perso n'est envoyé ;
    // le foyer n'est pas mis à jour pendant ce temps (il le sera au retour).
    function persoOn(){ return !!store.read("fyPerso", null); }
    function persoPut(k, v){ if(v===null || v===undefined){ try{ store.remove(k); }catch(e){} } else fyRawWrite(k, v); }   // absent reste absent
    function persoOwner(){ var p=store.read("fyPerso", null); return (p && p.cfg && p.cfg.owner) || "ton foyer"; }
    function espacePerso(){
      if(!fyMember()) return;
      var data={}; Object.keys(FY_KEYS).forEach(function(k){ data[k]=store.read(k, null); });
      var me=fyCfg.me || mePerson();
      fyRawWrite("fyPerso", { cfg:fyCfg, data:data, me:me });
      var prev=store.read("fyAvant", null) || {};
      Object.keys(FY_KEYS).forEach(function(k){ persoPut(k, prev.hasOwnProperty(k) ? prev[k] : null); });
      if(!prev.comptes || !prev.comptes.length) fyRawWrite("comptes", [{ key:"principal", nom:"Compte courant", payer:me, main:true }]);
      fyRawWrite("askName", false);
      ["fyCfg","compteSel","personView"].forEach(function(k){ try{ store.remove(k); }catch(e){} });
      location.reload();
    }
    // en revenant au foyer, les derniers changements de « Mes comptes » sont d'abord préparés pour Drive (si la sauvegarde est activée)
    function espaceFoyer(){
      var P=store.read("fyPerso", null); if(!P || !P.cfg) return;
      if(drvOn() && !espaceFoyer._staged){ espaceFoyer._staged=true; drvPrep(false).then(espaceFoyer, espaceFoyer); return; }
      var prev={}; Object.keys(FY_KEYS).forEach(function(k){ prev[k]=store.read(k, null); });
      fyRawWrite("fyAvant", prev);
      Object.keys(FY_KEYS).forEach(function(k){ persoPut(k, (P.data && P.data.hasOwnProperty(k)) ? P.data[k] : null); });
      fyRawWrite("fyCfg", P.cfg);
      ["fyPerso","compteSel","personView"].forEach(function(k){ try{ store.remove(k); }catch(e){} });
      location.reload();
    }
    // Un ticket de l'espace perso envoyé aussi au foyer : copié dans le foyer mis de côté (fyPerso.data.entries, payé par le membre) ;
    // au retour dans le foyer, il part comme ses autres changements. Décocher le retire du foyer. Seulement si l'Accueil (tickets) est en modification.
    function persoSendOk(){ var P=store.read("fyPerso", null); return !!(P && P.cfg && P.cfg.role==="edit" && fyEdTabs(P.cfg).indexOf("list")>=0); }
    function persoSendTicket(e, on, fid){
      var P=store.read("fyPerso", null); if(!P || !P.data || !persoSendOk()) return "";
      var L=(P.data.entries||[]).slice(), i=-1; if(fid!=null) L.forEach(function(x, k){ if(String(x.id)===String(fid)) i=k; });
      if(!on){ if(i<0) return ""; L.splice(i, 1); P.data.entries=L; fyRawWrite("fyPerso", P); delete e.foyerId; return "retiré du foyer"; }
      var c=JSON.parse(JSON.stringify(e)); delete c.compte; delete c.photo; delete c.foyerId; delete c.imp; delete c.impKey; delete c.src; delete c.liq;
      c.payePar=P.me || (P.cfg && P.cfg.me) || ""; c.id=(i>=0) ? L[i].id : (Date.now()+1);
      if(i>=0) L[i]=c; else L.unshift(c);
      P.data.entries=L; fyRawWrite("fyPerso", P); e.foyerId=c.id;
      return "envoyé au foyer de "+persoOwner()+" (à ton retour)";
    }
    function espaceAsk(){
      if(persoOn()) uiChoice("Mes comptes · privé", esc("Cet espace reste sur ton téléphone : rien n'est envoyé au foyer."), [{ l:"Revenir au foyer de "+persoOwner(), fn:espaceFoyer }]);
      else uiChoice("Mes comptes", esc("Ton espace à toi, en plus du foyer de "+((fyCfg && fyCfg.owner)||"…")+" : tes tickets, comptes, frais fixes et épargne, privés, sur ce téléphone seulement. Tu reviens au foyer quand tu veux."), [{ l:"Aller dans Mes comptes", fn:espacePerso }]);
    }
    function fyWelcome(){
      uiChoice("Bienvenue dans "+APP_NAME+" 👋", "C'est ta première fois, ou quelqu'un t'invite dans son foyer ?", [
        { l:"Je commence", fn:askFirstName },
        { l:"🎭 Voir un exemple", primary:false, fn:demoStart },
        drvNative() ? { l:"☁️ Restaurer depuis Google Drive", primary:false, fn:drvNewPhone } : null,
        { l:"Rejoindre un foyer (QR code)", fn:function(){ fyJoin(); } },
        { l:"Restaurer une sauvegarde"+(drvNative()?" (fichier)":"")+" · retrouver mon foyer", primary:false, fn:function(){ restorein.click(); } }
      ].filter(function(x){ return x; }));
    }
    // ----- démarrage -----
    function fyInit(){
      fyApplyMode();
      if(!fyCfg) return;
      if(fyCfg.role!=="view") fyDetect();   // changements faits pendant que l'appli était fermée
      fyEnsureMembersPersons();
      if(fyCfg.role==="owner" && !fyCfg.factMig){ Object.keys(fyCfg.members||{}).forEach(function(id){ var m=fyCfg.members[id];
          if(Array.isArray(m.tabs) && m.tabs.indexOf("compte")>=0 && m.tabs.indexOf("factures")<0) m.tabs.splice(m.tabs.indexOf("compte")+1, 0, "factures");
          if(Array.isArray(m.ed) && m.ed.indexOf("compte")>=0 && m.ed.indexOf("factures")<0) m.ed.push("factures"); });
        fyCfg.factMig=1; fySave(); fyVer++; }
      fyEnsureLock();
      if(store.read("fyRecovered", null)){ try{ store.remove("fyRecovered"); }catch(e){}
        setTimeout(function(){ uiConfirm("Ton foyer est revenu sur ce téléphone ✓<br><small style=\"color:var(--ink-soft)\">Tes membres gardent leur accès et reçoivent bientôt la mise à jour. Si tu as restauré sur un nouveau téléphone, n'utilise plus l'application sur l'ancien pour éviter les erreurs de synchronisation.</small>", function(){}, { ok:"OK", no:"Fermer" }); }, 900); }
      render();
      fySyncSoon(1200);
    }
    document.addEventListener("visibilitychange", function(){
      if(!fyCfg) return;
      if(document.hidden){ if(Object.keys(fyDirty).length){ clearTimeout(fyDetT); fyFlush(); } clearTimeout(fySyncT); fySyncT=null; fySyncDue=0; fySync(); }   // envoyé avant de partir, puis plus rien
      else { fyIdle=0; if(Date.now()-fyLastAt<20000) fyPlanNext(); else fySyncSoon(600, false); }
    });
    try{ if(ensureBourseEp()) persistEpargne(); }catch(e){}
    try{ famMerge(); }catch(e){ console.warn(e); }   // produits rangés dans l'arbre des catégories (une fois)
    try{ catRepair(); }catch(e){ console.warn(e); }   // doublons de noms après la migration du 06/11 (une fois)
    fyInit();
    try{ factEstRefresh(); }catch(e){}
    render();
    if(store.read("askName", false) && !mainAcct().payer && !fyCfg) setTimeout(function(){ if(!document.getElementById("lockscreen")) if(store.read("welcomeSeen", null) || window.__tkNoWelcome) fyWelcome(); else welcomeShow(fyWelcome); }, 500);
    else welcomeAuto();
    catMigAuto();
    secureApply();
    setTimeout(function(){ try{ drvActAuto(0); }catch(e){} }, 900);
    initPhotos();
    tickBourse();
    setInterval(tickBourse, 60000);
    fetchAllStockPrices();
    setInterval(fetchAllStockPrices, 900000);
    refreshPositions(true);
    setInterval(function(){ refreshPositions(true); }, 900000);
    var lastRefresh=Date.now();
    function refreshOnReturn(){
      if(document.hidden) return;
      if(Date.now()-lastRefresh < 20000) return; // évite les doublons si plusieurs events se déclenchent d'un coup
      lastRefresh=Date.now();
      if(!FEAT.bourse) return;
      tickBourse();
      fetchAllStockPrices();
    }
    document.addEventListener("visibilitychange", refreshOnReturn);
    window.addEventListener("pageshow", refreshOnReturn);
    window.addEventListener("focus", refreshOnReturn);
    document.addEventListener("click", function(e){
      var t=e.target;
      while(t && t.nodeType===1){
        if(t.id==="hmenu" || t.id==="bkstat"){ openMenu(); return; }
        t=t.parentNode;
      }
    });

