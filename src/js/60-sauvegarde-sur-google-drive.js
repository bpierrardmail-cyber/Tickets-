    // ---------- Sauvegarde sur Google Drive ----------
    // Activée une fois ; ensuite, en quittant l'appli, la sauvegarde (données sans photos) est chiffrée ici puis
    // confiée à Android, qui l'envoie dès que le réseau est là (TkDrive, accès « drive.file » : seulement ses fichiers).
    // Clé : un secret de 16 octets (code de secours de 26 caractères), le même que celui du foyer pour un propriétaire.
    // Sur le téléphone seulement, jamais dans une sauvegarde : driveCfg {on, email, since}, driveSec, driveSig, driveBanX.
    var drvSt=null, drvSig0="", drvPollTm=0;
    function drvCfg(){ return store.read("driveCfg", null)||{}; }
    function drvOn(){ return !!drvCfg().on && !fyMember(); }
    function drvAvail(){ return capNative() && !fyMember() && !DEMO; }
    function drvNative(){ if(DEMO) return false; var NP=capPlugin("TicketsNative"); return !!(NP && typeof NP.driveConnect==="function"); }
    function drvSec(){ var s=store.read("driveSec", null); if(s) return fyUnb64u(s); return (fyCfg && fyCfg.role==="owner" && fyCfg.sec) ? fyUnb64u(fyCfg.sec) : null; }
    function drvKeys(sec){ return Promise.all([fyHkdf(sec, "drive", 32), fyHkdf(sec, "drive-kf", 9)]).then(function(a){ return { key:fyB64u(a[0]), kf:fyB64u(a[1]) }; }); }
    function drvHash(t){ var h=5381; for(var i=0;i<t.length;i++) h=((h*33)^t.charCodeAt(i))|0; return t.length+":"+h; }
    function drv2(n){ return (n<10?"0":"")+n; }
    function drvName(){ var d=new Date(); return "tickets-"+d.getFullYear()+"-"+drv2(d.getMonth()+1)+"-"+drv2(d.getDate())+"-"+drv2(d.getHours())+"h"+drv2(d.getMinutes())+".tkb"; }
    function drvWhen(t){
      var d=new Date(t), n=new Date(), d0=new Date(d.getFullYear(), d.getMonth(), d.getDate()), n0=new Date(n.getFullYear(), n.getMonth(), n.getDate());
      var days=Math.round((n0-d0)/86400000), hm=drv2(d.getHours())+":"+drv2(d.getMinutes());
      return days===0 ? "aujourd'hui "+hm : (days===1 ? "hier "+hm : drv2(d.getDate())+"/"+drv2(d.getMonth()+1)+" "+hm);
    }
    // état : ok (à jour), wait (en attente), auth (compte à reconnecter), first (première sauvegarde en cours), off
    function drvState(){
      var st=drvSt||{};
      if(!drvOn()) return { k:"off" };
      if(st.err==="auth") return { k:"auth" };
      if(st.pendingSince && !st.lastOk) return { k:"first" };
      if(st.pendingSince) return { k:"wait", since:st.pendingSince };
      if(st.lastOk) return { k:"ok" };
      return { k:"first" };
    }
    function drvMenuLabel(){
      var S=drvState(), st=drvSt||{};
      if(S.k==="auth") return { t:"Drive · à reconnecter", col:"var(--coral)" };
      if(S.k==="wait"){   // juste après un changement, l'envoi attend quelques minutes (réseau, Android) : ce n'est pas une erreur
        var age=Date.now()-(Number(st.pendingSince)||Date.now());
        if(st.err && String(st.err).indexOf("fail")===0) return { t:"Drive · envoi refusé, nouvel essai", col:"var(--coral)" };
        if(age<6*3600000) return { t:"Drive · envoi en cours"+(st.err==="net"?" (réseau)":""), col:"var(--ink-soft)" };
        return { t:"Drive · en attente depuis "+drvWhen(st.pendingSince), col:"var(--coral)" }; }
      if(S.k==="ok") return { t:"Drive · "+drvWhen(st.lastOk), col:"var(--accent)" };
      return { t:"Drive", col:"var(--accent)" };
    }
    // état donné par Android ; une sauvegarde partie compte comme « dernière sauvegarde »
    function drvRefresh(){
      if(!drvOn() || !drvNative()) return Promise.resolve(null);
      return npCall("driveStatus").then(function(st){
        drvSt=st||null;
        if(st && st.lastOk){ var lb=store.read("lastBackup", null); if(!lb || new Date(lb).getTime()<st.lastOk) store.write("lastBackup", new Date(st.lastOk).toISOString()); }
        return st;
      }).catch(function(){ return null; });
    }
    // prépare la sauvegarde chiffrée si les données ont changé (en quittant l'appli) ; Android l'envoie
    function drvPrep(force){
      if(!drvOn() || !drvNative() || drvRestoring) return Promise.resolve(false);
      var sec=drvSec(); if(!sec) return Promise.resolve(false);
      var dump=backupDump(), sig=drvHash(JSON.stringify(dump.data)), rs=store.read("driveRestored", null);
      if(rs && rs.banner && rs.sig && rs.sig!==sig){ rs.banner=false; store.write("driveRestored", rs); }
      if(!force && sig===(store.read("driveSig", "")||"")) return Promise.resolve(false);
      var rc=rapCfg();
      return drvKeys(sec).then(function(k){
        return fySeal(k.key, dump).then(function(str){
          return npCall("driveStage", { data:str, name:drvName(), n:(dump.data.entries||[]).length, c:(dump.data.comptes||[]).filter(function(a){ return a.key!=="__tickets"; }).length, kf:k.kf, remind:!!(rc.on && rc.bk) });
        });
      }).then(function(st){ store.write("driveSig", sig); if(st) drvSt=st; return true; })
        .catch(function(e){ try{ console.warn("drive", e); }catch(_){} return false; });
    }
    // Menu › Sauvegarde (appli Android) : Drive, sauvegarde complète, données seules
    function backupMenu(){
      var nph=photoEntries().length, S=drvState(), on=drvOn(), plus=!canUse("drive");
      function row(k, ic, t, sub, st, stCol){ return '<button type="button" class="dr-row tall" data-k="'+k+'"><span class="ic">'+ic+'</span><span class="t">'+t+(sub?'<small>'+esc(sub)+'</small>':'')+'</span>'+(st?'<span class="st" style="color:'+(stCol||"var(--accent)")+'">'+esc(st)+'</span>':'')+'<span class="chev">›</span></button>'; }
      var ml=on ? drvMenuLabel() : null, nat=drvAvail(), u=drvUndo();
      var h='<div class="sheet-title">Sauvegarder et restaurer</div><div class="dr-grp" style="margin-top:8px">'+row("how","💡","Comment ça marche ?","Ce qui est gardé, où, et ton code de secours")+'</div><div class="sto-h" style="margin-top:12px">Sauvegarder</div><div class="dr-grp" style="margin-top:6px">'+
        (!nat ? '' : row("drive","☁️",'Sauvegarde sur Google Drive'+(plus?' <span style="color:#f2c76b">✦</span>':''), "Automatique, chiffrée, sans photos", on ? ml.t.replace("Drive · ","") : (plus ? "Plus" : "Nouveau"), on ? ml.col : (plus ? "#f2c76b" : "var(--accent)"))+
        '')+row("full","🗜️","Sauvegarde complète", nph ? "Données + "+nph+" photo"+(nph>1?"s":"")+" · ZIP" : "Données et photos · ZIP")+
        row("data","📄","Données seules","Petit fichier JSON")+'</div>'+
        '<div class="sto-h">Restaurer</div><div class="dr-grp" style="margin-top:6px">'+
        (u ? row("undo","⤺","Annuler la restauration", "Remet les données d'avant le "+drvWhen(u.at)) : '')+
        (drvNative() ? row("rdrive","☁️","Depuis Google Drive", on ? "Choisir une sauvegarde" : "Ton compte Google et ton code de secours") : '')+
        row("rfile","📂","Depuis un fichier","ZIP ou JSON enregistré sur le téléphone")+'</div>'+
        '<div class="muted" style="font-size:11px;margin:8px 2px 0;line-height:1.45">Restaurer remplace les données du téléphone.</div>'+
        '<div class="ui-stack" style="margin-top:12px"><button type="button" class="btn ghost ui-no">Fermer</button></div>';
      var s=uiSheet(h); s.q(".ui-no").onclick=s.close;
      [].forEach.call(s.qa(".dr-row"), function(b){ b.onclick=function(){ var k=b.getAttribute("data-k"); s.close();
        if(k==="drive"){ if(on){ state.view="drive"; render(); window.scrollTo(0,0); drvRefresh().then(function(){ if(state.view==="drive") render(); }); } else drvIntro(); }
        else if(k==="rdrive"){ if(drvOn()) drvRestoreOpen(); else drvNewPhone(); }
        else if(k==="rfile") restorein.click();
        else if(k==="undo") drvUndoAsk();
        else if(k==="how") sauvAideOpen();
        else backupData(k); }; });
    }
    // Écran 2 de la maquette (ou la présentation Tickets Plus dans la version Store)
    function drvIntro(){
      var plus=!canUse("drive");
      var bul=plus ? [["✦","Tes données partent chaque jour, chiffrées, sur ton Google Drive"],["✦","Un téléphone perdu ou cassé ? Tu retrouves tout avec ton code de secours"],["✦","Ni Google ni nous ne pouvons la lire"],["✦","Les sauvegardes à la main restent gratuites"]]
        : [["✓","<b>Automatique</b> : envoyée en quittant l'appli, même fermée, dès qu'il y a du réseau (Wi-Fi ou données mobiles)."],["✓","<b>Chiffrée</b> sur ton téléphone : ni Google ni nous ne pouvons la lire."],["✓","<b>Sans photos</b> : un petit fichier. Les photos restent dans la sauvegarde complète."],["✓","L'appli ne voit que son dossier « Tickets – sauvegardes », rien d'autre de ton Drive."],["✓","Gardées 30 jours, puis une par mois sur 12 mois, une par an sur 5 ans."]];
      var s=uiSheet('<div class="sheet-title">Sauvegarde sur Google Drive</div><div class="muted" style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;margin:-4px 0 10px">✦ '+APP_NAME+' Plus</div>'+
        '<ul class="drv-bul">'+bul.map(function(x){ return '<li><i>'+x[0]+'</i><span>'+x[1]+'</span></li>'; }).join("")+'</ul>'+
        '<div class="ui-stack" style="margin-top:14px">'+(plus ? '<button type="button" class="btn primary" id="drvGo">✦ Découvrir '+APP_NAME+' Plus</button>' : '<button type="button" class="btn primary" id="drvGo">Choisir le compte Google</button>')+'<button type="button" class="btn ghost ui-no">Plus tard</button></div>');
      s.q(".ui-no").onclick=s.close;
      s.q("#drvGo").onclick=function(){ s.close(); if(plus) plusShow("drive"); else drvConnect(); };
    }
    function drvConnect(){
      if(!drvNative()){ uiToast("Installe la nouvelle version de l'appli pour la sauvegarde Drive"); return; }
      if(!window.crypto || !crypto.subtle){ uiToast("Sauvegarde Drive indisponible sur ce téléphone"); return; }
      uiToast("Connexion à Google…");
      npCall("driveConnect").then(function(r){
        r=r||{}; var kfs=r.kfs||[], mine=drvSec();
        return (mine ? drvKeys(mine) : Promise.resolve(null)).then(function(k){
          if(k && (kfs.indexOf(k.kf)>=0 || (drvCfg().since && !kfs.length))) return drvActivate(mine, r);   // même clé : rien à redemander
          if(kfs.length) return drvAskCode(r);
          drvShowCode(mine || randBytes(16), r);
        });
      }).catch(function(e){ var m=String((e && (e.code||e.message))||e||""); if(/cancel/i.test(m)) return; uiToast((e && e.message) || "Connexion Google impossible"); });
    }
    // Écran 3 : le code de secours, montré une seule fois
    function drvShowCode(sec, r){
      var code=fyCodeTxt(fyB64u(sec)), foyer=fyCfg && fyCfg.role==="owner" && fyCfg.sec===fyB64u(sec);
      var s=uiSheet('<div class="sheet-title">Ton code de secours</div><div class="ui-intro">Il ouvre tes sauvegardes sur un autre téléphone. <b>Il n\'apparaîtra plus</b> : note-le sur papier ou dans un gestionnaire de mots de passe.</div>'+
        '<div class="fy-code">'+esc(code)+'</div>'+
        (foyer ? '<div class="ui-intro" style="font-size:12.5px">Ton foyer partagé a déjà ce code de récupération : <b>c\'est le même</b>. Un seul code à garder.</div>' : '')+
        '<label class="csv-ck"><input type="checkbox" id="drvNoted"><span>J\'ai noté le code, je sais que sans lui une sauvegarde ne peut pas être ouverte.</span></label>'+
        '<div class="ui-stack" style="margin-top:10px"><button type="button" class="btn" id="drvCopy">Copier</button><button type="button" class="btn primary" id="drvOk" disabled>Activer la sauvegarde</button><button type="button" class="btn ghost ui-no">Annuler</button></div>');
      s.q(".ui-no").onclick=s.close;
      s.q("#drvNoted").onchange=function(){ s.q("#drvOk").disabled=!this.checked; };
      s.q("#drvCopy").onclick=function(){ try{ navigator.clipboard.writeText(code.replace(/-/g,"")).then(function(){ uiToast("Code copié"); }, function(){ uiToast("Copie impossible : recopie-le à la main"); }); }catch(e){ uiToast("Copie impossible : recopie-le à la main"); } };
      s.q("#drvOk").onclick=function(){ if(!s.q("#drvNoted").checked) return; s.close(); drvActivate(sec, r); };
    }
    // Écran 3 bis : le compte a déjà des sauvegardes d'une autre clé
    function drvAskCode(r, onOk, opt){
      opt=opt||{};
      var s=uiSheet('<div class="sheet-title">'+esc(opt.title||"Sauvegardes trouvées")+'</div><div class="ui-intro">Ce compte Google a déjà <b>'+(r.count||0)+' sauvegarde'+((r.count||0)>1?'s':'')+'</b> de '+APP_NAME+''+(r.last?' (dernière : '+esc(drvWhen(r.last))+')':'')+'. Tape ton code de secours pour continuer avec la même clé.</div>'+
        '<input class="f" id="drvCode" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX-…" style="font-family:var(--mono);letter-spacing:.05em"><div class="drv-err" id="drvErr"></div>'+
        '<div class="ui-stack" style="margin-top:8px"><button type="button" class="btn primary" id="drvOk">Continuer</button>'+(opt.noZero?'':'<button type="button" class="btn ghost" id="drvZero">Code perdu ? Repartir de zéro</button>')+'<button type="button" class="btn ghost ui-no">Annuler</button></div>');
      s.q(".ui-no").onclick=s.close;
      s.q("#drvOk").onclick=function(){
        var sec=fyUnb32(s.q("#drvCode").value), err=s.q("#drvErr");
        if(sec.length!==16){ err.textContent="Code incomplet : il fait 26 caractères (lettres et chiffres 2 à 7)."; return; }
        drvKeys(sec).then(function(k){ if((r.kfs||[]).indexOf(k.kf)<0){ err.textContent="Ce code ne correspond pas aux sauvegardes de ce compte Google."; return; } s.close(); if(onOk) onOk(sec); else drvActivate(sec, r); });
      };
      if(s.q("#drvZero")) s.q("#drvZero").onclick=function(){ s.close();
        uiConfirm("Repartir de zéro ?<br><small style=\"color:var(--ink-soft)\">Une nouvelle clé est créée. Les anciennes sauvegardes restent sur ton Drive mais ne pourront plus être ouvertes sans leur code. L'appli ne les supprime jamais.</small>", function(){
          var own=fyCfg && fyCfg.role==="owner" && fyCfg.sec ? fyUnb64u(fyCfg.sec) : null;
          drvShowCode(own || randBytes(16), { count:0, kfs:[], email:r.email });
        }, { ok:"Nouvelle clé", danger:true });
      };
    }
    function drvActivate(sec, r){
      store.write("driveSec", fyB64u(sec));
      var c=drvCfg(); c.on=true; c.email=(r && r.email) || c.email || ""; if(!c.since) c.since=Date.now(); store.write("driveCfg", c);
      store.write("driveSig", "");
      var rc=rapCfg();
      return npCall("driveSetup", { on:true, remind:!!(rc.on && rc.bk) }).then(function(){ return drvPrep(true); }).then(function(){ return npCall("driveSendNow"); }).then(function(st){
        if(st) drvSt=st; state.view="drive"; render(); window.scrollTo(0,0); uiToast("Sauvegarde Drive activée"); drvPoll(0);
      }).catch(function(e){ uiToast("Activation impossible : "+((e && e.message)||"réessaie")); });
    }
    // pendant la première sauvegarde : l'écran suit l'envoi
    function drvPoll(n){
      clearTimeout(drvPollTm);
      drvPollTm=setTimeout(function(){
        if(state.view!=="drive") return;
        drvRefresh().then(function(){ if(state.view!=="drive") return; render(); var k=drvState().k; if((k==="first" || k==="wait") && n<40) drvPoll(n+1); });
      }, 3000);
    }
    function drvBannerHTML(){
      var rs=store.read("driveRestored", null);
      if(rs && rs.banner){ var u=drvUndo();
        return '<div class="bk-banner" style="background:rgba(79,214,160,.10);border-color:rgba(79,214,160,.35)"><span style="font-size:20px">'+(rs.newPhone?'☁️':'↩️')+'</span><div><b>'+esc(rs.newPhone ? "Tout est revenu" : "Sauvegarde du "+drvWhenLong(rs.from).replace(/^Aujourd'hui/,"aujourd'hui").replace(/^Hier/,"hier")+" restaurée")+'</b><br><span style="color:var(--ink-soft);font-size:11px">'+esc(rs.n+" ticket"+(rs.n>1?"s":"")+(rs.nc?", "+rs.nc+" compte"+(rs.nc>1?"s":""):"")+". "+(rs.newPhone ? (rs.drv===false ? "Les photos des tickets reviennent avec une sauvegarde complète (ZIP)." : "La sauvegarde Drive continue sur ce téléphone, avec la même clé.") : "Tes données d'avant sont gardées 30 jours."))+'</span></div>'+(!rs.newPhone && u ? '<button class="btn" id="drvBanUndo" type="button">Annuler</button>' : '<button class="drv-x" id="drvBanRs" type="button" aria-label="Fermer">✕</button>')+'</div>'; }
      if(!drvOn()) return "";
      var S=drvState(), st=drvSt||{};
      if(S.k==="auth") return '<div class="bk-banner drv"><span style="font-size:20px">☁️</span><div><b>Sauvegarde Drive arrêtée</b><br><span style="color:var(--ink-soft);font-size:11px">Google demande de reconnecter ton compte.</span></div><button class="btn primary" id="drvBanGo" type="button">Reconnecter</button></div>';
      if(st.otherAt && String(store.read("driveOtherX", ""))!==String(st.otherAt))
        return '<div class="bk-banner drv"><span style="font-size:20px">⚠️</span><div><b>Un autre téléphone sauvegarde ici</b><br><span style="color:var(--ink-soft);font-size:11px">Le '+esc(drvWhen(st.otherAt))+', une sauvegarde est arrivée dans ton dossier Drive depuis un autre téléphone. Si ce n\'est pas toi : Menu › Sauvegarde › Sauvegarde Google Drive.</span></div><button class="drv-x" id="drvOtherX" type="button" aria-label="Fermer">✕</button></div>';
      if(S.k==="wait" && Date.now()-st.pendingSince>3600000 && String(store.read("driveBanX", ""))!==String(st.pendingSince))
        return '<div class="bk-banner drv"><span style="font-size:20px">☁️</span><div><b>Pas encore sur Drive</b><br><span style="color:var(--ink-soft);font-size:11px">Tes modifications de '+esc(drvWhen(st.pendingSince))+' n\'ont pas pu partir. Elles partiront dès qu\'il y aura du réseau.</span></div><button class="drv-x" id="drvBanX" type="button" aria-label="Fermer">✕</button></div>';
      return "";
    }
    function drvBannerWire(){
      var g=document.getElementById("drvBanGo"); if(g) g.onclick=drvConnect;
      var x=document.getElementById("drvBanX"); if(x) x.onclick=function(){ store.write("driveBanX", String((drvSt||{}).pendingSince||"")); render(); };
      var ox=document.getElementById("drvOtherX"); if(ox) ox.onclick=function(){ store.write("driveOtherX", String((drvSt||{}).otherAt||"")); render(); };
      var bu=document.getElementById("drvBanUndo"); if(bu) bu.onclick=drvUndoAsk;
      var br=document.getElementById("drvBanRs"); if(br) br.onclick=function(){ var rs=store.read("driveRestored", null); if(rs){ rs.banner=false; store.write("driveRestored", rs); } render(); };
    }
    // Écran de la sauvegarde (Menu › Sauvegarde › Drive)
    // Comment marchent les sauvegardes (07/11, maquette validée) : depuis Menu › Sauvegarde et l'écran du foyer
    function sauvAideOpen(){ state.sauvFrom=state.view; state.view="sauvaide"; render(); window.scrollTo(0,0); }
    function renderSauvAide(){
      var nat=drvAvail(), h=header(true)+'<section class="paper">';
      h+='<div class="sv-flow">'+
        '<div class="sv-node"><b>📱 Ton téléphone</b>Tickets, comptes, frais fixes, épargne, provisions, factures, réglages ; ton foyer et ses membres si tu en as un.</div><div class="sv-arr">↓</div>'+
        '<div class="sv-node key"><b>🔑 Chiffré avec ton code de secours</b>Sur ton téléphone, avant de partir. 26 caractères, à noter sur papier.</div><div class="sv-arr">↓</div>'+
        '<div class="sv-two">'+(nat?'<div class="sv-node"><b>☁️ Google Drive</b>Tout seul, en quittant l\'appli.</div>':'<div class="sv-node"><b>☁️ Google Drive</b>Dans l\'appli Android.</div>')+'<div class="sv-node"><b>📂 Fichier</b>Quand tu veux. ZIP avec les photos.</div></div><div class="sv-arr">↓</div>'+
        '<div class="sv-node"><b>📱 Nouveau téléphone</b>Restaurer + ton code. Tes membres gardent leur accès.</div></div>';
      h+='<div class="sto-h" style="margin-top:18px">Ce que chaque sauvegarde contient</div><div class="sv-tbl">'+
        '<div class="sv-tr"><span></span><span>Drive</span><span>Fichier</span></div>'+
        '<div class="sv-tr"><span>Tes données</span><span class="sv-y">Oui</span><span class="sv-y">Oui</span></div>'+
        '<div class="sv-tr"><span>Ton foyer</span><span class="sv-y">Oui</span><span class="sv-y">Oui, avec le code</span></div>'+
        '<div class="sv-tr"><span>Photos des tickets</span><span class="sv-n">Non</span><span class="sv-y">ZIP</span></div>'+
        '<div class="sv-tr"><span>Automatique</span><span class="sv-y">Oui</span><span class="sv-n">Non</span></div></div>';
      h+='<div class="sv-warn"><b>Sans sauvegarde</b>, un téléphone perdu, ce sont tes données perdues, et ton foyer à recréer.</div>';
      h+='<div class="muted" style="font-size:12.5px;line-height:1.5;margin-top:12px">Ton code, ton empreinte et tes réglages d\'affichage restent sur chaque téléphone. Si tu as restauré sur un nouveau téléphone, n\'utilise plus l\'application sur l\'ancien pour éviter les erreurs de synchronisation.</div>';
      h+='<div class="ui-stack" style="margin-top:14px"><button type="button" class="btn primary" id="svGo">Sauvegarder maintenant</button></div></section>';
      app.innerHTML=h; setNav(null,false);
      bindBack(function(){ state.view=state.sauvFrom||"list"; if(state.view==="sauvaide") state.view="list"; render(); });
      var g=document.getElementById("svGo"); if(g) g.onclick=function(){ backupData(); };
    }
    function renderDrive(){
      var c=drvCfg(), st=drvSt||{}, S=drvState(), h=header("list")+'<section class="paper">';
      h+='<div class="center muted" style="font-size:11px;letter-spacing:.18em;text-transform:uppercase">Sauvegarde Drive</div><hr class="rule">';
      if(!drvOn()){
        h+='<div class="drv-card"><div class="drv-stat"><span class="drv-dot n"></span><div><div class="drv-big">Désactivée</div><div class="drv-sub">Tes anciennes sauvegardes restent sur ton Drive.</div></div></div></div>';
        h+='<div class="ui-stack" style="margin-top:14px"><button type="button" class="btn primary" id="drvOnBtn">Activer la sauvegarde Drive</button></div></section>';
        app.innerHTML=h; setNav(null,false); bindBack(function(){ state.view="list"; render(); });
        document.getElementById("drvOnBtn").onclick=drvIntro; return;
      }
      var big, sub, dot="", extra="";
      if(S.k==="ok"){ big="À jour"; sub="Dernière : "+drvWhen(st.lastOk)+(st.lastSize?" · "+fmtBytes(st.lastSize):""); }
      else if(S.k==="first"){ big="Première sauvegarde…"; sub="Préparée sur le téléphone, chiffrée"; extra='<div class="drv-prog"><i></i></div><div class="drv-sub" style="margin-top:8px">Tu peux fermer l\'appli : la suite se fait toute seule, à chaque fois que tu la quittes.</div>'; }
      else if(S.k==="wait"){ big="En attente"; dot=" c"; sub="Depuis "+drvWhen(st.pendingSince)+(st.lastOk?" · dernière partie : "+drvWhen(st.lastOk):"");
        extra='<div class="drv-sub" style="margin:8px 0 10px">'+(st.err==="net" || !st.err ? "Pas de réseau quand tu as quitté l'appli"+(st.wifi?" (ou pas de Wi-Fi)":"")+". Android réessaie tout seul." : "Envoi refusé par Google : "+esc(String(st.err).replace(/^fail:/,"")))+'</div><button type="button" class="btn" id="drvNow">Envoyer maintenant</button>'; }
      else { big="Compte à reconnecter"; dot=" c"; sub="Google demande de redonner l'accès à Drive"; extra='<div style="margin-top:10px"><button type="button" class="btn primary" id="drvRe">Reconnecter</button></div>'; }
      h+='<div class="drv-card"><div class="drv-stat"><span class="drv-dot'+dot+'"></span><div><div class="drv-big">'+esc(big)+'</div><div class="drv-sub">'+esc(sub)+'</div></div></div>'+extra+'</div>';
      h+='<div class="drv-card"><div class="drv-kv"><span>Compte</span><span>'+esc(c.email||st.email||"—")+'</span></div>'+
         '<div class="drv-kv"><span>Sauvegardes gardées</span><span>'+(st.count||0)+'</span></div>'+
         '<div class="drv-kv"><span>Conservation</span><span>'+(st.keepD||30)+' j · '+(st.keepM||12)+' mois · '+(st.keepY||5)+' ans</span></div></div>';
      if(st.otherAt) h+='<div class="drv-card" style="border-color:rgba(244,121,107,.35)"><div class="drv-big" style="font-size:14px">⚠️ Un autre téléphone sauvegarde ici</div><div class="drv-sub" style="line-height:1.45">Dernière arrivée : '+esc(drvWhen(st.otherAt))+'. Si c\'est ton ancien téléphone, n\'utilise plus les deux. Sinon, retire l\'accès de '+APP_NAME+' dans ton compte Google : myaccount.google.com › Sécurité › Applications tierces.</div></div>';
      h+='<label class="csv-ck" style="margin-top:8px;border-top:0"><input type="checkbox" id="drvWifi"'+(st.wifi?' checked':'')+'><span>Wi-Fi seulement<br><small class="muted">Sinon aussi en données mobiles (petit fichier)</small></span></label>';
      h+='<div class="dr-grp">'+
        '<button type="button" class="dr-row tall" id="drvVerify"><span class="ic">🔍</span><span class="t">Vérifier<small>Lit la dernière sauvegarde sans rien changer</small></span><span class="chev">›</span></button>'+
        '<button type="button" class="dr-row tall" id="drvRestore"><span class="ic">↩️</span><span class="t">Restaurer<small>Choisir une sauvegarde</small></span>'+(st.count?'<span class="st" style="color:var(--accent)">'+st.count+'</span>':'')+'<span class="chev">›</span></button>'+
        (drvUndo() ? '<button type="button" class="dr-row tall" id="drvUndo"><span class="ic">⤺</span><span class="t">Annuler la restauration<small>'+esc("Remet les données d'avant le "+drvWhen(drvUndo().at)+", possible 30 jours")+'</small></span><span class="chev">›</span></button>' : '')+
        '<button type="button" class="dr-row tall" id="drvKeep"><span class="ic">⏱️</span><span class="t">Durées de conservation</span><span class="chev">›</span></button>'+
        '<button type="button" class="dr-row tall" id="drvOff"><span class="ic">⏸️</span><span class="t">Désactiver<small>Arrête l\'envoi, ne supprime rien</small></span><span class="chev">›</span></button></div>';
      h+='<div class="muted" style="font-size:11px;margin-top:14px;line-height:1.5">L\'appli ne voit que son dossier « Tickets – sauvegardes ». Pour ouvrir une sauvegarde sur un autre téléphone, il faut ton code de secours.</div></section>';
      app.innerHTML=h; setNav(null,false);
      bindBack(function(){ state.view="list"; render(); });
      function on(id, fn){ var el=document.getElementById(id); if(el) el.onclick=fn; }
      on("drvNow", function(){ npCall("driveSendNow").then(function(x){ if(x) drvSt=x; uiToast("Envoi relancé"); render(); drvPoll(0); }).catch(function(){ uiToast("Envoi impossible pour l'instant"); }); });
      on("drvRe", drvConnect);
      on("drvVerify", drvVerify);
      on("drvRestore", drvRestoreOpen);
      on("drvUndo", drvUndoAsk);
      on("drvKeep", drvKeepSheet);
      on("drvOff", function(){ uiConfirm("Désactiver la sauvegarde Drive ?<br><small style=\"color:var(--ink-soft)\">L'envoi s'arrête. Rien n'est supprimé de ton Drive ; en la réactivant, l'appli reprend la même clé et le même dossier.</small>", function(){
        var cc=drvCfg(); cc.on=false; store.write("driveCfg", cc);
        npCall("driveSetup", { on:false }).catch(function(){}); drvSt=null; render(); uiToast("Sauvegarde Drive désactivée"); }, { ok:"Désactiver" }); });
      var w=document.getElementById("drvWifi"); if(w) w.onchange=function(){ var v=w.checked; npCall("driveSetup", { wifi:v }).then(function(x){ if(x) drvSt=x; uiToast(v ? "Envoi en Wi-Fi seulement" : "Envoi en Wi-Fi ou données mobiles"); }).catch(function(){}); };
      if(S.k==="first" || S.k==="wait") drvPoll(0);
    }
    function drvKeepSheet(){
      var st=drvSt||{}, cur={ keepD:st.keepD||30, keepM:st.keepM||12, keepY:st.keepY||5 };
      var R=[["keepD","Une par jour pendant",[[7,"7 j"],[30,"30 j"],[90,"90 j"]]],["keepM","Une par mois pendant",[[6,"6 mois"],[12,"12 mois"],[24,"24 mois"]]],["keepY","Une par an pendant",[[2,"2 ans"],[5,"5 ans"],[10,"10 ans"]]]];
      var s=uiSheet('<div class="sheet-title">Durées de conservation</div><div class="ui-intro">L\'appli supprime seulement ses sauvegardes sorties de ces durées. Jamais la plus récente, et rien si un envoi a échoué.</div>'+
        R.map(function(r){ return '<div style="font-size:13px">'+r[1]+'</div><div class="drv-seg" data-k="'+r[0]+'">'+r[2].map(function(o){ return '<button type="button" data-v="'+o[0]+'"'+(cur[r[0]]===o[0]?' class="on"':'')+'>'+o[1]+'</button>'; }).join("")+'</div>'; }).join("")+
        '<div class="ui-stack"><button type="button" class="btn primary" id="drvKeepOk">Enregistrer</button><button type="button" class="btn ghost ui-no">Annuler</button></div>');
      s.q(".ui-no").onclick=s.close;
      [].forEach.call(s.qa(".drv-seg button"), function(b){ b.onclick=function(){ var g=b.parentNode; cur[g.getAttribute("data-k")]=+b.getAttribute("data-v"); [].forEach.call(g.querySelectorAll("button"), function(x){ x.className=(x===b)?"on":""; }); }; });
      s.q("#drvKeepOk").onclick=function(){ s.close(); npCall("driveSetup", cur).then(function(x){ if(x) drvSt=x; render(); uiToast("Durées enregistrées"); }).catch(function(){ uiToast("Enregistrement impossible"); }); };
    }
    // lit la dernière sauvegarde de Drive et l'ouvre avec la clé du téléphone, sans rien changer
    function drvVerify(){
      var sec=drvSec(); if(!sec){ uiToast("Clé introuvable sur ce téléphone"); return; }
      uiToast("Lecture de la dernière sauvegarde…");
      npCall("driveFetch").then(function(r){
        return drvKeys(sec).then(function(k){ return fyOpen(k.key, r.data); }).then(function(obj){
          var d=(obj && obj.data)||{}, nt=(d.entries||[]).length, nc=(d.comptes||[]).length, nf=(d.factures||[]).length;
          var sh=uiSheet('<div class="sheet-title">Sauvegarde lisible ✓</div><div class="ui-intro">'+esc("Dernière sauvegarde : "+drvWhen(r.created)+" · "+nt+" ticket"+(nt>1?"s":"")+", "+nc+" compte"+(nc>1?"s":"")+(nf?", "+nf+" facture"+(nf>1?"s":""):"")+".")+'<br>'+esc((r.count||1)+" sauvegarde"+((r.count||1)>1?"s":"")+" sur ton Drive. Rien n'a été changé sur ce téléphone.")+'</div><div class="ui-stack"><button type="button" class="btn primary ui-no">OK</button></div>');
          sh.q(".ui-no").onclick=sh.close;
        }, function(){ uiToast("Sauvegarde illisible avec la clé de ce téléphone"); });
      }).catch(function(e){ var m=String((e && (e.code||e.message))||""); uiToast(/auth/.test(m) ? "Reconnecte ton compte Google (écran de la sauvegarde)" : (/none/.test(m) ? "Aucune sauvegarde sur Drive pour l'instant" : "Lecture impossible : "+((e && e.message)||"réseau"))); });
    }
    // état relu : redessine l'accueil ou l'écran de la sauvegarde s'il a changé ; tant qu'un envoi attend, relu toutes les 20 s
    var drvWatchTm=0;
    function drvWatch(kick){
      clearTimeout(drvWatchTm);
      if(!drvOn() || !drvNative() || document.hidden) return;
      var st0=drvSt||{};
      (kick && st0.pendingSince ? npCall("driveSendNow").catch(function(){}) : Promise.resolve()).then(drvRefresh).then(function(st){
        var sig=JSON.stringify(st||{}); if(sig!==drvSig0){ drvSig0=sig; if(state.view==="list" || state.view==="drive") render(); }
        if(st && st.pendingSince) drvWatchTm=setTimeout(function(){ drvWatch(false); }, 20000);
      });
    }
    document.addEventListener("visibilitychange", function(){
      if(!drvOn()) return;
      if(document.hidden){ clearTimeout(drvWatchTm); drvPrep(false); }
      else drvWatch(true);   // au retour : si un envoi attend, Android le relance tout de suite
    });
    window.addEventListener("online", function(){ setTimeout(function(){ drvWatch(true); }, 2000); });   // le réseau revient
    setTimeout(function(){ drvWatch(true); }, 1000);
    setTimeout(function(){
      drvUndo();   // l'état d'avant une restauration est retiré au bout de 30 jours
      var rs=store.read("driveRestored", null); if(rs && rs.banner && !rs.sig){ rs.sig=drvHash(JSON.stringify(backupDump().data)); store.write("driveRestored", rs); }
      if(store.read("driveUndone", null)){ store.remove("driveUndone"); uiToast("Restauration annulée : tes données d'avant sont revenues"); }
    }, 1200);
    // ----- Restaurer depuis Drive (étape 2) -----
    // driveUndo {at, dump} : l'état d'avant, gardé 30 jours (« Annuler la restauration ») ;
    // driveRestored {at, from, n, nc, sig, banner, newPhone} : pour le bandeau de l'accueil, retiré à la 1re modification.
    var drvRestoring=false;
    function drvWhenLong(t){
      // listes dans la fonction : elle sert dès le premier affichage, avant que cette partie du script ait tourné
      var DRV_JOURS=["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"], DRV_MOIS=["janv.","févr.","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc."];
      var d=new Date(t), n=new Date(), d0=new Date(d.getFullYear(), d.getMonth(), d.getDate()), n0=new Date(n.getFullYear(), n.getMonth(), n.getDate());
      var days=Math.round((n0-d0)/86400000), hm=drv2(d.getHours())+":"+drv2(d.getMinutes()), dm=d.getDate()+" "+DRV_MOIS[d.getMonth()]+(d.getFullYear()!==n.getFullYear()?" "+d.getFullYear():"");
      if(days===0) return "Aujourd'hui "+hm; if(days===1) return "Hier "+hm;
      if(days<7) return capFirst(DRV_JOURS[d.getDay()])+" "+dm+" "+hm;
      return dm+" "+hm;
    }
    function drvAgo(t){ var m=Math.max(1, Math.round((Date.now()-t)/60000)); return m<60 ? m+" min" : (m<2880 ? Math.round(m/60)+" h" : Math.round(m/1440)+" jours"); }
    function drvUndo(){ var u=store.read("driveUndo", null); if(u && Date.now()-u.at>30*86400000){ store.remove("driveUndo"); return null; } return u; }
    // Membre d'un foyer : le foyer est sauvegardé par le propriétaire ; « Mes comptes » a sa propre sauvegarde (Drive ou fichier, son code à lui)
    function drvMemberSheet(){
      var own=(fyCfg && fyCfg.owner)||"le propriétaire", on=!!drvCfg().on;
      uiChoice("Sauvegarder et restaurer", esc("Les données du foyer sont sauvegardées par "+own+" : sur un nouveau téléphone, il suffit de rejoindre à nouveau le foyer.")+
        '<div style="margin-top:8px">'+esc("Ta seule sauvegarde à faire : celle de ton espace « Mes comptes », sur ton Google Drive, avec ton code de secours à toi. Personne du foyer ne peut la lire.")+'</div>'+
        (on ? '<div style="margin-top:8px;color:var(--accent)">'+esc("☁️ Sauvegarde Drive de Mes comptes : activée")+'</div>' : ''), [
        { l:"🔒 Aller dans Mes comptes", fn:espacePerso } ]);
    }
    function drvMemberNo(){ uiToast("Tes données viennent du foyer : quitte le foyer avant de restaurer une sauvegarde"); }
    // Écran : liste des sauvegardes
    function drvRestoreOpen(){
      if(fyMember()){ drvMemberNo(); return; }
      state.drvList=null; state.drvKf=""; state.view="driverest"; render(); window.scrollTo(0,0);
      var sec=state.drvNew ? state.drvNew.sec : drvSec();
      (sec ? drvKeys(sec).then(function(k){ state.drvKf=k.kf; }) : Promise.resolve()).then(function(){ return npCall("driveList"); }).then(function(r){ state.drvList=r||{ files:[] }; if(state.view==="driverest") render(); })
        .catch(function(e){ var m=String((e && (e.code||e.message))||""); state.drvList={ files:[], err:/auth/.test(m) ? "auth" : ((e && e.message)||"réseau") }; if(state.view==="driverest") render(); });
    }
    function renderDriveRest(){
      var L=state.drvList, h=header("list", "Restaurer")+'<section class="paper">';
      h+='<div class="center muted" style="font-size:11px;letter-spacing:.18em;text-transform:uppercase">Restaurer depuis Drive</div><hr class="rule">';
      if(!L) h+='<div class="drv-card"><div class="drv-big">Lecture de la liste…</div><div class="drv-prog"><i></i></div></div>';
      else if(L.err) h+='<div class="drv-card"><div class="drv-big">Liste indisponible</div><div class="drv-sub">'+esc(L.err==="auth" ? "Reconnecte ton compte Google (écran de la sauvegarde)." : "Pas de réseau ou Drive indisponible : réessaie.")+'</div></div>';
      else if(!L.files.length) h+='<div class="drv-card"><div class="drv-big">Aucune sauvegarde sur Drive</div></div>';
      else {
        var wk=Date.now()-7*86400000, recent=L.files.filter(function(f){ return f.created>=wk; }), old=L.files.filter(function(f){ return f.created<wk; });
        function rows(A){ return '<div class="dr-grp" style="margin-top:6px">'+A.map(function(f){
          var i=L.files.indexOf(f), n=+f.n||0, c=+f.c||0, other=state.drvKf && f.kf && f.kf!==state.drvKf;
          return '<button type="button" class="dr-row tall drv-f" data-i="'+i+'"'+(other?' disabled style="opacity:.5"':'')+'><span class="t">'+esc(drvWhenLong(f.created))+'<small>'+esc(other ? "autre clé : ne s'ouvre pas avec ton code" : n+" ticket"+(n>1?"s":"")+(c?" · "+c+" compte"+(c>1?"s":""):""))+'</small></span><span class="st" style="color:var(--muted)">'+(i===0?"la plus récente":"›")+'</span></button>'; }).join("")+'</div>'; }
        if(recent.length) h+='<div class="sto-h">Cette semaine</div>'+rows(recent);
        if(old.length) h+='<div class="sto-h">Plus anciennes</div>'+rows(old);
        if(state.drvNew) h+='<div class="drv-card drv-sub">Les photos des tickets ne sont pas sur Drive : elles reviennent avec une sauvegarde complète (ZIP), par Menu › Sauvegarde › Depuis un fichier.</div>';
      }
      h+='</section>';
      app.innerHTML=h; setNav(null,false);
      bindBack(function(){ if(state.drvNew){ state.drvNew=null; state.view="list"; render(); return; } state.view="drive"; render(); });
      [].forEach.call(app.querySelectorAll(".drv-f"), function(b){ b.onclick=function(){ var f=L.files[+b.getAttribute("data-i")]; if(f) drvRestoreAsk(f); }; });
    }
    // Confirmation : téléphone et sauvegarde côte à côte, avertissements
    function drvRestoreAsk(f){
      var L=state.drvList||{ files:[] }, nNow=state.entries.length, cNow=comptes.filter(function(a){ return a.key!=="__tickets"; }).length, n=+f.n||0, c=+f.c||0;
      var dev=L.dev||(drvSt||{}).dev||"", lastOther=L.files.filter(function(x){ return x.d && x.d!==dev; })[0];
      var warn=[];
      if(lastOther && Date.now()-lastOther.created<7*86400000) warn.push("Le téléphone qui fait ces sauvegardes en a envoyé une il y a "+drvAgo(lastOther.created)+". S'il sert encore, n'utilise pas les deux : leurs sauvegardes se mélangeraient.");
      if(fyCfg && fyCfg.role==="owner") warn.push("Tes membres verront aussi les données restaurées à leur prochaine mise à jour.");
      var nw=!!state.drvNew;
      var s=uiSheet('<div class="sheet-title">'+esc((nw?"Restaurer ":"Revenir au ")+drvWhenLong(f.created).replace(/^Aujourd'hui/,"aujourd'hui").replace(/^Hier/,"hier"))+' ?</div>'+
        (nw ? '' : '<div class="drv-card" style="margin-top:4px"><div class="drv-kv"><span>Sur le téléphone</span><span>'+nNow+' tickets · '+cNow+' comptes</span></div><div class="drv-kv"><span>Sauvegarde</span><span>'+n+' tickets'+(c?' · '+c+' comptes':'')+'</span></div></div>')+
        '<ul class="drv-bul" style="margin-top:10px">'+(nw ? '<li><i>✓</i><span>Tes tickets, comptes, frais fixes, épargne et factures reviennent sur ce téléphone.</span></li>'+(canUse("drive") ? '<li><i>☁️</i><span><b>La sauvegarde automatique sur Google Drive sera activée</b> sur ce téléphone'+(state.drvNew.email?' ('+esc(state.drvNew.email)+')':'')+', avec la même clé. Tu pourras la désactiver dans Menu › Sauvegarde › Sauvegarde Google Drive.</span></li>' : '<li><i>✓</i><span>Les photos des tickets ne reviennent pas : elles sont dans la sauvegarde complète (ZIP).</span></li>')+''
          : '<li><i>↩</i><span>Les données du téléphone sont <b>remplacées</b> par celles de la sauvegarde.</span></li><li><i>✓</i><span>L\'état actuel est gardé 30 jours : <b>« Annuler la restauration »</b> le remet. Il part aussi sur Drive avant, s\'il y a du réseau.</span></li><li><i>✓</i><span>Les photos des tickets restent sur le téléphone ; ton code, ton empreinte et tes réglages ne changent pas.</span></li>')+'</ul>'+
        warn.map(function(w){ return '<div class="bk-banner drv" style="margin:10px 0 0;font-size:12px"><span>⚠</span><div>'+esc(w)+'</div></div>'; }).join("")+
        '<div class="ui-stack" style="margin-top:12px"><button type="button" class="btn primary" id="drvRsOk">Restaurer</button><button type="button" class="btn ghost ui-no">Annuler</button></div>');
      s.q(".ui-no").onclick=s.close;
      s.q("#drvRsOk").onclick=function(){ s.close(); drvRestoreDo(f); };
    }
    // avant de restaurer : l'état actuel part sur Drive (15 s au plus, sinon on continue : il reste gardé sur le téléphone)
    function drvSendFirst(){
      if(!drvOn() || state.drvNew) return Promise.resolve();
      return drvPrep(true).then(function(){ return npCall("driveSendNow"); }).then(function(){
        return new Promise(function(res){ var n=0; (function w(){ npCall("driveStatus").then(function(st){ if(!st || !st.pendingSince || ++n>=8) res(); else setTimeout(w, 2000); }, function(){ res(); }); })(); });
      }).catch(function(){});
    }
    function drvRestoreDo(f){
      if(fyMember()){ drvMemberNo(); return; }
      var sec=state.drvNew ? state.drvNew.sec : drvSec(); if(!sec){ uiToast("Clé introuvable sur ce téléphone"); return; }
      uiToast("Restauration…");
      drvSendFirst().then(function(){ drvRestoring=true; return npCall("driveFetch", { id:f.id }); }).then(function(r){
        return drvKeys(sec).then(function(k){ return fyOpen(k.key, r.data); });
      }).then(function(obj){
        var d=(obj && obj.data)||{}, nw=state.drvNew;
        store.write("driveUndo", { at:Date.now(), from:f.created, dump:backupDump() });
        store.write("driveRestored", { at:Date.now(), from:f.created, n:(d.entries||[]).length, nc:(d.comptes||[]).length, banner:true, newPhone:!!nw, drv:!nw || canUse("drive") });
        store.write("driveSig", "");
        if(nw && canUse("drive")){   // nouveau téléphone : la sauvegarde Drive continue ici, avec la même clé (sans Plus : restaurer seulement)
          store.write("driveSec", fyB64u(nw.sec)); var cc=drvCfg(); cc.on=true; cc.email=nw.email||cc.email||""; if(!cc.since) cc.since=Date.now(); store.write("driveCfg", cc);
          var rc=rapCfg(); npCall("driveSetup", { on:true, remind:!!(rc.on && rc.bk) }).catch(function(){});
          store.write("drvActMsg", { email:cc.email||"" });   // dit au redémarrage que la sauvegarde Drive est activée (08/11)
        }
        restoreApply(obj, null, { quiet:true, exact:true, sec:sec });
      }).catch(function(e){ drvRestoring=false; var m=String((e && (e.code||e.message))||"");
        uiToast(/auth/.test(m) ? "Reconnecte ton compte Google, puis réessaie" : (/OperationError|format|decrypt/i.test(m) || !(e && e.code) ? "Sauvegarde illisible avec ce code" : "Restauration impossible : "+((e && e.message)||"réseau"))); });
    }
    // Après la restauration sur un nouveau téléphone : la sauvegarde Drive a été activée, le dire clairement (une fois)
    function drvActAuto(n){
      var m=store.read("drvActMsg", null); if(!m) return;
      if(document.getElementById("lockscreen") || document.querySelector(".sheet-overlay")){ if((n||0)<200) setTimeout(function(){ drvActAuto((n||0)+1); }, 700); return; }
      store.remove("drvActMsg");
      var sh=uiSheet('<div class="sheet-title">Restauré ✓</div><div class="ui-msg"><b>☁️ Sauvegarde Google Drive activée</b><br><small style="color:var(--ink-soft)">Chaque fois que tu quittes l\'appli, tes données partent chiffrées sur ton Drive'+(m.email?' ('+esc(m.email)+')':'')+'. Tu peux la désactiver dans Menu › Sauvegarde › Sauvegarde Google Drive.</small></div>'+
        '<div class="ui-actions"><button type="button" class="btn ghost" id="drvActGo">Réglages Drive</button><button type="button" class="btn primary ui-yes">OK</button></div>');
      sh.q(".ui-yes").onclick=sh.close;
      sh.q("#drvActGo").onclick=function(){ sh.close(); state.view="drive"; render(); window.scrollTo(0,0); drvRefresh().then(function(){ if(state.view==="drive") render(); }); };
    }
    function drvUndoAsk(){
      var u=drvUndo(); if(!u){ uiToast("Plus rien à annuler"); return; }
      var n=((u.dump && u.dump.data && u.dump.data.entries)||[]).length;
      uiConfirm("Annuler la restauration ?<br><small style=\"color:var(--ink-soft)\">Les données d'avant la restauration ("+n+" ticket"+(n>1?"s":"")+", "+esc(drvWhenLong(u.at).toLowerCase())+") reviennent sur le téléphone.</small>", function(){
        drvRestoring=true; store.remove("driveUndo"); store.remove("driveRestored"); store.write("driveSig", ""); store.write("driveUndone", 1);
        restoreApply(u.dump, null, { quiet:true, exact:true });
      }, { ok:"Annuler la restauration" });
    }
    // Nouveau téléphone (ou Réglages › Restaurer) : compte Google, code de secours, puis la liste
    function drvNewPhone(){
      if(fyMember()){ drvMemberNo(); return; }
      if(!drvNative()){ uiToast("Installe la nouvelle version de l'appli pour restaurer depuis Drive"); return; }
      uiToast("Connexion à Google…");
      npCall("driveConnect").then(function(r){
        r=r||{};
        if(!r.count){ uiToast("Aucune sauvegarde de "+APP_NAME+" sur ce compte Google"); return; }
        var mine=drvSec();
        (mine ? drvKeys(mine) : Promise.resolve(null)).then(function(k){
          if(k && (r.kfs||[]).indexOf(k.kf)>=0){ drvNewList(mine, r); return; }
          drvAskCode(r, function(sec){ drvNewList(sec, r); }, { title:"Restaurer depuis Drive", noZero:true });
        });
      }).catch(function(e){ var m=String((e && (e.code||e.message))||e||""); if(/cancel/i.test(m)) return; uiToast((e && e.message) || "Connexion Google impossible"); });
    }
    function drvNewList(sec, r){ state.drvNew=drvOn() ? null : { sec:sec, email:r.email||"" }; drvRestoreOpen(); }
    function drvRestoreChooser(){
      if(fyMember()){ drvMemberNo(); return; }
      if(!drvNative()){ restorein.click(); return; }
      uiChoice("Restaurer une sauvegarde", esc("Elle remplace les données du téléphone."), [
        { l:"☁️ Depuis Google Drive", fn:function(){ if(drvOn()) drvRestoreOpen(); else drvNewPhone(); } },
        { l:"📂 Depuis un fichier (ZIP ou JSON)", primary:false, fn:function(){ restorein.click(); } } ]);
    }


    var RAP_DEF={ on:false, h:9, frais:true, vir:true, bud:true, bk:true }, RAP_BUD0=900000, rapSig="", rapTm=0, rapLsn=false;
    function rapCfg(){ var c=store.read("rappels", null)||{}, o={}; Object.keys(RAP_DEF).forEach(function(k){ o[k]=(k in c) ? c[k] : RAP_DEF[k]; }); return o; }
    function rapLN(){ var L=capPlugin("LocalNotifications"); return (L && typeof L.schedule==="function") ? L : null; }
    function rapAt(iso, h){ var d=new Date(iso+"T00:00:00"); d.setHours(h, 0, 0, 0); return d; }
    function rapISO(m, d){ return m+"-"+(d<10?"0":"")+d; }
    function rapShift(iso, n){ var d=new Date(iso+"T12:00:00"); d.setDate(d.getDate()+n); return d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2)+"-"+("0"+d.getDate()).slice(-2); }
    // ce qui est à rappeler dans les 14 prochains jours : [{at, title, body, go}]
    function rapPlan(now){
      var c=rapCfg(), out=[], me=mePerson(), mem=fyMember(), cur=monthKey(todayISO()), ms=[cur, nextMonthKey(cur)], lim=now.getTime()+14*86400000;
      function add(at, t, b, go){ if(at.getTime()>now.getTime()+30000 && at.getTime()<=lim) out.push({ at:at, title:t, body:b, go:go }); }
      if(c.frais) ms.forEach(function(m){ fraisCommuns.forEach(function(f){
        if(!fraisActif(f, m) || fraisDone(f, m)) return;
        if(mem && (f.personne||"").trim()!==me && !f.split) return;   // membre : ses frais, et sa part des frais « chacun sa part »
        var d=fraisDay(f, m), v=fraisMontant(f, m); if(!d || !(v>0)) return;
        var a=acctByKey(f.compte), where=a ? " · "+a.nom : "";
        add(rapAt(rapShift(rapISO(m, d), -1), c.h), (f.aPayer ? "Facture à payer demain : " : "Demain : ")+(f.label||"frais fixe"), fmtS(v)+(f.aPayer ? "" : " prélevé"+where), "avenir");
      }); });
      if(c.vir) ms.forEach(function(m){ virements.forEach(function(v){
        if(v.month!==m || v.done) return; var d=virDay(v), a=Number(v.montant)||0; if(!d || !a) return;
        add(rapAt(rapISO(m, d), c.h), (a<0 ? "Virement à faire aujourd'hui : " : "Virement attendu aujourd'hui : ")+(v.label||"virement"), fmtS(Math.abs(a))+" · touche « fait » dans Compte quand il est passé", "compte");
      }); });
      if(c.bk && !mem && state.entries.length && !drvOn()){
        var lb=store.read("lastBackup", null), base=lb ? new Date(lb) : new Date(store.read("rappelsBk0", null) || now.toISOString());
        if(!lb && !store.read("rappelsBk0", null)) store.write("rappelsBk0", now.toISOString());
        var due=new Date(base.getTime()+7*86400000), at=new Date(due.getTime()); at.setHours(c.h, 0, 0, 0); if(at<due) at.setDate(at.getDate()+1);
        if(at.getTime()<=now.getTime()+30000){ at=new Date(now.getTime()); at.setHours(c.h, 0, 0, 0); if(at.getTime()<=now.getTime()+30000) at.setDate(at.getDate()+1); }
        add(at, "Pense à sauvegarder", "Ta dernière sauvegarde date de plus de 7 jours : Menu › Sauvegarde.", "backup");
      }
      out.sort(function(a,b){ return a.at-b.at; });
      return out.slice(0, 50);
    }
    // budgets à 80 % et dépassés ce mois-ci : à prévenir tout de suite (une fois par mois et par budget)
    function rapBudgets(){
      var c=rapCfg(); if(!c.bud) return [];
      var m=monthKey(todayISO()), me=mePerson(), sent=store.read("rappelsBud", {})||{}, out=[], E=state.entries.filter(function(e){ return monthKey(e.date)===m; });
      function chk(B, who, lbl){ Object.keys(B||{}).forEach(function(cat){ var b=Number(B[cat])||0; if(!(b>0)) return;
        var sp=0; E.forEach(function(e){ if(catIn(e.categorie, cat) && (!who || payerOf(e)===who)) sp+=Number(e.montant)||0; });
        var r=sp/b, lv=r>1 ? 100 : (r>=0.8 ? 80 : 0); if(!lv) return;
        var k=m+"|"+(who||"__foyer")+"|"+cat; if((sent[k]||0)>=lv) return;
        out.push({ k:k, lv:lv, title:"Budget "+cat+(lbl||"")+" : "+Math.round(r*100)+" %", body:lv===100 ? "Dépassé de "+fmtS(sp-b)+" ce mois-ci." : "Plus que "+fmtS(b-sp)+" pour finir le mois.", go:"budgets" }); }); }
      if(!fyMember()) chk(budgets, null, "");
      chk(budgetsP[me], me, fyMember() ? "" : " (toi)");
      return out;
    }
    function rapSync(force){
      clearTimeout(rapTm); if(DEMO) return;   // démo : les rappels du téléphone restent ceux des vraies données
      rapTm=setTimeout(function(){
        var L=rapLN(), c=rapCfg(); if(!L) return;
        rapListen(L);
        var now=new Date(), plan=c.on ? rapPlan(now) : [], bud=c.on ? rapBudgets() : [];
        var sig=JSON.stringify(plan.map(function(x){ return [+x.at, x.title, x.body]; }))+"|"+c.h;
        if(!force && sig===rapSig && !bud.length) return; rapSig=sig;
        var N=plan.map(function(x, i){ return { id:i+1, title:x.title, body:x.body, channelId:"tk-rappels", smallIcon:"tk_ic_notif", schedule:{ at:x.at, allowWhileIdle:true }, extra:{ go:x.go } }; });
        var sent=store.read("rappelsBud", {})||{};
        bud.forEach(function(x, i){ N.push({ id:RAP_BUD0+(Date.now()%90000)+i, title:x.title, body:x.body, channelId:"tk-rappels", smallIcon:"tk_ic_notif", schedule:{ at:new Date(Date.now()+2000) }, extra:{ go:x.go } }); sent[x.k]=x.lv; });
        if(bud.length) store.write("rappelsBud", sent);
        Promise.resolve(L.getPending ? L.getPending() : { notifications:[] }).then(function(p){
          var old=((p && p.notifications)||[]).filter(function(n){ return +n.id<RAP_BUD0; }).map(function(n){ return { id:n.id }; });
          return old.length ? L.cancel({ notifications:old }) : null;
        }).then(function(){ return N.length ? L.schedule({ notifications:N }) : null; }).catch(function(e){ rapSig=""; try{ console.warn("rappels", e); }catch(_){} });
      }, force ? 0 : 1500);
    }
    function rapListen(L){
      if(rapLsn || !L.addListener) return; rapLsn=true;
      try{ L.addListener("localNotificationActionPerformed", function(a){ var go=a && a.notification && a.notification.extra && a.notification.extra.go; if(go) rapOpen(go); }); }catch(e){}
    }
    // rappel touché : l'appli s'ouvre sur ce qu'il annonce
    function rapOpen(go){
      if(document.getElementById("lockscreen")){ var n=0, iv=setInterval(function(){ if(!document.getElementById("lockscreen") || ++n>240){ clearInterval(iv); if(n<=240) rapOpen(go); } }, 500); return; }
      if(go==="backup"){ backupData(); return; }
      if(go==="avenir"){ state.avnSub="mois"; state.view="factures"; }
      else if(go==="compte"){ state.cptPage=null; state.cptF="av"; state.view="compte"; }
      else if(go==="budgets"){ state.depSub="budgets"; state.view=depView(); }
      render(); window.scrollTo(0,0);
    }
    function rapChannel(L){ try{ if(L.createChannel) return Promise.resolve(L.createChannel({ id:"tk-rappels", name:"Rappels", description:"Prélèvements, factures, virements, budgets et sauvegarde", importance:4, visibility:0 })).catch(function(){}); }catch(e){} return Promise.resolve(); }
    function rapSettings(){
      var c=rapCfg(), L=rapLN(), mem=fyMember();
      var T=[["frais","Prélèvement ou facture demain"],["vir","Virement à faire ou attendu le jour même"],["bud","Budget à 80 % et dépassé"]]; if(!mem) T.push(["bk","Sauvegarde de plus de 7 jours"]);
      var hrs=[]; for(var i=7;i<=21;i++) hrs.push(i);
      var s=uiSheet('<div class="sheet-title">Rappels</div><div class="ui-intro">'+(L ? "Des notifications sur ce téléphone, même appli fermée et sans internet. Rien ne s'affiche sur l'écran verrouillé." : "Les rappels marchent dans l'appli Android, même sans internet.")+'</div>'+
        '<label class="csv-ck rap-main"><input type="checkbox" id="rapOn"'+(c.on?' checked':'')+(L?'':' disabled')+'><span><b>Activer les rappels</b></span></label>'+
        '<div id="rapOpts"'+(c.on?'':' style="opacity:.5"')+'>'+T.map(function(x){ return '<label class="csv-ck"><input type="checkbox" data-r="'+x[0]+'"'+(c[x[0]]?' checked':'')+(L?'':' disabled')+'><span>'+esc(x[1])+'</span></label>'; }).join("")+
        '<label class="f">Heure des rappels</label><select class="f" id="rapH"'+(L?'':' disabled')+'>'+hrs.map(function(h){ return '<option value="'+h+'"'+(h===c.h?' selected':'')+'>'+h+' h</option>'; }).join("")+'</select></div>'+
        '<div class="muted" id="rapNext" style="font-size:12px;margin:10px 2px 0"></div>'+
        '<div class="ui-stack" style="margin-top:12px">'+(L?'<button type="button" class="btn primary" id="rapOk">Enregistrer</button>':'')+'<button type="button" class="btn ghost ui-no">Fermer</button></div>');
      s.q(".ui-no").onclick=s.close;
      function nextTxt(){ if(!c.on) return ""; var P=rapPlan(new Date()); if(!P.length) return "Rien à rappeler dans les 14 prochains jours.";
        var x=P[0], d=x.at; return P.length+" rappel"+(P.length>1?"s":"")+" prévu"+(P.length>1?"s":"")+" dans les 14 jours. Prochain : "+("0"+d.getDate()).slice(-2)+"/"+("0"+(d.getMonth()+1)).slice(-2)+" à "+d.getHours()+" h · "+x.title; }
      s.q("#rapNext").textContent=nextTxt();
      s.q("#rapOn").onchange=function(){ s.q("#rapOpts").style.opacity=this.checked ? "" : ".5"; };
      var ok=s.q("#rapOk"); if(ok) ok.onclick=function(){
        var n={ on:s.q("#rapOn").checked, h:+s.q("#rapH").value }; [].forEach.call(s.qa("input[data-r]"), function(b){ n[b.getAttribute("data-r")]=b.checked; }); if(mem) n.bk=c.bk;
        function save(){ store.write("rappels", n); s.close(); rapSync(true); if(drvOn()) npCall("driveSetup", { remind:!!(n.on && n.bk) }).catch(function(){}); uiToast(n.on ? "Rappels activés" : "Rappels désactivés"); }
        if(!n.on){ save(); return; }
        Promise.resolve(L.requestPermissions ? L.requestPermissions() : { display:"granted" }).then(function(p){
          if(p && p.display && p.display!=="granted"){ uiToast("Autorise les notifications de "+APP_NAME+" dans les réglages du téléphone"); return; }
          return rapChannel(L).then(save);
        }).catch(function(){ uiToast("Notifications refusées par le téléphone"); });
      };
    }
    document.addEventListener("visibilitychange", function(){ if(document.hidden) rapSync(true); });
    setTimeout(function(){ try{ if(corbPurge(false)) render(); }catch(e){} }, 1500);   // tickets de plus de 30 jours dans la corbeille
    setTimeout(function(){ rapSync(true); }, 900);

    var wLast="", wTimer=0;
    // Appel sûr d'une fonction Android (ancienne appli installée : la fonction peut manquer)
    function npCall(name, arg){
      if(DEMO && /^(drive|widget|shared)/.test(name)) return Promise.reject(new Error("démo"));   // ni Drive, ni widgets, ni relevé partagé en démo
      var NP=capPlugin("TicketsNative"); if(!NP || typeof NP[name]!=="function") return Promise.reject(new Error("indisponible"));
      try{ return Promise.resolve(NP[name](arg)); }catch(e){ return Promise.reject(e); }
    }
    function pushWidgets(now){
      if(!capNative() || DEMO) return;
      clearTimeout(wTimer);
      wTimer=setTimeout(function(){
        try{ var j=JSON.stringify(widgetSnapshot()), cmp=j.replace(/"t":\d+,/,""); if(cmp===wLast) return; wLast=cmp;
          npCall("widgetData", { json:j }).catch(function(){ wLast=""; }); }catch(e){ try{ console.warn(e); }catch(_){} }
      }, now?0:1500);
    }
    // Un widget a été touché : l'appli s'ouvre sur l'onglet voulu (Scan : directement l'appareil photo)
    function widgetLaunch(){
      npCall("launchTarget").then(function(r){ var t=r && r.target; if(t) openFromWidget(t); }).catch(function(){});
    }
    function openFromWidget(t){
      if(document.getElementById("lockscreen")){ var n=0, iv=setInterval(function(){ if(!document.getElementById("lockscreen") || ++n>240){ clearInterval(iv); if(n<=240) openFromWidget(t); } }, 500); return; }
      if(t==="plus"){ plusShow("widgets"); return; }
      if(t==="drive"){ state.view="drive"; render(); window.scrollTo(0,0); drvRefresh().then(function(){ if(state.view==="drive") render(); }); return; }
      if(t==="scan"){ state.view="list"; render(); widgetScan(); return; }
      if(t==="compte_foyer" || t==="foyer") state.compteSel=(comptes.length>1)?"__all":myAcct().key;
      else if(t==="compte") state.compteSel=myAcct().key;
      var map={ compte:"compte", compte_foyer:"compte", foyer:"compte", communes:"communes", mois:"list", bourse:(FEAT.bourse?"bourse":"list") };
      state.view=map[t]||"list"; render(); window.scrollTo(0,0);
    }
    function widgetScan(){
      if(fyMember() && (fyCfg.role==="view" || !fyTabEd("list"))){ uiToast("Lecture seule : tu ne peux pas ajouter de ticket"); return; }
      var NPd=capPlugin("TicketsNative"); if(NPd && typeof NPd.scanDoc==="function"){ docScan(3, function(fs){ filein.onchange({ target:{ files:fs, value:"" } }); }, widgetCam); return; }
      widgetCam();
    }
    function widgetCam(){
      var Cam=capPlugin("Camera"); if(!Cam || typeof Cam.getPhoto!=="function"){ openScanChooser(); return; }
      Cam.getPhoto({ quality:88, width:2400, resultType:"dataUrl", source:"CAMERA", correctOrientation:true, saveToGallery:false, allowEditing:false }).then(function(ph){
        var u=ph && ph.dataUrl; if(!u) return;
        var bin=atob(u.slice(u.indexOf(",")+1)), arr=new Uint8Array(bin.length); for(var i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
        filein.onchange({ target:{ files:[new File([arr], "ticket.jpg", { type:"image/jpeg" })], value:"" } });
      }).catch(function(e){ if(!/cancel/i.test(String((e&&e.message)||e||""))) openScanChooser(); });
    }
    document.addEventListener("visibilitychange", function(){ if(document.hidden) pushWidgets(true); else setTimeout(widgetLaunch, 300); });
    setTimeout(function(){ widgetLaunch(); pushWidgets(true); }, 600);

    // Mise à jour automatique : au retour dans l'appli, recharge si une nouvelle version β est en ligne
    // (pas dans l'appli Store : elle est dans l'APK et se met à jour par le Play Store)
    // Les vérifications (index.html?v=…) ne doivent pas s'entasser dans la copie hors ligne du navigateur.
    function swTidy(){
      try{ if(!window.caches) return; caches.keys().then(function(ns){ ns.forEach(function(n){ if(!/^tickets-shell/.test(n)) return;
        caches.open(n).then(function(c){ return c.keys().then(function(ks){ ks.forEach(function(k){ if(/[?&]v=\d/.test(k.url)) c.delete(k); }); }); }); }); }).catch(function(){}); }catch(e){}
    }
    if(!appLocal()) (function(){
      var cur=(document.querySelector('meta[name=build]')||{}).content||"", last=Date.now();
      function check(){
        if(document.visibilityState!=="visible" || Date.now()-last<60000) return;
        last=Date.now();
        fetch("./index.html?v="+Date.now(), { cache:"no-store" }).then(function(r){ return r.ok ? r.text() : ""; }).then(function(t){
          setTimeout(swTidy, 3000);
          var m=t && t.match(/<meta name="build" content="([^"]*)"/);
          if(!m || !cur || m[1]===cur) return;
          var ae=document.activeElement, typing=ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName);
          if(state.view==="form" || state.busy || typing) return;   // ne jamais couper une saisie en cours
          location.reload();
        }).catch(function(){});
      }
      document.addEventListener("visibilitychange", check);
      window.addEventListener("focus", check);
      setTimeout(function(){ last=0; check(); }, 8000);   // aussi juste après l'ouverture (au cas où une ancienne version a été servie)
    })();
    // Copie hors ligne : dans un navigateur, le service worker ; dans l'appli Android, pas de service worker :
    // l'appli Store est dans l'APK, et l'appli Perso récente (« TkOff » dans son identifiant) garde elle-même la page.
    if("serviceWorker" in navigator && capNative() && (appLocal() || /TkOff\//.test(navigator.userAgent||""))){
      try{ navigator.serviceWorker.getRegistrations().then(function(rs){ rs.forEach(function(r){ r.unregister(); }); }).catch(function(){}); }catch(e){}
      try{ if(window.caches) caches.keys().then(function(ns){ ns.forEach(function(n){ if(/^tickets-/.test(n)) caches.delete(n); }); }).catch(function(){}); }catch(e){}
    } else if("serviceWorker" in navigator){
      setTimeout(swTidy, 5000);
      window.addEventListener("load", function(){
        navigator.serviceWorker.register("../sw.js").then(function(reg){
          reg.update().catch(function(){});
        }).catch(function(){});
      });
      var swReloaded=false;
      navigator.serviceWorker.addEventListener("controllerchange", function(){
        if(swReloaded) return;
        swReloaded=true;
        window.location.reload();
      });
    }
  })();
