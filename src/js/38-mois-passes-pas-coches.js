    // ---------- Mois passés pas cochés ----------
    // Frais fixes et virements des mois passés jamais cochés « fait » : ils comptent dans la fin de mois (soldeFlow) mais pas dans la banque.
    // La ligne « Pas cochés les mois passés » les montre ; pour chacun : Payé (coché ce mois-là), N'a pas eu lieu (retiré de ce mois), À payer (reste compté, f.pastOk / v.pastOk).
    function pastOpen(key, month){
      if(month>monthKey(todayISO())) return [];
      var ms=compteMonths(key, month), from="", L=[];
      ms.forEach(function(m){ if(getSoldeInit(key, m)!==null) from=m; });   // un solde reporté remet le compte à zéro : rien d'avant ne compte
      ms.forEach(function(m){ if(m>=month || (from && m<from)) return;
        fraisCommuns.forEach(function(f){ if(!fraisActif(f, m) || fraisDone(f, m) || !fraisKind(f, key)) return; var a=fraisAcctAmt(f, key, m); if(!(Math.abs(a)>0.004)) return;
          L.push({ k:"f", o:f, m:m, a:-a, n:f.label||"Frais fixe", ok:!!(f.pastOk && f.pastOk[m]) }); });
        fraisCommuns.forEach(function(f){ var a=provInAmt(f, key, m); if(!a || fraisDone(f, m)) return; L.push({ k:"f", o:f, m:m, a:a, n:(f.label||"Provision")+" · entrée", ok:!!(f.pastOk && f.pastOk[m]) }); });
        virementsOf(key, m).forEach(function(v){ var a=Number(v.montant)||0; if(v.done || !(Math.abs(a)>0.004)) return; L.push({ k:"v", o:v, m:m, a:a, n:v.label||"Virement", ok:!!v.pastOk }); });
      });
      return L.sort(function(x, y){ return x.m<y.m ? -1 : x.m>y.m ? 1 : String(x.n).localeCompare(String(y.n), "fr"); });
    }
    function pastSheet(key, month){
      var L=pastOpen(key, month); if(!L.length){ render(); return; }
      var ro=fyRO(), tot=0; L.forEach(function(x){ tot+=x.a; });
      var h='<div class="sheet-title">Pas cochés les mois passés</div><div class="ui-intro">Ces opérations n\'ont jamais été cochées « fait ». Elles comptent dans ta fin de mois ('+esc(opsAmt(tot))+') mais pas dans ta banque. Dis pour chacune ce qu\'il en est.</div><div class="dr-grp" style="padding:0 12px">';
      L.forEach(function(x, i){
        var can=!ro && (x.k!=="f" || fyFraisCanEdit(x.o));
        h+='<div class="pst-r"><div class="pst-h"><span><b>'+esc(x.n)+'</b><small>'+esc(capFirst(monthLabelOf(x.m)))+(x.ok?' · à payer, compté':'')+'</small></span><em>'+esc(opsAmt(x.a))+'</em></div>'+
          (can?'<div class="pst-b"><button type="button" data-i="'+i+'" data-a="paid">Payé</button><button type="button" data-i="'+i+'" data-a="skip">N\'a pas eu lieu</button><button type="button" data-i="'+i+'" data-a="keep"'+(x.ok?' class="on"':'')+'>À payer</button></div>':'')+'</div>';
      });
      h+='</div><div class="ui-help" style="margin:10px 2px 0">Payé : cochée « fait » ce mois-là (elle sort de la banque). N\'a pas eu lieu : retirée de ce mois. À payer : elle reste comptée dans la fin de mois.</div>';
      h+='<div class="ui-stack" style="margin-top:12px">'+(!ro && L.length>1?'<button type="button" class="btn ghost" id="pstAll">Tout est payé</button>':'')+'<button type="button" class="btn ghost ui-no">Fermer</button></div>';
      var sh=uiSheet(h); sh.q(".ui-no").onclick=sh.close;
      function act(x, a){
        if(a==="keep"){ if(x.k==="f"){ if(!x.o.pastOk) x.o.pastOk={}; x.o.pastOk[x.m]=true; persistFrais(); } else { x.o.pastOk=true; persistVirements(); } return; }
        if(x.k==="f"){ if(x.o.pastOk) delete x.o.pastOk[x.m];
          if(a==="paid"){ if(!x.o.doneMonths) x.o.doneMonths={}; x.o.doneMonths[x.m]=true; provEpSync(x.o, x.m); }
          else { if(!x.o.skipMonths) x.o.skipMonths={}; x.o.skipMonths[x.m]=true; }
          persistFrais(); return; }
        delete x.o.pastOk;
        if(a==="paid"){ x.o.done=true; if(x.o.epargneId){ var dl=-(Number(x.o.montant)||0); applyEp(x.o.epargneId, dl); x.o.epApplied=dl; } persistVirements(); }
        else { var vi=virements.indexOf(x.o); if(vi>=0) virements.splice(vi, 1); persistVirements(); }
      }
      var snap=JSON.stringify({ f:fraisCommuns, v:virements, e:epargne });
      function undoable(msg){ uiUndoToast(msg, "Annuler", function(){ var o=JSON.parse(snap); fraisCommuns=o.f; virements=o.v; epargne=o.e; persistFrais(); persistVirements(); persistEpargne(); render(); }); }
      [].forEach.call(sh.qa(".pst-b button"), function(b){ b.onclick=function(){ var x=L[+b.getAttribute("data-i")], a=b.getAttribute("data-a"); act(x, a); sh.close(); render();
        if(a!=="keep") undoable("« "+x.n+" » de "+monthLabelOf(x.m)+(a==="paid"?" : payé":" : retiré"));
        pastSheet(key, month); }; });
      var all=sh.q("#pstAll"); if(all) all.onclick=function(){ L.forEach(function(x){ if(x.k!=="f" || fyFraisCanEdit(x.o)) act(x, "paid"); }); sh.close(); render(); undoable(L.length+" opérations cochées « payé »"); };
    }
    // Argent liquide du mois (18/11) : le détail (début, retraits, tickets payés en espèces, aujourd'hui) et la correction
    function liqMoves(k, m){
      var L=[];
      virements.forEach(function(v){ var q=v.liqAdd; if(q && q.k===k && q.m===m) L.push({ t:"v", id:v.id, d:virDay(v)||0, n:v.label||"Retrait d'espèces", s:"retrait", a:Number(q.a)||0 }); });
      state.entries.forEach(function(e){ var q=e.liq; if(e.pay==="esp" && q && q.k===k && q.m===m) L.push({ t:"t", id:e.id, d:+String(e.date||"").slice(8, 10)||0, n:e.marchand||"Ticket", s:"ticket", a:-(Number(q.a)||0) }); });
      return L.sort(function(x, y){ return x.d-y.d; });
    }
    function liqEdit(person, month){
      var a=acctByKey(person), own=a ? acctOwner(a) : "", who=(!own || own===mePerson()) ? null : own;
      var ro=fyRO() || (fyMember() && !fyTabEd("compte")), o=liquideMois[person]||{}, cur=liquideAt(person, month), mv=liqMoves(person, month);
      var sum=mv.reduce(function(t, x){ return t+x.a; }, 0), now=cur ? cur.val : 0, start=Math.round((now-sum)*100)/100, past=month<monthKey(todayISO());
      var pv=liquideAt(person, prevMonthKey(month)), ml=monthLabelOf(month);
      var h='<div class="sheet-title">Argent liquide</div><div class="ui-intro">'+esc((who ? "Les espèces de "+who : "Tes espèces")+" en "+ml+". Les retraits et les tickets payés en espèces s'ajoutent tout seuls.")+'</div>';
      if(mv.length){
        h+='<div class="lq-box"><div class="lq-r"><span>Début du mois'+(pv && Math.abs(pv.val-start)<0.005 ? ' <small>· repris '+esc(impDeMois(pv.month))+'</small>' : '')+'</span><span class="v">'+esc(fmtK(start))+'</span></div>'+
          mv.map(function(x, i){ return '<button type="button" class="lq-r lq-mv" data-i="'+i+'"><span>'+esc(x.n)+' <small>· '+esc((x.d ? ("0"+x.d).slice(-2)+"/"+month.slice(5, 7)+" · " : "")+x.s)+'</small></span><span class="v '+(x.a>=0 ? 'p' : 'm')+'">'+esc((x.a>=0 ? "+" : "−")+fmtK(Math.abs(x.a)))+'</span></button>'; }).join("")+
          '<div class="lq-r tot"><span>'+(past ? "Fin du mois" : "Aujourd'hui")+'</span><span class="v">'+esc(fmtK(now))+'</span></div></div>'+
          '<div class="lq-hint">Toucher une ligne ouvre le ticket ou le retrait.</div>';
      } else if(cur) h+='<div class="lq-box"><div class="lq-r tot"><span>'+esc(capFirst(ml))+' <small>· '+esc(cur.month===month ? "noté" : "repris "+impDeMois(cur.month))+'</small></span><span class="v">'+esc(fmtK(now))+'</span></div></div>';
      if(!ro) h+='<label class="f" for="lqV">'+(cur ? "Corriger : ce que tu as vraiment" : "Les espèces que tu as")+'</label><input class="f" id="lqV" inputmode="decimal" placeholder="'+esc(cur ? moneyStr(now) : "0,00")+'">'+
        '<div class="lq-hint">'+(cur ? "Laisse vide pour garder le calcul." : "Les retraits et les tickets payés en espèces s'y ajouteront tout seuls.")+'</div>'+
        ((month in o) && !mv.length && pv ? '<button type="button" class="lq-prev" id="lqPrev">Reprendre la valeur '+esc(impDeMois(pv.month))+' ('+esc(fmtK(pv.val))+')</button>' : '');
      h+='<div class="ui-stack">'+(ro ? '' : '<button type="button" class="btn primary" id="lqOk">OK</button>')+'<button type="button" class="btn ghost ui-no">'+(ro ? "Fermer" : "Annuler")+'</button></div>';
      var s=uiSheet(h);
      s.q(".ui-no").onclick=s.close;
      [].forEach.call(s.qa(".lq-mv"), function(b){ b.onclick=function(){ var x=mv[+b.getAttribute("data-i")]; s.close(); if(x.t==="t") editEntry(x.id); else opsOpen("v", x.id, month, true); }; });
      var pb=s.q("#lqPrev"); if(pb) pb.onclick=function(){ delete liquideMois[person][month]; persistLiquide(); s.close(); render(); uiToast("Valeur "+impDeMois(pv.month)+" reprise"); };
      var ok=s.q("#lqOk"); if(ok) ok.onclick=function(){ var t=String(s.q("#lqV").value||"").trim();
        if(t){ if(!/[0-9]/.test(t)){ uiToast("Montant non compris"); return; } if(!liquideMois[person]) liquideMois[person]={}; liquideMois[person][month]=Math.round(num(t)*100)/100; persistLiquide(); }
        s.close(); render(); };
    }
    function opsOpen(k, id, month, done){
      if(k==="t") return editEntry(id);
      if(fyRO()){ uiToast("En consultation seulement"); return; }
      function edit(){ if(k==="f") editFraisCommun(id, month); else editVirement(id); }
      if(k==="v"){
        var v=virements.filter(function(r){ return String(r.id)===String(id); })[0]; if(!v) return;
        var r=v.rec!=null ? virRecById(v.rec) : null, ml=MOIS_NOMS[+month.slice(5, 7)-1], a=Number(v.montant)||0, d=virDay(v), Lv=[];
        if(done) Lv.push({ l:"↩ Pas encore passé à la banque", fn:function(){ toggleVirementDone(id); uiToast("Remis dans « À venir »"); } });
        if(r){
          Lv.push({ l:"✎ Modifier ce mois-ci seulement", fn:edit });
          Lv.push({ l:"✎ Modifier à partir de ce mois", fn:function(){ virRecEdit(r, v); } });
          Lv.push({ l:"⏸ Retirer seulement en "+ml, fn:function(){ virRemoveOne(v); } });
          Lv.push({ l:"⏹ Arrêter à partir de "+ml, danger:true, fn:function(){ virRecStop(r, month); } });
        } else {
          Lv.push({ l:"✎ Modifier", fn:edit });
          Lv.push({ l:"↻ Reprendre ce virement", fn:function(){ virReprendre(v.person, nextMonthKey(v.month), v); } });
        }
        if(a<0 && !v.epargneId && !v.vers && v.bourseId==null && v.pairOf==null) Lv.push({ l:"📅 Passer en frais fixe", fn:function(){ virToFrais(v); } });   // une dépense (pas un virement vers l'épargne)
        var vs=virSrcOf(v);
        if(!virLinkVal(vs) && v.pairOf==null) Lv.push({ l:"🔗 Relier à un compte", fn:function(){
          uiChoice((a<0 ? "Vers" : "Depuis")+" quel compte ?", "L'argent y arrive (ou en part) aussi, avec un seul rond « fait ». S'il y a déjà la même opération en face, elle est reprise.",
            virLinkOpts(v.person).filter(function(o){ return o.v; }).map(function(o){ return { l:o.l, primary:false, fn:function(){ virLinkSet(v, o.v); virLinkSync(); persistVirements(); render(); uiToast("Relié à « "+virLinkName(o.v)+" »"); } }; })); } });
        if(!r) Lv.push({ l:"🗑 Supprimer", danger:true, fn:function(){ delVirement(id); } });
        uiChoice((v.label||"Virement")+" · "+opsAmt(a), esc(r ? "Chaque mois depuis "+monthLabelOf(r.from)+(r.to?" jusqu'à "+monthLabelOf(r.to):"") : (done ? (d?"passé le "+(d===1?"1er":d)+" "+ml:"passé à la banque") : "à venir"+(d?" · le "+(d===1?"1er":d)+" "+ml:""))),
          Lv.map(function(c){ if(c.primary==null) c.primary=false; return c; }));
        return;
      }
      if(!done) return edit();
      // déjà passé : le remettre dans « À venir » (décocher) ou ouvrir sa fiche
      var x=(k==="f" ? fraisCommuns : virements).filter(function(r){ return String(r.id)===String(id); })[0]; if(!x) return;
      var amt=(k==="f") ? (provInAmt(x, curAcctKey(), month) || -fraisAcctAmt(x, curAcctKey(), month)) : (Number(x.montant)||0), d=(k==="f") ? fraisDay(x, month) : virDay(x);
      uiChoice((k==="f" ? x.label : x.label)||"Opération", esc(opsAmt(amt)+(d?" · passé le "+(d===1?"1er":d)+" "+MOIS_NOMS[+month.slice(5, 7)-1]:" · passé à la banque")), [
        { l:"↩ Pas encore passé à la banque", fn:function(){ if(k==="f") toggleFraisDone(id, month); else toggleVirementDone(id); uiToast("Remis dans « À venir »"); } },
        { l:"✎ Modifier", primary:false, fn:edit }
      ]);
    }
    function renderCompte(){
      var person=curAcctKey(), acct=acctByKey(person), multi=comptes.length>1;
      var curM=monthKey(todayISO());
      var month=(state.months&&state.months.compte)||curM;
      if(multi && state.view==="compte" && (state.compteSel||store.read("compteSel", null))==="__all"){ var _p=month.split("-"); return renderComptesAll(month, curM, new Date(+_p[0], +_p[1]-1, 1).toLocaleDateString("fr-FR",{month:"long",year:"numeric"})); }
      var _mp=month.split("-");
      var monthLabel=new Date(+_mp[0], +_mp[1]-1, 1).toLocaleDateString("fr-FR",{month:"long",year:"numeric"});
      var fl=soldeFlow(person, month);
      var reporte=fl.opening;
      var virs=virementsOf(person,month);
      var virTotal=virementsSum(person,month);
      var aStart=acctStart(person), preStart=!!(aStart && month<aStart);   // mois avant le début du suivi du compte
      var monthEntries=preStart ? [] : state.entries.filter(function(e){ return monthKey(e.date)===month; });
      if(preStart) virs=[], virTotal=0;

      var paid=[], paidTotal=0;
      monthEntries.forEach(function(e){ if(tkBank(e, person)){ paid.push(e); paidTotal+=Number(e.montant)||0; } });
      paid.sort(function(a,b){ return String(b.date||"").localeCompare(String(a.date||"")); });

      var fraisThis=preStart ? [] : fraisCommuns.filter(function(f){ return fraisActif(f, month) && fraisKind(f, person) && fraisAcctAmt(f, person, month)>0.004; });
      var fraisPerso=0, fraisCommun=0;
      fraisThis.forEach(function(f){ var m=fraisAcctAmt(f, person, month); if(fraisKind(f, person)==="perso") fraisPerso+=m; else fraisCommun+=m; });
      var fraisTotal=fraisPerso + fraisCommun;

      var prodOwed=0;
      monthEntries.forEach(function(e){ if(ticketInAcct(e, person)) return; (e.articles||[]).forEach(function(a){ if(a.commun) prodOwed+=Number(a.prix)||0; }); });
      var prodPart=prodOwed/2;

      var depenses=paidTotal + fraisTotal;
      var liq=liquideAt(person, month), liqAll=liq?liq.val:0, liqTk=tkLiqSum(person, month);
      // bouton « Liquide » (Ce mois, Solde) : compter ou non l'argent liquide
      var liqOn=liqCounted();
      var liqV=liqOn?liqAll:0, liqHas=!!liq || liquideMois && liquideMois[person] && Object.keys(liquideMois[person]).length>0;
      function liqAt(m){ if(!liqOn) return 0; var l=liquideAt(person,m); return l?l.val:0; }
      var soldeFin=fl.closing + liqV;
      var virDone=virs.reduce(function(t,v){ return t+(v.done?(Number(v.montant)||0):0); },0)+provInSum(person, month, true);   // + les mises de côté reçues (provisions sur ce compte)
      var fraisDoneFull=0;
      fraisThis.forEach(function(f){ if(fraisDone(f, month)) fraisDoneFull+=fraisAcctAmt(f, person, month); });
      var reporteReel=soldeFlowDone(person, month).opening;
      var soldeBanque=reporteReel + virDone - paidTotal - fraisDoneFull, futur=(month>curM);
      if(futur) soldeBanque=fl.closing;   // mois à venir : solde prévu en fin de mois

      var cptOpen = state.cptOpen || (state.cptOpen={});
      var virIn=0, virOut=0; virs.forEach(function(v){ var x=Number(v.montant)||0; if(x>=0) virIn+=x; else virOut+=x; });
      var CMODES=[["mois","Ce mois"],["solde","Solde"],["es","Entrées / sorties"]];   // Évolution du compte (22/11 : « Dépenses » → Budget › Analyse) ; Épargne : sous-onglet Épargne ; Provisions : À venir › Provisions
      // Répartition des dépenses du mois (catégories de tickets + frais fixes), de la plus grosse à la plus petite
      var dParts=[], byCat={};
      paid.forEach(function(e){ var c=(e.categorie||"Autre"); byCat[c]=(byCat[c]||0)+(Number(e.montant)||0); });
      Object.keys(byCat).sort(function(x,y){ return byCat[y]-byCat[x]; }).forEach(function(c){ dParts.push({ l:c, v:byCat[c] }); });
      if(dParts.length>4){ var rest=dParts.slice(3).reduce(function(t,x){ return t+x.v; },0); dParts=dParts.slice(0,3).concat([{ l:"Autres tickets", v:rest }]); }
      if(fraisPerso>0) dParts.push({ l:"Frais fixes perso", v:fraisPerso });
      if(fraisCommun>0) dParts.push({ l:"Frais fixes communs", v:fraisCommun });
      dParts.forEach(function(x){ x.k="dep"; });   // une part touchée → page Dépenses
      var DCOL=["#7c9cf4","#e0a458","#4fd6a0","#c78bd6","#5bc0d4","#e88fb0","#9bd35e","#f4796b"];
      dParts.sort(function(x,y){ return y.v-x.v; }).forEach(function(x,i){ x.col=DCOL[i%DCOL.length]; });
      var cmode=state.cptChart||store.read("cptChartDef","mois"); if(cmode==="6m") cmode="es";
      if(!CMODES.some(function(x){ return x[0]===cmode; })) cmode="mois";
      // sous-onglet : Opérations (null) · Virements (es) · Épargne (ep) · Graphiques (graph) ; les anciennes pages y mènent
      var page=state.cptPage||null;
      if(page==="dep"){ state.cptF="out"; page=null; } else if(page && ["ep","graph"].indexOf(page)<0) page=null;   // ancienne page Virements (es) → Opérations
      state.cptPage=page; if(state.view==="comptedet") state.view="compte";
      var graphV=(page==="graph");
      var gearOn=!!acct && person!=="__tickets" && (!fyRO() || impCan());
      var h=header(false, "Opérations").replace('</header>', gearOn?'<button type="button" class="hgear" id="cptGear" aria-label="Réglages du compte"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"></path></svg></button></header>':'</header>');   // le mois est dans la ligne du compte (acctRowHTML)
      // 6 derniers mois (jusqu'au mois affiché)
      var six=[], mk6=month; for(var i6=0;i6<6;i6++){ six.unshift(mk6); mk6=prevMonthKey(mk6); }
      function mShort(m){ var pm=m.split("-"); return new Date(+pm[0], +pm[1]-1, 1).toLocaleDateString("fr-FR",{month:"short"}).replace(".",""); }
      function epTotAt(m){ var t=0; epargne.forEach(function(c){ var ms=Object.keys(c.vals||{}).filter(function(mm){ return mm<=m; }).sort(); if(ms.length) t+=Number(c.vals[ms[ms.length-1]])||0; }); return t; }
      function provAt(m){ try{ return provTotalAt(m); }catch(e){ return 0; } }
      var crange=state.cptRange||store.read("cptRange","6"); if(["6","12","all"].indexOf(crange)<0) crange="6";
      function cRangeMonths(first){
        var n=crange==="12"?12:(crange==="all"?36:6), a=[], m=month;
        for(var i=0;i<n;i++){ a.unshift(m); m=prevMonthKey(m); if(crange==="all" && m<first) break; }
        if(a.length<2) a.unshift(prevMonthKey(a[0]));
        return a;
      }
      function cRangeNote(ms){ return crange==="6"?"sur 6 mois":(crange==="12"?"sur 12 mois":"depuis "+monthLabelOf(ms[0])); }
      // 6 mois / 12 mois / Tout : petit bouton en haut à droite de la carte (il tient toujours dans l'écran) ; chaque appui passe au suivant
      var cRangeUsed=false;
      function cRangeSeg(){ cRangeUsed=true; return ''; }
      function cRangeBtn(){   // 6 mois · 12 mois · Tout en pastilles (19/11)
        return '<span class="crange-g" role="group" aria-label="Période">'+[["6","6 mois"],["12","12 mois"],["all","Tout"]].map(function(x){ return '<button type="button" class="anfx crange-c'+(x[0]===crange?' on':'')+'" data-r="'+x[0]+'" aria-pressed="'+(x[0]===crange)+'">'+x[1]+'</button>'; }).join("")+'</span>'; }
      function inOut(m){ var inn=provInSum(person, m, false), out=computeDepensesMonth(person,m); virementsOf(person,m).forEach(function(v){ var x=Number(v.montant)||0; if(x>=0) inn+=x; else out+=-x; }); return { inn:inn, out:out }; }
      var chart=chartTabsHTML(CMODES, cmode, "cptChartDef", "mois").replace('class="cch-tabs"','class="cch-tabs cch-tabs4 cch-tabs3"')+'<div class="cch">';

      var pvCpt=provSumWhere(month, function(w, p){ return (acct.main && w==="cpt") || w==="cpt:"+acct.key; });
      var hero={ label:(multi?esc(acct.nom):"Solde du compte")+(futur?" · fin "+esc(monthLabelOf(month))+" prévue":" (banque estimée)"), big:soldeBanque, color:(soldeBanque<0?"var(--coral)":"var(--ink)"), sub:(futur?"Prévu, tout ce qui est planifié compris, sans le liquide":"Estimé, sans le liquide")+(pvCpt>0.004?" · dont provisions "+fmtK(pvCpt)+", disponible "+fmtK(soldeBanque-pvCpt):"") };
      if(cmode==="mois"){
        var steps=[{l:"Report", v:reporte, t:"base", k:"report"}];
        if(virIn) steps.push({l:"Reçu", v:virIn, k:"in"});
        if(virOut) steps.push({l:"Envoyé", v:virOut, k:"out"});
        if(paidTotal) steps.push({l:"Tickets", v:-paidTotal, k:"dep"});
        if(fraisTotal) steps.push({l:"Frais fixes", v:-fraisTotal, k:"dep"});
        if(liqV) steps.push({l:"Liquide", v:liqV, k:"res"});
        steps.push({l:"Solde", v:soldeFin, t:"end", k:"res"});
        var gain=soldeFin-reporte;
        hero={ label:esc(capFirst(monthLabelOf(month).split(" ")[0]))+(multi?" · "+esc(acct.nom):"")+(futur?" · prévu":""), big:gain, color:(gain<0?"var(--coral)":"var(--accent)"), sub:(gain<0?"perdu":"gagné")+(futur?" (prévu)":"")+" · début "+fmtK(reporte)+" · fin "+fmtK(soldeFin) };
        chart+=compteWaterfallSVG(steps)+'<div class="cch-note">Touche une barre pour son détail</div>';
      } else if(cmode==="solde"){
        var sFirst=month; virements.forEach(function(v){ if(v.person===person && v.month && v.month<sFirst) sFirst=v.month; }); state.entries.forEach(function(e){ var k=monthKey(e.date); if(k && k<sFirst && ticketInAcct(e, person)) sFirst=k; });
        var sMs=cRangeMonths(sFirst);
        hero={ label:"Solde de fin de mois", big:soldeFin, color:(soldeFin<0?"var(--coral)":"var(--ink)"), sub:(liq&&liqOn?"Banque "+fmtK(fl.closing)+" · Liquide "+fmtK(liqV):(liqHas&&!liqOn?"Banque seule, sans le liquide":"")) };
        chart+=compteBarsSVG(sMs.map(function(m){ return { m:m, lbl:mShort(m), v:soldeFlow(person,m).closing+liqAt(m) }; }), month)+'<div class="cch-note">Ce qui reste en fin de mois ('+(liqOn?'banque + liquide':'banque seule')+'), '+cRangeNote(sMs)+'</div>'+cRangeSeg();
      } else if(cmode==="es"){
        var rows=six.map(function(m){ var x=inOut(m); return { m:m, lbl:mShort(m), inn:x.inn, out:x.out }; }), cur=rows[rows.length-1], net=cur.inn-cur.out;
        hero={ label:"Entrées − sorties du mois", big:net, color:(net<0?"var(--coral)":"var(--accent)"), sub:"Entrées "+fmtK(cur.inn)+" · Sorties "+fmtK(cur.out) };
        chart+=compteSixMonthsSVG(rows, month)+'<div class="cch-leg"><span><i style="background:var(--accent)"></i>Entrées · virements reçus</span><span><i style="background:var(--coral)"></i>Sorties · dépenses</span></div>';
      } else if(cmode==="ep"){
        var eFirst=month; epargne.forEach(function(c){ Object.keys(c.vals||{}).forEach(function(k){ if(k<eFirst) eFirst=k; }); });
        var hasB=epargne.some(function(c){ return c.bourseLink; });
        var epRows=cRangeMonths(eFirst).map(function(m){ return { m:m, lbl:mShort(m), v:epTotAt(m), v2:(hasB?bourseEpAt(m):null) }; }), e0=epRows[epRows.length-2].v, e1=epRows[epRows.length-1].v;
        hero={ label:"Épargne totale", big:e1, color:"var(--ink)", sub:(epRows.length>1?(e1-e0>=0?"+":"")+fmtK(e1-e0)+" vs mois précédent":"")+(hasB?(epRows.length>1?" · ":"")+"dont Bourse "+fmtS(epRows[epRows.length-1].v2):"") };
        chart+=compteLineSVG(epRows, month, "#7c9cf4")+'<div class="cch-note">Total de tes comptes épargne'+(hasB?' (pointillés : dont Bourse)':'')+', '+cRangeNote(epRows.map(function(r){ return r.m; }))+'</div>'+cRangeSeg();
      } else {
        var pRows=six.map(function(m){ return { m:m, lbl:mShort(m), v:provAt(m) }; }), p0=pRows[pRows.length-2].v, p1=pRows[pRows.length-1].v;
        hero={ label:"Total provisions", big:p1, color:"var(--ink)", sub:(p1-p0>=0?"+":"")+fmtK(p1-p0)+" vs mois précédent" };
        chart+=compteBarsSVG(pRows, month, "#c78bd6")+'<div class="cch-note">Total provisions, sur 6 mois</div>';
      }
      chart+='</div>';
      var liqBtn=(liqHas && (cmode==="mois" || cmode==="solde")) ? '<button type="button" class="anfx'+(liqOn?' on':'')+'" id="cptLiqBtn" aria-pressed="'+liqOn+'">'+(liqOn?'✓':'＋')+' Liquide</button>' : '';
      if(cRangeUsed || liqBtn) chart='<div class="cnr">'+liqBtn+(cRangeUsed?cRangeBtn().replace('anfx anfx-corner','anfx'):'')+'</div>'+chart;
      if(preStart && cmode!=="ep" && cmode!=="prov") hero.sub="Compte suivi à partir de "+esc(monthLabelOf(aStart))+" : rien avant";
      // la phrase à retenir, au-dessus du graphique (19/11)
      var gSum=cptGraphSums(person, month, liqOn);
      if(graphV && !preStart && gSum[cmode]) chart=chart.replace('<div class="cch">', '<div class="cpg-take">'+gSum[cmode]+'</div><div class="cch">');
      hero.extra=chart;
      // Petites cases sous le graphique (comme Provisions)
      var vTodo=virs.filter(function(v){ return !v.done; }), vTodoSum=vTodo.reduce(function(t,v){ return t+(Number(v.montant)||0); },0);
      hero.stats=[
        { l:"Report", v:fmtS(reporte), d:"du mois dernier", go:"es" },
        { l:"Fin de mois", v:fmtS(soldeFin), c:(soldeFin<0?"var(--coral)":""), d:"prévu", go:"res" },
        vTodo.length ? { l:"À faire", v:signS(vTodoSum), d:vTodo.length+" virement"+(vTodo.length>1?"s":""), go:"av" } : { l:"À faire", v:"Rien", d:"virements faits", go:"es" }
      ];
      // les trois encadrés reprennent le graphique affiché
      try{
        var pmK=prevMonthKey(month), red=function(v){ return v<0?"var(--coral)":""; };
        if(cmode==="dep"){ var dPrev=computeDepensesMonth(person, pmK), dd=depenses-dPrev;
          hero.stats=[ { l:"Tickets", v:fmtS(paidTotal) }, { l:"Frais fixes", v:fmtS(fraisTotal) }, { l:"vs "+monthLabelOf(pmK).split(" ")[0], v:(dd>0?"+":(dd<0?"−":""))+fmtS(Math.abs(dd)), c:(dd>0.004?"var(--coral)":(dd<-0.004?"var(--accent)":"")) } ]; }
        else if(cmode==="solde"){ var sPrev=soldeFlow(person,pmK).closing+liqAt(pmK), ds=soldeFin-sPrev, sV=sMs.map(function(m){ return soldeFlow(person,m).closing+liqAt(m); }), sMin=Math.min.apply(null,sV), sAvg=sV.reduce(function(t,x){ return t+x; },0)/sV.length;
          hero.stats=[ { l:"vs fin "+monthLabelOf(pmK).split(" ")[0], v:(ds>0?"+":(ds<0?"−":""))+fmtS(Math.abs(ds)), c:(ds<-0.004?"var(--coral)":(ds>0.004?"var(--accent)":"")) }, { l:"Plus bas", v:fmtS(sMin), c:red(sMin) }, { l:"Moyenne", v:fmtS(sAvg), c:red(sAvg) } ]; }
        else if(cmode==="es"){ var nets=rows.map(function(r){ return r.inn-r.out; }), nAvg=nets.reduce(function(t,x){ return t+x; },0)/Math.max(1,nets.length);
          hero.stats=[ { l:"Entrées", v:fmtS(cur.inn), c:"var(--accent)" }, { l:"Sorties", v:fmtS(cur.out), c:"var(--coral)" }, { l:"Moyenne / mois", v:(nAvg>=0?"+":"−")+fmtS(Math.abs(nAvg)), c:(nAvg<0?"var(--coral)":"var(--accent)") } ]; }
        else if(cmode==="ep"){ var epP=provSumWhere(month, function(w){ return w.indexOf("ep:")===0; }), eGain=e1-epRows[0].v;
          hero.stats=[ { l:"Sur la période", v:(eGain>=0?"+":"−")+fmtS(Math.abs(eGain)), c:(eGain<0?"var(--coral)":"var(--accent)") }, { l:"Dont provisions", v:fmtS(epP) }, { l:"Disponible", v:fmtS(e1-epP) } ]; }
        else if(cmode==="prov"){ var pMens=0, pNext=null; provisions.forEach(function(p){ if((p.skips||[]).indexOf(month)<0) pMens+=mensuelAt(p, month); var ec=provEcheance(p, month); if(ec && (!pNext || ec.due<pNext.due)) pNext={ due:ec.due, nom:p.nom }; });
          hero.stats=[ { l:"Enveloppes", v:String(provisions.length) }, { l:"Ce mois-ci", v:"+"+fmtS(pMens) }, { l:"Échéance", v:(pNext?esc(pNext.nom):"—"), d:(pNext?esc(monthLabelOf(pNext.due)):""), keep:1 } ]; }
      }catch(e){ try{ console.warn(e); }catch(_){} }
      var heroMain=hero;
      // Corps : une seule carte, une ligne par catégorie qui se déplie au toucher
      var C_T="#e0a458", C_P="#c78bd6", C_C="#7c9cf4";
      function nb(n, one, many){ return n+" "+(n>1?many:one); }
      function sec(key, dot, title, val, valCol, sub){
        var ic={ es:"🔁", dep:"🧾", ep:"🐷", res:"🏦" }[key]||"";
        return '<div class="cacc-sec"><div class="cacc-h cptGo" data-page="'+key+'"><span class="t">'+(ic?'<span class="tic">'+ic+'</span> ':'')+title+(sub?'<small>'+sub+'</small>':'')+'</span><span class="v" style="color:'+(valCol||"var(--ink)")+'">'+val+'</span><span class="ch">›</span></div></div>';
      }
      var acc='<section class="paper cacc">';

      // ---- Entrées ----
      var bIn='<div class="leader" id="reporterow" style="cursor:pointer"><span class="lbl">Solde reporté ✎</span><span class="fill"></span><span class="val">'+fmt(reporte)+'</span></div>';
      bIn+='<div class="muted note">'+(getSoldeInit(person,month)!==null?"valeur modifiée manuellement":"repris du mois précédent")+'</div>';
      virs.forEach(function(v){
        bIn+='<div class="prow vrow"><button class="virdone vchk'+(v.done?' on':'')+'" type="button" data-id="'+esc(v.id)+'" aria-label="'+(v.done?"Fait":"Pas encore fait")+'">'+(v.done?'✓':'')+'</button>'+
             '<span class="pname"><span>'+esc(v.label)+'</span>'+(v.note?'<small>'+esc(v.note)+'</small>':'')+(v.epargneId?'<span class="lk">↔ '+esc(epNameOf(v.epargneId))+'</span>':'')+'</span>'+
             '<span class="va" style="color:'+(Number(v.montant)<0?"var(--coral)":"var(--ink)")+'">'+(Number(v.montant)>0?"+":"")+fmtK(v.montant)+'</span>'+
             '<button class="btn ghost viredit" type="button" data-id="'+esc(v.id)+'">✎</button>'+
             '<button class="btn ghost virdel" type="button" data-id="'+esc(v.id)+'">✕</button></div>';
      });
      if(!virs.length) bIn+='<div class="muted" style="font-size:11px;margin:4px 0">Aucun virement ce mois-ci.</div>';
      bIn+='<div class="clink" id="addvir"><span>+ Ajouter un virement</span><span></span></div>';
      var accEs; acc+=(accEs=sec("es", "var(--accent)", "Virements", signS(virTotal), (virTotal<0?"var(--coral)":"var(--accent)"), nb(virs.length, "virement", "virements")));

      // ---- Dépenses ----
      var bOut='';
      // Dépenses : deux groupes repliables (tickets, frais fixes) avec leur total, puis le total général
      var dOpen=state.depOpen||{};
      function dGrp(key, title, n, total, sub, body){
        return '<div class="dgrp'+(dOpen[key]?' open':'')+'" data-g="'+key+'"><div class="dgh"><span class="t">'+title+(n?'<small>'+n+'</small>':'')+'</span><span class="v">'+fmtK(total)+'</span><span class="chev">›</span></div>'+
          (sub?'<div class="dgs">'+sub+'</div>':'')+'<div class="dgb">'+body+'</div></div>';
      }
      var tB='';
      if(!paid.length) tB='<div class="muted" style="font-size:11px;margin:4px 2px">Aucun ticket « payé par '+esc(person)+' » ce mois-ci.</div>';
      else {
        var byShop=state.depByShop;
        tB+='<div class="dmode"><button type="button" data-v="0"'+(byShop?'':' class="on"')+'>Par date</button><button type="button" data-v="1"'+(byShop?' class="on"':'')+'>Par magasin</button></div>';
        if(!byShop) paid.forEach(function(e){ var dd=(e.date||"").split("-"); tB+='<div class="entry ecomp" data-id="'+esc(e.id)+'"><span class="n">'+esc(e.marchand)+'</span><span class="d">'+esc(dd.length===3?dd[2]+"/"+dd[1]:"")+'</span><span class="a">'+fmtK(e.montant)+'</span></div>'; });
        else {
          var shops={}, order=[];
          paid.forEach(function(e){ var k=String(e.marchand||"?").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").trim(); if(!shops[k]){ shops[k]={ n:0, t:0, names:{} }; order.push(k); } shops[k].n++; shops[k].t+=Number(e.montant)||0; shops[k].names[e.marchand]=(shops[k].names[e.marchand]||0)+1; });
          order.sort(function(x,y){ return shops[y].t-shops[x].t; }).forEach(function(k){ var sh=shops[k], nm=Object.keys(sh.names).sort(function(x,y){ return sh.names[y]-sh.names[x]; })[0];
            tB+='<div class="dfrow"><span class="n">'+esc(nm)+'</span><span class="k">'+(sh.n>1?sh.n+' tickets':'1 ticket')+'</span><span class="a">'+fmtK(sh.t)+'</span></div>'; });
        }
      }
      bOut+=dGrp("t", "Tickets payés", paid.length, paidTotal, '', tB);
      var fB='';
      ["commun","perso"].forEach(function(kd){
        var L=fraisThis.filter(function(f){ return fraisKind(f, person)===kd; }).sort(function(x,y){ return fraisAcctAmt(y,person,month)-fraisAcctAmt(x,person,month); });
        if(!L.length) return;
        fB+='<div class="dsub"><span>'+(kd==="commun"?"Communs":"Perso")+'</span><span>'+fmtK(kd==="commun"?fraisCommun:fraisPerso)+'</span></div>';
        L.forEach(function(f){ var ow=acctOwner(acctByKey(person)||{}); fB+='<div class="dfrow"><span class="n">'+esc(f.label)+(f.split?'<small>part de '+esc(ow===mePerson()?"toi":ow)+' · '+pctTxt(fraisPct(f, ow, month))+' de '+fmtK(fraisMontant(f, month))+'</small>':'')+'</span><span class="a">'+fmtK(fraisAcctAmt(f, person, month))+'</span></div>'; });
      });
      if(!fraisThis.length) fB='<div class="muted" style="font-size:11px;margin:4px 2px">Aucun frais fixe ce mois-ci.</div>';
      bOut+=dGrp("f", "Frais fixes", fraisThis.length, fraisTotal, (fraisPerso&&fraisCommun?'Communs '+fmtK(fraisCommun)+' · Perso '+fmtK(fraisPerso):''), fB);
      bOut+='<div class="dtot"><span>Total</span><span class="v">'+fmtK(depenses)+'</span></div>';
      var accDep; acc+=(accDep=sec("dep", "var(--coral)", "Dépenses", "−"+fmtS(depenses), "var(--coral)", nb(paid.length, "ticket", "tickets")+" · "+nb(fraisThis.length, "frais fixe", "frais fixes")));

      // ---- Résultat ----
      var bRes='<div class="leader"><span class="lbl">Solde de fin de mois</span><span class="fill"></span><span class="val" style="font-weight:700;color:'+(soldeFin<0?"var(--coral)":"var(--accent)")+'">'+fmt(soldeFin)+'</span></div>';
      bRes+='<div class="muted note">'+(liq&&liqOn?'dont '+fmt(liqV)+' en liquide · la partie banque ('+fmt(fl.closing)+') se reporte au mois suivant':(liq?'sans le liquide · ':'')+'se reporte automatiquement au mois suivant')+'</div>';
      bRes+='<div class="leader" id="liqrow" style="cursor:pointer"><span class="lbl">💶 Argent liquide ✎</span><span class="fill"></span><span class="val"'+(liq&&!liqOn?' style="color:var(--muted)"':'')+'>'+(liq?fmt(liqAll):"—")+'</span></div>';
      bRes+='<div class="muted note">'+(!liq?"touche pour indiquer tes espèces du mois":(liq.month===month?"saisi pour ce mois":"repris de "+esc(monthLabelOf(liq.month)))+(liqTk>0.004?" · dont −"+esc(fmtK(liqTk))+" de tickets en espèces":"")+(liqOn?"":" · non compté (bouton Liquide décoché)"))+'</div>';
      bRes+='<div class="leader"><span class="lbl">Solde bancaire estimé</span><span class="fill"></span><span class="val" style="color:'+(soldeBanque<0?"var(--coral)":"var(--accent)")+'">'+fmt(soldeBanque)+'</span></div>';
      bRes+='<div class="muted note">sans le liquide · reporté + virements faits − tickets − frais faits</div>';
      var accRes=sec("res", "#e6b450", "Solde bancaire estimé", fmtS(soldeBanque), (soldeBanque<0?"var(--coral)":"var(--ink)"));

      // ---- Épargne ----
      var epAllM={}; epargne.forEach(function(c){ Object.keys(c.vals||{}).forEach(function(m){ epAllM[m]=true; }); });
      var epMs=Object.keys(epAllM).sort();
      function epTotalAt(month){ var t=0; epargne.forEach(function(c){ var ms=Object.keys(c.vals||{}).filter(function(mm){ return mm<=month; }).sort(); if(ms.length) t+=Number(c.vals[ms[ms.length-1]])||0; }); return t; }
      var totCur=epTotalAt(month), totPrev=epMs.length?epTotalAt(prevMonthKey(month)):null;
      var bEp='', epG=byOwner(epargne);
      epG.forEach(function(g){
        if(epG.length>1){ var gs=0; g.items.forEach(function(c){ gs+=epAt(c, month); }); bEp+='<div class="dsub"><span>'+esc(g.label)+'</span><span>'+fmtK(gs)+'</span></div>'; }
        g.items.forEach(function(c){
        var cur=epAt(c, month), prev=epPrevAt(c, month), pm=pctStr(prev,cur);
        if(c.bourseLink){   // la Bourse : automatique, elle suit l'onglet Bourse
          bEp+='<div class="prow epbourse"'+(FEAT.bourse?' role="button" tabindex="0" style="cursor:pointer"':'')+'><span class="pname" style="display:flex;flex-direction:column;min-width:0;gap:1px"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(c.nom)+' <span class="ep-auto">automatique</span></span>'+
             '<span style="font-size:10px;font-weight:500;color:var(--ink-soft)">suit l\'onglet Bourse'+(pm?' · <span style="color:'+pctColor(prev,cur)+'">'+pm+' vs mois préc.</span>':'')+'</span></span>'+
             '<span style="font-variant-numeric:tabular-nums;font-weight:700;flex:0 0 auto;margin-right:2px">'+fmtK(cur)+'</span>'+(FEAT.bourse?'<span class="ep-go" aria-hidden="true">›</span>':'')+'</div>';
          return;
        }
        bEp+='<div class="prow"><span class="pname" style="display:flex;flex-direction:column;min-width:0;gap:1px"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(c.nom)+(c.bourseLink?' <span style="font-size:9px;color:var(--accent);font-weight:600">● Bourse</span>':'')+'</span>'+(pm?'<span style="font-size:10px;font-weight:500;color:'+pctColor(prev,cur)+'">'+pm+' vs mois préc.</span>':'')+'</span>'+
           '<span style="font-variant-numeric:tabular-nums;font-weight:700;flex:0 0 auto;margin-right:2px">'+fmtK(cur)+'</span>'+
           '<button class="btn ghost epedit" type="button" data-id="'+esc(c.id)+'">✎</button>'+
           '<button class="btn ghost epdel" type="button" data-id="'+esc(c.id)+'">✕</button></div>';
        var cPv=provSumWhere(month, function(w){ return w==="ep:"+c.id; });
        if(cPv>0.004) bEp+='<div class="muted" style="font-size:10.5px;margin:-2px 0 6px 2px">dont provisions '+fmtK(cPv)+' · <b style="color:var(--ink)">disponible '+fmtK(cur-cPv)+'</b></div>';
        if(c.objectif && c.objectif.montant>0){
          var oT=c.objectif.montant, oP=Math.min(100, Math.round(cur/oT*100));
          bEp+='<div class="obj"><div class="ob-bar"><i style="width:'+oP+'%"></i></div><div class="ob-t">'+(cur>=oT?'✓ Objectif de '+fmt(oT)+' atteint':'🎯 '+oP+' % de '+fmt(oT)+' · reste '+fmt(oT-cur)+(c.objectif.mois?(monthsBetween(month, c.objectif.mois)>0?' · ≈ '+fmt((oT-cur)/monthsBetween(month, c.objectif.mois))+' / mois':' · échéance dépassée'):''))+'</div></div>';
        }
      }); });
      if(!epargne.length) bEp+='<div class="muted" style="font-size:11px;margin:4px 0">Aucun compte épargne.</div>';
      var tpm=pctStr(totPrev,totCur); if(tpm && epargne.length>1) bEp+='<div class="muted" style="font-size:10.5px;margin:2px 0"><span style="color:'+pctColor(totPrev,totCur)+'">Total '+tpm+' vs mois préc.</span></div>';
      bEp+='<div class="clink" id="addep"><span>+ Ajouter un compte épargne</span><span></span></div>';
      var accEp=true ? sec("ep", "#7c9cf4", "Épargne", fmtS(totCur), "var(--ink)", nb(epargne.length, "compte épargne", "comptes épargne")) : "";

      // ---- Provisions (ouvre l'écran dédié) ----
      var provT=0; try{ provT=provTotalAt(month); }catch(e){}
      // Groupes : 1. Virements + Dépenses · 2. Provisions + Épargne (compte principal) · 3. Solde bancaire estimé
      acc+='</section>';
      var accProv=true ? '<div class="cacc-sec"><div class="cacc-h" id="goprov"><span class="t"><span class="tic">📦</span> Provisions<small>'+provisions.length+' enveloppe'+(provisions.length>1?'s':'')+'</small></span><span class="v">'+fmtS(provT)+'</span><span class="ch">›</span></div></div>' : '';
      acc+='<section class="paper cacc">'+accProv+accEp+'</section>';   // épargne et provisions accessibles depuis chaque compte
      acc+='<section class="paper cacc">'+accRes+'</section>';
      var O=null, cx=null;
      h+=cptSubsHTML(page)+(page==="ep" ? '<div class="acrow ep2-nav">'+homeMonthNav(month, curM, new Date(+_mp[0], +_mp[1]-1, 1).toLocaleDateString("fr-FR",{month:"long", year:"numeric"})).replace(/id="mn-/g,'id="cm-')+'</div>' : acctRowHTML(person, month, curM));
      if(!page){
        // le haut : solde estimé, entrées / sorties passées, fin de mois prévue ; Graphiques et Configuration
        O=cptOps(person, month);
        var inT=0, outT=0; (futur ? O.todo : O.done).forEach(function(o){ if(o.a>0) inT+=o.a; else outT+=o.a; });
        cx={ key:person, month:month, futur:futur, past:(month<curM), report:reporteReel, ro:fyRO(), prevName:impDeMois(prevMonthKey(month)), edited:(getSoldeInit(person, month)!==null) };
        var cf=state.cptF||"tout", lSub=preStart ? "Compte suivi à partir de "+esc(monthLabelOf(aStart))+" : rien avant" : (futur?"Prévu, tout ce qui est planifié compris, sans le liquide":"Estimé, sans le liquide")+(pvCpt>0.004?" · dont provisions "+fmtK(pvCpt)+", disponible "+fmtK(soldeBanque-pvCpt):"");
        h+='<section class="dash-hero ops-sum"><div class="dash-cap">'+(futur?"Solde prévu fin "+esc(monthLabelOf(month)):"Solde estimé à la banque")+'</div>'+
           '<div class="dash-big" style="margin-top:6px;color:'+(soldeBanque<0?"var(--coral)":"var(--ink)")+'">'+moneyBig(soldeBanque)+'</div>'+
           '<div class="ops-subrow"><span class="dash-cap">'+lSub+'</span>'+((person!=="__tickets" && (liq || (affDet() && !fyRO()))) ? '<button type="button" id="opsLiq" class="ops-liq'+(liq&&!liqOn?' off':'')+'">💶 '+(liq ? 'Liquide '+esc(fmtK(liqAll))+(liqOn?'':' · non compté') : '＋ Liquide')+'</button>' : '')+'</div>'+
           '<div class="hstats"><button type="button" class="hstat" data-f="in"><span>'+(futur?"Entrées prévues":"Entrées")+'</span><b style="color:var(--accent)">'+opsAmtS(inT, true)+'</b></button>'+
           '<button type="button" class="hstat" data-f="out"><span>'+(futur?"Sorties prévues":"Sorties")+'</span><b>'+opsAmtS(outT)+'</b></button>'+
           '<button type="button" class="hstat" data-f="av"><span>Fin de mois</span><b'+(soldeFin<0?' style="color:var(--coral)"':'')+'>'+opsAmtS(soldeFin)+'</b></button></div></section>';
        var chips=[["tout","Tout"],["in","Entrées"],["out","Sorties"],["av","À venir"+(O.todo.length?" · "+O.todo.length:"")]];
        if(affDet()) chips=chips.concat([["tk","Tickets"],["fx","Frais fixes"],["vr","Virements"]]);   // détaillé : filtres par sorte d'opération
        else if(["tk","fx","vr"].indexOf(cf)>=0){ cf="tout"; state.cptF="tout"; }
        var qOpen=!!(state.cptQOpen || state.cptQ || affDet());   // recherche repliée derrière la loupe (refonte) ; « + » de la barre pour ajouter
        h+='<div class="ops-frow"><div class="ops-f" role="group" aria-label="Filtrer les opérations">'+chips.map(function(c){ return '<button type="button" data-f="'+c[0]+'"'+(cf===c[0]?' class="on"':'')+' aria-pressed="'+(cf===c[0])+'">'+c[1]+'</button>'; }).join("")+'</div>'+
           '<button type="button" id="opsQBtn" class="ops-qb'+(qOpen?' on':'')+'" aria-label="Rechercher une opération">'+opsIco("q")+'</button></div>'+
           (qOpen?'<div class="ops-qrow"><label class="ops-q">'+opsIco("q")+'<input id="opsQ" type="search" enterkeyhint="search" autocomplete="off" aria-label="Rechercher une opération" placeholder="Nom ou montant" value="'+esc(state.cptQ||"")+'"></label></div>':'')+
           '<div id="opsBody">'+(preStart ? '<div class="ops-empty">Compte suivi à partir de '+esc(monthLabelOf(aStart))+' : rien avant.</div>' : opsBodyHTML(O, cx))+'</div>';
      }
      else if(graphV){
        var bub={ es:accEs, ep:(accEp||''), prov:(accProv||'') }[cmode];
        h+=tabHero(heroMain)+(bub?'<section class="paper cacc">'+bub+'</section>':'');
        if(!preStart) h+='<section class="paper cpg-oth"><b class="cpg-oh">Les autres en résumé</b>'+CMODES.filter(function(x){ return x[0]!==cmode; }).map(function(x){ return '<button type="button" class="cpg-or" data-m="'+x[0]+'"><span><b>'+esc(x[1])+'</b><small>'+(gSum[x[0]+"1"]||"")+'</small></span><span class="ch">›</span></button>'; }).join("")+'</section>';
        // les dépenses par catégorie sont dans Budget › Analyse (22/11)
        if(!preStart && depSubs().some(function(x){ return x[0]==="analyse"; })) h+='<button type="button" class="paper cpg-dep" id="cpgDep"><span><b>Tes dépenses par catégorie</b><small>'+(gSum.dep1||"")+'</small></span><span class="cpg-go">Budget › Analyse ›</span></button>';
      }
      else {
        var ph, pb;
        if(page==="es"){
          var esRows=six.map(function(m){ var x=inOut(m); return { m:m, lbl:mShort(m), inn:x.inn, out:x.out }; });
          ph={ label:"Virements du mois (net)", big:virTotal, color:(virTotal<0?"var(--coral)":"var(--accent)"), sub:"Reçu "+fmtK(virIn)+" · Envoyé "+fmtK(-virOut),
               extra:'<div class="cch">'+compteSixMonthsSVG(esRows, month)+'<div class="cch-leg"><span><i style="background:var(--accent)"></i>Entrées</span><span><i style="background:var(--coral)"></i>Sorties (dépenses + virements envoyés)</span></div></div>' };
          pb=bIn;
        } else {
          var hasB2=epargne.some(function(c){ return c.bourseLink; }), eFirst2=month;
          epargne.forEach(function(c){ Object.keys(c.vals||{}).forEach(function(k){ if(k<eFirst2) eFirst2=k; }); });
          var epR=cRangeMonths(eFirst2).map(function(m){ return { m:m, lbl:mShort(m), v:epTotAt(m), v2:(hasB2?bourseEpAt(m):null) }; }), eA=epR[epR.length-2].v, eB=epR[epR.length-1].v;
          var epP2=provSumWhere(month, function(w){ return w.indexOf("ep:")===0; }), eGain2=eB-epR[0].v;
          ph={ label:"Épargne totale", big:eB, color:"var(--ink)", sub:(epR.length>1?(eB-eA>=0?"+":"")+fmtK(eB-eA)+" vs mois précédent":"")+(hasB2?(epR.length>1?" · ":"")+"dont Bourse "+fmtS(epR[epR.length-1].v2):""),
               extra:'<div class="cnr">'+cRangeBtn().replace('anfx anfx-corner','anfx')+'</div><div class="cch">'+compteLineSVG(epR, month, "#7c9cf4")+'<div class="cch-note">Total de tes comptes épargne'+(hasB2?' (pointillés : dont Bourse)':'')+', '+cRangeNote(epR.map(function(r){ return r.m; }))+'</div></div>',
               stats:[ { l:"Sur la période", v:(eGain2>=0?"+":"−")+fmtS(Math.abs(eGain2)), c:(eGain2<0?"var(--coral)":"var(--accent)") }, { l:"Dont provisions", v:fmtS(epP2) }, { l:"Disponible", v:fmtS(eB-epP2) } ] };
          pb=ep2BodyHTML(month);
        }
        if(multi && page==="es") ph.label+=' · '+esc(acct.nom);
        h+=tabHero(ph)+(page==="ep" ? pb : '<section class="paper cacc cpage"><div class="cacc-b">'+pb+'</div></section>');
      }
      // la liste : une ligne touchée ouvre sa fiche ; le rond la marque « fait »
      function wireOps(){
        try{ wireTicketLongPress(document.getElementById("opsBody")); }catch(err){}
        [].forEach.call(document.querySelectorAll("#opsBody .ops-open"), function(b){ b.onclick=function(){ opsOpen(b.getAttribute("data-k"), b.getAttribute("data-id"), month, b.getAttribute("data-done")==="1"); }; });
        [].forEach.call(document.querySelectorAll("#opsBody .ops-ck"), function(b){ b.onclick=function(){ if(fyRO()) return; var k=b.getAttribute("data-k"), id=b.getAttribute("data-id"); if(k==="f") toggleFraisDone(id, month); else toggleVirementDone(id); }; });
        var rp=document.getElementById("opsReport"); if(rp && !fyRO()) rp.onclick=openReport;
        var ps=document.getElementById("opsPast"); if(ps) ps.onclick=function(){ pastSheet(person, month); };
      }
      // aller à un sous-onglet (les anciennes pages : Dépenses → Opérations filtrées sur les sorties, Solde → Opérations)
      // (Virements n'est plus une page : ses liens mènent aux Opérations, filtrées sur les entrées, les sorties ou « À venir »)
      function goSub(k){ if(k==="tk"){ cptSubGo("tk"); return; } var F={ dep:"out", out:"out", "in":"in", av:"av", es:"tout" }; if(F[k]){ state.cptF=F[k]; k=null; } else if(k!=="ep" && k!=="graph") k=null; state.cptPage=k; state.view="compte"; render(); window.scrollTo(0,0); }
      function cptWheel(){
        var a=acctByKey(person); if(!a) return;
        var ro=fyRO(), items=ro ? [] : acctMenuItems(a), ch=items.slice(0,1);
        if(!ro) ch.push({ l:"Solde reporté · "+monthLabelOf(month).split(" ")[0]+" : "+fmtK(reporte), fn:openReport });
        if(impCan() && person!=="__tickets"){ var lim=store.read("lastImport", null);
          ch.push({ l:"Importer un relevé (OFX, QIF, CSV)", fn:function(){ impStart(person); } });
          if(lim && lim.acct===person) ch.push({ l:"Annuler le dernier import · "+String(lim.at||"").split("-").reverse().join("/"), fn:function(){ impUndo(false); } }); }
        if(!ro && person!=="__tickets"){
          ch.push({ l:"💶 Argent liquide"+(liq?" · "+fmtK(liqAll):""), fn:function(){ var b=document.getElementById("opsLiq"); if(b) b.click(); else liqEdit(person, month); } });
          if(virementsOf(person, prevMonthKey(month)).length) ch.push({ l:"↻ Reprendre des virements "+impDeMois(prevMonthKey(month)), fn:function(){ virReprendre(person, month); } });
        }
        ch=ch.concat(items.slice(1));
        uiChoice(a.nom, a.main?"Compte principal : il reçoit les frais communs et s'affiche sur l'Accueil.":"", ch);
      }
      app.innerHTML=h;
      var gear=document.getElementById("cptGear"); if(gear) gear.onclick=cptWheel;
      [].forEach.call(document.querySelectorAll(".avtabs .cpsub"), function(b){ b.onclick=function(){ goSub(b.getAttribute("data-cp")||null); }; });
      if(!page){
        // « ＋ Ajouter » : virement reçu ou envoyé, frais fixe, ticket ; il arrive dans la liste du mois affiché
        var oa=document.getElementById("opsAdd"); if(oa) oa.onclick=function(){
          var ch=[];
          if(person!=="__tickets"){ ch.push({ l:"⬇️ Virement reçu", fn:function(){ addVirement("in"); } }); ch.push({ l:"⬆️ Virement envoyé", fn:function(){ addVirement("out"); } });
            if(virementsOf(person, prevMonthKey(month)).length) ch.push({ l:"↻ Reprendre des virements "+impDeMois(prevMonthKey(month)), fn:function(){ virReprendre(person, month); } });
            ch.push({ l:"📅 Frais fixe", fn:addFraisCommun }); }
          ch.push({ l:"🧾 Ticket", fn:function(){ newDraft(); var ac=acctByKey(person);   // sur ce compte
            if(ac && person!=="__tickets"){ state.draft.compte=person; if(ac.payer) state.draft.payePar=ac.payer; render(); } } });
          uiChoice("Ajouter", esc((multi||person!=="__tickets" ? (acct?acct.nom+" · ":"") : "")+capFirst(monthLabelOf(month))), ch.map(function(c){ c.primary=false; return c; }));
        };
        [].forEach.call(document.querySelectorAll(".ops-f button[data-f], .ops-sum .hstat"), function(b){ b.onclick=function(){ var k=b.getAttribute("data-f"); state.cptF=(b.classList.contains("hstat") && state.cptF===k) ? "tout" : k; render(); }; });
        var qb=document.getElementById("opsQBtn"); if(qb && affDet()) qb.style.display="none";
        if(qb) qb.onclick=function(){ if(state.cptQOpen || state.cptQ){ state.cptQOpen=false; state.cptQ=""; render(); return; } state.cptQOpen=true; render(); var x=document.getElementById("opsQ"); if(x) x.focus(); };
        var qi=document.getElementById("opsQ"); if(qi && !preStart) qi.addEventListener("input", function(){ state.cptQ=qi.value; var ob=document.getElementById("opsBody"); if(ob){ ob.innerHTML=opsBodyHTML(O, cx); wireOps(); } });
        wireOps();
      }
      // graphiques touchables : cascade → page concernée (Report → solde reporté), camembert → Dépenses, colonnes / points → ce mois
      if(graphV){
        [].forEach.call(document.querySelectorAll(".thero .wfhit"), function(b){ b.addEventListener("click", function(){ var k=b.getAttribute("data-k"); if(k==="report"){ openReport(); return; } goSub(k); }); });
        [].forEach.call(document.querySelectorAll(".thero .dseg, .thero .cdon-r"), function(b){ b.style.cursor="pointer"; b.addEventListener("click", function(){ goSub("dep"); }); });
        [].forEach.call(document.querySelectorAll(".thero .barhit"), function(b){ b.style.cursor="pointer"; b.addEventListener("click", function(){ var m=b.getAttribute("data-m"); if(!state.months) state.months={}; if(cmode==="prov"){ state.months.provisions=(m===curM?null:m); state.view="provisions"; render(); window.scrollTo(0,0); return; }   // provisions : ouvre la page du mois touché
          state.months.compte=(m===curM?null:m); render(); }); });
      }
      function openReport(){
        var auto=soldeFlow(person, prevMonthKey(month)).closing;
        var ovv=getSoldeInit(person,month);
        uiForm({ title:"Solde reporté", intro:"Laisse vide pour reprendre automatiquement le mois précédent ("+fmt(auto)+").", fields:[
          {key:"v", label:monthLabel, type:"money", value:(ovv!==null?ovv:"")}
        ]}, function(r){ if(r.v===null) clearSoldeInit(person,month); else setSoldeInit(person,month,r.v); render(); });
      }
      var rr=document.getElementById("reporterow"); if(rr) rr.onclick=openReport;
      [].forEach.call(document.querySelectorAll(".cptToggle"), function(t){ t.onclick=function(){ var k=t.getAttribute("data-key"); cptOpen[k]=!cptOpen[k]; render(); }; });
      var av=document.getElementById("addvir"); if(av) av.onclick=addVirement;
      [].forEach.call(document.querySelectorAll(".virdone"), function(b){ b.onclick=function(){ toggleVirementDone(b.getAttribute("data-id")); }; });
      [].forEach.call(document.querySelectorAll(".viredit"), function(b){ b.onclick=function(){ editVirement(b.getAttribute("data-id")); }; });
      [].forEach.call(document.querySelectorAll(".virdel"), function(b){ b.onclick=function(){ delVirement(b.getAttribute("data-id")); }; });
      [].forEach.call(document.querySelectorAll(".entry"), function(node){ node.onclick=function(){ editEntry(node.getAttribute("data-id")); }; });
      var ae=document.getElementById("addep"); if(ae) ae.onclick=addEpargne;
      [].forEach.call(document.querySelectorAll(".epbourse"), function(b){ if(!FEAT.bourse) return; b.onclick=function(){ state.view="bourse"; render(); window.scrollTo(0,0); }; });
      [].forEach.call(document.querySelectorAll(".epedit"), function(b){ b.onclick=function(){ editEpargne(b.getAttribute("data-id")); }; });
      [].forEach.call(document.querySelectorAll(".epdel"), function(b){ b.onclick=function(){ delEpargne(b.getAttribute("data-id")); }; });
      var gprov=document.getElementById("goprov"); if(gprov) gprov.onclick=function(){ if(!state.months) state.months={}; state.months.provisions=(month===curM?null:month); state.provFrom=null; state.view="provisions"; render(); window.scrollTo(0,0); };
      var cfr=document.getElementById("cptFrais"); if(cfr) cfr.onclick=function(){ state.view="communes"; render(); window.scrollTo(0,0); };
      var cOn=document.querySelector(".cch-tabs button.on"); if(cOn && cOn.parentNode){ var tb=cOn.parentNode; tb.scrollLeft=Math.max(0, cOn.offsetLeft-(tb.clientWidth-cOn.offsetWidth)/2); }
      if(graphV) [].forEach.call(document.querySelectorAll(".thero .hstat"), function(t,i){ var g=(heroMain.stats[i]||{}).go; if(!g) return; t.style.cursor="pointer"; t.onclick=function(){ goSub(g); }; });
      accScrollFix(); wireAcctPick();
      [].forEach.call(document.querySelectorAll(".cptGo"), function(r){ r.onclick=function(){ goSub(r.getAttribute("data-page")); }; });
      [].forEach.call(document.querySelectorAll(".dgrp .dgh"), function(hd){ hd.onclick=function(){ var g=hd.parentNode, k=g.getAttribute("data-g"); if(!state.depOpen) state.depOpen={}; state.depOpen[k]=!state.depOpen[k]; g.classList.toggle("open", !!state.depOpen[k]); }; });
      [].forEach.call(document.querySelectorAll(".dmode button"), function(bt){ bt.onclick=function(){ state.depByShop=bt.getAttribute("data-v")==="1"; render(); }; });
      wireChartDefaults();
      [].forEach.call(document.querySelectorAll(".cch-tabs button"), function(bt){ bt.onclick=function(){ state.cptChart=bt.getAttribute("data-m"); store.write("cptChart", state.cptChart); render(); }; });
      var clq=document.getElementById("cptLiqBtn"); if(clq) clq.onclick=function(ev){ ev.stopPropagation(); state.cptLiq=!liqOn; store.write("cptLiq", state.cptLiq); render(); };
      var cpgDep=document.getElementById("cpgDep"); if(cpgDep) cpgDep.onclick=function(){ state.depSub="analyse"; state.view=depView(); render(); window.scrollTo(0,0); };
      [].forEach.call(document.querySelectorAll(".cpg-or"), function(b){ b.onclick=function(){ state.cptChart=b.getAttribute("data-m"); render(); window.scrollTo(0,0); }; });
      [].forEach.call(document.querySelectorAll(".ep2-card[data-id]"), function(b){ b.onclick=function(){ var id=b.getAttribute("data-id"), c=epargne.filter(function(x){ return String(x.id)===id; })[0]; if(!c) return;
        if(c.bourseLink){ if(FEAT.bourse){ state.view="bourse"; render(); window.scrollTo(0,0); } return; }
        if(fyRO()){ uiToast("En consultation seulement"); return; }
        uiChoice(c.nom, esc(fmtK(epAt(c, month))), [ { l:"Modifier", fn:function(){ editEpargne(id); } }, { l:"Supprimer", danger:true, fn:function(){ delEpargne(id); } } ]); }; });
      [].forEach.call(document.querySelectorAll("#epWho button"), function(b){ b.onclick=function(){ state.epWho=b.getAttribute("data-w"); render(); }; });
      [].forEach.call(document.querySelectorAll(".crange button, .crange-c"), function(b){ b.onclick=function(){ state.cptRange=b.getAttribute("data-r"); store.write("cptRange", state.cptRange); render(); }; });
      if(graphV && document.querySelector(".cch-tabs")) wireCptSwipe(cmode, CMODES.map(function(x){ return x[0]; }));
      var lr=document.getElementById("liqrow"); if(lr) lr.onclick=function(){ liqEdit(person, month); };
      // bouton « Liquide » de la liste : le montant, le changer, le compter ou non dans les soldes
      var ol=document.getElementById("opsLiq"); if(ol) ol.onclick=function(){
        var ro=fyRO();
        if(!liq){ if(ro) uiToast("Pas de liquide noté"); else liqEdit(person, month); return; }
        var cur=liquideAt(person, month), msg='<b>'+esc(fmtK(cur.val))+'</b> · '+(cur.month===month?"noté pour "+esc(monthLabelOf(month)):"repris "+esc(impDeMois(cur.month)))+'<br>'+
          (liqTk>0.004 ? "Dont −"+esc(fmtK(liqTk))+" de tickets payés en espèces ce mois-ci.<br>" : "")+(liqOn?"Compté dans les soldes : fin de mois, Accueil, widgets.":"Pas compté dans les soldes.");
        var ch=[];
        if(!ro) ch.push({ l:"✎ Détail du mois · corriger", fn:function(){ liqEdit(person, month); } });
        ch.push({ l:(liqOn?"Ne plus le compter dans les soldes":"Le compter dans les soldes"), primary:ro, fn:function(){ state.cptLiq=!liqOn; store.write("cptLiq", state.cptLiq); render(); uiToast(state.cptLiq?"Liquide compté":"Liquide pas compté"); } });
        uiChoice("Argent liquide", msg, ch);
      };
      if(!state.months) state.months={};
      var cmp=document.getElementById("cm-prev"); if(cmp) cmp.onclick=function(){ state.months.compte=prevMonthKey(month); render(); };
      var cmn=document.getElementById("cm-next"); if(cmn) cmn.onclick=function(){ var nx=nextMonthKey(month); state.months.compte=(nx===curM?null:nx); render(); };
      var cmt=document.getElementById("cm-today"); if(cmt) cmt.onclick=function(){ state.months.compte=null; render(); };
      setNav("compte", true);
    }

    function fetchSolPrice(){
      if(state.solLoading) return;
      state.solLoading=true; state.solError=""; render();
      fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=eur")
        .then(function(r){ return r.json(); })
        .then(function(j){
          var p=j&&j.solana&&j.solana.eur;
          if(!p) throw new Error("Donnée manquante");
          p=toBase(p,"EUR"); if(p===null) throw new Error("Taux de change indisponible");
          state.solPrice=p;
          state.prixActuel=String(p).replace(".",",");
          state.solTime=new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
          state.solError=""; state.solLoading=false; render();
        })
        .catch(function(e){
          state.solError="Erreur : "+(e&&e.message?e.message:"connexion");
          state.solLoading=false; render();
        });
    }
    function fetchStockPrice(symbol){
      if(!symbol) return;
      if(state.stockLoading[symbol]) return;
      state.stockLoading[symbol]=true; state.stockError[symbol]=""; render();
      fetch("https://stooq.com/q/l/?s="+encodeURIComponent(symbol)+"&f=sd2t2ohlcv&h&e=csv")
        .then(function(r){ return r.text(); })
        .then(function(text){
          var lines=text.trim().split("\n");
          if(lines.length<2) throw new Error("Réponse vide");
          var cols=lines[1].split(",");
          var close=parseFloat(cols[6]);
          if(!isFinite(close) || close<=0) throw new Error("Cours indisponible pour "+symbol);
          if(BASE==="USD") return close;
          function fb(){ var v=toBase(close,"USD"); return v!==null?v:(BASE==="EUR"?close*0.87:close); }
          return fetch("https://api.frankfurter.dev/v1/latest?base=USD&symbols="+BASE)
            .then(function(r){ return r.json(); })
            .then(function(fx){ var rate=fx && fx.rates && fx.rates[BASE]; return rate ? close*rate : fb(); })
            .catch(fb);
        })
        .then(function(priceEUR){
          state.stockPrices[symbol]=priceEUR;
          state.stockLoading[symbol]=false; state.stockError[symbol]="";
          syncStockAccounts();
          render();
        })
        .catch(function(e){
          state.stockError[symbol]="Erreur : "+(e&&e.message?e.message:"connexion");
          state.stockLoading[symbol]=false; render();
        });
    }
    function syncStockAccounts(){
      var m0=monthKey(todayISO()), ch=false;
      bourse.forEach(function(c){
        if(c.stock && c.stock.symbol && state.stockPrices[c.stock.symbol]){
          var nv=(c.stock.qty||0)*state.stockPrices[c.stock.symbol]+(Number(c.stock.cash)||0);
          if(!c.vals) c.vals={};
          var cur=c.vals[m0]||{}, capPrev=cur.capital;
          if(capPrev===undefined){ var bl=bLast(c); capPrev=bl?bl.capital:0; }
          if(Number(cur.valeur)!==nv){ bSnap(c, m0, Number(capPrev)||0, nv); ch=true; }
        }
      });
      if(ch) persistBourse();
    }
    function fetchAllStockPrices(){
      if(!FEAT.bourse) return;
      var symbols={};
      bourse.forEach(function(c){ if(c.stock && c.stock.symbol) symbols[c.stock.symbol]=true; });
      Object.keys(symbols).forEach(function(s){ fetchStockPrice(s); });
    }
    function renderBourse(){
      var curM=monthKey(todayISO());
      var month=(state.months&&state.months.bourse)||curM;
      var monthLabel=monthLabelOf(month);
      if(bourse.some(function(c){ return c.sol; }) && !state.solLoading && state.solPrice===null && !state.solError) fetchSolPrice();
      if(state.solPrice){
        var m0=monthKey(todayISO()), ch=false;
        bourse.forEach(function(c){
          if(c.sol && c.solQty){
            var nv=c.solQty*state.solPrice;
            if(!c.vals) c.vals={};
            var cur=c.vals[m0]||{}, capPrev=cur.capital;
            if(capPrev===undefined){ var bl=bLast(c); capPrev=bl?bl.capital:0; }
            if(Number(cur.valeur)!==nv){ bSnap(c, m0, Number(capPrev)||0, nv); ch=true; }
          }
        });
        if(ch) persistBourse();
      }
      // Page principale (total + deux boutons) ou sous-page : « comptes » (les fiches) / « gerer » (les actions)
      var bSub=state.bSub; if(bSub!=="comptes" && bSub!=="gerer") bSub=null;
      var h=header(!!bSub, bSub==="comptes"?"Mes comptes":(bSub==="gerer"?"Gérer":""))+(bSub==="gerer"?'':'<div class="tabtop">'+monthNavHTML(esc(capFirst(monthLabel)), month, curM)+'</div>')+(bSub?'':tabTools([["bgoMng","⚙︎ Gérer"]]))+'%%HERO%%', accH='';
      var emptyB=''; if(!bourse.some(function(c){ return bAt(c,month) && !bClosedAt(c,month); })) emptyB='<div class="muted" style="font-size:12px;margin:4px 2px 8px">Aucun compte'+(month===curM?". Ajoute ton premier compte bourse.":" ce mois-ci.")+'</div>';
      var totCap=0, totVal=0, totCash=0, totPrevVal=null, totFirstVal=null, totFirstCap=null;
      var pm=prevMonthKey(month);
      var visB=bourse.filter(function(c){ return bAt(c,month) && !bClosedAt(c,month); });
      bourse.forEach(function(c){
        var atSnap=bAt(c,month); if(!atSnap || bClosedAt(c,month)) return; var last=atSnap, vi=visB.indexOf(c), prev=bPrevAt(c,month), first=bFirst(c);
        var cap=Number(last.capital)||0, val=Number(last.valeur)||0, cash=bCash(last), tot=val+cash;
        var pv=val-cap;
        totCap+=cap; totVal+=val; totCash+=cash;
        var pmSnap=bAt(c,pm); if(pmSnap){ totPrevVal=(totPrevVal||0)+Number(pmSnap.valeur||0); }
        if(first){ totFirstVal=(totFirstVal||0)+Number(first.valeur||0); totFirstCap=(totFirstCap||0)+Number(first.capital||0); }
        // Jauge de plus-value : hauteur = % gagné ou perdu sur le capital (pleine à +100 %)
        var gp=cap>0?pv/cap*100:0, gz=Math.abs(pv)<0.005, gcol=gz?"var(--muted)":(pv>0?"var(--accent)":"var(--coral)"), gf=gz?0:Math.max(8,Math.min(100,Math.abs(gp)));
        accH+='<section class="paper bacct"><span class="bgauge"><i style="height:'+gf+'%;background:'+gcol+'"></i></span><div style="margin:0 0 2px">';
        accH+='<div class="prow bhead" data-bid="'+esc(c.id)+'" style="cursor:pointer"><span class="pname" style="font-weight:700">'+esc(c.nom)+(c.closed?' <span style="font-size:9.5px;color:var(--muted);font-weight:600">clôturé en '+esc(monthLabelOf(c.closed).split(" ")[0])+'</span>':'')+((c.sol&&month===curM)?' <span style="font-size:9px;color:var(--accent);font-weight:600">● live</span>':'')+'</span>'+
           '<span class="btot"><b>'+fmtK(tot)+'</b>'+(cap>0?'<small style="color:'+gcol+'">'+(pv>=0?"+":"-")+Math.abs(gp).toFixed(1).replace(".",",")+' % · '+(pv>=0?"+":"")+fmtK(pv)+'</small>':'')+'</span>'+
           '<button class="btn ghost bedit" type="button" data-id="'+esc(c.id)+'">✎</button>'+
           (vi>0?'<button class="btn ghost bmove" type="button" data-id="'+esc(c.id)+'" data-to="'+esc(visB[vi-1].id)+'" style="display:none">▲</button>':'')+
           (vi<visB.length-1?'<button class="btn ghost bmove" type="button" data-id="'+esc(c.id)+'" data-to="'+esc(visB[vi+1].id)+'" style="display:none">▼</button>':'')+
           '<button class="btn ghost bdel" type="button" data-id="'+esc(c.id)+'">✕</button></div>';
        accH+='<div style="font-size:12.5px;color:var(--ink-soft);margin:2px 6px 0">Capital investi : '+fmtK(cap)+'</div>';
        accH+='<div style="font-size:12.5px;color:var(--ink-soft);margin:3px 6px 0">Reste à investir : <span style="color:'+(cash?'var(--ink)':'var(--muted)')+';font-weight:600">'+((last.cashCur&&last.cashCur!==BASE&&last.cashOrig!=null)?fmtCur(Number(last.cashOrig),last.cashCur)+'</span> <span style="color:var(--muted)">≈ '+fmtK(cash):fmtK(cash))+'</span></div>';
        var badges=[];
        if(prev) badges.push(bBadge(Number(prev.valeur||0),val,"Mois préc. :"));
        if(first&&bMonths(c).length>1) badges.push(bBadge(Number(first.valeur||0),val,"Depuis création :"));
        badges.forEach(function(b){ if(b) accH+='<div style="font-size:12.5px;margin:3px 6px 0">'+b+'</div>'; });
        accH+='</div>';
        accH+=positionsHTML(c);
        accH+='</section>';
      });
      if(bSub==="comptes") h+=(emptyB?'<section class="paper bacts">'+emptyB+'</section>':'')+accH;
      var bsafe=(!bourse.length && !bSub) ? store.read("bourseSafe", null) : null;
      if(bsafe && bsafe.bourse && bsafe.bourse.length){
        h+='<section class="paper" style="margin-top:14px;border:1px solid var(--accent)"><div style="font-weight:700;margin-bottom:6px">🛟 Ta Bourse est vide</div><div class="muted" style="font-size:12.5px;line-height:1.45">Une copie automatique de '+bsafe.bourse.length+' compte'+(bsafe.bourse.length>1?'s':'')+' existe (du '+esc(new Date(bsafe.t).toLocaleString("fr-FR",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}))+').</div><button class="btn primary" id="bsafeGo" type="button" style="width:100%;margin-top:10px">Remettre cette copie</button></section>';
      }
      if(!bSub){
        h+='<section class="paper cacc"><div class="cacc-sec"><div class="cacc-h" id="bgoAcc"><span class="t"><span class="tic">🏦</span> Mes comptes · '+visB.length+'</span><span class="v">'+fmtK(totVal+totCash)+'</span><span class="ch">›</span></div></div></section>';
      }
      if(bSub==="gerer") h+='<section class="paper bacts">';
      function bAct(id, ic, t, sub){ return '<button class="dr-item" id="'+id+'" type="button"><span class="ic">'+ic+'</span><span>'+t+'<small>'+sub+'</small></span><span class="chev">›</span></button>'; }
      if(bSub==="gerer"){
        h+=bAct("addpos","📈","Ajouter une crypto ou une action","Suivie en direct, ou saisie à la main");
        h+=bAct("addbrs","🏦","Ajouter un compte bourse","eToro, PEA, Boursorama…");
        h+=bAct("restbrs","🛟","Restaurer depuis une sauvegarde","Toute la Bourse, ou un compte supprimé");
        h+='</section>';
      }
      (function(){
        var st=[{l:"Capital investi", v:fmtS(totCap)}];
        if(totCap>0){ var pv=totVal-totCap; st.push({l:"Plus-value", keep:1, v:signS(pv), d:(bPct(totCap,totVal)||""), c:heroCol(pv)}); }
        // Total du mois précédent tel qu'affiché ce mois-là (tous les comptes ouverts alors, y compris ceux clôturés depuis)
        var prevTot=null; bourse.forEach(function(c){ var sp=bAt(c,pm); if(!sp || bClosedAt(c,pm)) return; prevTot=(prevTot||0)+(Number(sp.valeur)||0)+bCash(sp); });
        if(prevTot!==null){ var curTot=totVal+totCash, dp=curTot-prevTot; st.push({l:"vs mois préc.", v:signS(dp), d:(bPct(prevTot,curTot)||""), c:heroCol(dp)}); }
        h=h.replace("%%HERO%%", (bourse.length && !bSub)?tabHero({ label:"Total portefeuille", big:totVal+totCash, sub:(totCash?"dont "+fmt(totCash)+" à investir":""), extra:bourseSlides(bourseChartHTML(), bourseBarsHTML(month, curM)), stats:st }):"");
      })();
      app.innerHTML=h;
      if(bSub) bindBack(function(){ state.bSub=null; render(); window.scrollTo(0,0); });
      var bga=document.getElementById("bgoAcc"); if(bga) bga.onclick=function(){ if(!visB.length && month===curM){ addBourse(); return; } state.bSub="comptes"; render(); window.scrollTo(0,0); };
      var bgm=document.getElementById("bgoMng"); if(bgm) bgm.onclick=function(){ state.bSub="gerer"; render(); window.scrollTo(0,0); };
      var rs=document.getElementById("refreshsol"); if(rs) rs.onclick=function(){ state.solPrice=null; fetchSolPrice(); };
      var pa=document.getElementById("prixact"); if(pa){ pa.oninput=function(){ state.prixActuel=pa.value; render(); }; }
      var ab=document.getElementById("addbrs"); if(ab) ab.onclick=addBourse;
      var rsb=document.getElementById("restbrs"); if(rsb) rsb.onclick=restoreBourseOnly;
      var bsg=document.getElementById("bsafeGo"); if(bsg) bsg.onclick=function(){ var sf=store.read("bourseSafe", null); if(!sf||!sf.bourse) return; bourse=sf.bourse; persistBourse(); applyPositions(); syncBourseEpargne(); render(); uiToast("Bourse remise ✓"); };
      [].forEach.call(document.querySelectorAll(".bhead"), function(row){ row.onclick=function(ev){ var t=ev.target; while(t && t!==row){ if(t.tagName==="BUTTON") return; t=t.parentNode; } editBourse(row.getAttribute("data-bid")); }; });
      [].forEach.call(document.querySelectorAll(".bedit"), function(b){ b.onclick=function(){ editBourse(b.getAttribute("data-id")); }; });
      [].forEach.call(document.querySelectorAll(".bdel"), function(b){ b.onclick=function(){ delBourse(b.getAttribute("data-id")); }; });
      [].forEach.call(document.querySelectorAll(".bmove"), function(b){ b.onclick=function(){
        var a=b.getAttribute("data-id"), z=b.getAttribute("data-to"), i=-1, j=-1;
        bourse.forEach(function(c,k){ if(String(c.id)===a) i=k; if(String(c.id)===z) j=k; });
        if(i<0||j<0) return; var t=bourse[i]; bourse[i]=bourse[j]; bourse[j]=t; persistBourse(); render(); }; });
      [].forEach.call(document.querySelectorAll(".bmonth"), function(sp){ sp.onclick=function(){ var mk=sp.getAttribute("data-m"); if(mk>curM) return; if(!state.months) state.months={}; state.months.bourse=(mk===curM?null:mk); render(); }; });
      wireMonthNav(month, curM, "bourse");
      wireBourseChart(); wireBourseSlides(curM);
      var apz=document.getElementById("addpos"); if(apz) apz.onclick=openPositionSearch;
      [].forEach.call(document.querySelectorAll(".pos.prow[data-p]"), function(row){ row.onclick=function(ev){ var t=ev.target; while(t && t!==row){ if(t.tagName==="BUTTON") return; t=t.parentNode; } openAssetDetail(row.getAttribute("data-a"), row.getAttribute("data-p")); }; });
      [].forEach.call(document.querySelectorAll(".posval"), function(b){ b.onclick=function(){ var f=findPosition(b.getAttribute("data-a"), b.getAttribute("data-p")); if(f) quickValue(f.p); }; });
      [].forEach.call(document.querySelectorAll(".posedit"), function(b){ b.onclick=function(){ var f=findPosition(b.getAttribute("data-a"), b.getAttribute("data-p")); if(f) positionForm(f.p, f); }; });
      [].forEach.call(document.querySelectorAll(".posdel"), function(b){ b.onclick=function(){ var f=findPosition(b.getAttribute("data-a"), b.getAttribute("data-p")); if(!f) return;
        uiConfirm("Retirer « "+esc(f.p.nom)+" » du compte "+esc(f.c.nom)+" ?", function(){ f.c.positions=f.c.positions.filter(function(x){ return x!==f.p; }); persistBourse(); render(); }, { ok:"Retirer", danger:true }); }; });
      refreshPositions(false);
      setNav("bourse", true);
    }

    var PALETTE=["#f4796b","#4fd6a0","#e0a458","#7c9cf4","#c78bd6","#5bc0d4","#e88fb0","#9bd35e","#d4a05b","#8a92e0","#6fcaa8","#d98c5f","#b0b6c2"];
    function gPeriodEntries(){
      var p=state.graphPeriod||"cur";
      if(p==="all"){ var ms={}; lastMonths(12).forEach(function(m){ ms[m.key]=true; }); return vEntries().filter(function(e){ return ms[monthKey(e.date)]; }); }
      if(p.indexOf("m:")===0){ var k=p.slice(2); return vEntries().filter(function(e){ return monthKey(e.date)===k; }); }
      var cur=monthKey(todayISO()); return vEntries().filter(function(e){ return monthKey(e.date)===cur; });
    }
    function gAggregate(entries, dim){
      var map={};
      if(dim==="cat"){ entries.forEach(function(e){ var v=Number(e.montant)||0, k=catMain(e.categorie); if(v>0) map[k]=(map[k]||0)+v; }); }   // grandes catégories
      else if(dim==="scat"){ entries.forEach(function(e){ var v=Number(e.montant)||0, k=e.categorie||"Autre"; if(v>0) map[k]=(map[k]||0)+v; }); }   // sous-catégories (le détail)
      else if(dim==="pers"){ entries.forEach(function(e){ var v=Number(e.montant)||0, p=payerOf(e); if(v>0) map[p]=(map[p]||0)+v; }); }
      else { entries.forEach(function(e){ (e.articles||[]).forEach(function(a){ if((a.produit||"")==="Remise") return; var c=classifyArticle(a); if(c.amt<=0) return; var key=dim==="fam"?c.fam:c.name; map[key]=(map[key]||0)+c.amt; }); }); }
      return map;
    }
    function gDonut(items, total){
      var r=70, cx=90, cy=90, sw=26, C=2*Math.PI*r, off=0, segs="";
      items.forEach(function(it){
        var frac= total>0 ? it.value/total : 0, len=frac*C;
        if(len<=0) return;
        segs+='<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="'+it.color+'" stroke-width="'+sw+'" stroke-dasharray="'+len.toFixed(2)+' '+(C-len).toFixed(2)+'" stroke-dashoffset="'+(-off).toFixed(2)+'" transform="rotate(-90 '+cx+' '+cy+')"></circle>';
        off+=len;
      });
      return '<svg viewBox="0 0 180 180" width="100%" style="max-width:230px;display:block;margin:8px auto 6px">'+
             '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="#efe9db" stroke-width="'+sw+'"></circle>'+segs+
             '<text x="90" y="86" text-anchor="middle" font-size="10" fill="#6f6a5e" font-family="monospace" letter-spacing="1">TOTAL</text>'+
             '<text x="90" y="106" text-anchor="middle" font-size="17" font-weight="700" fill="#f4796b" font-family="monospace">'+fmt(total)+'</text></svg>';
    }
    function gBlock(items){
      var tot=items.reduce(function(s2,it){ return s2+(Number(it.value)||0); },0);
      if(tot<=0) return '<div class="center muted" style="font-size:12px;margin-top:12px">Aucune donnée.</div>';
      items=items.filter(function(it){ return (Number(it.value)||0)>0; }).sort(function(a,b){ return b.value-a.value; });
      items.forEach(function(it,i){ it.color=PALETTE[i%PALETTE.length]; });
      var out=gDonut(items, tot);
      out+='<div style="margin-top:10px">';
      items.forEach(function(it){
        var share=Math.round(it.value/tot*100)+"%";
        out+='<div class="lgd" style="cursor:default"><span class="sw" style="background:'+it.color+'"></span><span class="ln">'+esc(it.name)+'</span><span class="lv">'+fmt(it.value)+'</span><span class="lp">'+share+'</span></div>';
      });
      out+='</div>';
      return out;
    }
    function computeCompteMonth(person, month){
      var vin=virementsSum(person,month), dep=computeDepensesMonth(person,month), fl=soldeFlow(person,month);
      return { argent:vin, depenses:dep, reste:vin-dep, reporte:fl.opening, solde:fl.closing };
    }
    function lastMonths(n){
      var arr=[], d=new Date(); d.setDate(1);
      for(var i=0;i<n;i++){ var y=d.getFullYear(), m=d.getMonth(); arr.unshift({ key:y+"-"+("0"+(m+1)).slice(-2), date:new Date(y,m,1) }); d.setMonth(m-1); }
      return arr;
    }
