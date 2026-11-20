    // ---------- Virements reliés (mouvements internes) ----------
    // Un virement peut aller vers / venir de : un autre compte de l'appli (v.vers = "cpt:<clé>"), un livret (v.epargneId, comme avant)
    // ou un compte de la Bourse (v.bourseId, Perso). Compte → compte : la ligne d'en face est créée par virLinkSync (téléphone du propriétaire),
    // v.pairOf = id du virement d'origine ; montant opposé, même mois, même rond « fait » ; modifier ou supprimer l'une change l'autre.
    // Un virement déjà là sur le compte d'en face (même mois, montant opposé, pas relié) est repris plutôt que doublé (pairAdopt).
    function virById(id){ return virements.filter(function(x){ return String(x.id)===String(id); })[0]||null; }
    function virSrcOf(v){ return (v && v.pairOf!=null) ? (virById(v.pairOf)||v) : v; }
    function virLinkVal(v){ if(!v) return ""; if(v.vers) return v.vers; if(v.epargneId!=null) return "ep:"+v.epargneId; if(v.bourseId!=null) return "bourse:"+v.bourseId; return ""; }
    function virLinkName(val){ val=String(val||""); if(val.indexOf("cpt:")===0){ var a=acctByKey(val.slice(4)); return a ? a.nom : "un compte"; } if(val.indexOf("ep:")===0) return epNameOf(val.slice(3))||"épargne";
      if(val.indexOf("bourse:")===0){ var b=bourse.filter(function(x){ return String(x.id)===val.slice(7); })[0]; return b ? b.nom+" (Bourse)" : "Bourse"; } return ""; }
    function virLinkOpts(cur){
      var o=[{ v:"", l:"Extérieur (rien à relier)" }];
      comptes.forEach(function(a){ if(a.key==="__tickets" || a.key===cur) return; var ow=acctOwner(a); o.push({ v:"cpt:"+a.key, l:a.nom+(ow ? " · "+ow : "") }); });
      epargne.filter(function(c){ return !c.bourseLink; }).forEach(function(c){ o.push({ v:"ep:"+c.id, l:c.nom+" (épargne)" }); });
      if(FEAT.bourse) bourse.filter(function(b){ return !b.closed; }).forEach(function(b){ o.push({ v:"bourse:"+b.id, l:b.nom+" (Bourse)" }); });
      return o;
    }
    // Bourse : un virement « fait » vers un compte-titres ajoute au reste à investir et au capital (et l'inverse pour un retrait)
    function applyBourse(id, delta){
      var b=bourse.filter(function(x){ return String(x.id)===String(id); })[0]; if(!b || !(Math.abs(delta)>0.004)) return;
      var m=monthKey(todayISO()), src=bAt(b, m)||{ capital:0, valeur:0 }; if(!b.vals) b.vals={};
      var o=b.vals[m] || JSON.parse(JSON.stringify(src)); b.vals[m]=o;
      o.capital=Math.round(((Number(o.capital)||0)+delta)*100)/100;
      if(!o.cashCur || o.cashCur===BASE){ o.cash=Math.round((bCash(o)+delta)*100)/100; delete o.cashOrig; delete o.cashCur; if(o.cash<=0.004) delete o.cash; }
      persistBourse();
    }
    // les effets d'un virement « fait » sur un livret ou la Bourse, remis à jour (appelé après chaque changement)
    function virLinkApply(v){
      if(v.epargneId!=null){ var want=v.done ? -(Number(v.montant)||0) : 0, have=v.epApplied||0; if(Math.abs(want-have)>0.004){ applyEp(v.epargneId, want-have); v.epApplied=want; } }
      if(v.bourseId!=null){ var wb=v.done ? -(Number(v.montant)||0) : 0, hb=v.bApplied||0; if(Math.abs(wb-hb)>0.004){ applyBourse(v.bourseId, wb-hb); v.bApplied=wb; } }
    }
    function virLinkSet(v, val){
      val=String(val||""); if(virLinkVal(v)===val) return;
      if(v.epargneId!=null && v.epApplied) applyEp(v.epargneId, -v.epApplied);
      if(v.bourseId!=null && v.bApplied) applyBourse(v.bourseId, -v.bApplied);
      delete v.epargneId; delete v.epApplied; delete v.bourseId; delete v.bApplied; delete v.vers;
      if(val.indexOf("ep:")===0){ var ep=epargneById(val.slice(3)); if(ep){ v.epargneId=ep.id; v.epApplied=0; } }
      else if(val.indexOf("bourse:")===0){ v.bourseId=val.slice(7); v.bApplied=0; }
      else if(val.indexOf("cpt:")===0 && acctByKey(val.slice(4)) && val.slice(4)!==v.person) v.vers=val;
      virLinkApply(v);
    }
    function virLinkSync(){
      if(fyMember()) return false;
      var ch=false, byPair={}, src={};
      virements.forEach(function(x){ if(x.pairOf!=null) byPair[String(x.pairOf)]=x; if(x.vers) src[String(x.id)]=x; });
      virements.slice().forEach(function(v){
        if(!v.vers || v.pairOf!=null) return;
        var tk=v.vers.slice(4); if(!acctByKey(tk) || tk===v.person) return;
        var a=Number(v.montant)||0, m=byPair[String(v.id)];
        if(!m){
          m=virements.filter(function(x){ return x!==v && x.person===tk && x.month===v.month && x.pairOf==null && !x.vers && x.epargneId==null && x.bourseId==null && !byPair["a"+x.id] && Math.abs((Number(x.montant)||0)+a)<0.006; })[0];
          if(m){ m.pairOf=v.id; m.pairAdopt=1; if(m.done && !v.done){ v.done=true; } }
          else { m={ id:virNewId(), person:tk, month:v.month, label:v.label||"Virement", montant:-a, pairOf:v.id }; virements.push(m); }
          byPair[String(v.id)]=m; ch=true;
        }
        var sa=acctByKey(v.person), want={ month:v.month, montant:-a, done:!!v.done };
        if(!m.pairAdopt){ want.label=v.label||"Virement"; want.note=(a<0 ? "depuis " : "vers ")+((sa && sa.nom)||"un compte"); }
        for(var k in want){ if(m[k]!==want[k]){ m[k]=want[k]; ch=true; } }
        var d=virDay(v); if(d && m.day!==d){ m.day=d; ch=true; }
      });
      virements=virements.filter(function(x){
        if(x.pairOf==null) return true; var s0=src[String(x.pairOf)];
        if(s0 && s0.vers==="cpt:"+x.person) return true;
        ch=true; if(x.pairAdopt){ delete x.pairOf; delete x.pairAdopt; return true; } return false; });
      if(ch) persistVirements();
      return ch;
    }
    function toggleVirementDone(id){
      var v=virSrcOf(virById(id)); if(!v) return; id=v.id;
      v.done=!v.done;
      if(v.done){ var td=todayDay(v.month), vd=dayFix(v.day, v.month); if(td && (!vd || vd>td)){ v.day=td; v.dayAuto=1; } }   // le jour où c'est passé (relevé du compte) : aujourd'hui, sauf jour déjà noté avant
      else if(v.dayAuto){ delete v.day; delete v.dayAuto; }   // décoché : on oublie le jour mis en cochant
      virLinkApply(v); virLinkSync();
      persistVirements(); render();
    }
    var soldeInit = store.read("soldeInit", {});
    function persistSoldeInit(){ store.write("soldeInit", soldeInit); }
    function getSoldeInit(p,m){ return (soldeInit[p] && (m in soldeInit[p])) ? Number(soldeInit[p][m]) : null; }
    function setSoldeInit(p,m,v){ if(!soldeInit[p]) soldeInit[p]={}; soldeInit[p][m]=v; persistSoldeInit(); }
    function clearSoldeInit(p,m){ if(soldeInit[p]) delete soldeInit[p][m]; persistSoldeInit(); }
    function virementsOf(p,m){ return virements.filter(function(v){ return v.person===p && v.month===m; }); }
