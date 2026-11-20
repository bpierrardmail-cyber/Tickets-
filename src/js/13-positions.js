    // ---------- Positions : cryptos (CoinGecko) et actions / ETF (relais Yahoo) ----------
    var COURS_API = "https://tickets.bpierrard-mail.workers.dev";   // relais des cours (actions et ETF), intégré à l'app
    function coursApi(){ return (store.read("coursApi","")||COURS_API||"").replace(/\/+$/,""); }
    var pxCache = store.read("coursCache", {});   // { "cg:solana": {p, chg, cur, t} }
    var fxCache = store.read("fxCache", { t:0, rates:{} });  // taux EUR -> devise
    function posKey(p){ return p.src+":"+p.ref; }
    // Convertit un montant dans la devise principale (taux BCE du jour, base EUR)
    function toBase(amount, cur){
      if(amount===null || amount===undefined || !isFinite(amount)) return null;
      if(cur==="GBp"||cur==="GBX"){ amount=amount/100; cur="GBP"; }
      cur=cur||"EUR"; if(cur===BASE) return amount;
      var R=fxCache.rates||{}, rc=(cur==="EUR")?1:R[cur], rb=(BASE==="EUR")?1:R[BASE];
      return (rc && rb) ? amount/rc*rb : null;
    }
    function posPrice(p){ if(p.src==="man") return null; var c=pxCache[posKey(p)]; if(!c) return null; return toBase(c.p, c.cur); }
    // Prix d'achat : saisi dans la devise principale ou une autre (p.pruCur). Autre devise : convertie au taux du jour, comme le fait eToro.
    function pruBase(p){ if(!(p.pru>0)) return null; var c=p.pruCur||BASE; return c===BASE ? Number(p.pru) : toBase(Number(p.pru), c); }
    function costBase(p){ var u=pruBase(p); return u===null?null:u*(Number(p.qte)||0); }
    function fmtCur(n,cur){ return (cur && cur!==BASE) ? (Math.round(n*100)/100).toLocaleString("fr-FR",{minimumFractionDigits:2,maximumFractionDigits:2})+" "+curSym(cur) : fmt(n); }
    function posValue(p){ if(p.src==="man") return Number(p.valeur)||0; var pr=posPrice(p); return pr===null?null:pr*(Number(p.qte)||0); }
    function allPositions(){ var out=[]; bourse.forEach(function(c){ if(!bOpen(c)) return; (c.positions||[]).forEach(function(p){ out.push(p); }); }); return out; }
    function applyPositions(){
      var m0=monthKey(todayISO()), ch=false;
      bourse.forEach(function(c){
        if(!c.positions || !c.positions.length || !bOpen(c)) return;
        var tot=0, ok=true, cap=0, capOk=true;
        c.positions.forEach(function(p){ var v=posValue(p); if(v===null) ok=false; else tot+=v; if(p.src==="man"){ if(p.investi>0) cap+=Number(p.investi); else capOk=false; } else { var ce=costBase(p); if(ce!==null) cap+=ce; else capOk=false; } });
        if(!ok) return;
        if(!c.vals) c.vals={};
        var cur=c.vals[m0]||{}, capPrev=cur.capital; if(capPrev===undefined){ var bl=bLast(c); capPrev=bl?bl.capital:0; }
        var capital=(capOk && !c.capManual)?Math.round(cap*100)/100:(Number(capPrev)||0), valeur=Math.round(tot*100)/100;
        if(Number(cur.valeur)!==valeur || Number(cur.capital)!==capital){ bSnap(c, m0, capital, valeur); ch=true; }
      });
      if(ch) persistBourse();
      return ch;
    }
    var posBusy=false, posLast=0;
    function refreshPositions(force){
      if(!FEAT.bourse) return;
      var ps=allPositions(); if(!ps.length || posBusy) return;
      if(!force && Date.now()-posLast<60000) return;
      posBusy=true; posLast=Date.now();
      var cg={}, yf={};
      ps.forEach(function(p){ if(p.src==="cg") cg[p.ref]=1; else if(p.src==="yf") yf[p.ref]=1; });
      var jobs=[];
      var cgIds=Object.keys(cg);
      if(cgIds.length) jobs.push(cgGet("/simple/price?ids="+encodeURIComponent(cgIds.join(","))+"&vs_currencies=eur&include_24hr_change=true", "/crypto/price?ids="+encodeURIComponent(cgIds.join(",")), function(j){ return j && !j.status && !j.error; })
        .then(function(j){ cgIds.forEach(function(id){ var x=j&&j[id]; if(x && x.eur!=null) pxCache["cg:"+id]={ p:x.eur, chg:(x.eur_24h_change!=null?x.eur_24h_change:null), cur:"EUR", t:Date.now() }; }); }).catch(function(){}));
      var yfS=Object.keys(yf), api=coursApi();
      if(yfS.length && api) jobs.push(fetch(api+"/quote?symbols="+encodeURIComponent(yfS.join(",")))
        .then(function(r){ return r.json(); }).then(function(j){ var q=(j&&j.quotes)||{}; yfS.forEach(function(s){ var x=q[s]; if(x && x.price!=null) pxCache["yf:"+s]={ p:x.price, chg:(x.prev?((x.price-x.prev)/x.prev*100):null), cur:x.currency||"USD", t:Date.now() }; }); }).catch(function(){}));
      if(Date.now()-(fxCache.t||0)>12*3600000) jobs.push(fetch("https://api.frankfurter.dev/v1/latest?base=EUR")
        .then(function(r){ return r.json(); }).then(function(j){ if(j && j.rates){ fxCache={ t:Date.now(), rates:j.rates }; store.write("fxCache", fxCache); } }).catch(function(){}));
      Promise.all(jobs).then(function(){
        posBusy=false; store.write("coursCache", pxCache);
        applyPositions(); syncBourseEpargne();
        var ae=document.activeElement, typing=ae&&/^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName||"");
        if(!typing && !document.querySelector(".sheet-overlay") && (state.view==="bourse"||state.view==="list"||state.view==="compte")) render();
      });
    }
    // CoinGecko en direct, puis via le relais (cache partagé) si CoinGecko refuse (limite de requêtes)
    function cgGet(path, relayPath, okFn){
      function viaRelay(){ var api=coursApi(); if(!api) return Promise.reject(new Error("cg")); return fetch(api+relayPath).then(function(r){ return r.json(); }).then(function(j){ if(!okFn(j)) throw new Error("cg"); return j; }); }
      return fetch("https://api.coingecko.com/api/v3"+path).then(function(r){ if(!r.ok) throw new Error("cg"); return r.json(); })
        .then(function(j){ if(!okFn(j)) throw new Error("cg"); return j; }).catch(viaRelay);
    }
    // Places de cotation lisibles (pour choisir la même que sa banque)
    var EXCH={ NYQ:"New York · $", NYS:"New York · $", NMS:"Nasdaq · $", NGM:"Nasdaq · $", NCM:"Nasdaq · $", ASE:"New York · $", PCX:"New York · $", BTS:"États-Unis · $", OQB:"États-Unis · $", PNK:"Hors cote · $",
      PAR:"Paris · €", ENX:"Euronext · €", AMS:"Amsterdam · €", BRU:"Bruxelles · €", LIS:"Lisbonne · €", MIL:"Milan · €", MCE:"Madrid · €", FRA:"Francfort · €", GER:"Xetra · €", BER:"Berlin · €", STU:"Stuttgart · €",
      MUN:"Munich · €", DUS:"Düsseldorf · €", HAM:"Hambourg · €", HAN:"Hanovre · €", VIE:"Vienne · €", HEL:"Helsinki · €", IRL:"Dublin · €", LSE:"Londres · £", EBS:"Suisse · CHF", SWX:"Suisse · CHF", TOR:"Toronto · $ CA", TSX:"Toronto · $ CA" };
    function exchLabel(x){ return EXCH[x] || x || ""; }
    function searchAssets(q){
      var cgP=cgGet("/search?query="+encodeURIComponent(q), "/crypto/search?q="+encodeURIComponent(q), function(j){ return j && Array.isArray(j.coins); })
        .then(function(j){ return ((j&&j.coins)||[]).slice(0,6).map(function(c){ return { type:"crypto", src:"cg", ref:c.id, sym:String(c.symbol||"").toUpperCase(), nom:c.name, thumb:c.thumb||"", info:"Crypto"+(c.market_cap_rank?" · n°"+c.market_cap_rank:"") }; }); })
        .catch(function(){ return null; });
      var api=coursApi();
      var yfP=api ? fetch(api+"/search?q="+encodeURIComponent(q)).then(function(r){ return r.json(); })
        .then(function(j){ return ((j&&j.results)||[]).slice(0,10).map(function(x){ return { type:"action", src:"yf", ref:x.symbol, sym:x.symbol, nom:x.name, info:[exchLabel(x.exch), x.type].filter(Boolean).join(" · ") }; }); })
        .catch(function(){ return null; }) : Promise.resolve("off");
      return Promise.all([cgP, yfP]);
    }
    function posIcon(p){ return '<span class="pos-ic">'+(p.thumb?'<img src="'+esc(p.thumb)+'" alt="" loading="lazy">':esc(String(p.sym||"?").replace(/\..*$/,"").slice(0,4)))+'</span>'; }
    function openPositionSearch(){
      var s=uiSheet('<div class="sheet-title">Ajouter une position</div>'+
        '<input class="f" id="psq" placeholder="Nom ou symbole : bitcoin, apple, LVMH…" autocomplete="off" autocapitalize="off" spellcheck="false">'+
        '<div class="psr" id="psr"><div class="psr-m">Tape au moins 2 lettres.</div></div>'+
        '<div class="ui-actions"><button type="button" class="btn ghost ui-cancel">Annuler</button></div>');
      s.q(".ui-cancel").onclick=s.close;
      var inp=s.q("#psq"), box=s.q("#psr"), timer=null, seq=0, items=[];
      function draw(res){
        var cr=res[0], ac=res[1], h="";
        items=[];
        function sect(title, list, msg){
          h+='<h4>'+title+'</h4>';
          if(list===null){ h+='<div class="psr-m">Recherche indisponible (connexion ?).</div>'; return; }
          if(list==="off"){ h+='<div class="psr-m">'+msg+'</div>'; return; }
          if(!list.length){ h+='<div class="psr-m">Aucun résultat.</div>'; return; }
          list.forEach(function(it){ items.push(it); h+='<button type="button" data-i="'+(items.length-1)+'">'+posIcon(it)+'<span><b>'+esc(it.nom)+'</b> <span style="color:var(--muted)">'+esc(it.sym)+'</span><small>'+esc(it.info||"")+'</small></span></button>'; });
        }
        sect("Cryptos", cr);
        sect("Actions & ETF", ac, "Bientôt disponible.");
        var qv=inp.value.trim();
        items.push({ type:"manuel", src:"man", nom:qv, sym:manSym(qv) });
        h+='<h4>Autre placement</h4><button type="button" data-i="'+(items.length-1)+'"><span class="pos-ic">✎</span><span><b>Ajouter « '+esc(qv)+' » à la main</b><small>Copie de trader, fonds, SCPI… Tu indiques le montant investi et la valeur.</small></span></button>';
        box.innerHTML=h;
        [].forEach.call(box.querySelectorAll("button[data-i]"), function(b){ b.onclick=function(){ var it=items[+b.getAttribute("data-i")]; s.close(); positionForm(it, null); }; });
      }
      inp.oninput=function(){
        clearTimeout(timer); var q=inp.value.trim();
        if(q.length<2){ box.innerHTML='<div class="psr-m">Tape au moins 2 lettres.</div>'; return; }
        box.innerHTML='<div class="psr-m">Recherche…</div>';
        timer=setTimeout(function(){ var my=++seq; searchAssets(q).then(function(res){ if(my===seq) draw(res); }); }, 350);
      };
      setTimeout(function(){ try{ inp.focus(); }catch(e){} }, 60);
    }
    function manSym(n){ var w=String(n||"").replace(/[^A-Za-zÀ-ÿ0-9 ]+/g," ").trim().split(/\s+/).filter(Boolean); return ((w[0]||"?").charAt(0)+(w[1]?w[1].charAt(0):(w[0]||"").charAt(1))).toUpperCase(); }
    // Ligne saisie à la main (copie de trader, fonds…) : montant investi + valeur actuelle
    function manualForm(it, existing){
      var accOpts=bourse.filter(bOpen).map(function(c){ return { v:String(c.id), l:c.nom }; }).concat([{ v:"__new", l:"Nouveau compte…" }]);
      var withPos=bourse.filter(function(c){ return bOpen(c) && c.positions && c.positions.length; });
      var curAcc=existing?existing.acc:(withPos.length?String(withPos[withPos.length-1].id):"__new");
      var p0=existing?existing.p:{};
      uiForm({ title:existing?"Modifier · "+p0.nom:"Placement saisi à la main", fields:[
        { key:"nom", label:"Nom", value:(existing?p0.nom:it.nom), required:true, placeholder:"Copie Altia, fonds…" },
        { key:"investi", label:"Montant investi", type:"money", value:(existing&&p0.investi?p0.investi:""), help:"Ce que tu y as mis. Sert à calculer la plus-value." },
        { key:"valeur", label:"Valeur actuelle", type:"money", value:(existing?p0.valeur:""), required:true, help:"Mets-la à jour quand tu veux avec ✎ sur la ligne."+(existing&&p0.maj?" Dernière mise à jour : "+new Date(p0.maj).toLocaleDateString("fr-FR")+".":"") },
        { key:"acc", label:"Compte", type:"select", value:curAcc, options:accOpts, help:"La valeur de ce compte devient la somme de ses lignes.", onChange:function(v,api){ api.show("accNew", v==="__new"); } },
        { key:"accNew", label:"Nom du nouveau compte", hidden:(curAcc!=="__new"), value:"eToro", placeholder:"eToro, assurance vie…" }
      ], ok:(existing?"Enregistrer":"Ajouter"), focus:!existing }, function(r){
        if(r.valeur===null || isNaN(r.valeur) || r.valeur<0) return "Indique la valeur actuelle.";
        var acc;
        if(r.acc==="__new"){ var nm=(r.accNew||"").trim()||"Mon portefeuille", nv={}; nv[monthKey(todayISO())]={ capital:0, valeur:0 }; acc={ id:Date.now(), nom:nm, vals:nv }; bourse.push(acc); }
        else acc=bourse.filter(function(c){ return String(c.id)===String(r.acc); })[0];
        if(!acc) return "Choisis un compte.";
        var p=existing?existing.p:{ id:Date.now()+1, type:"manuel", src:"man", ref:"" };
        p.nom=r.nom; p.sym=manSym(r.nom); p.valeur=r.valeur; p.maj=new Date().toISOString(); p.qte=1;
        if(r.investi>0) p.investi=r.investi; else delete p.investi;
        if(existing && String(existing.acc)!==String(acc.id)){ var old=bourse.filter(function(c){ return String(c.id)===String(existing.acc); })[0]; if(old) old.positions=(old.positions||[]).filter(function(x){ return x!==p; }); }
        if(!acc.positions) acc.positions=[];
        if(acc.positions.indexOf(p)<0) acc.positions.push(p);
        persistBourse(); applyPositions(); syncBourseEpargne(); render();
      });
    }
    function quickValue(p){
      uiForm({ title:p.nom, fields:[
        { key:"valeur", label:"Valeur actuelle", type:"money", value:p.valeur, required:true,
          help:(p.investi>0?"Investi : "+fmt(p.investi)+". ":"")+(p.maj?"Dernière mise à jour : "+new Date(p.maj).toLocaleDateString("fr-FR")+".":"") }
      ], ok:"Enregistrer" }, function(r){
        if(r.valeur===null || isNaN(r.valeur) || r.valeur<0) return "Indique la valeur actuelle.";
        p.valeur=r.valeur; p.maj=new Date().toISOString();
        persistBourse(); applyPositions(); syncBourseEpargne(); render();
      });
    }
    function positionForm(it, existing){
      if(it && it.src==="man") return manualForm(it, existing);
      var accOpts=bourse.filter(bOpen).map(function(c){ return { v:String(c.id), l:c.nom }; }).concat([{ v:"__new", l:"Nouveau compte…" }]);
      var withPos=bourse.filter(function(c){ return c.positions && c.positions.length; });
      var curAcc=existing?existing.acc:(withPos.length?String(withPos[withPos.length-1].id):"__new");
      var invPre=(existing&&existing.p.pru>0)?Math.round(existing.p.pru*existing.p.qte*100)/100:"";
      var cur0=(existing&&existing.p.pruCur)||BASE, sym0=curSym(cur0);
      uiForm({ title:(existing?"Modifier · ":"")+it.nom+" ("+it.sym+")", fields:[
        { key:"qte", label:(it.type==="crypto"?"Quantité détenue":"Nombre d'actions"), type:"qty", value:(existing?String(existing.p.qte).replace(".",","):""), required:true, placeholder:"ex. 3,1" },
        { key:"cur", label:"Devise du prix d'achat", type:"seg", value:cur0, options:curOpts(cur0), help:"Prends celle affichée par ton courtier (sur eToro, le prix après « @ » est en $).", onChange:function(v,api){ var sy=curSym(v); api.suffix("pru",sy); api.suffix("inv",sy); } },
        { key:"pru", label:"Prix d'achat moyen (optionnel)", type:"money", suffix:sym0, value:(existing&&existing.p.pru?existing.p.pru:""), help:"Par "+(it.type==="crypto"?"unité":"action")+". Sert à calculer la plus-value." },
        { key:"inv", label:"… ou montant investi total", type:"money", suffix:sym0, value:invPre, help:"Ce que tu as payé au total : le prix moyen se calcule tout seul." },
        { key:"acc", label:"Compte", type:"select", value:curAcc, options:accOpts, help:"La valeur de ce compte sera calculée automatiquement à partir de ses positions.", onChange:function(v,api){ api.show("accNew", v==="__new"); } },
        { key:"accNew", label:"Nom du nouveau compte", hidden:(curAcc!=="__new"), value:(it.type==="crypto"?"Mes cryptos":"Mes actions"), placeholder:"Boursorama, Binance, PEA…" }
      ], ok:(existing?"Enregistrer":"Ajouter") }, function(r){
        if(!(r.qte>0)) return "Indique une quantité supérieure à 0.";
        var acc;
        if(r.acc==="__new"){ var nm=(r.accNew||"").trim()||"Mon portefeuille", nv={}; nv[monthKey(todayISO())]={ capital:0, valeur:0 }; acc={ id:Date.now(), nom:nm, vals:nv }; bourse.push(acc); }
        else acc=bourse.filter(function(c){ return String(c.id)===String(r.acc); })[0];
        if(!acc) return "Choisis un compte.";
        var p=existing?existing.p:{ id:Date.now()+1, type:it.type, src:it.src, ref:it.ref, sym:it.sym, nom:it.nom, thumb:it.thumb||"" };
        p.qte=r.qte;
        var invChanged=(r.inv>0) && (invPre==="" || Math.abs(r.inv-invPre)>0.005);
        if(invChanged) p.pru=r.inv/r.qte; else if(r.pru>0) p.pru=r.pru; else delete p.pru;
        if(r.cur && r.cur!==BASE && p.pru>0) p.pruCur=r.cur; else delete p.pruCur;
        if(existing && String(existing.acc)!==String(acc.id)){ var old=bourse.filter(function(c){ return String(c.id)===String(existing.acc); })[0]; if(old) old.positions=(old.positions||[]).filter(function(x){ return x!==p; }); }
        if(!acc.positions) acc.positions=[];
        if(acc.positions.indexOf(p)<0) acc.positions.push(p);
        persistBourse(); applyPositions(); render(); refreshPositions(true);
      });
    }
    function findPosition(accId, posId){
      var c=bourse.filter(function(x){ return String(x.id)===String(accId); })[0]; if(!c) return null;
      var p=(c.positions||[]).filter(function(x){ return String(x.id)===String(posId); })[0];
      return p?{ c:c, p:p, acc:String(c.id) }:null;
    }
    // eToro retiré : efface toute ancienne configuration (clés, adresse du relais, secret)
    try{ ["etoroKeys","etoroSession","etoroPending","etoroWorkerUrl","etoroAppSecret","etoroCorrectionFactor"].forEach(function(k){ store.remove(k); }); }catch(e){}

    function positionsHTML(c){
      if(!c.positions || !c.positions.length) return "";
      var h='<div class="poslist">';
      c.positions.forEach(function(p){
        var px=pxCache[posKey(p)], pr=posPrice(p), v=posValue(p);
        var qtxt=String(Math.round((Number(p.qte)||0)*1e8)/1e8).replace(".",",");
        var man=(p.src==="man");
        var left=man ? ((p.investi>0?"Investi "+fmtK(p.investi):"Saisie manuelle")+(p.maj?" · "+new Date(p.maj).toLocaleDateString("fr-FR",{day:"numeric",month:"short"}):""))
                     : qtxt+(pr!==null?" × "+fmtK(pr):" "+esc(String(p.sym).replace(/\..*$/,"")));
        var pv=man ? (p.investi>0?v-p.investi:null) : ((v!==null && costBase(p)!==null)?v-costBase(p):null), right=[];
        if(man && p.investi>0) right.push('<span style="color:'+(pv>=0?"var(--accent)":"var(--coral)")+'">'+(pv>=0?"+":"")+(pv/p.investi*100).toFixed(1).replace(".",",")+' %</span>');
        if(px && px.chg!=null) right.push('<span style="color:'+(px.chg>=0?"var(--accent)":"var(--coral)")+'">'+(px.chg>=0?"▲ +":"▼ ")+px.chg.toFixed(2).replace(".",",")+' %</span>');
        if(pv!==null) right.push('<span style="color:'+(pv>=0?"var(--accent)":"var(--coral)")+'">'+signK(pv)+'</span>');
        if(p.src==="yf" && !coursApi()) right.push('<span style="color:var(--muted)">cours bientôt</span>');
        h+='<div class="pos prow'+(man?' pos-man':'')+'" data-a="'+esc(c.id)+'" data-p="'+esc(p.id)+'">'+posIcon(p)+
           '<div class="pbody"><div class="pl1"><span class="pname"><b>'+esc(p.nom)+'</b></span><span class="pv">'+(v!==null?fmtK(v):'<span style="color:var(--muted);font-weight:500">…</span>')+'</span></div>'+
           '<div class="pl2"><span>'+left+'</span><span>'+right.join(' · ')+'</span></div></div>'+
           (man?'<button class="btn posval" type="button" aria-label="Mettre à jour la valeur" data-a="'+esc(c.id)+'" data-p="'+esc(p.id)+'">✎'+esc(curSym())+'</button>':'')+
           '<button class="btn ghost posedit" type="button" data-a="'+esc(c.id)+'" data-p="'+esc(p.id)+'">✎</button>'+
           '<button class="btn ghost posdel" type="button" data-a="'+esc(c.id)+'" data-p="'+esc(p.id)+'">✕</button></div>';
      });
      return h+'</div>';
    }

