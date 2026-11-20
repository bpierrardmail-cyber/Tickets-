    // ---------- Analyse : Historique + Graphes réunis ----------
    function renderAnalyse(){
      var curM=monthKey(todayISO());
      var mode=state.anChart||store.read("anChartDef","mois"); if(["mois","rep","rec","pay"].indexOf(mode)<0) mode="mois";
      function mShort(m){ var pm=m.split("-"); return new Date(+pm[0], +pm[1]-1, 1).toLocaleDateString("fr-FR",{month:"short"}).replace(".",""); }
      // ---- Mois par mois (ex-Historique) : 12 derniers mois, filtre catégorie / grande catégorie / produit
      var months=lastMonths(12), monthsSet={}; months.forEach(function(mo){ monthsSet[mo.key]=true; });
      var catSet={}, famSet={}, prodSet={};
      vEntries().forEach(function(e){
        if(!monthsSet[monthKey(e.date)]) return;
        catSet[e.categorie]=true; catSet[catMain(e.categorie)]=true;
        (e.articles||[]).forEach(function(a){ famSet[classifyArticle(a).fam]=true; var pr=a.produit||""; if(pr && FAMILLES.indexOf(pr)<0 && pr!=="Remise") prodSet[pr]=true; });
      });
      var catList=[]; catMains().concat(Object.keys(catSet).filter(catIsMain)).forEach(function(m){ if(!catSet[m] || catList.indexOf(m)>=0) return; catList.push(m); catSubs(m).forEach(function(c){ if(catSet[c]) catList.push(c); }); });
      Object.keys(catSet).forEach(function(c){ if(catList.indexOf(c)<0) catList.push(c); });
      var famList=Object.keys(famSet).sort(), prodList=Object.keys(prodSet).sort();
      function selValid(s0){ if(!s0) return true; if(s0.indexOf("cat:")===0) return catList.indexOf(s0.slice(4))>=0; if(s0.indexOf("fam:")===0) return famList.indexOf(s0.slice(4))>=0; if(s0.indexOf("prod:")===0) return prodList.indexOf(s0.slice(5))>=0; return false; }
      if(!selValid(state.histCat)) state.histCat="";
      var sel=state.histCat;
      function amountFor(e){
        if(!sel) return Number(e.montant)||0;
        if(sel.indexOf("cat:")===0) return catIn(e.categorie, sel.slice(4))?(Number(e.montant)||0):0;
        if(sel.indexOf("fam:")===0){ var f=sel.slice(4), st=0; (e.articles||[]).forEach(function(a){ if(classifyArticle(a).fam===f) st+=Number(a.prix)||0; }); return st; }
        if(sel.indexOf("prod:")===0){ var pp=sel.slice(5), st2=0; (e.articles||[]).forEach(function(a){ if((a.produit||"")===pp) st2+=Number(a.prix)||0; }); return st2; }
        return 0;
      }
      var perM={}; vEntries().forEach(function(e){ var k=monthKey(e.date); if(monthsSet[k]) perM[k]=(perM[k]||0)+amountFor(e); });
      // « + Frais fixes » (avec « Toutes les dépenses ») : ce que les frais fixes retirent du compte de la personne choisie
      var fxOn=anFraisOn(), fxWho=(pvCur()==="all") ? null : pvName(pvCur()), fxIn=fxOn && !sel, fxSum=0, fxOthers=0;
      var data=months.map(function(mo){ var fx=0;
        if(fxIn){ anFraisLines(mo.key, fxWho).forEach(function(x){ fx+=x.v; if(x.others) fxOthers+=x.others; }); fxSum+=fx; }
        return { key:mo.key, label:capFirst(mo.date.toLocaleDateString("fr-FR",{month:"long",year:"numeric"})), short:mo.date.toLocaleDateString("fr-FR",{month:"short",year:"2-digit"}), total:(perM[mo.key]||0)+fx, fx:fx }; });
      var grand=0, active=0; data.forEach(function(d){ grand+=d.total; if(d.total>0) active++; });
      var avg=active?grand/active:0;
      var selLabel=sel?sel.slice(sel.indexOf(":")+1):"";
      var shown=data.slice(); while(shown.length>1 && shown[0].total===0) shown.shift();
      var best=null; shown.forEach(function(d){ if(!best || d.total>best.total) best=d; });
      var maxV=0; shown.forEach(function(d){ if(d.total>maxV) maxV=d.total; }); if(maxV<=0) maxV=1;
      function anCol(v){ return v>avg?"#e0a458":"#7c9cf4"; }   // ambre au-dessus de la moyenne, bleu en dessous

      // ---- Carte du haut : deux graphiques (onglets ou glissé)
      var TABS=[["mois","Mois"],["rep","Répartition"],["rec","Récurrentes"],["pay","Qui a payé"]];
      // « + Frais fixes » : en haut à droite de la carte
      var recPage=null, recPageTitle="";
      function recByPeek(){ var r=state.recBy||store.read("recBy","cat"); return ["cat","fam","mag","art"].indexOf(r)<0?"cat":r; }
      var chart=chartTabsHTML(TABS, mode, "anChartDef", "mois")+'<div class="cch'+(mode!=="mois"?' cch-top':'')+'">', fxBtn='';
      var hero;
      if(mode==="mois"){
        chart+='<select class="f anf" id="histcat"><option value=""'+(sel===""?" selected":"")+'>Toutes les dépenses</option>';
        if(catList.length){ chart+='<optgroup label="Catégories ticket">'; catList.forEach(function(c){ var v="cat:"+c; chart+='<option value="'+esc(v)+'"'+(sel===v?" selected":"")+'>'+(catIsMain(c)?'':'  ↳ ')+esc(c)+'</option>'; }); chart+='</optgroup>'; }
        if(famList.length){ chart+='<optgroup label="Catégories des articles">'; famList.forEach(function(f){ var v="fam:"+f; chart+='<option value="'+esc(v)+'"'+(sel===v?" selected":"")+'>'+esc(f)+'</option>'; }); chart+='</optgroup>'; }
        if(prodList.length){ chart+='<optgroup label="Articles">'; prodList.forEach(function(pp){ var v="prod:"+pp; chart+='<option value="'+esc(v)+'"'+(sel===v?" selected":"")+'>'+esc(pp)+'</option>'; }); chart+='</optgroup>'; }
        chart+='</select>';
        if(fraisCommuns.length) fxBtn='<button type="button" class="anfx anfx-corner'+(fxOn?' on':'')+'" id="anFx" aria-pressed="'+fxOn+'"'+(sel?' disabled':'')+'>'+(fxOn?'✓':'＋')+' Frais fixes</button>';
        chart+=compteBarsSVG(shown.map(function(d){ return { m:d.key, lbl:mShort(d.key), v:d.total, fx:fxIn?d.fx:0 }; }), curM, function(r){ return anCol(r.v); });
        chart+='<div class="cch-leg"><span><i style="background:#7c9cf4"></i>Sous la moyenne</span><span><i style="background:#e0a458"></i>Au-dessus</span>'+(fxIn?'<span><i style="background:#c78bd6"></i>Frais fixes</span>':'')+'</div>';
        chart+='<div class="cch-note">'+(sel?'« '+esc(selLabel)+' » par mois'+(fxOn?' · frais fixes seulement avec « Toutes les dépenses »':''):(fxIn?'Tickets + frais fixes par mois':'Total des tickets par mois'))+' · touche une barre pour le détail du mois</div>';
        // en grand : le mois en cours ; le total de la période passe dans les encadrés
        var refM=state.anRef||curM, cm0=data.filter(function(d){ return d.key===refM; })[0]||(refM>curM?{ total:0, fx:0, key:refM }:null)||data[data.length-1]||{ total:0, fx:0, key:curM };   // l'accueil peut demander un autre mois
        hero={ label:"Dépensé en "+esc(monthLabelOf(cm0.key||curM))+(sel?" · "+esc(selLabel):""), big:cm0.total, color:"var(--ink)",
               sub:(fxIn && cm0.fx>0 ? "dont frais fixes "+fmtK(cm0.fx) : (avg>0 ? (cm0.total>avg?"au-dessus":"en dessous")+" de la moyenne de "+fmtK(avg) : "")),
               stats:[ {l:"Moyenne / mois", v:fmtS(avg)}, {l:"Record"+(best&&best.total>0?" · "+esc(best.short):""), v:(best&&best.total>0?fmtS(best.total):"—")}, {l:"Sur "+shown.length+" mois", v:fmtS(grand)} ] };
      } else if(mode==="rec"){
        // ---- Dépenses qui reviennent : 12 derniers mois (depuis le premier ticket au plus), tout est listé, du plus fréquent au moins fréquent
        // coût par mois = total ÷ nombre de mois couverts (un plein tous les deux mois compte pour moitié)
        var recSel=(state.anSub==="rec" && state.recSel && state.recSel.by===recByPeek()) ? state.recSel : null, recHits=[];
        var fxOnR=anFraisOn(), fwR=(pvCur()==="all") ? null : pvName(pvCur()), fdR=null;
        // premier mois avec un ticket de la personne affichée, dans les 12 derniers mois (un ticket plus ancien ou mal daté ne compte pas)
        var m12=lastMonths(12)[0].key; vEntries().forEach(function(e){ var k=e.date && monthKey(e.date); if(k && k>=m12 && k<=curM && (!fdR || k<fdR)) fdR=k; });
        var m6=[], mk6=curM; for(var i6=0;i6<12;i6++){ if(fdR && mk6<fdR) break; m6.unshift(mk6); mk6=prevMonthKey(mk6); }
        var nM=m6.length||1;
        var recBy=state.recBy||store.read("recBy","cat"); if(["cat","fam","mag","art"].indexOf(recBy)<0) recBy="cat";
        // nom de magasin rapproché : sans accents, majuscules, ponctuation ni numéros (« Intermarché » = « INTERMARCHE 1234 »)
        function magKey(x){ x=String(x||"").toLowerCase(); try{ x=x.normalize("NFD").replace(/[\u0300-\u036f]/g,""); }catch(e){}
          return x.replace(/[^a-z ]+/g," ").replace(/\b(sas|sarl|sa|eurl|snc|magasin|store|station|super|hyper|market)\b/g," ").replace(/\s+/g," ").trim(); }
        var rows0=[], kCount={}; vEntries().forEach(function(e){ var k=monthKey(e.date); if(m6.indexOf(k)<0) return;
          var nm=recBy==="cat" ? ((e.categorie||"").trim()||"Autre") : (e.marchand||"").trim(), key=recBy==="cat" ? nm.toLowerCase() : magKey(nm); if(!key) return;
          rows0.push({ e:e, k:k, nm:nm, key:key }); kCount[key]=(kCount[key]||0)+1; });
        // magasins : noms presque identiques regroupés (faute de lecture du ticket : « INTERMACHE » = « Intermarché »)
        var alias={};
        if(recBy==="mag"){
          function lev(a,b){ if(Math.abs(a.length-b.length)>2) return 9; var d=[], i, j; for(i=0;i<=a.length;i++){ d[i]=[i]; } for(j=1;j<=b.length;j++) d[0][j]=j;
            for(i=1;i<=a.length;i++) for(j=1;j<=b.length;j++) d[i][j]=Math.min(d[i-1][j]+1, d[i][j-1]+1, d[i-1][j-1]+(a.charAt(i-1)===b.charAt(j-1)?0:1)); return d[a.length][b.length]; }
          function near(a,b){ var a1=a.split(" ")[0], b1=b.split(" ")[0], m=Math.min(a1.length,b1.length); if(m<5) return a===b; return lev(a1,b1)<=(m>=9?2:1); }
          var heads=Object.keys(kCount).sort(function(a,b){ return kCount[b]-kCount[a]; }), keep=[];
          heads.forEach(function(k){ var h0=null; for(var q=0;q<keep.length;q++){ if(near(k, keep[q])){ h0=keep[q]; break; } } if(h0) alias[k]=h0; else keep.push(k); });
        }
        var byM={}; rows0.forEach(function(r){ var key=alias[r.key]||r.key, e=r.e, k=r.k, nm=r.nm;
          if(recSel && recBy!=="art" && recBy!=="fam" && recSel.key===key) recHits.push({ e:e, amt:Number(e.montant)||0 });
          if(!byM[key]) byM[key]={ names:{}, m:{} }; byM[key].names[nm]=(byM[key].names[nm]||0)+1; byM[key].m[k]=(byM[key].m[k]||0)+(Number(e.montant)||0); });
        var recs=[];
        if(recBy==="art" || recBy==="fam"){
          // Par article : produits rangés (onglet Articles), avec l'évolution du prix moyen d'une ligne entre le premier et le dernier mois
          var byA={}; vEntries().forEach(function(e){ var k=monthKey(e.date); if(m6.indexOf(k)<0) return;
            (e.articles||[]).forEach(function(a){ var c=classifyArticle(a); if(c.fam==="Remise" || !(c.amt>0)) return; var key=recBy==="fam" ? c.fam : c.fam+"|"+c.name;
              if(recSel && recSel.key===key) recHits.push({ e:e, amt:c.amt, lbl:((a.label||"").trim()||c.name) });
              if(!byA[key]) byA[key]={ fam:c.fam, name:(recBy==="fam"?c.fam:c.name), m:{}, n:{} }; byA[key].m[k]=(byA[key].m[k]||0)+c.amt; byA[key].n[k]=(byA[key].n[k]||0)+1; }); });
          Object.keys(byA).forEach(function(key){ var o=byA[key], ks=Object.keys(o.m).sort(), t=0; ks.forEach(function(x){ t+=o.m[x]; });
            var p0=o.m[ks[0]]/o.n[ks[0]], p1=o.m[ks[ks.length-1]]/o.n[ks[ks.length-1]];
            recs.push({ key:key, name:o.name, fam:o.fam, n:ks.length, avg:t/nM, fx:false, art:recBy==="art", evo:(ks.length>1 && p0>0?(p1-p0)/p0*100:0) }); });
        } else Object.keys(byM).forEach(function(k){ var o=byM[k], ks=Object.keys(o.m), t=0; ks.forEach(function(x){ t+=o.m[x]; });
          var nm=Object.keys(o.names).sort(function(a,b){ return o.names[b]-o.names[a]; })[0]; recs.push({ key:k, name:nm, n:ks.length, avg:t/nM, fx:false }); });
        if(fxOnR){ var fxSeen={}; m6.forEach(function(mk){ anFraisLines(mk, fwR).forEach(function(x){ var k="fx|"+x.label; if(!fxSeen[k]){ fxSeen[k]={ name:x.label, n:0, t:0, ms:{}, avg:0, fx:true }; recs.push(fxSeen[k]); }
          var o=fxSeen[k]; o.t+=x.v; if(!o.ms[mk]){ o.ms[mk]=1; o.n++; } o.avg=o.t/nM; }); }); }
        recs=recs.filter(function(x){ return x.fx || x.n>=2; });   // acheté au moins 2 mois différents : les achats uniques de l'année ne sont pas des dépenses qui reviennent
        recs.sort(function(a,b){ return (b.avg-a.avg) || (b.n-a.n); });   // du plus cher au moins cher
        var recT=recs.reduce(function(t,x){ return t+x.avg; },0), recMax=recs.reduce(function(m,x){ return Math.max(m,x.avg); },0)||1;
        if(fraisCommuns.length) fxBtn='<button type="button" class="anfx anfx-corner'+(fxOnR?' on':'')+'" id="anFx" aria-pressed="'+fxOnR+'">'+(fxOnR?'✓':'＋')+' Frais fixes</button>';
        chart+='<div class="dmode" id="recBy" style="justify-content:center;margin:2px 0 4px"><button type="button" data-v="cat"'+(recBy==="cat"?' class="on"':'')+'>Catégories</button><button type="button" data-v="fam"'+(recBy==="fam"?' class="on"':'')+'>Catégories</button><button type="button" data-v="mag"'+(recBy==="mag"?' class="on"':'')+'>Magasins</button><button type="button" data-v="art"'+(recBy==="art"?' class="on"':'')+'>Articles</button></div>';
        if(!recs.length) chart+='<div class="cch-note" style="margin:24px 0">'+((recBy==="art"||recBy==="fam")?"Rien acheté au moins 2 mois différents (seuls les tickets scannés avec leurs lignes comptent).":"Aucune dépense revenue au moins 2 mois différents sur la période.")+'</div>';
        else { chart+='<div style="margin-top:6px">'; recs.forEach(function(x){ var pc=Math.max(2, Math.round(x.avg/recMax*100));
          var evo=(x.art && Math.abs(x.evo)>=0.5)?' <small style="color:'+(x.evo>0?'var(--coral)':'var(--accent)')+';font-weight:700">'+(x.evo>0?'▲ +':'▼ ')+String(Math.round(x.evo*10)/10).replace(".",",")+' %</small>':'';
          chart+='<div class="bar-row'+(x.fx?'':' recrow clk')+'"'+(x.fx?'':' data-key="'+esc(x.key)+'" data-name="'+esc(x.name)+'"')+' style="margin:10px 2px"><div class="bar-top"><span class="bl">'+esc(x.name)+' <small class="muted">'+(x.fx?'frais fixe · ':'')+x.n+' mois sur '+nM+'</small>'+evo+'</span><span class="bv">'+fmtK(x.avg)+'<small class="muted"> /mois</small></span></div><div class="bar-track"><i style="width:'+pc+'%;background:'+(x.fx?'#c78bd6':'#7c9cf4')+'"></i></div></div>'; });
          chart+='</div><div class="cch-note">Au moins 2 mois différents · du plus cher au moins cher · coût moyen par mois sur '+nM+' mois'+(recBy==="art"?' · ▲▼ prix d\'une ligne, premier mois → dernier':'')+' · touche une ligne pour ses tickets</div>'; }
        if(recSel){ var hT=0; recHits.sort(function(a,b){ return String(b.e.date||"").localeCompare(String(a.e.date||"")); });
          var rp='<div class="muted" style="font-size:12px;margin:12px 4px 0">'+recHits.length+' achat'+(recHits.length>1?'s':'')+' sur '+nM+' mois · touche un ticket pour l\'ouvrir</div>', curMo="";
          recHits.forEach(function(x){ hT+=x.amt; });
          rp+='<section class="paper cacc" style="padding:4px 14px 8px"><div class="dtot" style="padding:12px 2px 6px"><span>Total</span><span class="v" style="color:var(--ink)">'+fmtK(hT)+'</span></div><div class="dsub" style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin:0 2px 6px"><span>Coût moyen par mois</span><span>'+fmtK(hT/nM)+'</span></div>';
          recHits.forEach(function(x){ var mo=monthKey(x.e.date), dd=(x.e.date||"").split("-");
            if(mo!==curMo){ curMo=mo; rp+='<div class="dsub" style="display:flex;justify-content:space-between;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:12px 2px 4px"><span>'+esc(monthLabelOf(mo))+'</span><span></span></div>'; }
            rp+='<div class="entry ecomp" data-id="'+esc(x.e.id)+'" style="display:flex;align-items:center;gap:10px;background:none;border:0;border-top:1px solid var(--line);border-radius:0;margin:0;padding:10px 2px;box-shadow:none;cursor:pointer"><span class="n" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(x.lbl||x.e.marchand||"—")+'<small style="display:block;font-size:10.5px;color:var(--muted)">'+esc(x.lbl?(x.e.marchand||""):(x.e.categorie||""))+'</small></span><span class="d" style="color:var(--muted);font-size:12px">'+esc(dd.length===3?dd[2]+"/"+dd[1]:"")+'</span><span class="a" style="font-weight:700;font-variant-numeric:tabular-nums">'+fmtK(x.amt)+'</span></div>'; });
          if(!recHits.length) rp+='<div class="muted" style="font-size:12px;margin:12px 2px">Aucun ticket sur la période.</div>';
          recPage=rp+'</section>'; recPageTitle=recSel.name; }
        hero={ label:"Dépenses qui reviennent · "+nM+" mois", big:recT, color:"var(--ink)", sub:recs.length?recs.length+" dépense"+(recs.length>1?"s":"")+" · environ par mois":"" };
      } else if(mode==="pay"){
        // ---- Qui a payé : les dépenses affichées (filtre par personne), réparties selon la personne qui a payé
        var pP=state.graphPeriod||"cur", fxOnP=anFraisOn();
        var perP = pP==="all" ? "12 derniers mois" : (pP.indexOf("m:")===0 ? new Date(pP.slice(2)+"-01T00:00:00").toLocaleDateString("fr-FR",{month:"long",year:"numeric"}) : new Date().toLocaleDateString("fr-FR",{month:"long",year:"numeric"}));
        // toujours tout le foyer (le filtre du haut ne garderait que la personne choisie) ; la personne choisie est mise en avant
        var selP=(pvCur()==="all") ? null : pvName(pvCur()), msP={};
        if(pP==="all") lastMonths(12).forEach(function(m){ msP[m.key]=1; }); else msP[pP.indexOf("m:")===0 ? pP.slice(2) : curM]=1;
        var byP={}; state.entries.forEach(function(e){ if(!msP[monthKey(e.date)]) return; var w=payerOf(e); byP[w]=(byP[w]||0)+(Number(e.montant)||0); });
        if(fxOnP){ var pmsP=pP==="all" ? lastMonths(12).map(function(m){ return m.key; }) : [pP.indexOf("m:")===0 ? pP.slice(2) : curM], fwP=null;
          var whoP={}; viewPersons().concat(uniquePersons()).forEach(function(x){ whoP[x]=1; }); whoP[mePerson()]=1;
          pmsP.forEach(function(mk){ Object.keys(whoP).forEach(function(x){ if(fwP && x!==fwP) return; var t=anFraisTotal(mk, x); if(t>0) byP[x]=(byP[x]||0)+t; }); }); }
        var payL=Object.keys(byP).map(function(k){ return { name:k, v:byP[k] }; }).filter(function(x){ return x.v>0.004; }).sort(function(a,b){ return b.v-a.v; });
        var payT=payL.reduce(function(t,x){ return t+x.v; },0), payMax=payL.length?payL[0].v:1;
        chart+='<div class="anctl"><select class="f anf" id="gper"><option value="cur"'+(pP==="cur"?" selected":"")+'>Ce mois-ci</option><option value="all"'+(pP==="all"?" selected":"")+'>12 derniers mois</option><optgroup label="Un mois précis">';
        lastMonths(12).slice().reverse().forEach(function(m){ var v="m:"+m.key; chart+='<option value="'+v+'"'+(pP===v?" selected":"")+'>'+esc(capFirst(m.date.toLocaleDateString("fr-FR",{month:"long",year:"numeric"})))+'</option>'; });
        chart+='</optgroup></select></div>';
        if(fraisCommuns.length) fxBtn='<button type="button" class="anfx anfx-corner'+(fxOnP?' on':'')+'" id="anFx" aria-pressed="'+fxOnP+'">'+(fxOnP?'✓':'＋')+' Frais fixes</button>';
        if(!payL.length) chart+='<div class="cch-note" style="margin:24px 0">Aucune dépense sur cette période.</div>';
        else { chart+='<div style="margin-top:6px">'; payL.forEach(function(x){ var pc=Math.max(2, Math.round(x.v/payMax*100));
          var dim=selP && x.name!==selP;
          chart+='<div class="bar-row payrow clk" data-name="'+esc(x.name)+'" style="margin:12px 2px;'+(dim?'opacity:.5':'')+'"><div class="bar-top"><span class="bl"'+(selP && !dim?' style="font-weight:800"':'')+'>'+esc(x.name)+(x.name===mePerson()?' <small class="muted">toi</small>':'')+'</span><span class="bv">'+fmtK(x.v)+' <small class="muted">'+Math.round(x.v/(payT||1)*100)+' %</small></span></div><div class="bar-track"><i style="width:'+pc+'%;background:'+personColor(x.name)+'"></i></div></div>'; });
          chart+='</div>'; }
        // page d'une personne : ses tickets par catégorie (repliables) et ses frais fixes
        if(state.anSub==="pay" && state.paySel){ var who=state.paySel, mine=state.entries.filter(function(e){ return msP[monthKey(e.date)] && payerOf(e)===who; }).sort(function(a,b){ return String(b.date||"").localeCompare(String(a.date||"")); });
          var pc={}, pcl={}, ptot=0; mine.forEach(function(e){ var c=e.categorie||"Autre", v=Number(e.montant)||0; pc[c]=(pc[c]||0)+v; (pcl[c]=pcl[c]||[]).push(e); ptot+=v; });
          var pfx={}, pfxT=0; if(fxOnP) Object.keys(msP).forEach(function(mk){ anFraisLines(mk, who).forEach(function(x){ pfx[x.label]=(pfx[x.label]||0)+x.v; pfxT+=x.v; }); });
          var po=state.payOpen||(state.payOpen={}), PC=["#7c9cf4","#e0a458","#4fd6a0","#c78bd6","#5bc0d4","#e88fb0","#9bd35e","#d4a05b","#8a92e0","#6fcaa8","#d98c5f","#b0b6c2"];
          function pg(key, col, title, sub, val, body){ return '<div class="dgrp'+(po[key]?' open':'')+'" data-g="'+esc(key)+'"><div class="dgh"><i class="cdot" style="background:'+col+';margin:0"></i><span class="t">'+esc(title)+'<em class="ds">'+sub+'</em></span><span class="v">'+fmtK(val)+'</span><span class="chev">›</span></div><div class="dgb">'+body+'</div></div>'; }
          var pp='<section class="paper cacc"><div class="cacc-h" style="cursor:default;padding-bottom:6px"><span class="t">Payé par '+esc(who)+'<small>'+esc(perP)+' · '+mine.length+' ticket'+(mine.length>1?'s':'')+(pfxT>0?' + frais fixes':'')+' · touche une ligne pour la déplier</small></span><span class="v" style="color:var(--accent)">'+fmtK(ptot+pfxT)+'</span></div>';
          Object.keys(pc).sort(function(a,b){ return pc[b]-pc[a]; }).forEach(function(c, ci){
            var body=pcl[c].map(function(e){ var dd=(e.date||"").split("-"); return '<div class="entry ecomp" data-id="'+esc(e.id)+'"><span class="n">'+esc(e.marchand||"—")+'<small>'+esc(dd.length===3?dd[2]+"/"+dd[1]+"/"+dd[0].slice(2):"")+'</small></span><span class="a">'+fmtK(e.montant)+'</span></div>'; }).join("");
            pp+=pg("c|"+c, PC[ci%PC.length], c, pcl[c].length+" ticket"+(pcl[c].length>1?"s":"")+" · "+Math.round(pc[c]/((ptot+pfxT)||1)*100)+" %", pc[c], body); });
          if(pfxT>0) pp+=pg("fx", "#c78bd6", "Frais fixes", Object.keys(pfx).length+" frais", pfxT, Object.keys(pfx).sort(function(a,b){ return pfx[b]-pfx[a]; }).map(function(l){ return '<div class="dfrow"><span class="n">'+esc(l)+'</span><span class="a">'+fmtK(pfx[l])+'</span></div>'; }).join(""));
          if(!mine.length && !(pfxT>0)) pp+='<div class="muted" style="font-size:12px;margin:10px 2px 14px">Rien de payé par '+esc(who)+' sur cette période.</div>';
          recPage=pp+'</section>'; recPageTitle=who; }
        hero={ label:"Qui a payé · "+esc(perP), big:(selP ? (byP[selP]||0) : payT), color:"var(--ink)", sub:(selP ? "payé par "+esc(selP)+" · "+(payT>0?Math.round((byP[selP]||0)/payT*100):0)+" % des "+fmtK(payT)+" du foyer" : "tout le foyer") };
      } else {
        // ---- Répartition (ex-Graphes · Dépenses)
        var p=state.graphPeriod||"cur", dim=state.graphDim||"fam", typ=state.graphType||"donut";
        var perLabel = p==="all" ? "12 derniers mois" : (p.indexOf("m:")===0 ? new Date(p.slice(2)+"-01T00:00:00").toLocaleDateString("fr-FR",{month:"long",year:"numeric"}) : new Date().toLocaleDateString("fr-FR",{month:"long",year:"numeric"}));
        var map=gAggregate(gPeriodEntries(), dim);
        var fxOn2=anFraisOn(), fxRep=0;
        if(fxOn2){
          var pms=p==="all" ? lastMonths(12).map(function(m){ return m.key; }) : [p.indexOf("m:")===0 ? p.slice(2) : curM], fw=(pvCur()==="all") ? null : pvName(pvCur());
          pms.forEach(function(mk){
            if(dim==="pers"){
              if(fw) { var t0=anFraisTotal(mk, fw); if(t0>0) map[fw]=(map[fw]||0)+t0; }
              else { var who2={}; viewPersons().concat(uniquePersons()).forEach(function(x){ who2[x]=1; }); who2[mePerson()]=1;
                Object.keys(who2).forEach(function(x){ var t1=anFraisTotal(mk, x); if(t1>0) map[x]=(map[x]||0)+t1; }); }
            } else { var t2=anFraisTotal(mk, fw); if(t2>0){ map["Frais fixes"]=(map["Frais fixes"]||0)+t2; fxRep+=t2; } }
          });
        }
        var all=Object.keys(map).map(function(k){ return {name:k, value:map[k]}; }).sort(function(a,b){ return b.value-a.value; });
        if(dim==="prod" && all.length>12){ var top=all.slice(0,12), rest=all.slice(12).reduce(function(s2,x){ return s2+x.value; },0); if(rest>0) top.push({name:"Autres", value:rest}); all=top; }
        var ANPAL=["#7c9cf4","#e0a458","#4fd6a0","#c78bd6","#5bc0d4","#e88fb0","#9bd35e","#d4a05b","#8a92e0","#6fcaa8","#d98c5f","#b0b6c2","#f4796b"];   // bleu en premier, rouge en dernier
        all.forEach(function(it,i){ it.color=ANPAL[i%ANPAL.length]; });
        var hide=state.graphHide||{}, vis=all.filter(function(it){ return !hide[dim+"|"+it.name]; });
        var visTotal=vis.reduce(function(s2,it){ return s2+it.value; },0), nHid=all.length-vis.length;
        var mv=0; vis.forEach(function(it){ if(it.value>mv) mv=it.value; }); if(mv<=0) mv=1;
        chart+='<div class="anctl"><select class="f anf" id="gper"><option value="cur"'+(p==="cur"?" selected":"")+'>Ce mois-ci</option><option value="all"'+(p==="all"?" selected":"")+'>12 derniers mois</option><optgroup label="Un mois précis">';
        lastMonths(12).slice().reverse().forEach(function(m){ var v="m:"+m.key; chart+='<option value="'+v+'"'+(p===v?" selected":"")+'>'+esc(capFirst(m.date.toLocaleDateString("fr-FR",{month:"long",year:"numeric"})))+'</option>'; });
        chart+='</optgroup></select><select class="f anf" id="gdim"><option value="fam"'+(dim==="fam"?" selected":"")+'>Catégories des articles</option><option value="prod"'+(dim==="prod"?" selected":"")+'>Produits</option><option value="cat"'+(dim==="cat"?" selected":"")+'>Catégories</option><option value="scat"'+(dim==="scat"?" selected":"")+'>Sous-catégories</option>'+(pvActive()?'<option value="pers"'+(dim==="pers"?" selected":"")+'>Qui a payé</option>':'')+'</select></div>';
        if(fraisCommuns.length) fxBtn='<button type="button" class="anfx anfx-corner'+(fxOn2?' on':'')+'" id="anFx" aria-pressed="'+fxOn2+'">'+(fxOn2?'✓':'＋')+' Frais fixes</button>';
        chart+='<div class="dmode" id="gtype" style="justify-content:center;margin:10px 0 4px"><button type="button" data-t="donut"'+(typ==="donut"?' class="on"':'')+'>Anneau</button><button type="button" data-t="bars"'+(typ==="bars"?' class="on"':'')+'>Barres</button></div>';
        if(!all.length) chart+='<div class="cch-note" style="margin:24px 0">Aucune dépense sur cette période.</div>';
        else {
          if(visTotal<=0) chart+='<div class="cch-note" style="margin:18px 0">Tout est masqué : touche une ligne pour l\'afficher.</div>';
          else if(typ==="donut") chart+='<div class="cdon cdon-big" style="justify-content:center">'+compteDonutSVG(vis.map(function(it){ return { v:it.value, col:it.color, k:(it.name==="Frais fixes"||it.name==="Autres")?null:it.name }; }), visTotal)+'</div>';
          else { chart+='<div style="margin-top:4px">'; vis.forEach(function(it){ var pc=Math.max(2, Math.round(it.value/mv*100)); var rk=(it.name!=="Frais fixes" && it.name!=="Autres"); chart+='<div class="bar-row'+(rk?' repbar':'')+'"'+(rk?' data-k="'+esc(it.name)+'"':'')+' style="margin:10px 2px'+(rk?';cursor:pointer':'')+'"><div class="bar-top"><span class="bl">'+esc(it.name)+'</span><span class="bv">'+fmtK(it.value)+'</span></div><div class="bar-track" style="height:10px"><i style="width:'+pc+'%;background:'+it.color+'"></i></div></div>'; }); chart+='</div>'; }
          chart+='<div style="margin-top:6px">';
          all.forEach(function(it){ var hidden=!!hide[dim+"|"+it.name], share=(!hidden && visTotal>0)?(Math.round(it.value/visTotal*100)+" %"):"—";
            chart+='<button class="lgd'+(hidden?" off":"")+'" type="button" data-name="'+esc(it.name)+'"><span class="sw" style="background:'+it.color+'"></span><span class="ln">'+esc(it.name)+'</span><span class="lv">'+fmtK(it.value)+'</span><span class="lp">'+share+'</span></button>'; });
          chart+='</div><div class="cch-note">Touche '+(typ==="donut"?'une part de l\'anneau':'une barre')+' pour ses achats · une ligne pour la masquer ou l\'afficher</div>';
        }
        // page d'un poste touché dans le graphique : ses achats de la période
        if(state.anSub==="repi" && state.repSel && state.repSel.dim===dim && map[state.repSel.name]!=null){ var rsN=state.repSel.name, rH=[], rT=0;
          gPeriodEntries().forEach(function(e){
            if(dim==="cat"){ if(catIn(e.categorie, rsN) && Number(e.montant)>0) rH.push({ e:e, amt:Number(e.montant), lbl:(e.categorie!==rsN ? (e.marchand||"—")+" · "+e.categorie : "") }); }
            else if(dim==="scat"){ if(e.categorie===rsN && Number(e.montant)>0) rH.push({ e:e, amt:Number(e.montant) }); }
            else if(dim==="pers"){ if(payerOf(e)===rsN && Number(e.montant)>0) rH.push({ e:e, amt:Number(e.montant) }); }
            else (e.articles||[]).forEach(function(a){ if((a.produit||"")==="Remise") return; var c=classifyArticle(a); if(c.amt<=0) return; if((dim==="fam"?c.fam:c.name)===rsN) rH.push({ e:e, amt:c.amt, lbl:((a.label||"").trim()||c.name) }); }); });
          rH.sort(function(a,b){ return String(b.e.date||"").localeCompare(String(a.e.date||"")); }); rH.forEach(function(x){ rT+=x.amt; });
          var rpg='';
          if(dim==="cat" && catSubs(rsN).length){ var rsS={}; rH.forEach(function(x){ var k=x.e.categorie===rsN ? "" : x.e.categorie; rsS[k]=(rsS[k]||0)+x.amt; });
            var rsK=Object.keys(rsS).sort(function(a,b){ return rsS[b]-rsS[a]; });
            if(rsK.length>1 || rsK[0]) rpg+='<div class="muted" style="font-size:12px;margin:12px 4px 0">Sous-catégories · touche pour le détail</div><section class="paper cacc" style="padding:4px 14px 6px">'+rsK.map(function(k){ return '<div class="dfrow'+(k?' rsub':'')+'"'+(k?' data-sub="'+esc(k)+'" style="cursor:pointer"':'')+'><span class="n">'+esc(k||"Sans sous-catégorie")+'</span><span class="a">'+fmtK(rsS[k])+'</span>'+(k?'<span class="k">›</span>':'')+'</div>'; }).join("")+'</section>'; }
          rpg+='<div class="muted" style="font-size:12px;margin:12px 4px 0">'+esc(perLabel)+' · '+rH.length+' achat'+(rH.length>1?'s':'')+' · touche un ticket pour l\'ouvrir</div><section class="paper cacc" style="padding:4px 14px 8px"><div class="dtot" style="padding:12px 2px 6px"><span>Total</span><span class="v" style="color:var(--ink)">'+fmtK(rT)+'</span></div>', rMo="";
          rH.forEach(function(x){ var mo=monthKey(x.e.date), dd=(x.e.date||"").split("-");
            if(mo!==rMo){ rMo=mo; rpg+='<div class="dsub" style="font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:12px 2px 4px">'+esc(monthLabelOf(mo))+'</div>'; }
            rpg+='<div class="entry ecomp" data-id="'+esc(x.e.id)+'" style="display:flex;align-items:center;gap:10px;background:none;border:0;border-top:1px solid var(--line);border-radius:0;margin:0;padding:10px 2px;box-shadow:none;cursor:pointer"><span class="n" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(x.lbl||x.e.marchand||"—")+'<small style="display:block;font-size:10.5px;color:var(--muted)">'+esc(x.lbl?(x.e.marchand||""):(x.e.categorie||""))+'</small></span><span class="d" style="color:var(--muted);font-size:12px">'+esc(dd.length===3?dd[2]+"/"+dd[1]:"")+'</span><span class="a" style="font-weight:700;font-variant-numeric:tabular-nums">'+fmtK(x.amt)+'</span></div>'; });
          if(!rH.length) rpg+='<div class="muted" style="font-size:12px;margin:12px 2px">Aucun achat sur la période.</div>';
          recPage=rpg+'</section>'; recPageTitle=rsN; }
        hero={ label:"Répartition · "+esc(perLabel), big:visTotal, color:"var(--ink)", sub:(nHid?nHid+" poste"+(nHid>1?"s":"")+" masqué"+(nHid>1?"s":""):"") };
      }
      chart+='</div>'; chart=fxBtn+chart; hero.extra=chart;
      var nSub=(state.anSub==="mois");   // sous-page « Par mois »
      if((state.anSub==="rec" || state.anSub==="pay" || state.anSub==="repi") && recPage===null) state.anSub=null;
      var h=(nSub || recPage!==null ? header(true, nSub?"Par mois":recPageTitle) : header(false, "Budget")+depTabsHTML())+pvBarHTML()+(nSub || recPage!==null?'':tabTools([["goAvancee","✦ Analyse avancée"+(canUse("avancee")?"":" · Plus")]])+tabHero(hero));
      if(recPage!==null){
        app.innerHTML=h+recPage;
        bindBack(function(){ state.anSub=null; state.recSel=null; state.paySel=null; state.repSel=null; render(); window.scrollTo(0,0); });
        [].forEach.call(document.querySelectorAll(".dgrp .dgh"), function(hd){ hd.onclick=function(){ var g=hd.parentNode, k=g.getAttribute("data-g"), o=state.payOpen||(state.payOpen={}); o[k]=!o[k]; g.classList.toggle("open", !!o[k]); }; });
        [].forEach.call(document.querySelectorAll(".entry[data-id]"), function(n){ n.onclick=function(){ editEntry(n.getAttribute("data-id")); }; });
        setNav("analyse", true); return;
      }
      if(!nSub) h+='<section class="paper cacc"><div class="cacc-sec"><div class="cacc-h" id="anGoMois"><span class="t"><span class="tic">📅</span> Par mois · '+data.length+(sel?'<small>'+esc(selLabel)+'</small>':'')+'</span><span class="v">'+fmtK(grand)+'</span><span class="ch">›</span></div></div></section>';
      // ---- Liste des mois (toucher = détail du mois et ses tickets)
      if(nSub) h+='<div class="muted" style="font-size:12px;margin:12px 4px 0">'+(sel?'« '+esc(selLabel)+' » · ':'')+'Touche un mois pour son détail et ses tickets.</div><section class="paper cacc anlist">';
      if(nSub) data.slice().reverse().forEach(function(d){   // les 12 derniers mois, même vides
        var pct=Math.max(d.total>0?2:0, Math.round(d.total/maxV*100));
        h+='<div class="bar-row clk" data-month="'+esc(d.key)+'"><div class="bar-top"><span class="bl">'+esc(d.label)+(d.key===curM?' <small class="muted">en cours</small>':'')+'</span><span class="bv">'+fmtK(d.total)+' <span class="ch">›</span></span></div><div class="bar-track"><i style="width:'+pct+'%;background:'+anCol(d.total)+'"></i></div></div>';
      });
      if(nSub) h+='</section>';
      app.innerHTML=h;
      if(nSub) bindBack(function(){ state.anSub=null; render(); window.scrollTo(0,0); });
      var gav=document.getElementById("goAvancee"); if(gav) gav.onclick=function(){ state.view="avancee"; state.avSub="vue"; state.avFrom=null; render(); window.scrollTo(0,0); };
      var agm=document.getElementById("anGoMois"); if(agm) agm.onclick=function(){ state.anSub="mois"; render(); window.scrollTo(0,0); };
      wireChartDefaults();
      [].forEach.call(document.querySelectorAll(".cch-tabs button"), function(bt){ bt.onclick=function(){ state.anChart=bt.getAttribute("data-m"); store.write("anChart", state.anChart); render(); }; });
      var hc=document.getElementById("histcat"); if(hc) hc.onchange=function(){ state.histCat=hc.value; render(); };
      [].forEach.call(document.querySelectorAll(".payrow"), function(r){ r.onclick=function(){ state.paySel=r.getAttribute("data-name"); state.payOpen={}; state.anSub="pay"; render(); window.scrollTo(0,0); }; });
      [].forEach.call(document.querySelectorAll(".recrow"), function(r){ r.onclick=function(){ state.recSel={ by:recByPeek(), key:r.getAttribute("data-key"), name:r.getAttribute("data-name") }; state.anSub="rec"; render(); window.scrollTo(0,0); }; });
      [].forEach.call(document.querySelectorAll(".dfrow.rsub[data-sub]"), function(r){ r.onclick=function(){ state.graphDim="scat"; state.repSel={ dim:"scat", name:r.getAttribute("data-sub") }; state.anSub="repi"; render(); window.scrollTo(0,0); }; });
      if(mode==="rep") [].forEach.call(document.querySelectorAll(".thero .dseg, .thero .repbar"), function(b){ b.style.cursor="pointer"; b.addEventListener("click", function(){ state.repSel={ dim:state.graphDim||"fam", name:b.getAttribute("data-k") }; state.anSub="repi"; render(); window.scrollTo(0,0); }); });
      [].forEach.call(document.querySelectorAll("#recBy button"), function(b){ b.onclick=function(){ state.recBy=b.getAttribute("data-v"); store.write("recBy", state.recBy); render(); }; });
      var afx=document.getElementById("anFx"); if(afx) afx.onclick=function(){ state.anFrais=!anFraisOn(); store.write("anFrais", state.anFrais); render(); };
      var gp=document.getElementById("gper"); if(gp) gp.onchange=function(){ state.graphPeriod=gp.value; render(); };
      var gd=document.getElementById("gdim"); if(gd) gd.onchange=function(){ state.graphDim=gd.value; render(); };
      [].forEach.call(document.querySelectorAll("#gtype button"), function(b){ b.onclick=function(){ state.graphType=b.getAttribute("data-t"); render(); }; });
      [].forEach.call(document.querySelectorAll(".lgd[data-name]"), function(b){ b.onclick=function(){ var key=(state.graphDim||"fam")+"|"+b.getAttribute("data-name"); if(!state.graphHide) state.graphHide={}; if(state.graphHide[key]) delete state.graphHide[key]; else state.graphHide[key]=true; render(); }; });
      if(mode==="mois") [].forEach.call(document.querySelectorAll(".thero .barhit"), function(b){ b.style.cursor="pointer"; b.addEventListener("click", function(){ state.histMonth=b.getAttribute("data-m"); state.view="month"; render(); window.scrollTo(0,0); }); });
      [].forEach.call(document.querySelectorAll(".anlist .bar-row.clk"), function(row){ row.onclick=function(){ state.histMonth=row.getAttribute("data-month"); state.view="month"; render(); window.scrollTo(0,0); }; });
      var aOn=document.querySelector(".thero .cch-tabs button.on"); if(aOn && aOn.parentNode){ var atb=aOn.parentNode; atb.scrollLeft=Math.max(0, aOn.offsetLeft-(atb.clientWidth-aOn.offsetWidth)/2); }
      if(!nSub) wireHeroSwipe(mode, TABS.map(function(x){ return x[0]; }), function(k){ state.anChart=k; store.write("anChart", k); });
      wireDepTabs();
      setNav("analyse", true);
    }
