    // ---------- Magasin reconnu par son SIRET ou son téléphone (18/11) ----------
    // tkMag (sur le téléphone, dans la sauvegarde) = {"s:<SIRET ou SIREN>" | "t:<téléphone>": nom du magasin}, appris à l'enregistrement d'un ticket scanné
    function tkMagIds(lines){
      var ids=[], t=(lines||[]).slice(0, 25).join("\n"), m;
      var re=/sire[tn]\D{0,6}((?:\d[ .]?){9,14})/gi; while((m=re.exec(t))){ var d=m[1].replace(/\D/g, ""); if(d.length===14 || d.length===9) ids.push("s:"+d); }
      var rt=/(?:^|[^\d])(0[1-9](?:[ .]?\d{2}){4})(?!\d)/g; while((m=rt.exec(t))){ ids.push("t:"+m[1].replace(/\D/g, "")); }
      return ids.filter(function(x, i){ return ids.indexOf(x)===i && !/^.:0+$/.test(x) && !/^.:(\d)\1+$/.test(x); });
    }
    function tkMagFind(lines){ var M=store.read("tkMag", {})||{}, ids=tkMagIds(lines); for(var i=0;i<ids.length;i++){ if(typeof M[ids[i]]==="string" && M[ids[i]]) return M[ids[i]]; } return ""; }
    function tkMagLearn(lines, nom){
      nom=String(nom||"").trim(); if(!nom || nom==="Sans nom") return; var ids=tkMagIds(lines); if(!ids.length) return;
      var M=store.read("tkMag", {})||{}, ch=false; ids.forEach(function(k){ if(M[k]!==nom){ M[k]=nom; ch=true; } });
      var ks=Object.keys(M); if(ks.length>800) ks.slice(0, ks.length-800).forEach(function(k){ delete M[k]; });
      if(ch) store.write("tkMag", M);
    }
    // Retrait d'espèces (« RETRAIT », « DAB ») : sortie du compte vers le liquide, ou une dépense ordinaire
    function tkRetraitLike(d){ var t=String(d.marchand||"")+" "+((d.scan && d.scan.lines) ? d.scan.lines.slice(0, 40).join(" ") : "");
      return /\b(RETRAIT|DAB|DISTRIBUTEUR|WITHDRAWAL)\b/i.test(t); }
    function tkRetraitAsk(montant){
      var d=state.draft, a=(d.compte && acctByKey(d.compte)) || payAcctOf(payerOf(d)) || mainAcct();
      uiChoice("Retrait d'espèces ?", esc("Un retrait n'est pas une dépense : l'argent passe de ton compte à ton porte-monnaie."), [
        { l:"Mettre dans mon liquide", fn:function(){
          var dt=d.date||todayISO(), m=dt.slice(0, 7), k=a ? a.key : null; if(!k){ d.retAsked=true; saveDraft(); return; }
          virements.push({ id:Date.now(), person:k, month:m, label:"Retrait d'espèces", note:"", montant:-montant, day:+dt.slice(8, 10)||0, done:true, liqAdd:{ k:k, m:m, a:montant } }); persistVirements();
          var q=liquideAt(k, m), cur=q ? Number(q.val)||0 : 0; if(!liquideMois[k]) liquideMois[k]={}; liquideMois[k][m]=Math.round((cur+montant)*100)/100; persistLiquide();
          persist(); state.view=formBackView(); state.draft=null; render(); uiToast(fmtS(montant)+" sortis de "+(a.nom||"ton compte")+" et ajoutés à ton liquide"); } },
        { l:"Garder comme une dépense", primary:false, fn:function(){ d.retAsked=true; saveDraft(); } } ]);
    }
    function delDraft(){
      if(state.draftRO) return;
      var id=state.draft && state.draft.id;
      state.view=formBackView(); state.draft=null;
      if(id!=null) delEntryUndo(id); else render();
    }
