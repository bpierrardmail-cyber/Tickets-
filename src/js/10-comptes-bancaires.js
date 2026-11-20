    // ---------- Comptes bancaires ----------
    // Chaque compte a une clé : virements, liquide et solde reporté y sont rattachés. Le compte d'origine garde la clé « Benoit » : aucune donnée ne bouge.
    var comptes = store.read("comptes", null);
    if(!comptes || !comptes.length){
      // Données d'avant les comptes multiples : le titulaire est le prénom déjà utilisé (virements, liquide, tickets)
      var oldOwner=(function(){ var c={}, best="", bn=0;
        function add(w, k){ w=(w||"").trim(); if(w && w!=="Commun"){ c[w]=(c[w]||0)+k; if(c[w]>bn){ bn=c[w]; best=w; } } }
        virements.forEach(function(v){ add(v.person, 3); });
        Object.keys(liquideMois||{}).forEach(function(k){ add(k, 3); }); Object.keys(store.read("soldeInit", {})||{}).forEach(function(k){ add(k, 3); });
        (store.read("entries", [])||[]).forEach(function(e){ add(e.payePar, 1); });
        return best; })();
      if(oldOwner) comptes=[{ key:oldOwner, nom:"Compte courant", payer:oldOwner, main:true }];
      // Première ouverture : un compte sans prénom, que l'appli demande tout de suite (voir askFirstName)
      else { comptes=[{ key:"principal", nom:"Compte courant", payer:"", main:true }]; store.write("askName", true); }
      store.write("comptes", comptes);
    }
    function persistComptes(){ store.write("comptes", comptes); }
    function acctByKey(k){ for(var i=0;i<comptes.length;i++){ if(comptes[i].key===k) return comptes[i]; } return null; }
    // Personnes gérées dans le menu : ajoutées à la main, ou « supprimées » (archivées) sans toucher à l'historique
    var personnes = store.read("personnes", []);   // [{ nom, archived:"AAAA-MM" }]
    function persistPersonnes(){ store.write("personnes", personnes); }
    function personRec(n){ return personnes.filter(function(x){ return x.nom===n; })[0]||null; }
    function isArchived(n){ var r=personRec(n); return !!(r && r.archived); }
    // Parts du commun en % : { prénom: 50, … } (seules les parts > 0). null = parts égales entre les personnes du commun.
    var communParts = store.read("communParts", null);
    var commRemb = store.read("commRemb", []);
    var groupes = store.read("groupes", []);   // groupes ponctuels : {id, nom, membres:[prénoms], dep:[{id, date, label, montant, payePar, ticketId?}], rembs:[…comme commRemb], clos?}
    function persistGroupes(){ store.write("groupes", groupes); }   // remboursements du commun : {id, month, from, to, montant, date, vir:[ids des virements créés]}
    function persistRemb(){ store.write("commRemb", commRemb); }
    function persistParts(){ store.write("communParts", communParts); }
    function mePerson(){ if(fyCfg && fyCfg.role!=="owner" && fyCfg.me) return fyCfg.me; var a=mainAcct(); return (a && a.payer) || "Moi"; }
    // À qui est une épargne ou une provision : un prénom, « Commun » (tout le foyer), ou rien = toi (anciennes données)
    function ownerOf(x){ var o=((x && x.owner)||"").trim(); return o || mePerson(); }
    function ownerField(cur){
      var me=mePerson(), others=uniquePersons().filter(function(p){ return p!==me; });
      if(!others.length && !(cur && cur!==me)) return [];   // personne seule : pas de question
      var o=[{ v:"", l:me+" (toi)" }].concat(others.map(function(p){ return { v:p, l:p }; }));
      if(cur && cur!==me && cur!=="Commun" && others.indexOf(cur)<0) o.push({ v:cur, l:cur });
      o.push({ v:"Commun", l:"Commun (tout le foyer)" });
      return [{ key:"owner", label:"À qui ?", type:"select", value:(cur && cur!==me ? cur : ""), options:o }];
    }
    function setOwner(x, r){ if(!r || !("owner" in r) || r.owner===null) return; var v=String(r.owner||"").trim(); if(!v || v===mePerson()) delete x.owner; else x.owner=v; }
    // Regroupe une liste par personne : toi d'abord, puis par ordre alphabétique, « Commun » à la fin
    function byOwner(list){
      var me=mePerson(), g={}, order=[];
      list.forEach(function(x){ var o=ownerOf(x); if(!g[o]){ g[o]=[]; order.push(o); } g[o].push(x); });
      order.sort(function(a,b){ if(a===me) return -1; if(b===me) return 1; if(a==="Commun") return 1; if(b==="Commun") return -1; return a.localeCompare(b,"fr"); });
      return order.map(function(o){ return { owner:o, label:(o===me?o+" · toi":o), items:g[o] }; });
    }
    // « Moi » sur l'Accueil : ce qui est à toi et ce qui est en commun
    function isMine(x){ var o=ownerOf(x); return o===mePerson() || o==="Commun"; }
