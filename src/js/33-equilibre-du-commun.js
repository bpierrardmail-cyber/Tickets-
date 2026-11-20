    // ---------- Équilibre du commun : qui doit combien à qui (✦ Plus) ----------
    // Payé pour le commun : les frais communs (en entier par le titulaire du compte qui les paie, ou chacun sa part),
    // les articles partagés (« Dépense commune », entre les personnes choisies sur le ticket) par la personne qui a payé le ticket, et les remboursements notés.
    // Part : la part de chacun dans ces mêmes dépenses. Ce qui reste d'un mois passe au suivant, à partir du 1er mois affiché (commBalFrom).
    function commProdOn(){ var v=state.comProd; if(v==null) v=store.read("comProd", true); return !!v; }
    function commMonthBal(month){
      var CM=communModel(month), D=CM.D, P={}, prodOn=commProdOn();
      function add(p, k, v){ p=(p||"").trim(); if(!p || p==="Commun") return; var o=P[p]||(P[p]={ paid:0, share:0 }); o[k]+=v; }
      (D.byP.Commun ? D.byP.Commun.items : []).forEach(function(f){ var v=fraisPartV(f, month); if(!v) return;
        CM.ppl.forEach(function(p){ var sh=v*CM.fPct(f, p)/100; if(sh>0.004){ add(p, "share", sh); if(f.split) add(p, "paid", sh); } });
        if(!f.split) add(fraisPayer(f), "paid", v); });
      if(prodOn && D.prod){
        state.entries.forEach(function(e){ if(monthKey(e.date)!==month) return; (e.articles||[]).forEach(function(a){ if(a.commun) add(payerOf(e), "paid", Number(a.prix)||0); }); });
        CM.ppl.forEach(function(p){ var sh=CM.prodShareOf(p); if(sh>0.004) add(p, "share", sh); });
      }
      commRemb.forEach(function(r){ if(r.month!==month) return; add(r.from, "paid", Number(r.montant)||0); add(r.to, "paid", -(Number(r.montant)||0)); });
      return { P:P, ppl:CM.ppl, me:CM.me, tot:D.commun+(prodOn?D.prod:0) };
    }
    function commBal(month){
      var from=store.read("commBalFrom", null)||month, carry={}, m=from, B=null, n=0;
      if(month<from) from=month;
      for(m=from; m<=month && n<240; m=nextMonthKey(m), n++){
        B=commMonthBal(m); B.carry=carry; var nx={};
        Object.keys(B.P).forEach(function(p){ var o=B.P[p]; o.carry=carry[p]||0; o.net=o.paid-o.share+o.carry; nx[p]=o.net; });
        Object.keys(carry).forEach(function(p){ if(!B.P[p] && Math.abs(carry[p])>0.004){ B.P[p]={ paid:0, share:0, carry:carry[p], net:carry[p] }; nx[p]=carry[p]; } });
        carry=nx;
      }
      // le moins de virements possible : le plus gros débiteur rembourse le plus gros créancier, et ainsi de suite
      var cr=[], db=[]; Object.keys(B.P).forEach(function(p){ var n0=B.P[p].net, v=(n0<0?-1:1)*Math.round(Math.abs(n0)*100+1e-6)/100; if(v>0.5) cr.push({ p:p, v:v }); else if(v<-0.5) db.push({ p:p, v:-v }); });
      var T=[]; cr.sort(function(a,b){ return b.v-a.v; }); db.sort(function(a,b){ return b.v-a.v; });
      var i=0, j=0; while(i<db.length && j<cr.length){ var x=Math.min(db[i].v, cr[j].v); if(x>0.5) T.push({ from:db[i].p, to:cr[j].p, v:Math.round(x*100)/100 }); db[i].v-=x; cr[j].v-=x; if(db[i].v<0.5) i++; if(cr[j].v<0.5) j++; }
      B.T=T; return B;
    }
    function commBalHTML(month){
      var who=function(p, me){ return p===me ? "Toi" : p; };
      if(!canUse("equilibre")){
        return '<section class="fct-teaser" style="margin-bottom:14px"><h3>✦ Qui doit combien à qui</h3><p>Ce que chacun a vraiment payé pour le commun, comparé à sa part, et les remboursements en un geste.</p>'+
          '<ul><li>« Tu dois 220 € à Marie »</li><li>Le moins de virements possible, même à 10</li><li>Reporté d\'un mois sur l\'autre, avec l\'historique</li></ul>'+
          '<button type="button" class="fct-plus" id="cbalBuy">✦ Équilibrer avec '+APP_NAME+' Plus</button></section>';
      }
      var B=commBal(month), me=B.me, L=Object.keys(B.P).filter(function(p){ var o=B.P[p]; return o.share>0.004 || Math.abs(o.paid)>0.004 || Math.abs(o.net)>0.004; });
      if(L.length<2) return "";
      L.sort(function(a,b){ return a===me ? -1 : (b===me ? 1 : B.P[b].net-B.P[a].net); });
      var mx=0; L.forEach(function(p){ mx=Math.max(mx, B.P[p].paid, B.P[p].share); }); if(!mx) mx=1;
      var h='<section class="paper cacc" id="cbal"><div class="cacc-h" style="cursor:default"><span class="t"><span class="tic">⚖️</span> Qui doit combien à qui<small>payé pour le commun, comparé à la part de chacun</small></span></div>';
      L.forEach(function(p){ var o=B.P[p], d=o.paid-o.share, w=Math.max(0, Math.min(100, o.paid/mx*100)), sw=Math.min(100, o.share/mx*100);
        h+='<div class="cbal-r" data-p="'+esc(p)+'"><span class="nm">'+esc(who(p, me))+'</span><div class="cbal-bar"><i style="width:'+w.toFixed(1)+'%;background:'+(d>=-0.5?'var(--accent)':'var(--coral)')+'"></i><u style="left:calc('+sw.toFixed(1)+'% - 1px)"></u></div>'+
           '<span class="v">'+fmtK(o.paid)+(Math.abs(d)>0.5?' <span class="'+(d>0?'cbal-up':'cbal-dn')+'">'+(d>0?'+':'−')+fmtK(Math.abs(d))+'</span>':'')+'</span></div>'; });
      h+='<div class="muted" style="font-size:11.5px">Le trait = la part de chacun</div>';
      h+='<div class="cbal-res">';
      if(!B.T.length) h+='<div class="cbal-tr"><span>✓ Tout est équilibré</span></div>';
      else {
        if(B.T.length>1) h+='<div class="muted" style="font-size:11.5px;padding-top:8px">'+B.T.length+' remboursements suffisent</div>';
        B.T.forEach(function(t, k){ var cf=B.P[t.from].carry||0, txt=(t.from===me) ? "Tu dois "+fmtS(t.v)+" à "+t.to : (t.to===me ? t.from+" te doit "+fmtS(t.v) : t.from+" doit "+fmtS(t.v)+" à "+t.to);
          h+='<div class="cbal-tr"><span>'+esc(txt)+(B.T.length===1 && cf<-0.5 ? '<small>dont '+esc(fmtS(-cf))+' reportés des mois d\'avant</small>' : '')+'</span><button type="button" class="cbal-ok" data-k="'+k+'">Remboursé</button></div>'; });
      }
      h+='</div>';
      var nR=commRemb.length;
      if(nR) h+='<div class="cbal-hist" id="cbalHist"><span>Historique des remboursements · '+nR+'</span><span>›</span></div>';
      return h+'</section>';
    }
    function commBalWire(month){
      if(!store.read("commBalFrom", null) && canUse("equilibre") && !fyMember()) store.write("commBalFrom", month<monthKey(todayISO()) ? month : monthKey(todayISO()));
      var bb=document.getElementById("cbalBuy"); if(bb) bb.onclick=function(){ plusShow("equilibre"); };
      var hb=document.getElementById("cbalHist"); if(hb) hb.onclick=commRembHistory;
      var bt=document.querySelectorAll(".cbal-ok"); if(!bt.length) return;
      var B=commBal(month);
      [].forEach.call(bt, function(b){ b.onclick=function(){ var t=B.T[+b.getAttribute("data-k")]; if(t) commRembForm(t, month, B.me); }; });
    }
    function commAcctOpts(){ return [{ v:"", l:"Pas dans l'appli" }].concat(comptes.filter(function(a){ return a.key!=="__tickets"; }).map(function(a){ var o=acctOwner(a); return { v:a.key, l:a.nom+(o?" · "+o:"") }; })); }
    function commRembForm(t, month, me, o){   // o = { note, save(rec), undo(rec) } pour un groupe ; sinon le commun du mois
      o=o||{}; var note=o.note||("Commun de "+monthLabelOf(month));
      var fa=payAcctOf(t.from), ta=payAcctOf(t.to), nm=function(p){ return p===me ? "toi" : p; };
      uiForm({ title:(t.from===me?"Toi":t.from)+" → "+(t.to===me?"toi":t.to), fields:[
        { key:"montant", label:"Montant remboursé", type:"money", value:t.v, required:true },
        { key:"how", label:"Comment", type:"seg", value:(fa || ta) ? "vir" : "none", options:[{ v:"vir", l:"Créer le virement" }, { v:"none", l:"Sans virement" }],
          help:"Sans virement : en liquide, ou déjà noté ailleurs.", onChange:function(v, api){ api.show("from", v==="vir"); api.show("to", v==="vir"); } },
        { key:"from", label:"Depuis le compte de "+nm(t.from), type:"select", value:fa ? fa.key : "", options:commAcctOpts(), hidden:!(fa || ta) },
        { key:"to", label:"Vers le compte de "+nm(t.to), type:"select", value:ta ? ta.key : "", options:commAcctOpts(), hidden:!(fa || ta) }
      ], ok:"Remboursé" }, function(r){
        var v=Math.abs(num(r.montant)); if(!(v>0)) return "Indique le montant.";
        var vir=[], td=todayISO(), mk=monthKey(td), day=+td.slice(8, 10);
        if(r.how==="vir"){
          if(!r.from && !r.to) return "Choisis au moins un compte, ou « Sans virement ».";
          if(r.from && r.from===r.to) return "Choisis deux comptes différents.";
          if(r.from){ var ov={ id:virNewId(), person:r.from, month:mk, label:"Remboursement · "+t.to, note:note, montant:-v, day:day, done:true }; virements.push(ov); vir.push(ov.id); }
          if(r.to){ var n={ id:virNewId(), person:r.to, month:mk, label:"Remboursement · "+t.from, note:note, montant:v, day:day, done:true }; virements.push(n); vir.push(n.id); }
          if(vir.length) persistVirements();
        }
        var rec={ id:virNewId(), month:month, from:t.from, to:t.to, montant:Math.round(v*100)/100, date:td }; if(vir.length) rec.vir=vir;
        if(o.save){ o.save(rec); render(); uiUndoToast("Remboursement noté"+(vir.length?" · virement créé":""), "Annuler", function(){ o.undo(rec); uiToast("Remboursement retiré"); }); return; }
        commRemb.push(rec); persistRemb(); render();
        uiUndoToast("Remboursement noté"+(vir.length?" · virement créé":""), "Annuler", function(){ commRembDel(rec.id); uiToast("Remboursement retiré"); });
      });
    }
    function commRembDel(id){
      var r=commRemb.filter(function(x){ return String(x.id)===String(id); })[0]; if(!r) return;
      if(r.vir && r.vir.length){ virements=virements.filter(function(v){ return r.vir.indexOf(v.id)<0; }); persistVirements(); }
      commRemb=commRemb.filter(function(x){ return String(x.id)!==String(id); }); persistRemb(); render();
    }
    function commRembHistory(){
      var me=mePerson(), L=commRemb.slice().sort(function(a,b){ return String(b.date||"").localeCompare(String(a.date||"")) || (+b.id||0)-(+a.id||0); });
      var h='<div class="sheet-title">Remboursements</div><div class="ui-stack" style="gap:0">';
      if(!L.length) h+='<div class="muted">Aucun remboursement.</div>';
      L.forEach(function(r){ h+='<button type="button" class="dr-row tall" data-id="'+esc(r.id)+'"><span class="t">'+esc((r.from===me?"Toi":r.from)+" → "+(r.to===me?"toi":r.to))+'<small>'+esc((r.date||"").split("-").reverse().join("/")+" · commun de "+monthLabelOf(r.month)+" · "+(r.vir&&r.vir.length?"virement":"sans virement"))+'</small></span><span class="st">'+esc(fmtS(r.montant))+'</span></button>'; });
      h+='<button type="button" class="btn ghost ui-no" style="margin-top:10px">Fermer</button></div>';
      var s=uiSheet(h); s.q(".ui-no").onclick=s.close;
      [].forEach.call(s.qa(".dr-row[data-id]"), function(b){ b.onclick=function(){ var id=b.getAttribute("data-id"), r=commRemb.filter(function(x){ return String(x.id)===String(id); })[0]; if(!r) return; s.close();
        uiChoice("Remboursement de "+fmtS(r.montant), esc(r.vir && r.vir.length ? "Le supprimer retire aussi le virement créé." : "Noté sans virement."), [{ l:"Supprimer", danger:true, fn:function(){
          var keep=JSON.parse(JSON.stringify(r)), vs=virements.filter(function(v){ return (r.vir||[]).indexOf(v.id)>=0; });
          commRembDel(id);
          uiUndoToast("Remboursement supprimé", "Annuler", function(){ commRemb.push(keep); vs.forEach(function(v){ virements.push(v); }); persistRemb(); persistVirements(); render(); });
        } }]); }; });
    }
