    // ---------- Partage d'un ticket : « Partagé avec » (entry.share = {prénom: %} ; absent = tout le foyer, selon les parts du commun) ----------
    function shareCands(d){ var L=uniquePersons().slice(), me=mePerson(); if(L.indexOf(me)<0) L.unshift(me);
      if(d && d.share) Object.keys(d.share).forEach(function(p){ if(L.indexOf(p)<0) L.push(p); });
      return L.filter(function(p){ return p && p!=="Commun"; }); }
    function shareWho(p){ return p===mePerson() ? "Toi" : p; }
    function shareLabel(sh){ if(!sh) return "Tout le foyer"; var L=Object.keys(sh).filter(function(p){ return (Number(sh[p])||0)>0; }); return L.length ? L.map(shareWho).join(", ") : "Tout le foyer"; }
    function shareSub(sh, cands){
      if(!sh) return "selon les parts du commun (Commun › Parts)";
      var L=Object.keys(sh).filter(function(p){ return (Number(sh[p])||0)>0; }), eq=L.every(function(p){ return Math.abs(partsPct(sh, p)-partsPct(sh, L[0]))<0.05; });
      var t=eq ? "parts égales · "+pctTxt(100/L.length)+" chacun" : L.map(function(p){ return shareWho(p)+" "+pctTxt(partsPct(sh, p)); }).join(" · ");
      var out=(cands||[]).filter(function(p){ return L.indexOf(p)<0; }).map(shareWho);
      if(out.length) t+=" · "+(out.length<=2 ? out.join(" et ") : out.length+" personnes")+" ne paie"+(out.length>1?"nt":"")+" rien";
      return t;
    }
    // état du partage d'un ticket : personne (pas d'article partagé), commun du foyer, ou certaines personnes
    function shareState(d){
      var A=d.articles||[], n=A.filter(function(a){ return a.commun; }).length, who=payerOf(d);
      if(!n) return { mode:"seul", short:"pas partagé", long:"Non" };
      var part=n<A.length ? n+" article"+(n>1?"s":"")+" · " : "", w=d.share ? shareLabel(d.share) : "commun du foyer";
      return { mode:d.share ? "pick" : "all", short:"partagé : "+part+w, long:part+(d.share ? w : "Commun du foyer") };
    }
    function shareSheet(){
      var d=state.draft, C=shareCands(d), st=shareState(d), mode=st.mode, sel={}, pc={}, who=payerOf(d);
      if(d.share) C.forEach(function(p){ var v=Number(d.share[p])||0; if(v>0){ sel[p]=1; pc[p]=v; } });
      else C.forEach(function(p){ sel[p]=1; });
      function eqAll(){ var L=C.filter(function(p){ return sel[p]; }); pc={}; L.forEach(function(p){ pc[p]=Math.round(10000/L.length)/100; }); }
      if(!d.share) eqAll();
      var tot=0, prix=0; (d.articles||[]).forEach(function(a){ if(a.commun) prix+=num(a.prix)||0; });
      var A0=d.articles||[], nCom=A0.filter(function(a){ return a.commun; }).length, partial=nCom>0 && nCom<A0.length, what=partial ? "some" : "all", pickA={};
      A0.forEach(function(a, i){ if(!partial || a.commun) pickA[i]=1; });
      function artP(a){ var v=num(a.prix)||0; return a.produit==="Remise" ? -Math.abs(v) : v; }
      function selPrix(){ if(!A0.length) return num(d.montant)||0; var t=0; A0.forEach(function(a, i){ if(what==="all" || pickA[i]) t+=artP(a); }); return Math.round(t*100)/100; }
      prix=selPrix();
      var s=uiSheet('<div class="sheet-title">Qui paie ce ticket ?</div><div class="ui-intro">'+esc(fmtS(num(d.montant)||0)+" · payé par "+(who ? shareWho(who) : "—")+(d.pay==="esp" ? " · en espèces" : ""))+'</div><div id="shMode">'+
        [["seul", who ? "Seulement "+(who===mePerson() ? "toi" : who) : "La personne qui a payé", "pas partagé : c'est sa dépense"], ["all", "Le commun du foyer", "chacun selon sa part (Commun › Parts)"], ["pick", "Certaines personnes", "à parts égales, ou ajustées"]].map(function(x){
          return '<button type="button" class="sh-m" data-m="'+x[0]+'"><span class="rd"></span><span><b>'+esc(x[1])+'</b><small>'+esc(x[2])+'</small></span></button>'; }).join("")+'</div><div id="shBody"></div><div id="shWhat"></div>'+
        '<div class="ui-err" style="display:none"></div>'+
        '<div class="ui-stack"><button type="button" class="btn primary" id="shOk">Valider</button><button type="button" class="btn ghost ui-no">Annuler</button></div>');
      function paint(){
        [].forEach.call(s.qa("#shMode button"), function(b){ b.classList.toggle("on", b.getAttribute("data-m")===mode); });
        prix=selPrix();
        var wt='';   // quoi : tout le ticket ou certains articles (18/11, à la place de la case sous chaque article)
        if(mode!=="seul" && A0.length>=2){
          wt='<div class="sh-wt">Quoi ?</div><div class="pay-seg"><button type="button" data-w="all"'+(what==="all"?' class="on"':'')+'>Tout le ticket</button><button type="button" data-w="some"'+(what==="some"?' class="on"':'')+'>Certains articles</button></div>';
          if(what==="some") wt+='<div class="sh-arts">'+A0.map(function(a, i){ return '<label class="sh-a'+(pickA[i]?'':' off')+'"><input type="checkbox" class="sh-ac" data-i="'+i+'"'+(pickA[i]?' checked':'')+'><span class="nm">'+esc(artName(a))+'</span><span class="eur">'+esc(fmtK(artP(a)))+'</span></label>'; }).join("")+'</div>'+
            '<div class="sh-tot">Partagé : <b>'+esc(fmtK(prix))+'</b> sur '+esc(fmtK(num(d.montant)||0))+'</div>';
        }
        s.q("#shWhat").innerHTML=wt;
        [].forEach.call(s.qa("#shWhat .pay-seg button"), function(b){ b.onclick=function(){ what=b.getAttribute("data-w"); paint(); }; });
        [].forEach.call(s.qa(".sh-ac"), function(cb){ cb.onchange=function(){ var i=+cb.getAttribute("data-i"); if(cb.checked) pickA[i]=1; else delete pickA[i]; paint(); }; });
        var h='';
        if(mode!=="pick") h='';
        else { tot=0; C.forEach(function(p){ if(sel[p]) tot+=Number(pc[p])||0; });
          C.forEach(function(p){ var on=!!sel[p], v=on ? (Number(pc[p])||0) : 0;
            h+='<div class="sh-r'+(on?'':' off')+'" data-p="'+esc(p)+'"><input type="checkbox" class="sh-c"'+(on?' checked':'')+'><span class="nm">'+esc(shareWho(p))+'</span>'+
               (on ? '<input class="sh-p" inputmode="decimal" value="'+esc(String(Math.round(v*100)/100).replace(".", ","))+'"><span class="eur">'+(prix ? fmtS(prix*v/100) : '')+'</span>' : '<span></span><span></span>')+'</div>'; });
          h+='<div class="muted" style="font-size:11.5px;margin:6px 2px">'+(Math.abs(tot-100)<0.05 ? 'Total 100 %' : 'Total '+pctTxt(tot)+' : il faut 100 %')+' · cocher ou décocher remet des parts égales</div>'; }
        s.q("#shBody").innerHTML=h;
        [].forEach.call(s.qa(".sh-c"), function(cb){ cb.onchange=function(){ var p=cb.parentNode.getAttribute("data-p"); if(cb.checked) sel[p]=1; else delete sel[p]; eqAll(); paint(); }; });
        [].forEach.call(s.qa(".sh-p"), function(inp){ inp.onchange=function(){ var p=inp.parentNode.getAttribute("data-p"), v=num(inp.value); pc[p]=(isNaN(v)||v===null) ? 0 : Math.max(0, Math.min(100, v)); paint(); }; });
      }
      [].forEach.call(s.qa("#shMode button"), function(b){ b.onclick=function(){ mode=b.getAttribute("data-m"); paint(); }; });
      s.q(".ui-no").onclick=s.close;
      s.q("#shOk").onclick=function(){
        var er0=s.q(".ui-err");
        function comAll(){ var mt=num(d.montant); if(!(d.articles||[]).length){ if(mt>0) d.articles=[{ label:"Divers", prix:String(d.montant), produit:"", commun:true }]; return; }
          d.articles.forEach(function(a, i){ a.commun=(what==="all" || !!pickA[i]); }); }
        if(mode==="seul"){ d.share=null; (d.articles||[]).forEach(function(a){ a.commun=false; }); s.close(); render(); return; }
        if(what==="some" && A0.length>=2 && !A0.some(function(a, i){ return pickA[i]; })){ er0.textContent="Coche au moins un article."; er0.style.display=""; return; }
        if(mode==="all"){ d.share=null; comAll(); s.close(); render(); return; }
        var L=C.filter(function(p){ return sel[p] && (Number(pc[p])||0)>0; }), t=0; L.forEach(function(p){ t+=Number(pc[p])||0; });
        var er=s.q(".ui-err");
        if(!L.length){ er.textContent="Coche au moins une personne."; er.style.display=""; return; }
        if(Math.abs(t-100)>=0.05){ er.textContent="Le total doit faire 100 % (il fait "+pctTxt(t)+")."; er.style.display=""; return; }
        var o={}; L.forEach(function(p){ o[p]=Number(pc[p]); }); d.share=o; comAll();
        s.close(); render(); };
      paint();
    }
    function renderForm(){
      var d = state.draft;
      var h = header("list", "Ticket").replace('</header>', '<button type="button" class="hgear" id="fMore" aria-label="Plus">⋯</button></header>') + '<section class="paper">';
      if(state.note){ h += '<div class="center" style="font-size:11px;color:var(--accent);margin-bottom:8px">'+esc(state.note)+(state.ocrRaw && !state.busy ? ' · <button type="button" class="ocr-raw" id="ocrRawBtn">Copier la lecture</button>' : '')+'</div>'; }
      if(state.busy){
        h += '<div class="scanbox"><span id="scanmsg">'+esc(state.scanMsg||"Lecture du ticket en cours…")+'</span>'+
               '<div class="progress"><i id="bar" style="width:'+state.prog+'%"></i></div>'+
               '<div class="muted" style="font-size:11px;margin-top:8px">Tu peux déjà corriger les champs ci-dessous.</div></div>';
      }
      h += '<label class="f" for="f-montant">Montant ('+curSym()+')</label><div class="f-mrow">'+
           (d.photo ? '<button type="button" class="f-thumb" id="photoview" aria-label="Voir la photo du ticket"><img src="'+d.photo+'" alt=""></button>' : (state.draftRO ? '' : '<button type="button" class="f-thumb f-noph" id="photoadd" aria-label="Ajouter une photo">📷</button>'))+
           '<input class="f" id="f-montant" inputmode="decimal" value="'+esc(d.montant)+'" placeholder="0,00"></div><div id="artchk"></div><div id="srcchk"></div><div id="bankchk"></div>';
      h += '<label class="f">Enseigne</label><input class="f" id="f-marchand" value="'+esc(d.marchand)+'" placeholder="Nom du magasin">';
      var fyLim=fyMember() && fyCfg.accts!=null;   // foyer, accès limité à ses comptes : seulement leurs titulaires
      var payers=fyLim ? fyPayers() : uniquePersons(); if(d.payePar && d.payePar!=="Commun" && payers.indexOf(d.payePar)<0) payers.push(d.payePar);
      h += '<div class="f-two"><div><label class="f">Date</label><input class="f" id="f-date" type="date" value="'+esc(d.date)+'"></div>'+
           '<div><label class="f" for="f-payer">Payé par</label><select class="f" id="f-payer">'+(fyLim ? '' : '<option value=""'+(!(d.payePar||"")?' selected':'')+'>—</option>')+
           payers.map(function(p){ return '<option value="'+esc(p)+'"'+(d.payePar===p?' selected':'')+'>'+esc(p)+'</option>'; }).join("")+(fyLim ? '' : '<option value="__new">+ Autre…</option>')+'</select></div></div>';
      h += tkPayHTML(d);   // payé avec : compte ou espèces (18/11)
      if(persoOn() && !state.draftRO){ var pc=persoSendOk();
        h += pc ? '<label class="f-sendfy"><input type="checkbox" id="f-tofy"'+(d.toFoyer?' checked':'')+'><span>Envoyer aussi au foyer de '+esc(persoOwner())+'<small>'+(d.foyerId?'déjà envoyé · décocher le retire du foyer':'il part à ton retour dans le foyer')+'</small></span></label>'
                : '<div class="muted" style="font-size:11px;margin:8px 2px 0">Le foyer de '+esc(persoOwner())+' est en lecture pour tes tickets : tu ne peux pas y envoyer ce ticket.</div>'; }
      // catégories en arbre : les grandes catégories en tuiles (toujours toutes), puis les sous-catégories de celle choisie (facultatives)
      var cMain=d.categorie ? catMain(d.categorie) : "", cSubs=cMain ? catSubs(cMain) : [];
      h += '<label class="f">Catégorie'+(d.categorie?' <span class="cat-sel">· '+esc(catLabel(d.categorie))+'</span>':' <span class="cat-need">· à choisir pour enregistrer</span>')+'</label><div class="chips cattiles cat5" id="chips">';
      catMains().forEach(function(c){ var ic=catIcon(c); h += '<button class="chip'+(cMain===c?" on":"")+'" data-cat="'+esc(c)+'" style="--cc:'+ic.col+'"><span class="ce">'+ic.e+'</span><span>'+esc(c)+'</span></button>'; });
      h += '</div>';
      if(cMain && (cSubs.length || !(state.draftRO || (fyMember() && !fyTabEd("articles"))))){ var mc=catIcon(cMain).col;
        h += '<div class="catsubs" style="--cc:'+mc+'"><span class="cs-t">Préciser dans '+esc(cMain)+' <i>· facultatif</i></span><div class="cs-l">'+
          cSubs.map(function(c){ return '<button type="button" class="cs'+(d.categorie===c?' on':'')+'" data-sub="'+esc(c)+'">'+esc(c)+'</button>'; }).join("")+
          ((state.draftRO || (fyMember() && !fyTabEd("articles")))?'':'<button type="button" class="cs add" id="catSubNew">＋ Nouvelle</button>')+'</div></div>'; }
      // Options repliées : compte, groupe, partage
      var gOpen=canUse("groupes") ? groupes.filter(function(g){ return !g.clos; }) : [], gCur=d.groupe ? grpById(d.groupe) : null;
      var shC=shareCands(d), autoA=payAcctOf(payerOf(d)) || (comptes.filter(function(a){ return a.main; })[0]||null);
      var pEsp=d.pay==="esp", cTxt=pEsp ? "" : (d.compte && acctByKey(d.compte) ? acctByKey(d.compte).nom : "compte auto");   // en espèces : pas de compte à choisir
      var oSum=[comptes.length>1 && !pEsp ? cTxt : "", (gOpen.length || gCur) ? (gCur ? "groupe « "+gCur.nom+" »" : "sans groupe") : "", shC.length>1 ? shareState(d).short : ""].filter(function(x){ return x; });
      var optOn=(state.optOpen!=null ? state.optOpen : affDet());
      if(oSum.length){
        h += '<div class="f-opt'+(optOn?' open':'')+'"><button type="button" class="f-opth" id="fopt"><span><b>Options</b>'+(optOn ? '' : '<small>'+esc(oSum.join(" · "))+'</small>')+'</span><span class="ch">'+(optOn?'⌄':'›')+'</span></button>';
        if(optOn){
          if(comptes.length>1 && !pEsp) h += '<div class="f-ol"><span>Compte</span><select id="f-acct"'+(state.draftRO?' disabled':'')+'><option value="">Auto'+(autoA ? ' · '+esc(autoA.nom) : '')+'</option>'+
            comptes.filter(function(a){ return a.key!=="__tickets"; }).map(function(a){ return '<option value="'+esc(a.key)+'"'+(d.compte===a.key?' selected':'')+'>'+esc(a.nom)+'</option>'; }).join("")+'</select></div>';
          if((gOpen.length || gCur) && !state.draftRO) h += '<div class="f-ol"><span>Groupe</span><select id="f-grp"><option value="">Aucun</option>'+
            gOpen.concat(gCur && gCur.clos ? [gCur] : []).map(function(g){ return '<option value="'+esc(g.id)+'"'+(String(d.groupe)===String(g.id)?' selected':'')+'>'+esc(g.nom)+'</option>'; }).join("")+'</select></div>';
          if(shC.length>1) h += '<button type="button" class="f-ol" id="fshare"'+(state.draftRO?' disabled':'')+'><span>Partage</span><b>'+esc(shareState(d).long)+' ›</b></button>';
          if(shC.length>1 && d.share && shareState(d).mode==="pick") h += '<div class="muted f-osub">'+esc(shareSub(d.share, shC))+'</div>';
        }
        h += '</div>';
      }
      h += '<div class="f-arth" id="artshead"><label class="f">Articles</label><span id="artsum"></span></div><div id="arts">';
      (d.articles||[]).forEach(function(a){ h += artRow(a, d); });
      // aucun article : dire avant l'enregistrement ce qui sera créé (08/11, accordé par Benoît)
      if(!state.draftRO && !(d.articles||[]).length){
        var mt0=num(d.montant);
        h += '<div class="art-none" id="artnone"><b>Aucun article</b><span>Il sera enregistré comme 1 article : <i>'+esc((d.categorie ? catLabel(d.categorie) : "catégorie")+" · ticket entier")+'</i>'+(mt0 ? ' ('+esc(fmtK(mt0))+')' : '')+'.</span>'+
          '<button type="button" class="art-none-b" id="artnoneadd">＋ Ajouter les articles</button></div>';
      }
      h += '</div><div class="f-artadd"><button class="btn ghost" id="addart" type="button">＋ Article</button>'+
           '<button class="btn ghost" id="addremise" type="button">＋ Remise</button></div>';
      h += '<div class="btns f-bar"><button class="btn ghost" id="cancel" type="button">Annuler</button>'+
           '<button class="btn primary" id="save" type="button">Enregistrer</button></div></section>';
      app.innerHTML = h;
      setNav(null, false);
      bindBack(function(){ state.view=formBackView(); state.draft=null; render(); });

      document.getElementById("cancel").onclick=function(){ state.view=formBackView(); state.draft=null; render(); };
      document.getElementById("fMore").onclick=function(){ readForm(); var C=[];
        if(!state.draftRO) C.push({ l:state.draft.photo ? "📷 Changer la photo" : "📷 Ajouter une photo", primary:false, fn:function(){ var pi=document.getElementById("photoin"); if(pi) pi.click(); } });
        if(state.ocrRaw) C.push({ l:"📋 Copier la lecture", primary:false, fn:ocrRawSheet });
        if(state.ocrRaw && state.draft.scan) C.push({ l:"💬 Signaler une lecture", primary:false, fn:tkReportSheet });
        if(state.draft.id && !state.draftRO) C.push({ l:"🗑️ Supprimer", danger:true, fn:delDraft });
        if(!C.length){ uiToast("Rien à faire sur ce ticket"); return; }
        uiChoice("Ticket", "", C); };
      var fop=document.getElementById("fopt"); if(fop) fop.onclick=function(){ readForm(); state.optOpen=!(state.optOpen!=null ? state.optOpen : affDet()); render(); };
      var cmo=document.getElementById("catMore"); if(cmo) cmo.onclick=function(){ readForm(); state.catAll=true; render(); };
      var fac=document.getElementById("f-acct"); if(fac) fac.onchange=function(){ state.draft.compte=fac.value||""; if(state.draft.pay==="esp"){ readForm(); render(); } };   // espèces : le liquide suit le compte choisi
      var fgr=document.getElementById("f-grp"); if(fgr) fgr.onchange=function(){ state.draft.groupe=fgr.value||null; };
      document.getElementById("save").onclick=function(){ saveDraft(); };
      artChkPaint(); tkBankPaint(); tkPayWire();
      var fmi=document.getElementById("f-montant"); if(fmi){ fmi.addEventListener("input", artChkPaint); fmi.addEventListener("input", tkLiqPaint); fmi.addEventListener("change", tkBankPaint); }
      ["f-marchand","f-date"].forEach(function(id){ var x=document.getElementById(id); if(x) x.addEventListener("change", tkBankPaint); });
      var fdt=document.getElementById("f-date"); if(fdt) fdt.addEventListener("change", tkLiqPaint);
      var artsBox=document.getElementById("arts");
      if(artsBox) artsBox.addEventListener("input", function(ev){ var t=ev.target; if(t && t.classList && (t.classList.contains("art-prix") || t.classList.contains("art-prod"))) artChkPaint(); });
      // article lu mais pas reconnu : toucher une suggestion lui donne ce nom
      [].forEach.call(document.querySelectorAll("#arts .art-sugb"), function(b){ b.onclick=function(){ var node=b.parentNode.parentNode, all=[].slice.call(document.querySelectorAll("#arts .art")), i=all.indexOf(node);
        readForm(); if(state.draft.articles[i]){ state.draft.articles[i].produit=b.getAttribute("data-v"); state.draft.articles[i].auto=false; } render(); }; });
      var pv=document.getElementById("photoview"); if(pv) pv.onclick=function(){ readForm();
        var ro=state.draftRO, s=uiSheet('<div class="sheet-title">Photo du ticket</div><img src="'+state.draft.photo+'" alt="Photo du ticket" style="max-width:100%;max-height:70vh;display:block;margin:0 auto 12px;border-radius:12px;border:1px solid var(--line)">'+
          '<div class="ui-stack">'+(ro?'':'<button type="button" class="btn ghost" id="pvchg">Changer la photo</button><button type="button" class="btn ghost" id="pvdel">Supprimer la photo</button>')+'<button type="button" class="btn primary ui-no">Fermer</button></div>');
        s.q(".ui-no").onclick=s.close;
        var a=s.q("#pvchg"); if(a) a.onclick=function(){ s.close(); var pi=document.getElementById("photoin"); if(pi) pi.click(); };
        var b2=s.q("#pvdel"); if(b2) b2.onclick=function(){ s.close(); state.draft.photo=""; state.draft.photoFiles=null; render(); };
        // la photo d'origine remplace la petite dès qu'elle est lue
        var pim=s.q("img"), pf=state.draft.photoFiles;
        (pf && pf[0] ? Promise.resolve({ b:pf }) : (state.draft.id ? origGet(state.draft.id) : Promise.resolve(null))).then(function(o){ if(o && o.b && o.b[0] && pim){ try{ pim.src=URL.createObjectURL(o.b[0]); }catch(e){} } });
      };
      var photoadd=document.getElementById("photoadd"); if(photoadd) photoadd.onclick=function(){ readForm(); var pi=document.getElementById("photoin"); if(pi) pi.click(); };
      var photochg=document.getElementById("photochg"); if(photochg) photochg.onclick=function(){ readForm(); var pi=document.getElementById("photoin"); if(pi) pi.click(); };
      var photodel=document.getElementById("photodel"); if(photodel) photodel.onclick=function(){ readForm(); state.draft.photo=""; state.draft.photoFiles=null; render(); };
      document.getElementById("addart").onclick=function(){ readForm(); state.draft.articles.push({label:"",prix:"",produit:""}); render(); };
      var anb=document.getElementById("artnoneadd"); if(anb) anb.onclick=function(){ document.getElementById("addart").click(); };
      var fsh=document.getElementById("fshare"); if(fsh) fsh.onclick=function(){ readForm(); shareSheet(); };

      var orb=document.getElementById("ocrRawBtn"); if(orb) orb.onclick=ocrRawSheet;
      var addr=document.getElementById("addremise"); if(addr) addr.onclick=function(){ readForm(); state.draft.articles.push({label:"Remise",prix:"",produit:"Remise"}); render(); };
      [].forEach.call(document.querySelectorAll("#chips .chip[data-cat]"), function(btn){
        btn.onclick=function(){ var c=btn.getAttribute("data-cat"); readForm();
          if(!state.draft.categorie || catMain(state.draft.categorie)!==c) state.draft.categorie=c;   // retoucher la même grande catégorie garde la sous-catégorie
          render(); };
      });
      [].forEach.call(document.querySelectorAll(".catsubs .cs[data-sub]"), function(btn){
        btn.onclick=function(){ var c=btn.getAttribute("data-sub"); readForm(); state.draft.categorie=(state.draft.categorie===c) ? catMain(c) : c; render(); };
      });
      var csn=document.getElementById("catSubNew"); if(csn) csn.onclick=function(){ readForm(); var m=catMain(state.draft.categorie);
        var nm=(window.prompt("Nouvelle sous-catégorie dans « "+m+" » :")||"").trim(); if(!nm) return;
        if(CATS.indexOf(nm)>=0){ if(catMain(nm)!==m){ window.alert("« "+nm+" » existe déjà dans "+catMain(nm)+"."); return; } }
        else if(catNameBad(nm)) return;
        else { CATS.push(nm); if(!CAT_PARENT) CAT_PARENT={}; CAT_PARENT[nm]=m; persistCats(); persistCatParent(); famSync(true); }
        state.draft.categorie=nm; render(); };
      var fpy=document.getElementById("f-payer"); if(fpy) fpy.onchange=function(){
        var v=fpy.value;
        if(v==="__new"){ var nm=(window.prompt("Payé par qui ?")||"").trim(); readForm(); state.draft.payePar=nm; render(); return; }
        readForm(); state.draft.payePar=v; var who=payerOf(state.draft), ch=false;
        (state.draft.articles||[]).forEach(function(a){ if(a.produit && !a.auto) return; var pr=lookupAppris(a.label, who); if(pr!==(a.produit||"")){ a.produit=pr; a.auto=!!pr; ch=true; } });
        render();   // le compte « Auto », le partage « X seule » suivent la personne
      };
      [].forEach.call(document.querySelectorAll(".art-del"), function(b,i){
        b.onclick=function(){ readForm(); state.draft.articles.splice(i,1); render(); };
      });
      function wireNewCat(box){ [].forEach.call(box.querySelectorAll(".art-newcat"), function(b){ b.onclick=function(){ var p=b.getAttribute("data-p"); readForm();
        catPick("Catégorie de « "+p+" »", prodNewCat(p, state.draft), function(c){ state.draft.newCats=state.draft.newCats||{}; state.draft.newCats[p]=c; render(); }); }; }); }
      [].forEach.call(document.querySelectorAll(".art-new"), wireNewCat);
      [].forEach.call(document.querySelectorAll(".combo .art-prod"), function(input,i){
        var combo=input.parentNode, pop=combo.querySelector(".combo-pop");
        function build(){
          var q=norm(input.value), html="";
          alphaSort(PRODUITS).forEach(function(p){
            if(q){ var np=norm(p); if(np.indexOf(q)!==0 && !np.split(" ").some(function(w){ return w.indexOf(q)===0; })) return; }
            html+='<div class="combo-opt" data-v="'+esc(p)+'">'+esc(p)+'</div>';
          });
          var tv=input.value.trim();
          html+='<div class="combo-opt new" data-v="__new">'+(prodIsNew(tv) ? '+ Créer « '+esc(tv)+' »' : '+ Nouvel article…')+'</div>';
          pop.innerHTML=html;
        }
        var nwBox=combo.parentNode.parentNode.querySelector(".art-new");
        function paintNew(){ if(nwBox){ nwBox.innerHTML=artNewHTML(input.value, state.draft); wireNewCat(nwBox); } }
        input.onfocus=function(){ build(); pop.classList.add("open"); };
        input.oninput=function(){ build(); pop.classList.add("open"); paintNew(); };
        input.onblur=function(){ setTimeout(function(){ pop.classList.remove("open"); }, 180); };
        pop.onmousedown=function(e){ e.preventDefault(); };
        pop.onclick=function(e){
          var o=e.target; while(o && o!==pop && !(o.className && String(o.className).indexOf("combo-opt")>=0)) o=o.parentNode;
          if(!o || o===pop) return;
          var v=o.getAttribute("data-v");
          if(v==="__new"){
            var name=input.value.trim();
            if(!prodIsNew(name)) name=(window.prompt("Nom du nouvel article :")||"").trim();
            readForm();
            if(name){
              if(state.draft.articles[i]) state.draft.articles[i].produit=name;
              if(prodIsNew(name)){ state.draft.newCats=state.draft.newCats||{}; if(!state.draft.newCats[name]) state.draft.newCats[name]=prodCatGuess(name, state.draft); }   // créé à l'enregistrement, dans cette catégorie
            }
            render(); return;
          }
          input.value=v; pop.classList.remove("open"); paintNew();
          if(state.draft.articles[i]) state.draft.articles[i].produit=v;
        };
      });
      if(state.draftRO){   // ticket de quelqu'un d'autre (foyer partagé) : on le voit, on ne le modifie pas
        ["save","del","addart","addremise","photoadd","photochg","photodel"].forEach(function(id){ var b=document.getElementById(id); if(b) b.style.display="none"; });
        [].forEach.call(app.querySelectorAll("section input, section select, section textarea, section .chip, #arts button"), function(x){ x.disabled=true; });
        var cb=document.getElementById("cancel"); if(cb) cb.textContent="Fermer";
        var sec=app.querySelector("section.paper"); if(sec) sec.insertAdjacentHTML("afterbegin", '<div class="ro-note">Ticket de '+esc(payerOf({ payePar:d.payePar }))+' · tu peux le voir, pas le modifier</div>');
      }
    }

