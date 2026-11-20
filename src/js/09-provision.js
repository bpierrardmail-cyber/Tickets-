    // ---------- Provision : ce qui arrive sur le compte de la provision ----------
    // La mise de côté (frais relié f.prov) sort du compte qui paie ; si l'argent de la provision est sur un autre compte bancaire, elle y entre :
    // montant du mois moins ce que ce compte aurait payé lui-même (il n'en sort rien). Un seul rond « fait » (f.doneMonths) pour les deux côtés.
    function provInAmt(f, key, month){
      if(f.prov==null || !f.provFrom || month<f.provFrom || f.pp!=null || !fraisActif(f, month)) return 0;
      var pv=provById(f.prov); if(!pv || pv.noFrais || !provOnAcct(pv, key)) return 0;
      var own=fraisKind(f, key) ? fraisAcctAmt(f, key, month, true) : 0, v=fraisMontant(f, month)-own;
      return v>0.004 ? Math.round(v*100)/100 : 0;
    }
    function provInSum(key, month, doneOnly){ var st0=acctStart(key); if(st0 && month<st0) return 0; var t=0; fraisCommuns.forEach(function(f){ if(f.prov==null || (doneOnly && !fraisDone(f, month))) return; t+=provInAmt(f, key, month); }); return t; }
    // d'où vient la mise de côté (pour la ligne du compte qui la reçoit)
    function provPayAcct(f){ if(f.compte && acctByKey(f.compte)) return acctByKey(f.compte); var w=(f.personne||"").trim()||"Commun"; if(w==="Commun") return f.split ? null : mainAcct(); return payAcctOf(w); }
    function provInFrom(f){ if(((f.personne||"").trim()||"Commun")==="Commun" && f.split && !(f.compte && acctByKey(f.compte))) return "chacun depuis son compte"; var a=provPayAcct(f); return a ? "depuis "+a.nom : "depuis le compte de "+((f.personne||"").trim()||"?"); }
    // provision sur un livret : cocher la mise de côté ajoute le montant au livret (comme un virement vers l'épargne) ; décocher le retire
    function provEpSync(f, month){
      if(!f || f.prov==null || !f.provFrom || month<f.provFrom) return;
      var pv=provById(f.prov), w=pv ? provWhere(pv) : ""; if(w.indexOf("ep:")!==0) return;
      var want=fraisDone(f, month) && fraisActif(f, month) ? Math.round(fraisMontant(f, month)*100)/100 : 0, have=(f.epDone && f.epDone[month]) || 0;
      if(Math.abs(want-have)<0.005) return;
      applyEp(w.slice(3), want-have); if(!f.epDone) f.epDone={}; if(want) f.epDone[month]=want; else delete f.epDone[month];
    }
    function virementsSum(p,m){ return virementsOf(p,m).reduce(function(t,v){ return t+(Number(v.montant)||0); },0)+provInSum(p, m, false); }
