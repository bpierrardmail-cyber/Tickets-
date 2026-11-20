    // ---------- Mode démo ----------
    // Un foyer inventé (Alex, Marie, Léa, Tom) sur les 6 derniers mois, recalculé à partir d'aujourd'hui ; tout est permis dedans.
    // Les données de la démo sont rangées à part (SK : « demo:… ») ; ni relais, ni Drive, ni rappels, ni widgets (voir DEMO plus haut).
    // Entrer : demoStart (accueil, Réglages) ou le lien « ?demo » ; sortir : la pastille « 🎭 Démo · Quitter » ou Réglages.
    function demoClear(){   // efface l'espace démo (clés « demo:… ») : seul endroit qui parcourt localStorage directement
      try{ var L=[]; for(var i=0;i<localStorage.length;i++){ var k=localStorage.key(i); if(k && k.indexOf("demo:")===0) L.push(k); } L.forEach(function(k){ localStorage.removeItem(k); }); }catch(e){}
      var ch=false; Object.keys(KVONLY).forEach(function(k){ if(k.indexOf("demo:")===0){ delete KVONLY[k]; kvPut(k, null); ch=true; } }); if(ch) kvOnlySave();
    }
    function demoEnsure(){
      var made=store.read("demoMade", null), today=new Date().toISOString().slice(0,10);
      if(made && (!/[?&]demo(=|&|$)/.test(location.search) || made===today)) return;   // lien web : l'exemple repart chaque jour
      demoClear(); demoSeed(); store.write("demoMade", today);
    }
    function demoStart(){
      uiChoice("Mode démo 🎭", esc("Un foyer inventé (Alex, Marie et leurs deux enfants) pour tout essayer : scanner, saisir, modifier, supprimer. Tes vraies données restent de côté, sans être touchées, et reviennent telles quelles en quittant la démo. Rien n'est envoyé pendant la démo."), [
        { l:"Entrer dans la démo", fn:function(){ try{ demoClear(); localStorage.setItem("__demo", "1"); }catch(e){} location.reload(); } } ]);
    }
    function demoQuit(){
      var ids=(store.read("entries", [])||[]).map(function(e){ return e.id; }).concat((store.read("corbeille", [])||[]).map(function(x){ return x.e && x.e.id; }));
      var ch=Promise.resolve();   // photos prises pendant la démo : retirées
      ids.forEach(function(id){ if(id!=null && Number(id)>=1e12 && PHOTOS[String(id)]) ch=ch.then(function(){ return Promise.all([idbDel(id), origDel(id)]).catch(function(){}); }); });
      ch.then(function(){
        demoClear(); try{ localStorage.removeItem("__demo"); }catch(e){}
        if(/[?&]demo(=|&|$)/.test(location.search)) location.href=location.pathname; else location.reload();
      });
    }
    function demoMenu(){
      var free=!!store.read("demoFree", false);
      uiChoice("Mode démo 🎭", esc("Un foyer inventé : essaie tout ce que tu veux. "+(free ? "Tu vois la version gratuite : les ✦ proposent "+APP_NAME+" Plus." : ""+APP_NAME+" Plus est débloqué : les ✦ montrent ce qui est payant.")), [
        { l:"Quitter la démo", fn:demoQuit },
        { l:free ? "Voir la version complète (Plus)" : "Voir la version gratuite", primary:false, fn:function(){ store.write("demoFree", !free); render(); uiToast(free ? "Version complète ✦" : "Version gratuite"); } },
        { l:"Repartir de l'exemple", primary:false, fn:function(){ demoClear(); location.reload(); } } ]);
    }
    function demoSeed(){
      var now=new Date(), Y=now.getFullYear(), MO=now.getMonth(), D=now.getDate(), seed=11;
      function p2(n){ return (n<10?"0":"")+n; }
      function ym(o){ var d=new Date(Y, MO+o, 1); return d.getFullYear()+"-"+p2(d.getMonth()+1); }
      function dim(o){ return new Date(Y, MO+o+1, 0).getDate(); }
      function day(o, d){ d=Math.min(d, dim(o)); if(o>0 || (o===0 && d>D)) return null; return ym(o)+"-"+p2(d); }
      function rnd(){ seed=(seed*16807)%2147483647; return (seed-1)/2147483646; }
      function r2(x){ return Math.round(x*100)/100; }
      function b64(n){ var a=new Uint8Array(n); try{ crypto.getRandomValues(a); }catch(e){ for(var i=0;i<n;i++) a[i]=Math.floor(Math.random()*256); } var t=""; for(var j=0;j<n;j++) t+=String.fromCharCode(a[j]); return btoa(t).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,""); }
      var nid=800000000000; function id(){ return ++nid; }
      var E=[], k, o;
      function T(o, d, mag, cat, who, amt, arts, extra){
        var dt=day(o, d); if(!dt) return null;
        arts=arts||[]; if(amt==null){ amt=0; arts.forEach(function(a){ amt+=a.prix; }); }
        var e={ id:id(), date:dt, marchand:mag, montant:r2(amt), categorie:cat, payePar:who, articles:arts };
        if(extra) for(var x in extra) e[x]=extra[x];
        E.push(e); return e;
      }
      function A(label, prix, produit, commun){ var a={ label:label, prix:r2(prix), produit:produit }; if(commun) a.commun=true; return a; }
      // courses : les prix montent un peu chaque mois (Dépenses › Produits › Hausses)
      var BASKET=[["Lait demi-écrémé 1 L",0.99,0.02,"Lait"],["Café moulu 250 g",3.89,0.09,"Café"],["Pâtes 500 g",1.15,0.03,"Pâtes"],["Riz basmati 1 kg",2.45,0.04,"Riz"],
        ["Emmental râpé",2.35,0.05,"Fromage"],["Yaourts nature x8",2.10,0.02,"Yaourts"],["Poulet fermier",9.80,0.22,"Viande",1],["Pommes 1 kg",2.49,0.03,"Fruits"],
        ["Tomates grappe",2.99,0.06,"Tomates"],["Œufs x12",3.20,0.07,"Œufs"],["Courgettes",1.89,0.02,"Légumes"],["Lessive liquide",9.26,0.10,"Lessive",1],
        ["Éponges x3",1.60,0,"Éponges",1],["Nettoyant sol",3.15,0.03,"Produits ménagers",1],["Pain de mie",1.85,0.03,"Pain"]];
      for(o=-5;o<=0;o++){
        k=o+5;
        [3,10,17,24].forEach(function(d, v){
          var arts=[]; BASKET.forEach(function(b, i){ if((i+v+k)%3!==1 || i<3) arts.push(A(b[0], b[1]+b[2]*k, b[3], b[4])); });
          if(v===2) arts.push(A("Remise fidélité", -1.5, "Remise"));
          T(o, d, v===1 ? "Carrefour Market" : "Intermarché", "Alimentation", v===3 ? "Marie" : "Alex", null, arts);
        });
        [6,14,21,28].forEach(function(d){ T(o, d, "Boulangerie Le Fournil", "Alimentation", "Marie", null, [A("Baguette tradition", 1.30, "Pain"), A("Croissants x4", 4.40+0.1*k, "Pain")]); });
        T(o, 9, "Station Total", "Carburant", "Alex", 58+rnd()*18); T(o, 23, "Station Total", "Carburant", "Marie", 48+rnd()*15);
        T(o, 13, "Pharmacie du Centre", "Santé", "Marie", 9+rnd()*28);
        T(o, 19, "Cinéma Le Palace", "Loisirs", "Alex", 34.5);
        T(o, 11, "Librairie Page 3", "Loisirs", "Marie", 12+rnd()*16, null, { share:{ Marie:100 } });
        if(k%2===0) T(o, 27, "Décathlon", "Loisirs", "Marie", null, [A("Chaussures de foot (Tom)", 39.99, "Vêtements"), A("Gourde", 7.99, "Loisirs")]);
        T(o, 16, "Pizzeria du Port", "Restaurant", "Alex", null, [A("Pizza 4 fromages", 13.5, "Restaurant & bar", 1), A("Pizza reine", 12.5, "Restaurant & bar", 1), A("Menu enfant x2", 17, "Restaurant & bar", 1), A("Boissons", 11.5+k*0.2, "Boissons", 1)]);
        if(k===1 || k===4) T(o, 25, "Leroy Merlin", "Maison", "Alex", null, [A("Peinture blanche 2,5 L", 32.9, "Bricolage & outillage"), A("Rouleau + bac", 11.9, "Bricolage & outillage"), A("Ampoules LED x3", 8.5, "Entretien & maison")]);
        T(o, 8, "Amazon", "Autre", "Marie", 18+rnd()*40);
        if(k===3) T(o, 20, "Restaurant Le Lavoir", "Restaurant", "Marie", 64, null, { share:{ Alex:50, Marie:50 } });
      }
      var curM=ym(0), F=[], fid=810;
      function FR(label, montant, personne, jour, x){
        var f={ id:++fid, label:label, montant:montant, personne:personne, recurrent:true, startMonth:ym(-11), jour:jour, doneMonths:{} };
        for(var o=-11;o<=0;o++) if(o<0 || jour<=D) f.doneMonths[ym(o)]=true;
        if(x) for(var y in x) f[y]=x[y];
        F.push(f); return f;
      }
      FR("Loyer", 950, "Commun", 5, { split:true }); FR("Assurance habitation", 27.5, "Commun", 8); FR("Internet · Box Fictive", 29.99, "Commun", 20);
      FR("Cantine", 86, "Commun", 10, { compte:"marie" }); FR("Streaming", 13.49, "Commun", 3, { split:true });
      FR("Téléphone", 15.99, "Alex", 27); FR("Téléphone", 12.99, "Marie", 27, { compte:"marie" });
      FR("Crédit auto", 189, "Alex", 15, { endMonth:ym(14) }); FR("Assurance auto", 46, "Alex", 2);
      F.push({ id:++fid, label:"Contrôle technique", montant:78, personne:"Alex", recurrent:false, month:ym(2), jour:12, doneMonths:{} });
      // virements : salaires, épargne ; les mois à venir par des virements « chaque mois »
      var V=[], vid=830;
      function VI(o, person, label, montant, d){ var dd=Math.min(d, dim(o)); V.push({ id:++vid, person:person, month:ym(o), label:label, note:"", montant:montant, day:dd, done:(o<0 || dd<=D) }); }
      for(o=-5;o<=0;o++){ VI(o, "Alex", "Salaire", 1980, 1); VI(o, "marie", "Salaire", 1750, 1); VI(o, "Alex", "Vers Livret A", -150, 6); VI(o, "marie", "Vers LDDS", -80, 7); }
      var VR=[{ id:840, person:"Alex", label:"Salaire", note:"", montant:1980, day:1, from:ym(1), made:[] }, { id:841, person:"marie", label:"Salaire", note:"", montant:1750, day:1, from:ym(1), made:[] }];
      // épargne : livrets qui grossissent, un objectif
      function vals(start, step){ var v={}; for(var o=-5;o<=0;o++) v[ym(o)]=r2(start+step*(o+5)); return v; }
      var EP=[{ id:801, nom:"Livret A", vals:vals(3600, 150) }, { id:802, nom:"LDDS", owner:"Marie", vals:vals(2100, 80) },
        { id:803, nom:"Vacances d'été", vals:vals(400, 120), objectif:{ montant:2000, mois:ym(8) } }, { id:804, nom:"Livret de Léa", owner:"Léa", vals:vals(640, 20) }];
      var PR=[{ id:820, nom:"Taxe foncière", mensuel:80, soldeInitial:400, startMonth:ym(-5), prelevements:[], echeance:10, prevu:960, ou:"ep:801" },
        { id:821, nom:"Cadeaux de Noël", mensuel:40, soldeInitial:120, startMonth:ym(-5), prelevements:[], echeance:12, prevu:450, ou:"ep:801" },
        { id:822, nom:"Entretien voiture", mensuel:35, soldeInitial:150, startMonth:ym(-5), prelevements:[{ id:823, month:ym(-2), montant:180, label:"Révision" }], ou:"ep:801" }];
      // factures : électricité tous les 2 mois (avec la consommation), eau tous les 3 mois, la box chaque mois
      var FA=[], faid=860, SAIS=[1.35,1.25,1.0,0.8,0.7,0.65,0.7,0.8,0.95,1.1,1.25,1.4];
      for(o=-12;o<=0;o++){
        var dd=day(o, 14); if(!dd) continue; var mm=+dd.slice(5,7)-1;
        if((o+12)%2===0){ var kwh=Math.round(620*SAIS[mm]); FA.push({ id:++faid, four:"Énergie Fictive", type:"elec", date:dd, montant:r2(48+kwh*0.2016), prelev:dd, src:"pdf", conso:kwh, du:ym(o-2)+"-14", au:dd }); }
        if((o+12)%3===0){ var m3=Math.round(24+rnd()*6); FA.push({ id:++faid, four:"Eau du Bocage", type:"eau", date:dd, montant:r2(18+m3*4.35), prelev:dd, src:"pdf", conso:m3 }); }
        if(o>=-5) FA.push({ id:++faid, four:"Box Fictive", type:"net", date:ym(o)+"-02", montant:29.99, prelev:ym(o)+"-20", src:"pdf" });
      }
      var G=[{ id:850, nom:"Week-end à la mer", membres:["Alex","Marie","Julie","Paul"], dep:[
          { id:851, date:day(-1, 12), label:"Location de la maison", montant:320, payePar:"Alex" }, { id:852, date:day(-1, 12), label:"Courses", montant:86.4, payePar:"Julie" },
          { id:853, date:day(-1, 13), label:"Restaurant", montant:142, payePar:"Paul" }, { id:854, date:day(-1, 14), label:"Essence", montant:64, payePar:"Marie", pour:["Alex","Marie"] }], rembs:[] }];
      var deleted={ id:id(), date:day(-1, 15) || day(0, 1), marchand:"Kiosque", montant:6.2, categorie:"Loisirs", payePar:"Alex", articles:[] };
      var K=b64(32), mem=function(name, role, tabs, ed, accts, tk){ return { name:name, role:role, tabs:tabs, ed:ed, accts:accts, tk:tk, km:b64(32) }; };
      var ALL=["list","articles","analyse","compte","factures","communes"];
      var data={
        askName:false, devise:"EUR", welcomeSeen:true, welcomeFy:true, curAsked:true, lastBackup:now.toISOString(), taxoV2:2, virEpV2:1,
        personnes:[{ nom:"Marie" }, { nom:"Léa" }, { nom:"Tom" }],
        comptes:[{ key:"Alex", nom:"Compte courant", payer:"Alex", main:true }, { key:"marie", nom:"Compte de Marie", payer:"Marie" }],
        communParts:{ Alex:50, Marie:50 }, soldeInit:{ Alex:{}, marie:{} },
        entries:E, fraisCommuns:F, virements:V, virRec:VR, epargne:EP, provisions:PR, factures:FA, groupes:G,
        budgets:{ Alimentation:620, Loisirs:80, Restaurant:90, Carburant:150, "Santé":45 }, budgetsP:{ Marie:{ Loisirs:40 } },
        commRemb:[{ id:870, month:ym(-1), from:"Marie", to:"Alex", montant:45, date:day(-1, 28) }], commBalFrom:ym(-3),
        corbeille:[{ e:deleted, at:now.toISOString(), ph:"" }],
        fyCfg:{ role:"owner", fid:"F_DEMO", tok:"demo", key:K, sec:K, lastOk:Date.now(), factMig:1, members:{
          m1:mem("Marie", "edit", ALL, ["list","articles","compte","factures","communes"], null, "all"),
          m2:mem("Léa", "view", ["list","communes"], [], [], "own") },
          srv:{ m1:{ joined:Date.now()-40*86400000, seen:Date.now()-600000 }, m2:{ joined:Date.now()-20*86400000, seen:Date.now()-5400000 } } }
      };
      data.soldeInit.Alex[ym(-5)]=640; data.soldeInit.marie[ym(-5)]=910;
      for(var key in data) store.write(key, data[key]);
    }
