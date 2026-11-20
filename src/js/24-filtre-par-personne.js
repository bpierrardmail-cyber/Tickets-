    // ---------- Filtre par personne (Accueil, Articles, Analyse) ----------
    // « Moi », une personne ou « Tout le foyer », selon qui a payé le ticket. Le choix vaut pour les trois onglets et reste sur ce téléphone.
    var PV_COLS=["#7c9cf4","#e0a458","#c78bd6","#5bc0d4","#e88fb0","#d6c35c","#f4796b","#9b8cf4","#d68f5c","#6fb3f0","#b8c0cc","#9bd35e"], pvMemo=null;
    function payerOf(e){ var p=(e.payePar||"").trim(); if(p) return p; return (fyMember() && fyCfg.owner) ? fyCfg.owner : mePerson(); }   // sans « payé par » : le titulaire (avant le foyer, tout était à lui)
    function viewPersons(){
      if(pvMemo) return pvMemo;
      var me=mePerson(), seen={}, list=[];
      state.entries.forEach(function(e){ var p=payerOf(e); if(p && !seen[p]){ seen[p]=1; list.push(p); } });
      list.sort(function(a,b){ return a===me?-1:(b===me?1:a.localeCompare(b,"fr")); });
      pvMemo=list; return list;
    }
    function pvActive(){ var ps=viewPersons(); return ps.length>1 || (ps.length===1 && ps[0]!==mePerson()); }
    var pvLockMe=false;   // Accueil d'un membre du foyer : ses chiffres à lui, sans choix de personne
    function pvCur(){
      if(pvLockMe) return "moi";
      if(!pvActive()) return fyMember() ? "moi" : "all";
      var v=state.personView || store.read("personView", null) || (fyCfg ? "moi" : "all");
      if(v===mePerson()) v="moi";
      if(v!=="all" && v!=="moi" && viewPersons().indexOf(v)<0) v="all";
      return v;
    }
    function pvName(v){ return v==="moi" ? mePerson() : v; }
    function inView(e){ var v=pvCur(); return v==="all" || payerOf(e)===pvName(v); }
    function vEntries(){ return pvCur()==="all" ? state.entries : state.entries.filter(inView); }
    function personColor(p){ if(p===mePerson()) return "var(--accent)"; var ps=viewPersons().filter(function(x){ return x!==mePerson(); }), i=ps.indexOf(p); return i<0 ? "#8a909c" : PV_COLS[i%PV_COLS.length]; }
    // Filtre par personne : un bouton en haut à droite (à l'opposé du menu), posé sur l'en-tête par wirePV
    var pvWanted=false;
    function pvItems(){ var me=mePerson(); return [{ v:"moi", l:"Moi", c:"var(--accent)" }].concat(viewPersons().filter(function(p){ return p!==me; }).map(function(p){ return { v:p, l:p, c:personColor(p) }; })).concat([{ v:"all", l:"Tout le foyer", c:"var(--ink)" }]); }
    function pvBarHTML(cap){
      if(pvActive() || pvLockMe) pvWanted=true;
      else if(!cap) return "";
      return cap?'<div class="com-tools" style="margin:0 0 12px;flex-wrap:nowrap">'+(state.view==="list"?'<button type="button" class="ap-tool com-add" id="manual2" style="flex:0 0 auto">✍️ Saisie</button>':'')+'<button type="button" class="ap-tool com-add psel-c" id="pvCap">🧾 '+esc(cap)+'</button>'+'</div>':'';   // touche = la page des tickets du mois
    }
    function pvCapTxt(n, total){ return n+" ticket"+(n>1?"s":"")+" · "+fmtK(total); }   // la personne est sur le bouton en haut à droite
    function wirePV(){
      var hd=app.querySelector("header.head");
      if(pvWanted && hd && !hd.querySelector(".hpv")){
        var cur=pvCur(), it=pvItems().filter(function(x){ return x.v===cur; })[0]||pvItems()[0];
        hd.classList.add("haspv");
        if(pvLockMe){ hd.insertAdjacentHTML("beforeend", '<span class="hpv" style="cursor:default"><i style="background:'+personColor(mePerson())+'"></i><span>'+esc(mePerson())+'</span></span>'); }
        else { hd.insertAdjacentHTML("beforeend", '<button type="button" class="hpv" id="hpv" aria-label="Dépenses de : '+esc(it.l)+'"><i style="background:'+it.c+'"></i><span>'+esc(it.v==="all"?"Foyer":it.l)+'</span><b>▾</b></button>');
        hd.querySelector(".hpv").onclick=function(ev){ ev.stopPropagation(); var c0=pvCur();
          uiChoice("Dépenses de", "", pvItems().map(function(x){ return { l:(x.v===c0?"✓ ":"")+x.l, primary:(x.v===c0), fn:function(){ state.personView=x.v; store.write("personView", x.v); render(); window.scrollTo(0,0); } }; })); }; }
      }
      var pc=document.getElementById("pvCap"); if(pc) pc.onclick=function(){ state.listSub="tickets"; render(); window.scrollTo(0,0); };
      [].forEach.call(app.querySelectorAll(".psel"), function(sc){
        var on=sc.querySelector(".psel-b.on");
        if(on){ var l=on.offsetLeft-sc.offsetLeft, r=l+on.offsetWidth; if(r>sc.clientWidth-8) sc.scrollLeft=Math.max(0, l-(sc.clientWidth-on.offsetWidth)/2); }
        function upd(){ sc.classList.toggle("ov", sc.scrollWidth>sc.clientWidth+1 && sc.scrollLeft+sc.clientWidth<sc.scrollWidth-2); sc.classList.toggle("ovl", sc.scrollLeft>2); }
        upd(); sc.onscroll=upd;
      });
      [].forEach.call(document.querySelectorAll("[data-pv]"), function(b){ b.onclick=function(ev){ ev.stopPropagation(); var v=b.getAttribute("data-pv"); if(v===mePerson()) v="moi"; state.personView=v; store.write("personView", v); render(); window.scrollTo(0,0); }; });
    }
    // Pour qui on peut fixer un budget : le foyer (tous les tickets), toi, les autres personnes
    function budgetScopes(){
      var me=mePerson(), lim=fyMember() && fyCfg.accts!=null, out=[];
      var others=lim ? [] : uniquePersons().concat(viewPersons()).concat(Object.keys(budgetsP)).filter(function(p, i, a){ return p && p!==me && p!=="Commun" && a.indexOf(p)===i; });
      if(!lim) out.push({ v:"__foyer", l:"Foyer" });
      if(lim || others.length || fyCfg || Object.keys(budgetsP).length) out.push({ v:me, l:"Moi" });
      others.forEach(function(p){ out.push({ v:p, l:p }); });
      return out;
    }
    function artBudLbl(){ var any=Object.keys(budgets).some(function(c){ return budgets[c]>0; }) || Object.keys(budgetsP).some(function(p){ return Object.keys(budgetsP[p]||{}).length>0; }); return any?"Budgets ✎":"＋ Fixer des budgets"; }
    function editBudgets(month){
      var me=state.entries.filter(function(x){ return monthKey(x.date)===month; });
      var list=[]; catMains().forEach(function(m){ list.push(m); catSubs(m).forEach(function(c){ list.push(c); }); });   // l'arbre : grande catégorie puis ses sous-catégories
      me.forEach(function(x){ if(x.categorie && list.indexOf(x.categorie)<0) list.push(x.categorie); });
      var scopes=budgetScopes(), cv=pvCur(), start=(cv==="all") ? "__foyer" : pvName(cv);
      if(!scopes.some(function(o){ return o.v===start; })) start=scopes[0].v;
      var draft={}, curScope=start;
      scopes.forEach(function(o){ draft[o.v]=JSON.parse(JSON.stringify(o.v==="__foyer" ? budgets : (budgetsP[o.v]||{}))); });
      function stash(api){ var o={}; list.forEach(function(c){ var x=api.get(c); if(x && x>0) o[c]=x; }); draft[curScope]=o; }
      var fields=[];
      if(scopes.length>1) fields.push({ key:"__scope", label:"Pour qui ?", type:(scopes.length>4?"select":"seg"), value:start, options:scopes,
        help:"Foyer : compte les tickets de tout le monde. Une personne : seulement les tickets qu'elle a payés.",
        onChange:function(v, api){ stash(api); curScope=v; list.forEach(function(c){ api.set(c, draft[v][c]||""); }); } });
      list.forEach(function(c){ fields.push({ key:c, label:(catIsMain(c) ? catIcon(c).e+"  "+c : "      ↳ "+c), type:"money", value:(draft[start][c]||"") }); });
      uiForm({ title:"Budgets mensuels", intro:"Un plafond par grande catégorie (tout compris) ou par sous-catégorie (seulement elle). Laisse vide pour ne pas suivre.", fields:fields, focus:false
      }, function(r, api){
        stash(api);
        if(draft.hasOwnProperty("__foyer")){ budgets=draft.__foyer; persistBudgets(); }
        var chP=false;
        scopes.forEach(function(o){ if(o.v==="__foyer") return; var d=draft[o.v]||{};
          if(Object.keys(d).length){ budgetsP[o.v]=d; chP=true; } else if(budgetsP[o.v]){ delete budgetsP[o.v]; chP=true; } });
        if(chP) persistBudgetsP();
        render();
      });
    }
