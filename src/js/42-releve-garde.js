    // ---------- Relevé gardé : les lignes de banque servent à vérifier les factures et les tickets ----------
    // `releve` (sur le téléphone, dans la sauvegarde) : { d, n, a, k, c, i } = date, libellé, montant (signé), clé, compte, n° d'import.
    // Avant cette liste, on retrouve les lignes dans ce que l'import a créé : tickets « relevé » et frais fixes importés.
    function releveKeep(M, acct, imp){
      var R=store.read("releve", [])||[], seen={}; R.forEach(function(x){ seen[x.k+"|"+x.c]=1; });
      function add(L, d){ if(!L || !L.key || seen[L.key+"|"+acct]) return; seen[L.key+"|"+acct]=1; R.push({ d:d||L.date||L.d, n:L.name, a:L.amt, k:L.key, c:acct, i:imp }); }
      M.cards.forEach(function(L){ add(L, L.date||L.d); }); M.vir.forEach(function(L){ add(L, L.d); }); M.prlv.forEach(function(g){ g.occ.forEach(function(L){ add(L, L.d); }); });
      store.write("releve", R);
    }
    function bankLines(){
      var R=(store.read("releve", [])||[]).slice(), keys={}; R.forEach(function(x){ keys[x.k]=1; });
      state.entries.forEach(function(e){ if(e.impKey && !keys[e.impKey] && e.date) R.push({ d:e.date, n:e.marchand||"", a:-(Number(e.montant)||0), k:e.impKey, c:e.compte, t:e.id }); });
      fraisCommuns.forEach(function(f){ if(!f.imp || !f.doneDays) return;
        Object.keys(f.doneDays).forEach(function(m){ var dd=f.doneDays[m]; if(!dd || !(f.doneMonths||{})[m]) return; var v=fraisMontant(f, m); if(!(v>0)) return;
          var d=m+"-"+(dd<10?"0":"")+dd; if(R.some(function(x){ return x.d===d && Math.abs(Math.abs(x.a)-v)<0.006; })) return;
          R.push({ d:d, n:f.label||"", a:-v, k:"f"+f.id+m, c:f.compte }); }); });
      return R;
    }
    var BANK_STOP={ carte:1, cb:1, prlv:1, prelevement:1, sepa:1, paiement:1, achat:1, facture:1, sas:1, sarl:1, magasin:1, super:1, hyper:1, market:1, france:1, vir:1, virement:1, ech:1, echeance:1, prel:1, retrait:1, dab:1, the:1, les:1, des:1 };
    function bankWords(t){ return norm(t).split(" ").filter(function(w){ return w.length>=3 && !BANK_STOP[w]; }); }
    function bankNameMatch(a, b){ var A=bankWords(a), B=bankWords(b); if(!A.length || !B.length) return false;
      return A.some(function(t){ return B.some(function(u){ return u===t || (t.length>=5 && u.indexOf(t)===0) || (u.length>=5 && t.indexOf(u)===0); }); }); }
    // le paiement du relevé qui correspond : même nom, dans la période, montant égal (exact) ou proche (près, `tol` en part du montant)
    function bankFind(name, amt, from, to, tol){
      var best=null; if(!name || !(amt>0) || !from) return null;
      bankLines().forEach(function(x){ if(!(x.a<0) || x.d<from || x.d>to || !bankNameMatch(name, x.n)) return;
        var v=-x.a, df=Math.abs(v-amt), exact=df<0.006; if(!exact && df>Math.max(1, amt*(tol||0.25))) return;
        var sc=(exact?1000:0)-df; if(!best || sc>best.sc) best={ sc:sc, x:x, v:v, exact:exact }; });
      return best;
    }
    function impApply(M, open){
      var S=impState, id=Date.now(), seq=0, A=acctByKey(S.target), owner=acctOwner(A)||"", made={ t:0, f:0, v:0, r:0 };
      function nid(){ seq++; return id+seq; }
      var moved=[];
      M.cards.forEach(function(L){ if(!L.on) return;
        if(L.dupOther && L.hit){ var ex=state.entries.filter(function(e){ return String(e.id)===String(L.hit); })[0]; if(ex){ moved.push({ id:ex.id, compte:(ex.compte==null?null:ex.compte) }); ex.compte=S.target; made.m=(made.m||0)+1; return; } }
        state.entries.unshift({ id:nid(), date:L.date, marchand:L.name, montant:impR2(-L.amt), categorie:L.cat, payePar:owner, compte:S.target, articles:[], photo:false, src:"releve", imp:id, impKey:L.key });
        made.t++; });
      M.prlv.forEach(function(g){ if(!g.on) return;
        var who=owner||"Commun";
        if(g.freq==="m"){
          var f={ id:nid(), label:g.name, montant:impR2(-g.occ[0].amt), personne:who, recurrent:true, month:null, startMonth:g.months[0], compte:S.target, doneMonths:{}, imp:id, impKeys:g.keys };
          var am={}, last=null; g.occ.forEach(function(L){ var v=impR2(-L.amt); if(last===null || Math.abs(v-last)>0.004){ am[L.m]=v; last=v; } });
          if(Object.keys(am).length>1) f.amounts=am;
          g.months.forEach(function(m){ f.doneMonths[m]=true; });
          f.doneDays={}; g.occ.forEach(function(L){ f.doneDays[L.m]=+L.d.slice(8, 10); }); f.jour=+g.occ[g.occ.length-1].d.slice(8, 10);   // jour du prélèvement : relevé du compte
          for(var m=g.months[0]; m<g.months[g.months.length-1]; m=nextMonthKey(m)){ if(!g.ms[m]){ if(!f.skipMonths) f.skipMonths={}; f.skipMonths[m]=true; } }   // pas prélevé ce mois-là
          if(g.ended) f.endMonth=g.ended;   // plus prélevé depuis : arrêté
          fraisCommuns.push(f); made.f++; made.r++;
        } else g.occ.forEach(function(L){ var dm={}, dd={}; dm[L.m]=true; dd[L.m]=+L.d.slice(8, 10);
          fraisCommuns.push({ id:nid(), label:g.name, montant:impR2(-L.amt), personne:who, recurrent:false, month:L.m, compte:S.target, doneMonths:dm, doneDays:dd, imp:id, impKeys:[L.key] }); made.f++; });
      });
      M.vir.forEach(function(L){ if(!L.on) return;
        var v={ id:nid(), person:S.target, month:L.m, day:+L.d.slice(8, 10), label:L.name, note:impDM(L.d)+" · relevé", montant:L.amt, done:true, imp:id, impKey:L.key };
        if(L.ep && String(L.ep).indexOf("cpt:")===0){ if(acctByKey(String(L.ep).slice(4))) v.vers=String(L.ep); }   // virement relié : la ligne d'en face est créée par virLinkSync
        else if(L.ep && L.amt<0){ var ep=epargneById(L.ep); if(ep && !ep.bourseLink){ v.epargneId=ep.id; var delta=-v.montant; applyEp(ep.id, delta); v.epApplied=delta; } }
        virements.push(v); made.v++; });
      var paid=[], dayed=[];
      M.cards.concat(M.vir).forEach(function(L){ if(!L.on){ markPaid(L); dayVir(L); } }); M.prlv.forEach(function(g){ if(!g.on) g.occ.forEach(markPaid); });   // laissé de côté = c'est ce frais-là
      // déjà dans l'appli sans jour : le jour du relevé (pour la liste du compte)
      function dayVir(L){ if(!L.vref) return; var v=virements.filter(function(x){ return String(x.id)===String(L.vref); })[0]; if(!v) return; var e={ t:"v", id:v.id, dy:0, dn:0 };
        if(!v.done){ e.od=(v.day!=null ? v.day : null); v.day=+L.d.slice(8, 10); e.dy=1; v.done=true; e.dn=1; delete v.dayAuto;   // il est passé à la banque, ce jour-là
          if(v.epargneId){ var dl=-(Number(v.montant)||0); applyEp(v.epargneId, dl); v.epApplied=dl; } }
        else if(!dayFix(v.day, v.month)){ v.day=+L.d.slice(8, 10); e.dy=1; }
        if(e.dy || e.dn) dayed.push(e); }
      function markPaid(L){ (L.refs || (L.ref ? [L.ref] : [])).forEach(function(R){ markOne(L, R); }); }
      function markOne(L, R){ if(!R || R.t!=="f") return; var f=fraisCommuns.filter(function(x){ return String(x.id)===String(R.id); })[0]; if(!f) return;
        if(fraisDone(f, R.m)){ if(!(f.doneDays && f.doneDays[R.m])){ if(!f.doneDays) f.doneDays={}; f.doneDays[R.m]=+L.d.slice(8, 10); dayed.push({ t:"f", id:f.id, m:R.m }); } return; }
        if(!f.doneMonths) f.doneMonths={}; f.doneMonths[R.m]=true; provEpSync(f, R.m); var pd={ id:f.id, m:R.m };
        if(!(f.doneDays && f.doneDays[R.m])){ if(!f.doneDays) f.doneDays={}; f.doneDays[R.m]=+L.d.slice(8, 10); pd.dd=1; }   // le jour du relevé
        paid.push(pd); }
      var si=null;
      if(open!=null && S.setOpen){ var m0=M.first.slice(0, 7); si={ m:m0, prev:getSoldeInit(S.target, m0) }; setSoldeInit(S.target, m0, open); }
      persist(); persistFrais(); persistVirements();
      var bank=impBankBal(M);
      // un ticket déjà saisi au même nom et à peu près le même montant : le relevé donne le vrai total
      var fixed=[]; M.cards.forEach(function(L){ if(!L.fixT || (L.on && !L.dupOther)) return; var e=state.entries.filter(function(x){ return String(x.id)===String(L.fixT.id); })[0]; if(!e) return; fixed.push({ id:e.id, m:e.montant }); e.montant=L.fixT.to; });
      if(fixed.length) persist();
      releveKeep(M, S.target, id);
      store.write("lastImport", { id:id, acct:S.target, at:todayISO(), file:S.fileName, n:made, si:si, moved:moved, paid:paid, dayed:dayed, fixed:fixed });
      impState=null;
      state.compteSel=S.target; store.write("compteSel", S.target);
      if(!state.months) state.months={}; state.months.compte=(bank ? bank.d : M.last).slice(0, 7);
      state.view="compte"; render(); window.scrollTo(0, 0);
      var fin=null; try{ fin=acctFigures(S.target, (bank ? bank.d : M.last).slice(0, 7)).banque; }catch(e){}
      var same=bank && fin!=null && Math.abs(fin-bank.v)<0.01;
      var msg=made.t+' ticket'+(made.t>1?'s':'')+(made.m?' (+ '+made.m+' déplacé'+(made.m>1?'s':'')+' sur ce compte)':'')+' · '+made.f+' frais fixe'+(made.f>1?'s':'')+(made.r?' ('+made.r+' chaque mois)':'')+' · '+made.v+' virement'+(made.v>1?'s':'')+(si?' · solde de départ '+impMoney(open):'')+'.'+(paid.length?' '+paid.length+' frais fixe'+(paid.length>1?'s':'')+' déjà présent'+(paid.length>1?'s':'')+' marqué'+(paid.length>1?'s':'')+' payé'+(paid.length>1?'s':'')+'.':'');
      var why=[], offN=0, otherN=0; M.cards.concat(M.vir).forEach(function(L){ if(!L.on){ if(!L.dup) offN++; else if(L.dupOther) otherN++; } }); M.prlv.forEach(function(g){ if(!g.on && !g.dup) offN+=g.occ.length; });
      if(offN) why.push(offN+' ligne'+(offN>1?'s':'')+' décochée'+(offN>1?'s':''));
      if(otherN) why.push(otherN+' ticket'+(otherN>1?'s':'')+' resté'+(otherN>1?'s':'')+' sur un autre compte');
      if(!why.length) why.push('des opérations qui étaient déjà dans le compte');
      var gap=(bank && fin!=null && !same) ? impR2(bank.v-fin) : 0, hints=gap ? impGapHints(M, gap, id, bank.d.slice(0, 7), S.target) : [];
      if(gap && !hints.length && !si){ var mS0=M.first.slice(0, 7), siV=getSoldeInit(S.target, mS0); if(siV!==null) hints.push("le solde de départ "+impDeMois(mS0)+" déjà saisi ("+impMoney(siV)+")"); }
      if(bank && fin!=null) msg+='<br>Solde du compte au '+impDM(bank.d)+' : <b>'+impMoney(impR2(fin))+'</b>'+(same?', comme ta banque.':' (banque : '+impMoney(bank.v)+').'+
        (hints.length ? '<br>L\'écart de <b>'+impMoney(Math.abs(gap))+'</b> correspond peut-être à :<br>'+hints.map(function(x){ return '· '+esc(x); }).join('<br>') : ' L\'écart vient de : '+why.join(', ')+'.'));
      var s=uiSheet('<div class="sheet-title">Relevé importé</div><div class="ui-msg">'+msg+'</div><div class="ui-actions"><button type="button" class="btn ghost" id="impUndo">Annuler l\'import</button><button type="button" class="btn primary ui-yes">OK</button></div>');
      s.q(".ui-yes").onclick=s.close; s.q("#impUndo").onclick=function(){ s.close(); impUndo(true); };
    }
    function impUndo(direct){
      var L=store.read("lastImport", null); if(!L) return;
      function doIt(){
        virements.forEach(function(v){ if(v.imp===L.id && v.epargneId && v.epApplied) applyEp(v.epargneId, -v.epApplied); });
        state.entries=state.entries.filter(function(e){ return e.imp!==L.id; });
        (L.fixed||[]).forEach(function(fx){ state.entries.forEach(function(e){ if(String(e.id)===String(fx.id)) e.montant=fx.m; }); });
        store.write("releve", (store.read("releve", [])||[]).filter(function(x){ return x.i!==L.id; }));
        (L.paid||[]).forEach(function(pd){ fraisCommuns.forEach(function(f){ if(String(f.id)!==String(pd.id)) return; if(f.doneMonths) delete f.doneMonths[pd.m]; provEpSync(f, pd.m); if(pd.dd && f.doneDays) delete f.doneDays[pd.m]; }); });
        (L.dayed||[]).forEach(function(dd){ if(dd.t==="v") virements.forEach(function(v){ if(String(v.id)!==String(dd.id)) return; if(dd.dy || dd.dy===undefined){ if(dd.od!=null) v.day=dd.od; else delete v.day; }
            if(dd.dn){ if(v.epargneId && v.epApplied) applyEp(v.epargneId, -v.epApplied); v.epApplied=0; v.done=false; } });
          else fraisCommuns.forEach(function(f){ if(String(f.id)===String(dd.id) && f.doneDays) delete f.doneDays[dd.m]; }); });
        (L.moved||[]).forEach(function(mv){ state.entries.forEach(function(e){ if(String(e.id)===String(mv.id)){ if(mv.compte==null) delete e.compte; else e.compte=mv.compte; } }); });
        virements=virements.filter(function(v){ return v.imp!==L.id; });
        fraisCommuns=fraisCommuns.filter(function(f){ return f.imp!==L.id; });
        if(L.si){ if(L.si.prev===null || L.si.prev===undefined) clearSoldeInit(L.acct, L.si.m); else setSoldeInit(L.acct, L.si.m, L.si.prev); }
        persist(); persistVirements(); persistFrais(); store.write("lastImport", null); render(); uiToast("Import annulé");
      }
      if(direct) return doIt();
      var n=L.n||{}; uiConfirm("Annuler l'import du "+esc(String(L.at||"").split("-").reverse().join("/"))+" ?<br>"+(n.t||0)+" tickets, "+(n.f||0)+" frais fixes et "+(n.v||0)+" virements seront retirés"+(L.si?", et le solde de départ remis comme avant":"")+".", doIt, { ok:"Annuler l'import", no:"Garder", danger:true });
    }

