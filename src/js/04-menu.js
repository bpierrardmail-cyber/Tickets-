    // ---------- Menu (page à sous-onglets, 09/11) ----------
    // ☰ ouvre une page comme les onglets : Gérer · Sauvegarde · Réglages · Aide, et une recherche qui trouve un réglage où qu'il soit.
    // « Gérer » donne un 2e chemin vers ce qui se configure (comptes, catégories, frais fixes, provisions, factures, personnes…) :
    // chaque ligne ouvre l'écran qui existe déjà. Le retour d'un écran ouvert depuis le menu ramène au menu (state.fromMenu, bindBack).
    var MENU_SUBS=[["gerer","Gérer"],["sauv","Sauvegarde"],["regl","Réglages"],["aide","Aide"]];
    var MENU_QUICK=[["acc","Compte"],["frais","Frais fixe"],["prov","Provision"],["ep","Livret"],["cats","Catégorie"],["vrec","Virement mensuel"],["persons","Personne"]];
    function openMenu(sub){
      closeMenu();
      if(state.view!=="menu") state.menuPrev=state.view;
      state.view="menu"; state.fromMenu=null;
      if(typeof sub==="string") state.menuSub=sub;
      state.menuQ=""; render(); window.scrollTo(0,0);
    }
    // un écran avec ‹ ramène au menu ; un onglet (Budget, À venir…) n'a pas de ‹ : on y reste, la barre du bas sert à repartir
    function menuGo(fn){ var sub=state.menuSub; state.fromMenu={ sub:sub }; fn(); if(!document.getElementById("hback")) state.fromMenu=null; else state.fromMenu.v=state.view; }
    function menuClose(){ var v=state.menuPrev||(fyMember()?fyFirstTab():"list"); if(v==="menu") v="list"; state.menuPrev=null; state.view=v; render(); window.scrollTo(0,0); }
    function menuCodeShow(){
      if(fyCfg && fyCfg.role==="owner" && fyCfg.sec) return fyShowRecovery(false);
      var sec=drvSec();
      if(!sec){ uiChoice("Code de secours", "Tu n'as pas encore de code de secours : il est créé quand tu actives la sauvegarde Google Drive ou un foyer partagé. Il sert à ouvrir tes sauvegardes chiffrées sur un autre téléphone.", [{ l:"Sauvegarde Google Drive", fn:function(){ if(drvAvail()) drvIntro(); else uiToast("Sauvegarde Drive : dans l'appli Android"); } }]); return; }
      var code=fyCodeTxt(fyB64u(sec));
      var sh=uiSheet('<div class="sheet-title">Code de secours</div><div class="ui-intro">Avec ce code et ta sauvegarde (Google Drive ou fichier chiffré), tu retrouves tes données sur un nouveau téléphone. Garde-le sur papier, pas seulement sur ce téléphone.</div>'+
        '<div class="fy-code">'+esc(code)+'</div><div class="ui-stack"><button type="button" class="btn" id="mcCopy">Copier le code</button><button type="button" class="btn primary ui-no">Fermer</button></div>');
      sh.q(".ui-no").onclick=sh.close;
      sh.q("#mcCopy").onclick=function(){ try{ navigator.clipboard.writeText(code).then(function(){ uiToast("Code copié"); }, function(){ uiToast("Copie impossible : recopie-le"); }); }catch(e){ uiToast("Copie impossible : recopie-le"); } };
    }
    function menuWidgets(){
      var L=[["🧾","Fin de mois","ce qu'il te restera à la fin du mois"],["🏦","Solde","le solde d'un compte"],["👨‍👩‍👧","Foyer","tous les comptes du foyer"],["🤝","Commun","la part de chacun"],["🐷","Épargne","le total, gagné ce mois et sur 6 mois, la courbe et tes livrets"],["📷","Scanner","prendre un ticket en photo en un geste"]];
      if(FEAT.bourse) L.unshift(["📈","Bourse","ton portefeuille sur 24 h (appli Perso)"]);
      var plus=!canUse("widgets");
      var sh=uiSheet('<div class="sheet-title">Widgets</div>'+(plus?'<div class="muted" style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;margin:-4px 0 10px">✦ '+APP_NAME+' Plus</div>':'')+
        '<div class="ui-intro">Pour en ajouter un : appui long sur un endroit vide de l\'écran d\'accueil du téléphone › <b>Widgets</b> › <b>'+esc(APP_NAME)+'</b>.</div><div class="dr-grp">'+
        L.map(function(x){ return '<div class="dr-row tall"><span class="ic">'+x[0]+'</span><span class="t">'+esc(x[1])+'<small>'+esc(x[2])+'</small></span></div>'; }).join("")+'</div>'+
        '<div class="ui-intro" style="margin-top:10px;font-size:12.5px">Les montants sont masqués : touche-les pour les voir (empreinte ou code du téléphone). Appui long sur un widget pour le régler. En <b>économie d\'énergie</b>, Android met les mises à jour en pause ; elles reprennent en la quittant ou en ouvrant l\'appli.</div>'+
        '<div class="ui-stack" style="margin-top:10px">'+(plus?'<button type="button" class="btn primary" id="mwPlus">✦ Découvrir '+APP_NAME+' Plus</button>':'')+'<button type="button" class="btn ghost ui-no">Fermer</button></div>');
      sh.q(".ui-no").onclick=sh.close;
      var mp=sh.q("#mwPlus"); if(mp) mp.onclick=function(){ sh.close(); plusShow("widgets"); };
    }
    function menuAbout(){
      var b=(document.querySelector('meta[name=build]')||{}).content||"";
      uiChoice("À propos", APP_NAME+" · version β du "+b+(capNative()?(EDITION==="store"?" · appli Store":" · appli Perso"):" · navigateur")+". Tes données restent sur ce téléphone ; les sauvegardes et le foyer partagé sont chiffrés avant de partir, personne d'autre ne peut les lire.", []);
    }
    function menuLock(){
      if(!lockCfg) return lockSetup();
      var ch=[{ l:"Changer le code", fn:lockSetup }];
      fyCheckBio().then(function(){
        if(!lockCfg.bioId && fyBioOk) ch.push({ l:"Ajouter l'empreinte", fn:lockEnableBio });
        if(lockCfg.bioId) ch.push({ l:"Retirer l'empreinte", fn:lockBioOff });
        ch.push({ l:"Retirer le code", danger:true, fn:lockDisable });
        uiChoice("Code et empreinte", "Propres à ce téléphone"+(fyCfg?" : fortement conseillés avec le foyer partagé.":"."), ch); });
    }
    // toutes les lignes du menu : { k, tab, g (groupe), ic, t, s (sous-titre), st/stCol (état à droite), plus, kw (mots de recherche), fn }
    function menuItems(){
      var fyM=fyMember(), own=!fyM, fyFull=own || (fyCfg.role==="edit" && fyCfg.accts==null), cm=monthKey(todayISO()), L=[];
      function add(o){ L.push(o); }
      var plist=uniquePersons(); if(plist.indexOf(mePerson())<0) plist.unshift(mePerson());
      // Gérer
      if(fyM || persoOn()) add({ k:"perso", tab:"gerer", g:"Mon espace", ic:"🔒", t:persoOn()?"Foyer de "+persoOwner():"Mes comptes", s:persoOn()?"revenir au foyer":"tes comptes à toi, privés", kw:"perso privé espace", fn:persoOn()?espaceFoyer:espaceAsk });
      if(own){
        var nA=comptes.filter(function(a){ return a.key!=="__tickets"; }).length, nE=epargne.filter(function(e){ return !e.closed && !e.bourseLink; }).length;
        add({ k:"acc", tab:"gerer", g:"Argent", ic:"🏦", t:"Comptes bancaires", s:"créer, renommer, principal, solde de départ", n:nA, kw:"compte banque créer ajouter principal solde", fn:function(){ gerOpen("acc"); }, add:function(){ menuCreate(function(){ acctForm(null); }); } });
        add({ k:"ep", tab:"gerer", g:"Argent", ic:"🐷", t:"Épargne et livrets", s:"livrets, assurance-vie", n:nE, kw:"épargne livret assurance", fn:function(){ gerOpen("ep"); }, add:function(){ menuCreate(addEpargne); } });
        add({ k:"liq", tab:"gerer", g:"Argent", ic:"💶", t:"Argent liquide", s:"l'argent en poche, ce mois", kw:"liquide espèces", fn:function(){ liqEdit(myAcct().key, cm); } });
        var nF=fraisCommuns.filter(function(f){ return fraisActif(f, cm); }).length, nP=provisions.length, nV=virRec.filter(function(r){ return !r.to || r.to>=cm; }).length;
        add({ k:"frais", tab:"gerer", g:"Ce qui revient chaque mois", ic:"📌", t:"Frais fixes", s:fmt(gerFraisTotal(cm))+" ce mois · prélèvements, abonnements", n:nF, kw:"frais fixe prélèvement abonnement loyer crédit", fn:function(){ gerOpen("frais"); }, add:function(){ menuCreate(addFraisCommun); } });
        add({ k:"vrec", tab:"gerer", g:"Ce qui revient chaque mois", ic:"🔁", t:"Virements chaque mois", s:"salaires, épargne programmée", n:nV, kw:"virement mensuel salaire épargne programmée", fn:function(){ gerOpen("vrec"); }, add:function(){ menuCreate(virRecNew); } });
        add({ k:"prov", tab:"gerer", g:"Ce qui revient chaque mois", ic:"🫙", t:"Provisions", s:"mettre de côté pour une grosse dépense", n:nP, kw:"provision mise de côté", fn:function(){ gerOpen("prov"); }, add:function(){ menuCreate(addProvision); } });
        add({ k:"fact", tab:"gerer", g:"Ce qui revient chaque mois", ic:"🧾", t:"Factures et fournisseurs", plus:!canUse("factures"), s:"électricité, eau, internet…", n:factSeries().length, kw:"facture fournisseur électricité gaz eau internet", fn:function(){ menuGo(function(){ state.view="factures"; state.avnSub="fact"; render(); window.scrollTo(0,0); }); }, add:function(){ if(canUse("factures")) factImportChooser(); else plusShow("factures"); } });
        add({ k:"cats", tab:"gerer", g:"Dépenses", ic:"🏷️", t:"Catégories", s:"grandes catégories et sous-catégories", n:catMains().length, kw:"catégorie sous-catégorie famille", fn:function(){ gerOpen("cats"); }, add:function(){ menuCreate(function(){ catNewForm(null); }); } });
        add({ k:"prods", tab:"gerer", g:"Dépenses", ic:"🛒", t:"Articles", s:"la catégorie de chaque article", n:Object.keys(store.read("familleDe", {})||{}).length, kw:"produit article", fn:function(){ menuGo(function(){ state.prodFrom="menu"; state.view="produits"; render(); window.scrollTo(0,0); }); } });
        add({ k:"bud", tab:"gerer", g:"Dépenses", ic:"🎯", t:"Budgets", s:"montant par catégorie et par personne", kw:"budget", fn:function(){ editBudgets(cm); } });
        add({ k:"persons", tab:"gerer", g:"Personnes", ic:"👥", t:"Personnes", s:"payé par, pour qui, parts du commun", n:plist.length, kw:"personne prénom membre famille", fn:managePersons, add:function(){ menuCreate(function(){ personForm(null); }); } });
      }
      if(!persoOn()){
        var fyS;
        if(!fyCfg) fyS=canUse("foyer")?"à plusieurs, chacun sur son téléphone":APP_NAME+" Plus";
        else if(!fyM){ var nm=Object.keys(fyCfg.members||{}).length; fyS=nm+" membre"+(nm>1?"s":"")+" · "+fySyncLabel(); }
        else fyS="Foyer de "+(fyCfg.owner||"…")+" · "+fySyncLabel();
        add({ k:"foyer", tab:"gerer", g:"Personnes", ic:"👨‍👩‍👧", t:"Foyer partagé", plus:!fyCfg && !canUse("foyer"), s:fyS, kw:"foyer partager membre invitation qr code synchro", fn:function(){ menuGo(function(){ state.view="foyer"; render(); window.scrollTo(0,0); }); } });
      }
      if(own) add({ k:"grp", tab:"gerer", g:"Personnes", ic:"🧳", t:"Groupes ponctuels", plus:!canUse("groupes"), s:"vacances, sorties : qui doit quoi", kw:"groupe vacances sortie", add:function(){ if(canUse("groupes")) menuCreate(function(){ grpForm(null); }); else plusShow("groupes"); }, fn:function(){ menuGo(function(){ state.view="communes"; render(); setTimeout(function(){ var g=document.querySelector(".grp-sec, #grpSec"); if(g) g.scrollIntoView({ block:"start" }); }, 60); }); } });
      var nC=corbList().length;
      add({ k:"corb", tab:"gerer", g:"Récupérer", ic:"🗑️", t:"Corbeille", s:nC ? nC+" ticket"+(nC>1?"s":"")+" · gardés "+CORB_J+" jours" : "vide · les tickets supprimés y restent "+CORB_J+" jours", kw:"corbeille supprimé récupérer", fn:function(){ menuGo(function(){ state.view="corbeille"; render(); window.scrollTo(0,0); }); } });
      // Sauvegarde
      if(own){
        var nph=photoEntries().length, on=drvOn(), ml=on ? drvMenuLabel() : null, u=drvUndo();
        if(drvAvail()) add({ k:"drive", tab:"sauv", g:"Sauvegarder", ic:"☁️", t:"Sauvegarde Google Drive", plus:!canUse("drive"), s:on ? "automatique · réglages, désactiver" : "automatique, chiffrée, sans photos", st:on ? ml.t.replace("Drive · ","") : "à activer", stCol:on ? ml.col : "var(--accent)", kw:"drive google sauvegarde automatique", fn:function(){ if(on) menuGo(function(){ state.view="drive"; render(); window.scrollTo(0,0); drvRefresh().then(function(){ if(state.view==="drive") render(); }); }); else drvIntro(); } });
        add({ k:"full", tab:"sauv", g:"Sauvegarder", ic:"🗜️", t:"Sauvegarde complète", s:nph ? "données + "+nph+" photo"+(nph>1?"s":"")+" · ZIP" : "données et photos · ZIP", kw:"sauvegarde fichier zip photos", fn:function(){ backupData("full"); } });
        add({ k:"data", tab:"sauv", g:"Sauvegarder", ic:"📄", t:"Données seules", s:"petit fichier", kw:"sauvegarde fichier json", fn:function(){ backupData("data"); } });
        if(u) add({ k:"undo", tab:"sauv", g:"Restaurer", ic:"⤺", t:"Annuler la restauration", s:"remet les données d'avant le "+drvWhen(u.at), kw:"annuler restauration", fn:drvUndoAsk });
        if(drvNative()) add({ k:"rdrive", tab:"sauv", g:"Restaurer", ic:"☁️", t:"Depuis Google Drive", s:on ? "choisir une sauvegarde" : "ton compte Google et ton code de secours", kw:"restaurer drive nouveau téléphone", fn:function(){ if(drvOn()) drvRestoreOpen(); else drvNewPhone(); } });
        add({ k:"restore", tab:"sauv", g:"Restaurer", ic:"📂", t:"Depuis un fichier", s:"ZIP ou JSON · remplace les données du téléphone", kw:"restaurer fichier", fn:function(){ restorein.click(); } });
        add({ k:"code", tab:"sauv", g:"Ton code de secours", ic:"🔑", t:"Voir mon code de secours", s:"26 caractères, à garder sur papier", kw:"code secours récupération", fn:menuCodeShow });
      } else add({ k:"backup", tab:"sauv", g:"Sauvegarder", ic:"💾", t:"Mes comptes", s:"le foyer est sauvegardé par "+(fyCfg.owner||"le propriétaire"), st:drvCfg().on ? "Mes comptes · Drive" : null, stCol:"var(--accent)", kw:"sauvegarde", fn:drvMemberSheet });
      add({ k:"how", tab:"sauv", g:"Ton code de secours", ic:"💡", t:"Comment ça marche ?", s:"ce qui est gardé, où, et pourquoi le code", kw:"sauvegarde explication aide", fn:function(){ menuGo(sauvAideOpen); } });
      add({ k:"stockage", tab:"sauv", g:"Place et export", ic:"🗂️", t:"Stockage", s:fmtBytes(photosBytes()+dataBytes())+" · photos des tickets", kw:"stockage place photos", fn:function(){ menuGo(function(){ state.view="stockage"; render(); window.scrollTo(0,0); }); } });
      add({ k:"pdf", tab:"sauv", g:"Place et export", ic:"📤", t:"Exporter", s:"PDF ou tableur", kw:"exporter pdf tableur csv excel bilan", fn:exportChoose });
      // Réglages
      add({ k:"aff", tab:"regl", g:"Affichage", ic:"👁️", t:"Affichage", s:affDet() ? "détaillé · tout déplié, plus de chiffres" : "simple · l'essentiel", kw:"affichage simple détaillé", fn:affChoose });
      if(fyFull) add({ k:"devise", tab:"regl", g:"Affichage", ic:"💱", t:"Monnaie", s:curSym()+" · "+CURS[BASE].l, kw:"monnaie devise euro", fn:chooseCurrency });
      add({ k:"lock", tab:"regl", g:"Sécurité de ce téléphone", ic:lockCfg?"🔑":"🔒", t:lockCfg?"Code et empreinte":"Verrouiller par un code", s:lockCfg ? (lockCfg.bioId?"code + empreinte actifs":"code actif") : "conseillé : protège tes comptes", kw:"code empreinte verrou sécurité", fn:menuLock });
      if(capNative()) add({ k:"secure", tab:"regl", g:"Sécurité de ce téléphone", ic:"🙈", t:"Écran privé", s:store.read("ecranPrive", false) ? "activé" : "désactivé", kw:"écran privé capture applis récentes", fn:secureChoose });
      var rc=rapCfg(); add({ k:"rappels", tab:"regl", g:"Notifications et widgets", ic:"🔔", t:"Rappels", s:rc.on ? "activés · "+rc.h+" h" : "prélèvements, budgets, sauvegarde", kw:"rappel notification", fn:rapSettings });
      if(capNative()) add({ k:"widgets", tab:"regl", g:"Notifications et widgets", ic:"🧩", t:"Widgets", plus:!canUse("widgets"), s:"lesquels existent, comment les ajouter", kw:"widget écran d'accueil", fn:menuWidgets });
      add({ k:"demo", tab:"regl", g:"Essayer", ic:"🎭", t:DEMO?"Quitter la démo":"Mode démo", s:DEMO?"tes vraies données reviennent telles quelles":"un foyer inventé ; tes données restent de côté", kw:"démo essayer", fn:function(){ if(DEMO) demoQuit(); else demoStart(); } });
      // Aide
      add({ k:"aide", tab:"aide", g:"", ic:"❓", t:"Guide", s:"toute l'appli, avec une recherche", kw:"aide guide mode d'emploi", fn:function(){ menuGo(openAide); } });
      add({ k:"perdu", tab:"aide", g:"", ic:"🔒", t:"Téléphone perdu ou volé", s:"ce qu'il faut faire, dans l'ordre", kw:"perdu volé vol sécurité nouveau téléphone effacer pirate arnaque code", fn:function(){ menuGo(function(){ openAide("Téléphone perdu ou volé"); }); } });
      add({ k:"welcome", tab:"aide", g:"", ic:"👋", t:"Revoir l'accueil", s:"les cartes du premier démarrage", kw:"accueil présentation", fn:function(){ welcomeShow(); } });
      if(plusOffer()) add({ k:"plus", tab:"aide", g:"", ic:"✦", t:APP_NAME+" Plus", s:"ce qu'il ajoute", kw:"plus payant abonnement", fn:function(){ plusShow(null); } });
      if(bancOn()) add({ k:"banc", tab:"aide", g:"", ic:"🧪", t:"Tester la lecture sur mes tickets", s:"relit les photos de tes tickets · version Perso", kw:"banc essai lecture scan test ocr", fn:function(){ menuGo(function(){ state.view="banc"; render(); window.scrollTo(0,0); }); } });
      add({ k:"about", tab:"aide", g:"", ic:"ℹ️", t:"À propos", s:"version du "+(((document.querySelector('meta[name=build]')||{}).content)||""), kw:"version à propos confidentialité", fn:menuAbout });
      return L;
    }
