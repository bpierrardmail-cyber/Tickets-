    // ---------- Ticket : les articles comparés au montant ----------
    // Bandeau sous le montant (vert = articles = total, orange = écart), rappel au-dessus des articles, et question à l'enregistrement s'il reste un écart.
    var CHK_TOL=0.05;   // quelques centimes d'arrondi
    function artChkOf(montant, arts){
      var n=0, sum=0;
      (arts||[]).forEach(function(a){ var pr=num(a.prix); if(!pr) return; if(a.produit==="Remise") pr=-Math.abs(pr); n++; sum+=pr; });
      sum=Math.round(sum*100)/100; var tot=num(montant), diff=Math.round((tot-sum)*100)/100;
      return { n:n, sum:sum, tot:tot, diff:diff, ok:Math.abs(diff)<=CHK_TOL };
    }
    function artChkForm(){
      var arts=[]; [].forEach.call(document.querySelectorAll("#arts .art"), function(node){ arts.push({ prix:node.querySelector(".art-prix").value, produit:node.querySelector(".art-prod").value }); });
      var fm=document.getElementById("f-montant"); return artChkOf(fm ? fm.value : "", arts);
    }
    // Ticket et relevé : le paiement par carte déjà dans les comptes (ticket « relevé » sans articles) peut être complété par ce ticket ;
    // sinon une ligne du relevé confirme le total, ou propose le sien s'il est un peu différent. Et une date dans le futur est signalée.
    function tkBankFind(d, amt, mag, date){
      if(!mag || !date || d.src==="releve") return null;
      var from=isoAddDays(date, -3), to=isoAddDays(date, 3), best=null;
      state.entries.forEach(function(e){ if(e.src!=="releve" || String(e.id)===String(d.id) || (e.articles||[]).length || !e.date || e.date<from || e.date>to || !bankNameMatch(mag, e.marchand)) return;
        var v=Number(e.montant)||0, df=Math.abs(v-amt); if(amt>0 && df>Math.max(1, amt*0.1)) return;
        if(!best || df<best.df) best={ e:e, v:v, df:df, exact:df<0.006 }; });
      if(best) return best;
      var b=amt>0 ? bankFind(mag, amt, from, to, 0.1) : null; return b ? { x:b.x, v:b.v, exact:b.exact } : null;
    }
    function tkBankPaint(){
      var box=document.getElementById("bankchk"), d=state.draft; if(!box || !d) return;
      var g=function(id){ var e=document.getElementById(id); return e ? e.value : ""; }, amt=num(g("f-montant")), mag=g("f-marchand").trim(), date=g("f-date"), h="";
      if(date && date>todayISO()) h+='<div class="fct-chk">⚠ Date dans le futur : vérifie la date du ticket</div>';
      var b=d.pay==="esp" ? null : tkBankFind(d, amt, mag, date);
      if(b && b.e){ var R=b.e;
        h+='<div class="fct-hint'+(d.mergeInto===R.id?' ok':'')+'">🏦 Ce paiement est déjà dans tes comptes (relevé) : <b>'+esc(R.marchand)+' −'+esc(fmtK(b.v))+' le '+esc(ddmm(R.date))+'</b>'+(b.exact?'':' · lu '+esc(fmtK(amt)))+'.'+
          (d.mergeInto===R.id ? ' Ce ticket le complétera, sans doublon.' : '<div class="fct-hb"><button type="button" class="btn" id="bkMerge">Compléter ce paiement</button>'+(b.exact?'':'<button type="button" class="btn ghost" id="bkTake">Prendre '+esc(fmtK(b.v))+'</button>')+'</div>')+'</div>'; }
      else if(b && b.exact) h+='<div class="fct-hint ok">🏦 Retrouvé sur ton relevé : <b>'+esc(b.x.n)+' −'+esc(fmtK(b.v))+' le '+esc(ddmm(b.x.d))+'</b>.</div>';
      else if(b) h+='<div class="fct-hint">🏦 Sur ton relevé : <b>−'+esc(fmtK(b.v))+' le '+esc(ddmm(b.x.d))+'</b> ('+esc(b.x.n)+'), lu '+esc(fmtK(amt))+'.<div class="fct-hb"><button type="button" class="btn" id="bkTake">Prendre le relevé</button></div></div>';
      box.innerHTML=h;
      function take(){ var fm=document.getElementById("f-montant"); if(fm) fm.value=String(b.v.toFixed(2)).replace(".", ","); artChkPaint(); tkBankPaint(); }
      var bm=document.getElementById("bkMerge"); if(bm) bm.onclick=function(){ d.mergeInto=b.e.id; if(!b.exact) take(); else tkBankPaint(); };
      var bt=document.getElementById("bkTake"); if(bt) bt.onclick=take;
    }
    // Total recoupé : la somme des articles, le paiement par carte et le tableau de TVA ; deux sources d'accord contre le total lu → les proposer
    function tkSrcPaint(c){
      var box=document.getElementById("srcchk"), d=state.draft; if(!box || !d) return;
      var S=d.scan, tot=c ? c.tot : num(d.montant), h="";
      if(S && S.learnt && Math.abs(tot-(Number(S.total)||0))<0.006) h+='<div class="fct-hint ok">✓ Total lu comme tes tickets '+esc(S.four||"de ce magasin")+'.</div>';
      if(S && S.mag && d.marchand===S.four) h+='<div class="fct-hint ok">✓ Magasin reconnu à son SIRET ou à son téléphone : '+esc(S.four)+'.</div>';
      // nombre d'articles annoncé par le ticket : il en manque, ou une ligne est en trop
      var nRows=document.querySelectorAll("#arts .art").length;
      if(S && S.nbArt>0 && S.nbLu!==S.nbArt && nRows===S.nLines) h+='<div class="fct-chk">⚠ Le ticket annonce <b>'+S.nbArt+' article'+(S.nbArt>1?'s':'')+'</b>, '+S.nbLu+' lu'+(S.nbLu>1?'s':'')+' : '+(S.nbLu<S.nbArt ? 'vérifie qu\'il n\'en manque pas' : 'une ligne est peut-être en trop')+'.</div>';
      var src=[]; if(c && c.n>0 && c.sum>0) src.push({ n:"Articles", v:Math.round(c.sum*100)/100 }); if(S && S.carte>0) src.push({ n:"Carte", v:S.carte }); if(S && S.tva>0) src.push({ n:"TVA", v:S.tva }); if(S && S.esp>0) src.push({ n:"Espèces", v:S.esp });
      if(S && src.length && tot>0){
        h+='<div class="tk-src">'+src.map(function(x){ var ok=Math.abs(x.v-tot)<0.011; return '<span class="'+(ok?'ok':'no')+'">'+(ok?'✓ ':'')+esc(x.n)+' '+esc(fmtK(x.v))+'</span>'; }).join("")+'</div>';
        var agree=null; src.forEach(function(a, i){ src.forEach(function(b, j){ if(j>i && Math.abs(a.v-b.v)<0.011 && Math.abs(a.v-tot)>=0.011) agree=a.v; }); });
        if(agree && !d.srcKeep){ var who=src.filter(function(x){ return Math.abs(x.v-agree)<0.011; }).map(function(x){ return x.n==="Articles"?"les articles":(x.n==="Carte"?"le paiement carte":(x.n==="Espèces"?"les espèces moins le rendu":"la TVA")); });
          h+='<div class="fct-hint">⚠ Lu <b>'+esc(fmtK(tot))+'</b>, mais '+esc(who.length>2 ? who.slice(0,-1).join(", ")+" et "+who[who.length-1] : who.join(" et "))+' disent <b>'+esc(fmtK(agree))+'</b>.<div class="fct-hb"><button type="button" class="btn" id="srcTake">Prendre '+esc(fmtK(agree))+'</button><button type="button" class="btn ghost" id="srcKeep">Garder '+esc(fmtK(tot))+'</button></div></div>'; }
      }
      box.innerHTML=h;
      var tk=document.getElementById("srcTake"); if(tk) tk.onclick=function(){ var fm=document.getElementById("f-montant"); if(fm) fm.value=agree.toFixed(2).replace(".", ","); artChkPaint(); tkBankPaint(); };
      var kp=document.getElementById("srcKeep"); if(kp) kp.onclick=function(){ d.srcKeep=true; tkSrcPaint(artChkForm()); };
    }
    function artChkPaint(){
      var c=artChkForm(), box=document.getElementById("artchk"), sm=document.getElementById("artsum"); if(!box) return;
      var show=c.n>0 && c.tot>0, np=0, nx=0;
      [].forEach.call(document.querySelectorAll("#arts .art"), function(node){   // produit pas encore choisi : en orange
        var pi=node.querySelector(".art-prod"), has=(node.querySelector(".art-prix").value.trim()!=="" || (node.getAttribute("data-l")||"").trim()!=="");
        var need=has && !pi.value.trim(); pi.classList.toggle("need", need); if(need) np++;
        var px=node.querySelector(".art-prix"), noP=!num(px.value) && (pi.value.trim()!=="" || (node.getAttribute("data-l")||"").trim()!=="") && pi.value!=="Remise"; px.classList.toggle("need", noP); if(noP) nx++; });
      var npT=(nx ? nx+' sans prix' : '')+(nx && np ? ' · ' : '')+(np ? np+' à nommer' : '');
      box.innerHTML=!show ? "" : (c.ok
        ? '<button type="button" class="chk ok" id="chkgo"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg><span class="t"><b>'+c.n+' article'+(c.n>1?'s':'')+' = total '+esc(fmtK(c.tot))+'</b><span>'+(npT ? npT : 'rien à corriger')+'</span></span><span class="go">Voir ↓</span></button>'
        : '<button type="button" class="chk bad" id="chkgo"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17.5v.5"/></svg><span class="t"><b>'+c.n+' article'+(c.n>1?'s':'')+' · '+esc(fmtK(c.sum))+' ≠ '+esc(fmtK(c.tot))+'</b><span>écart '+esc(fmtK(Math.abs(c.diff)))+' · vérifie les articles'+(npT ? ' · '+npT : '')+'</span></span><span class="go">Vérifier ↓</span></button>');
      var go=document.getElementById("chkgo"); if(go) go.onclick=function(){ var h=document.getElementById("artshead"); if(h) h.scrollIntoView({ behavior:"smooth", block:"start" }); };
      if(sm){ sm.textContent=show ? (c.ok ? "✓ "+fmtK(c.sum) : fmtK(c.sum)+" sur "+fmtK(c.tot)) : ""; sm.className=show ? (c.ok?"ok":"bad") : ""; }
      tkSrcPaint(c);
      [].forEach.call(document.querySelectorAll("#arts .art"), function(node){ node.classList.toggle("warn", show && !c.ok); });
    }
    function readForm(){
      state.draft.montant=document.getElementById("f-montant").value;
      state.draft.marchand=document.getElementById("f-marchand").value;
      state.draft.date=document.getElementById("f-date").value;
      var arts=[];
      [].forEach.call(document.querySelectorAll("#arts .art"), function(node){
        var pi=node.querySelector(".art-prod");
        arts.push({ label:node.getAttribute("data-l")||"",   // ce qui a été lu sur le ticket (gardé tel quel)
                    prix:node.querySelector(".art-prix").value,
                    produit:pi.value, auto:(pi.value!=="" && pi.getAttribute("data-autov")===pi.value),
                    commun:node.getAttribute("data-c")==="1" });
      });
      state.draft.articles=arts;
      var tf=document.getElementById("f-tofy"); if(tf) state.draft.toFoyer=tf.checked;
    }

    function newDraft(){ state.note=""; state.ocrRaw=null; state.draftRO=false; state.draft={id:null,montant:"",date:todayISO(),marchand:"",categorie:"",articles:[],payePar:fyDefPayer(),photo:""}; grpDraftHook(); state.view="form"; render(); }
    // ticket commencé depuis l'écran d'un groupe : il va dans ce groupe, et on y revient après
    function grpDraftHook(){ if(state.view==="groupe" && state.draft && grpById(state.grpId) && canUse("groupes")){ state.draft.groupe=state.grpId; state.formFrom="groupe"; } }
    function editEntry(id){
      var e=state.entries.filter(function(x){ return String(x.id)===String(id); })[0];
      if(!e) return;
      state.draft={id:e.id,montant:e.montant,date:e.date,marchand:e.marchand,categorie:e.categorie,payePar:e.payePar||"",compte:e.compte||"",pay:e.pay==="esp"?"esp":"",liqOn:!!(e.pay==="esp" && e.liq),photo:photoOf(e),share:e.share||null,foyerId:e.foyerId||null,groupe:(groupes.filter(function(g){ return (g.dep||[]).some(function(x){ return String(x.ticketId)===String(e.id); }); })[0]||{}).id||null,toFoyer:!!e.foyerId,
        articles:(e.articles||[]).map(function(a){ return {label:a.label,prix:a.prix,produit:a.produit,commun:!!a.commun}; })};
      state.draftRO=!fyCanEdit(e); state.note=""; state.ocrRaw=null;   // pas la note d'un scan précédent
      state.formFrom=(state.view==="analyse" || state.view==="month" || state.view==="artDetail" || state.view==="articles" || state.view==="compte" || state.view==="comptedet" || state.view==="groupe") ? state.view : null;
      state.view="form"; render();
    }
    function formBackView(){ var v=state.formFrom||"list"; state.formFrom=null; state.optOpen=null; state.catAll=false; return v; }
    function saveDraft(force){
      if(state.draftRO) return;
      readForm();
      var montant=num(state.draft.montant);
      if(!montant){ var f=document.getElementById("f-montant"); if(f) f.focus(); return; }
      // catégorie obligatoire (06/11)
      if(!String(state.draft.categorie||"").trim()){ uiToast("Choisis une catégorie"); var chs=document.getElementById("chips"); if(chs){ chs.classList.add("need"); chs.scrollIntoView({ behavior:"smooth", block:"center" }); } return; }
      // un prix tapé dans le champ du produit : il va dans le prix
      (state.draft.articles||[]).forEach(function(a){ var pz=String(a.produit||"").trim(); if(/^-?[0-9]+([.,][0-9]{1,2})?\s*€?$/.test(pz) && !num(a.prix)){ a.prix=pz.replace(/\s*€$/, ""); a.produit=""; } });
      // retrait au distributeur : l'argent va dans le liquide, ou reste une dépense (au choix)
      if(force!==true && !state.draft.id && !state.draft.retAsked && state.draft.pay!=="esp" && tkRetraitLike(state.draft)){ tkRetraitAsk(montant); return; }
      // ticket sans article : un article du ticket entier, pour que le compte tombe juste (06/11)
      if(!(state.draft.articles||[]).some(function(a){ return String(a.label||"").trim() || String(a.produit||"").trim() || num(a.prix); }))
        state.draft.articles=[{ label:state.draft.categorie+" · ticket entier", prix:String(montant).replace(".", ","), produit:(FAMILLES.indexOf(state.draft.categorie)>=0 ? state.draft.categorie : FAM_FB) }];
      var ck=artChkOf(state.draft.montant, state.draft.articles);
      if(force!==true && ck.n>0 && !ck.ok){   // les articles ne font pas le total : vérifier, compléter ou enregistrer quand même
        var noP=(state.draft.articles||[]).filter(function(a){ return !num(a.prix) && (String(a.label||"").trim() || String(a.produit||"").trim()) && a.produit!=="Remise"; });
        var one=ck.diff>0 && noP.length===1 ? noP[0] : null;   // un seul article sans prix : c'est sans doute lui qui manque
        var miss=ck.diff>0, s=uiSheet('<div class="sheet-title">Les articles ne font pas le total</div>'+
          '<div class="chk-tab"><div><span>Articles</span><b>'+esc(fmtK(ck.sum))+'</b></div><div><span>Ticket</span><b>'+esc(fmtK(ck.tot))+'</b></div><div><span>'+(miss?'Il manque':'En trop')+'</span><b>'+esc(fmtK(Math.abs(ck.diff)))+'</b></div></div>'+
          '<div class="ui-stack"><button type="button" class="btn primary" id="ckv">Vérifier les articles</button>'+
          (one ? '<button type="button" class="btn" id="ckone">Mettre '+esc(fmtK(ck.diff))+' sur « '+esc(artName(one).slice(0, 24))+' »</button>' : '')+
          '<button type="button" class="btn" id="ckfix">'+(miss ? 'Ajouter '+esc(fmtK(ck.diff))+' en « Divers »' : 'Mettre le montant à '+esc(fmtK(ck.sum)))+'</button>'+
          '<button type="button" class="btn ghost" id="cksave">Enregistrer quand même</button></div>');
        s.q("#ckv").onclick=function(){ s.close(); var h=document.getElementById("artshead"); if(h) h.scrollIntoView({ behavior:"smooth", block:"start" }); };
        s.q("#ckfix").onclick=function(){ s.close();
          if(miss) state.draft.articles.push({ label:"Divers", prix:String(ck.diff).replace(".", ","), produit:"" });
          else state.draft.montant=String(ck.sum).replace(".", ",");
          render(); saveDraft(true); };
        s.q("#cksave").onclick=function(){ s.close(); saveDraft(true); };
        if(one) s.q("#ckone").onclick=function(){ s.close(); one.prix=ck.diff.toFixed(2).replace(".", ","); render(); saveDraft(true); };
        return;
      }
      (function(){
        var d=state.draft.date||"", m=d.match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/);
        if(!m) return;
        var y=parseInt(m[1],10), nowY=new Date().getFullYear();
        if(y>=2000 && y<=nowY+1) return;
        var sugY=nowY, suggest=sugY+"-"+m[2]+"-"+m[3];
        if(new Date(suggest).getTime()-Date.now() > 40*86400000){ sugY=nowY-1; suggest=sugY+"-"+m[2]+"-"+m[3]; }
        var dd=m[3]+"/"+m[2];
        if(window.confirm("La date lue est "+dd+"/"+m[1]+" — c'est sûrement "+dd+"/"+sugY+".\nCorriger l'année ?")){
          state.draft.date=suggest;
          var fd=document.getElementById("f-date"); if(fd) fd.value=suggest;
        }
      })();
      var arts=(state.draft.articles||[]).map(function(a){
          var pr=num(a.prix), prod=(a.produit==="__new"?"":a.produit)||"";
          if(prod==="Remise") pr=-Math.abs(pr);
          return {label:(a.label||"").trim()||prod, prix:pr, produit:prod, commun:!!a.commun};   // saisi à la main : pas de texte lu, son nom suffit
        }).filter(function(a){ return a.label || a.produit || a.prix; });
      var entry={ id:state.draft.id, montant:montant, date:state.draft.date||todayISO(),
        marchand:(state.draft.marchand||"").trim()||"Sans nom", categorie:state.draft.categorie, payePar:(state.draft.payePar||((fyMember() && fyCfg.accts!=null && !state.draft.compte)?fyDefPayer():"")), articles:arts, photo:(state.draft.photo||"") };
      arts.forEach(function(a){
        if(a.produit && a.label){ APPRIS[norm(a.label)]=a.produit; }
        if(a.produit && a.produit!=="Remise" && FAMILLES.indexOf(a.produit)<0 && PRODUITS.indexOf(a.produit)<0){ PRODUITS.push(a.produit); persistProd(); if(!(a.produit in FAMILLE_DE)){ FAMILLE_DE[a.produit]=prodNewCat(a.produit, state.draft); persistFamille(); } }
      });
      persistAppris();
      if(state.draft.compte && acctByKey(state.draft.compte) && state.draft.pay!=="esp") entry.compte=state.draft.compte;
      if(state.draft.pay==="esp"){ entry.pay="esp"; var lqA=tkLiqAcct(entry); if(state.draft.liqOn===true && tkLiqCan(lqA)) entry.liq={ k:lqA.key, m:String(entry.date).slice(0, 7), a:montant }; }   // payé en espèces, pris ou non dans le liquide
      if(state.draft.share && arts.some(function(a){ return a.commun; })) entry.share=state.draft.share;
      if(state.draft.foyerId) entry.foyerId=state.draft.foyerId;
      var grpTk=state.draft.groupe||null;
      var fyMsg=persoOn() ? persoSendTicket(entry, !!state.draft.toFoyer, state.draft.foyerId) : "";   // « Partagé avec » : seulement s'il y a des articles communs
      var mg=(state.draft.mergeInto!=null && state.draft.pay!=="esp") ? state.entries.filter(function(e){ return String(e.id)===String(state.draft.mergeInto); })[0] : null;
      if(mg && !entry.id){ entry.id=mg.id; if(!entry.compte && mg.compte) entry.compte=mg.compte; if(mg.imp) entry.imp=mg.imp; if(mg.impKey) entry.impKey=mg.impKey; if(!entry.payePar && mg.payePar) entry.payePar=mg.payePar; }
      var isNew=!entry.id;
      if(isNew) entry.id=Date.now();
      var dp=state.draft.photo;
      if(phSafe(dp)){ entry.photo=true; PHOTOS[String(entry.id)]=dp; idbPut(entry.id,dp);
        if(state.draft.photoFiles && state.draft.photoFiles.length) origPut(entry.id, state.draft.photoFiles); }
      else { entry.photo=false; delete PHOTOS[String(entry.id)]; idbDel(entry.id); origDel(entry.id); }
      tkLiqUndo(isNew ? null : state.entries.filter(function(e){ return String(e.id)===String(entry.id); })[0]); tkLiqDo(entry);   // le liquide suit (l'ancien montant revient d'abord)
      if(isNew){ state.entries.unshift(entry); }
      else { state.entries=state.entries.map(function(e){ return String(e.id)===String(entry.id)?entry:e; }); }
      var sc=state.draft.scan, tkMsg="";
      if(sc && sc.lines) tkMagLearn(sc.lines, entry.marchand);   // le magasin est reconnu la prochaine fois par son SIRET ou son téléphone
      if(sc && sc.four && sc.lines && montant>0){ var all=store.read("tkAppris", {})||{}, k=norm(sc.four);
        if(k && (!all[k] || Math.abs(montant-(Number(sc.total)||0))>0.004)){ var A=tkAnchorOf(sc.lines, montant); if(A){ all[k]={ amt:A }; store.write("tkAppris", all); tkMsg="total retenu pour "+sc.four; } } }
      if(canUse("groupes") && (grpTk || groupes.some(function(g){ return (g.dep||[]).some(function(x){ return String(x.ticketId)===String(entry.id); }); }))) grpTicketSync(entry, grpTk);
      persist(); state.view=formBackView(); state.draft=null; render();
      if(tkMsg || fyMsg) uiToast("Ticket enregistré · "+[tkMsg, fyMsg].filter(function(x){ return x; }).join(" · "));
    }
