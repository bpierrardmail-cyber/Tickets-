    // ---------- Relevé du compte : les opérations du mois ----------
    // L'onglet Compte s'ouvre sur la liste du mois, comme un relevé de banque : tickets, frais fixes et virements mêlés, par jour
    // (le plus récent en haut) avec le solde du soir ; ce qui n'est pas encore passé à la banque est dans « À venir ».
    // Les graphiques sont sur la page « Graphiques » (cptPage="graph"). Filtre : state.cptF (tout, in, out, av) ; recherche : state.cptQ.
    function opsIco(k){
      var P={ "t":'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
              "f":'<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>',
              "in":'<path d="M17 7L7 17"/><path d="M16 17H7V8"/>',
              "out":'<path d="M7 17L17 7"/><path d="M8 7h9v9"/>',
              "r":'<path d="M4 12h12"/><path d="M12 7l5 5-5 5"/><path d="M20 5v14"/>',
              "q":'<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
              "g":'<path d="M5 20V12M12 20V5M19 20v-9M3 20h18"/>',
              "c":'<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>' };
      return '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(P[k]||"")+'</svg>';
    }
    function opsAmtS(n, plus){ n=Number(n)||0; var a=Math.abs(n), t=a>=1000 ? String(Math.round(a)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u202f")+" "+curSym() : fmtK(a); return (n<-0.004?"−":(plus && n>0.004?"+":""))+t; }   // court : sans centimes dès 1 000
    function opsAmt(n){ n=Number(n)||0; return (n>0.004?"+":(n<-0.004?"−":""))+fmtK(Math.abs(n)); }
    function opsNorm(t){ return String(t||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
    function opsKind(o){ return o.k==="v" ? (o.a>0?"in":"out") : o.k; }
    function opsDayLabel(month, d){
      var td=todayDay(month), p=month.split("-");
      if(d===td) return "Aujourd'hui"; if(d===td-1) return "Hier";
      return capFirst(["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"][new Date(+p[0], +p[1]-1, d).getDay()])+" "+(d===1?"1er":d)+" "+MOIS_NOMS[+p[1]-1];
    }
    // Les opérations du compte ce mois-là : passées à la banque (done) et pas encore (todo). d = jour (0 = inconnu, rangé au 1er).
    function cptOps(person, month){
      var R={ done:[], todo:[] }, st0=acctStart(person); if(st0 && month<st0) return R;
      state.entries.forEach(function(e){ if(monthKey(e.date)!==month || !tkBank(e, person)) return;
        R.done.push({ k:"t", id:e.id, d:+String(e.date).slice(8, 10)||0, n:e.marchand||"Ticket", s:(e.categorie||"Achat")+" · ticket", a:-(Number(e.montant)||0) }); });
      fraisCommuns.forEach(function(f){ if(!fraisActif(f, month)) return; var kd=fraisKind(f, person); if(!kd) return; var a=fraisAcctAmt(f, person, month); if(!(a>0.004)) return;
        var it={ k:"f", id:f.id, d:fraisDay(f, month), n:f.label||"Frais fixe", s:(kd==="commun" ? (f.split?"Frais commun · ta part":"Frais commun") : "Frais fixe"), a:-a };
        (fraisDone(f, month) ? R.done : R.todo).push(it); });
      fraisCommuns.forEach(function(f){ var a=provInAmt(f, person, month); if(!a) return;
        (fraisDone(f, month) ? R.done : R.todo).push({ k:"f", id:f.id, d:fraisDay(f, month), n:f.label||"Provision", s:"Provision · "+provInFrom(f), a:a }); });
      virementsOf(person, month).forEach(function(v){ var a=Number(v.montant)||0; if(Math.abs(a)<0.005) return;
        var note=String(v.note||""); if(/relevé$/.test(note)) note="";
        var it={ k:"v", id:v.id, d:virDay(v), n:v.label||"Virement", s:(a>0?"Virement reçu":"Virement envoyé")+(v.rec!=null && virRecById(v.rec)?" · ↻ chaque mois":"")+(v.epargneId?" · "+(a<0?"vers ":"depuis ")+epNameOf(v.epargneId):"")+((v.vers || v.bourseId!=null)?" · "+(a<0?"vers ":"depuis ")+virLinkName(virLinkVal(v)):"")+(note?" · "+note:""), a:a };
        (v.done ? R.done : R.todo).push(it); });
      return R;
    }
    function opsQ(){ var q=opsNorm(state.cptQ||"").trim(); if(/^[0-9 .,]+$/.test(q)) q=q.replace(/\s/g, "").replace(".", ","); return q; }
    // Le corps de la liste (refait à chaque lettre tapée dans la recherche) : cx = { month, futur, past, report, ro, prevName, edited }
    function opsBodyHTML(O, cx){
      var f=state.cptF||"tout", q=opsQ(), h="", mo=MOIS_NOMS[+cx.month.slice(5, 7)-1];
      function qOk(o){ return !q || (opsNorm(o.n+" "+o.s)+" "+Math.abs(o.a).toFixed(2).replace(".", ",")).indexOf(q)>=0; }
      function fOk(o){ return f==="tout" || f==="av" || (f==="in" && o.a>0) || (f==="out" && o.a<0) || (f==="tk" && o.k==="t") || (f==="fx" && o.k==="f") || (f==="vr" && o.k==="v"); }   // tk / fx / vr : affichage détaillé
      var filtered=(f!=="tout") || !!q;
      var todo=O.todo.filter(function(o){ return fOk(o) && qOk(o); }).sort(function(x, y){ return ((x.d||99)-(y.d||99)) || String(x.n).localeCompare(String(y.n), "fr"); });
      var done=(f==="av") ? [] : O.done.filter(function(o){ return fOk(o) && qOk(o); });
      if(filtered && f!=="av"){ var tot=0; done.forEach(function(o){ tot+=o.a; });
        h+='<div class="ops-res"><span>'+done.length+' opération'+(done.length>1?'s':'')+(todo.length?' · '+todo.length+' à venir':'')+'</span><b>'+opsAmt(tot)+'</b></div>'; }
      var PO=(cx.key && !cx.futur && (f==="tout" || f==="av") && !q) ? pastOpen(cx.key, cx.month) : [];
      if(PO.length){ var pt=0, pn=0; PO.forEach(function(x){ pt+=x.a; if(!x.ok) pn++; });
        h+='<button type="button" class="ops-past'+(pn?' new':'')+'" id="opsPast"><span class="ops-t"><b>'+(pn?'⚠ ':'')+'Pas cochés les mois passés</b><small>'+PO.length+' opération'+(PO.length>1?'s':'')+(pn?' · à vérifier':' · comptées dans la fin de mois')+'</small></span><b class="ops-a'+(pt>0?' pos':'')+'">'+opsAmt(pt)+'</b></button>'; }
      if(todo.length){
        var tt=0, tick=!cx.ro && !cx.futur; todo.forEach(function(o){ tt+=o.a; });
        h+='<section class="paper ops-av"><div class="ops-avh"><span>'+(cx.futur?'Prévu en '+mo:(cx.past?'Pas encore passé à la banque':'À venir ce mois-ci'))+'</span><span>'+opsAmt(tt)+'</span></div>';
        todo.forEach(function(o){ var kk=opsKind(o);
          h+='<div class="ops-r av">'+(tick?'<button type="button" class="ops-ck" data-k="'+o.k+'" data-id="'+esc(o.id)+'" aria-label="Marquer comme fait : '+esc(o.n)+'"></button>':'<span class="ops-ic k-'+kk+'">'+opsIco(kk)+'</span>')+
             '<button type="button" class="ops-open" data-k="'+o.k+'" data-id="'+esc(o.id)+'"><span class="ops-t"><b>'+esc(o.n)+'</b><small>'+esc(o.s+(o.d?' · vers le '+(o.d===1?'1er':o.d):''))+'</small></span><b class="ops-a'+(o.a>0?' pos':'')+'">'+opsAmt(o.a)+'</b></button></div>'; });
        if(tick) h+='<div class="ops-hint">Touche le rond quand c\'est passé à la banque : la ligne rejoint la liste.</div>';
        h+='</section>';
      } else if(f==="av") h+='<div class="ops-empty">'+(q?'Rien ne correspond.':(cx.futur?'Rien de prévu en '+mo+'.':'Plus rien à venir ce mois-ci.'))+'</div>';
      if(f==="av") return h;
      var showRep=!filtered && !cx.futur;
      if(done.length || showRep){
        // solde du soir : report + tout ce qui est passé jusqu'à ce jour
        var bal={}, run=cx.report; O.done.slice().sort(function(x, y){ return (x.d||1)-(y.d||1); }).forEach(function(o){ run+=o.a; bal[o.d||1]=run; });
        var byD={}; done.forEach(function(o){ var d=o.d||1; (byD[d]=byD[d]||[]).push(o); });
        h+='<section class="paper ops-list">';
        Object.keys(byD).map(Number).sort(function(x, y){ return y-x; }).forEach(function(d){
          h+='<div class="ops-dh"><span>'+esc(opsDayLabel(cx.month, d))+'</span>'+(filtered?'':'<span>solde '+fmtK(bal[d])+'</span>')+'</div>';
          byD[d].forEach(function(o){ var kk=opsKind(o);
            h+='<button type="button" class="ops-r ops-open" data-k="'+o.k+'" data-id="'+esc(o.id)+'" data-done="1"><span class="ops-ic k-'+kk+'">'+opsIco(kk)+'</span><span class="ops-t"><b>'+esc(o.n)+'</b><small>'+esc(o.s)+'</small></span><b class="ops-a'+(o.a>0?' pos':'')+'">'+opsAmt(o.a)+'</b></button>'; });
        });
        if(showRep) h+='<div class="ops-dh"><span>Début du mois</span></div><button type="button" class="ops-r" id="opsReport"'+(cx.ro?' disabled':'')+'><span class="ops-ic k-r">'+opsIco("r")+'</span><span class="ops-t"><b>Report '+esc(cx.prevName)+'</b><small>solde au 1er '+esc(mo)+'</small></span><b class="ops-a">'+fmtK(cx.report)+'</b></button>';
        h+='</section>';
      }
      if(!done.length && !todo.length && (filtered || cx.futur)) h+='<div class="ops-empty">'+(filtered?'Rien ne correspond.':'Rien de prévu en '+mo+'.')+'</div>';
      return h;
    }
