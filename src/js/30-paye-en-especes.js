    // ---------- Payé en espèces (18/11) ----------
    // e.pay = "esp" : payé en espèces. e.liq = {k: compte, m: "AAAA-MM", a: montant} : pris dans le liquide de ce compte ce mois-là
    // (le liquide baisse, pas le compte en banque : tkBank). Sans e.liq : argent d'ailleurs, ni compte ni liquide. Dans les deux cas, une dépense
    // comme les autres (Budget, Analyse, Foyer, partage). Le liquide est modifié à l'enregistrement (tkLiqDo) et rendu à la suppression (tkLiqUndo).
    function tkLiqAcct(d){ var a=payAcctOf(payerOf(d)) || mainAcct() || null; return (a && a.key!=="__tickets") ? a : null; }   // le liquide de la personne qui a payé (gardé avec son compte principal), pas un compte au choix
    function tkLiqWho(a){ var o=a ? (acctOwner(a)||"") : ""; return (!o || o===mePerson()) ? null : o; }   // null = toi
    function tkLiqCan(a){ return !!a && (!fyMember() || fyTabEd("compte")); }   // membre du foyer : seulement avec l'onglet Compte en modification
    function tkLiqAvail(d, a){
      var m=String(d.date||todayISO()).slice(0, 7), q=liquideAt(a.key, m); if(!q) return null;
      var v=q.val, old=d.id!=null ? state.entries.filter(function(e){ return String(e.id)===String(d.id); })[0] : null;
      if(old && old.pay==="esp" && old.liq && old.liq.k===a.key && old.liq.m===q.month) v+=Number(old.liq.a)||0;   // ce ticket déjà pris dans ce liquide : son montant revient d'abord
      return Math.round(v*100)/100;
    }
    function tkLiqUndo(e){ var L=e && e.pay==="esp" && e.liq; if(!L || !acctByKey(L.k)) return; var lq=liquideMois[L.k]; if(lq && lq[L.m]!=null){ lq[L.m]=Math.round(((Number(lq[L.m])||0)+(Number(L.a)||0))*100)/100; persistLiquide(); } }
    function tkLiqDo(e){ var L=e && e.pay==="esp" && e.liq; if(!L || !acctByKey(L.k)) return; var q=liquideAt(L.k, L.m), cur=q ? q.val : 0; if(!liquideMois[L.k]) liquideMois[L.k]={}; liquideMois[L.k][L.m]=Math.round((cur-(Number(L.a)||0))*100)/100; persistLiquide(); }
    function tkLiqSum(k, m){ return state.entries.reduce(function(t, e){ var q=e.liq; return t+((e.pay==="esp" && q && q.k===k && q.m===m) ? (Number(q.a)||0) : 0); }, 0); }
    function tkLiqFromOk(x, m){   // liquide d'un ticket venu d'un membre : un vrai compte qu'il voit, l'onglet Compte en modification, le montant du ticket
      var L=x.liq; if(!L || typeof L!=="object" || typeof L.k!=="string" || !acctByKey(L.k) || !/^[0-9]{4}-[0-9]{2}$/.test(String(L.m))) return false;
      if(typeof L.a!=="number" || !isFinite(L.a) || Math.abs(L.a-(Number(x.montant)||0))>0.005) return false;
      if(fyEdTabs(m).indexOf("compte")<0) return false;
      return m.accts==null || !!fyRules(m).acc[L.k];
    }
    // « ESPECES », « RENDU » sur le ticket (et pas de carte bancaire) : payé en espèces
    function tkCashWord(lines){
      var cash=null, card=false;
      (lines||[]).slice(0, 150).forEach(function(l){ var u=String(l).toUpperCase(), am=/([0-9]+[.,][0-9]{2})/.exec(u), v=am ? num(am[1]) : 0;
        if(/\b(ESP[EÈ]CES?|NUMERAIRE|NUMÉRAIRE|CASH)\b/.test(u) && v>0) cash=cash||(/CASH/.test(u) ? "CASH" : "ESPÈCES");
        if(/\bRENDU\b|\bA RENDRE\b|\bÀ RENDRE\b/.test(u)) cash=cash||"RENDU";
        if(/\b(CB|CARTE|VISA|MASTERCARD|SANS CONTACT|CONTACTLESS|AMEX|EMV)\b/.test(u) && v>0 && !/ESP[EÈ]CES?|RENDU/.test(u)) card=true; });
      return (cash && !card) ? cash : null;
    }
    function tkPayHTML(d){
      var pE=d.pay==="esp", ro=state.draftRO;
      var h='<div class="pay-h"><label class="f">Payé avec</label>'+(pE && d.payRead ? '<small>lu sur le ticket : « '+esc(d.payRead)+' »</small>' : '')+'</div>'+
        '<div class="pay-seg" id="fpay"><button type="button" data-pay=""'+(pE?'':' class="on"')+(ro?' disabled':'')+'>💳 Compte</button><button type="button" data-pay="esp"'+(pE?' class="on"':'')+(ro?' disabled':'')+'>💶 Espèces</button></div>';
      if(!pE) return h;
      var a=tkLiqAcct(d), who=tkLiqWho(a), can=tkLiqCan(a), on=d.liqOn===true && can;
      h+='<div class="pay-liq" id="fliq" role="radiogroup" aria-label="'+esc("D'où vient l'argent")+'">'+
        '<label><input type="radio" name="fliq" value="1"'+(on?' checked':'')+((can && !ro)?'':' disabled')+'><span><b>'+esc(who ? "Pris dans les espèces de "+who : "Pris dans mes espèces du mois")+'</b><small id="fliqTxt"></small></span></label>'+
        '<label><input type="radio" name="fliq" value="0"'+(on?'':' checked')+(ro?' disabled':'')+'><span><b>'+esc(who ? "Pas dans ses espèces du mois" : "Pas dans mes espèces du mois")+'</b><small>'+esc(who ? "Argent d'ailleurs : ne touche ni son compte ni son liquide" : "Argent d'ailleurs : ne touche ni ton compte ni ton liquide")+'</small></span></label></div>'+
        '<div class="pay-note">'+esc("Dans les deux cas, c'est une dépense : Budget, Analyse et Foyer la comptent comme un ticket payé par carte.")+'</div>';
      return h;
    }
    // Ce qui restera dans le liquide (suit le montant et la date tapés)
    function tkLiqPaint(){
      var t=document.getElementById("fliqTxt"), d=state.draft; if(!t || !d) return;
      var g=function(id){ var e=document.getElementById(id); return e ? e.value : ""; };
      var dd={ id:d.id, compte:d.compte, payePar:d.payePar, date:g("f-date")||d.date, montant:g("f-montant") };
      var a=tkLiqAcct(dd), who=tkLiqWho(a), mt=num(dd.montant)||0, h="", cls="";
      if(!a) h=esc("Pas de compte pour ce liquide");
      else if(!tkLiqCan(a)) h=esc("Le liquide se modifie seulement avec l'onglet Compte en modification");
      else { var v=tkLiqAvail(dd, a);
        if(v==null) h=esc(who ? who+" n'a pas encore indiqué ses espèces" : "Tu n'as pas encore indiqué tes espèces")+' · <button type="button" class="lk" id="fliqSet">Les indiquer</button>';
        else { var r=Math.round((v-mt)*100)/100;
          if(r<-0.004){ cls="bad"; h=esc((who ? "Il lui reste " : "Il te reste ")+fmtK(v)+" : "+(who ? "son" : "ton")+" liquide passerait à −"+fmtK(Math.abs(r)))+'<br><button type="button" class="lk" id="fliqSet">'+(who ? "Corriger ses espèces" : "Corriger mes espèces")+'</button>'; }
          else h=esc((who ? "Il lui restera " : "Il te restera ")+fmtK(r)+" en liquide"+(mt ? " (sur "+fmtK(v)+")" : "")); } }
      t.className=cls; t.innerHTML=h;
      var b=document.getElementById("fliqSet"); if(b) b.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); readForm(); liqEdit(a.key, String(dd.date||todayISO()).slice(0, 7)); };
    }
    function tkPayWire(){
      [].forEach.call(document.querySelectorAll("#fpay button"), function(b){ b.onclick=function(){ readForm(); var d=state.draft, v=b.getAttribute("data-pay")||""; if((d.pay||"")===v) return;
        d.pay=v; if(v==="esp"){ var a=tkLiqAcct(d); d.liqOn=!!(tkLiqCan(a) && tkLiqAvail(d, a)!=null); } else { d.liqOn=false; d.payRead=""; }
        render(); }; });
      [].forEach.call(document.querySelectorAll('#fliq input[name="fliq"]'), function(r){ r.onchange=function(){ if(r.checked){ state.draft.liqOn=(r.value==="1"); tkLiqPaint(); } }; });
      tkLiqPaint();
    }
