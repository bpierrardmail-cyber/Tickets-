    // ---------- Factures ----------
    // Factures importées (PDF lu sur le téléphone, ou photos page par page) : électricité, gaz, eau, internet…
    // Une facture : { id, four, type, date, montant, prelev?, aPayer?, due?, du?, conso?, next?, regul?, src, fraisId?, prId? }
    // Les factures d'un même fournisseur (et du même type) forment une série : rythme, prochaine facture estimée,
    // provision liée (p.fact = clé de la série). Rien n'est envoyé : tout est lu et calculé sur le téléphone.
    var factures = store.read("factures", []);
    function persistFactures(){ store.write("factures", factures); }
    var FACT_TYPES=[{v:"elec",l:"Électricité",u:"kWh",ic:"⚡"},{v:"gaz",l:"Gaz",u:"kWh",ic:"🔥"},{v:"eau",l:"Eau",u:"m³",ic:"💧"},{v:"net",l:"Internet / tél.",u:"",ic:"📶"},{v:"autre",l:"Autre",u:"",ic:"🧾"}];
    function factType(v){ return FACT_TYPES.filter(function(t){ return t.v===v; })[0] || FACT_TYPES[4]; }
    function factKey(f){ return (f.type||"autre")+"|"+norm(f.four||""); }
    function isoAddDays(iso, n){ var t=new Date(iso+"T12:00:00"); t.setDate(t.getDate()+n); return t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0")+"-"+String(t.getDate()).padStart(2,"0"); }
    function isoDays(a, b){ return Math.round((new Date(b+"T12:00:00")-new Date(a+"T12:00:00"))/86400000); }
    function isoAddMonths(iso, n){ var p=iso.split("-"), y=+p[0], m=+p[1]-1+n, d=+p[2]; y+=Math.floor(m/12); m=((m%12)+12)%12; var dim=new Date(y, m+1, 0).getDate(); return y+"-"+String(m+1).padStart(2,"0")+"-"+String(Math.min(d, dim)).padStart(2,"0"); }
    function ddmm(iso){ return iso ? iso.slice(8,10)+"/"+iso.slice(5,7) : ""; }
    function ddmmyy(iso){ return iso ? iso.slice(8,10)+"/"+iso.slice(5,7)+"/"+iso.slice(0,4) : ""; }

    // ----- Séries de factures : rythme, prochaine facture, estimation, moyenne par mois -----
    function factSeries(){
      var by={}, out=[];
      factures.forEach(function(f){ var k=factKey(f); if(!by[k]){ by[k]={ key:k, four:f.four, type:f.type||"autre", bills:[] }; out.push(by[k]); } by[k].bills.push(f); });
      out.forEach(function(s){
        s.bills.sort(function(a,b){ return a.date<b.date?-1:(a.date>b.date?1:0); });
        s.last=s.bills[s.bills.length-1]; s.four=s.last.four || s.four;
        s.ryth=factRythme(s); s.next=factNextDate(s);
        s.offset=s.last.prelev && s.last.date ? Math.max(0, isoDays(s.last.date, s.last.prelev)) : 0;
        s.prov=provisions.filter(function(p){ return p.fact===s.key; })[0]||null;
      });
      return out;
    }
    function factRythme(s){
      var b=s.bills.filter(function(x){ return x.date; }), L=s.last;
      if(L.next && L.date && L.next>L.date && b.length<3) return Math.max(1, Math.round(isoDays(L.date, L.next)/30.4));
      if(b.length>=2){ var g=[]; for(var i=1;i<b.length;i++) g.push(isoDays(b[i-1].date, b[i].date)/30.4); g.sort(function(x,y){ return x-y; }); return Math.max(1, Math.round(g[Math.floor(g.length/2)])); }
      return s.type==="eau" ? 6 : 1;
    }
    function factNextDate(s){ var L=s.last; if(!L.date) return ""; var byR=isoAddMonths(L.date, s.ryth);
      if(L.next && L.next>L.date && (s.bills.length<3 || Math.abs(isoDays(L.next, byR))<=20)) return L.next; return byR; }
    // abonnement (aucune consommation sur les factures) : le prix suit la dernière facture
    function factNoConso(s){ return !s.bills.some(function(b){ return b.conso>0; }); }
    // Montant d'une facture à venir : même période l'an dernier, corrigée de l'évolution de la consommation ;
    // avec au moins 3 factures et leur consommation, montant = part fixe + prix × consommation attendue.
    // Saison : l'hiver consomme plus (éclairage, chauffage, moins de soleil pour les panneaux). Profil simple, sans données
    // extérieures : 1 + A·cos(…), au plus haut mi-janvier. A est appris sur les factures du foyer (factProfil) ;
    // à défaut, selon l'énergie (0 = pas de saison, ex. l'eau).
    var FACT_SAISON={ elec:0.35, gaz:0.6 };
    function factSaison(type, d1, d2){ return factSaisonA(FACT_SAISON[type]||0, d1, d2); }
    function factSaisonA(A, d1, d2){
      if(!A || !d1 || !d2 || d2<=d1) return 1;
      var n=isoDays(d1, d2), t0=new Date(d1+"T12:00:00").getTime(), sum=0, k=0;
      for(var i=0;i<=n;i+=3){ var t=new Date(t0+i*86400000), doy=Math.round((t-new Date(t.getFullYear(), 0, 1, 12))/86400000)+1; sum+=1+A*Math.cos(2*Math.PI*(doy-15)/365); k++; }
      return sum/k;
    }
    // période couverte par une facture : du → au, sinon depuis la facture d'avant, sinon le rythme
    function factPeriode(s, b){
      if(b.du && b.au && b.au>b.du) return [b.du, b.au];
      var i=s.bills.indexOf(b), pv=i>0 ? s.bills[i-1] : null;
      if(pv && pv.date && b.date && pv.date<b.date) return [pv.date, b.date];
      return b.date ? [isoAddMonths(b.date, -(s.ryth||1)), b.date] : null;
    }
    // Profil du foyer, appris sur les factures des 12 derniers mois (au moins 4, sur 8 mois ou plus) : consommation par jour
    // ≈ niveau × (1 + A·cos(…)), les factures récentes comptant plus. Avec des panneaux solaires, l'écart hiver / été est
    // bien plus fort que d'habitude : il est appris ici. null s'il y a trop peu de factures.
    function factProfil(s, B){
      var L=B[B.length-1], pL=factPeriode(s, L); if(!pL) return null;
      var rows=[], first=pL[0];
      B.forEach(function(b){ var p=b.conso>0 ? factPeriode(s, b) : null; if(!p) return; var age=isoDays(p[1], pL[1]), n=isoDays(p[0], p[1]);
        if(age<0 || age>335 || n<10) return; rows.push({ p:p, y:Math.log(b.conso/n), w:Math.pow(0.5, age/180) }); if(p[0]<first) first=p[0]; });
      if(rows.length<4 || isoDays(first, pL[1])<240) return null;
      var best=null;
      for(var i=-30;i<=45;i++){ var A=i/50, sw=0, sm=0, e=0, fs=rows.map(function(r){ return Math.log(factSaisonA(A, r.p[0], r.p[1])); });
        rows.forEach(function(r, j){ sw+=r.w; sm+=r.w*(r.y-fs[j]); }); var m=sm/sw;
        rows.forEach(function(r, j){ e+=r.w*Math.pow(r.y-fs[j]-m, 2); });
        if(!best || e<best.e) best={ A:A, lvl:Math.exp(m), e:e }; }
      return best;
    }
    // Facture estimée à la date iso. Avec la consommation : le profil du foyer selon la saison ; sinon la consommation par jour
    // de la dernière facture, corrigée de la saison et mêlée à l'an dernier à la même période (corrigé de l'évolution) si la
    // consommation a peu changé d'une année sur l'autre ; puis le prix (part fixe + prix du kWh) tiré des factures.
    // Sans consommation : l'an dernier, sinon la moyenne des dernières.
    function factEstInfo(s, iso){
      var B=s.bills.filter(function(b){ return b.montant>0 && !b.regul && b.date; }); if(!B.length) return { v:0, how:"" };
      if(factNoConso(s)) return { v:B[B.length-1].montant, how:"prix" };
      function near(d, tol){ var best=null, bd=1e9; B.forEach(function(b){ var x=Math.abs(isoDays(b.date, d)); if(x<=tol && x<bd){ bd=x; best=b; } }); return best; }
      var L=B[B.length-1], Lp=L.conso ? near(isoAddDays(L.date, -365), 45) : null;
      var r=(Lp && Lp.conso && L.conso) ? Math.max(0.3, Math.min(3, L.conso/Lp.conso)) : 1;
      var b0=near(isoAddDays(iso, -365), 45); if(b0===L) r=1;   // l'an dernier, c'est déjà la dernière facture : l'évolution y est
      var cS=0, cY=0, wY=0, dL=0, dT=0, pL=factPeriode(s, L), P=null;
      if(L.conso>0 && pL){
        var st=isoAddMonths(iso, -(s.ryth||1)); if(pL[1]>st && pL[1]<iso) st=pL[1];
        dL=Math.max(1, isoDays(pL[0], pL[1])); dT=Math.max(1, isoDays(st, iso));
        P=factProfil(s, B);
        cS=P ? P.lvl*factSaisonA(P.A, st, iso)*dT : L.conso/dL*dT*factSaison(s.type, st, iso)/factSaison(s.type, pL[0], pL[1]);
      }
      if(b0 && b0.conso && !P){ cY=b0.conso*r; wY=cS>0 ? (b0===L ? 0.5 : 0.5*Math.max(0, 1-Math.abs(Math.log(r))/Math.LN2)) : 1; }
      var cEst=cS>0 ? cS*(1-wY)+cY*wY : cY, how=P ? "profil" : (cS>0 ? (wY>0.05 ? "mix" : "saison") : "");
      if(cEst>0){
        var C=B.filter(function(b){ return b.conso>0; }).slice(-8);
        if(C.length>=3){
          var n=C.length, mx=0, my=0; C.forEach(function(b){ mx+=b.conso; my+=b.montant; }); mx/=n; my/=n;
          var sxx=0, sxy=0; C.forEach(function(b){ sxx+=(b.conso-mx)*(b.conso-mx); sxy+=(b.conso-mx)*(b.montant-my); });
          if(sxx>0){ var k=sxy/sxx, a=my-k*mx; if(k>0) return { v:Math.round(Math.max(Math.min.apply(null, C.map(function(b){ return b.montant; }))*0.5, a+k*cEst)), how:how||"an", b0:b0 }; }
        }
        // peu de factures : environ un tiers fixe (selon la durée), le reste selon la consommation
        if(cS>0) return { v:Math.round(L.montant*(0.35*(dT/dL)+0.65*cEst/L.conso)), how:how, b0:b0 };
      }
      if(b0) return { v:Math.round(b0.montant*(0.35+0.65*r)), how:"an", b0:b0 };
      var l3=B.slice(-3); return { v:Math.round(l3.reduce(function(t,b){ return t+b.montant; },0)/l3.length), how:"" };
    }
    function factEstimate(s, iso){ return factEstInfo(s, iso).v; }
    // Prochaine facture estimée déjà dans « À venir » : elle suit l'estimation du moment (calcul amélioré, factures ajoutées)
    function factEstRefresh(){
      if(fyMember() || !factures.length) return;
      var S={}, ch=false; factSeries().forEach(function(s){ S[s.key]=s; });
      fraisCommuns.forEach(function(f){ var s=f.est && f.fact && f.month ? S[f.fact] : null; if(!s || !s.next || fraisDone(f, f.month)) return;
        var v=factEstimate(s, s.next); if(v>0 && Math.abs(v-(Number(f.montant)||0))>=(factNoConso(s)?0.005:1)){ f.montant=v; ch=true; }
        // la date prévue a changé (rythme recalculé) : l'estimation suit, sans revenir dans le passé
        var np=factPayIso(s, s.next), nm=np.slice(0,7), cur=monthKey(todayISO()); if(nm!==f.month && nm>=cur){ f.month=nm; if(f.jour) f.jour=+np.slice(8,10); ch=true; } });
      if(ch) persistFrais();
    }
    function fctE(n){ return String(Math.round(Number(n)||0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")+" "+curSym(); }   // un montant estimé : à l'euro près
    function factEstWhy(s, iso){
      var e=factEstInfo(s, iso), sz=!!FACT_SAISON[s.type];
      if(e.how==="profil") return "D'après tes factures des 12 derniers mois, selon la saison.";
      if(e.how==="saison") return sz ? "D'après ta dernière facture, corrigée de la saison." : "D'après ta consommation par jour sur ta dernière facture.";
      if(e.how==="mix") return (sz ? "D'après ta dernière facture corrigée de la saison" : "D'après ta dernière facture")+", et l'an dernier à la même période ("+fmtK(e.b0.montant)+").";
      if(e.how==="an" && e.b0) return "L'an dernier à la même période : "+fmtK(e.b0.montant)+(e.b0.conso && s.last.conso && s.last!==e.b0 ? ", corrigé de l'évolution de ta consommation" : "")+".";
      if(e.how==="prix") return "Même montant que ta dernière facture (prix actuel de l'abonnement).";
      return "D'après tes dernières factures.";
    }
    function factMonthly(s){
      var B=s.bills.filter(function(b){ return b.montant>0 && !b.regul; }); if(!B.length) return 0; var n=Math.max(1, Math.round(12/s.ryth));
      if(factNoConso(s)){ var Ld=B.filter(function(b){ return b.date; }); return (Ld.length ? Ld[Ld.length-1] : B[B.length-1]).montant/(s.ryth||1); }
      if(B.length>=n) return B.slice(-n).reduce(function(t,b){ return t+b.montant; },0)/12;
      return B.reduce(function(t,b){ return t+b.montant; },0)/B.length/s.ryth;
    }
    function factRythLabel(r){ return r===1?"tous les mois":(r===12?"1 fois par an":(r===6?"2 fois par an":"tous les "+r+" mois")); }
    function factProvName(s){ var t=factType(s.type); return t.v==="autre" ? (s.four||"Facture") : t.l; }
    // Mois où l'argent sort : jour du prélèvement (ou de la facture à payer)
    function factPayIso(s, iso){ return isoAddDays(iso, s.offset||0); }
    // État d'une provision à une échéance : de côté ce mois-là, ce qu'il manquera
    // la provision au mois où cette facture sera payée : de côté juste avant (les factures prévues d'ici là déjà retirées), ce qui manquera ou restera
    function factProvAt(p, iso, amt){
      var cur=monthKey(todayISO()), mk=iso.slice(0,7); if(mk<cur) mk=cur;
      var months=[], m=cur; while(m<=mk && months.length<60){ months.push(m); m=nextMonthKey(m); }
      var x=provProj(p, months, cur, true).pop()||{ bal:0 }, bal=(x.src && x.before!=null) ? x.before : x.bal;
      return { bal:bal, manque:Math.max(0, amt-bal), reste:Math.max(0, bal-amt), mk:mk };
    }

    // ----- Les 12 prochains mois : frais fixes, factures reçues ou estimées, échéances des provisions -----
    function factYear(){
      var cur=monthKey(todayISO()), months=[], mk=cur, S=factSeries(), i;
      for(i=0;i<12;i++){ months.push(mk); mk=nextMonthKey(mk); }
      var Y=months.map(function(m){ return { mk:m, base:0, real:0, est:0, items:[], short:0, prov:0, nProv:0, nFix:0, shorts:[] }; });
      months.forEach(function(m, i){
        var t=Y[i];
        fraisCommuns.forEach(function(f){ if(!fraisActif(f, m)) return; var v=fraisMontant(f, m); if(!v) return;
          if(f.fact){ if(f.est) t.est+=v; else t.real+=v; t.items.push({ n:(f.factNom||f.label), v:v, est:!!f.est }); } else { t.base+=v; if(f.prov!=null){ t.prov+=v; t.nProv++; } else t.nFix++; } });
      });
      // les factures suivantes de chaque série (après celles déjà dans les frais fixes)
      S.forEach(function(s){
        if(!s.next) return; var d=s.next, guard=0;
        while(guard++<24){ var pm=factPayIso(s, d).slice(0,7); if(pm>months[11]) break;
          var idx=months.indexOf(pm);
          if(idx>=0 && !fraisCommuns.some(function(f){ return f.fact===s.key && fraisActif(f, pm); })){ var v=factEstimate(s, d); if(v>0){ Y[idx].est+=v; Y[idx].items.push({ n:s.four, v:v, est:true }); } }
          d=isoAddMonths(d, s.ryth); }
      });
      // échéances des provisions sans facture importée (taxe foncière, assurance…)
      try{ var PY=provYear(cur, cur, true);
        PY.forEach(function(pt, i){ if(i>11) return; Y[i].short+=pt.short||0;
          pt.items.forEach(function(x){ if(x.short>0.5) Y[i].shorts.push({ p:x.p, nom:x.nom, short:x.short, amt:x.amt, before:x.before }); });
          pt.items.forEach(function(x){ if(!x.planned || !(x.amt>0.004)) return; var p=x.p; if(p && p.fact) return;
            var nn=norm(x.nom); if(fraisCommuns.some(function(f){ return f.prov==null && fraisActif(f, months[i]) && nn && norm(f.label).indexOf(nn)>=0; })) return;
            Y[i].est+=x.amt; Y[i].items.push({ n:x.nom, v:x.amt, est:true, prov:true }); }); });
      }catch(e){}
      return Y;
    }
    // Ce qui part dans les 30 prochains jours (frais fixes pas encore faits)
    function factSoon(){
      var t=todayISO(), cur=t.slice(0,7), nxt=nextMonthKey(cur), td=+t.slice(8,10), out=[];
      [cur, nxt].forEach(function(m){ fraisCommuns.forEach(function(f){
        if(!fraisActif(f, m) || fraisDone(f, m)) return; var d=fraisDay(f, m), v=fraisMontant(f, m); if(!v) return;
        if(m===nxt && !f.aPayer && (!d || d>td)) return;   // une facture à payer soi-même : tout de suite
        out.push({ f:f, m:m, d:d, v:v, k:m+(d<10?"0":"")+d });
      }); });
      out.sort(function(a,b){ return a.k<b.k?-1:(a.k>b.k?1:0); });
      return out;
    }

    // ----- Onglet À venir : 12 mois · Frais fixes · Provisions · Factures (Tickets Plus dans la version Store) -----
    // Foyer : 12 mois, Provisions et Factures suivent les droits de l'onglet À venir (« factures »), Frais fixes ceux de Commun.
    function avTabOn(m){ return fyTabOn(m, "factures") || fyTabOn(m, "communes"); }
    function avSubs(){ var m=fyMember() ? fyCfg : null, fOn=!m || fyTabOn(m, "factures"), cOn=!m || fyTabOn(m, "communes"), out=[];
      if(fOn) out.push(["mois","12 mois"]); if(cOn) out.push(["frais","Frais fixes"]); if(fOn){ out.push(["prov","Provisions"]); out.push(["fact","Factures"]); }
      return out; }
    function avSub(){ var L=avSubs(), s=state.avnSub||"mois"; if(!L.some(function(x){ return x[0]===s; })) s=L.length ? L[0][0] : "mois"; return s; }
    function avTabsHTML(cur){ var L=avSubs(); if(L.length<2) return '';
      return '<div class="avtabs" role="tablist">'+L.map(function(x){ var on=x[0]===cur; return '<button type="button" role="tab" aria-selected="'+on+'" data-av="'+x[0]+'"'+(on?' class="on"':'')+'>'+x[1]+(x[0]==="fact" && !canUse("factures")?' <span class="avplus">✦</span>':'')+'</button>'; }).join("")+'</div>'; }
    function wireAvTabs(){ [].forEach.call(document.querySelectorAll(".avtabs button"), function(b){ b.onclick=function(){ state.avnSub=b.getAttribute("data-av"); render(); window.scrollTo(0,0); }; }); }
    function factPlusAsk(){ plusShow("factures"); }
    function renderFactures(){
      var sub=avSub(); state.avnSub=sub;
      if(sub==="frais") return renderCommunes();
      if(sub==="prov") return renderProvisions();
      var curM=monthKey(todayISO()), ro=fyRO(), plus=canUse("factures");
      var h=header(false, "À venir")+avTabsHTML(sub);
      if(sub==="fact"){
        if(!plus){
          h+='<section class="fct-teaser"><h3>Tes factures, lues sur ton téléphone</h3><p>Électricité, gaz, eau, internet : un PDF de ton espace client ou une photo par page. Rien n\'est envoyé.</p>'+
             '<ul><li>Le prélèvement exact dans « À venir »</li><li>La prochaine facture estimée, selon la saison</li><li>La provision qui lisse tes factures</li><li>Ta consommation et ton prix par kWh ou m³</li></ul>'+
             '<button type="button" class="fct-plus" id="fctBuy">✦ Importer une facture avec '+APP_NAME+' Plus</button></section>'+
             '<div class="muted" style="font-size:12.5px;line-height:1.45;text-align:center;margin:12px 4px">Les 12 mois, les frais fixes et les provisions restent gratuits.</div>';
          app.innerHTML=h; setNav("factures", true); wireAvTabs();
          document.getElementById("fctBuy").onclick=factPlusAsk;
          return;
        }
        // refonte du 19/11 : en haut, les factures des 3 prochains mois et l'import ; une carte par fournisseur (évolution, un seul état)
        var S=factSeries(), m3=[curM, nextMonthKey(curM), nextMonthKey(nextMonthKey(curM))], v3=[0,0,0], e3=[false,false,false], L3=[[],[],[]];
        S.forEach(function(s){ if(!s.next) return; var d=s.next, k=0; while(d && d.slice(0,7)<=m3[2] && k<6){ var i=m3.indexOf(d.slice(0,7)); if(i>=0){ var v=factEstimate(s, d)||0, ap=!factNoConso(s); v3[i]+=v; if(ap) e3[i]=true; L3[i].push({ n:s.four||factType(s.type).l, v:v, est:ap }); } d=isoAddMonths(d, s.ryth||1); k++; } });
        var t3=v3[0]+v3[1]+v3[2];
        h+='<section class="paper av2-hero" id="fctHero">';
        if(S.length){ h+='<div class="av2-k">Tes factures d\'ici fin '+esc(MOIS_NOMS[+m3[2].slice(5,7)-1])+'</div><div class="av2-big"><b>'+(e3.some(function(x){ return x; })?'≈ ':'')+esc(fmtK(t3))+'</b></div><div class="fct-3m">';
          m3.forEach(function(m, i){ h+='<div><small>'+esc(MOIS_NOMS[+m.slice(5,7)-1])+'</small>'+(L3[i].length ? L3[i].map(function(x){ return '<span class="l"><i>'+esc(x.n)+'</i><b>'+(x.est?'≈ '+esc(fctE(x.v)):esc(fmtK(x.v)))+'</b></span>'; }).join("") : '<span class="l"><i>aucune</i></span>')+'</div>'; });
          h+='</div>'; }
        else h+='<div class="av2-k">Tes factures</div><div class="muted" style="font-size:13px;line-height:1.45">Importe une facture d\'électricité, d\'eau, de gaz ou d\'internet : en PDF, ou en photos page par page. L\'appli en tire le prélèvement, la prochaine facture et ce qu\'il faut mettre de côté.</div>';
        if(!ro) h+='<button type="button" class="btn primary" id="fctImp" style="margin-top:4px">⇩ Importer une facture · PDF ou photo</button>';
        h+='</section>';
        if(S.length) h+='<div class="av2-h"><b>Mes fournisseurs</b><small>par prochaine facture</small></div>';
        S.slice().sort(function(a,b){ return (a.next||"9")<(b.next||"9")?-1:1; }).forEach(function(s){
          var est=s.next?factEstimate(s, s.next):0, ty=factType(s.type), cat=catIcon(ty.l+" "+s.four), when=s.next?(isoDays(todayISO(), s.next)<=60?"vers le "+ddmm(s.next):MOIS_NOMS[+s.next.slice(5,7)-1]):"";
          var pv=s.prov, pa=null; if(pv && s.next) pa=factProvAt(pv, factPayIso(s, s.next), est);
          var B=s.bills.slice(-6), mx=1; B.forEach(function(b){ mx=Math.max(mx, Number(b.montant)||0); });
          var sp='<span class="fct-sp" aria-hidden="true">'+B.map(function(b){ return '<i style="height:'+Math.max(3, Math.round((Number(b.montant)||0)/mx*28))+'px;background:'+cat.col+'"></i>'; }).join("")+'</span>';
          var miss=s.bills.filter(function(b){ return factCanAdd(b); }).slice(-1)[0], st, act='';
          if(pv && pa) st=pa.manque>0.5 ? '<span class="fct-warn">« '+esc(pv.nom)+' » · il manquera '+esc(fmtK(pa.manque))+' en '+esc(MOIS_NOMS[+pa.mk.slice(5,7)-1])+'</span>' : '<span class="fct-ok">✓ « '+esc(pv.nom)+' » prête pour '+esc(MOIS_NOMS[+pa.mk.slice(5,7)-1])+'</span> · il restera '+esc(fmtK(pa.reste));
          else if(pv) st='<span class="fct-ok">✓ payée par « '+esc(pv.nom)+' »</span>';
          else if(miss) st='<span class="fct-warn">pas dans tes comptes</span>';
          else if(s.ryth>=2){ st='<span class="fct-warn">sans provision</span>'; if(!ro) act='<button type="button" class="btn ghost fct-liss" data-k="'+esc(s.key)+'">Lisser · '+esc(fmtK(Math.ceil(factMonthly(s))))+'/mois</button>'; }
          else st=factFraisFor(s.last) ? '<span class="fct-ok">✓ dans tes comptes</span>' : '';
          h+='<div class="fct-wrap'+(pa && pa.manque>0.5?' warn':'')+'"><button type="button" class="fct-card" data-k="'+esc(s.key)+'"><span class="fct-top"><span class="fct-ic" style="background:'+hexA(cat.col,.16)+'">'+ty.ic+'</span>'+
             '<span class="fct-n"><b>'+esc(s.four||ty.l)+'</b><small>'+esc(ty.l+' · '+s.bills.length+' facture'+(s.bills.length>1?'s':'')+' · '+factRythLabel(s.ryth)+' · '+fmtK(factMonthly(s))+(factNoConso(s)?'/mois':'/mois en moyenne'))+'</small></span>'+
             '<span class="fct-v"><b>'+(est?(factNoConso(s)?esc(fmtK(est)):'≈ '+esc(fctE(est))):'—')+'</b><small>'+esc(when)+'</small></span></span>'+
             '<span class="fct-bot">'+sp+'<span class="fct-s">'+st+'</span></span></button>'+(act?'<div class="fct-act">'+act+'</div>':'')+'</div>';
        });
        if(!ro) h+='<div class="muted" style="font-size:12px;line-height:1.45;margin:6px 4px">✦ La lecture s\'améliore avec l\'usage : la 1<sup>re</sup> facture d\'un fournisseur est à vérifier, les suivantes sont lues au même endroit.</div>';
        app.innerHTML=h; setNav("factures", true); wireAvTabs();
        [].forEach.call(document.querySelectorAll(".fct-card[data-k]"), function(b){ var k=b.getAttribute("data-k");
          function open(){ state.factKey=k; state.view="factserie"; render(); window.scrollTo(0,0); }
          b.onclick=open;
          // appui long : Ouvrir / Supprimer ce fournisseur et ses factures
          onLongPress(b, function(){ var bl=factures.filter(function(x){ return factKey(x)===k; }); if(!bl.length) return; var nm=bl[bl.length-1].four||factType(bl[0].type).l;
            var ch=[{ l:"Ouvrir", fn:open }]; if(!fyRO()) ch.push({ l:"🗑 Supprimer « "+nm+" » ("+bl.length+" facture"+(bl.length>1?"s":"")+")", danger:true, fn:function(){ factSeriesDelete(k); } });
            uiChoice(nm, esc(bl.length+" facture"+(bl.length>1?"s":"")+" · "+factType(bl[0].type).l), ch); });
        });
        var bi=document.getElementById("fctImp"); if(bi) bi.onclick=factImportChooser;
        [].forEach.call(document.querySelectorAll(".fct-liss"), function(bt){ bt.onclick=function(){ var k=bt.getAttribute("data-k"), s1=factSeries().filter(function(x){ return x.key===k; })[0]; if(!s1) return;
          var np=factCreateProv(s1); render(); uiUndoToast("Enveloppe « "+np.nom+" » créée · "+fmtK(np.mensuel)+" / mois", "Annuler", function(){ provisions=provisions.filter(function(x){ return x!==np; }); persistProvisions(); render(); }); }; });
        return;
      }
      // 12 mois : frais fixes, factures reçues (ou estimées) et échéances des provisions
      var Y=factYear(), sel=state.factSel && Y.some(function(t){ return t.mk===state.factSel; }) ? state.factSel : curM;
      var T=Y.filter(function(t){ return t.mk===sel; })[0], tot=T.base+T.real+T.est, fact=T.real+T.est, mi=+sel.split("-")[1]-1;
      // refonte du 19/11 : le mois en cours (encore à payer), les 7 prochains jours, les 12 mois en pastilles et le détail du mois touché
      var C0=Y[0], c0tot=C0.base+C0.real+C0.est, c0paid=0;
      fraisCommuns.forEach(function(f){ if(fraisActif(f, curM) && fraisDone(f, curM)){ var v=fraisMontant(f, curM); if(v) c0paid+=v; } });
      c0paid=Math.min(c0paid, c0tot); var c0rest=Math.max(0, c0tot-c0paid), finTxt='';
      if(!fyMember() || fyTabOn(fyCfg, "compte")){ try{ var ma=fyMember() ? (payAcctOf(fyCfg.me)||mainAcct()) : mainAcct(); if(ma && ma.key!=="__tickets"){ var ff=acctFigures(ma.key, curM).fin; finTxt='il te restera ≈ <b>'+esc(fmtK(ff))+'</b> fin '+esc(MOIS_NOMS[+curM.slice(5,7)-1]); } }catch(e){} }
      if(c0tot>0.004) h+='<section class="paper av2-hero" id="avHero"><div class="av2-k">'+esc(capFirst(MOIS_NOMS[+curM.slice(5,7)-1]))+' · encore à payer</div>'+
        '<div class="av2-big"><b>'+esc(fmtK(c0rest))+'</b><span>sur '+esc(fmtK(c0tot))+' ce mois</span></div>'+
        '<div class="av2-bar"><i style="width:'+(c0tot>0?Math.round(c0paid/c0tot*100):0)+'%;background:var(--accent)"></i></div>'+
        '<div class="av2-sub"><span class="ok">'+esc(fmtK(c0paid))+' payés</span><span>'+finTxt+'</span></div></section>';
      // les 7 prochains jours (les mises de côté des provisions en une seule case)
      var soon=factSoon(), tdy=todayISO(), td=+tdy.slice(8,10), wkEnd=isoAddDays(tdy, 7), wk=[], wkPv={ n:0, v:0, d:"" };
      soon.forEach(function(x){ var iso=x.d ? x.m+"-"+(x.d<10?"0":"")+x.d : "";
        if(iso ? (iso<tdy && x.m!==curM) || iso>wkEnd : x.m!==curM) return;
        if(x.f.prov!=null){ wkPv.n++; wkPv.v+=x.v; if(iso && (!wkPv.d || iso<wkPv.d)) wkPv.d=iso; return; }
        wk.push({ x:x, iso:iso }); });
      function wkDay(iso){ if(!iso) return "ce mois-ci"; if(iso<=tdy) return iso<tdy?"en retard · "+ddmm(iso):"aujourd'hui"; if(iso===isoAddDays(tdy,1)) return "demain";
        return new Date(iso+"T12:00:00").toLocaleDateString("fr-FR",{ weekday:"short", day:"numeric" }).replace(".",""); }
      h+='<div class="av2-h"><b>Les 7 prochains jours</b>'+(soon.length?'<button type="button" id="soonMore">'+((state.soonAll!=null ? state.soonAll : affDet())?'Moins ▴':'Tout voir · '+soon.length)+'</button>':'')+'</div><div class="av2-wk" id="avWeek">';
      if(!wk.length && !wkPv.n){ var nx=soon[0]; h+='<div class="none">Rien à payer cette semaine'+(nx?'. Ensuite : '+esc(nx.f.label)+(nx.d?' le '+nx.d+' '+esc(MOIS_NOMS[+nx.m.slice(5,7)-1]):'')+'.':'.')+'</div>'; }
      wk.forEach(function(w){ var f=w.x.f; h+='<div><small>'+esc(wkDay(w.iso))+'</small><b>'+esc(f.label)+'</b><em>'+(f.est?'≈ −'+esc(fctE(w.x.v)):'−'+esc(fmtK(w.x.v).replace(/^-/,"")))+'</em></div>'; });
      if(wkPv.n) h+='<div class="pv"><small>'+esc(wkDay(wkPv.d))+'</small><b>'+(wkPv.n>1?wkPv.n+' mises de côté':'1 mise de côté')+'</b><em>'+esc(fmtK(wkPv.v))+'</em></div>';
      h+='</div>';
      // la liste complète (« Tout voir »)
      if(soon.length && (state.soonAll!=null ? state.soonAll : affDet())){
        var st=soon.reduce(function(t,x){ return t+x.v; },0);
        h+='<section class="paper ops-av" style="margin:-4px 0 14px"><div class="ops-avh"><span>À payer bientôt</span><span>'+opsAmt(-st)+'</span></div>';
        soon.forEach(function(x){ var f=x.f, tag=f.aPayer?'à payer':(f.est?'estimée':'');
          var mN=new Date(+x.m.slice(0,4), +x.m.slice(5,7)-1, 1).toLocaleDateString("fr-FR",{month:"short"}).replace(".","");
          h+='<div class="ops-r av"><span class="av-cal'+(x.d?'':' nod')+'">'+(x.d?'<b>'+x.d+'</b>':'')+'<i>'+esc(mN)+'</i></span><span class="ops-t"><b>'+esc(f.label)+'</b><small>'+esc((!x.d && x.m===curM?"ce mois-ci · ":"")+(tag?tag:(f.prov!=null?'mise de côté':(f.fact?'prélèvement':'frais fixe'))))+'</small></span><b class="ops-a">'+(f.est?'≈ −'+esc(fctE(x.v)):opsAmt(-x.v))+'</b></div>'; });
        h+='</section>';
      }
      // les 12 mois en pastilles : vert = couvert, orange = provision un peu juste, rouge = facture pas couverte
      function avDot(t){ var fa=t.real+t.est; return t.short>0.5 ? (fa>0 && t.short>=fa*0.5 ? "r" : "o") : "g"; }
      h+='<section class="paper av2-12"><div class="av2-h" style="margin:0"><b>Les 12 prochains mois</b><small>touche un mois</small></div><div class="av2-grid">';
      Y.forEach(function(t){ var mi2=+t.mk.split("-")[1]-1, v=t.base+t.real+t.est;
        h+='<button type="button" class="fct-col'+(t.mk===sel?' on':'')+'" data-m="'+t.mk+'" data-dot="'+avDot(t)+'" aria-label="'+esc(MOIS_NOMS[mi2]+(t.mk.slice(0,4)!==curM.slice(0,4)?' '+t.mk.slice(0,4):'')+' : '+fmtK(v))+'"><small>'+MOIS3[mi2]+'</small><b>'+esc(String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g," "))+'</b><span class="av2-dot '+avDot(t)+'"></span></button>'; });
      h+='</div><div class="av2-lg"><span><span class="av2-dot g"></span>tout est couvert</span><span><span class="av2-dot o"></span>provision un peu juste</span><span><span class="av2-dot r"></span>facture pas couverte</span></div>';
      var fixV=T.base-T.prov, wB=tot>0?fixV/tot*100:0, wF=tot>0?fact/tot*100:0, wP=tot>0?T.prov/tot*100:0;
      h+='<div class="av2-det fct-read"><div class="l t"><span>'+esc(capFirst(MOIS_NOMS[mi]))+(sel.slice(0,4)!==curM.slice(0,4)?' '+sel.slice(0,4):'')+'</span><b>'+esc(fmtK(tot))+'</b></div>';
      if(tot>0.004) h+='<div class="av2-bar" style="height:8px"><i style="width:'+wB.toFixed(1)+'%;background:#8792a8"></i><i style="width:'+wF.toFixed(1)+'%;background:var(--coral)"></i><i style="width:'+wP.toFixed(1)+'%;background:#c78bd6"></i></div>';
      h+='<div class="l"><span>Frais fixes'+(T.nFix?' · '+T.nFix:'')+'</span><b>'+esc(fmtK(fixV))+'</b></div>';
      if(fact>0.004) h+='<div class="l"><span>Factures<small>'+T.items.map(function(x){ return esc(x.n)+' '+(x.est?'≈ '+esc(fctE(x.v)):esc(fmtK(x.v))); }).join(" · ")+'</small></span><b>'+(T.est>0.004?'≈ ':'')+esc(fmtK(fact))+'</b></div>';
      if(T.prov>0.004) h+='<div class="l"><span>Mises de côté · '+T.nProv+'</span><b>'+esc(fmtK(T.prov))+'</b></div>';
      T.shorts.forEach(function(x){ h+='<div class="av2-warn"><b>'+esc(x.nom)+(x.amt>0?' ≈ '+esc(fmtK(x.amt)):'')+'</b> : '+(x.before>0.5?'la provision en couvre '+esc(fmtK(x.before))+'. ':'')+'Il manquera <b class="m">'+esc(fmtK(x.short))+'</b>, à prendre sur le compte.'+
        (x.p && (!fyMember() || fyTabOn(fyCfg, "factures"))?'<br><button type="button" class="btn primary avgoprov" data-id="'+esc(x.p.id)+'">Voir la provision</button>':'')+'</div>'; });
      h+='</div></section>';
      // argent de côté : épargne et provisions (refonte : comme la maquette), chacun mène à sa page
      if(!fyMember() || fyTabOn(fyCfg, "compte")){ var avEp=0, avPr=0; try{ avEp=epTotalAtM(curM); avPr=provTotalAt(curM); }catch(e){}
        if(epargne.length || provisions.length) h+='<div class="bsec-h">Argent de côté</div><section class="paper av-side">'+
          (epargne.length?'<button type="button" id="avEp"><span>🐷 Épargne</span><b>'+esc(fmtK(avEp))+'</b><small>'+epargne.length+' compte'+(epargne.length>1?'s':'')+' ›</small></button>':'')+
          (provisions.length?'<button type="button" id="avPr"><span>📦 Provisions</span><b>'+esc(fmtK(avPr))+'</b><small>'+(function(){ var nW=pv2Weak(); return nW?'<em>'+nW+' à renforcer</em>':provisions.length+' enveloppe'+(provisions.length>1?'s':''); })()+' ›</small></button>':'')+'</section>'; }
      if(!fraisCommuns.length && !provisions.length && !factures.length) h+='<div class="empty">Ajoute tes frais fixes (loyer, abonnements…) et tes provisions : les 12 prochains mois se remplissent tout seuls.</div>';
      // refonte : plus de boutons ici (Importer une facture → sous-onglet Factures, + Frais fixe → sous-onglet Frais fixes)
      if(!fyMember() || fyTabOn(fyCfg, "analyse")) h+='<section class="paper cacc" style="margin-top:12px"><div class="cacc-sec"><div class="cacc-h" id="avProj"><span class="t"><span class="tic">📈</span> '+(canUse("avancee")?'':'<span class="avplus">✦</span> ')+'Tes comptes dans 12 mois<small>projection et simulateur « et si… ? »</small></span><span class="ch">›</span></div></div></section>';
      app.innerHTML=h; setNav("factures", true); wireAvTabs();
      var smo=document.getElementById("soonMore"); if(smo) smo.onclick=function(){ state.soonAll=!(state.soonAll!=null ? state.soonAll : affDet()); render(); };
      [].forEach.call(document.querySelectorAll(".fct-col"), function(b){ b.onclick=function(){ state.factSel=b.getAttribute("data-m"); render(); }; });
      [].forEach.call(document.querySelectorAll(".avgoprov"), function(b){ b.onclick=function(){ state.avnSub="prov"; state.provId=b.getAttribute("data-id"); state.view="provdet"; render(); window.scrollTo(0,0); }; });
      var bi=document.getElementById("fctImp"); if(bi) bi.onclick=factImportChooser;
      var aep=document.getElementById("avEp"); if(aep) aep.onclick=function(){ state.cptPage="ep"; state.view="compte"; render(); window.scrollTo(0,0); };
      var apr=document.getElementById("avPr"); if(apr) apr.onclick=function(){ state.avnSub="prov"; render(); window.scrollTo(0,0); };
      var bpj=document.getElementById("avProj"); if(bpj) bpj.onclick=function(){ state.view="avancee"; state.avSub="proj"; state.avFrom="factures"; render(); window.scrollTo(0,0); };
    }

    // ----- Une série en détail -----
    function renderFactSerie(){
      if(!canUse("factures")){ state.view="factures"; state.avnSub="fact"; return renderFactures(); }
      var S=factSeries(), s=S.filter(function(x){ return x.key===state.factKey; })[0];
      if(!s){ state.view="factures"; return renderFactures(); }
      var curM=monthKey(todayISO()), ty=factType(s.type), est=s.next?factEstimate(s, s.next):0, ro=fyRO();
      var h=header(true, s.four||ty.l);
      // refonte du 19/11 : la prochaine facture en grand, puis un seul encadré d'action
      if(est) h+='<section class="paper av2-hero" id="fsHero"><div class="av2-k">Prochaine facture</div><div class="av2-big"><b>'+(factNoConso(s)?esc(fmtK(est)):'≈ '+esc(fctE(est)))+'</b><span>'+esc(s.next?'vers le '+ddmmyy(s.next):'')+'</span></div>'+
        '<div class="muted" style="font-size:12.5px;line-height:1.45">'+esc(factEstWhy(s, s.next))+' '+(factNoConso(s)?'Par mois, au prix actuel : ':'En moyenne ')+'<b style="color:var(--ink)">'+esc(fmtK(factMonthly(s)))+' / mois</b>.</div></section>';
      var fsAct=false;
      // une facture récente qui n'est pas dans les comptes (gardée sans ses effets) : on peut l'y mettre
      if(!ro) s.bills.filter(function(b){ return factCanAdd(b) || factProvMissing(b, s.prov); }).slice(-1).forEach(function(b){ fsAct=true;
        var inAcc=!!factFraisFor(b), bpv=provOfBill(b), tt=inAcc ? 'Pas retirée de la provision « '+esc(s.prov.nom)+' »' : (s.prov && !bpv ? 'Pas dans tes comptes ni retirée de « '+esc(s.prov.nom)+' »' : 'Pas dans tes comptes');
        h+='<section class="paper fct-miss"><div class="fct-top"><span class="fct-n"><b>'+tt+'</b><small>Facture du '+esc(ddmmyy(b.date))+' · '+esc(fmtK(b.montant))+(b.aPayer?' à payer':' prélevée'+(b.prelev?' le '+ddmm(b.prelev):''))+(inAcc?' · dans tes comptes':'')+'</small></span><button type="button" class="btn primary" data-addacc="'+esc(b.id)+'" style="flex:0 0 auto;padding:10px 14px">'+(inAcc?'Retirer':'Ajouter')+'</button></div></section>'; });
      // provision
      if(s.prov){ var pa=s.next?factProvAt(s.prov, factPayIso(s, s.next), est):null;
        h+='<section class="paper fct-pv"><div class="fct-top"><span class="fct-n"><b>Provision « '+esc(s.prov.nom)+' »</b><small>'+esc(fmtK(provBalance(s.prov, curM)))+' de côté · +'+esc(fmtK(mensuelAt(s.prov, curM)))+'/mois</small></span>'+
           (pa?'<span class="fct-v"><b class="'+(pa.manque>0.5?'fct-warn':'fct-ok')+'">'+(pa.manque>0.5?'il manquera '+esc(fmtK(pa.manque)):'prête')+'</b><small>'+(pa.manque>0.5?'pour celle de ':'il restera '+esc(fmtK(pa.reste))+' après celle de ')+esc(MOIS_NOMS[+pa.mk.slice(5,7)-1])+'</small></span>':'')+'</div></section>';
      } else if(!ro){ var mm=Math.ceil(factMonthly(s));
        h+='<section class="paper fct-pv"><div class="fct-top"><span class="fct-n"><b>Pas de provision</b><small>'+esc(fmtK(mm))+'/mois lisseraient tes factures</small></span>'+(provisions.length?'<button type="button" class="btn ghost" id="fsLink" style="flex:0 0 auto;padding:10px 12px">Lier</button>':'')+'<button type="button" class="btn ghost" id="fsProv" style="flex:0 0 auto;padding:10px 14px">Créer</button></div></section>';
      }
      // graphique des factures
      var B=s.bills.slice(-8), mx=1; B.forEach(function(b){ mx=Math.max(mx, b.montant||0); }); mx=Math.max(mx, est);
      var cols='', labs='';
      B.forEach(function(b){ var mi=+b.date.slice(5,7)-1; cols+='<div class="fct-bc"><small>'+Math.round(b.montant)+'</small><i style="height:'+Math.max(3, b.montant/mx*120)+'px'+(b.date<isoAddDays(todayISO(), -365)?';background:#5a6070':'')+'"></i></div>'; labs+='<span>'+MOIS3[mi]+'</span>'; });
      if(est && s.next){ cols+='<div class="fct-bc est"><small>'+(factNoConso(s)?Math.round(est):'≈'+Math.round(est))+'</small><i style="height:'+Math.max(3, est/mx*120)+'px"></i></div>'; labs+='<span style="color:#f0c38a">'+MOIS3[+s.next.slice(5,7)-1]+'</span>'; }
      h+='<section class="paper"><div class="fct-h"><span>'+esc(capFirst(factRythLabel(s.ryth)))+'</span><small>'+(est && s.next?'hachuré : estimée':'€ TTC')+'</small></div><div class="fct-chart bills">'+cols+'</div><div class="fct-m">'+labs+'</div></section>';
      // chiffres
      var y12=s.bills.filter(function(b){ return b.date>isoAddDays(todayISO(), -365) && !b.regul; }), y12p=s.bills.filter(function(b){ return b.date<=isoAddDays(todayISO(), -365) && b.date>isoAddDays(todayISO(), -730) && !b.regul; });
      var c12=y12.reduce(function(t,b){ return t+(b.conso||0); },0), c12p=y12p.length>=Math.max(1, Math.round(12/s.ryth)) ? y12p.reduce(function(t,b){ return t+(b.conso||0); },0) : 0;   // l'année d'avant, seulement si elle est complète
      (function(){ var L=s.last, amt=Number(L.montant)||0; if(!L.date || !(amt>0)) return; var seen={}, miss=null;
        s.bills.forEach(function(b){ if(b.prelev) seen[b.prelev.slice(0,7)]=1; if(b.date) seen[b.date.slice(0,7)]=1; });
        bankLines().forEach(function(x){ if(!(x.a<0) || x.d<=isoAddDays(L.prelev||L.date, 10) || !bankNameMatch(s.four, x.n)) return; var v=-x.a; if(Math.abs(v-amt)>Math.max(1, amt*0.5)) return;
          if(seen[x.d.slice(0,7)]) return; if(!miss || x.d>miss.d) miss={ d:x.d, v:v }; });
        if(miss) h+='<div class="fct-miss">📄 Prélevé le '+esc(ddmm(miss.d))+' sur ton relevé ('+esc(fmtK(miss.v))+'), mais pas de facture '+esc((/^[aeiouéèêh]/i.test(MOIS_NOMS[+miss.d.slice(5,7)-1])?"d'":"de ")+MOIS_NOMS[+miss.d.slice(5,7)-1])+'. <button type="button" class="ocr-raw" id="fsMissImp">Importer la facture</button></div>'; })();
      h+='<div class="fct-tiles">';
      if(c12>0 && ty.u) h+='<div class="fct-tile"><span>Consommation · 12 mois</span><b>'+esc(String(Math.round(c12)).replace(/\B(?=(\d{3})+(?!\d))/g," ")+' '+ty.u)+'</b><span'+(c12p>0?' class="'+(c12<=c12p?'fct-ok':'fct-warn')+'"':'')+'>'+(c12p>0?esc((c12>=c12p?'+':'−')+Math.abs(Math.round((c12/c12p-1)*100))+' % sur un an'):'')+'</span></div>';
      if(s.last.conso && ty.u){ var pu=s.last.montant/s.last.conso; h+='<div class="fct-tile"><span>Prix moyen payé</span><b>'+esc(pu.toFixed(ty.v==="eau"?2:3).replace(".",",")+' €/'+ty.u)+'</b><span>abonnement compris</span></div>'; }
      if(!est) h+='<div class="fct-tile"><span>'+(factNoConso(s)?'Par mois':'Par mois en moyenne')+'</span><b>'+esc(fmtK(factMonthly(s)))+'</b><span>'+(factNoConso(s)?'au prix actuel':'sur les 12 derniers mois')+'</span></div>';
      h+='</div>';
      // la liste
      h+='<div class="bsec-h">Factures<small>'+s.bills.length+'</small></div><section class="paper fct-list">';
      var fsAll=!!state.fsAll && state.fsAllK===s.key, fsL=s.bills.slice().reverse();
      fsL.slice(0, fsAll?fsL.length:3).forEach(function(b){
        h+='<button type="button" class="fct-row" data-id="'+esc(b.id)+'"><span class="fct-n"><b>'+esc(ddmmyy(b.date))+(b.regul?' · régularisation':'')+'</b><small>'+esc((b.du?ddmm(b.du)+' → '+ddmm(b.au||b.date):'')+(b.conso&&ty.u?(b.du?' · ':'')+b.conso+' '+ty.u:'')+(b.aPayer?(b.du||b.conso?' · ':'')+'à payer':(b.prelev?(b.du||b.conso?' · ':'')+'prélevée le '+ddmm(b.prelev):''))+(factFraisFor(b)?' · dans tes comptes':'')+(provOfBill(b)?' · payée par « '+provOfBill(b).nom+' »':''))+'</small></span><b class="ops-a">'+esc(fmtK(b.montant||0))+'</b></button>';
      });
      if(fsL.length>3) h+='<button type="button" class="fct-more" id="fsMore">'+(fsAll?'Moins ▴':'Voir les '+(fsL.length-3)+' plus anciennes')+'</button>';
      h+='</section>';
      if(!ro) h+='<button type="button" class="btn ghost" id="fsImp" style="margin-top:12px;width:100%">⇩ Importer une facture '+esc(s.four||"")+'</button><button type="button" class="btn ghost" id="fsDel" style="margin-top:10px;width:100%;color:var(--coral)">Supprimer « '+esc(s.four||ty.l)+' » et '+(s.bills.length>1?'ses '+s.bills.length+' factures':'sa facture')+'</button>';
      app.innerHTML=h; setNav("factures", true); var fsi=document.getElementById("fsMissImp"); if(fsi) fsi.onclick=factImportChooser;
      bindBack(function(){ state.view="factures"; render(); window.scrollTo(0,0); });
      // lier une provision qui existe déjà (ex. « Eau ») ; elle paie alors la dernière facture si elle ne l'est pas
      var lk=document.getElementById("fsLink"); if(lk) lk.onclick=function(){
        uiChoice("Lier une provision", "Elle suivra les factures de « "+esc(s.four)+" » et les paiera.", provisions.map(function(p){ return { l:p.nom+(p.fact&&p.fact!==s.key?" (liée à une autre)":""), primary:false, fn:function(){
          p.fact=s.key; persistProvisions(); var L=s.last; render(); uiToast("« "+p.nom+" » suit maintenant « "+s.four+" »");
          if(L && !L.prId && (L.date||"")>=isoAddDays(todayISO(), -120) && (factCanAdd(L) || factFraisFor(L))) factPayFlow(L, p); } }; }));
      };
      var cp=document.getElementById("fsProv"); if(cp) cp.onclick=function(){ factCreateProv(s); render(); uiToast("Provision « "+factProvName(s)+" » créée"); };
      var im=document.getElementById("fsImp"); if(im) im.onclick=factImportChooser;
      var mo=document.getElementById("fsMore"); if(mo) mo.onclick=function(){ state.fsAll=!fsAll; state.fsAllK=s.key; render(); };
      var dl=document.getElementById("fsDel"); if(dl) dl.onclick=function(){ factSeriesDelete(s.key); };
      [].forEach.call(document.querySelectorAll("[data-addacc]"), function(bt){ bt.onclick=function(){ var f=factures.filter(function(x){ return String(x.id)===bt.getAttribute("data-addacc"); })[0]; if(f) factPayFlow(f, s.prov); }; });
      // toucher une facture : la modifier ; appui long : Modifier / Supprimer (comme les tickets)
      [].forEach.call(document.querySelectorAll(".fct-row"), function(b){
        function fOf(){ var id=b.getAttribute("data-id"); return factures.filter(function(x){ return String(x.id)===String(id); })[0]; }
        b.onclick=function(){ if(ro) return; var f=fOf(); if(f) factEditSheet(f); };
        onLongPress(b, function(){ if(ro) return; var f=fOf(); if(!f) return;
          uiChoice("Facture du "+ddmmyy(f.date), esc(s.four)+" · "+esc(fmtK(f.montant||0)), [{ l:"✎ Modifier", fn:function(){ factEditSheet(f); } }, { l:"🗑 Supprimer", danger:true, fn:function(){ factDeleteUndo(f); } }]); });
      });
    }
    function factCreateProv(s){
      var p={ id:Date.now(), nom:factProvName(s), mensuel:Math.ceil(factMonthly(s)), soldeInitial:0, startMonth:monthKey(todayISO()), prelevements:[], fact:s.key };
      provisions.push(p); persistProvisions(); return p;
    }
    // Supprimer une facture (et son prélèvement pas encore fait, et son paiement par la provision) ; renvoie de quoi la remettre
    function factDelete(f){
      var out={ f:f, fr:null, prP:null, pr:null };
      factures=factures.filter(function(x){ return x!==f; });
      if(f.fraisId){ var fr=fraisCommuns.filter(function(x){ return String(x.id)===String(f.fraisId); })[0]; if(fr && !fraisDone(fr, fr.month)){ fraisCommuns=fraisCommuns.filter(function(x){ return x!==fr; }); out.fr=fr; persistFrais(); }
        else if(fr && fr.pp!=null && f.prId){ out.ppFr=fr; out.ppV=fr.pp; delete fr.pp; persistFrais(); } }
      if(f.prId) provisions.forEach(function(p){ var pr=(p.prelevements||[]).filter(function(x){ return String(x.id)===String(f.prId); })[0]; if(pr){ p.prelevements=p.prelevements.filter(function(x){ return x!==pr; }); out.prP=p; out.pr=pr; persistProvisions(); } });
      persistFactures();
      return out;
    }
    // Facture ↔ comptes : son prélèvement (ou « à payer ») dans les frais fixes du mois
    function factFraisFor(f){ return f && f.fraisId ? fraisCommuns.filter(function(x){ return String(x.id)===String(f.fraisId); })[0]||null : null; }
    // peut aller dans les comptes : pas encore dedans, et pas déjà passée (prélèvement de ce mois ou plus tard, sinon facture de moins de 75 jours)
    function factCanAdd(f){ if(!f || factFraisFor(f) || !(Number(f.montant)>0)) return false; var t=todayISO();
      if(f.prelev) return f.prelev.slice(0,7)>=t.slice(0,7); return (f.date||"")>=isoAddDays(t, -75); }
    // pour qui et quel compte : comme le dernier prélèvement de ce fournisseur, sinon son frais fixe, sinon la mise de côté de sa provision, sinon Commun
    function factAccOf(f, p){
      var key=factKey(f), lf=null; fraisCommuns.forEach(function(x){ if(x.fact===key && !x.est && x.id!==f.fraisId) lf=x; });
      var rf=factRecFrais(f), src=lf||rf||(p ? provFraisOf(p) : null), who=src ? ((src.personne||"").trim()||"Commun") : "Commun", o={ who:who, rf:rf };
      if(who==="Commun" && src && src.split) o.split=true; else if(src && src.compte) o.compte=src.compte;
      o.acct=(o.compte && acctByKey(o.compte)) || (who==="Commun" ? mainAcct() : payAcctOf(who)) || mainAcct();
      return o;
    }
    function factAddToAccounts(f, toast, opt){
      opt=opt||{};
      var key=factKey(f), m=factPayMonth(f), amt=Math.round((Number(f.montant)||0)*100)/100;
      var pb=(opt.pp!=null ? provById(opt.pp) : null) || provOfBill(f), A=factAccOf(f, pb||factProvFor(f)), rf=A.rf, who=A.who;
      fraisCommuns=fraisCommuns.filter(function(x){ return !(x.fact===key && x.est && x.month===m); });   // l'estimation de ce mois-là
      var jour=f.prelev ? +f.prelev.slice(8,10) : (f.due && f.due.slice(0,7)===m ? +f.due.slice(8,10) : 0);
      var x={ id:Date.now()+Math.floor(Math.random()*1000), label:f.four+(f.aPayer?" · à payer":" · facture du "+ddmm(f.date)), montant:amt, personne:who, recurrent:false, month:m, fact:key, factNom:f.four };
      if(jour) x.jour=jour; if(f.aPayer) x.aPayer=true;
      if(A.split) x.split=true; else if(A.compte) x.compte=A.compte;
      if(pb && f.prId) x.pp=pb.id;   // déjà payée par la provision : hors parts
      fraisCommuns.push(x); f.fraisId=x.id;
      var repl=!pb && rf && fraisActif(rf, m);   // payée par une provision : la mise de côté du mois continue
      if(repl){ if(!rf.skipMonths) rf.skipMonths={}; rf.skipMonths[m]=true; }   // à la place du frais fixe qui l'estimait
      persistFrais(); persistFactures();
      if(toast){ render(); var acc=(x.compte && acctByKey(x.compte))||mainAcct(); uiToast("Ajoutée à « À venir » de "+(acc?acc.nom:"ton compte")+" · "+monthLabelOf(m)+(repl?" (à la place de « "+rf.label+" »)":"")); }
      return x;
    }
    // Supprimer un fournisseur : ses factures, leurs prélèvements à venir, l'estimation de la prochaine ;
    // sa provision est gardée (l'argent mis de côté reste), seulement détachée
    function factSeriesDelete(key){
      var bl=factures.filter(function(x){ return factKey(x)===key; }); if(!bl.length) return;
      var nm=bl[bl.length-1].four||factType(bl[0].type).l, n=bl.length, pv=provisions.filter(function(p){ return p.fact===key; });
      uiConfirm("Supprimer « "+esc(nm)+" » et <b>"+(n>1?"ses "+n+" factures":"sa facture")+"</b> ?"+(pv.length?"<br><small>Sa provision « "+esc(pv[0].nom)+" » est gardée.</small>":""), function(){
        var del=bl.map(function(f){ return factDelete(f); }), est=fraisCommuns.filter(function(x){ return x.fact===key && x.est; });
        if(est.length){ fraisCommuns=fraisCommuns.filter(function(x){ return est.indexOf(x)<0; }); persistFrais(); }
        pv.forEach(function(p){ delete p.fact; }); if(pv.length) persistProvisions();
        var v0=state.view; state.view="factures"; state.avnSub="fact"; render(); window.scrollTo(0,0);
        uiUndoToast("« "+nm+" » et "+(n>1?"ses "+n+" factures":"sa facture")+" supprimés", "Annuler", function(){
          del.forEach(function(o){ factures.push(o.f); if(o.fr) fraisCommuns.push(o.fr); if(o.ppFr) o.ppFr.pp=o.ppV; if(o.pr && o.prP){ if(!o.prP.prelevements) o.prP.prelevements=[]; o.prP.prelevements.push(o.pr); } });
          est.forEach(function(x){ fraisCommuns.push(x); }); pv.forEach(function(p){ p.fact=key; });
          persistFactures(); persistFrais(); persistProvisions();
          state.view=v0; state.factKey=key; render(); uiToast("« "+nm+" » remis");
        });
      }, { title:"Supprimer un fournisseur", ok:"Supprimer", danger:true });
    }
    function factDeleteUndo(f){
      var v0=state.view, k0=state.factKey, o=factDelete(f); render();
      uiUndoToast("Facture du "+ddmmyy(f.date)+" supprimée", "Annuler", function(){
        factures.push(o.f); persistFactures();
        if(o.fr){ fraisCommuns.push(o.fr); persistFrais(); }
        if(o.ppFr){ o.ppFr.pp=o.ppV; persistFrais(); }
        if(o.pr && o.prP){ if(!o.prP.prelevements) o.prP.prelevements=[]; o.prP.prelevements.push(o.pr); persistProvisions(); }
        state.view=v0; state.factKey=k0; render(); uiToast("Facture remise");
      });
    }
    // Modifier une facture déjà enregistrée ; son prélèvement à venir et son paiement par la provision suivent le montant
    function factEditSheet(f){
      var ty=factType(f.type), pay=!!f.aPayer;
      function dt(id, lbl, v){ return '<div><label class="f" for="'+id+'">'+lbl+'</label><input class="f" id="'+id+'" type="date" value="'+esc(v||"")+'"></div>'; }
      var h='<div class="fold"><div class="fo-h"><b>Facture du '+esc(ddmmyy(f.date))+'</b><span class="fpill">'+esc(ty.l)+'</span></div>';
      h+='<label class="f" for="fe-four">Fournisseur</label><input class="f" id="fe-four" value="'+esc(f.four||"")+'">';
      h+='<div class="row2"><div><label class="f" for="fe-mt">Montant (€)</label><input class="f" id="fe-mt" inputmode="decimal" value="'+esc(f.montant!=null?Number(f.montant).toFixed(2).replace(".",","):"")+'"></div>'+dt("fe-date", "Date", f.date)+'</div>';
      h+='<label class="f">Paiement</label><div class="chips" id="fe-pay"><button type="button" class="chip'+(!pay?' on':'')+'" data-v="prel">Prélèvement</button><button type="button" class="chip'+(pay?' on':'')+'" data-v="apayer">À payer moi-même</button></div>';
      h+='<div class="row2">'+dt("fe-prel", pay?"À payer avant le":"Prélevé le", pay?f.due:f.prelev)+(ty.u?'<div><label class="f" for="fe-conso">Consommation ('+ty.u+')</label><input class="f" id="fe-conso" inputmode="decimal" value="'+esc(f.conso!=null?String(f.conso):"")+'"></div>':'')+'</div>';
      h+='<div class="row2">'+dt("fe-du", "Consommé du", f.du)+dt("fe-au", "au", f.au)+'</div>';
      var pv0=provOfBill(f);
      if(pv0) h+='<div class="fnote" style="margin:10px 2px 0">✓ Payée par la provision « '+esc(pv0.nom)+' ».</div>';
      else if(provisions.length) h+='<button type="button" class="btn ghost" id="fePrv" style="margin-top:12px">Payer avec une provision</button>';
      var fr0=factFraisFor(f);
      if(fr0) h+='<div class="fnote" style="margin:10px 2px 0">✓ Dans tes comptes : « À venir » de '+esc(monthLabelOf(fr0.month||factPayMonth(f)))+(fr0.pp!=null?', hors parts du Commun':'')+'.</div>';
      else if(factCanAdd(f)) h+='<button type="button" class="btn ghost" id="feAcc" style="margin-top:12px">Ajouter à mes comptes (« À venir » de '+esc(monthLabelOf(factPayMonth(f)))+')'+(factProvFor(f)?' · payée par « '+esc(factProvFor(f).nom)+' »':'')+'</button>';
      h+='<div class="ui-err" style="display:none"></div>';
      h+='<div class="ui-actions"><button type="button" class="btn danger" id="feDel">Supprimer</button><button type="button" class="btn primary" id="feOk">Enregistrer</button></div></div>';
      var s=uiSheet(h);
      [].forEach.call(s.qa("#fe-pay .chip"), function(b){ b.onclick=function(){ [].forEach.call(s.qa("#fe-pay .chip"), function(x){ x.className="chip"; }); b.className="chip on"; pay=b.getAttribute("data-v")==="apayer"; var l=s.q('label[for="fe-prel"]'); if(l) l.textContent=pay?"À payer avant le":"Prélevé le"; }; });
      function err(m){ var e=s.q(".ui-err"); e.textContent=m||""; e.style.display=m?"":"none"; }
      s.q("#feDel").onclick=function(){ s.close(); factDeleteUndo(f); };
      var fa=s.q("#feAcc"); if(fa) fa.onclick=function(){ s.close(); factPayFlow(f); };
      var fp=s.q("#fePrv"); if(fp) fp.onclick=function(){ s.close(); provChooseFor(f); };
      s.q("#feOk").onclick=function(){
        var g=function(id){ var e=s.q("#"+id); return e ? e.value.trim() : ""; };
        var four=g("fe-four"), amt=num(g("fe-mt")), date=g("fe-date"), d2=g("fe-prel"), cs=g("fe-conso"), du=g("fe-du"), au=g("fe-au");
        if(!(amt>0)){ err("Indique le montant de la facture"); return; }
        if(!date){ err("Indique la date de la facture"); return; }
        var k0=factKey(f), oldAmt=Number(f.montant)||0, renamed=four && norm(four)!==norm(f.four||"");
        var others=factures.filter(function(x){ return x!==f && factKey(x)===k0; });
        function apply(all){
          f.montant=amt; f.date=date;
          if(pay){ f.aPayer=true; delete f.prelev; if(d2) f.due=d2; else delete f.due; } else { delete f.aPayer; delete f.due; if(d2) f.prelev=d2; else delete f.prelev; }
          if(ty.u){ var c=cs==="" ? null : num(cs); if(c>0) f.conso=c; else delete f.conso; }
          if(du) f.du=du; else delete f.du; if(au) f.au=au; else delete f.au;
          if(Math.abs(amt-oldAmt)>0.004){
            if(f.fraisId) fraisCommuns.forEach(function(x){ if(String(x.id)===String(f.fraisId) && !x.recurrent) x.montant=Math.round(amt*100)/100; });
            if(f.prId) provisions.forEach(function(p){ (p.prelevements||[]).forEach(function(x){ if(String(x.id)===String(f.prId)) x.montant=amt; }); });
          }
          if(renamed){
            var moved=all ? others.concat([f]) : [f];
            moved.forEach(function(x){ x.four=four; });
            var k1=factKey(f);
            // ce qui suivait la série (provision, prélèvements, estimation) suit le nouveau nom
            if(all){ provisions.forEach(function(p){ if(p.fact===k0) p.fact=k1; }); fraisCommuns.forEach(function(x){ if(x.fact===k0){ x.fact=k1; x.factNom=four; } });
              var al=store.read("factAlias", {})||{}; al[k0.split("|")[1]]=four; store.write("factAlias", al); }   // les prochaines factures lues prendront ce nom
            else if(f.fraisId) fraisCommuns.forEach(function(x){ if(String(x.id)===String(f.fraisId)){ x.fact=k1; x.factNom=four; } });
          }
          persistFactures(); persistFrais(); persistProvisions();
          if(renamed && (all || !others.length)) state.factKey=factKey(f);
          render(); uiToast(renamed && all ? (others.length+1)+" factures renommées « "+four+" »" : "Facture modifiée");
        }
        s.close();
        if(renamed && others.length) uiChoice("Renommer en « "+four+" »", "Les autres factures de « "+esc(f.four||"")+" » aussi ?", [
          { l:"Toutes ses factures ("+(others.length+1)+")", primary:true, fn:function(){ apply(true); } },
          { l:"Seulement celle-ci", primary:false, fn:function(){ apply(false); } } ]);
        else apply(false);
      };
    }

    // ----- Importer une facture : PDF (texte lu sur le téléphone) ou photos page par page -----
    var PDFJS_V="6.2.108", pdfjsP=null;
    function loadPdfJs(){
      if(window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
      if(pdfjsP) return pdfjsP;
      pdfjsP=new Promise(function(res, rej){
        var base="./pdfjs/", done=false;   // dans l'appli (Store : copié à la compilation ; navigateur : beta/pdfjs, workflow deps)
        function fin(){ if(done) return; done=true; window.removeEventListener("tk-pdfjs", fin); clearTimeout(to); if(window.pdfjsLib) res(window.pdfjsLib); else { pdfjsP=null; rej(new Error("lecteur de PDF indisponible (connexion ?)")); } }
        var to=setTimeout(fin, 25000);
        window.addEventListener("tk-pdfjs", fin);
        var sc=document.createElement("script"), abs=new URL(base, location.href).href, code;
        base=abs;   // script chargé par une adresse blob: (la CSP n'autorise pas les scripts écrits dans la page) : chemins complets
        code='import("'+base+'pdf.min.mjs").then(function(P){ P.GlobalWorkerOptions.workerSrc="'+base+'pdf.worker.min.mjs"; window.pdfjsLib=P; }).catch(function(){}).then(function(){ window.dispatchEvent(new Event("tk-pdfjs")); });';
        sc.src=URL.createObjectURL(new Blob([code], { type:"text/javascript" }));
        document.head.appendChild(sc);
      });
      return pdfjsP;
    }
    // texte d'une page de PDF : les morceaux à la même hauteur forment une ligne, de gauche à droite (deux espaces entre colonnes)
    function pdfLines(items){
      var it=[]; (items||[]).forEach(function(x){ if(!x || !x.str || !String(x.str).trim()) return; var tr=x.transform||[1,0,0,1,0,0]; it.push({ t:String(x.str), x:tr[4], y:tr[5], h:Math.abs(tr[3])||x.height||8, w:x.width||0 }); });
      it.sort(function(a,b){ return (b.y-a.y)||(a.x-b.x); });
      var rows=[];
      it.forEach(function(p){ var r=rows[rows.length-1]; if(r && Math.abs(r.y-p.y)<Math.max(2, p.h*0.45)) r.it.push(p); else rows.push({ y:p.y, it:[p] }); });
      return rows.map(function(r){ r.it.sort(function(a,b){ return a.x-b.x; }); var s="", end=null;
        r.it.forEach(function(p){ if(end!==null){ var gap=p.x-end; s+=gap>p.h*1.2?"  ":(gap>p.h*0.15?" ":""); } s+=p.t; end=p.x+p.w; });
        return s.replace(/\s+$/,""); }).join("\n");
    }
    // Factur-X / ZUGFeRD : certaines factures PDF contiennent leurs données (XML joint) ; lues telles quelles, elles passent devant la lecture du texte.
    // Ajoutées en fin de texte sur une ligne « [Factur-X] … » que parseBill reconnaît (elles suivent ainsi la facture partout).
    function factFxParse(xml){
      function tag(n){ var m=new RegExp("<(?:\\w+:)?"+n+"\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?"+n+">").exec(xml); return m ? m[1] : ""; }
      function dt(n){ var m=/(\d{4})(\d{2})(\d{2})/.exec(tag(n).replace(/<[^>]+>/g, "")); return m ? m[1]+"-"+m[2]+"-"+m[3] : ""; }
      var amt=parseFloat((tag("DuePayableAmount")||tag("GrandTotalAmount")||"").replace(/<[^>]+>/g, "")), seller=tag("SellerTradeParty"), nm=/<(?:\w+:)?Name\b[^>]*>([^<]+)</.exec(seller||"");
      var out=[], d=dt("IssueDateTime"), due=dt("DueDateDateTime");
      if(d) out.push("date="+d); if(amt>0) out.push("montant="+amt.toFixed(2)); if(due) out.push("echeance="+due); if(nm) out.push("fournisseur="+nm[1].replace(/\s+/g," ").trim());
      return out.length ? "[Factur-X] "+out.join(" ; ") : "";
    }
    function factFxRead(doc){
      var g; try{ g=doc.getAttachments(); }catch(e){ return Promise.resolve(""); }
      return Promise.resolve(g).then(function(att){
        var L=[]; if(att && typeof att.forEach==="function" && typeof att.get==="function") att.forEach(function(v, k){ L.push({ k:k, v:v||{} }); });   // pdf.js récent : une Map
        else Object.keys(att||{}).forEach(function(k){ L.push({ k:k, v:att[k]||{} }); });
        var pick=null; L.forEach(function(x){ var f=x.v.filename||x.k; if(!pick && /factur-?x|zugferd|xrechnung|order-x/i.test(f)) pick=x; });
        if(!pick) L.forEach(function(x){ var f=x.v.filename||x.k; if(!pick && /\.xml$/i.test(f)) pick=x; });
        if(!pick) return "";
        var cp=pick.v.content ? Promise.resolve(pick.v.content) : (typeof doc.getAttachmentContent==="function" ? doc.getAttachmentContent(pick.k) : Promise.resolve(null));
        return cp.then(function(c){ if(!c) return ""; var xml=""; try{ xml=new TextDecoder("utf-8").decode(c); }catch(e){ return ""; }
          return /CrossIndustryInvoice/i.test(xml) ? factFxParse(xml) : ""; }); }).catch(function(){ return ""; });
    }
    function readPdfText(file){
      return loadPdfJs().then(function(P){
        return new Promise(function(res, rej){ var fr=new FileReader(); fr.onload=function(){ res(fr.result); }; fr.onerror=function(){ rej(new Error("fichier illisible")); }; fr.readAsArrayBuffer(file); })
          .then(function(buf){ return P.getDocument({ data:new Uint8Array(buf), isEvalSupported:false }).promise; })
          .then(function(doc){ var pages=[], i=0;
            function nx(){ i++; if(i>doc.numPages) return Promise.resolve(); return doc.getPage(i).then(function(pg){ return pg.getTextContent(); }).then(function(tc){ pages.push(pdfLines(tc.items)); return nx(); }); }
            return nx().then(function(){ return factFxRead(doc); }).then(function(fx){ return { text:pages.join("\n")+(fx?"\n"+fx:""), n:doc.numPages }; }); });
      });
    }
    // Photo d'une page : ML Kit sur le téléphone ; une page tournée est relue dans les autres sens si la lecture est trop courte
    function nativeImageRot(file, deg){
      return new Promise(function(resolve, reject){
        function draw(src, w, h){ var lo=Math.max(w,h), k=lo>2200?2200/lo:1, W=Math.max(1,Math.round(w*k)), Hh=Math.max(1,Math.round(h*k)), c=document.createElement("canvas"), sw=(deg===90||deg===270);
          c.width=sw?Hh:W; c.height=sw?W:Hh; var x=c.getContext("2d"); x.translate(c.width/2, c.height/2); x.rotate(deg*Math.PI/180); x.drawImage(src, -W/2, -Hh/2, W, Hh);
          var u=c.toDataURL("image/jpeg",0.9); resolve(u.slice(u.indexOf(",")+1)); }
        function viaImg(){ var img=new Image(); img.onload=function(){ try{ draw(img, img.naturalWidth||img.width, img.naturalHeight||img.height); }catch(e){ reject(e); } }; img.onerror=function(){ reject(new Error("image illisible")); }; img.src=URL.createObjectURL(file); }
        try{ if(self.createImageBitmap) createImageBitmap(file).then(function(b){ try{ draw(b,b.width,b.height); }catch(e){ viaImg(); } }).catch(viaImg); else viaImg(); }catch(e){ viaImg(); }
      });
    }
    function ocrBillPage(file){
      var plug=capPlugin("TicketOcr");
      if(!plug) return loadTesseract().then(function(ok){ if(!ok) return { t:"", res:null }; return Tesseract.recognize(file, "fra+eng", tessOpts({})).then(function(r){ return { t:(r.data&&r.data.text)||"", res:null }; }); });
      function once(rot){ return nativeImageRot(file, rot).then(function(b64){ return plug.recognize({ image:b64 }); }).then(function(res){ return { t:mlkitRows(res||{}), res:res||null }; }); }
      function len(x){ return (x.t||"").replace(/\s/g,"").length; }
      return once(0).then(function(a){
        if(len(a)>=300) return a;
        var best=a, ch=Promise.resolve();
        [90,270,180].forEach(function(r){ ch=ch.then(function(){ if(len(best)>=300) return; return once(r).then(function(b){ if(len(b)>len(best)) best=b; }).catch(function(){}); }); });
        return ch.then(function(){ return best; });
      });
    }
    var factPdfIn=null, factImgIn=null;
    function factInputs(){
      if(factPdfIn) return;
      factPdfIn=document.createElement("input"); factPdfIn.type="file"; factPdfIn.accept="application/pdf,.pdf"; factPdfIn.multiple=true; factPdfIn.style.display="none"; factPdfIn.id="factpdf";
      factImgIn=document.createElement("input"); factImgIn.type="file"; factImgIn.accept="image/*"; factImgIn.multiple=true; factImgIn.style.display="none"; factImgIn.id="factimg";
      document.body.appendChild(factPdfIn); document.body.appendChild(factImgIn);
      factPdfIn.onchange=function(ev){ var fs=ev.target.files ? [].slice.call(ev.target.files) : []; ev.target.value=""; if(fs.length===1) factFromPdf(fs[0]); else if(fs.length) factFromPdfs(fs); };
      factImgIn.onchange=function(ev){ var fs=ev.target.files ? [].slice.call(ev.target.files) : []; ev.target.value="";
        if(factImgIn._retake){ var rk=factImgIn._retake; factImgIn._retake=0; if(fs.length) factRetakeRead(fs[0], rk); return; }
        if(fs.length) factFromPhotos(fs, !!factImgIn._add); factImgIn._add=false; };
    }
    function factImportChooser(){
      if(!canUse("factures")){ factPlusAsk(); return; }
      factInputs();
      uiChoice("Importer une facture", "Elle est lue sur ton téléphone : rien n'est envoyé.", [
        { l:"Un ou plusieurs PDF (espace client)", primary:true, fn:function(){ factPdfIn.click(); } },
        { l:"Des photos, une par page", fn:function(){ docScan(12, function(fs){ factFromPhotos(fs, false); }, function(){ factImgIn._add=false; factImgIn.click(); }); } }
      ]);
    }
    function factBusy(msg){ state.factDraft={ busy:true, msg:msg, pages:[] }; state.view="factlue"; render(); window.scrollTo(0,0); }
    function factFromPdf(file){
      factBusy("Lecture du PDF…");
      readPdfText(file).then(function(r){
        if(r.text.replace(/\s/g,"").length<80){ state.factDraft=null; state.view="factures"; render(); uiChoice("Ce PDF est une image", "Il ne contient pas de texte lisible. Prends plutôt ses pages en photo.", [{ l:"Prendre les pages en photo", primary:true, fn:function(){ factInputs(); factImgIn._add=false; factImgIn.click(); } }, { l:"Annuler", fn:function(){} }]); return; }
        factOpenDraft([r.text], "pdf", r.n, [{ t:r.text, res:null }]);
      }).catch(function(e){ state.factDraft=null; state.view="factures"; render(); uiToast("PDF illisible : "+((e&&e.message)||e)); });
    }
    function factDup(p){ return factures.filter(function(f){ return factKey(f)===factKey(p) && f.date===p.date && Math.abs((f.montant||0)-(Number(p.montant)||0))<0.01; })[0]||null; }
    // Plusieurs PDF : les factures plus anciennes vont directement dans l'historique, la plus récente est à vérifier
    function factFromPdfs(files){
      factBusy("Lecture des PDF : 1/"+files.length+"…");
      var got=[], i=0, bad=[];
      function step(){
        if(i>=files.length) return fin();
        var sm=document.getElementById("fctmsg"); if(sm) sm.textContent="Lecture des PDF : "+(i+1)+"/"+files.length+"…";
        var k=i;
        readPdfText(files[i]).then(function(r){ if(r.text.replace(/\s/g,"").length>=80) got.push({ p:parseBill(r.text), r:r, k:k }); else bad.push(k+1); i++; step(); }).catch(function(){ bad.push(k+1); i++; step(); });
      }
      function fin(){
        if(!got.length){ state.factDraft=null; state.view="factures"; render(); uiToast("Aucune facture lisible dans ces PDF"); return; }
        if(got.length===1 && !bad.length){ factOpenDraft([got[0].r.text], "pdf", got[0].r.n, [{ t:got[0].r.text, res:null }]); return; }
        factMultiOpen("pdf", got.map(function(g){ return { tx:[g.r.text], rw:[{ t:g.r.text, res:null }], p:g.p, pages:[g.k+1], n:g.r.n }; }), files.length, bad, null);
      }
      step();
    }
    // Factures plus anciennes (plusieurs PDF, ou plusieurs factures en photos) : directement dans l'historique
    function factToHistory(list, src){
      var n=0, dupl=0, al=store.read("factAlias", {})||{};
      list.forEach(function(g){ var p=g.p; if(al[norm(p.four)]) p.four=al[norm(p.four)]; var S=factSeries(), same=S.filter(function(s){ return s.key===factKey(p); })[0]; if(same) p.four=same.four;
        if(factDup(p)){ dupl++; return; }
        var f={ id:Date.now()+n, four:p.four, type:p.type, date:p.date, montant:p.montant, src:src }; ["prelev","due","du","au","next"].forEach(function(k){ if(p[k]) f[k]=p[k]; }); if(p.aPayer){ f.aPayer=true; delete f.prelev; } if(p.conso>0) f.conso=p.conso; if(p.regul) f.regul=true;
        factures.push(f); n++; });
      if(n) persistFactures();
      return { n:n, dupl:dupl };
    }
    // Montant à payer d'une page (en centimes), 0 s'il n'y est pas
    function factPayAmt(t){
      var lines=factTxtFix(t).replace(/[  ]/g," ").split("\n").map(function(l){ return l.trim(); }).filter(Boolean), flat=lines.join("\n");
      var m=/montant\s+de\s+(\d[\d ]*,\d\d)\s*€?\s*sera\s+pr[ée]lev[ée]/i.exec(flat); if(m){ var a=factAmts(m[1])[0]; if(a>0) return Math.round(a*100); }
      var v=factLabelAmt(lines, FACT_PAYRE); return v>0 ? Math.round(v*100) : 0;
    }
    // Photos de plusieurs factures prises d'un coup (recto, verso…) : une page rejoint la facture qui a sa date,
    // sinon celle qui a son montant à payer ; une page avec une autre date commence une nouvelle facture ;
    // une page sans date ni montant suit la précédente.
    function factSplitPages(texts){
      var G=[];
      texts.forEach(function(t, i){
        var d=parseBill(t).date||"", a=factPayAmt(t), g=null;
        if(d) g=G.filter(function(x){ return x.d===d; })[0]||null;
        if(!g && a) g=G.filter(function(x){ return x.a===a && (!d || !x.d); })[0]||null;
        if(!g && !d) g=G[G.length-1]||null;
        if(!g){ g={ d:d, a:a, idx:[] }; G.push(g); }
        if(!g.d) g.d=d; if(!g.a) g.a=a; g.idx.push(i);
      });
      return G;
    }
    // Photos lues : une page est « lue » s'il y a assez de texte ; plusieurs factures (ou une photo illisible) → écran de contrôle
    function factPhotosDone(texts, raws){
      var ok=[], bad=[]; texts.forEach(function(t, k){ if(String(t||"").replace(/\s/g,"").length>=60) ok.push(k); else bad.push(k+1); });
      if(!ok.length){ state.factDraft=null; state.view="factures"; render(); uiToast(texts.length>1?"Rien de lisible sur ces photos : réessaie, bien à plat et éclairées":"Rien de lisible sur la photo : réessaie, bien à plat et éclairée"); return; }
      var tx=ok.map(function(k){ return texts[k]; }), G=tx.length>1 ? factSplitPages(tx) : [{ idx:[0] }];
      if(G.length<2 && !bad.length){ factOpenDraft(tx, "photo", tx.length, ok.map(function(k){ return raws[k]; })); return; }
      var items=G.map(function(g){ var ks=g.idx.map(function(j){ return ok[j]; }), t2=ks.map(function(k){ return texts[k]; });
        return { tx:t2, rw:ks.map(function(k){ return raws[k]; }), p:parseBill(t2.join("\n")), pages:ks.map(function(k){ return k+1; }) }; });
      factMultiOpen("photo", items, texts.length, bad, { texts:texts, raws:raws });
    }
    // Plusieurs factures lues : la plus récente (date) est vérifiée en entier, les autres sont listées au-dessus,
    // à contrôler une par une ; rien n'est enregistré avant « Appliquer ». Une facture lue sur moins de pages
    // que les autres, ou sans date ni montant, est « à vérifier ».
    function factMultiOpen(kind, items, total, bad, all){
      var maxP=0; items.forEach(function(b){ if(b.pages.length>maxP) maxP=b.pages.length; });
      var dated=items.filter(function(b){ return b.p.date && b.p.montant>0; }).sort(function(a,b){ return a.p.date<b.p.date?-1:1; });
      var last=dated.length ? dated[dated.length-1] : items[items.length-1];
      var others=items.filter(function(b){ return b!==last; }).sort(function(a,b){ return (a.p.date||"")<(b.p.date||"")?-1:1; });
      var al=store.read("factAlias", {})||{};
      others.forEach(function(o){ o.keep=true; o.short=o.pages.length<maxP; o.check=o.short || !o.p.date || !(o.p.montant>0); o.four0=o.p.four; o.orig={ date:o.p.date||"", montant:o.p.montant }; if(o.p.four && al[norm(o.p.four)]) o.p.four=al[norm(o.p.four)]; });
      factOpenDraft(last.tx, kind, last.n||last.tx.length, last.rw, { kind:kind, total:total, read:total-bad.length, bad:bad, others:others, pages:last.pages, all:all||null });
    }
    function factPhotosTxt(ns, kind){ var a=(ns||[]).slice(); if(kind==="pdf") return "PDF "+a.join(", "); if(a.length<2) return "photo "+(a[0]||"");
      var l=a.pop(); return "photos "+a.join(", ")+" et "+l; }
    // factures plus anciennes gardées, de la même série, comme des factures déjà là (estimation, comparaison)
    function factDraftOthers(d, key){
      if(!d.multi) return [];
      var out=[]; d.multi.others.forEach(function(o, i){ var q=o.p; if(!o.keep || !q.date || !(q.montant>0) || factKey(q)!==key) return;
        out.push({ id:"_o"+i, four:q.four, type:q.type, date:q.date, montant:q.montant, conso:q.conso, du:q.du, au:q.au, prelev:q.aPayer?"":q.prelev, next:q.next, regul:q.regul, aPayer:q.aPayer }); });
      return out;
    }
    // Reprendre une photo illisible : elle est relue, puis tout est regroupé à nouveau
    function factRetake(k){ factInputs(); factImgIn._retake=k; factImgIn._add=false; factImgIn.click(); }
    function factRetakeRead(file, k){
      var d=state.factDraft; if(!d || !d.multi || !d.multi.all) return;
      var A=d.multi.all; d.busy=true; d.msg="Lecture de la photo "+k+"…"; render();
      ocrBillPage(file).then(function(r){ A.texts[k-1]=r.t||""; A.raws[k-1]=r; factPhotosDone(A.texts, A.raws); })
        .catch(function(){ d.busy=false; render(); uiToast("Photo illisible : réessaie, bien à plat et éclairée"); });
    }
    function factFromPhotos(files, add){
      var prev=add && state.factDraft && !state.factDraft.busy ? state.factDraft : null;
      if(!prev) factBusy(files.length>1?"Lecture de la page 1/"+files.length+"…":"Lecture de la page…");
      else { prev.busy=true; prev.msg="Lecture de la page "+(prev.pages.length+1)+"…"; render(); }
      var texts=[], raws=[], i=0;
      function step(){
        if(i>=files.length){
          if(prev){ prev.pages=prev.pages.concat(texts); prev.raws=(prev.raws||[]).concat(raws); prev.n+=files.length; prev.busy=false; factReparse(prev); render(); return; }
          factPhotosDone(texts, raws); return;
        }
        var sm=document.getElementById("fctmsg"); if(sm && files.length>1) sm.textContent="Lecture de la page "+(i+1)+"/"+files.length+"…";
        ocrBillPage(files[i]).then(function(r){ texts.push(r.t||""); raws.push(r); i++; step(); }).catch(function(){ texts.push(""); raws.push({ t:"", res:null }); i++; step(); });
      }
      step();
    }
    // Brouillon de la facture lue : champs modifiables, effets à cocher
    function factOpenDraft(pages, src, n, raws, multi){
      var d={ busy:false, pages:pages, src:src, n:n, raws:raws||[], edited:{}, multi:multi||null };
      factReparse(d);
      // les plus anciennes : même fournisseur et même type que la plus récente quand elles n'en ont pas ;
      // nouveau fournisseur : le nom le mieux écrit (avec ses accents) parmi les factures lues
      if(d.multi){
        var nb=norm(d.p.four), acc=function(x){ return (String(x||"").match(/[À-ÿ]/g)||[]).length; };
        if(!factSeries().some(function(x){ return x.key===factKey(d.p); })) d.multi.others.forEach(function(o){ if(norm(o.p.four)===nb && acc(o.p.four)>acc(d.p.four)){ d.p.four=o.p.four; d.raw0=o.p.four; } });
        d.multi.others.forEach(function(o){ var q=o.p; if(q.type==="autre" && d.p.type!=="autre") q.type=d.p.type;
          if(!q.four || norm(q.four)===norm(d.p.four)) q.four=d.p.four; });
      }
      state.factDraft=d; state.view="factlue"; render(); window.scrollTo(0,0);
    }
    function factReparse(d){
      var p=parseBill(d.pages.join("\n")), old=d.p||{}; d.four0=p.four;
      Object.keys(d.edited||{}).forEach(function(k){ p[k]=old[k]; });
      // même fournisseur déjà connu : son nom tel que tu l'as gardé
      var al=store.read("factAlias", {})||{}; if(!d.edited.four && p.four && al[norm(p.four)]) p.four=al[norm(p.four)];
      var S=factSeries(), same=S.filter(function(s){ return s.key===factKey(p); })[0];
      if(same && !d.edited.four) p.four=same.four;
      else if(!p.fourSure && !d.edited.four){ var ty=S.filter(function(s){ return s.type===p.type; }); if(ty.length===1) p.four=ty[0].four; }
      if(!p.four) p.four=factType(p.type).l;
      d.p=p; d.raw0=p.four;
      // compte et « pour qui » : comme la dernière facture de ce fournisseur, sinon comme son frais fixe, sinon Commun
      var key=factKey(p), lf=null; fraisCommuns.forEach(function(f){ if(f.fact===key && !f.est) lf=f; });
      var rf=factRecFrais(p);
      var src=lf||rf; d.who=src ? ((src.personne||"").trim()||"Commun") : "Commun"; d.acct=src && src.compte ? src.compte : ""; if(src && src.split) d.split=true;
      d.opt=null;
    }
    // frais fixe récurrent qui estimait déjà cette facture (« EDF », « Électricité », « Eau »…)
    function factRecFrais(p){
      var keys=[norm(p.four||"")].concat(p.type==="elec"?["electricite","edf"]:(p.type==="eau"?["eau"]:(p.type==="gaz"?["gaz"]:(p.type==="net"?["internet","box","fibre"]:[])))).filter(function(x){ return x && x.length>=3; });
      var best=null;
      fraisCommuns.forEach(function(f){ if(!f.recurrent || f.fact || f.prov!=null) return; var n=" "+norm(f.label)+" "; if(keys.some(function(k){ return n.indexOf(" "+k+" ")>=0; }) && !best) best=f; });
      return best;
    }
    function factPayMonth(p){ var cur=monthKey(todayISO()); if(p.prelev) return p.prelev.slice(0,7); var m=(p.due||p.date||todayISO()).slice(0,7); return m<cur?cur:m; }
    // Les effets proposés (à cocher)
    function factEffects(d){
      var p=d.p, out=[], t=todayISO(), cur=t.slice(0,7), key=factKey(p), m=factPayMonth(p);
      var amt=Number(p.montant)||0; if(!(amt>0)) return out;
      // 1. le prélèvement (ou la facture à payer) dans « À venir »
      var past=p.prelev ? p.prelev<t : false, dup=fraisCommuns.some(function(f){ return !f.est && fraisActif(f, m) && Math.abs(fraisMontant(f, m)-amt)<0.01; });
      var rf=factRecFrais(p), rfOn=rf && fraisActif(rf, m), estF=fraisCommuns.filter(function(f){ return f.fact===key && f.est; })[0];
      var acc=acctByKey(d.acct)||mainAcct(), an=acc?acc.nom:"compte";
      var sub=dup?"Déjà dans tes frais fixes ce mois-là.":(past?"Prélevée le "+ddmm(p.prelev)+" : sans doute déjà dans ton compte.":"Dans « À venir » de "+an+(rfOn?", à la place de ton frais fixe « "+rf.label+" » ("+fmtK(fraisMontant(rf, m))+") ce mois-ci":"")+(estF?", à la place de l'estimation ("+fmtK(fraisMontant(estF, estF.month))+")":"")+".");
      out.push({ k:"frais", on:!dup && !past, t:p.aPayer?"À payer : "+fmtK(amt):"Prélèvement de "+fmtK(amt)+(p.prelev?" le "+ddmm(p.prelev):""), s:sub });
      // 2. la prochaine facture, estimée
      var tmp={ key:key, four:p.four, type:p.type, bills:[] }; factures.forEach(function(f){ if(factKey(f)===key && f.id!==d.id) tmp.bills.push(f); });
      factDraftOthers(d, key).forEach(function(b){ tmp.bills.push(b); });
      tmp.bills.push({ id:"_new", four:p.four, type:p.type, date:p.date||t, montant:amt, conso:p.conso, du:p.du, au:p.au, prelev:p.prelev, next:p.next, regul:p.regul });
      tmp.bills.sort(function(a,b){ return a.date<b.date?-1:1; }); tmp.last=tmp.bills[tmp.bills.length-1];
      if(tmp.last.id==="_new"){
        tmp.ryth=factRythme(tmp); tmp.next=factNextDate(tmp); tmp.offset=p.prelev&&p.date?Math.max(0, isoDays(p.date, p.prelev)):0;
        if(tmp.next && tmp.next>t){ var ev=factEstimate(tmp, tmp.next); d.nextIso=tmp.next; d.nextAmt=ev; d.nextPay=factPayIso(tmp, tmp.next);
          if(ev>0) out.push({ k:"next", on:true, t:"Prochaine facture : environ "+fctE(ev)+" "+(isoDays(t, tmp.next)<=75?"vers le "+ddmm(tmp.next):"en "+MOIS_NOMS[+tmp.next.slice(5,7)-1]), s:factEstWhy(tmp, tmp.next)+" Remplacée par le vrai montant à la prochaine facture." }); }
        d.ryth=tmp.ryth;
      }
      // 3. la provision : payer avec, ou en créer une
      var pv=provisions.filter(function(x){ return x.fact===key; })[0];
      if(pv && (!pv.startMonth || m>=pv.startMonth)){ var bal=provState(pv, m).bal; out.push({ k:"prov", on:true, t:"Payée par ta provision « "+pv.nom+" »", s:fmtK(bal)+" de côté "+(bal+0.004<amt?"· il manque "+fmtK(amt-bal):"· elle suffit")+". Retirée de la provision ; hors parts du Commun (sa mise de côté y compte déjà)." }); }
      else if(!pv){ var mon=Math.ceil(factMonthly(tmp)), ry=tmp.ryth||1;
        out.push({ k:"prov", on:ry>=3, t:"Provision « "+factProvName(tmp)+" » : "+fmtK(mon)+"/mois", s:ry>=3?"Pour payer chaque facture sans à-coup : elle la paie quand elle arrive.":"Pour lisser les factures de l'année : chaque facture est ensuite payée par la provision." }); }
      return out;
    }
    // La facture sur le relevé : le prélèvement au nom du fournisseur, montant égal ou proche, autour de la date prévue
    function factBankMatch(p){
      var amt=Number(p.montant)||0; if(!(amt>0) || !p.four) return null;
      var c=p.prelev||p.due||"", from, to;
      if(c){ from=isoAddDays(c, -5); to=isoAddDays(c, 5); } else if(p.date){ from=isoAddDays(p.date, -3); to=isoAddDays(p.date, 45); } else return null;
      return bankFind(p.four, amt, from, to, 0.3);
    }
    // Contrôles : montant inhabituel, prélèvement avant la facture, date dans le futur, HT + TVA = TTC
    function factChecks(d){
      var p=d.p, amt=Number(p.montant)||0, out={ mt:[], prel:[], date:[], ok:[] }, t=todayISO();
      if(amt>0 && !p.regul){ var key=factKey(p), H=[];
        factures.forEach(function(f){ if(factKey(f)===key && !f.regul && f.montant>0) H.push(f); }); factDraftOthers(d, key).forEach(function(b){ if(!b.regul) H.push(b); });
        H.sort(function(a,b){ return a.date<b.date?-1:1; }); H=H.slice(-6).map(function(b){ return b.montant; }).sort(function(a,b){ return a-b; });
        if(H.length>=2){ var med=H[Math.floor(H.length/2)];
          if(amt>med*3) out.mt.push(Math.round(amt/med)+" fois plus que d'habitude chez ce fournisseur ("+fmtK(med)+")");
          else if(amt<med/3) out.mt.push(Math.round(med/amt)+" fois moins que d'habitude chez ce fournisseur ("+fmtK(med)+")"); } }
      if(p.prelev && p.date && !p.aPayer && p.prelev<isoAddDays(p.date, -3)) out.prel.push("Avant la date de la facture ("+ddmm(p.date)+")");
      if(p.date && p.date>isoAddDays(t, 31)) out.date.push("Date dans le futur");
      if(amt>0){ var L=factLines(d.pages.join("\n")), HT={}, TV={};
        L.forEach(function(l){ var n=factWords(l); if(/ ttc /.test(n)) return; var A=factAmtsIdx(l).filter(function(a){ return !/^\s*%/.test(l.slice(a.e, a.e+3)); }); if(!A.length) return;
          var v=A[A.length-1].v; if(/ tva /.test(n)) TV[v.toFixed(2)]=1; else if(/ ht | hors taxe/.test(n) && / total | montant /.test(n)) HT[v.toFixed(2)]=1; });
        var hk=Object.keys(HT), tk=Object.keys(TV);
        if(hk.length===1 && tk.length===1){ var h=+hk[0], tv=+tk[0];
          if(Math.abs(h+tv-amt)<0.02) out.ok.push("HT "+fmtK(h)+" + TVA "+fmtK(tv)+" = "+fmtK(amt));
          else if(Math.abs(amt-h)<0.006) out.mt.push("C'est le montant hors taxes : TTC "+fmtK(Math.round((h+tv)*100)/100)); } }
      return out;
    }
    function factChkHTML(list, cls){ return list.map(function(m){ return '<div class="fct-chk'+(cls?' '+cls:'')+'">'+(cls==="ok"?"✓ ":"⚠ ")+esc(m)+'</div>'; }).join(""); }
    function renderFactLue(){
      if(!canUse("factures")){ state.view="factures"; state.avnSub="fact"; return renderFactures(); }
      var d=state.factDraft, ro=fyRO();
      if(!d){ state.view="factures"; return renderFactures(); }
      var h=header(true, d.multi && d.multi.others.length && !d.busy ? "Factures lues" : "Facture");
      if(d.busy){ h+='<section class="paper"><div class="scanbox"><span id="fctmsg">'+esc(d.msg||"Lecture…")+'</span><div class="progress"><i style="width:60%"></i></div></div></section>'; app.innerHTML=h; setNav("factures", true); bindBack(function(){ state.factDraft=null; state.view="factures"; render(); }); return; }
      var p=d.p, ty=factType(p.type), sameS=factSeries().filter(function(s){ return s.key===factKey(p); })[0];
      if(!d.opt){ d.opt={}; factEffects(d).forEach(function(o){ d.opt[o.k]=o.on; }); }
      var eff=factEffects(d), dup=factDup(p);
      if(d.multi) h+=factMultiHTML(d);
      h+='<section class="paper fct-form">';
      if(dup) h+='<div class="ech warn" style="margin:0 0 10px">Cette facture est déjà dans tes factures.</div>';
      h+='<div class="center" style="font-size:11px;color:var(--accent);margin-bottom:8px">'+(d.src==="pdf"?"Lu dans le PDF":"Lu sur le téléphone")+' · '+d.n+' page'+(d.n>1?'s':'')+' · vérifie les montants · <button type="button" class="ocr-raw" id="fctRaw">Copier la lecture</button></div>';
      var fNew=!factKnown(d.four0), CK=factChecks(d), fEmpty=function(v, warn){ return (fNew && !v) || warn ? ' style="border-color:#e6b450"' : ''; };
      var bk=d.bankOff ? null : factBankMatch(p);
      if(bk && bk.exact && !p.aPayer && !d.edited.prelev && p.prelev!==bk.x.d){ p.prelev=bk.x.d; }   // le relevé donne le vrai jour du prélèvement
      if(bk && bk.exact) h+='<div class="fct-hint ok">🏦 Retrouvée sur ton relevé : <b>'+esc(bk.x.n)+' −'+esc(fmtK(bk.v))+' le '+esc(ddmm(bk.x.d))+'</b>. '+(p.aPayer?'Montant confirmé.':'Montant et prélèvement confirmés.')+'</div>';
      else if(bk) h+='<div class="fct-hint">🏦 Sur ton relevé : <b>−'+esc(fmtK(bk.v))+' le '+esc(ddmm(bk.x.d))+'</b> ('+esc(bk.x.n)+'), la facture dit '+esc(fmtK(Number(p.montant)))+'.<div class="fct-hb"><button type="button" class="btn" id="fbTake">Prendre le relevé</button><button type="button" class="btn ghost" id="fbKeep">Garder la facture</button></div></div>';
      if(p.learnt && !d.edited.montant && !d.edited.date) h+='<div class="fct-hint ok">✓ Lue comme les précédentes factures de ce fournisseur.</div>';
      else if(fNew) h+='<div class="fct-hint">1<sup>re</sup> facture de ce fournisseur : vérifie la date et le montant. L\'appli retiendra où les lire pour les suivantes.</div>';
      if(d.src==="photo") h+='<button type="button" class="btn ghost" id="fctPage" style="margin-bottom:10px">📷 + Page suivante</button>';
      h+='<label class="f" for="fp-four">Fournisseur</label><input class="f" id="fp-four" value="'+esc(p.four||"")+'">';
      h+='<label class="f">Type</label><div class="chips" id="fp-type">'+FACT_TYPES.map(function(t){ return '<button type="button" class="chip'+(p.type===t.v?' on':'')+'" data-v="'+t.v+'">'+esc(t.l)+'</button>'; }).join("")+'</div>';
      h+='<label class="f" for="fp-mt">Montant (€)</label><input class="f" id="fp-mt" inputmode="decimal"'+fEmpty(Number(p.montant)>0, CK.mt.length)+' value="'+esc(p.montant!=null?Number(p.montant).toFixed(2).replace(".",","):"")+'" placeholder="0,00">'+factChkHTML(CK.mt)+factChkHTML(CK.ok, "ok");
      h+='<label class="f" for="fp-date">Date de la facture</label><input class="f" id="fp-date" type="date"'+fEmpty(p.date, CK.date.length)+' value="'+esc(p.date||"")+'">'+factChkHTML(CK.date);
      h+='<label class="f">Paiement</label><div class="chips" id="fp-pay"><button type="button" class="chip'+(!p.aPayer?' on':'')+'" data-v="prel">Prélèvement</button><button type="button" class="chip'+(p.aPayer?' on':'')+'" data-v="apayer">À payer moi-même</button></div>';
      h+=p.aPayer ? '<label class="f" for="fp-due">À payer avant le (facultatif)</label><input class="f" id="fp-due" type="date" value="'+esc(p.due||"")+'">'
                  : '<label class="f" for="fp-prel">Prélevé le</label><input class="f" id="fp-prel" type="date"'+(CK.prel.length?' style="border-color:#e6b450"':'')+' value="'+esc(p.prelev||"")+'">'+factChkHTML(CK.prel);
      if(ty.u) h+='<label class="f" for="fp-conso">Consommation ('+ty.u+')</label><input class="f" id="fp-conso" inputmode="decimal" value="'+esc(p.conso!=null?String(p.conso):"")+'">';
      h+='<label class="f" for="fp-next">Prochaine facture (facultatif)</label><input class="f" id="fp-next" type="date" value="'+esc(p.next||"")+'">';
      // comparaison avec l'an dernier
      var cmpB=(sameS?sameS.bills:[]).concat(factDraftOthers(d, factKey(p)));
      if(cmpB.length && p.date){ var b0=null; cmpB.forEach(function(b){ if(!b.regul && Math.abs(isoDays(b.date, isoAddDays(p.date, -365)))<=45) b0=b; });
        if(b0){ var ev=(b0.conso && p.conso) ? Math.round((p.conso/b0.conso-1)*100) : null;
          h+='<div class="fct-cmp"><b>Par rapport à l\'an dernier</b><br>Même période : '+esc(fmtK(b0.montant))+(b0.conso&&ty.u?' pour '+b0.conso+' '+ty.u:'')+'.'+(ev!=null?' Ta consommation a '+(ev<0?'baissé':'augmenté')+' de '+Math.abs(ev)+' %.':'')+'</div>'; } }
      h+='</section>';
      if(!ro){
        h+='<div class="bsec-h">Ce que ça change dans tes comptes</div><section class="paper" style="margin-top:10px;padding:6px 12px 12px">';
        eff.forEach(function(o){ h+='<label class="fct-eff"><input type="checkbox" data-k="'+o.k+'"'+(d.opt[o.k]?' checked':'')+'><span><b>'+esc(o.t)+'</b><small>'+esc(o.s)+'</small></span></label>'; });
        var ppl=uniquePersons(), whoL=['Commun'].concat(ppl);
        h+='<label class="f" style="margin-top:12px">Pour</label><div class="chips" id="fp-who">'+whoL.map(function(w){ return '<button type="button" class="chip'+(d.who===w?' on':'')+'" data-v="'+esc(w)+'">'+esc(w)+'</button>'; }).join("")+'</div>';
        if(comptes.length>1) h+='<label class="f">Compte</label><div class="chips" id="fp-acct"><button type="button" class="chip'+(!d.acct?' on':'')+'" data-v="">Auto</button>'+comptes.filter(function(a){ return a.key!=="__tickets"; }).map(function(a){ return '<button type="button" class="chip'+(d.acct===a.key?' on':'')+'" data-v="'+esc(a.key)+'">'+esc(a.nom)+'</button>'; }).join("")+'</div>';
        var nK=1+(d.multi ? d.multi.others.filter(function(o){ return o.keep; }).length : 0);
        h+='</section><div class="ui-stack"><button type="button" class="btn primary" id="fctApply">Appliquer'+(nK>1?' · '+nK+' factures':'')+'</button><button type="button" class="btn ghost" id="fctOnly">Garder seulement '+(nK>1?'les factures':'la facture')+'</button></div>';
      }
      app.innerHTML=h; setNav("factures", true);
      bindBack(function(){ state.factDraft=null; state.view="factures"; render(); window.scrollTo(0,0); });
      function rd(){
        var g=function(id){ var e=document.getElementById(id); return e ? e.value : null; };
        var nf=g("fp-four"); if(nf!==null && nf.trim()!==(p.four||"")){ p.four=nf.trim(); d.edited.four=1; }
        var mt=g("fp-mt"); if(mt!==null){ var v=num(mt); if(v!==(Number(p.montant)||0)){ p.montant=v||null; d.edited.montant=1; } }
        ["date","prel","due","next"].forEach(function(k){ var v=g("fp-"+k); if(v===null) return; var pk=(k==="prel"?"prelev":k); if(v!==(p[pk]||"")){ p[pk]=v; d.edited[pk]=1; } });
        var c=g("fp-conso"); if(c!==null){ var cv=c.trim()===""?null:num(c); if(cv!==p.conso){ p.conso=cv; d.edited.conso=1; } }
        if(d.edited.montant || d.edited.date){ var nf=factFillOthers(d); if(nf) setTimeout(function(){ uiToast(nf+" plus ancienne"+(nf>1?"s":"")+" complétée"+(nf>1?"s":"")+" avec ta correction"); }, 0); }
      }
      [].forEach.call(document.querySelectorAll(".fct-form input"), function(e){ e.addEventListener("change", function(){ rd(); render(); }); });
      [].forEach.call(document.querySelectorAll("#fp-type .chip"), function(b){ b.onclick=function(){ rd(); p.type=b.getAttribute("data-v"); d.edited.type=1; render(); }; });
      [].forEach.call(document.querySelectorAll("#fp-pay .chip"), function(b){ b.onclick=function(){ rd(); p.aPayer=b.getAttribute("data-v")==="apayer"; d.edited.aPayer=1; render(); }; });
      [].forEach.call(document.querySelectorAll("#fp-who .chip"), function(b){ b.onclick=function(){ rd(); d.who=b.getAttribute("data-v"); render(); }; });
      [].forEach.call(document.querySelectorAll("#fp-acct .chip"), function(b){ b.onclick=function(){ rd(); d.acct=b.getAttribute("data-v"); render(); }; });
      [].forEach.call(document.querySelectorAll(".fct-eff input"), function(c){ c.onchange=function(){ d.opt[c.getAttribute("data-k")]=c.checked; }; });
      var rw=document.getElementById("fctRaw"); if(rw) rw.onclick=function(){ state.ocrRaw={ eng:(d.src==="pdf"?"PDF":"photos"), diag:"facture", parts:d.raws&&d.raws.length?d.raws:d.pages.map(function(t){ return { t:t, res:null }; }) }; ocrRawSheet(); };
      var pg=document.getElementById("fctPage"); if(pg) pg.onclick=function(){ rd(); factInputs(); factImgIn._add=true; factImgIn.click(); };
      var ap=document.getElementById("fctApply"); if(ap) ap.onclick=function(){ rd(); factApply(d, true); };
      var fbt=document.getElementById("fbTake"); if(fbt) fbt.onclick=function(){ rd(); p.montant=bk.v; d.edited.montant=1; if(!p.aPayer){ p.prelev=bk.x.d; d.edited.prelev=1; } d.opt=null; render(); };
      var fbk=document.getElementById("fbKeep"); if(fbk) fbk.onclick=function(){ rd(); d.bankOff=true; render(); };
      if(d.multi){
        [].forEach.call(document.querySelectorAll(".fbill[data-i]"), function(r){ r.onclick=function(ev){ if(ev.target && ev.target.tagName==="INPUT") return; rd(); factOldSheet(d, +r.getAttribute("data-i")); }; });
        [].forEach.call(document.querySelectorAll(".fbill input[data-i]"), function(c){ c.onchange=function(){ rd(); d.multi.others[+c.getAttribute("data-i")].keep=c.checked; render(); }; });
        [].forEach.call(document.querySelectorAll("[data-retake]"), function(b){ b.onclick=function(){ rd(); factRetake(+b.getAttribute("data-retake")); }; });
        var bo=document.getElementById("fbadOff"); if(bo) bo.onclick=function(){ rd(); d.multi.badOff=true; render(); };
      }
      var on=document.getElementById("fctOnly"); if(on) on.onclick=function(){ rd(); factApply(d, false); };
    }
    function factMultiHTML(d){
      var M=d.multi, pdf=M.kind==="pdf", K=M.others.length+1, okAll=!M.bad.length || M.badOff, h='';
      var unit=pdf ? "PDF" : "photo"+(M.total>1?"s":""), lu=pdf ? (M.read>1?"lus":"lu") : (M.read>1?"lues":"lue");
      h+='<section class="paper fsumc'+(okAll?'':' wn')+'"><div class="fsum"><span class="ic">'+(M.bad.length?'!':'✓')+'</span><div><b>'+M.total+' '+unit+' · '+M.read+' '+lu+'</b><small>'+K+' facture'+(K>1?'s':'')+' trouvée'+(K>1?'s':'')+'</small></div></div>';
      if(M.bad.length && !M.badOff){
        M.bad.forEach(function(k){ h+='<div class="fbad"><span class="t"><b>'+(pdf?'PDF ':'Photo ')+k+' illisible</b><br><small>'+(pdf?'pas de texte : prends ses pages en photo':'floue, trop sombre ou coupée')+'</small></span>'+(pdf?'':'<button type="button" class="btn ghost" data-retake="'+k+'">📷 Reprendre</button>')+'</div>'; });
        h+='<div style="text-align:right;margin-top:8px"><button type="button" class="ocr-raw" id="fbadOff">Ignorer</button></div>';
      }
      h+='</section>';
      if(!M.others.length) return h;
      var p=d.p, ty=factType(p.type);
      function sub(q, pages){ var t=factType(q.type); return factPhotosTxt(pages, M.kind)+(q.conso>0&&t.u?' · '+q.conso+' '+t.u:'')+(q.aPayer?' · à payer à réception':''); }
      h+='<section class="paper fbills">';
      M.others.forEach(function(o, i){ var q=o.p;
        h+='<div class="fbill'+(o.keep?'':' off')+'" data-i="'+i+'"><input type="checkbox" data-i="'+i+'"'+(o.keep?' checked':'')+' aria-label="Garder cette facture"><div class="bt"><b>'+(q.date?esc(ddmmyy(q.date)):'Date ?')+'</b>'+(o.check?' <span class="fpill wn">À VÉRIFIER</span>':'')+'<small>'+esc(sub(q, o.pages))+'</small></div><span class="am">'+(q.montant>0?esc(fmtK(q.montant)):'—')+'</span><span class="ch">›</span></div>'; });
      h+='<div class="fbill cur"><div class="bt"><b>'+(p.date?esc(ddmmyy(p.date)):'Date ?')+'</b> <span class="fpill">LA PLUS RÉCENTE</span><small>'+esc(sub(p, M.pages))+' · vérifiée ci-dessous</small></div><span class="am">'+(Number(p.montant)>0?esc(fmtK(Number(p.montant))):'—')+'</span></div>';
      h+='</section>';
      var nk=M.others.filter(function(o){ return o.keep; }).length;
      h+='<div class="fnote">'+(nk>1?'Les '+nk+' plus anciennes iront':(nk?'La plus ancienne ira':'Aucune plus ancienne n\'ira'))+' dans l\'historique. Touche une facture pour la vérifier ou la corriger ; décoche-la pour ne pas la garder. Rien n\'est enregistré avant « Appliquer ».</div>';
      h+='<div class="bsec-h">La plus récente'+(p.date?' · '+esc(ddmmyy(p.date)):'')+'</div><div style="height:10px"></div>';
      return h;
    }
    // Contrôle d'une facture plus ancienne : ses champs, « Copier la lecture », Précédente / Suivante
    function factOldSheet(d, i){
      var M=d.multi, o=M && M.others[i]; if(!o) return;
      var p=o.p, ty=factType(p.type), K=M.others.length+1, pdf=M.kind==="pdf";
      var h='<div class="fold"><div class="fo-h"><b>Facture'+(p.date?' du '+esc(ddmmyy(p.date)):'')+'</b><span class="fpill">'+(i+1)+' sur '+K+'</span></div>';
      h+='<div style="font-size:12.5px;color:var(--ink-soft);margin:4px 0 2px">'+esc(capFirst(factPhotosTxt(o.pages, M.kind)))+' · '+(pdf?'lu dans le PDF':'lue sur le téléphone')+' · <button type="button" class="ocr-raw" id="foRaw">Copier la lecture</button></div>';
      h+='<label class="f" for="fo-four">Fournisseur</label><input class="f" id="fo-four" value="'+esc(p.four||"")+'">';
      h+='<div class="row2"><div><label class="f" for="fo-mt">Montant (€)</label><input class="f" id="fo-mt" inputmode="decimal" value="'+esc(p.montant!=null?Number(p.montant).toFixed(2).replace(".",","):"")+'" placeholder="0,00"></div><div><label class="f" for="fo-date">Date</label><input class="f" id="fo-date" type="date" value="'+esc(p.date||"")+'"></div></div>';
      if(ty.u) h+='<label class="f" for="fo-conso">Consommation ('+ty.u+')</label><input class="f" id="fo-conso" inputmode="decimal" value="'+esc(p.conso!=null?String(p.conso):"")+'">';
      h+='<label class="f">Paiement</label><div class="chips" id="fo-pay"><button type="button" class="chip'+(!p.aPayer?' on':'')+'" data-v="prel">Prélèvement</button><button type="button" class="chip'+(p.aPayer?' on':'')+'" data-v="apayer">À payer moi-même</button></div>';
      h+='<div class="row2"><div><label class="f" for="fo-du">Consommé du</label><input class="f" id="fo-du" type="date" value="'+esc(p.du||"")+'"></div><div><label class="f" for="fo-au">au</label><input class="f" id="fo-au" type="date" value="'+esc(p.au||"")+'"></div></div>';
      h+='<div class="ui-err" style="display:none"></div><div class="fnote" style="margin:10px 2px">Va dans l\'historique : elle sert aux moyennes et à l\'estimation, sans rien changer à tes comptes.</div>';
      h+='<div class="ui-actions"><button type="button" class="btn ghost" id="foNo">Ne pas la garder</button><button type="button" class="btn primary" id="foOk">OK</button></div>';
      h+='<div class="fold-nav"><button type="button" id="foPrev"'+(i>0?'':' style="visibility:hidden"')+'>‹ Précédente</button><button type="button" id="foNext">Suivante ›</button></div></div>';
      var s=uiSheet(h), gone=false;
      function rd(){ var g=function(id){ var e=s.q("#"+id); return e ? e.value : null; }, v;
        v=g("fo-four"); if(v!==null) p.four=v.trim();
        v=g("fo-mt"); if(v!==null){ var a=num(v); p.montant=a>0 ? a : null; }
        ["date","du","au"].forEach(function(k){ var x=g("fo-"+k); if(x!==null) p[k]=x; });
        v=g("fo-conso"); if(v!==null) p.conso=v.trim()==="" ? null : num(v); }
      function err(m){ var e=s.q(".ui-err"); e.textContent=m||""; e.style.display=m?"":"none"; }
      function end(){ gone=true; s.close(); render(); }
      [].forEach.call(s.qa("#fo-pay .chip"), function(b){ b.onclick=function(){ [].forEach.call(s.qa("#fo-pay .chip"), function(x){ x.className="chip"; }); b.className="chip on"; p.aPayer=b.getAttribute("data-v")==="apayer"; }; });
      s.q("#foRaw").onclick=function(){ state.ocrRaw={ eng:(pdf?"PDF":"photos"), diag:"facture", parts:o.rw && o.rw.length ? o.rw : o.tx.map(function(t){ return { t:t, res:null }; }) }; ocrRawSheet(); };
      s.q("#foNo").onclick=function(){ rd(); o.keep=false; end(); };
      s.q("#foOk").onclick=function(){ rd(); if(!p.date){ err("Indique la date de la facture"); return; } if(!(p.montant>0)){ err("Indique le montant de la facture"); return; } o.keep=true; o.check=false; end(); };
      s.q("#foPrev").onclick=function(){ rd(); end(); factOldSheet(d, i-1); };
      s.q("#foNext").onclick=function(){ rd(); end(); if(i+1<M.others.length) factOldSheet(d, i+1); else { var f=document.querySelector(".fct-form"); if(f && f.scrollIntoView) f.scrollIntoView({ block:"start" }); } };
      s.dismiss(function(){ if(gone) return; rd(); render(); });
    }
    function factApply(d, withEff){
      var p=d.p, amt=Number(p.montant)||0;
      if(!(amt>0)){ uiToast("Indique le montant de la facture"); var e=document.getElementById("fp-mt"); if(e) e.focus(); return; }
      if(!p.date){ uiToast("Indique la date de la facture"); return; }
      // plusieurs factures : les plus anciennes gardées vont dans l'historique (date et montant obligatoires)
      var hist=null;
      if(d.multi){ var kept=d.multi.others.filter(function(o){ return o.keep; });
        for(var ki=0;ki<kept.length;ki++){ var ko=kept[ki]; if(!ko.p.date || !(ko.p.montant>0)){ uiToast("Vérifie la facture "+(ko.p.date?"du "+ddmmyy(ko.p.date):"des "+factPhotosTxt(ko.pages, d.multi.kind))+" : date et montant"); factOldSheet(d, d.multi.others.indexOf(ko)); return; } }
        hist=factToHistory(kept.map(function(o){ return { p:o.p }; }), d.multi.kind==="pdf" ? "pdf" : "photo"); }
      var histTxt=hist && hist.n ? " + "+hist.n+" plus ancienne"+(hist.n>1?"s":"")+" dans l'historique" : "";
      if(factDup(p)){ uiToast("Cette facture est déjà dans tes factures"+histTxt); state.factDraft=null; state.factKey=factKey(p); state.view="factserie"; render(); return; }
      // corrections de la date ou du montant : retenues pour ce fournisseur (lu sous son nom d'origine)
      var first=!factKnown(d.four0), learnt=factLearn(d.four0, d.pages.join("\n"), (d.edited.montant || first) ? amt : 0, (d.edited.date || first) ? p.date : "");
      if(d.multi) d.multi.others.forEach(function(o){ if(!o.keep || !o.orig) return; var q=o.p;
        if(factLearn(o.four0, o.tx.join("\n"), Math.abs((q.montant||0)-(o.orig.montant||0))>0.004 ? q.montant : 0, q.date!==o.orig.date ? q.date : "")) learnt=true; });
      if(!p.four) p.four=factType(p.type).l;
      if(d.edited.four && d.raw0 && norm(d.raw0)!==norm(p.four)){ var al=store.read("factAlias", {})||{}; al[norm(d.raw0)]=p.four; store.write("factAlias", al); }
      var key=factKey(p), id=Date.now()+(hist ? hist.n+10 : 0), m=factPayMonth(p), o=withEff ? (d.opt||{}) : {}, made=[];
      var f={ id:id, four:p.four, type:p.type, date:p.date, montant:amt, src:d.src };
      ["prelev","due","du","au","next"].forEach(function(k){ if(p[k]) f[k]=p[k]; }); if(p.aPayer){ f.aPayer=true; delete f.prelev; }
      if(p.conso>0) f.conso=p.conso; if(p.regul) f.regul=true;
      var acct=d.acct && acctByKey(d.acct) ? d.acct : "";
      function mkFrais(lbl, v, mo, jour, extra){ var x={ id:Date.now()+Math.floor(Math.random()*1000), label:lbl, montant:Math.round(v*100)/100, personne:d.who||"Commun", recurrent:false, month:mo, fact:key, factNom:p.four };
        if(jour) x.jour=jour; if(x.personne==="Commun" && d.split) x.split=true; else if(acct) x.compte=acct; for(var k in (extra||{})) x[k]=extra[k]; return x; }
      var pvPay=null; if(o.prov){ pvPay=provisions.filter(function(x){ return x.fact===key; })[0]||null; if(pvPay && pvPay.startMonth && m<pvPay.startMonth) pvPay=null; }
      if(o.frais){
        // l'estimation de cette facture disparaît : le vrai montant la remplace
        fraisCommuns=fraisCommuns.filter(function(x){ return !(x.fact===key && x.est); });
        var jour=p.prelev ? +p.prelev.slice(8,10) : (p.due && p.due.slice(0,7)===m ? +p.due.slice(8,10) : 0), fex={};
        if(p.aPayer) fex.aPayer=true; if(pvPay) fex.pp=pvPay.id;   // payée par la provision : hors parts du Commun
        var fr=mkFrais(p.four+(p.aPayer?" · à payer":" · facture du "+ddmm(p.date)), amt, m, jour, fex);
        fraisCommuns.push(fr); f.fraisId=fr.id; made.push("le prélèvement");
        var rf=factRecFrais(p); if(!pvPay && rf && fraisActif(rf, m)){ if(!rf.skipMonths) rf.skipMonths={}; rf.skipMonths[m]=true; }
      }
      if(o.next && d.nextIso && d.nextAmt>0){
        fraisCommuns=fraisCommuns.filter(function(x){ return !(x.fact===key && x.est); });
        var np=d.nextPay||d.nextIso, nm=np.slice(0,7);
        fraisCommuns.push(mkFrais(p.four+" · prochaine facture (estimée)", d.nextAmt, nm, p.aPayer?0:+np.slice(8,10), { est:true })); made.push("la prochaine facture");
      }
      if(o.prov){
        var pv=provisions.filter(function(x){ return x.fact===key; })[0];
        if(pv && pv.startMonth && m<pv.startMonth) pv=null;
        else if(!pv){ var tmp={ key:key, four:p.four, type:p.type, bills:factures.filter(function(x){ return factKey(x)===key; }).concat([f]), ryth:d.ryth||1 }; tmp.bills.sort(function(a,b){ return a.date<b.date?-1:1; }); tmp.last=tmp.bills[tmp.bills.length-1];
          pv={ id:id+1, nom:factProvName(tmp), mensuel:Math.ceil(factMonthly(tmp)), soldeInitial:0, startMonth:monthKey(todayISO()), prelevements:[], fact:key }; provisions.push(pv); made.push("la provision");
          if(d.who && d.who!=="Commun" && d.who!==mePerson()) pv.owner=d.who; }
        else if(pv){ if(!pv.prelevements) pv.prelevements=[]; var pr={ id:id+2, month:m, montant:amt, label:"Facture du "+ddmm(p.date) }; pv.prelevements.push(pr); f.prId=pr.id; made.push("le paiement par la provision"); }
        persistProvisions();
      }
      factures.push(f); persistFactures(); persistFrais();
      state.factDraft=null; state.factKey=key; state.view="factserie"; render(); window.scrollTo(0,0);
      uiToast("Facture ajoutée"+histTxt+(made.length?" · "+made.join(", "):"")+(learnt?" · lecture retenue pour "+p.four:""));
    }
    function backupDump(){
      var keys=["entries","cats","catParent","taxoV3","taxoV4","familles","produits","familleDe","appris","fraisCommuns","argentMois","liquideMois","budgets","bourseHist","virements","virRec","soldeInit","provisions","factures","factAlias","factAppris","releve","tkAppris","tkMag","photoKeep","commRemb","groupes","epargne","bourse","ocrKey","offlineReady","taxoV2","simThreshold","virEpV2","comptes","devise","personnes","cptChartDef","comChartDef","anChartDef","artChartDef","bView","bChartMode","cptRange","adRange","compteSel","communParts","homeScope","budgetsP","commBalFrom","comProd","cptLiq","anFrais"];
      var dump={ _app:"tickets", _version:1, _date:new Date().toISOString(), data:{} };
      keys.forEach(function(k){ var v=store.read(k, null); if(v!==null) dump.data[k]=v; });
      var bk=(fyCfg && fyCfg.role==="owner") ? store.read("fyBk", null) : null; if(bk) dump.data.fyBk=bk;   // le foyer, chiffré avec le code de secours
      return dump;
    }
