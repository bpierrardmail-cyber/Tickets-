    // ---------- Affichage simple / détaillé ----------
    // Réglage du téléphone (clé affichage) : « détaillé » = options dépliées, listes plus serrées, plus de filtres et de graphiques
    function affDet(){ return store.read("affichage", "simple")==="detail"; }
    function affChoose(){
      var d=affDet();
      uiChoice("Affichage", "Détaillé : options dépliées, listes plus serrées, plus de filtres, 4 graphiques par page sur le tableau de bord.", [
        { l:(d?"":"✓ ")+"Simple", primary:!d, fn:function(){ store.write("affichage", "simple"); render(); uiToast("Affichage simple"); } },
        { l:(d?"✓ ":"")+"Détaillé", primary:d, fn:function(){ store.write("affichage", "detail"); render(); uiToast("Affichage détaillé"); } } ]);
    }
    // Écran privé (08/11, revue F1) : rien de l'appli dans l'aperçu des applis récentes ni dans les captures (téléphone seulement)
    function secureApply(){ if(capNative()) npCall("setSecure", { on:!!store.read("ecranPrive", false) }).catch(function(){}); }
    function secureChoose(){
      var on=!!store.read("ecranPrive", false);
      uiChoice("Écran privé", "Activé, l'aperçu des applis récentes est masqué et les captures d'écran de l'appli sont noires (pratique si on te prête le téléphone, gênant pour envoyer une capture).", [
        { l:(on?"✓ ":"")+"Activé", primary:on, fn:function(){ store.write("ecranPrive", true); secureApply(); uiToast("Écran privé activé"); } },
        { l:(on?"":"✓ ")+"Désactivé", primary:!on, fn:function(){ store.write("ecranPrive", false); secureApply(); uiToast("Écran privé désactivé"); } } ]);
    }
    function personCounts(n){
      var t=state.entries.filter(function(e){ return (e.payePar||"").trim()===n; }).length, f=fraisCommuns.filter(function(x){ return (x.personne||"").trim()===n; }).length;
      return t+" ticket"+(t>1?"s":"")+" · "+f+" frais fixe"+(f>1?"s":"");
    }
    function managePersons(){
      var me=mePerson(), all=uniquePersons(true); if(all.indexOf(me)<0) all.unshift(me);
      var act=all.filter(function(n){ return !isArchived(n); }).sort(function(a,b){ return a===me?-1:(b===me?1:a.localeCompare(b)); }), old=all.filter(isArchived);
      function row(n, arch){ var r=personRec(n);
        return '<button type="button" class="dr-item" data-p="'+esc(n)+'"'+(arch?' style="opacity:.6"':'')+'><span class="ic">'+(n===me?'🙂':'👤')+'</span><span>'+esc(n)+(n===me?' <span style="font-size:11px;color:var(--accent);font-weight:600">· toi</span>':'')+
          '<small>'+(arch?'supprimée en '+esc(monthLabelOf(r.archived))+' · ':'')+personCounts(n)+'</small></span><span class="chev">›</span></button>'; }
      var h='<div class="sheet-title">Personnes</div><div class="ui-intro">Elles apparaissent dans « Payé par » et « Pour qui ».</div><div class="ui-stack">';
      act.forEach(function(n){ h+=row(n,false); });
      if(old.length){ h+='<div class="dr-sec" style="margin:6px 2px -2px">Anciennes personnes · historique conservé</div>'; old.forEach(function(n){ h+=row(n,true); }); }
      h+='<button type="button" class="btn ghost" id="pAdd">＋ Ajouter une personne</button><button type="button" class="btn ghost ui-no">Fermer</button></div>';
      var s=uiSheet(h);
      s.q(".ui-no").onclick=s.close;
      s.q("#pAdd").onclick=function(){ s.close(); personForm(null); };
      [].forEach.call(s.qa("[data-p]"), function(b){ b.onclick=function(){ s.close(); personMenu(b.getAttribute("data-p")); }; });
    }
    function personMenu(n){
      var me=mePerson();
      if(isArchived(n)) return uiChoice(n, "Supprimée en "+esc(monthLabelOf(personRec(n).archived))+". Ses tickets et frais passés sont conservés.", [{ l:"Rétablir", fn:function(){ restorePerson(n); } }]);
      var ch=[{ l:"Renommer", fn:function(){ personForm(n); } }];
      if(n!==me) ch.push({ l:"Supprimer", danger:true, fn:function(){ archivePerson(n); } });
      uiChoice(n, n===me?"C'est toi : titulaire du compte principal.":personCounts(n), ch);
    }
    function askFirstName(){
      uiForm({ title:"Bienvenue dans "+APP_NAME+" 👋", intro:"Comment tu t'appelles ? Ton prénom sert pour « Payé par » et pour partager les dépenses. Tu pourras le changer dans le menu, rubrique Personnes.",
        fields:[{ key:"nom", label:"Ton prénom", value:"", placeholder:"Ex. : Camille", required:true }], ok:"C'est parti" }, function(r){
        var nm=(r.nom||"").trim(); if(!nm) return "Indique ton prénom.";
        if(nm.toLowerCase()==="commun") return "« Commun » est réservé aux dépenses partagées.";
        var a=mainAcct(), old=mePerson();
        state.entries.forEach(function(e){ if((e.payePar||"").trim()===old) e.payePar=nm; }); persist();
        fraisCommuns.forEach(function(f){ if((f.personne||"").trim()===old) f.personne=nm; }); persistFrais();
        a.payer=nm; persistComptes(); store.write("askName", false);
        uiToast("Bonjour "+nm+" !"); render();
        setTimeout(function(){ chooseCurrencyForm(true, startFillSheet); }, 600);   // monnaie de l'appli, proposée une fois, puis « Remplis ton appli »
      });
    }
    function personForm(old){
      uiForm({ title:(old?"Renommer « "+old+" »":"Nouvelle personne"), fields:[{ key:"nom", label:"Prénom", value:(old||""), required:true }], ok:(old?"Renommer":"Ajouter") }, function(r){
        var nm=(r.nom||"").trim(); if(!nm) return "Indique un prénom.";
        if(nm.toLowerCase()==="commun") return "« Commun » est réservé aux dépenses partagées.";
        if(old && nm===old) return;
        if(uniquePersons(true).concat([mePerson()]).some(function(x){ return x.toLowerCase()===nm.toLowerCase() && x!==old; })) return "Ce prénom existe déjà.";
        if(!old){ personnes.push({ nom:nm }); persistPersonnes(); uiToast(nm+" ajouté(e)"); render(); return; }
        if(fyCfg && fyCfg.members && Object.keys(fyCfg.members).some(function(k){ return fyCfg.members[k].name===old; })) return "« "+old+" » est membre du foyer partagé : retire-le du foyer avant de changer son prénom.";
        personRenameAll(old, nm);
        uiToast("« "+old+" » s'appelle maintenant « "+nm+" »"); render();
      });
    }
    // Renommer une personne partout : tickets (payé par, partage), frais (personne, parts), comptes, budgets, parts du commun, épargne, provisions, remboursements, groupes
    function personRenameAll(old, nm){
      function key(o){ if(o && typeof o==="object" && Object.prototype.hasOwnProperty.call(o, old)){ o[nm]=(o[nm]!=null && typeof o[nm]==="number") ? o[nm]+(Number(o[old])||0) : o[old]; delete o[old]; return true; } return false; }
      state.entries.forEach(function(e){ if((e.payePar||"").trim()===old) e.payePar=nm; key(e.share); }); persist();
      fraisCommuns.forEach(function(f){ if((f.personne||"").trim()===old) f.personne=nm; if(f.parts) Object.keys(f.parts).forEach(function(m){ key(f.parts[m]); }); key(f.split && typeof f.split==="object" ? f.split : null); }); persistFrais();
      comptes.forEach(function(a){ if(a.payer===old) a.payer=nm; }); persistComptes();
      if(budgetsP[old]){ budgetsP[nm]=budgetsP[old]; delete budgetsP[old]; persistBudgetsP(); }
      if(key(communParts)) persistParts();
      epargne.forEach(function(x){ if((x.owner||"").trim()===old) x.owner=nm; }); persistEpargne();
      provisions.forEach(function(x){ if((x.owner||"").trim()===old) x.owner=nm; }); persistProvisions();
      function rb(r){ if(r.from===old) r.from=nm; if(r.to===old) r.to=nm; }
      commRemb.forEach(rb); persistRemb();
      groupes.forEach(function(g){ g.membres=(g.membres||[]).map(function(p){ return p===old ? nm : p; }); (g.dep||[]).forEach(function(d){ if(d.payePar===old) d.payePar=nm; if(d.pour) d.pour=d.pour.map(function(p){ return p===old ? nm : p; }); }); (g.rembs||[]).forEach(rb); }); persistGroupes();
      var rec=personRec(old); if(rec) rec.nom=nm; else personnes.push({ nom:nm }); persistPersonnes();
    }
    function archivePerson(n){
      var curM=monthKey(todayISO());
      var fx=fraisCommuns.filter(function(f){ return (f.personne||"").trim()===n && f.recurrent && (!f.endMonth || f.endMonth>curM); });
      uiConfirm("Supprimer « "+esc(n)+" » ?<br>Elle n'apparaîtra plus dans les choix. Ses tickets et frais passés restent dans l'historique."+(fx.length?"<br>Ses "+(fx.length>1?fx.length+" frais fixes mensuels s'arrêtent":"frais fixe mensuel s'arrête")+" après "+esc(monthLabelOf(curM))+".":""), function(){
        fx.forEach(function(f){ f.endMonth=curM; f.endByArchive=1; }); if(fx.length) persistFrais();
        var rec=personRec(n); if(rec) rec.archived=curM; else personnes.push({ nom:n, archived:curM }); persistPersonnes();
        uiToast("« "+n+" » supprimée · historique conservé"); render();
      }, { ok:"Supprimer", danger:true });
    }
    function restorePerson(n){
      fraisCommuns.forEach(function(f){ if((f.personne||"").trim()===n && f.endByArchive){ delete f.endMonth; delete f.endByArchive; } }); persistFrais();
      var rec=personRec(n); if(rec) delete rec.archived; persistPersonnes();
      uiToast("« "+n+" » est de retour"); render();
    }
    function choosePdfPeriod(){
      var curM=monthKey(todayISO());
      uiForm({ title:"Exporter en PDF", intro:"Un bilan imprimable de tes tickets, comptes, frais fixes, épargne et provisions.", fields:[
        { key:"per", label:"Période", type:"seg", value:"m", options:[{v:"m",l:"Ce mois"},{v:"p",l:"Mois préc."},{v:"y",l:"Cette année"},{v:"c",l:"Autre"}],
          onChange:function(v,api){ api.show("from", v==="c"); api.show("to", v==="c"); } },
        { key:"from", label:"Du mois", type:"month", value:curM.slice(0,4)+"-01", hidden:true },
        { key:"to", label:"Au mois (inclus)", type:"month", value:curM, hidden:true }
      ], ok:"Voir le bilan", focus:false }, function(r){
        var f=curM, t=curM, ok=/^[0-9]{4}-[0-9]{2}$/;
        if(r.per==="p"){ f=t=prevMonthKey(curM); }
        else if(r.per==="y"){ f=curM.slice(0,4)+"-01"; }
        else if(r.per==="c"){ if(!ok.test(r.from||"") || !ok.test(r.to||"")) return "Choisis les deux mois."; f=r.from; t=r.to; if(f>t){ var x=f; f=t; t=x; } }
        state.bilanFrom=f; state.bilanTo=t; state.view="bilan"; render(); window.scrollTo(0,0);
      });
    }
    function chooseCurrencyForm(first, done){
      uiForm({ title:"Monnaie de l'appli", intro:(first ? "Dans quelle monnaie tiens-tu tes comptes ? " : "")+"Tous les montants de l'appli s'affichent dans cette monnaie : tickets, budgets, comptes"+(FEAT.bourse?", bourse":"")+". <b>Elle ne convertit pas les montants.</b>", fields:[
        { key:"dev", label:"Monnaie", type:"select", value:BASE, options:Object.keys(CURS).map(function(c){ return { v:c, l:CURS[c].s+" · "+CURS[c].l }; }),
          help:first ? "Tu pourras la changer dans Menu › Réglages." : "Les montants déjà saisis ne sont pas convertis : change-la seulement si tu les as saisis dans cette monnaie."+(FEAT.bourse?" Les cours des actions et cryptos, eux, sont convertis automatiquement.":"") }
      ], ok:first ? "Continuer" : "Enregistrer", focus:false }, function(r){
        if(done) setTimeout(done, 50);
        if(!r.dev || !CURS[r.dev] || r.dev===BASE) return;
        BASE=r.dev; store.write("devise", BASE);
        state.solPrice=null; state.stockPrices={};
        if(typeof refreshPositions==="function") refreshPositions(true);
        render(); uiToast("Monnaie de l'appli : "+CURS[BASE].l);
      });
    }
    function chooseCurrency(){ chooseCurrencyForm(false, null); }
    function curOpts(extra){ var l=[BASE]; ["USD","EUR"].concat(extra?[extra]:[]).forEach(function(c){ if(c && l.indexOf(c)<0) l.push(c); }); return l.map(function(c){ return { v:c, l:(CURS[c]?CURS[c].c:c) }; }); }
    var CATS0 = store.read("cats", null);
    var CATS = CATS0 || ["Alimentation","Restaurant","Carburant","Maison","Santé","Transport","Loisirs","Autre"];
    if(CATS.indexOf("Autre")<0) CATS.push("Autre");
    function persistCats(){ store.write("cats", CATS); }
