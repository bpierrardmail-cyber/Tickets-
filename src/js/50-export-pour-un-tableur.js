    // ---------- Export pour un tableur (CSV : point-virgule, virgule décimale, UTF-8 avec BOM pour Excel) ----------
    function csvCell(v){ if(v===null || v===undefined) return ""; if(typeof v==="number") return String(Math.round(v*100)/100).replace(".", ",");
      v=String(v); return /[";\n\r]/.test(v) ? '"'+v.replace(/"/g, '""')+'"' : v; }
    function csvText(head, rows){ return "\uFEFF"+[head].concat(rows).map(function(r){ return r.map(csvCell).join(";"); }).join("\r\n")+"\r\n"; }
    function csvDate(d){ d=String(d||""); return /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(8,10)+"/"+d.slice(5,7)+"/"+d.slice(0,4) : d; }
    function csvMonths(per){   // mois de la période : ce mois, l'année en cours, ou tout depuis le 1er ticket / virement
      var cur=monthKey(todayISO()), out=[], m;
      if(per==="m") return [cur];
      if(per==="y"){ for(m=cur.slice(0,4)+"-01"; m<=cur; m=nextMonthKey(m)) out.push(m); return out; }
      var first=cur; state.entries.forEach(function(e){ var k=e.date && monthKey(e.date); if(k && k<first) first=k; }); virements.forEach(function(v){ if(v.month && v.month<first) first=v.month; });
      for(m=first; m<=cur && out.length<240; m=nextMonthKey(m)) out.push(m); return out;
    }
    function csvBuild(per, what){
      var ms=csvMonths(per), inM={}, files=[], acc=function(k){ var a=acctByKey(k); return a ? a.nom : ""; };
      ms.forEach(function(m){ inM[m]=1; });
      var E=state.entries.filter(function(e){ return e.date && inM[monthKey(e.date)]; }).sort(function(a,b){ return String(a.date).localeCompare(String(b.date)); });
      if(what.tickets) files.push({ n:"tickets.csv", t:csvText(["Date","Magasin","Montant","Catégorie","Payé par","Compte","Articles","Partagé avec"],
        E.map(function(e){ var ca=e.pay==="esp" ? (e.liq ? "Espèces · liquide de "+acc(e.liq.k) : "Espèces · hors liquide") : e.compte ? acc(e.compte) : (comptes.filter(function(a){ return ticketInAcct(e, a.key); })[0]||{}).nom||"";
          return [csvDate(e.date), e.marchand||"", Number(e.montant)||0, e.categorie||"", payerOf(e), ca, (e.articles||[]).length, e.share ? Object.keys(e.share).join(", ") : ""]; })) });
      if(what.articles){ var R=[]; E.forEach(function(e){ (e.articles||[]).forEach(function(a){ R.push([csvDate(e.date), e.marchand||"", a.label||"", a.produit||"", Number(a.prix)||0, a.commun?"oui":""]); }); });
        files.push({ n:"articles.csv", t:csvText(["Date","Magasin","Lu sur le ticket","Article","Prix","Partagé"], R) }); }
      if(what.ops){ var O=[]; comptes.filter(function(a){ return a.key!=="__tickets"; }).forEach(function(a){ ms.forEach(function(m){ var X=cptOps(a.key, m);
          X.done.concat(X.todo).forEach(function(o){ var dd=o.d ? m+"-"+(o.d<10?"0":"")+o.d : m+"-01";
            O.push([csvDate(dd), a.nom, o.n||"", o.k==="t"?"Ticket":(o.k==="f"?"Frais fixe":"Virement"), o.s||"", o.a, X.done.indexOf(o)>=0?"oui":"non"]); }); }); });
        O.sort(function(x,y){ return x[0].split("/").reverse().join("").localeCompare(y[0].split("/").reverse().join("")); });
        files.push({ n:"operations.csv", t:csvText(["Date","Compte","Libellé","Type","Détail","Montant","Fait"], O) }); }
      if(what.frais){
        files.push({ n:"frais-fixes.csv", t:csvText(["Libellé","Pour qui","Montant","Chaque mois","Début","Fin","Compte","Chacun sa part"],
          fraisCommuns.map(function(f){ return [f.label||"", (f.personne||"").trim()||"Commun", fraisMontant(f, monthKey(todayISO())), f.recurrent?"oui":"non", f.recurrent?(f.startMonth||fraisStart(f)||""):(f.month||""), f.endMonth||"", f.compte?acc(f.compte):"", f.split?"oui":""]; })) });
        files.push({ n:"provisions.csv", t:csvText(["Provision","Par mois","Solde","Prévu"],
          provisions.map(function(p){ var b=0; try{ b=provBalance(p, monthKey(todayISO())); }catch(e){} return [p.nom||"", mensuelAt(p, monthKey(todayISO())), b, Number(p.prevu)||0]; })) });
      }
      return files;
    }
    function csvExport(){
      var per="y", what={ tickets:true, articles:true, ops:true, frais:false };
      var s=uiSheet('<div class="sheet-title">Exporter pour un tableur</div><div class="ui-intro">Des fichiers CSV qui s\'ouvrent dans Excel, LibreOffice ou Google Sheets.</div>'+
        '<label class="f">Période</label><div class="seg2" id="csvPer"><button type="button" data-p="m">Ce mois</button><button type="button" data-p="y">Cette année</button><button type="button" data-p="all">Tout</button></div>'+
        '<label class="f">Contenu</label><div id="csvWhat">'+[["tickets","Tickets"],["articles","Articles des tickets"],["ops","Opérations des comptes"],["frais","Frais fixes et provisions"]].map(function(x){
          return '<label class="csv-ck"><input type="checkbox" data-w="'+x[0]+'"'+(what[x[0]]?' checked':'')+'><span>'+x[1]+'</span></label>'; }).join("")+'</div>'+
        '<div class="ui-err" style="display:none"></div><div class="ui-stack"><button type="button" class="btn primary" id="csvGo">Exporter</button><button type="button" class="btn ghost ui-no">Annuler</button></div>');
      function paint(){ [].forEach.call(s.qa("#csvPer button"), function(b){ b.classList.toggle("on", b.getAttribute("data-p")===per); }); }
      [].forEach.call(s.qa("#csvPer button"), function(b){ b.onclick=function(){ per=b.getAttribute("data-p"); paint(); }; });
      s.q(".ui-no").onclick=s.close;
      s.q("#csvGo").onclick=function(){
        [].forEach.call(s.qa("#csvWhat input"), function(c){ what[c.getAttribute("data-w")]=c.checked; });
        if(!what.tickets && !what.articles && !what.ops && !what.frais){ var er=s.q(".ui-err"); er.textContent="Coche au moins un contenu."; er.style.display=""; return; }
        var F=csvBuild(per, what), tag=per==="m" ? monthKey(todayISO()) : (per==="y" ? todayISO().slice(0,4) : "tout"); s.close();
        if(F.length===1){ saveFile(new Blob([F[0].t], { type:"text/csv" }), F[0].n.replace(".csv", "")+"-"+tag+".csv", { what:"Export" }); return; }
        zipBuild(F.map(function(f){ return { n:f.n, b:new Blob([f.t], { type:"text/csv" }) }; }), null).then(function(z){ saveFile(z, "tickets-export-"+tag+".zip", { what:"Export" }); })
          .catch(function(e){ window.alert("Export impossible : "+((e&&e.message)||e)); });
      };
      paint();
    }
    function exportChoose(){
      uiChoice("Exporter", esc("Un bilan à imprimer, ou tes données pour un tableur."), [
        { l:"PDF · bilan imprimable", fn:choosePdfPeriod },
        { l:"Tableur · fichiers CSV", primary:false, fn:csvExport } ]);
    }
    function restoreZip(file){
      var pr=uiProgress("Lecture de la sauvegarde…");
      zipRead(file).then(function(Z){
        var d=Z["data.json"]; if(!d || d.m!==0) throw new Error("data.json absent");
        return blobText(file.slice(d.o, d.o+d.s)).then(function(txt){ pr.close(); return encOpen(JSON.parse(txt)); }).then(function(X){
          var obj=X.obj, ek=X.key;
          restoreApply(obj, function(){
            var by={}, ids;
            (obj._zip||[]).forEach(function(x){ var z=Z[x.p]; if(!z || z.m!==0) return; var P=by[x.id]||(by[x.id]={ o:!!x.o, b:[] }); P.b[x.n-1]=file.slice(z.o, z.o+z.s, x.t||"image/jpeg"); });
            ids=Object.keys(by); var i=0, pg=uiProgress("Photos remises 0 / "+ids.length);
            function nx(){ if(i>=ids.length){ pg.close(); return Promise.resolve(); }
              var id=ids[i++], P=by[id], b=P.b.filter(function(x){ return x; }); pg.set("Photos remises "+i+" / "+ids.length); if(!b.length) return nx();
              return (ek ? Promise.all(b.map(function(x){ return decBlob(x, ek, x.type); })).then(function(d){ b=d; }) : Promise.resolve()).then(function(){ return new Promise(function(res){ fileToThumb(b[0], res); }); }).then(function(t){ return t ? idbPut(id, t) : null; })
                .then(function(){ return P.o ? origPut(id, b) : null; }).then(nx); }
            return nx();
          }, X.sec ? { sec:X.sec } : undefined);
        });
      }).catch(function(e){ pr.close(); var m=(e&&e.message)||String(e); if(m!=="annulé") window.alert("Sauvegarde illisible : "+m); });
    }
restorein.onchange=function(ev){ var f=ev.target.files && ev.target.files[0]; if(ev.target) ev.target.value=""; if(f) restoreData(f); };

    function tickBourse(){
      if(!FEAT.bourse) return;
      if(!bourse.some(function(c){ return c.sol; }) && !epargne.some(function(c){ return c.bourseLink; }) && state.view!=="bourse" && state.view!=="compte") return;
      fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=eur")
        .then(function(r){ return r.json(); })
        .then(function(j){
          var p=j&&j.solana&&j.solana.eur; if(!p) return; p=toBase(p,"EUR"); if(p===null) return;
          state.solPrice=p; state.solTime=new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
          var ae=document.activeElement, typing=ae&&/^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName||"");
          if(!typing) state.prixActuel=String(p).replace(".",",");
          syncBourseEpargne();
          if((state.view==="list"||state.view==="bourse"||state.view==="compte") && !typing) render();
        })
        .catch(function(){});
    }
