    // ---------- Menu › Gérer : pages de gestion (liste complète, ＋ Nouveau, toucher pour modifier) ----------
    var GER_T={ acc:["Comptes bancaires","Nouveau compte"], ep:["Épargne et livrets","Nouveau livret"], frais:["Frais fixes","Nouveau frais fixe"], vrec:["Virements chaque mois","Nouveau virement mensuel"], prov:["Provisions","Nouvelle provision"], cats:["Catégories","Nouvelle grande catégorie"] };
    function gerOpen(k){ state.gerK=k; state.gerQ=""; state.view="gerer"; render(); window.scrollTo(0,0); }
    function gerFraisTotal(m){ var t=0; fraisCommuns.forEach(function(f){ if(fraisActif(f, m)) t+=fraisMontant(f, m)||0; }); return t; }
    // création directe : seulement la page de création (le formulaire en plein écran), puis retour d'où on vient
    function menuCreate(fn){
      state.mkBack={ v:state.view, sub:state.menuSub, k:state.gerK }; state.view="mkpage"; render(); window.scrollTo(0,0);
      fn(); mkWatch();
    }
    function mkWatch(){
      var empty=0, t=setInterval(function(){
        if(state.view!=="mkpage"){ clearInterval(t); return; }
        if(document.querySelector(".sheet-overlay")){ empty=0; return; }
        if(++empty>=2){ clearInterval(t); mkDone(); }
      }, 200);
    }
    function mkDone(){ var b=state.mkBack||{}; state.mkBack=null; if(state.view!=="mkpage") return; if(b.v==="gerer"){ state.gerK=b.k; state.view="gerer"; render(); window.scrollTo(0,0); } else openMenu(b.sub||"gerer"); }
    function renderMkpage(){ app.innerHTML=header(true, "")+'<section class="paper mk-pg"></section>'; setNav(null, true); bindBack(function(){ var o=document.querySelectorAll(".sheet-overlay"); [].forEach.call(o, function(x){ if(x.parentNode) x.parentNode.removeChild(x); }); mkDone(); }); }
    function virRecNew(){
      var cm=monthKey(todayISO()), A=comptes.filter(function(a){ return a.key!=="__tickets"; }), ck=(myAcct()||A[0]||{}).key;
      uiForm({ title:"Nouveau virement chaque mois", intro:"Il arrive dans « À venir » chaque mois (jusqu'à 12 mois à l'avance), à cocher « fait » quand il passe.", fields:[
        {key:"label", label:"Libellé", placeholder:"Salaire, livret, pension…", required:true},
        {key:"montant", label:"Montant", type:"money", required:true},
        {key:"sens", label:"Sens", type:"seg", value:"in", options:SENS_OPTS},
        {key:"compte", label:"Compte", type:"select", value:ck, options:A.map(function(a){ return { v:a.key, l:a.nom }; }), hidden:A.length<2, onChange:function(v, api){ api.opts("lien", virLinkOpts(v), ""); }},
        {key:"lien", label:"Vers / depuis", type:"select", value:"", options:virLinkOpts(ck)},
        dayField(null, "Jour (facultatif)", "Range le virement dans la liste du compte."),
        {key:"from", label:"À partir de", type:"month", value:cm},
        {key:"to", label:"Jusqu'au mois inclus (facultatif)", type:"month", value:""}
      ]}, function(r){
        var jd=dayRead(r); if(jd.err) return jd.err;
        var okM=/^[0-9]{4}-[0-9]{2}$/, f=okM.test(r.from||"") ? r.from : cm, to=okM.test(r.to||"") ? r.to : "";
        if(to && to<f) return "Le dernier mois est avant le premier.";
        var m=Math.abs(r.montant), v={ montant:(r.sens==="out"?-m:m) }; virLinkSet(v, r.lien);
        var rr={ id:virNewId(), person:r.compte||ck, label:r.label||"Virement", note:"", montant:v.montant, from:f, made:{} };
        if(jd.v) rr.day=jd.v; if(to) rr.to=to; ["epargneId","vers","bourseId"].forEach(function(x){ if(v[x]!=null) rr[x]=v[x]; });
        virRec.push(rr); persistVirRec(); virRecSync(); render(); uiToast("✓ « "+rr.label+" » chaque mois à partir "+impDeMois(f));
      });
    }
    function catNewForm(parent){
      var opts=[{ v:"", l:"Grande catégorie" }].concat(catMains().map(function(m){ return { v:m, l:"Dans « "+m+" »" }; }));
      uiForm({ title:parent ? "Nouvelle sous-catégorie" : "Nouvelle catégorie", fields:[
        {key:"nom", label:"Nom", placeholder:"Boulangerie, Essence…", required:true},
        {key:"dans", label:"Rangée", type:"select", value:parent||"", options:opts}
      ]}, function(r){
        var name=String(r.nom||"").trim(); if(!name) return "Donne un nom.";
        if(catNameBad(name)) return "Choisis un autre nom.";
        catAddRaw(name, r.dans||null); uiToast("✓ Catégorie « "+name+" » créée");
      });
    }
    function gerCatMenu(c){
      if(fyMember()) return;
      var main=catIsMain(c), ch=[];
      if(main) ch.push({ l:"＋ Sous-catégorie", fn:function(){ catNewForm(c); } });
      ch.push({ l:"Renommer", fn:function(){ renameCat(c); } });
      if(!main) ch.push({ l:"Changer de grande catégorie", fn:function(){ moveCat(c); } });
      if(c!=="Autre") ch.push({ l:"Supprimer", danger:true, fn:function(){ deleteCat(c); } });
      uiChoice(c, main ? catSubs(c).length+" sous-catégorie"+(catSubs(c).length>1?"s":"") : "dans « "+catMain(c)+" »", ch);
    }
    function gerVrecMenu(r, cm){
      var v={ month:cm };
      uiChoice(r.label, fmt(Math.abs(virRecAmt(r, cm)))+" chaque mois depuis "+monthLabelOf(r.from)+(r.to?" jusqu'à "+monthLabelOf(r.to):""), [
        { l:"Modifier à partir de "+monthLabelOf(cm), fn:function(){ virRecEdit(r, v); } },
        { l:"Arrêter à partir de "+monthLabelOf(cm), danger:true, fn:function(){ virRecStop(r, cm); } } ]);
    }
    function renderGerer(){
      var k=state.gerK||"acc", T=GER_T[k]||GER_T.acc, cm=monthKey(todayISO()), h=header(true, T[0])+'<section class="paper cacc gr-pg">', L=[];
      function line(o){ return '<button type="button" class="dr-row tall gr-r" data-i="'+L.length+'"><span class="ic">'+o.ic+'</span><span class="t">'+esc(o.t)+(o.tag?' <span class="gr-tag">'+esc(o.tag)+'</span>':'')+'<small>'+esc(o.s||"")+'</small>'+(o.bar!=null?'<span class="gr-bar"><i style="width:'+Math.max(0, Math.min(100, Math.round(o.bar*100)))+'%"></i></span>':'')+'</span>'+(o.a!=null?'<span class="gr-a'+(o.a<0?' neg':'')+'">'+esc(o.af||fmt(o.a))+'</span>':'')+'<span class="chev">›</span></button>'; }
      function push(o){ var x=line(o); L.push(o.fn); return x; }
      function grp(title, rows){ return rows.length ? (title?'<div class="mn-g">'+title+'</div>':'')+'<div class="dr-grp">'+rows.join("")+'</div>' : ""; }
      if(k==="acc"){
        h+=grp("", comptes.filter(function(a){ return a.key!=="__tickets"; }).map(function(a){ var F=acctFigures(a.key, cm), st=acctStart(a.key);
          return push({ ic:"🏦", t:a.nom, tag:a.main?"PRINCIPAL":"", s:(acctOwner(a)||"sans titulaire")+(st?" · depuis "+monthLabelOf(st):""), a:F.banque, fn:function(){ acctSheet(a.key, cm); } }); }));
      } else if(k==="ep"){
        var E=epargne.filter(function(c){ return !c.closed; });
        h+=E.length ? grp("", E.map(function(c){ return push({ ic:c.bourseLink?"📈":"🐷", t:c.nom, s:c.bourseLink?"portefeuille Bourse, mis à jour tout seul":(ownerOf(c)||""), a:epAt(c, cm), fn:function(){ if(!c.bourseLink) editEpargne(c.id); else uiToast("La Bourse se met à jour toute seule"); } }); })) : '<div class="gr-empty">Aucun livret pour l\'instant.</div>';
      } else if(k==="frais"){
        var q=menuNorm(state.gerQ||"").trim(), byP={}, order=[];
        h+='<div class="mn-q"><span>🔍</span><input type="search" id="grQ" placeholder="Chercher un frais…" value="'+esc(state.gerQ||"")+'" autocomplete="off"></div>';
        fraisCommuns.filter(function(f){ return fraisActif(f, cm) && (!q || menuNorm(f.label).indexOf(q)>=0); }).forEach(function(f){ var p=f.personne||"Commun"; if(!byP[p]){ byP[p]=[]; order.push(p); } byP[p].push(f); });
        order.sort(function(a, b){ return a==="Commun" ? -1 : b==="Commun" ? 1 : a.localeCompare(b); });
        order.forEach(function(p){ var tot=0, rows=byP[p].sort(function(a, b){ return (fraisDay(a, cm)||40)-(fraisDay(b, cm)||40); }).map(function(f){ var mt=fraisMontant(f, cm)||0, d=fraisDay(f, cm), ac=f.compte && acctByKey(f.compte); tot+=mt;
            return push({ ic:f.prov?"🫙":(f.fact?"🧾":"📌"), t:f.label||"Frais", s:[d?"le "+d:"", f.split?"chacun sa part":(ac?ac.nom:""), f.recurrent?(f.endMonth?"jusqu'en "+monthLabelOf(f.endMonth):"chaque mois"):"ce mois"].filter(Boolean).join(" · "), a:mt, fn:function(){ editFraisCommun(f.id, cm); } }); });
          h+=grp(esc(p)+" · "+fmt(tot)+" / mois", rows); });
        if(!order.length) h+='<div class="gr-empty">'+(q?"Aucun frais ne correspond.":"Aucun frais fixe ce mois.")+'</div>';
      } else if(k==="vrec"){
        var V=virRec.filter(function(r){ return !r.to || r.to>=cm; });
        h+=V.length ? grp("", V.map(function(r){ var a=virRecAmt(r, cm), ac=acctByKey(r.person);
          return push({ ic:a<0?"↗️":"↙️", t:r.label, s:[ac?ac.nom:"", r.day?"le "+r.day:"", r.from>cm?"à partir de "+monthLabelOf(r.from):"", r.to?"jusqu'en "+monthLabelOf(r.to):""].filter(Boolean).join(" · "), a:a, af:(a>0?"+":"")+fmt(a), fn:function(){ gerVrecMenu(r, cm); } }); }))
          : '<div class="gr-empty">Aucun virement chaque mois. Un salaire, un versement sur un livret… : il arrivera tout seul dans « À venir ».</div>';
      } else if(k==="prov"){
        h+=provisions.length ? grp("", provisions.map(function(pv){ var b=provBalance(pv, cm), mz=mensuelAt(pv, cm);
          return push({ ic:"🫙", t:pv.nom, s:fmt(mz)+" / mois · "+provWhereLabel(pv), a:b, fn:function(){ editProvision(pv.id); } }); }))
          : '<div class="gr-empty">Aucune provision. Une grosse dépense par an (impôt, assurance, voiture) : mets un peu de côté chaque mois.</div>';
      } else if(k==="cats"){
        catMains().forEach(function(m){ var ic=catIcon(m).e, rows=[push({ ic:ic, t:m, s:catSubs(m).length ? catSubs(m).length+" sous-catégorie"+(catSubs(m).length>1?"s":"") : "pas de sous-catégorie", fn:function(){ gerCatMenu(m); } })];
          catSubs(m).forEach(function(c){ rows.push(push({ ic:"↳", t:c, s:"", fn:function(){ gerCatMenu(c); } }).replace('class="dr-row tall gr-r"', 'class="dr-row gr-r gr-sub"')); });
          h+='<div class="dr-grp gr-cat">'+rows.join("")+'</div>'; });
        h+='<div class="note gr-note">Toucher une catégorie : ＋ sous-catégorie, renommer, déplacer, supprimer.</div>';
      }
      h+='<button type="button" class="btn primary gr-new" id="grNew">＋ '+esc(T[1])+'</button></section>';
      app.innerHTML=h; setNav(null, true);
      bindBack(function(){ openMenu("gerer"); });
      [].forEach.call(app.querySelectorAll(".gr-r"), function(b){ b.onclick=function(){ var fn=L[+b.getAttribute("data-i")]; if(fn) fn(); }; });
      var nw=document.getElementById("grNew"); if(nw) nw.onclick=function(){ var it=menuItems().filter(function(o){ return o.k===k; })[0]; if(it && it.add) it.add(); };
      var qi=document.getElementById("grQ"); if(qi){ qi.oninput=function(){ state.gerQ=qi.value; var pos=qi.selectionStart; render(); var q2=document.getElementById("grQ"); if(q2){ q2.focus(); try{ q2.setSelectionRange(pos, pos); }catch(e){} } }; }
    }
    function menuNorm(t){ return String(t||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
    function renderMenu(){
      var subs=MENU_SUBS, sub=state.menuSub||store.read("menuSub", "gerer"); if(!subs.some(function(x){ return x[0]===sub; })) sub="gerer"; state.menuSub=sub;
      var items=menuItems(), q=menuNorm(state.menuQ).trim(), TABN={}; subs.forEach(function(x){ TABN[x[0]]=x[1]; });
      function row(o, where){ return '<div class="mn-row"><button type="button" class="dr-row tall" data-k="'+o.k+'"><span class="ic">'+o.ic+'</span><span class="t">'+esc(o.t)+(o.plus?' <span class="mn-plus">✦</span>':'')+'<small>'+esc(where||o.s||"")+'</small></span>'+(o.st?'<span class="st" style="color:'+(o.stCol||"var(--accent)")+'">'+esc(o.st)+'</span>':'')+(o.n!=null?'<span class="mn-n">'+o.n+'</span>':'')+(o.add?'':'<span class="chev">›</span>')+'</button>'+(o.add?'<button type="button" class="mn-add" data-a="'+o.k+'" aria-label="Créer : '+esc(o.t)+'">＋</button>':'')+'</div>'; }
      var h=header(true, "Menu")+'<section class="paper cacc mn-pg">';
      h+='<div class="mn-q"><span>🔍</span><input type="search" id="mnQ" placeholder="Chercher un réglage…" value="'+esc(state.menuQ||"")+'" autocomplete="off"></div>';
      if(q){
        var hit=items.filter(function(o){ return menuNorm(o.t+" "+o.s+" "+(o.kw||"")+" "+o.g).indexOf(q)>=0; });
        h+='<div class="mn-res">'+(hit.length ? hit.length+" résultat"+(hit.length>1?"s":"") : "Aucun réglage ne correspond")+'</div>';
        if(hit.length) h+='<div class="dr-grp">'+hit.map(function(o){ return row(o, TABN[o.tab]+(o.g?" › "+o.g:"")); }).join("")+'</div>';
      } else {
        h+='<div class="avtabs mn-tabs">'+subs.map(function(x){ return '<button type="button" class="mnsub'+(x[0]===sub?' on':'')+'" data-ms="'+x[0]+'">'+x[1]+'</button>'; }).join("")+'</div>';
        if(sub==="sauv" && !fyMember()){
          var lab=drvOn() ? drvMenuLabel() : null, bk=backupAge();
          h+='<div class="mn-stat"><b>'+(lab ? "☁️ "+esc(lab.t) : "💾 Dernière sauvegarde : "+esc(bk.label))+'</b><span>'+(lab ? "Chiffrée, automatique"+(fyCfg?", avec ton foyer et ses membres":"")+"." : (bk.days===null || bk.days>=7 ? "Pense à sauvegarder : un téléphone perdu, ce sont tes données perdues." : "Fais-en une de temps en temps, ou active Google Drive."))+'</span></div>';
        }
        if(sub==="gerer" && !fyMember()) h+='<div class="mn-g">Créer</div><div class="mn-quick">'+MENU_QUICK.filter(function(x){ return items.some(function(o){ return o.k===x[0] && o.add; }); }).map(function(x){ return '<button type="button" data-a="'+x[0]+'">＋ '+x[1]+'</button>'; }).join("")+'</div>';
        var gs=[], by={};
        items.filter(function(o){ return o.tab===sub; }).forEach(function(o){ if(!by[o.g]){ by[o.g]=[]; gs.push(o.g); } by[o.g].push(o); });
        gs.forEach(function(g){ if(g) h+='<div class="mn-g">'+esc(g)+'</div>'; h+='<div class="dr-grp">'+by[g].map(function(o){ return row(o); }).join("")+'</div>'; });
        if(sub==="aide") h+='<div class="dr-foot" style="margin-top:14px"><span class="beta-tag">Version β · '+esc((document.querySelector('meta[name=build]')||{}).content||'')+(capNative()?(EDITION==="store"?' · appli Store':' · appli Perso'):' · navigateur'+(EDITION==="store"?' (Store)':''))+'</span></div>';
      }
      h+='</section>';
      app.innerHTML=h; setNav(null, true);
      bindBack(menuClose);
      var acts={}, adds={}; items.forEach(function(o){ acts[o.k]=o.fn; adds[o.k]=o.add; });
      [].forEach.call(app.querySelectorAll(".mn-pg [data-a]"), function(b){ b.onclick=function(ev){ ev.stopPropagation(); var fn=adds[b.getAttribute("data-a")]; if(fn) fn(); }; });
      [].forEach.call(app.querySelectorAll(".mn-pg .dr-row[data-k]"), function(b){ b.onclick=function(){ var fn=acts[b.getAttribute("data-k")]; if(fn) fn(); }; });
      [].forEach.call(app.querySelectorAll(".mnsub"), function(b){ b.onclick=function(){ state.menuSub=b.getAttribute("data-ms"); store.write("menuSub", state.menuSub); render(); window.scrollTo(0,0); }; });
      var qi=document.getElementById("mnQ");
      if(qi){ qi.oninput=function(){ state.menuQ=qi.value; var pos=qi.selectionStart; render(); var q2=document.getElementById("mnQ"); if(q2){ q2.focus(); try{ q2.setSelectionRange(pos, pos); }catch(e){} } }; if(state.menuQ) { qi.focus(); } }
    }
    // Âge de la dernière sauvegarde, en jours de calendrier (une sauvegarde de la veille au soir = « hier »)
    function backupAge(key){
      var lb=store.read(key||"lastBackup", null); if(!lb) return { days:null, label:"jamais" };
      var d=new Date(lb), n=new Date(), d0=new Date(d.getFullYear(), d.getMonth(), d.getDate()), n0=new Date(n.getFullYear(), n.getMonth(), n.getDate()), days=Math.max(0, Math.round((n0-d0)/86400000));
      return { days:days, label:days===0?"aujourd'hui":(days===1?"hier":"il y a "+days+" j") };
    }
    // Réglages (depuis le menu) : devise, code et empreinte, restaurer une sauvegarde
