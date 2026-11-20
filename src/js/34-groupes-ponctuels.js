    // ---------- Groupes ponctuels : voyage, sortie (✦ Plus, Commun › Groupes) ----------
    // Les participants peuvent être du foyer ou non (amis sans l'appli). Chaque dépense est partagée à parts égales entre tous.
    // Ceux du foyer remboursent comme dans « Qui doit combien à qui » (virement entre leurs comptes, ou sans virement).
    function grpById(id){ return groupes.filter(function(g){ return String(g.id)===String(id); })[0]||null; }
    function grpDeps(g){ return (g.dep||[]).filter(function(d){ return d.ticketId==null || state.entries.some(function(e){ return String(e.id)===String(d.ticketId); }); }); }   // un ticket supprimé sort du groupe
    // pour qui compte une dépense : d.pour (prénoms cochés, parmi les participants), sinon tout le groupe
    function grpPour(g, d){ var M=g.membres||[], F=(d.pour||[]).filter(function(p){ return M.indexOf(p)>=0; }); return F.length ? F : M; }
    function grpPourSome(g, d){ return grpPour(g, d).length<(g.membres||[]).length; }
    function grpEqual(g){ return !grpDeps(g).some(function(d){ return grpPourSome(g, d); }); }
    function grpPourTxt(g, d){ return grpPourSome(g, d) ? "pour "+grpPour(g, d).map(grpWho).join(", ") : "tout le groupe"; }
    // « Pour qui ? » : une case par participant, parts égales entre les cochés
    function grpPourSheet(g, d){
      var M=g.membres||[], sel={}; grpPour(g, d).forEach(function(p){ sel[p]=1; });
      var s=uiSheet('<div class="sheet-title">Pour qui ?</div><div class="ui-intro">'+esc(d.label+" · "+fmtS(d.montant))+' · partagé à parts égales entre les personnes cochées.</div><div id="gpq">'+
        M.map(function(p){ return '<label class="csv-ck"><input type="checkbox" data-p="'+esc(p)+'"'+(sel[p]?' checked':'')+'><span style="flex:1">'+esc(grpWho(p))+'</span><span class="muted gpv" data-p="'+esc(p)+'"></span></label>'; }).join("")+'</div>'+
        '<div class="ui-err" style="display:none"></div><div class="ui-stack"><button type="button" class="btn primary" id="gpqOk">Enregistrer</button><button type="button" class="btn ghost" id="gpqAll">Tout le groupe</button></div>');
      function cur(){ var L=[]; [].forEach.call(s.qa("#gpq input"), function(c){ if(c.checked) L.push(c.getAttribute("data-p")); }); return L; }
      function paint(){ var L=cur(); [].forEach.call(s.qa(".gpv"), function(x){ x.textContent=L.indexOf(x.getAttribute("data-p"))>=0 ? fmtS((Number(d.montant)||0)/L.length) : "—"; }); }
      [].forEach.call(s.qa("#gpq input"), function(c){ c.onchange=paint; }); paint();
      function save(L){ var old=d.pour; if(!L || L.length>=M.length) delete d.pour; else d.pour=L; persistGroupes(); s.close(); render();
        uiUndoToast(d.pour ? "Pour "+d.pour.length+" personne"+(d.pour.length>1?"s":"") : "Pour tout le groupe", "Annuler", function(){ if(old) d.pour=old; else delete d.pour; persistGroupes(); render(); }); }
      s.q("#gpqAll").onclick=function(){ save(null); };
      s.q("#gpqOk").onclick=function(){ var L=cur(); if(!L.length){ var er=s.q(".ui-err"); er.textContent="Coche au moins une personne."; er.style.display=""; return; } save(L); };
    }
    function grpTotal(g){ var t=0; grpDeps(g).forEach(function(d){ t+=Number(d.montant)||0; }); return t; }
    function grpBal(g){
      var P={}, M=g.membres||[];
      M.forEach(function(p){ P[p]={ paid:0, share:0 }; });
      function add(p, k, v){ if(!P[p]) P[p]={ paid:0, share:0 }; P[p][k]+=v; }
      grpDeps(g).forEach(function(d){ var v=Number(d.montant)||0, F=grpPour(g, d); add(d.payePar||M[0], "paid", v); F.forEach(function(p){ add(p, "share", v/F.length); }); });
      (g.rembs||[]).forEach(function(r){ add(r.from, "paid", Number(r.montant)||0); add(r.to, "paid", -(Number(r.montant)||0)); });
      Object.keys(P).forEach(function(p){ P[p].net=P[p].paid-P[p].share; });
      var cr=[], db=[]; Object.keys(P).forEach(function(p){ var n0=P[p].net, v=(n0<0?-1:1)*Math.round(Math.abs(n0)*100+1e-6)/100; if(v>0.5) cr.push({ p:p, v:v }); else if(v<-0.5) db.push({ p:p, v:-v }); });
      var T=[]; cr.sort(function(a,b){ return b.v-a.v; }); db.sort(function(a,b){ return b.v-a.v; });
      var i=0, j=0; while(i<db.length && j<cr.length){ var x=Math.min(db[i].v, cr[j].v); if(x>0.5) T.push({ from:db[i].p, to:cr[j].p, v:Math.round(x*100)/100 }); db[i].v-=x; cr[j].v-=x; if(db[i].v<0.5) i++; if(cr[j].v<0.5) j++; }
      return { P:P, T:T };
    }
    function grpWho(p){ return p===mePerson() ? "Toi" : p; }
    function grpSectionHTML(){
      if(!canUse("groupes")) return '<section class="paper cacc"><div class="cacc-h" id="grpBuy"><span class="t"><span class="tic">🧳</span> Groupes ✦<small>voyage, sortie entre amis : qui doit combien à qui</small></span><span class="ch">›</span></div></section>';
      var op=groupes.filter(function(g){ return !g.clos; }), cl=groupes.length-op.length, h='<section class="paper cacc"><div class="cacc-h" style="cursor:default"><span class="t"><span class="tic">🧳</span> Groupes<small>voyage, sortie : même avec des amis sans l\'appli</small></span></div>';
      op.forEach(function(g){ h+='<div class="grp-row" data-id="'+esc(g.id)+'"><span class="n">'+esc(g.nom)+'<small>'+(g.membres||[]).length+' personnes · '+grpDeps(g).length+' dépense'+(grpDeps(g).length>1?'s':'')+'</small></span><b>'+fmtK(grpTotal(g))+'</b><span class="ch">›</span></div>'; });
      if(cl) h+='<div class="grp-row grp-clos" id="grpClos"><span class="n">'+cl+' groupe'+(cl>1?'s':'')+' clos<small>pour les revoir</small></span><span class="ch">›</span></div>';
      if(!fyRO()) h+='<div class="clink" id="grpNew"><span>＋ Nouveau groupe</span><span></span></div>';
      return h+'</section>';
    }
    function grpWire(){
      var b=document.getElementById("grpBuy"); if(b) b.onclick=function(){ plusShow("equilibre"); };
      var n=document.getElementById("grpNew"); if(n) n.onclick=function(){ grpForm(null); };
      var c=document.getElementById("grpClos"); if(c) c.onclick=function(){ var L=groupes.filter(function(g){ return g.clos; });
        uiChoice("Groupes clos", "", L.map(function(g){ return { l:g.nom+" · "+fmtS(grpTotal(g)), primary:false, fn:function(){ grpOpen(g.id); } }; })); };
      [].forEach.call(document.querySelectorAll(".grp-row[data-id]"), function(r){ r.onclick=function(){ grpOpen(r.getAttribute("data-id")); }; });
    }
    function grpOpen(id){ state.grpId=id; state.view="groupe"; render(); window.scrollTo(0,0); }
    // nouveau groupe, ou ses participants : les personnes du foyer à cocher + d'autres prénoms
    function grpForm(g){
      var me=mePerson(), C=uniquePersons().slice(); if(C.indexOf(me)<0) C.unshift(me);
      var sel={}, others=[]; if(g) (g.membres||[]).forEach(function(p){ if(C.indexOf(p)>=0) sel[p]=1; else others.push(p); }); else sel[me]=1;
      var s=uiSheet('<div class="sheet-title">'+(g?"Participants":"Nouveau groupe")+'</div>'+(g?'':'<label class="f">Nom</label><input class="f" id="grpNom" placeholder="Week-end Annecy">')+
        '<label class="f">Du foyer</label><div>'+C.map(function(p){ return '<label class="csv-ck"><input type="checkbox" data-p="'+esc(p)+'"'+(sel[p]?' checked':'')+'><span>'+esc(grpWho(p))+'</span></label>'; }).join("")+'</div>'+
        '<label class="f">Autres participants</label><input class="f" id="grpAutres" placeholder="Julien, Chloé" value="'+esc(others.join(", "))+'"><div class="muted" style="font-size:11px;margin:4px 2px 0">Des amis sans l\'appli : séparés par des virgules.</div>'+
        '<div class="ui-err" style="display:none"></div><div class="ui-stack"><button type="button" class="btn primary" id="grpOk">'+(g?"Enregistrer":"Créer le groupe")+'</button><button type="button" class="btn ghost ui-no">Annuler</button></div>');
      s.q(".ui-no").onclick=s.close;
      s.q("#grpOk").onclick=function(){
        var nom=g ? g.nom : (s.q("#grpNom").value||"").trim(), M=[], er=s.q(".ui-err");
        [].forEach.call(s.qa("input[data-p]"), function(c){ if(c.checked) M.push(c.getAttribute("data-p")); });
        (s.q("#grpAutres").value||"").split(",").forEach(function(x){ x=x.trim(); if(x && x!=="Commun" && M.indexOf(x)<0) M.push(x); });
        if(!nom){ er.textContent="Donne un nom au groupe."; er.style.display=""; return; }
        if(M.length<2){ er.textContent="Il faut au moins deux participants."; er.style.display=""; return; }
        if(g){ grpDeps(g).forEach(function(d){ if(M.indexOf(d.payePar)<0) M.push(d.payePar); }); g.membres=M; persistGroupes(); s.close(); render(); return; }
        var ng={ id:virNewId(), nom:nom, membres:M, dep:[], rembs:[], created:todayISO() }; groupes.push(ng); persistGroupes(); s.close(); grpOpen(ng.id);
      };
    }
    function grpDepForm(g, d){
      var me=mePerson();
      uiForm({ title:d ? "Modifier la dépense" : "Dépense du groupe", fields:[
        { key:"label", label:"Quoi", value:d ? d.label : "", placeholder:"Courses, location, essence…", required:true },
        { key:"montant", label:"Montant", type:"money", value:d ? d.montant : "", required:true },
        { key:"who", label:"Payé par", type:"select", value:d ? d.payePar : ((g.membres||[]).indexOf(me)>=0 ? me : g.membres[0]), options:(g.membres||[]).map(function(p){ return { v:p, l:grpWho(p) }; }) },
        { key:"pour", label:"Pour qui", type:"seg", value:(d && grpPourSome(g, d)) ? "some" : "all", options:[{ v:"all", l:"Tout le groupe" }, { v:"some", l:"Choisir…" }] }
      ], ok:d ? "Enregistrer" : "Ajouter" }, function(r){
        var v=Math.abs(num(r.montant)); if(!(v>0)) return "Indique le montant.";
        var x=d;
        if(d){ d.label=r.label; d.montant=Math.round(v*100)/100; d.payePar=r.who; }
        else (g.dep||(g.dep=[])).push(x={ id:virNewId(), date:todayISO(), label:r.label, montant:Math.round(v*100)/100, payePar:r.who });
        if(r.pour==="all") delete x.pour;
        persistGroupes(); render();
        if(r.pour==="some") setTimeout(function(){ grpPourSheet(g, x); }, 50);
      });
    }
    function grpRecap(g){
      var B=grpBal(g), M=g.membres||[], tot=grpTotal(g), me=mePerson(), nm=function(p){ return p===me ? me : p; };
      var t=g.nom+"\nTotal "+fmtS(tot)+(grpEqual(g) ? " · "+fmtS(M.length ? tot/M.length : 0)+" chacun" : "")+"\n";
      grpDeps(g).forEach(function(d){ t+="- "+d.label+" : "+fmtS(d.montant)+" (payé par "+nm(d.payePar)+(grpPourSome(g, d) ? ", pour "+grpPour(g, d).map(nm).join(", ") : "")+")\n"; });
      t+=B.T.length ? "\nÀ rembourser :\n"+B.T.map(function(x){ return nm(x.from)+" → "+nm(x.to)+" : "+fmtS(x.v); }).join("\n") : "\nTout est équilibré.";
      return t+"\n\nFait avec "+APP_NAME+"";
    }
    function grpShare(g){
      var t=grpRecap(g), SH=capPlugin("Share");
      if(SH) SH.share({ title:g.nom, text:t }).catch(function(){});
      else if(navigator.share) navigator.share({ title:g.nom, text:t }).catch(function(){});
      else { try{ navigator.clipboard.writeText(t).then(function(){ uiToast("Récap copié : colle-le dans un message"); }).catch(function(){ window.alert(t); }); }catch(e){ window.alert(t); } }
    }
    function renderGroupe(){
      var g=grpById(state.grpId); if(!g){ state.view="communes"; return renderCommunes(); }
      var B=grpBal(g), M=g.membres||[], me=mePerson(), tot=grpTotal(g), ro=fyRO() || !!g.clos;
      var h=header(true, g.nom)+tabHero({ label:(g.clos?"Groupe clos · ":"")+M.length+" personnes", big:tot, sub:grpEqual(g) ? "soit "+fmtS(M.length ? tot/M.length : 0)+" chacun" : (B.P[me] ? "ta part : "+fmtS(B.P[me].share) : "parts selon les dépenses"), extra:"", stats:[] });
      var mx=0; M.forEach(function(p){ mx=Math.max(mx, B.P[p].paid, B.P[p].share); }); if(!mx) mx=1;
      h+='<section class="paper cacc" id="grpBal"><div class="cacc-h" style="cursor:default"><span class="t"><span class="tic">⚖️</span> Qui doit combien à qui<small>payé, comparé à la part de chacun</small></span></div>';
      M.forEach(function(p){ var o=B.P[p], dd=o.paid-o.share;
        h+='<div class="cbal-r"><span class="nm">'+esc(grpWho(p))+'</span><div class="cbal-bar"><i style="width:'+Math.max(0, Math.min(100, o.paid/mx*100)).toFixed(1)+'%;background:'+(dd>=-0.5?'var(--accent)':'var(--coral)')+'"></i><u style="left:calc('+Math.min(100, o.share/mx*100).toFixed(1)+'% - 1px)"></u></div>'+
           '<span class="v">'+fmtK(o.paid)+(Math.abs(dd)>0.5?' <span class="'+(dd>0?'cbal-up':'cbal-dn')+'">'+(dd>0?'+':'−')+fmtK(Math.abs(dd))+'</span>':'')+'</span></div>'; });
      h+='<div class="cbal-res">';
      if(!B.T.length) h+='<div class="cbal-tr"><span>✓ Tout est équilibré</span></div>';
      B.T.forEach(function(t, k){ var txt=(t.from===me) ? "Tu dois "+fmtS(t.v)+" à "+t.to : (t.to===me ? t.from+" te doit "+fmtS(t.v) : t.from+" doit "+fmtS(t.v)+" à "+t.to);
        h+='<div class="cbal-tr"><span>'+esc(txt)+'</span>'+(ro?'':'<button type="button" class="cbal-ok gbal-ok" data-k="'+k+'">Remboursé</button>')+'</div>'; });
      h+='</div></section>';
      h+='<section class="paper cacc"><div class="cacc-h" style="cursor:default"><span class="t"><span class="tic">🧾</span> Dépenses · '+grpDeps(g).length+'</span><span class="v">'+fmtK(tot)+'</span></div>';
      grpDeps(g).slice().sort(function(a,b){ return String(b.date||"").localeCompare(String(a.date||"")); }).forEach(function(d){
        h+='<div class="grp-row gdep" data-id="'+esc(d.id)+'"><span class="n">'+esc(d.label)+'<small>'+esc(grpWho(d.payePar)+" · "+csvDate(d.date).slice(0,5)+(d.ticketId!=null?" · ticket":"")+" · ")+(grpPourSome(g, d) ? '<span class="gpour">'+(grpPour(g, d).length===1 ? 'pour '+esc(grpWho(grpPour(g, d)[0])) : 'pour '+grpPour(g, d).length+' personnes')+'</span>' : 'tout le groupe')+'</small></span><b>'+fmtK(d.montant)+'</b></div>'; });
      if(!grpDeps(g).length) h+='<div class="muted" style="font-size:12px;margin:6px 2px">Aucune dépense. Ajoute-en une, ou mets un ticket dans ce groupe depuis sa fiche.</div>';
      if(!ro) h+='<div class="clink" id="gdAdd"><span>＋ Dépense</span><span></span></div>';
      h+='</section><div class="ui-stack" style="margin:4px 0 96px"><button type="button" class="btn" id="gShare">Envoyer le récap</button>'+
         (fyRO() ? '' : '<button type="button" class="btn ghost" id="gMore">⋯ Participants, clore, supprimer</button>')+'</div>';
      app.innerHTML=h; setNav("communes", true);
      bindBack(function(){ state.view="communes"; render(); window.scrollTo(0,0); });
      document.getElementById("gShare").onclick=function(){ grpShare(g); };
      var ad=document.getElementById("gdAdd"); if(ad) ad.onclick=function(){
        var C=[{ l:"📷 Scanner un ticket", fn:function(){ openScanChooser(); } }, { l:"✍️ Saisir un ticket", primary:false, fn:newDraft }];
        if(grpFreeTickets().length) C.push({ l:"🧾 Un ticket déjà enregistré", primary:false, fn:function(){ grpPickTicket(g); } });
        C.push({ l:"Dépense sans ticket", primary:false, fn:function(){ grpDepForm(g, null); } });
        uiChoice("Ajouter au groupe", esc("Un ticket va aussi dans tes dépenses ; une dépense sans ticket reste dans le groupe."), C); };
      [].forEach.call(document.querySelectorAll(".gbal-ok"), function(b){ b.onclick=function(){ var t=B.T[+b.getAttribute("data-k")]; if(!t) return;
        commRembForm(t, monthKey(todayISO()), me, { note:"Groupe « "+g.nom+" »",
          save:function(rec){ (g.rembs||(g.rembs=[])).push(rec); persistGroupes(); },
          undo:function(rec){ g.rembs=(g.rembs||[]).filter(function(x){ return x.id!==rec.id; }); if(rec.vir && rec.vir.length){ virements=virements.filter(function(v){ return rec.vir.indexOf(v.id)<0; }); persistVirements(); } persistGroupes(); render(); } }); }; });
      [].forEach.call(document.querySelectorAll(".gdep"), function(r){ r.onclick=function(){ if(ro) return; var d=grpDeps(g).filter(function(x){ return String(x.id)===r.getAttribute("data-id"); })[0]; if(!d) return;
        var msg=esc("Payé par "+grpWho(d.payePar)+" · "+grpPourTxt(g, d));
        function out(t){ var i=g.dep.indexOf(d); g.dep.splice(i, 1); persistGroupes(); render(); uiUndoToast(t, "Annuler", function(){ g.dep.splice(i, 0, d); persistGroupes(); render(); }); }
        if(d.ticketId!=null){ uiChoice(d.label+" · "+fmtS(d.montant), msg, [{ l:"👥 Pour qui ?", fn:function(){ grpPourSheet(g, d); } }, { l:"🧾 Ouvrir le ticket", primary:false, fn:function(){ editEntry(d.ticketId); } },
          { l:"Retirer du groupe", danger:true, fn:function(){ out("Ticket retiré du groupe (il reste dans tes dépenses)"); } }]); return; }
        uiChoice(d.label+" · "+fmtS(d.montant), msg, [{ l:"👥 Pour qui ?", fn:function(){ grpPourSheet(g, d); } }, { l:"Modifier", primary:false, fn:function(){ grpDepForm(g, d); } }, { l:"Supprimer", danger:true, fn:function(){ out("Dépense supprimée"); } }]); }; });
      var mo=document.getElementById("gMore"); if(mo) mo.onclick=function(){
        uiChoice(g.nom, "", [
          g.clos ? { l:"Rouvrir le groupe", fn:function(){ delete g.clos; persistGroupes(); render(); } } : { l:"Participants", fn:function(){ grpForm(g); } },
          g.clos ? null : { l:"Clore le groupe", primary:false, fn:function(){ g.clos=todayISO(); persistGroupes(); state.view="communes"; render(); uiToast("Groupe clos : il reste dans « groupes clos »"); } },
          { l:"Supprimer le groupe", danger:true, fn:function(){ var i=groupes.indexOf(g); groupes.splice(i, 1); persistGroupes(); state.view="communes"; render();
            uiUndoToast("Groupe supprimé", "Annuler", function(){ groupes.splice(i, 0, g); persistGroupes(); render(); }); } } ].filter(function(x){ return x; }));
      };
    }
    // tickets des 60 derniers jours qui ne sont dans aucun groupe
    function grpFreeTickets(){
      var lim=new Date(Date.parse(todayISO())-60*86400000).toISOString().slice(0,10), used={};
      groupes.forEach(function(g){ (g.dep||[]).forEach(function(d){ if(d.ticketId!=null) used[String(d.ticketId)]=1; }); });
      return state.entries.filter(function(e){ return e.date>=lim && !used[String(e.id)] && fyCanEdit(e); })
        .sort(function(a,b){ return String(b.date).localeCompare(String(a.date)); }).slice(0, 20);
    }
    function grpPickTicket(g){
      var L=grpFreeTickets();
      uiChoice("Mettre un ticket dans « "+g.nom+" »", "", L.map(function(e){ return { l:csvDate(e.date).slice(0,5)+" · "+(e.marchand||"Ticket")+" · "+fmtS(e.montant), primary:false,
        fn:function(){ grpTicketSync(e, g.id); render(); uiUndoToast("Ticket ajouté au groupe", "Annuler", function(){ grpTicketSync(e, null); render(); }); } }; }));
    }
    // Ticket mis dans un groupe (fiche du ticket) : une dépense du groupe, payée par la personne du ticket
    function grpTicketSync(e, gid){
      var ch=false;
      groupes.forEach(function(g){ var L=g.dep||[], i=-1; L.forEach(function(d, k){ if(String(d.ticketId)===String(e.id)) i=k; });
        if(String(g.id)===String(gid)){
          var who=payerOf(e); if((g.membres||[]).indexOf(who)<0) (g.membres||(g.membres=[])).push(who);
          var d={ id:(i>=0 ? L[i].id : virNewId()), ticketId:e.id, date:e.date, label:e.marchand||"Ticket", montant:Number(e.montant)||0, payePar:who }; if(i>=0 && L[i].pour) d.pour=L[i].pour;
          if(i>=0) L[i]=d; else L.push(d); g.dep=L; ch=true;
        } else if(i>=0){ L.splice(i, 1); ch=true; } });
      if(ch) persistGroupes();
    }
    function renderCommunes(){
      if(state.view!=="factures" && state.comSub==="frais"){ state.comSub=null; state.view="factures"; state.avnSub="frais"; return renderFactures(); }
      var avMode=(state.view==="factures");   // À venir › Frais fixes : sa propre page (refonte du 19/11)
      if(avMode) return renderFraisAv();
      var curM = monthKey(todayISO());
      var month = (state.months&&state.months.communes)||curM;
      var monthLabel = monthLabelOf(month);
      var CM=communModel(month), prodShareOf=CM.prodShareOf, monthData=CM.monthData, D=CM.D, me=CM.me, ppl=CM.ppl, CP=CM.CP, persoOf=CM.persoOf, pctOf=CM.pctOf, shareOf=CM.shareOf, partOf=CM.partOf, fPct=CM.fPct, communShareOf=CM.communShareOf, effPct=CM.effPct;
      var COLP="#8a92a6", COLC="#7c9cf4", COLR="#e0a458";
      // bouton « Articles partagés » (en haut à droite de la carte) : les compter ou non dans les parts, les graphiques et les bulles
      var prodOn=state.comProd; if(prodOn==null) prodOn=store.read("comProd", true); prodOn=!!prodOn;
      var prodV=prodOn?D.prod:0;
      function prodPart(p){ return prodOn ? prodShareOf(p) : 0; }
      partOf=function(p){ return persoOf(p)+communShareOf(p)+prodPart(p); };
      effPct=function(p){ var pot=D.commun+prodV; return pot>0 ? (communShareOf(p)+prodPart(p))/pot*100 : pctOf(p); };
      // bandeau des personnes : la personne choisie (Moi par défaut) ou tout le foyer
      var cpv=pvActive() ? pvCur() : "moi", cw=(cpv==="all") ? null : pvName(cpv), cMe=(cw===me);
      function mShort(m){ var pm=m.split("-"); return new Date(+pm[0], +pm[1]-1, 1).toLocaleDateString("fr-FR",{month:"short"}).replace(".",""); }

      // ---- Carte du haut : ta part + 3 graphiques (onglets ou glissé)
      var MODES=[["rep","Répartition"],["postes","Postes"],["6m","Mois"]];
      var cm=state.comChart||store.read("comChartDef","rep"); if(!MODES.some(function(x){ return x[0]===cm; })) cm="rep";
      var chart=chartTabsHTML(MODES, cm, "comChartDef", "rep")+'<div class="cch'+(cm==="rep"?' cch-top':'')+'">';
      if(cm==="rep"){
        // Toi d'abord, puis les plus grosses parts ; par pages de 5 personnes au-delà de 5
        var rp=ppl.filter(function(p){ return p===me || partOf(p)>0.004; }), rRest=rp.filter(function(p){ return p!==me; }).sort(function(a,b){ return partOf(b)-partOf(a); });
        rp=[me].concat(rRest);
        var mx=0; rp.forEach(function(p){ mx=Math.max(mx, partOf(p)); }); if(!mx) mx=1;
        function seg(v,col){ return v>0?'<i style="width:'+(v/mx*100).toFixed(2)+'%;background:'+col+'"></i>':''; }
        function repVals(p){ var a=[[persoOf(p),COLP],[communShareOf(p),COLC],[prodPart(p),COLR]].filter(function(x){ return x[0]>0.004; });
          return a.length?'<div class="crep-v">'+a.map(function(x){ return '<span><i style="background:'+x[1]+'"></i>'+fmtK(x[0])+'</span>'; }).join("")+'</div>':''; }
        function repRow(p){ var pc=effPct(p);
          return '<div class="crep-r" data-p="'+esc(p)+'" style="cursor:pointer;'+(cw && p!==cw?'opacity:.5':'')+'"><div class="crep-h"><span>'+esc(p)+(p===me?' <small>toi</small>':'')+'<small class="pc">'+pctTxt(pc)+'</small></span>'+(p===me?'':'<b>'+fmtK(partOf(p))+'</b>')+'</div><div class="crep-b">'+seg(persoOf(p),COLP)+seg(communShareOf(p),COLC)+seg(prodV*pctOf(p)/100,COLR)+'</div>'+repVals(p)+'</div>'; }
        var rPages=[]; for(var rk=0; rk<rp.length; rk+=5) rPages.push('<div class="crep">'+rp.slice(rk, rk+5).map(repRow).join("")+'</div>');
        chart+='<div class="crep-full">'+(rp.length>5?'<div class="crep-tot">'+rp.length+' personnes · total '+fmtK(D.fraisTot+prodV)+'</div>':'')+pagerHTML("comRep", rPages, { cls:"bleed18" })+'</div>';
        // Petite carte de l'Accueil : toi, les 2 plus grosses parts, puis « + N autres »
        var rOth=rp.slice(3), rOthT=rOth.reduce(function(t,p){ return t+partOf(p); },0);
        chart+='<div class="crep-mini"><div class="crep">'+rp.slice(0,3).map(repRow).join("")+'</div>'+(rOth.length?'<div class="crep-more"><span>+ '+rOth.length+' autre'+(rOth.length>1?'s':'')+'</span><b>'+fmtK(rOthT)+'</b></div>':'')+'</div>';
        chart+='<div class="cch-leg leg1"><span><i style="background:'+COLP+'"></i>Frais perso</span><span><i style="background:'+COLC+'"></i>Frais communs</span><span><i style="background:'+COLR+'"></i>Articles partagés</span></div>';
      } else if(cm==="postes"){
        var DCOL=["#7c9cf4","#5bc0d4","#c78bd6","#e88fb0","#9bd35e","#4fd6a0"], parts=[];
        (D.byP.Commun?D.byP.Commun.items:[]).forEach(function(f){ if(f.pp==null) parts.push({ l:f.label, v:fraisMontant(f, month), k:"frais" }); });
        parts.sort(function(a,b){ return b.v-a.v; }).forEach(function(x,i){ x.col=DCOL[i%DCOL.length]; });
        if(prodV>0) parts.push({ l:"Articles partagés", v:prodV, col:COLR, k:"prod" });
        var tot=D.commun+prodV;
        if(tot>0) chart+='<div class="cdon cdon-big">'+compteDonutSVG(parts, tot).replace("dépensés","en commun")+'<div class="cdon-l">'+parts.map(function(x){ return '<div class="cdon-r" data-k="'+x.k+'"><i class="cdot" style="background:'+x.col+';margin:0"></i><span class="n">'+esc(x.l)+'</span><span class="p">'+Math.round(x.v/tot*100)+' %</span><span class="a">'+cptK(x.v)+'</span></div>'; }).join("")+'</div></div>';
        else chart+='<div class="cch-note" style="margin:30px 0">Rien en commun ce mois-ci.</div>';
      } else {
        // période au choix (sous le graphique) : 6 mois, 12 mois, les 12 mois à venir, ou tout
        var cr=state.comRange||store.read("comRange","6"); if(["6","12","next","all"].indexOf(cr)<0) cr="6";
        var six=[], mk=month, i;
        if(cr==="next"){ for(i=0;i<12;i++){ six.push(mk); mk=nextMonthKey(mk); } }
        else { var nR=(cr==="all"?36:+cr); for(i=0;i<nR;i++){ six.unshift(mk); mk=prevMonthKey(mk); } }
        // chaque mois : frais perso + frais communs + articles partagés (la part de la personne affichée, ou tout le foyer)
        function shareAt(d, m, who){ var t=0; (d.byP.Commun?d.byP.Commun.items:[]).forEach(function(f){ var P=fraisPartsAt(f, m); t+=fraisPartV(f, m)*(P?partsPct(P, who):pctOf(who))/100; }); return t; }
        var rows0=six.map(function(m){ var d=monthData(m);
          if(cw) return { m:m, f:(d.byP[cw]?d.byP[cw].total:0), c:shareAt(d, m, cw), p:(prodOn?CM.prodPartIn(d, cw):0) };
          return { m:m, f:d.fraisTot-d.commun, c:d.commun, p:(prodOn?d.prod:0) }; });
        var S=(cr==="all") ? trimLead(rows0, function(r){ return (r.f+r.c+r.p); }) : rows0, smx=0;   // 6 et 12 mois : toujours 6 ou 12 cases, même avant le début du suivi
        S.forEach(function(r){ smx=Math.max(smx, (r.f+r.c+r.p)); }); if(!smx) smx=1;
        var W=340, H=170+CHB, top=20, bot=22, ph=H-top-bot, slot=W/Math.max(S.length,3), bw=Math.min(30, slot*0.5), g='', maxI=0, onI=-1;
        S.forEach(function(r,j){ if((r.f+r.c+r.p)>(S[maxI].f+S[maxI].c+S[maxI].p)+0.004) maxI=j; if(r.m===month) onI=j; });
        S.forEach(function(r,i){ var cx=slot*i+slot/2, hc=r.c/smx*ph, hp=r.p/smx*ph, hf=r.f/smx*ph, on=r.m===month, y0=top+ph, op=on?1:.5;
          if(hf>0){ g+='<rect x="'+(cx-bw/2).toFixed(1)+'" y="'+(y0-hf).toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+hf.toFixed(1)+'" rx="3" style="fill:'+COLP+';opacity:'+op+'"/>'; if(hc>0||hp>0) y0=y0-hf-2; else y0=y0-hf; }
          if(hc>0) g+='<rect x="'+(cx-bw/2).toFixed(1)+'" y="'+(y0-hc).toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+hc.toFixed(1)+'" rx="3" style="fill:'+COLC+';opacity:'+op+'"/>';
          if(!((r.f+r.c+r.p)>0)) g+='<rect x="'+(cx-bw/2).toFixed(1)+'" y="'+(y0-2).toFixed(1)+'" width="'+bw.toFixed(1)+'" height="2" rx="1" style="fill:var(--line2)"/>';   // mois vide
          if(hp>0) g+='<rect x="'+(cx-bw/2).toFixed(1)+'" y="'+(y0-hc-hp-(hc>0?2:0)).toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+hp.toFixed(1)+'" rx="3" style="fill:'+COLR+';opacity:'+op+'"/>';
          var many=S.length>8, isMax=(i===maxI && !S.slice(0,i).some(function(x){ return (x.f+x.c+x.p)>=smx-0.004; }) && ((r.f+r.c+r.p))>=smx-0.004), stepL=Math.ceil(S.length/12);
          var dense=S.length>12;   // jusqu'à 12 barres : un montant sur chaque barre (4 chiffres, sans espace)
          if((r.f+r.c+r.p)>0 && (!dense || on || (isMax && Math.abs(i-onI)>1))) g+='<text x="'+cx.toFixed(1)+'" y="'+(y0-hc-hp-(hc>0&&hp>0?2:0)-5).toFixed(1)+'" text-anchor="middle" style="fill:'+(on?'var(--ink)':'var(--ink-soft)')+';font-size:'+(many?9:10.5)+'px;font-weight:600;font-family:var(--sans);letter-spacing:-.02em">'+(many?String(Math.round((r.f+r.c+r.p))):cptK((r.f+r.c+r.p)))+'</text>';
          g+='<rect class="barhit" data-m="'+esc(r.m)+'" x="'+(slot*i).toFixed(1)+'" y="0" width="'+slot.toFixed(1)+'" height="'+H+'" style="fill:transparent;cursor:pointer"/>';
          if(on || (i%stepL===0 && Math.abs(i-onI)>=Math.min(stepL,2)) || !many) g+='<text x="'+cx.toFixed(1)+'" y="'+(H-6)+'" text-anchor="middle" style="fill:'+(on?'var(--ink)':'var(--muted)')+';font-size:'+(many?9:10)+'px;font-weight:'+(on?700:400)+';font-family:var(--sans)">'+esc(many?["jan","fév","mar","avr","mai","juin","juil","aoû","sep","oct","nov","déc"][+r.m.slice(5,7)-1]:mShort(r.m))+'</text>'; });
        chart+='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Dépenses communes par mois">'+g+'</svg>';
        chart+='<div class="cch-leg"><span><i style="background:'+COLP+'"></i>Frais perso</span><span><i style="background:'+COLC+'"></i>'+(cw?'Part du commun':'Frais communs')+'</span><span><i style="background:'+COLR+'"></i>Articles partagés</span></div><div class="cch-note">'+(cr!=="next" && rows0.length && !(rows0[0].c+rows0[0].p>0) ? 'Suivi depuis '+esc(monthLabelOf((S.filter(function(r){ return r.c+r.p>0; })[0]||S[S.length-1]).m))+' · ':'')+'Touche une barre pour les frais fixes du mois</div>';
        chart+='<div class="dmode comrange" style="justify-content:center;margin:8px 0 0">'+[["6","6 mois"],["12","12 mois"],["next","12 à venir"],["all","Tout"]].map(function(x){ return '<button type="button" data-r="'+x[0]+'"'+(cr===x[0]?' class="on"':'')+'>'+x[1]+'</button>'; }).join("")+'</div>';
      }
      chart+='</div>';
      var hst=[];
      // Frais fixes de chaque personne : ses frais perso + sa part des frais communs (sans les articles partagés)
      // Les chiffres de la personne de ce téléphone (sur le téléphone de Sylvette : ceux de Sylvette)
      if(cw){
        hst.push({l:"Total frais fixes", v:fmtS(persoOf(cw)+communShareOf(cw)), d:"perso + commun"});
        hst.push({l:"Frais partagés", v:fmtS(prodShareOf(cw)), d:(prodOn?(cMe?"ta part":"sa part"):"non comptés")});
      } else {
        hst.push({l:"Frais fixes", v:fmtS(D.fraisTot), d:"du foyer"});
        hst.push({l:"Frais partagés", v:fmtS(D.prod), d:(prodOn?"produits":"non comptés")});
      }
      hst.push({l:"Total foyer", v:fmtS(D.fraisTot+prodV), d:(prodOn?"fixes + partagés":"frais fixes")});
      var myPc=pctOf(me);
      var cSub=avMode ? "frais" : state.comSub; if(cSub!=="frais" && cSub!=="prod") cSub=null;   // sous-pages : frais fixes (dans À venir), articles partagés
      var h=(avMode ? header(false, "À venir")+avTabsHTML("frais") : header(!!cSub, cSub==="prod"?"Articles partagés":"")+(cSub?'':pvBarHTML()))+'<div class="tabtop">'+monthNavHTML(esc(capFirst(monthLabel)), month, curM)+'</div>';
      var myEff=effPct(me);
      var cwEff=cw?effPct(cw):0;
      chart='<button type="button" class="anfx anfx-corner'+(prodOn?' on':'')+'" id="comProdBtn" aria-pressed="'+prodOn+'">'+(prodOn?'✓':'＋')+' Articles partagés</button>'+chart;
      var comDet=!!(state.comDet!=null ? state.comDet : store.read("comDet", affDet()));
      chart=comDet ? chart+'<button type="button" class="cdet-t" id="comDetT">Masquer le détail ▴</button>' : '<button type="button" class="cdet-t" id="comDetT">Voir le détail ▾</button>';
      // refonte : en haut, les personnes et leur part du commun (touche → régler les parts), puis ta part du mois ; le graphique et les chiffres sous « Voir le détail »
      if(!cSub){ var fyAv=function(p){ var c=personColor(p); return '<span class="fy-p"><i style="background:color-mix(in srgb, '+c+' 22%, var(--card2));color:'+c+';border-color:color-mix(in srgb, '+c+' 55%, transparent)">'+esc((p||"?").charAt(0).toUpperCase())+'</i><b>'+esc(p===me?"Toi":p)+'</b><small>'+esc(pctTxt(effPct(p)))+'</small></span>'; };
        var fyBig=cw ? partOf(cw) : D.fraisTot+prodV;
        h+='<section class="paper fy-top"><button type="button" class="fy-ppl" id="comPartsB" aria-label="Parts du commun">'+ppl.map(fyAv).join("")+'<span class="fy-gear">⚙︎</span></button>'+
          '<div class="fy-part"><span>'+(cw?(cMe?"Ta part ce mois":"Part de "+esc(cw)+" ce mois"):"Commun du foyer ce mois")+'<small>'+(cw?(cwEff>0?"frais perso + "+pctTxt(cwEff)+" du commun"+(prodOn?"":" (sans articles partagés)"):"frais perso seulement"):ppl.length+" personnes")+'</small></span><b>'+esc(fmt(fyBig))+'</b></div>'+
          (comDet ? '<div class="fy-det">'+chart+'</div><div class="hstats">'+hst.map(function(x){ return '<div class="hstat"><span>'+x.l+'</span><b>'+x.v+'</b></div>'; }).join("")+'</div>' : chart)+'</section>';
      }
      if(false) h+=tabHero(cw ? { label:(cMe?"Ta part ce mois ("+esc(me)+")":"Part de "+esc(cw)+" ce mois"), big:partOf(cw), sub:(cwEff>0?"frais perso + "+pctTxt(cwEff)+" du commun"+(prodOn?"":" (sans articles partagés)"):"frais perso seulement (0 % du commun)"), extra:chart, stats:hst }
                              : { label:"Commun du foyer ce mois", big:D.fraisTot+prodV, sub:ppl.length+" personne"+(ppl.length>1?"s":"")+" · frais fixes"+(prodOn?" + articles partagés":""), extra:chart, stats:hst });
      // Ligne « Parts du commun » : résumé, touche pour régler
      var pSum;
      if(!CP) pSum=(ppl.length>1?"Parts égales · "+pctTxt(100/ppl.length)+" chacun":"Toi seul · 100 %")+(ppl.length>2?" · touche pour régler":"");
      else { var nz=ppl.filter(function(p){ return pctOf(p)>0; }).sort(function(a,b){ return pctOf(b)-pctOf(a); }), z=ppl.length-nz.length;
        var eq=nz.length===ppl.length && nz.every(function(p){ return Math.abs(pctOf(p)-pctOf(nz[0]))<0.05; });
        pSum=eq ? "Parts égales · "+pctTxt(pctOf(nz[0]))+" chacun" : nz.slice(0,3).map(function(p){ return p+" "+pctTxt(pctOf(p)); }).join(" · ")+(nz.length>3?" · +"+(nz.length-3)+" autres":"")+(z?" · "+z+" à 0 %":""); }
      var partsRow='<div class="cacc-sec"><div class="cacc-h" id="comParts"><span class="t"><span class="tic">👥</span> Parts du commun<small>'+esc(pSum)+'</small></span><span class="ch">›</span></div></div>';

      // ---- Groupes repliables
      var comOpen = state.comOpen || (state.comOpen={});
      function nb(n, one, many){ return n+" "+(n>1?many:one); }
      function paidCount(items){ return items.filter(function(f){ return fraisDone(f, month); }).length; }
      var G={};
      function grp(key, dot, title, sub, val, body){ G[key]={ title:title, sub:sub, val:val, body:body }; return ""; }
      function gSec(g){ return '<section class="paper cacc"><div class="cacc-h" style="cursor:default;padding-bottom:4px"><span class="t">'+g.title+(g.sub?'<small>'+g.sub+'</small>':'')+'</span><span class="v">'+fmtK(g.val)+'</span></div><div class="dgrp open"><div class="dgb">'+g.body+'</div></div></section>'; }
      function fraisRows(items){
        return items.slice().sort(function(a,b){ return fraisMontant(b,month)-fraisMontant(a,month); }).map(function(f){ var dn=fraisDone(f, month);
          var fpv=f.prov!=null?provById(f.prov):null, fpp=f.pp!=null?provById(f.pp):null;
          var sub=fpp ? "payée par « "+fpp.nom+" » · sort du compte, hors parts" : (fpv?provDest(fpv, f):(f.recurrent?"chaque mois":"ce mois"))+(f.split?" · chacun sa part":"")+(((f.personne||"").trim()||"Commun")==="Commun"?" · ta part "+pctTxt(fPct(f, me))+(fraisPartsAt(f, month)?" ✦":"")+" ("+fmtK(fraisMontant(f, month)*fPct(f, me)/100)+")":"");
          return '<div class="fxrow"><button class="fxdone'+(dn?' on':'')+'" type="button" data-id="'+esc(f.id)+'" aria-label="Payé">'+(dn?'✓':'')+'</button><span class="n">'+esc(f.label)+'<small>'+(fpv?'<span class="fxpill">mise de côté</span>':'')+esc(sub)+'</small></span><span class="a">'+fmtK(fraisMontant(f, month))+'</span><button class="fxmore" type="button" data-id="'+esc(f.id)+'">⋯</button></div>'; }).join("");
      }
      var ci=D.byP.Commun?D.byP.Commun.items:[];
      var g1=grp("commun", COLC, "Frais communs", ci.length?nb(ci.length,"frais","frais")+" · "+paidCount(ci)+" payé"+(paidCount(ci)>1?"s":"")+" sur "+ci.length:"aucun", D.commun,
        ci.length?fraisRows(ci):'<div class="muted" style="font-size:11px;margin:4px 2px">Aucun frais commun. Ajoute un frais fixe et garde « Commun ».</div>');
      var pB='';
      if(!D.rows.length) pB='<div class="muted" style="font-size:11px;margin:4px 2px">Aucun article partagé ce mois-ci. Dans un ticket : Options › Partage.</div>';
      else { D.rows.forEach(function(r){ pB+='<div class="entry ecomp" data-id="'+esc(r.id)+'"><span class="n">'+esc(r.label)+'<small>'+esc((r.marchand||"")+(r.sh?" · avec "+shareLabel(r.sh):""))+'</small></span><span class="d">'+esc((r.date||"").split("-").reverse().slice(0,2).join("/"))+'</span><span class="a">'+fmtK(r.prix)+'</span></div>'; });
        pB+='<div class="dsub" style="margin-top:10px"><span>Ta part</span><span>'+fmtK(prodShareOf(me))+'</span></div>'; }
      var g2=grp("prod", COLR, "Articles partagés", D.rows.length?nb(D.rows.length,"article","articles")+" · ta part "+fmtK(prodShareOf(me)):"aucun", D.prod, pB);
      // Frais perso : un seul groupe dépliable, une sous-partie par personne
      var pW=ppl.filter(function(w){ return D.byP[w] && D.byP[w].items.length; }), gp='';
      if(pW.length===1){ var it1=D.byP[pW[0]].items;
        gp=grp("perso", COLP, "Frais perso · "+esc(pW[0]), nb(it1.length,"frais","frais")+" · "+paidCount(it1)+" payé"+(paidCount(it1)>1?"s":"")+" sur "+it1.length, persoOf(pW[0]), fraisRows(it1)); }
      else if(pW.length>1){ var allIt=[], pBody='', pTot=0;
        pW.forEach(function(w){ var it=D.byP[w].items; allIt=allIt.concat(it); pTot+=persoOf(w);
          pBody+='<div class="dsub"><span>'+esc(w)+(w===me?' · toi':'')+'</span><span>'+fmtK(persoOf(w))+'</span></div>'+fraisRows(it); });
        gp=grp("perso", COLP, "Frais perso · "+pW.length+" personnes", nb(allIt.length,"frais","frais")+" · "+paidCount(allIt)+" payé"+(paidCount(allIt)>1?"s":"")+" sur "+allIt.length, pTot, pBody); }
      // Les frais communs du mois (à voir ; ils se modifient dans À venir › Frais fixes) et une ligne « Articles partagés »
      var fcRows=ci.slice().sort(function(a,b){ return fraisMontant(b,month)-fraisMontant(a,month); }).map(function(f){ var dn=fraisDone(f, month);
        return '<div class="cfx-r avgo"><span class="n">'+(dn?'<span style="color:var(--accent)">✓</span> ':'')+esc(f.label)+(f.pp!=null?'<small>payée par la provision · hors parts</small>':(f.split?'<small>chacun sa part</small>':''))+'</span><span class="a">'+fmtK(fraisMontant(f, month))+'</span></div>'; }).join("");
      // Frais communs et Articles partagés : deux sections qui se replient de la même façon en touchant leur titre (choix gardé) ;
      // dépliées, chacune montre son contenu et un lien vers sa page
      var fcOpen=store.read("comFcOpen", true)!==false, ppOpen=store.read("comPpOpen", affDet())===true;
      function fold(k, open, tic, title, sub, val, body){ return '<div class="cacc-sec cfx-sec'+(open?' open':'')+'" data-k="'+k+'"><div class="cacc-h cfx-h" role="button" aria-expanded="'+open+'"><span class="t"><span class="tic">'+tic+'</span> '+title+'<small>'+sub+'</small></span><span class="v">'+val+'</span><span class="ch">›</span></div><div class="cfx-b">'+body+'</div></div>'; }
      var rowsMain=fold("fc", fcOpen, "🏠", "Frais communs · "+ci.length, ci.length?paidCount(ci)+"/"+ci.length+" payé"+(paidCount(ci)>1?"s":""):"aucun ce mois-ci", fmtK(D.commun),
          fcRows+'<div class="clink avgo cfx-go"><span>'+(ci.length?'Modifier dans À venir › Frais fixes':'Ajouter dans À venir › Frais fixes')+'</span><span>›</span></div>')+
        fold("pp", ppOpen, "🛒", "Articles partagés", G.prod.sub, fmtK(G.prod.val), G.prod.body);
      var subBody=cSub==="frais" ? gSec(G.commun)+(G.perso?gSec(G.perso):'') : (cSub==="prod" ? gSec(G.prod) : '');
      var skM=(state.months&&state.months.communes)||monthKey(todayISO()), skL=(cSub==="frais") ? fraisCommuns.filter(function(f){ return f.skipMonths && f.skipMonths[skM]; }) : [];
      if(skL.length) subBody+='<section class="paper cacc" style="padding:6px 14px 8px"><div class="muted" style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;margin:6px 2px 2px">Retirés de '+esc(monthLabelOf(skM))+'</div>'+
        skL.map(function(f){ return '<div style="display:flex;align-items:center;gap:8px;padding:8px 2px;border-top:1px solid var(--line)"><span style="flex:1;min-width:0;color:var(--ink-soft);text-decoration:line-through;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(f.label)+'</span><button class="btn ghost fxunskip" type="button" data-id="'+esc(f.id)+'" style="padding:6px 10px;font-size:12px;flex:0 0 auto">↺ Rétablir</button></div>'; }).join("")+'</section>';
      if(cSub){ h+=subBody; if(cSub!=="prod") h+='<section class="paper cacc"><div class="clink" id="addfrais" style="margin:10px 2px"><span>+ Ajouter un frais fixe</span><span></span></div></section>'; }
      else {
        h+=commBalHTML(month)+'<section class="paper cacc">'+rowsMain+'</section>'+grpSectionHTML();
      }

      app.innerHTML=h;
      if(cSub && !avMode) bindBack(function(){ state.comSub=null; render(); window.scrollTo(0,0); });
      if(avMode) wireAvTabs();
      [].forEach.call(document.querySelectorAll(".comGo"), function(r){ r.onclick=function(){ state.comSub=r.getAttribute("data-sub"); render(); window.scrollTo(0,0); }; });
      [].forEach.call(document.querySelectorAll(".avgo"), function(r){ r.onclick=function(){ state.view="factures"; state.avnSub="frais"; render(); window.scrollTo(0,0); }; });
      // replier / déplier : la page est redessinée pour que la carte du haut reprenne la place libérée (fitHero)
      [].forEach.call(document.querySelectorAll(".cfx-h"), function(hd){ hd.onclick=function(){ var g=hd.parentNode, op=!g.classList.contains("open"); store.write(g.getAttribute("data-k")==="pp"?"comPpOpen":"comFcOpen", op); render(); }; });
      wireChartDefaults();
      [].forEach.call(document.querySelectorAll(".cch-tabs button"), function(bt){ bt.onclick=function(){ state.comChart=bt.getAttribute("data-m"); store.write("comChart", state.comChart); render(); }; });
      var cOn=document.querySelector(".cch-tabs button.on"); if(cOn && cOn.parentNode){ var tb=cOn.parentNode; tb.scrollLeft=Math.max(0, cOn.offsetLeft-(tb.clientWidth-cOn.offsetWidth)/2); }
      var af=document.getElementById("addfrais"); if(af) af.onclick=addFraisCommun;
      [].forEach.call(document.querySelectorAll(".fxunskip"), function(b){ b.onclick=function(){ var f=fraisCommuns.filter(function(x){ return String(x.id)===b.getAttribute("data-id"); })[0]; if(!f || !f.skipMonths) return;
        if(!fyFraisCanEdit(f)){ uiToast("Frais d'un autre compte : en consultation seulement"); return; } delete f.skipMonths[skM]; if(!Object.keys(f.skipMonths).length) delete f.skipMonths;
        var fpv=f.prov!=null && provById(f.prov); if(fpv && fpv.skips){ fpv.skips=fpv.skips.filter(function(x){ return x!==skM; }); persistProvisions(); }
        persistFrais(); render(); }; });
      // graphiques touchables : une personne → la choisir en haut ; un poste → sa page ; une colonne → ce mois
      if(!cSub){
        [].forEach.call(document.querySelectorAll(".thero .crep-full .crep-r[data-p]"), function(r){ r.addEventListener("click", function(){ var p=r.getAttribute("data-p"); state.personView=(p===me?"moi":p); store.write("personView", state.personView); render(); }); });
        [].forEach.call(document.querySelectorAll(".thero .dseg, .thero .cdon-r[data-k]"), function(b){ b.style.cursor="pointer"; b.addEventListener("click", function(){ state.comSub=b.getAttribute("data-k")==="prod"?"prod":"frais"; render(); window.scrollTo(0,0); }); });
        [].forEach.call(document.querySelectorAll(".thero .barhit"), function(b){ b.addEventListener("click", function(){ var m=b.getAttribute("data-m"); if(!state.months) state.months={}; state.months.communes=(m===curM?null:m); state.comSub="frais"; render(); window.scrollTo(0,0); }); });   // une barre → les frais fixes de ce mois (passés ou à venir)
      }
      [].forEach.call(document.querySelectorAll(".comrange button"), function(b){ b.onclick=function(ev){ ev.stopPropagation(); state.comRange=b.getAttribute("data-r"); store.write("comRange", state.comRange); render(); }; });
      var cpbt=document.getElementById("comProdBtn"); if(cpbt) cpbt.onclick=function(ev){ ev.stopPropagation(); state.comProd=!prodOn; store.write("comProd", state.comProd); render(); };
      var cpbB=document.getElementById("comPartsB"); if(cpbB) cpbB.onclick=function(){ openCommunParts({ ppl:ppl, me:me, pct:pctOf, perso:persoOf, pot:D.commun+D.prod }); };
      var cpb=document.getElementById("comParts"); if(cpb) cpb.onclick=function(){ openCommunParts({ ppl:ppl, me:me, pct:pctOf, perso:persoOf, pot:D.commun+D.prod }); };
      [].forEach.call(document.querySelectorAll(".fxdone"), function(b){ b.onclick=function(){ toggleFraisDone(b.getAttribute("data-id"), month); }; });
      [].forEach.call(document.querySelectorAll(".fxmore"), function(b){ b.onclick=function(){ var id=b.getAttribute("data-id"), f=fraisCommuns.filter(function(x){ return String(x.id)===String(id); })[0]; if(!f) return;
        uiChoice(f.label, "", [ { l:"Modifier", fn:function(){ editFraisCommun(id); } }, { l:"Supprimer", danger:true, fn:function(){ delFraisCommun(id); } } ]); }; });
      [].forEach.call(document.querySelectorAll(".entry"), function(node){ node.onclick=function(){ editEntry(node.getAttribute("data-id")); }; });
      wireMonthNav(month, curM, "communes");
      if(!cSub && !avMode){ commBalWire(month); grpWire(); }
      var cdt=document.getElementById("comDetT"); if(cdt) cdt.onclick=function(ev){ ev.stopPropagation(); var v=!(state.comDet!=null ? state.comDet : store.read("comDet", affDet())); state.comDet=v; store.write("comDet", v); render(); };
      if(!cSub) wireComSwipe(cm, MODES.map(function(x){ return x[0]; }));
      setNav(avMode ? "factures" : "communes", true);
    }

