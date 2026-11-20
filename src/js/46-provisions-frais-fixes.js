    // ---------- Provisions ↔ frais fixes ----------
    // La mise de côté d'une provision est un frais fixe relié (f.prov = id de la provision, f.provFrom = mois du lien) :
    // à partir de provFrom, son nom, son montant et ses mois sautés sont ceux de la provision (la provision décide, le frais suit) ;
    // qui la remplit (Commun, chacun sa part, une personne) et le compte restent ceux du frais. Un ancien frais « Eau 20 € »
    // (même nom, même montant) est relié au lieu de faire doublon et garde son passé. Si l'argent reste sur le compte
    // qui paie (compte courant), rien n'en sort (fraisAcctAmt) ; il compte quand même dans les parts du Commun et l'Analyse.
    // Une facture payée par une provision (frais f.pp = id de la provision) sort du compte, mais pas des parts ni de l'Analyse.
    function provById(id){ return id==null ? null : provisions.filter(function(p){ return String(p.id)===String(id); })[0]||null; }
    function provFraisOf(p){ return p ? fraisCommuns.filter(function(f){ return f.prov!=null && String(f.prov)===String(p.id); })[0]||null : null; }
    function provLabel(p){ return "Provision · "+(p.nom||"enveloppe"); }
    function provFillDef(p){ if(p && p.owner) return p.owner; return uniquePersons().filter(function(x){ return x!==mePerson(); }).length ? "Commun" : mePerson(); }
    // l'argent de la provision est sur ce compte : sa mise de côté n'en sort pas
    function provOnAcct(p, key){ var w=provWhere(p), a=acctByKey(key); return !!a && (w==="cpt:"+key || (w==="cpt" && !!a.main)); }
    function provDest(p, f){ var a=(f && provPayAcct(f)) || mainAcct(); return (a && provOnAcct(p, a.key)) ? "reste sur "+provWhereLabel(p) : "vers "+provWhereLabel(p); }
    // la provision suit ce fournisseur (clé de série) : liée, sinon même nom que le type (« Eau ») ou que le fournisseur
    function provFollows(p, key){ if(!p || !key) return false; if(p.fact) return p.fact===key; var nm=norm(p.nom||""), k=String(key).split("|"); return !!nm && (norm(factType(k[0]).l)===nm || (" "+(k[1]||"")+" ").indexOf(" "+nm+" ")>=0); }
    function fraisRuns(f, m){ if(!f.recurrent) return f.month===m; var st=fraisStart(f); return (!st || m>=st) && (!f.endMonth || m<=f.endMonth); }
    // ancien frais fixe qui faisait déjà la mise de côté : même nom, même montant ce mois-ci
    function provMirror(p, cur){
      var nm=norm(p.nom||""), v=mensuelAt(p, cur); if(!nm || !(v>0)) return null;
      return fraisCommuns.filter(function(f){ if(!f.recurrent || f.prov!=null || f.fact || f.est || !fraisRuns(f, cur)) return false;
        var n=norm(f.label||""); return (n===nm || n==="provision "+nm || (" "+n+" ").indexOf(" "+nm+" ")>=0) && Math.abs(fraisMontant(f, cur)-v)<0.006; })[0]||null;
    }
    // le frais suit la provision à partir de provFrom ; renvoie vrai s'il a changé
    function provFraisFit(p, f){
      var from=f.provFrom||monthKey(todayISO()), k;
      var before=JSON.stringify([f.recurrent, f.month||null, f.endMonth||null, f.label, f.amounts||null, f.skipMonths||null, f.startMonth||null, f.montant]);
      f.recurrent=true; delete f.month; delete f.endMonth; f.label=provLabel(p);
      if(!f.startMonth) f.startMonth=fraisStart(f)||from;
      var A={}; for(k in (f.amounts||{})) if(k<from) A[k]=f.amounts[k];
      A[from]=mensuelAt(p, from);
      for(k in (p.mensuelChanges||{})) if(k>from) A[k]=Number(p.mensuelChanges[k])||0;
      f.amounts=A; if(f.startMonth>=from) f.montant=A[from];
      var S={}; for(k in (f.skipMonths||{})) if(k<from && f.skipMonths[k]) S[k]=f.skipMonths[k];
      (p.skips||[]).forEach(function(m){ if(m>=from) S[m]=true; });
      if(Object.keys(S).length) f.skipMonths=S; else delete f.skipMonths;
      return JSON.stringify([f.recurrent, f.month||null, f.endMonth||null, f.label, f.amounts||null, f.skipMonths||null, f.startMonth||null, f.montant])!==before;
    }
    // plus de provision (ou plus dans les frais fixes) : le frais garde son passé et s'arrête ; sans passé, il disparaît
    function provFraisDetach(f){
      var cur=monthKey(todayISO()), st=fraisStart(f)||cur, dn=f.doneMonths||{}, hist=st<cur || Object.keys(dn).some(function(m){ return dn[m] && m<=cur; });
      if(hist){ f.endMonth=dn[cur] ? cur : prevMonthKey(cur); delete f.prov; delete f.provFrom; if(f.skipMonths) for(var k in f.skipMonths) if(k>f.endMonth) delete f.skipMonths[k]; }
      else fraisCommuns=fraisCommuns.filter(function(x){ return x!==f; });
    }
    function provFraisSync(){
      if(fyMember()) return;
      if(!provisions.length && !fraisCommuns.some(function(f){ return f.prov!=null; })) return;
      var cur=monthKey(todayISO()), ch=false, chP=false;
      // une provision ne doit avoir qu'un frais relié : s'il y en a plusieurs (ancienne erreur), le plus ancien garde tout (« fait », jours, épargne versée)
      var byP={}; fraisCommuns.forEach(function(f){ if(f.prov==null) return; var k=String(f.prov); (byP[k]=byP[k]||[]).push(f); });
      Object.keys(byP).forEach(function(k){ var L=byP[k]; if(L.length<2) return;
        L.sort(function(a, b){ return String(a.provFrom||"")<String(b.provFrom||"") ? -1 : String(a.provFrom||"")>String(b.provFrom||"") ? 1 : (Number(a.id)||0)-(Number(b.id)||0); });
        var keep=L[0];
        L.slice(1).forEach(function(x){
          ["doneMonths", "doneDays", "epDone", "pastOk"].forEach(function(fld){ if(!x[fld]) return; if(!keep[fld]) keep[fld]={}; for(var m in x[fld]){ if(x[fld][m] && !keep[fld][m]) keep[fld][m]=x[fld][m]; } });
          if(x.impKeys){ keep.impKeys=(keep.impKeys||[]).concat(x.impKeys); }
          fraisCommuns=fraisCommuns.filter(function(y){ return y!==x; }); });
        ch=true; });
      provisions.forEach(function(p){
        if(p.noFrais) return;
        var f=provFraisOf(p);
        if(!f){
          f=provMirror(p, cur);
          if(f){ f.prov=p.id; f.provFrom=cur; ch=true;
            // une facture l'avait remplacé ce mois-ci ou après : la mise de côté continue ; les autres mois retirés passent à la provision
            for(var sm in (f.skipMonths||{})){ if(sm<cur || !f.skipMonths[sm]) continue;
              if(fraisCommuns.some(function(x){ return x.fact && !x.est && x.month===sm && provFollows(p, x.fact); })) continue;
              if(!p.skips) p.skips=[]; if(p.skips.indexOf(sm)<0){ p.skips.push(sm); chP=true; } }
          } else {
            var st=(p.startMonth && p.startMonth>cur) ? p.startMonth : cur; if(!(mensuelAt(p, st)>0)) return;
            f={ id:Date.now()+Math.floor(Math.random()*100000), label:provLabel(p), montant:mensuelAt(p, st), personne:provFillDef(p), recurrent:true, startMonth:st, prov:p.id, provFrom:st };
            fraisCommuns.push(f); ch=true;
          }
        }
        if(provFraisFit(p, f)) ch=true;
      });
      fraisCommuns.slice().forEach(function(f){ if(f.prov!=null && !provById(f.prov)){ provFraisDetach(f); ch=true; } });   // provision supprimée
      if(chP) persistProvisions();
      if(ch) persistFrais();
    }
    // « Remplie par » d'une provision : qui fait la mise de côté (frais fixe relié)
    // Réglage « Chaque mois » d'une provision (maquette du 07/11) : Qui paie ? · Prélevé sur · Mis de côté sur · Suivre dans les frais fixes, avec le trajet de l'argent
    function provWhoOpts(){ var ppl=uniquePersons(); if(ppl.indexOf(mePerson())<0) ppl.unshift(mePerson()); var o=[{ v:"Commun", l:"Le foyer" }]; ppl.forEach(function(n){ o.push({ v:n, l:n }); }); return o; }
    function provFromDef(who){ var a=(who==="Commun") ? mainAcct() : payAcctOf(who); return (a && a.key) || ""; }
    function provFromOpts(who){
      var A=comptes.filter(function(a){ return a.key!=="__tickets"; }), o=[];
      function lb(a){ var ow=acctOwner(a); return a.nom+(ow && ow!==who ? " · "+ow : ""); }
      if(who==="Commun"){ A.forEach(function(a){ o.push({ v:a.key, l:lb(a) }); }); if(provWhoOpts().length>2) o.push({ v:"__split", l:"Chacun sur son compte" }); }
      else A.filter(function(a){ return acctOwner(a)===who; }).concat(A.filter(function(a){ return acctOwner(a)!==who; })).forEach(function(a){ o.push({ v:a.key, l:lb(a) }); });
      return o.length ? o : [{ v:"", l:"Aucun compte" }];
    }
    function provFlowCur(p){
      var f=provFraisOf(p), who, from;
      if(f){ who=(f.personne||"").trim()||"Commun"; from=(who==="Commun" && f.split && !(f.compte && acctByKey(f.compte))) ? "__split" : ((provPayAcct(f)||{}).key||""); }
      else { who=provFillDef(p); from=provFromDef(who); }
      return { who:who, from:from, track:(p && p.noFrais) ? "non" : "oui" };
    }
    function provFlowText(o){
      if(o.track==="non") return '<span class="pflow">La provision se remplit seule chaque mois : rien ne sort d\'un compte, pas de rond à cocher.</span>';
      var m=Number(o.mens)||0, amt=m ? fmtK(m) : "le montant", w=String(o.ou||""), dest=provWhereLabel({ ou:w });
      var fa=(o.from && o.from!=="__split") ? acctByKey(o.from) : null, same=!!fa && (w==="cpt:"+fa.key || (w==="cpt" && fa.main)), src=(o.from==="__split") ? "Chacun depuis son compte" : (fa ? fa.nom : "?"), h;
      if(same) h="Rien ne sort de <b>"+esc(fa.nom)+"</b> : "+esc(amt)+" y restent, réservés.";
      else if(w==="ext") h="<b>"+esc(src)+"</b> −"+esc(amt)+" → ailleurs (hors de tes comptes).";
      else h="<b>"+esc(src)+"</b> −"+esc(amt)+" → <b>"+esc(dest)+"</b> +"+esc(amt)+(w.indexOf("ep:")===0 ? " · la valeur du livret augmente quand c'est coché « fait »." : " · un seul rond « fait » pour les deux comptes.");
      return '<span class="pflow">'+h+'<br>'+(o.who==="Commun" ? "Compté dans les parts du foyer." : "Compté dans les dépenses de "+esc(o.who)+".")+'</span>';
    }
    function provFlowPaint(api){
      var tr=api.get("track"); if(tr==null) return;
      api.show("who", tr!=="non"); api.show("from", tr!=="non");
      api.help("track", provFlowText({ who:api.get("who")||"Commun", from:api.get("from"), ou:api.get("ou"), track:tr, mens:api.get("mens") }));
    }
    function provFlowFields(p){
      var ouF={ key:"ou", label:"Mis de côté sur", type:"select", value:provWhere(p||{}), options:provWhereOptions(), onChange:function(v, api){ provFlowPaint(api); } };
      if(fyMember()) return [ouF];   // un membre choisit seulement où est l'argent (la mise de côté se règle sur le téléphone du propriétaire)
      var c=provFlowCur(p), W=provWhoOpts(), mens=p ? mensuelAt(p, monthKey(todayISO())) : null;
      return [
        { key:"who", label:"Qui paie ?", type:(W.length<=3 ? "seg" : "select"), value:c.who, options:W, hidden:c.track==="non", onChange:function(v, api){ api.opts("from", provFromOpts(v), provFromDef(v)); provFlowPaint(api); } },
        { key:"from", label:"Prélevé sur", type:"select", value:c.from, options:provFromOpts(c.who), hidden:c.track==="non", onChange:function(v, api){ provFlowPaint(api); } },
        ouF,
        { key:"track", label:"Suivre dans les frais fixes", type:"seg", value:c.track, options:[{ v:"oui", l:"Oui, chaque mois" }, { v:"non", l:"Non" }], onChange:function(v, api){ provFlowPaint(api); },
          help:provFlowText({ who:c.who, from:c.from, ou:provWhere(p||{}), track:c.track, mens:mens }) }
      ];
    }
    function provFlowApply(p, r){
      if(fyMember() || !r.track) return;
      var f=provFraisOf(p);
      if(r.track==="non"){ p.noFrais=true; if(f) provFraisDetach(f); persistFrais(); persistProvisions(); return; }
      delete p.noFrais; persistProvisions(); if(!f){ provFraisSync(); f=provFraisOf(p); } if(!f) return;
      f.personne=r.who||"Commun";
      if(f.personne==="Commun" && r.from==="__split"){ f.split=true; delete f.compte; }
      else { delete f.split; if(r.from && acctByKey(r.from)) f.compte=r.from; else delete f.compte; }
      persistFrais();
    }
    function addProvision(){
      uiForm({ title:"Nouvelle provision", fields:[
        {key:"nom", label:"Nom", placeholder:"Impôt foncier, assurance, eau…", required:true}
      ].concat(ownerField(null)).concat([
        {key:"mens", label:"Mis de côté chaque mois", type:"money", required:true, onChange:function(v, api){ provFlowPaint(api); }},
        {key:"init", label:"Déjà de côté aujourd'hui", type:"money", value:0},
        {key:"ech", label:"Mois de la facture (optionnel)", type:"select", value:"", options:echOptions()},
        {key:"prevu", label:"Montant prévu de la facture (optionnel)", type:"money", value:"", help:"Pour vérifier que tu seras prêt à temps."},
      ]).concat(provFlowFields(null))}, function(r){
        var p={ id:Date.now(), nom:r.nom, mensuel:r.mens, soldeInitial:r.init||0, startMonth:monthKey(todayISO()), prelevements:[] };
        setOwner(p, r); if(r.ou) p.ou=r.ou;
        if(r.ech) p.echeance=+r.ech; if(r.prevu) p.prevu=r.prevu;
        provisions.push(p); persistProvisions(); provFlowApply(p, r); render();
      });
    }
    function editProvision(id){
      var p=provisions.filter(function(x){ return String(x.id)===String(id); })[0]; if(!p) return;
      var em=(state.months&&state.months.provisions)||monthKey(todayISO());
      var curMens=mensuelAt(p, em);
      uiForm({ title:"Modifier « "+p.nom+" »", fields:[
        {key:"nom", label:"Nom", value:p.nom, required:true}
      ].concat(ownerField(p.owner||"")).concat([
        {key:"mens", label:"Mis de côté chaque mois", type:"money", value:curMens, required:true, help:"À partir de "+esc(monthLabelOf(em))+". Les mois précédents ne changent pas.", onChange:function(v, api){ provFlowPaint(api); }},
        {key:"init", label:"Montant de départ ("+monthLabelOf(p.startMonth||em)+")", type:"money", value:(p.soldeInitial||0)},
        {key:"ech", label:"Mois de la facture", type:"select", value:(p.echeance?String(p.echeance):""), options:echOptions()},
        {key:"prevu", label:"Montant prévu de la facture", type:"money", value:(p.prevu||"")},
      ]).concat(provFlowFields(p))}, function(r){
        p.nom=r.nom||p.nom; setOwner(p, r); if(r.ou) p.ou=r.ou;
        if(Math.abs(r.mens-curMens)>0.001){ if(!p.mensuelChanges) p.mensuelChanges={}; p.mensuelChanges[em]=r.mens; }
        p.soldeInitial=r.init||0;
        if(r.ech) p.echeance=+r.ech; else delete p.echeance;
        if(r.prevu) p.prevu=r.prevu; else delete p.prevu;
        persistProvisions(); provFlowApply(p, r); render();
      });
    }
    function delProvision(id){
      var p=provisions.filter(function(x){ return String(x.id)===String(id); })[0]; if(!p) return;
      var pf=provFraisOf(p);
      uiConfirm("Supprimer la provision « "+esc(p.nom)+" » ?"+(pf?"<br><small>Sa mise de côté sort des frais fixes (les mois passés restent).</small>":""), function(){
        provisions=provisions.filter(function(x){ return String(x.id)!==String(id); });
        if(pf){ provFraisDetach(pf); persistFrais(); }
        persistProvisions(); render();
      }, {ok:"Supprimer", danger:true});
    }
    // Factures qu'une provision peut payer : pas déjà payées par une provision, de moins de 120 jours ;
    // celles de son fournisseur (ou de son type : « Eau ») d'abord, puis les plus récentes
    function provBillsFor(p){
      var lim=isoAddDays(todayISO(), -120), nm=norm(p.nom||"");
      function mine(f){ return (p.fact && factKey(f)===p.fact) || norm(factType(f.type).l)===nm || (nm && norm(f.four||"").indexOf(nm)>=0) ? 0 : 1; }
      return factures.filter(function(f){ return !f.prId && Number(f.montant)>0 && (f.date||"")>=lim; })
        .sort(function(a,b){ return mine(a)-mine(b) || (a.date<b.date?1:-1); }).slice(0, 4);
    }
    function provOfBill(f){ var r=null; if(f && f.prId) provisions.forEach(function(p){ if((p.prelevements||[]).some(function(x){ return String(x.id)===String(f.prId); })) r=p; }); return r; }
    // La facture est payée par la provision : un prélèvement du montant, le mois où elle est payée ; la provision suit ce fournisseur
    function provPayBill(p, f){ factPayFlow(f, p); }
    // le prélèvement de la provision pour cette facture (seulement la provision)
    function provPrelevBill(p, f, m){
      var mt=Math.round((Number(f.montant)||0)*100)/100;
      if(!p.prelevements) p.prelevements=[];
      var pr={ id:Date.now(), month:m||(f.prelev?f.prelev.slice(0,7):factPayMonth(f)), montant:mt, label:"Facture "+(f.four||"")+" du "+ddmm(f.date) };
      p.prelevements.push(pr); f.prId=pr.id; if(!p.fact) p.fact=factKey(f);
      return pr;
    }
    // la provision qui paie (ou suivra) cette facture
    function factProvFor(f){ var p=provOfBill(f); if(p) return p; var k=factKey(f); return provisions.filter(function(x){ return x.fact===k; })[0]||null; }
    // facture dans les comptes mais pas encore retirée de la provision qui suit son fournisseur
    function factProvMissing(f, p){ return !!p && !f.prId && !!factFraisFor(f) && (f.date||"")>=((p.startMonth||"0000-00")+"-01") && (f.date||"")>=isoAddDays(todayISO(), -120) && (!p.fact || p.fact===factKey(f)); }
    // Une facture payée par une provision, en un seul geste : elle sort du compte (son prélèvement, comme sur le relevé)
    // et elle est retirée de la provision ; si l'argent est sur un livret, le virement « livret → compte » peut être ajouté.
    // Sans provision : seulement « dans tes comptes ».
    function factPayFlow(f, p){
      p=p||factProvFor(f);
      if(!p){ factAddToAccounts(f, true); return; }
      var fr=factFraisFor(f), pv0=provOfBill(f), mt=Math.round((Number(f.montant)||0)*100)/100, A=factAccOf(f, p);
      var payM=fr ? (fr.month||factPayMonth(f)) : (f.prelev ? f.prelev.slice(0,7) : factPayMonth(f));
      var accDef=!fr && factCanAdd(f), an=(fr && fr.compte && acctByKey(fr.compte) || A.acct || {nom:"ton compte"}).nom;
      var w=provWhere(p), ep=(w.indexOf("ep:")===0) ? epargneById(w.slice(3)) : null; if(ep && ep.bourseLink) ep=null;
      var payA=(fr && fr.compte && acctByKey(fr.compte)) || A.acct || mainAcct(), provA=(w==="cpt") ? mainAcct() : (w.indexOf("cpt:")===0 ? acctByKey(w.slice(4)) : null);
      if(provA && payA && provA.key===payA.key) provA=null;   // l'argent de la provision est déjà sur le compte qui paie
      var bal=provState(p, payM).bal, jr=f.prelev ? ' le '+ddmm(f.prelev) : (f.aPayer ? ' (à payer)' : '');
      var h='<div class="fold"><div class="fo-h"><b>Facture du '+esc(ddmmyy(f.date))+' · '+esc(fmtK(mt))+'</b><span class="fpill">'+esc(f.four||factType(f.type).l)+'</span></div>';
      h+='<div class="fnote" style="margin-top:4px">Payée avec la provision « '+esc(p.nom)+' »</div>';
      if(fr) h+='<div class="fnote">✓ Déjà dans tes comptes : « À venir » de '+esc(monthLabelOf(payM))+'.</div>';
      else h+='<label class="fct-eff"><input type="checkbox" data-k="acc"'+(accDef?' checked':'')+'><span><b>'+esc(an)+' : −'+esc(fmtK(mt))+esc(jr)+'</b><small>'+(accDef?'Le prélèvement, comme sur ton relevé (« À venir » de '+esc(monthLabelOf(factPayMonth(f)))+', puis Opérations).':'Sans doute déjà passée dans ton compte : coche seulement si elle n\'y est pas.')+'</small></span></label>';
      if(pv0) h+='<div class="fnote">✓ Déjà retirée de « '+esc(pv0.nom)+' ».</div>';
      else h+='<label class="fct-eff"><input type="checkbox" data-k="prov" checked><span><b>Provision « '+esc(p.nom)+' » : −'+esc(fmtK(mt))+'</b><small>'+esc(fmtK(bal))+' → '+esc(fmtK(Math.max(0, bal-mt)))+' de côté'+(mt>bal+0.004?' · il manque '+esc(fmtK(mt-bal))+', pris sur le total des provisions':'')+'.</small></span></label>';
      if(provA && !pv0) h+='<label class="fct-eff"><input type="checkbox" data-k="virc"><span><b>Virement '+esc(provA.nom)+' → '+esc(payA.nom)+' · '+esc(fmtK(mt))+'</b><small>L\'argent de la provision passe sur le compte qui paie la facture : les deux comptes suivent, un seul rond « fait ».</small></span></label>';
      if(ep && !pv0) h+='<label class="fct-eff"><input type="checkbox" data-k="vir"><span><b>Virement '+esc(ep.nom)+' → '+esc(an)+' · '+esc(fmtK(mt))+'</b><small>Si tu remets l\'argent de la provision sur le compte. À cocher « fait » quand il est passé.</small></span></label>';
      h+='<div class="fnote">Elle sort du compte, mais ne compte pas une 2ᵉ fois dans les parts du Commun ni dans l\'Analyse : c\'est la mise de côté de « '+esc(p.nom)+' » qui y compte. La mise de côté du mois continue.</div>';
      h+='<div class="ui-actions"><button type="button" class="btn ghost ui-cancel">Annuler</button><button type="button" class="btn primary" id="fpfOk">Valider</button></div></div>';
      var s=uiSheet(h);
      s.q(".ui-cancel").onclick=s.close;
      s.q("#fpfOk").onclick=function(){
        function on(k){ var c=s.q('input[data-k="'+k+'"]'); return !!(c && c.checked); }
        var doAcc=on("acc"), doProv=on("prov"), doVir=on("vir"), doVirC=on("virc"), made=[], x=fr;
        if(!doAcc && !doProv && !doVir && !doVirC){ s.close(); return; }
        if(doAcc){ x=factAddToAccounts(f, false, { pp:p.id }); made.push("dans tes comptes"); }
        if(doProv){ provPrelevBill(p, f, x ? (x.month||payM) : payM); made.push("retirée de « "+p.nom+" »"); }
        if(x){ var pb=provOfBill(f); if(pb) x.pp=pb.id; else delete x.pp; }
        if(doVir && ep){ var va=(x && x.compte && acctByKey(x.compte)) || A.acct || mainAcct(), v={ id:Date.now()+7, person:va.key, month:x ? (x.month||payM) : payM, label:"Provision « "+p.nom+" » · "+(f.four||"facture"), note:ep.nom+" → compte", montant:mt, epargneId:ep.id, epApplied:0 };
          if(x && x.jour) v.day=x.jour; virements.push(v); persistVirements(); made.push("virement depuis "+ep.nom); }
        if(doVirC && provA){ var vc={ id:virNewId(), person:payA.key, month:x ? (x.month||payM) : payM, label:"Provision « "+p.nom+" » · "+(f.four||"facture"), note:"", montant:mt, vers:"cpt:"+provA.key };
          if(x && x.jour) vc.day=x.jour; virements.push(vc); virLinkSync(); persistVirements(); made.push("virement depuis "+provA.nom); }
        persistProvisions(); persistFrais(); persistFactures();
        s.close(); render(); uiToast("Facture du "+ddmm(f.date)+" · "+made.join(" · "));
      };
    }
    // choisir la provision qui paie une facture
    function provChooseFor(f){
      if(!provisions.length){ uiToast("Aucune provision : crée-la dans À venir › Provisions"); return; }
      var k=factKey(f), L=provisions.slice().sort(function(a,b){ return (a.fact===k?0:1)-(b.fact===k?0:1); });
      uiChoice("Payer avec une provision", esc((f.four||"")+" · "+ddmmyy(f.date)+" · "+fmtK(f.montant)), L.map(function(p){ return { l:p.nom+" · "+fmtK(provBalance(p, monthKey(todayISO())))+" de côté", primary:false, fn:function(){ provPayBill(p, f); } }; }));
    }
    function addPrelevement(id){
      var p=provisions.filter(function(x){ return String(x.id)===String(id); })[0]; if(!p) return;
      var bl=provBillsFor(p);
      if(bl.length) uiChoice("Facture payée · "+p.nom, "Une facture importée, ou un autre montant ?", bl.map(function(f){ return { l:(f.four||factType(f.type).l)+" · "+ddmmyy(f.date)+" · "+fmtK(f.montant), primary:false, fn:function(){ provPayBill(p, f); } }; }).concat([{ l:"Autre montant…", primary:false, fn:function(){ addPrelevementForm(p); } }]));
      else addPrelevementForm(p);
    }
    function addPrelevementForm(p){
      var dm=(state.months&&state.months.provisions)||monthKey(todayISO());
      uiForm({ title:"Facture payée · "+p.nom, fields:[
        {key:"label", label:"Libellé", placeholder:"Facture novembre"},
        {key:"montant", label:"Montant prélevé", type:"money", value:(p.prevu||""), required:true},
        {key:"mois", label:"Mois du prélèvement", type:"month", value:dm}
      ]}, function(r){
        var m=(r.mois && /^[0-9]{4}-[0-9]{2}$/.test(r.mois))?r.mois:monthKey(todayISO());
        var mt=Math.abs(r.montant);
        function go(){
          if(!p.prelevements) p.prelevements=[];
          p.prelevements.push({ id:Date.now(), month:m, montant:mt, label:r.label||"Prélèvement" });
          persistProvisions(); render();
        }
        var dispo=provState(p, m).bal;
        if(mt>dispo+0.004){
          setTimeout(function(){ uiConfirm("Cette facture dépasse la provision de <b>"+fmt(mt-dispo)+"</b> (disponible : "+fmt(dispo)+").<br>Le surplus sera pris sur le total des provisions.", go, {ok:"Valider"}); }, 0);
          return;
        }
        go();
      });
    }
    function delPrelevement(id, prid){
      var p=provisions.filter(function(x){ return String(x.id)===String(id); })[0]; if(!p) return;
      var pr=(p.prelevements||[]).filter(function(x){ return String(x.id)===String(prid); })[0]; if(!pr) return;
      uiConfirm("Supprimer le prélèvement « "+esc(pr.label)+" » ("+fmt(pr.montant)+") ?", function(){
        p.prelevements=(p.prelevements||[]).filter(function(x){ return String(x.id)!==String(prid); });
        factures.forEach(function(f){ if(f.prId!=null && String(f.prId)===String(prid)){ delete f.prId; var fr=factFraisFor(f); if(fr) delete fr.pp; persistFactures(); persistFrais(); } });
        persistProvisions(); render();
      }, {ok:"Supprimer", danger:true});
    }
    function toggleSkip(id, mk){
      var p=provisions.filter(function(x){ return String(x.id)===String(id); })[0]; if(!p) return;
      if(!p.skips) p.skips=[];
      var i=p.skips.indexOf(mk);
      if(i>=0) p.skips.splice(i,1); else p.skips.push(mk);
      persistProvisions(); render();
    }
    // Projection d'une provision sur une suite de mois : solde de fin de mois, sorties (payées ou prévues), manque éventuel
    // Facture prévue d'une provision un mois donné (mois en cours ou futur, pas encore payée ce mois-là) : { amt, est, src, ref } ou null
    //   1. son montant prévu (✎) le mois de son échéance ;
    //   2. le fournisseur qu'elle suit : une facture reçue pas encore payée par elle, sinon la prochaine estimée (factEstimate) ;
    //   3. sinon ce qu'elle a payé le même mois l'an dernier ;
    //   échéance sans rien de tout ça : montant non indiqué (rien n'est retiré).
    function provPlanned(p, mk, curM, rec, last){
      if(rec>0.004) return null;
      var echM=!!p.echeance && +mk.split("-")[1]===+p.echeance;
      if(echM && Number(p.prevu)>0) return { amt:Number(p.prevu), est:false, src:"prevu" };
      if(p.fact){ var fp=provFactPlan(p, curM, last); if(fp){ if(fp[mk]) return fp[mk]; if(!echM) return null; } }
      var lm=(+mk.slice(0,4)-1)+mk.slice(4), ly=0; (p.prelevements||[]).forEach(function(pr){ if(pr.month===lm) ly+=Number(pr.montant)||0; });
      if(ly>0.004) return { amt:Math.round(ly*100)/100, est:true, src:"ly", ref:lm };
      return echM ? { amt:0, est:true, src:"unk" } : null;
    }
    // les factures à venir du fournisseur suivi par la provision, par mois de paiement (null : pas de suivi possible)
    function provFactPlan(p, curM, last){
      var mk="pf|"+p.id+"|"+curM+"|"+last; if(fsMemo[mk]!==undefined) return fsMemo[mk];
      if(!fsMemo.fser) fsMemo.fser=factSeries();
      var s=fsMemo.fser.filter(function(x){ return x.key===p.fact; })[0], out=null;
      if(s){ out={}; var lim=isoAddDays(todayISO(), -120);
        s.bills.forEach(function(b){ if(b.prId || !(Number(b.montant)>0) || (b.date||"")<lim) return; var m=b.prelev ? b.prelev.slice(0,7) : factPayMonth(b);
          if(m<curM || m>last || (p.startMonth && m<p.startMonth)) return;
          out[m]={ amt:Math.round(((out[m]?out[m].amt:0)+Number(b.montant))*100)/100, est:false, src:"recue", ref:b.date }; });
        if(s.next){ var d=s.next, g=0;
          while(g++<36){ var pm=factPayIso(s, d).slice(0,7); if(pm>last) break;
            if(pm>=curM && !out[pm] && !(p.startMonth && pm<p.startMonth)){ var v=factEstimate(s, d); if(v>0) out[pm]={ amt:Math.round(v*100)/100, est:true, src:"fact", ref:d }; }
            d=isoAddMonths(d, s.ryth||1); } }
        if(!s.next && !Object.keys(out).length) out=null;
      }
      fsMemo[mk]=out; return out;
    }
    // Projection d'une provision mois par mois : solde de fin de mois (jamais sous 0), sorties (payées ou prévues),
    // manque du mois (short) et manques cumulés (cum, pris sur le total des provisions).
    // plan : compte aussi les factures prévues (provPlanned) ; sinon seulement les prélèvements enregistrés.
    // Un mois futur : la projection part du mois en cours (pas de 0).
    function provProj(p, months, curM, plan){
      var start=p.startMonth||curM, last=months[months.length-1], run=[], mk=(months[0]>curM ? curM : months[0]), byM={}, prev=0, cum=0;
      while(mk<=last){ run.push(mk); mk=nextMonthKey(mk); }
      run.forEach(function(mk){
        var r={ bal:0, out:0, planned:0, est:false, short:0, cum:0, src:"" };
        if(mk<start){ byM[mk]=r; prev=0; return; }
        var rec=0; (p.prelevements||[]).forEach(function(pr){ if(pr.month===mk) rec+=Number(pr.montant)||0; });
        var bal;
        if(mk<=curM){ var st=provState(p, mk); bal=st.bal; cum=0; for(var k in st.over){ if(k<=mk) cum+=st.over[k]; } r.short=st.over[mk]||0; }
        else { bal=prev+(((p.skips||[]).indexOf(mk)<0)?mensuelAt(p, mk):0)-rec; if(bal<0){ r.short+=-bal; cum+=-bal; bal=0; } }
        r.out=rec;
        if(plan && mk>=curM){ var pl=provPlanned(p, mk, curM, rec, last);
          if(pl){ r.src=pl.src; r.ref=pl.ref; r.est=pl.est; r.planned=pl.amt; r.before=bal;
            if(pl.amt>bal){ r.short+=pl.amt-bal; cum+=pl.amt-bal; bal=0; } else bal-=pl.amt;
            r.out+=pl.amt; } }
        r.bal=bal; r.cum=cum; prev=bal; if(mk===curM && !plan){ var pc=provState(p, mk, null, true).bal; prev=pc; } else if(mk===curM){ prev=bal+(provState(p, mk, null, true).bal-provState(p, mk).bal); } byM[mk]=r;   // la suite du graphique compte la mise de côté du mois, même pas encore faite
      });
      return months.map(function(m){ return byM[m]||{ bal:0, out:0, planned:0, est:false, short:0, cum:0, src:"" }; });
    }
    var MOIS3=["jan","fév","mar","avr","mai","jun","jul","aoû","sep","oct","nov","déc"];
    // Total des provisions sur 12 mois à partir de month ; net = solde moins les manques pris sur le total
    function provYear(month, curM, plan){
      var months=[], mk=month; for(var i=0;i<12;i++){ months.push(mk); mk=nextMonthKey(mk); }
      var tot=months.map(function(m){ return { mk:m, bal:0, out:0, short:0, planned:0, cum:0, net:0, items:[] }; });
      provisions.forEach(function(p){
        provProj(p, months, curM, plan).forEach(function(r,i){
          var t=tot[i]; t.bal+=r.bal; t.out+=r.out; t.short+=r.short; t.planned+=r.planned; t.cum+=r.cum;
          if(r.out>0.004 || r.src==="unk") t.items.push({ p:p, nom:p.nom, amt:r.out, planned:!!r.src, est:r.est, short:r.short, mk:months[i], src:r.src, ref:r.ref, after:r.bal, before:r.before });
        });
      });
      tot.forEach(function(t){ t.net=t.bal-t.cum; });
      return tot;
    }
    function kShort(n){ n=Math.round(n); return n>=1000 ? (Math.round(n/100)/10).toString().replace(".",",")+"k" : String(n); }
    // d'où vient le montant d'une facture prévue
    function provSrcTxt(x){
      if(x.src==="prevu") return "montant prévu de la provision (✎)";
      if(x.src==="recue") return "facture reçue du "+ddmmyy(x.ref||"");
      if(x.src==="fact") return "estimée d'après tes factures";
      if(x.src==="ly") return "comme en "+monthLabelOf(x.ref);
      if(x.src==="unk") return "montant non indiqué (✎ de la provision)";
      return "";
    }
    // ----- Provisions en enveloppes (refonte du 19/11) : un cercle par enveloppe, la frise des factures, le détail d'une enveloppe -----
    // pv2Info : solde du mois, prochaine facture prévue sur 12 mois (provProj avec les factures prévues), manque et mise de côté conseillée
    function pv2Info(p, curM){
      var mk="pv2|"+p.id+"|"+curM; if(fsMemo[mk]) return fsMemo[mk];
      var months=[], m=curM, i; for(i=0;i<12;i++){ months.push(m); m=nextMonthKey(m); }
      var R=provProj(p, months, curM, true), nx=null, unk=null;
      R.forEach(function(r, k){ if(!nx && r.planned>0.004 && r.src) nx={ mk:months[k], amt:r.planned, short:r.short, before:r.before, after:r.bal, est:r.est, src:r.src, ref:r.ref, n:k };
        if(!unk && r.src==="unk") unk={ mk:months[k], n:k }; });
      var I={ bal:provState(p, curM).bal, nx:nx, unk:nx?null:unk, mens:mensuelAt(p, curM), conseil:null };
      if(nx && nx.short>0.5 && nx.n>0) I.conseil=Math.ceil(mensuelAt(p, nx.mk)+nx.short/nx.n);
      I.pct=nx ? Math.max(0, Math.min(100, Math.round(I.bal/nx.amt*100))) : null;
      I.weak=!!(nx && nx.short>0.5);
      return (fsMemo[mk]=I);
    }
    function pv2Live(curM){ return provisions.filter(function(p){ return !(p.startMonth && curM<p.startMonth); }); }
    function pv2Weak(){ var c=monthKey(todayISO()); return pv2Live(c).filter(function(p){ return pv2Info(p, c).weak; }).length; }
    function pv2When(mk, curM){ var n=monthsBetween(curM, mk); return n===0 ? "ce mois-ci" : (n===1 ? "le mois prochain" : (n<=3 ? "dans "+n+" mois" : MOIS_NOMS[+mk.slice(5,7)-1]+(mk.slice(0,4)!==curM.slice(0,4)?" "+mk.slice(0,4):""))); }
    function pv2Ring(pct, col, sz, t1, t2){
      var r=sz*0.42, sw=sz*0.11, c=2*Math.PI*r, d=pct==null ? c : c*pct/100, cx=sz/2;
      return '<svg width="'+sz+'" height="'+sz+'" viewBox="0 0 '+sz+' '+sz+'" role="img" aria-label="'+esc(pct==null?t1:pct+" % de la prochaine facture de côté")+'"><circle cx="'+cx+'" cy="'+cx+'" r="'+r.toFixed(1)+'" fill="none" stroke="var(--card2)" stroke-width="'+sw.toFixed(1)+'"></circle>'+
        (d>0.5?'<circle cx="'+cx+'" cy="'+cx+'" r="'+r.toFixed(1)+'" fill="none" stroke="'+col+'" stroke-width="'+sw.toFixed(1)+'" stroke-linecap="round" stroke-dasharray="'+d.toFixed(1)+' '+c.toFixed(1)+'" transform="rotate(-90 '+cx+' '+cx+')"></circle>':'')+
        '<text x="'+cx+'" y="'+(t2?cx-sz*0.02:cx+sz*0.07)+'" text-anchor="middle" font-size="'+(sz>90?24:14)+'" font-weight="800" fill="var(--ink)">'+esc(t1)+'</text>'+(t2?'<text x="'+cx+'" y="'+(cx+sz*0.15)+'" text-anchor="middle" font-size="12" fill="var(--muted)">'+esc(t2)+'</text>':'')+'</svg>';
    }
    function pv2Open(id){ state.provId=String(id); state.view="provdet"; render(); window.scrollTo(0,0); }
    function renderProvisions(){
      var curM=monthKey(todayISO()), ro=fyRO(), live=pv2Live(curM);
      var h=header(false, "À venir")+avTabsHTML("prov");
      if(!provisions.length){
        h+='<div class="empty">Aucune provision.<br>Crée une enveloppe pour tes frais annuels (taxe foncière, assurance, eau…) : tu mets un montant de côté chaque mois, le solde monte tout seul.</div>';
        if(!ro) h+='<button class="btn primary" id="addprov" type="button" style="margin-top:8px">+ Nouvelle enveloppe</button>';
        app.innerHTML=h; setNav("factures", true); wireAvTabs();
        var a0=document.getElementById("addprov"); if(a0) a0.onclick=addProvision; return;
      }
      var total=provTotalAt(curM), mensTot=0, weak=[], dueNow=0, fix=[], fixAdd=0;
      live.forEach(function(p){ var I=pv2Info(p, curM); if((p.skips||[]).indexOf(curM)<0) mensTot+=I.mens; if(I.weak) weak.push(p); if(I.nx && I.nx.n===0) dueNow++;
        if(I.conseil && I.conseil>mensuelAt(p, nextMonthKey(curM))+0.004){ fix.push({ p:p, v:I.conseil }); fixAdd+=I.conseil-mensuelAt(p, nextMonthKey(curM)); } });
      h+='<section class="paper av2-hero" id="pvHero"><div class="av2-k">Total provisions</div><div class="av2-big"><b>'+esc(fmtK(total))+'</b><span>+'+esc(fmtK(mensTot))+' / mois</span></div>';
      if(weak.length || dueNow) h+='<div class="pv2-chips">'+(weak.length?'<span class="w">'+weak.length+' enveloppe'+(weak.length>1?'s':'')+' à renforcer</span>':'')+(dueNow?'<span>'+dueNow+' facture'+(dueNow>1?'s':'')+' ce mois-ci</span>':'')+'</div>';
      else h+='<div class="av2-sub"><span class="ok">✓ Toutes tes enveloppes sont à l\'heure</span></div>';
      if(fix.length && !ro) h+='<button type="button" class="btn primary" id="pvFixAll" style="margin-top:4px">Tout remettre à l\'heure · +'+esc(fmtK(Math.ceil(fixAdd)))+' / mois</button>';
      h+='</section>';
      // les enveloppes
      h+='<div class="av2-h"><b>Mes enveloppes</b><small>'+live.length+'</small></div><div class="pv2-grid">';
      var prG=byOwner(live);
      prG.forEach(function(g){
        if(prG.length>1){ var gs=0; g.items.forEach(function(p){ gs+=provBalance(p, curM); }); h+='<div class="own-h"><span>'+esc(g.label)+'</span><span>'+fmtK(gs)+'</span></div>'; }
        g.items.forEach(function(p){ var I=pv2Info(p, curM), col=I.weak?'#e6b450':(I.nx?'var(--accent)':'#c78bd6'), q, st;
          if(I.nx){ q='<span class="q'+(I.weak?' w':'')+'">'+esc(pv2When(I.nx.mk, curM))+'</span>'; st=I.weak?'<span class="s w">manque '+esc(fmtK(I.nx.short))+'</span>':'<span class="s">à l\'heure ✓</span>'; }
          else if(I.unk){ q='<span class="q n">'+esc(pv2When(I.unk.mk, curM))+'</span>'; st='<span class="s">montant de la facture ?</span>'; }
          else { q='<span class="q n">pas de facture prévue</span>'; st='<span class="s">+'+esc(fmtK(I.mens))+' / mois</span>'; }
          h+='<button type="button" class="pv2-env pcard" data-id="'+esc(p.id)+'">'+pv2Ring(I.pct, col, 64, I.pct==null?'—':I.pct+'%')+'<b class="pname">'+esc(p.nom)+'</b>'+
            '<span class="v"><b>'+esc(fmtK(I.bal))+'</b>'+(I.nx?' <small>/ '+(I.nx.est?'≈ ':'')+esc(fmtK(I.nx.amt))+'</small>':'')+'</span>'+q+st+'</button>'; });
      });
      if(!ro) h+='<button type="button" class="pv2-add" id="addprov"><span>＋</span>Nouvelle enveloppe</button>';
      h+='</div>';
      var later=provisions.length-live.length; if(later) h+='<div class="muted" style="font-size:12px;margin:4px">'+later+' enveloppe'+(later>1?'s commencent':' commence')+' plus tard.</div>';
      h+='<div class="muted" style="font-size:11.5px;margin:2px 4px 6px;line-height:1.45">Le cercle : ce qui est de côté par rapport à la prochaine facture. Orange : il manquera de l\'argent à la date. Touche une enveloppe pour la gérer.</div>';
      // la frise des factures
      var PL=provYear(curM, curM, true), ftot=0, cells='';
      PL.forEach(function(t){ var its=t.items.filter(function(x){ return x.amt>0.004; }), mi=+t.mk.split("-")[1]-1, amt=0, sh=false, paid=true;
        its.forEach(function(x){ amt+=x.amt; if(x.short>0.5) sh=true; if(x.planned) paid=false; }); ftot+=amt;
        var yr=(mi===0 && t.mk!==curM)?'<b style="font-size:9.5px;color:var(--muted)">'+t.mk.slice(0,4)+'</b>':'';
        if(its.length) cells+='<button type="button" class="pvtl" data-id="'+esc(its[0].p.id)+'" data-m="'+t.mk+'" aria-label="'+esc(MOIS_NOMS[mi]+' : '+its.map(function(x){ return x.nom+' '+fmtK(x.amt); }).join(", "))+'"><span class="bb'+(sh?' w':(paid?' p':''))+'">'+esc(kShort(amt))+'</span><span class="nn">'+esc(its[0].nom.split(" ")[0])+(its.length>1?' +'+(its.length-1):'')+'</span><span class="mm">'+MOIS3[mi]+'</span></button>';
        else cells+='<div><span class="ee"></span><span class="nn">&#160;</span><span class="mm">'+MOIS3[mi]+'</span></div>'; });
      if(ftot>0.004) h+='<section class="paper pv2-tl"><div class="av2-h" style="margin:0"><b>Quand tombent les factures</b><small>'+esc(fmtK(ftot))+' sur 12 mois</small></div><div class="pv2-tlr">'+cells+'</div>'+
        '<div class="av2-lg" style="margin-top:10px"><span><span class="av2-dot g"></span>couverte</span><span><span class="av2-dot o"></span>il manquera</span></div></section>';
      app.innerHTML=h; setNav("factures", true); wireAvTabs();
      var ap=document.getElementById("addprov"); if(ap) ap.onclick=addProvision;
      [].forEach.call(document.querySelectorAll(".pv2-env[data-id], .pvtl[data-id]"), function(b){ b.onclick=function(){ pv2Open(b.getAttribute("data-id")); }; });
      var fa=document.getElementById("pvFixAll"); if(fa) fa.onclick=function(){ var from=nextMonthKey(curM), old=fix.map(function(x){ return { p:x.p, mc:JSON.parse(JSON.stringify(x.p.mensuelChanges||null)) }; });
        fix.forEach(function(x){ if(!x.p.mensuelChanges) x.p.mensuelChanges={}; x.p.mensuelChanges[from]=x.v; });
        persistProvisions(); render();
        uiUndoToast(fix.length+" enveloppe"+(fix.length>1?"s":"")+" à l'heure à partir de "+monthLabelOf(from), "Annuler", function(){ old.forEach(function(o){ if(o.mc) o.p.mensuelChanges=o.mc; else delete o.p.mensuelChanges; }); persistProvisions(); render(); }); };
    }
    function renderProvDet(){
      var p=provById(state.provId); if(!p){ state.view="factures"; state.avnSub="prov"; return renderFactures(); }
      var curM=monthKey(todayISO()), ro=fyRO(), I=pv2Info(p, curM), pst=provState(p, curM), nx=I.nx;
      var h=header(true, p.nom), col=I.weak?'#e6b450':(nx?'var(--accent)':'#c78bd6');
      h+='<section class="paper pvd-top">'+pv2Ring(nx?I.pct:null, col, 128, fmtK(I.bal).replace(/,00(?=\D*$)/,""), nx?'sur '+(nx.est?'≈ ':'')+fmtK(nx.amt).replace(/,00(?=\D*$)/,""):'de côté')+'<span class="tx">';
      if(nx) h+='<span>Prochaine facture</span><b>'+esc(pv2When(nx.mk, curM))+' · '+(nx.est?'≈ ':'')+esc(fmtK(nx.amt))+'</b>'+(I.weak?'<em>il manquera '+esc(fmtK(nx.short))+'</em>':'<em class="ok">à l\'heure'+(nx.after>0.5?' · il restera '+esc(fmtK(nx.after)):'')+'</em>')+'<span>'+esc(provSrcTxt(nx))+'</span>';
      else if(I.unk) h+='<span>Prochaine facture</span><b>'+esc(pv2When(I.unk.mk, curM))+'</b><span>Indique son montant (Modifier) pour savoir si ce sera suffisant.</span>';
      else h+='<span>Pas de facture prévue</span><b>+'+esc(fmtK(I.mens))+' / mois</b><span>Indique le mois et le montant de la facture (Modifier) pour suivre l\'enveloppe.</span>';
      h+='</span></section>';
      if(I.weak){
        if(I.conseil && !ro) h+='<div class="av2-warn" style="margin-bottom:12px">Pour l\'avoir à temps : <b>'+esc(fmtK(I.conseil))+' / mois</b> au lieu de '+esc(fmtK(mensuelAt(p, nx.mk)))+'.<br><button type="button" class="btn primary prapply" data-v="'+I.conseil+'">Passer à '+esc(fmtK(I.conseil))+' / mois</button></div>';
        else h+='<div class="av2-warn" style="margin-bottom:12px">Il manque <b class="m">'+esc(fmtK(nx.short))+'</b> : le reste sera pris sur le compte.</div>';
      }
      if(!ro){ var miss=factures.filter(function(b){ return p.fact && factKey(b)===p.fact && factProvMissing(b, p); });
        if(miss.length) h+='<div class="pv-miss" style="margin-bottom:12px"><span><b>'+(miss.length>1?miss.length+' factures pas encore retirées':'1 facture pas encore retirée')+'</b><small>'+esc(ddmm(miss[0].date))+' · '+esc(fmtK(miss[0].montant))+' · déjà dans tes comptes</small></span><button type="button" class="btn ghost pvret" data-f="'+esc(miss[0].id)+'" style="flex:0 0 auto;padding:7px 12px;font-size:12px">Retirer</button></div>'; }
      // chaque mois
      var canSkip=(curM>(p.startMonth||curM)), skipped=canSkip && (p.skips||[]).indexOf(curM)>=0, pff=p.noFrais ? null : provFraisOf(p);
      var pTrack=!!(pff && pff.provFrom && curM>=pff.provFrom && curM>(p.startMonth||curM)), pDone=pTrack && fraisDone(pff, curM), chip='';
      if(skipped) chip='<span class="st w">sauté ce mois</span>'; else if(pTrack) chip=pDone?'<span class="st ok">'+esc(MOIS_NOMS[+curM.slice(5,7)-1])+' : fait ✓</span>':'<span class="st w">pas encore fait</span>';
      h+='<section class="paper pvd-mo"><div class="r"><b style="font-size:14px">'+esc(fmtK(I.mens))+' chaque mois<small>'+esc(pff ? provInFrom(pff).replace(/^depuis /, "de ")+" → "+provWhereLabel(p) : "sur "+provWhereLabel(p)+" · pas dans les frais fixes")+'</small></b>'+chip+'</div>';
      if(!ro) h+='<div class="bt">'+(canSkip?'<button type="button" class="btn ghost prskip">'+(skipped?'↺ Rétablir ce mois':'⏸ Sauter ce mois')+'</button>':'')+'<button type="button" class="btn ghost predit">Changer le montant</button></div>';
      h+='</section>';
      if(pst.over[curM]) h+='<div class="av2-warn" style="margin-bottom:12px">Dépassement : '+esc(fmt(pst.over[curM]))+' pris sur le total des provisions.</div>';
      // comment elle s'est remplie (9 derniers mois)
      var hm=[], m=curM, k; for(k=0;k<9;k++){ if(p.startMonth && m<p.startMonth) break; hm.unshift(m); m=prevMonthKey(m); }
      if(hm.length>1){ var vals=hm.map(function(x){ return Math.max(0, provBalance(p, x)); }), goal=nx?nx.amt:0, mx=Math.max.apply(null, vals.concat([goal, 1])), H=96;
        h+='<section class="paper pvd-hist"><div class="av2-h" style="margin:0 0 6px"><b>Comment elle s\'est remplie</b>'+(goal?'<small>ligne : '+esc(fmtK(goal))+'</small>':'')+'</div><div class="pvd-bars">'+
          (goal?'<span class="goal" style="bottom:'+(18+goal/mx*H).toFixed(0)+'px"></span>':'')+hm.map(function(x, i){ return '<div><i style="height:'+Math.max(2, vals[i]/mx*H).toFixed(0)+'px"></i><span>'+MOIS3[+x.slice(5,7)-1]+'</span></div>'; }).join("")+'</div></section>'; }
      // prélèvements
      var prs=(p.prelevements||[]).slice().sort(function(a,b){ return (a.month<b.month)?1:-1; });
      if(prs.length){ h+='<div class="av2-h"><b>Factures payées</b><small>'+prs.length+'</small></div><section class="paper pvd-prl">';
        prs.forEach(function(pr){ h+='<div class="r"><span>'+esc(pr.label)+' · '+esc(monthLabelOf(pr.month))+'</span><b>−'+esc(fmtK(pr.montant).replace(/^-/,""))+'</b>'+(ro?'':'<button class="btn ghost prldel" type="button" data-pr="'+esc(pr.id)+'" aria-label="Retirer ce prélèvement" style="padding:6px 9px;flex:0 0 auto">✕</button>')+'</div>'; });
        h+='</section>'; }
      if(!ro) h+='<button class="btn primary addprl" type="button" style="width:100%">La facture est payée · enregistrer le prélèvement</button>'+
        '<div class="ui-stack" style="margin-top:10px;flex-direction:row;gap:8px"><button class="btn ghost predit" type="button" style="flex:1">Modifier l\'enveloppe</button><button class="btn ghost prdel" type="button" style="flex:1;color:var(--coral)">Supprimer</button></div>';
      app.innerHTML=h; setNav("factures", true);
      bindBack(function(){ state.view="factures"; state.avnSub="prov"; render(); window.scrollTo(0,0); });
      var id=p.id;
      [].forEach.call(document.querySelectorAll(".predit"), function(b){ b.onclick=function(){ editProvision(id); }; });
      [].forEach.call(document.querySelectorAll(".prdel"), function(b){ b.onclick=function(){ delProvision(id); }; });
      [].forEach.call(document.querySelectorAll(".prskip"), function(b){ b.onclick=function(){ toggleSkip(id, curM); }; });
      [].forEach.call(document.querySelectorAll(".addprl"), function(b){ b.onclick=function(){ addPrelevement(id); }; });
      [].forEach.call(document.querySelectorAll(".prldel"), function(b){ b.onclick=function(){ delPrelevement(id, b.getAttribute("data-pr")); }; });
      [].forEach.call(document.querySelectorAll(".pvret"), function(b){ b.onclick=function(){ var f=factures.filter(function(x){ return String(x.id)===b.getAttribute("data-f"); })[0]; if(f) factPayFlow(f, p); }; });
      [].forEach.call(document.querySelectorAll(".prapply"), function(b){ b.onclick=function(){ var v=Number(b.getAttribute("data-v")), from=nextMonthKey(curM);
        if(!p.mensuelChanges) p.mensuelChanges={}; p.mensuelChanges[from]=v; persistProvisions(); render(); uiToast(fmt(v)+" / mois à partir de "+monthLabelOf(from)); }; });
    }
