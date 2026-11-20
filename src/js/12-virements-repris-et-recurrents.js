    // ---------- Virements repris et récurrents ----------
    // « Reprendre des virements » du mois d'avant : copies dans le mois suivant, un mois choisi, une période, ou « chaque mois ».
    // Chaque mois = une série (clé virRec, gardée sur le téléphone du propriétaire) : l'appli crée elle-même le virement de chaque
    // mois jusqu'à 12 mois à l'avance (v.rec = id de la série), à cocher « fait » quand il passe ; un mois déjà créé (s.made)
    // n'est jamais recréé, même si son virement a été supprimé. Montant « à partir de » : s.amounts, comme les frais fixes.
    var virRec = store.read("virRec", []);
    function persistVirRec(){ store.write("virRec", virRec); }
    function virRecById(id){ return id==null ? null : virRec.filter(function(x){ return String(x.id)===String(id); })[0]||null; }
    function virRecAmt(r, m){ var best=null; for(var k in (r.amounts||{})){ if(k<=m && (best===null || k>best)) best=k; } return best!==null ? Number(r.amounts[best])||0 : Number(r.montant)||0; }
    function virNewId(){ var mx=Date.now(); virements.forEach(function(v){ var n=Number(v.id); if(n>=mx) mx=n+1; }); virRec.forEach(function(r){ var n=Number(r.id); if(n>=mx) mx=n+1; }); return mx; }
    function virCopy(v, m){
      var c={ id:virNewId(), person:v.person, month:m, label:v.label||"Virement", note:(v.imp ? "" : (v.note||"")), montant:Number(v.montant)||0 };
      var d=virDay(v); if(d) c.day=d;
      if(v.epargneId){ c.epargneId=v.epargneId; c.epApplied=0; }
      if(v.vers) c.vers=v.vers; if(v.bourseId!=null){ c.bourseId=v.bourseId; c.bApplied=0; }
      return c;
    }
    // le même virement (même nom, même montant) est déjà dans ce mois
    function virHas(person, m, v){ var n=norm(v.label||""), a=Number(v.montant)||0; return virements.some(function(x){ return x!==v && x.person===person && x.month===m && norm(x.label||"")===n && Math.abs((Number(x.montant)||0)-a)<0.006; }); }
    function virRecSync(){
      if(fyMember() || !virRec.length) return;
      var hz=monthKey(todayISO()), ch=false, i; for(i=0;i<11;i++) hz=nextMonthKey(hz);
      virRec.forEach(function(r){
        if(!r.made) r.made={};
        if(!acctByKey(r.person)) return;
        var end=(r.to && r.to<hz) ? r.to : hz, g=0;
        for(var m=r.from; m && m<=end && g<240; m=nextMonthKey(m), g++){
          if(r.made[m]) continue;
          r.made[m]=1; ch=true;
          if(virements.some(function(x){ return String(x.rec)===String(r.id) && x.month===m; })) continue;
          var c={ id:virNewId(), person:r.person, month:m, label:r.label, note:r.note||"", montant:virRecAmt(r, m), rec:r.id };
          if(r.day) c.day=r.day; if(r.epargneId){ c.epargneId=r.epargneId; c.epApplied=0; } if(r.vers) c.vers=r.vers; if(r.bourseId!=null){ c.bourseId=r.bourseId; c.bApplied=0; }
          virements.push(c);
        }
      });
      if(ch){ persistVirRec(); persistVirements(); }
    }
    // Reprendre des virements : ceux du mois d'avant le mois affiché (ou un seul, depuis sa fiche)
    function virReprendre(person, month, one){
      var src=one ? one.month : prevMonthKey(month), nx=nextMonthKey(src), p2=prevMonthKey(src);
      var L=one ? [one] : virementsOf(person, src).filter(function(v){ return Math.abs(Number(v.montant)||0)>=0.005 && v.pairOf==null; });   // une ligne d'en face suit son virement : on reprend l'original
      if(!L.length){ uiToast("Aucun virement "+impDeMois(src)); return; }
      L=L.slice().sort(function(a,b){ return (virDay(a)||32)-(virDay(b)||32); });
      function seen(v){ var n=norm(v.label||""); return virements.some(function(x){ return x.person===person && x.month===p2 && norm(x.label||"")===n; }); }
      var acc=acctByKey(person);
      var h='<div class="sheet-title">'+(one ? 'Reprendre « '+esc(one.label||"Virement")+' »' : 'Reprendre des virements '+esc(impDeMois(src)))+'</div>'+
        '<div class="ui-intro">'+(one ? esc(capFirst(monthLabelOf(src))) : 'Coche ceux à remettre')+(acc ? ' · '+esc(acc.nom) : '')+'</div><div class="vr-list">';
      L.forEach(function(v, i){ var a=Number(v.montant)||0, rc=v.rec!=null && virRecById(v.rec), dup=virHas(person, nx, v), d=virDay(v);
        var on=one ? !rc : (!rc && !dup && seen(v));
        h+='<label class="vr-r'+(rc?' off':'')+'"><input type="checkbox" data-i="'+i+'"'+(on?' checked':'')+(rc?' disabled':'')+'><span class="t"><b>'+esc(v.label||"Virement")+'</b><small>'+(a>0?'reçu':'envoyé')+(v.epargneId?' · '+(a<0?'vers ':'depuis ')+esc(epNameOf(v.epargneId)):'')+(d?' · le '+(d===1?'1er':d):'')+(rc?' · ↻ déjà chaque mois':(dup?' · déjà en '+esc(MOIS_NOMS[+nx.slice(5,7)-1]):''))+'</small></span><b class="a'+(a>0?' pos':'')+'">'+esc(opsAmt(a))+'</b></label>'; });
      h+='</div><label class="f" style="margin-top:12px">Les ajouter</label>'+
        '<div class="ui-seg" id="vrWhen"><button type="button" data-v="next" class="on">Mois suivant</button><button type="button" data-v="one">Un mois</button><button type="button" data-v="per">Une période</button><button type="button" data-v="rec">Chaque mois</button></div>'+
        '<div id="vr-one" style="display:none"><label class="f" for="vrM1">Mois</label><input class="f" type="month" id="vrM1" value="'+nx+'"></div>'+
        '<div id="vr-per" style="display:none" class="row2"><div><label class="f" for="vrPF">De</label><input class="f" type="month" id="vrPF" value="'+nx+'"></div><div><label class="f" for="vrPT">À (inclus)</label><input class="f" type="month" id="vrPT" value="'+nextMonthKey(nextMonthKey(nx))+'"></div></div>'+
        '<div id="vr-rec" style="display:none" class="row2"><div><label class="f" for="vrRF">À partir de</label><input class="f" type="month" id="vrRF" value="'+nx+'"></div><div><label class="f" for="vrRT">Jusqu\'à (vide = sans fin)</label><input class="f" type="month" id="vrRT" value=""></div></div>'+
        '<div class="fnote" id="vrNote"></div><div class="ui-err" style="display:none"></div>'+
        '<div class="ui-actions"><button type="button" class="btn ghost ui-cancel">Annuler</button><button type="button" class="btn primary" id="vrOk">Ajouter</button></div>';
      var sh=uiSheet(h), mode="next", okM=/^[0-9]{4}-[0-9]{2}$/;
      function val(id){ var e=sh.q("#"+id); return e ? String(e.value||"").trim() : ""; }
      function picked(){ var o=[]; [].forEach.call(sh.qa('.vr-r input'), function(c){ if(c.checked && !c.disabled) o.push(L[+c.getAttribute("data-i")]); }); return o; }
      function mShort(m){ return MOIS_NOMS[+m.slice(5,7)-1]+(m.slice(0,4)!==monthKey(todayISO()).slice(0,4)?" "+m.slice(0,4):""); }
      function paint(){
        var n=picked().length, t;
        ["one","per","rec"].forEach(function(k){ sh.q("#vr-"+k).style.display=(mode===k)?"":"none"; });
        if(mode==="next") t="en "+mShort(nx); else if(mode==="one") t=okM.test(val("vrM1"))?"en "+mShort(val("vrM1")):"";
        else if(mode==="per") t=(okM.test(val("vrPF")) && okM.test(val("vrPT")))?"de "+mShort(val("vrPF"))+" à "+mShort(val("vrPT")):"";
        else t="chaque mois";
        sh.q("#vrOk").textContent=n ? "Ajouter "+n+" virement"+(n>1?"s":"")+(t?" · "+t:"") : "Ajouter";
        sh.q("#vrOk").style.opacity=n?"":".45";
        sh.q("#vrNote").textContent=(mode==="rec") ? "Ils arrivent dans « À venir » de chaque mois (jusqu'à 12 mois à l'avance), au même jour, à cocher « fait » quand ils passent. Montant modifiable mois par mois." : "Ils arrivent dans « À venir », au même jour, à cocher « fait » quand ils passent.";
      }
      [].forEach.call(sh.qa("#vrWhen button"), function(b){ b.onclick=function(){ [].forEach.call(sh.qa("#vrWhen button"), function(x){ x.className=""; }); b.className="on"; mode=b.getAttribute("data-v"); paint(); }; });
      [].forEach.call(sh.qa('.vr-r input, input[type="month"]'), function(e){ e.addEventListener("change", paint); e.addEventListener("input", paint); });
      sh.q(".ui-cancel").onclick=sh.close;
      function err(m){ var e=sh.q(".ui-err"); e.textContent=m||""; e.style.display=m?"":"none"; }
      sh.q("#vrOk").onclick=function(){
        var P=picked(); if(!P.length){ err("Coche au moins un virement."); return; }
        var months=[], made=0, skip=0, txt="";
        if(mode==="next") months=[nx];
        else if(mode==="one"){ if(!okM.test(val("vrM1"))){ err("Choisis le mois."); return; } months=[val("vrM1")]; }
        else if(mode==="per"){ var a=val("vrPF"), b=val("vrPT"); if(!okM.test(a) || !okM.test(b)){ err("Choisis le premier et le dernier mois."); return; } if(b<a){ err("Le dernier mois est avant le premier."); return; }
          for(var m=a, g=0; m<=b && g<120; m=nextMonthKey(m), g++) months.push(m); }
        if(mode==="rec"){
          var f=val("vrRF"), to=val("vrRT"); if(!okM.test(f)){ err("Choisis le premier mois."); return; } if(to && !okM.test(to)) to=""; if(to && to<f){ err("Le dernier mois est avant le premier."); return; }
          P.forEach(function(v){ var r={ id:virNewId(), person:person, label:v.label||"Virement", note:(v.imp?"":(v.note||"")), montant:Number(v.montant)||0, from:f, made:{} };
            var d=virDay(v); if(d) r.day=d; if(to) r.to=to; if(v.epargneId) r.epargneId=v.epargneId; if(v.vers) r.vers=v.vers; if(v.bourseId!=null) r.bourseId=v.bourseId;
            // un mois où il est déjà : pas de 2e virement
            var hz=monthKey(todayISO()), i; for(i=0;i<11;i++) hz=nextMonthKey(hz);
            for(var m=f, g=0; m<=(to && to<hz ? to : hz) && g<240; m=nextMonthKey(m), g++){ if(virHas(person, m, v)){ r.made[m]=1; skip++; } }
            virRec.push(r); made++; });
          persistVirRec(); virRecSync(); txt=" · à partir "+impDeMois(f)+(to?" jusqu'à "+mShort(to):"");
        } else {
          P.forEach(function(v){ months.forEach(function(m){ if(virHas(person, m, v)){ skip++; return; } var c=virCopy(v, m); c.person=person; virements.push(c); made++; }); });
          persistVirements(); txt=months.length===1 ? " · "+mShort(months[0]) : " · "+months.length+" mois";
        }
        sh.close(); render();
        uiToast((mode==="rec" ? made+" virement"+(made>1?"s":"")+" chaque mois" : made+" virement"+(made>1?"s":"")+" ajouté"+(made>1?"s":""))+txt+(skip?" · "+skip+" déjà là":""));
      };
      paint();
    }
    // Un virement envoyé devient un frais fixe (un mois, plusieurs mois ou sans fin) : il disparaît de son mois et le frais prend sa place
    // (déjà fait → le frais est fait ce mois-là, le même jour : le solde ne bouge pas) ; les mêmes virements des mois couverts
    // (repris, ou d'une série « chaque mois ») partent aussi, sauf « Les garder ». Venu d'un relevé : le frais garde sa clé d'import.
    function virToFrais(v){
      var m0=v.month, amt=Math.round(Math.abs(Number(v.montant)||0)*100)/100, acc=acctByKey(v.person), owner=(acc && acctOwner(acc))||mePerson(), d=virDay(v), okM=/^[0-9]{4}-[0-9]{2}$/;
      var r0=v.rec!=null ? virRecById(v.rec) : null;
      function sameLater(lastM){ var n=norm(v.label||""), a=Number(v.montant)||0;
        return virements.filter(function(x){ return x!==v && x.person===v.person && x.month>m0 && (!lastM || x.month<=lastM) && !x.done &&
          ((r0 && String(x.rec)===String(r0.id)) || (norm(x.label||"")===n && Math.abs((Number(x.montant)||0)-a)<0.006)); }); }
      var nAll=sameLater(null).length, dur0=(r0 || nAll) ? "inf" : "1", ppl=uniquePersons(); if(ppl.indexOf(owner)<0) ppl.unshift(owner);
      uiForm({ title:"Passer en frais fixe", intro:"« "+esc(v.label||"Virement")+" » ("+esc(fmtK(amt))+") devient un frais fixe à partir de "+esc(monthLabelOf(m0))+" : le virement est remplacé"+(v.done?", déjà passé (le solde ne change pas)":"")+".", fields:[
        {key:"label", label:"Nom", value:v.label||"", required:true},
        {key:"montant", label:"Montant", type:"money", value:amt, required:true}
      ].concat([
        // à choisir à chaque fois : commun (partagé selon les parts) ou perso (à une personne)
        {key:"kind", label:"Frais commun ou perso ?", type:"seg", value:"", options:[{v:"Commun",l:"Commun (partagé)"},{v:"perso",l:"Perso"}],
          help:"Commun : partagé selon les parts du Commun. Perso : à une seule personne.",
          onChange:function(x, api){ var w=(x==="perso") ? (api.get("who")||owner) : "Commun"; api.show("who", x==="perso"); api.show("pay", x==="Commun");
            api.show("acct", !(x==="Commun" && api.get("pay")==="split")); if(!acctPick.touched) api.set("acct", acctDefKey(w)); }},
        {key:"who", label:"Pour qui", type:"select", value:owner, hidden:true, options:ppl.map(function(n){ return {v:n, l:n}; }),
          onChange:function(x, api){ if(!acctPick.touched) api.set("acct", acctDefKey(x)); }}
      ]).concat(payFields({ personne:"Commun" }).map(function(x){ x.hidden=true; return x; })).concat(acctFields(v.person, owner)).concat([
        {key:"dur", label:"Durée", type:"seg", value:dur0, options:[{v:"1",l:"Un mois"},{v:"n",l:"Plusieurs mois"},{v:"inf",l:"Sans fin"}],
          onChange:function(x, api){ api.show("fin", x==="n"); api.show("later", x!=="1" && nAll>0); }},
        {key:"fin", label:"Jusqu'au mois (inclus)", type:"month", value:nextMonthKey(nextMonthKey(m0)), hidden:true},
        dayField(d||"", "Jour du prélèvement (facultatif)", "Range le frais dans la liste du compte."),
        {key:"later", label:"Les mêmes virements des mois suivants ("+nAll+")", type:"seg", value:"del", hidden:!(nAll && dur0!=="1"), options:[{v:"del",l:"Les retirer"},{v:"keep",l:"Les garder"}],
          help:"Ceux des mois couverts par le frais, pour ne pas le compter deux fois."+(r0?" Le virement « chaque mois » s'arrête.":"")}
      ])}, function(r){
        if(r.kind!=="Commun" && r.kind!=="perso") return "Choisis : frais commun ou perso.";
        var jd=dayRead(r); if(jd.err) return jd.err;
        var fin=null; if(r.dur==="n"){ if(!okM.test(r.fin||"")) return "Choisis le dernier mois."; if(r.fin<m0) return "Le dernier mois est avant le premier."; fin=r.fin; }
        var rec=(r.dur!=="1" && fin!==m0), who=(r.kind==="Commun") ? "Commun" : (r.who||owner);
        var nf={ id:Date.now(), label:r.label||v.label||"Frais", montant:r.montant, personne:who, recurrent:rec, month:(rec ? null : m0) };
        if(rec){ nf.startMonth=m0; if(fin) nf.endMonth=fin; }
        if(jd.v) nf.jour=jd.v;
        if(who==="Commun" && r.pay==="split") nf.split=true; else { var ak=acctPicked(r, who); if(ak) nf.compte=ak; }
        if(v.impKey && !nf.split){ nf.impKeys=[v.impKey]; if(!nf.compte) nf.compte=v.person; }   // un nouvel import ne le recrée pas
        if(v.done){ nf.doneMonths={}; nf.doneMonths[m0]=true; if(d){ nf.doneDays={}; nf.doneDays[m0]=d; } }
        var gone=(rec && r.later!=="keep") ? sameLater(fin) : [], to0=r0 ? r0.to : undefined;
        fraisCommuns.push(nf);
        virements=virements.filter(function(x){ return x!==v && gone.indexOf(x)<0; });
        if(r0 && rec && r.later!=="keep") r0.to=prevMonthKey(m0);
        persistFrais(); persistVirements(); if(r0) persistVirRec(); render();
        uiUndoToast("« "+nf.label+" » : frais fixe "+(rec ? (fin ? "jusqu'à "+monthLabelOf(fin) : "chaque mois") : "de "+monthLabelOf(m0))+(gone.length ? " · "+gone.length+" virement"+(gone.length>1?"s":"")+" suivant"+(gone.length>1?"s":"")+" retiré"+(gone.length>1?"s":"") : ""), "Annuler", function(){
          fraisCommuns=fraisCommuns.filter(function(x){ return x!==nf; }); virements.push(v); gone.forEach(function(x){ virements.push(x); });
          if(r0){ if(to0===undefined) delete r0.to; else r0.to=to0; persistVirRec(); }
          persistFrais(); persistVirements(); render(); uiToast("Virement remis");
        });
      });
    }
    // Un virement d'une série : modifier à partir de ce mois, retirer un mois, arrêter
    function virRecEdit(r, v){
      var m=v.month, cur=virRecAmt(r, m);
      uiForm({ title:"À partir de "+monthLabelOf(m), intro:"« "+esc(r.label)+" » chaque mois : ce mois-ci et les suivants (pas ceux déjà faits).", fields:[
        {key:"label", label:"Libellé", value:r.label, required:true},
        {key:"montant", label:"Montant", type:"money", value:Math.abs(cur), required:true},
        {key:"sens", label:"Sens", type:"seg", value:(cur<0?"out":"in"), options:SENS_OPTS},
        dayField(r.day||"", "Jour (facultatif)", "Range le virement dans la liste du compte.")
      ]}, function(x){
        var jd=dayRead(x); if(jd.err) return jd.err;
        var nm=(x.sens==="out"?-1:1)*Math.abs(x.montant);
        r.label=x.label||r.label; if(jd.v) r.day=jd.v; else delete r.day;
        if(Math.abs(nm-cur)>0.001){ if(!r.amounts) r.amounts={}; r.amounts[m]=nm; }
        virements.forEach(function(y){ if(String(y.rec)!==String(r.id) || y.month<m || y.done) return; y.label=r.label; y.montant=virRecAmt(r, y.month); if(r.day) y.day=r.day; else delete y.day; delete y.dayAuto; });
        persistVirRec(); persistVirements(); render(); uiToast("« "+r.label+" » modifié à partir de "+monthLabelOf(m));
      });
    }
    function virRecStop(r, m){
      var later=virements.filter(function(y){ return String(y.rec)===String(r.id) && y.month>=m && !y.done; });
      uiConfirm("Arrêter « "+esc(r.label)+" » à partir de "+esc(monthLabelOf(m))+" ?"+(later.length?"<br><small>"+(later.length>1?"Ses "+later.length+" virements à venir sont retirés.":"Son virement à venir est retiré.")+"</small>":""), function(){
        virements=virements.filter(function(y){ return later.indexOf(y)<0; });
        r.to=prevMonthKey(m); if(r.to<r.from) virRec=virRec.filter(function(x){ return x!==r; });
        persistVirRec(); persistVirements(); render(); uiToast("« "+r.label+" » arrêté à partir de "+monthLabelOf(m));
      }, { ok:"Arrêter", danger:true });
    }
    function virRemoveOne(v){
      var i=virements.indexOf(v); if(i<0) return;
      if(v.epargneId && v.done && v.epApplied) applyEp(v.epargneId, -(v.epApplied||0));
      virements.splice(i, 1); persistVirements(); render();
      uiUndoToast("« "+(v.label||"Virement")+" » retiré de "+monthLabelOf(v.month), "Annuler", function(){
        if(v.epargneId && v.done && v.epApplied) applyEp(v.epargneId, v.epApplied);
        virements.push(v); persistVirements(); render(); });
    }
    // Ce qui sort du compte en banque un mois donné : tickets payés depuis ce compte (pas en espèces) et frais fixes ; done = seulement les frais « faits »
    function depMonth(person, month, done){
      var st0=acctStart(person); if(st0 && month<st0) return 0;
      var paid=0; entriesOfMonth(month).forEach(function(e){ if(tkBank(e, person)) paid+=Number(e.montant)||0; });
      var fx=0; fraisCommuns.forEach(function(f){ if(fraisActif(f, month) && (!done || fraisDone(f, month)) && fraisKind(f, person)) fx+=fraisAcctAmt(f, person, month); });
      return paid+fx;
    }
    function computeDepensesMonth(person, month){ return depMonth(person, month, false); }
    // Début du suivi d'un compte : son mois de création, sinon son premier solde de départ, sinon le début d'utilisation de l'appli
    // (date de création la plus ancienne : les identifiants sont des horodatages). Avant ce mois, le compte ne bouge pas.
    var useStartMemo=null;
    function useStart(){
      var sig=state.entries.length+"|"+fraisCommuns.length+"|"+virements.length+"|"+comptes.length;
      if(useStartMemo && useStartMemo.sig===sig) return useStartMemo.v;
      var lo=Infinity, now=Date.now()+86400000;
      function t(n){ n=Number(n); if(n>1e12 && n<now && n<lo) lo=n; }
      state.entries.forEach(function(e){ t(e.id); }); fraisCommuns.forEach(function(f){ t(f.id); }); virements.forEach(function(v){ t(v.id); });
      (provisions||[]).forEach(function(x){ t(x.id); }); (epargne||[]).forEach(function(x){ t(x.id); });
      comptes.forEach(function(a){ t(String(a.key||"").replace(/^acc/,"")); });
      var v=null; if(lo<Infinity){ var d=new Date(lo); v=d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2); }
      useStartMemo={ sig:sig, v:v }; return v;
    }
    function acctStart(person){
      var ac=acctByKey(person); if(ac && ac.since) return ac.since;
      var si=soldeInit[person], ks=si?Object.keys(si).sort():[]; if(ks.length) return ks[0];
      return useStart();
    }
    function compteMonths(person, upto){
      var set={};
      state.entries.forEach(function(e){ var m=monthKey(e.date); if(m && m<=upto) set[m]=true; });
      virements.forEach(function(v){ if(v.person===person && v.month<=upto) set[v.month]=true; });
      if(soldeInit[person]) Object.keys(soldeInit[person]).forEach(function(m){ if(m<=upto) set[m]=true; });
      set[upto]=true;
      var ac=acctByKey(person);
      var st=acctStart(person); if(st && st<=upto) set[st]=true;   // compte neuf sans opération : ses frais fixes se cumulent depuis son début
      var ks=Object.keys(set).filter(function(m){ return !st || m>=st || m===upto; }).sort();
      // tous les mois entre le premier et le mois affiché : un mois sans ticket compte quand même ses frais fixes
      if(ks.length>1){ var all=[], m=ks[0], g=0; while(m<=upto && g<600){ all.push(m); m=nextMonthKey(m); g++; } return all; }
      return ks;
    }
    // Solde d'un compte mois par mois jusqu'à « upto » : ouverture (reporté) et clôture. done = seulement ce qui est fait (la banque).
    // Une seule boucle pour les deux (20/11) ; chaque mois calculé est gardé le temps de l'affichage (calcGet).
    function soldeRun(person, upto, done){
      var st0=acctStart(person); if(st0 && upto<st0) return { opening:0, closing:0 };   // compte pas encore suivi
      var C=calcGet(), key="sf|"+(done?1:0)+"|"+person+"|"+upto; if(C[key]) return C[key];
      var ms=compteMonths(person, upto), closing=0, out={ opening:0, closing:0 };
      for(var i=0;i<ms.length;i++){
        var m=ms[i], ov=getSoldeInit(person,m);
        var opening=(ov!==null)?ov:closing;
        var c=opening + (done ? virementsSumDone(person,m)-computeDepensesMonthDone(person,m) : virementsSum(person,m)-computeDepensesMonth(person,m));
        closing=c;
        C["sf|"+(done?1:0)+"|"+person+"|"+m]={ opening:opening, closing:c };
        if(m===upto) out={ opening:opening, closing:c };
      }
      C[key]=out; return out;
    }
    function soldeFlow(person, upto){ return soldeRun(person, upto, false); }
    function virementsSumDone(p,m){ return virementsOf(p,m).reduce(function(t,v){ return t+(v.done?(Number(v.montant)||0):0); },0)+provInSum(p, m, true); }
    function computeDepensesMonthDone(person, month){ return depMonth(person, month, true); }
    function soldeFlowDone(person, upto){ return soldeRun(person, upto, true); }
    var epargne = store.read("epargne", []);
    (function(){ var m=monthKey(todayISO()), ch=false;
      epargne.forEach(function(c){ if(!c.vals){ c.vals={}; if(typeof c.montant!=="undefined") c.vals[m]=Number(c.montant)||0; delete c.montant; ch=true; } });
      if(ch) store.write("epargne", epargne);
    })();
    function persistEpargne(){ store.write("epargne", epargne); }
    var bourse = store.read("bourse", []);
    // Historique du total Bourse : un point à chaque mise à jour (15 min), compacté à un point par jour au-delà de 3 jours
    var bourseHist = store.read("bourseHist", []);
    function bourseCapNow(){ var t=0; bourse.forEach(function(c){ var l=bLast(c); if(l) t+=(Number(l.capital)||0)+bCash(l); }); return t; }
    function recordBourseHist(){
      if(!bourse.length) return;
      var v=Math.round(bourseTotalLive()*100)/100; if(!(v>0)) return;
      var now=Date.now(), last=bourseHist[bourseHist.length-1];
      if(last && Math.abs(last.v-v)<0.005 && now-last.t<6*3600000) return;
      if(last && now-last.t<10*60000){ last.v=v; last.t=now; last.c=bourseCapNow(); }
      else bourseHist.push({ t:now, v:v, c:bourseCapNow() });
      var lim=now-3*86400000, recent=[], byDay={};
      bourseHist.forEach(function(p){ if(p.t>=lim){ recent.push(p); return; } var d=new Date(p.t); byDay[d.getFullYear()+"-"+d.getMonth()+"-"+d.getDate()]=p; });
      bourseHist=Object.keys(byDay).map(function(k){ return byDay[k]; }).sort(function(a,b){ return a.t-b.t; }).concat(recent);
      store.write("bourseHist", bourseHist);
    }
    function bourseSeries(){
      var pts=[], first=bourseHist.length?bourseHist[0].t:Infinity, now=Date.now();
      var allM={}; bourse.forEach(function(c){ bMonths(c).forEach(function(m){ allM[m]=1; }); });
      Object.keys(allM).sort().forEach(function(m){
        var p=m.split("-"), end=new Date(+p[0], +p[1], 0, 20, 0, 0).getTime();
        if(end>=first || end>=now) return;
        var t=0, cp=0; bourse.forEach(function(c){ var a=bAt(c,m); if(a){ t+=bTot(a); cp+=(Number(a.capital)||0)+bCash(a); } });
        if(t>0) pts.push({ t:end, v:t, c:cp, m:1 });
      });
      bourseHist.forEach(function(h){ pts.push({ t:h.t, v:h.v, c:(h.c!=null?h.c:bourseCapNow()) }); });
      if(!bourseHist.length){ var v=bourseTotalLive(); if(v>0) pts.push({ t:now, v:v, c:bourseCapNow() }); }
      return pts;
    }
