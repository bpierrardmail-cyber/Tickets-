    // ---------- Foyer partagé (Tickets Plus dans la version Store) ----------
    // Le téléphone qui crée le foyer (« propriétaire ») garde toutes les données. Pour chaque membre, il dépose sur le relais
    // une copie chiffrée avec la clé de ce membre (AES-GCM), limitée aux onglets et comptes choisis : le relais ne lit rien.
    //  - consultation : le membre lit sa copie, ne peut rien modifier (un enfant qui suit son compte) ;
    //  - modification : ses changements partent, chiffrés, dans la boîte du foyer ; le propriétaire les fusionne fiche par
    //    fiche (la modification la plus récente gagne) puis met à jour les copies de tout le monde.
    // Retirer un membre efface son accès et sa copie : sa clé ne sert plus à rien. Code + empreinte conseillés partout (choisis par chaque téléphone).
    // Le propriétaire garde aussi une copie de secours, que seul son code de secours permet d'ouvrir (nouveau téléphone).
    function fyApiBase(){ return (store.read("foyerApi","")||COURS_API||"").replace(/\/+$/,""); }
    var FY_KEYS={ entries:"id", virements:"id", fraisCommuns:"id", epargne:"id", provisions:"id", factures:"id", bourse:"id", comptes:"key", personnes:"nom",
      argentMois:2, liquideMois:2, soldeInit:2, budgets:1, budgetsP:2, appris:1, familleDe:1, catParent:1, communParts:0, commRemb:"id", groupes:"id", cats:0, familles:0, produits:0, devise:0 };
    var FY_OWNER_ONLY={ bourse:1 };   // la Bourse se gère depuis le téléphone du propriétaire (cours mis à jour en continu)
    var FY_TABS=[{v:"list",l:"Accueil"},{v:"articles",l:"Dépenses : produits"},{v:"analyse",l:"Dépenses : analyse"},{v:"compte",l:"Compte"},{v:"factures",l:"À venir"},{v:"communes",l:"Commun"}].concat(FEAT.bourse?[{v:"bourse",l:"Bourse"}]:[]);
    var FY_SUB={ menu:"list", gerer:"list", mkpage:"list", drive:"list", driverest:"list", tickets:"list", aide:"list", groupe:"communes", corbeille:"list", stockage:"list", import:"compte", avancee:"analyse", epargne:"compte", form:"list", gallery:"list", photo:"list", produits:"articles", artDetail:"articles", comptedet:"compte", patrimoine:"compte", provisions:"factures", factlue:"factures", factserie:"factures", provdet:"factures", month:"analyse", graph:"analyse", history:"analyse" };
    var FY_SEP="\u001f", FY_SKIP={};
    // chemin d'une fiche venue d'un autre téléphone : jamais __proto__ / constructor / prototype, au plus 3 morceaux (08/11, revue C1)
    var FY_BADP={ "__proto__":1, "constructor":1, "prototype":1 };
    function fyPathOk(p){ if(typeof p!=="string" || p.length>400) return false; var q=p.split(FY_SEP); if(q.length>3) return false; for(var i=0;i<q.length;i++) if(FY_BADP[q[i]]===1 && Object.prototype.hasOwnProperty.call(FY_BADP, q[i])) return false; return true; }
    function fyRole(){ return fyCfg ? fyCfg.role : null; }
    function fyMember(){ return !!fyCfg && fyCfg.role!=="owner"; }
    // Droits par onglet : m.ed = onglets en modification (absent : tous les onglets visibles si « edit », aucun si « view »)
    var FY_KEY_TAB={ entries:"list", cats:"articles", catParent:"articles", familles:"articles", produits:"articles", appris:"articles", familleDe:"articles", budgets:"articles", budgetsP:"articles",
      fraisCommuns:"communes", communParts:"communes", commRemb:"communes", groupes:"communes", comptes:"compte", virements:"compte", epargne:"compte", provisions:"factures", factures:"factures", soldeInit:"compte", liquideMois:"compte", argentMois:"compte", bourse:"bourse" };
    function fyEdTabs(m){ if(!m || m.role==="owner") return FY_TABS.map(function(t){ return t.v; }); if(m.role!=="edit") return [];
      if(Array.isArray(m.ed)) return m.ed; return m.tabs ? m.tabs.slice() : FY_TABS.map(function(t){ return t.v; }); }
    function fyTabEd(t){ return !fyMember() || fyEdTabs(fyCfg).indexOf(t)>=0; }   // ce téléphone peut-il modifier cet onglet ?
    function fyCurTab(){ var v=state.view; if(v==="factures" && avSub()==="frais") return "communes"; return FY_SUB[v]||v; }   // À venir › Frais fixes : droits de Commun
    // lecture seule : membre en consultation, ou onglet affiché en lecture
    function fyRO(){ if(!fyCfg || !fyMember()) return false; if(fyCfg.role==="view") return true; var t=fyCurTab(); if(t==="foyer" || t==="bilan") return false; return !fyTabEd(t==="form"?"list":t); }
    function fyTabOn(m, t){ return !m || !m.tabs || t==="list" || m.tabs.indexOf(t)>=0; }   // l'Accueil (personnel) est toujours là
    function fyFirstTab(){ var t=(fyCfg && fyCfg.tabs && fyCfg.tabs[0]) || "list"; return t; }
    function fyRoleLabel(r){ return r==="edit"?"Modification":(r==="view"?"Consultation":"Propriétaire"); }
    function fyRightsLabel(m){ if(!m || m.role==="owner") return "Propriétaire"; var vis=FY_TABS.filter(function(t){ return fyTabOn(m, t.v); }), ed=fyEdTabs(m);
      var w=vis.filter(function(t){ return ed.indexOf(t.v)>=0; }), r=vis.filter(function(t){ return ed.indexOf(t.v)<0; });
      if(!w.length) return "Lecture"+(r.length===FY_TABS.length?" · tous les onglets":" : "+r.map(function(t){ return t.l; }).join(", "));
      if(!r.length) return "Modification"+(w.length===FY_TABS.length?" · tous les onglets":" : "+w.map(function(t){ return t.l; }).join(", "));
      return "Modif. : "+w.map(function(t){ return t.l; }).join(", ")+" · lecture : "+r.map(function(t){ return t.l; }).join(", "); }
    function fyTabsLabel(m){ if(!m.tabs) return "tous les onglets"; var l=FY_TABS.filter(function(t){ return m.tabs.indexOf(t.v)>=0; }).map(function(t){ return t.l; }); return l.length===FY_TABS.length?"tous les onglets":(l.join(", ")||"aucun onglet"); }
    function fyAcctsLabel(m){ if(m.accts==null) return "tous les comptes"; if(!m.accts.length) return m.tk==="all" ? "tickets de tout le foyer, sans les comptes" : "ses tickets seulement"; var l=comptes.filter(function(a){ return m.accts.indexOf(a.key)>=0; }).map(function(a){ return a.nom; }); return (l.join(", ")||"aucun compte")+(m.tk==="all"?" · tickets de tout le foyer":""); }
    // Sur le téléphone d'un membre limité : il ne modifie que ses tickets (et ceux de ses comptes) ; les autres en lecture seule
    function fyCanEdit(e){
      if(!fyMember()) return true;
      if(fyCfg.role==="view" || !fyTabEd("list")) return false;   // les tickets se modifient avec l'onglet Accueil
      if(fyCfg.accts==null) return true;
      var p=(e.payePar||"").trim();
      if(p && p===mePerson()) return true;
      if(e.compte && e.compte!=="__tickets" && acctByKey(e.compte)) return true;
      return !!p && comptes.some(function(a){ return a.key!=="__tickets" && (a.payer||"")===p; });
    }
    // Sur le téléphone d'un membre « tout le foyer » : les frais fixes des comptes qu'il n'a pas sont en consultation
    function fyFraisCanEdit(f){ if(!fyMember()) return true; if(fyCfg.role==="view" || !fyTabEd("communes")) return false; if(fyCfg.accts==null) return true;
      var fw=(f.personne||"").trim()||"Commun"; if(fw==="Commun" || fw===mePerson()) return true;
      return comptes.some(function(a){ return a.key!=="__tickets" && !!fraisKind(f, a.key); }); }
    function fyTicketsOnly(){ return fyMember() && !!fyCfg.accts && !fyCfg.accts.length; }
    function fyDefPayer(){ return fyMember() ? mePerson() : ""; }
    function fyPayers(){ var l=[]; comptes.forEach(function(a){ var p=(a.payer||"").trim(); if(p && p!=="Commun" && l.indexOf(p)<0) l.push(p); }); if(fyCfg && fyCfg.me && l.indexOf(fyCfg.me)<0) l.unshift(fyCfg.me); return l; }
    function myAcct(){
      if(fyMember() && fyCfg.me){ var a=comptes.filter(function(c){ return (c.payer||"")===fyCfg.me; })[0]; if(a) return a; if(fyCfg.accts) return comptes[0]||mainAcct(); }
      return mainAcct();
    }
    // ----- chiffrement -----
    function fyB64u(bytes){ var s="", a=new Uint8Array(bytes), i, ch=0x8000; for(i=0;i<a.length;i+=ch) s+=String.fromCharCode.apply(null, a.subarray(i, i+ch)); return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,""); }
    function fyUnb64u(s){ s=String(s||"").replace(/-/g,"+").replace(/_/g,"/"); while(s.length%4) s+="="; var b=atob(s), a=new Uint8Array(b.length); for(var i=0;i<b.length;i++) a[i]=b.charCodeAt(i); return a; }
    function fyRand(n){ return fyB64u(randBytes(n)); }
    function fySha(s){ return crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)).then(fyB64u); }
    function fyHkdf(secret, info, len){
      return crypto.subtle.importKey("raw", secret, "HKDF", false, ["deriveBits"]).then(function(k){
        return crypto.subtle.deriveBits({ name:"HKDF", hash:"SHA-256", salt:new TextEncoder().encode("tickets-foyer"), info:new TextEncoder().encode(info) }, k, (len||32)*8);
      }).then(function(b){ return new Uint8Array(b); });
    }
    function fyAes(raw){ return crypto.subtle.importKey("raw", fyUnb64u(raw), "AES-GCM", false, ["encrypt","decrypt"]); }
    function fyPipe(bytes, stream){ return new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer().then(function(b){ return new Uint8Array(b); }); }
    // décompression plafonnée (08/11, revue M2) : un envoi piégé de 2 Mo ne peut pas devenir des Go dans le téléphone
    var FY_UNZIP_MAX=60*1024*1024;
    function fyGunzip(bytes){
      var rd=new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip")).getReader(), parts=[], tot=0;
      function step(){ return rd.read().then(function(x){
        if(x.done){ var out=new Uint8Array(tot), o=0; parts.forEach(function(p){ out.set(p, o); o+=p.length; }); return out; }
        tot+=x.value.length; if(tot>FY_UNZIP_MAX){ try{ rd.cancel(); }catch(e){} throw new Error("trop gros"); }
        parts.push(x.value); return step(); }); }
      return step();
    }
    function fySeal(raw, obj){
      var data=new TextEncoder().encode(JSON.stringify(obj)), gz=(typeof CompressionStream==="function");
      return (gz ? fyPipe(data, new CompressionStream("gzip")) : Promise.resolve(data)).then(function(d){
        var iv=randBytes(12);
        return fyAes(raw).then(function(k){ return crypto.subtle.encrypt({ name:"AES-GCM", iv:iv }, k, d); }).then(function(ct){
          var out=new Uint8Array(12+ct.byteLength); out.set(iv,0); out.set(new Uint8Array(ct),12);
          return (gz?"g1.":"p1.")+fyB64u(out);
        });
      });
    }
    function fyOpen(raw, str){
      var p=String(str||"").split(".");
      if(p.length!==2 || (p[0]!=="g1" && p[0]!=="p1")) return Promise.reject(new Error("format"));
      var all=fyUnb64u(p[1]);
      return fyAes(raw).then(function(k){ return crypto.subtle.decrypt({ name:"AES-GCM", iv:all.slice(0,12) }, k, all.slice(12)); }).then(function(d){
        d=new Uint8Array(d);
        if(p[0]==="g1"){ if(typeof DecompressionStream!=="function") throw new Error("gzip"); return fyGunzip(d); }
        return d;
      }).then(function(d){ return JSON.parse(new TextDecoder().decode(d)); });
    }
    var FY_B32="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    function fyB32(bytes){ var bits=0, val=0, out=""; for(var i=0;i<bytes.length;i++){ val=(val<<8)|bytes[i]; bits+=8; while(bits>=5){ out+=FY_B32[(val>>>(bits-5))&31]; bits-=5; } } if(bits>0) out+=FY_B32[(val<<(5-bits))&31]; return out; }
    function fyUnb32(s){ s=String(s||"").toUpperCase().replace(/[^A-Z2-7]/g,""); var bits=0, val=0, out=[]; for(var i=0;i<s.length;i++){ val=(val<<5)|FY_B32.indexOf(s[i]); bits+=5; if(bits>=8){ out.push((val>>>(bits-8))&255); bits-=8; } } return new Uint8Array(out); }
    function fyCodeTxt(sec){ return fyB32(fyUnb64u(sec)).replace(/(.{4})(?=.)/g,"$1-"); }
    // ----- relais -----
    var fyOff=0;   // écart entre l'horloge du téléphone et celle du relais (la modification la plus récente gagne)
    function fyNow(){ return Date.now()+fyOff; }
    function fyAuth(){ return fyCfg ? fyCfg.fid+"."+(fyCfg.role==="owner"?"o":fyCfg.mid)+"."+fyCfg.tok : ""; }
    function fyCall(method, path, body, noAuth, auth){
      if(DEMO) return Promise.resolve({ status:200, j:{ now:Date.now(), items:[] } });   // démo : pas de relais
      var h={ "Content-Type":"application/json" }; if(!noAuth) h.Authorization="Bearer "+(auth||fyAuth());
      var t0=Date.now();
      return fetch(fyApiBase()+"/foyer"+path, { method:method, headers:h, body:body?JSON.stringify(body):undefined, cache:"no-store" }).then(function(r){
        if(r.status===204) return { status:204, j:{} };
        return r.json().catch(function(){ return null; }).then(function(j){
          j=j||{}; var rtt=Date.now()-t0; if(j.now && rtt<8000) fyOff=Math.round(j.now-(t0+rtt/2));
          return { status:r.status, j:j };
        });
      });
    }
    // ----- fiches : chaque donnée découpée en petits morceaux comparables -----
    function fyHash(s){
      var h1=0xdeadbeef, h2=0x41c6ce57;
      for(var i=0;i<s.length;i++){ var c=s.charCodeAt(i); h1=Math.imul(h1^c, 2654435761); h2=Math.imul(h2^c, 1597334677); }
      h1=Math.imul(h1^(h1>>>16), 2246822507)^Math.imul(h2^(h2>>>13), 3266489909); h2=Math.imul(h2^(h2>>>16), 2246822507)^Math.imul(h1^(h1>>>13), 3266489909);
      return (h2>>>0).toString(36)+"."+(h1>>>0).toString(36);
    }
    function fyDefault(k){ var t=FY_KEYS[k]; return typeof t==="string" ? [] : ((t===1||t===2) ? {} : null); }
    function fyIdOf(k, x){ var f=FY_KEYS[k], id=(x && typeof x==="object") ? x[f] : null; return (id===undefined || id===null || id==="") ? "h"+fyHash(JSON.stringify(x)) : String(id); }
    function fyFlat(k, val){
      var out={}, t=FY_KEYS[k];
      if(typeof t==="string"){ (Array.isArray(val)?val:[]).forEach(function(x){ out[k+FY_SEP+fyIdOf(k,x)]=x; }); }
      else if(t===1 || t===2){
        var o=(val && typeof val==="object" && !Array.isArray(val)) ? val : {};
        Object.keys(o).forEach(function(p){ var v=o[p];
          if(t===2 && v && typeof v==="object" && !Array.isArray(v)) Object.keys(v).forEach(function(s){ out[k+FY_SEP+p+FY_SEP+s]=v[s]; });
          else out[k+FY_SEP+p]=v; });
      }
      else if(val!==null && val!==undefined) out[k]=val;
      return out;
    }
    function fyPatch(k, val, ch){   // ch : { chemin: { x, d } }
      var t=FY_KEYS[k];
      if(typeof t==="string"){
        var arr=Array.isArray(val)?val.slice():[], idx={}, del={};
        arr.forEach(function(x,i){ idx[k+FY_SEP+fyIdOf(k,x)]=i; });
        Object.keys(ch).forEach(function(p){ var c=ch[p]; if(!fyPathOk(p)) return;
          if(c.d){ if(p in idx) del[idx[p]]=1; }
          else if(p in idx) arr[idx[p]]=c.x;
          else { idx[p]=arr.length; arr.push(c.x); } });
        return arr.filter(function(x,i){ return !del[i]; });
      }
      if(t===1 || t===2){
        var o=(val && typeof val==="object" && !Array.isArray(val)) ? JSON.parse(JSON.stringify(val)) : {};
        Object.keys(ch).forEach(function(p){ var c=ch[p], q=p.split(FY_SEP); if(!fyPathOk(p)) return;
          if(q.length===3){
            if(c.d){ if(o[q[1]] && typeof o[q[1]]==="object"){ delete o[q[1]][q[2]]; if(!Object.keys(o[q[1]]).length) delete o[q[1]]; } }
            else { if(!o[q[1]] || typeof o[q[1]]!=="object" || Array.isArray(o[q[1]])) o[q[1]]={}; o[q[1]][q[2]]=c.x; }
          } else { if(c.d) delete o[q[1]]; else o[q[1]]=c.x; } });
        return o;
      }
      var c0=ch[k]; return c0 ? (c0.d ? null : c0.x) : val;
    }
    var fyBase=store.read("fyBase", {}) || {};   // { clé: { chemin: empreinte } } au dernier passage
    var fyMt=store.read("fyMt", {}) || {};       // propriétaire : { chemin: date de la dernière modification }
    var fyPend=store.read("fyPend", {}) || {};   // membre « modification » : { chemin: { x, d, t, s = n° d'envoi } }
    var fyVer=1, fyPubVer={}, fyDirty={}, fyDetT=null;
    function fyMark(p, x, d, t){
      if(fyRole()==="owner"){ fyMt[p]=t; return; }
      if(fyRole()!=="edit") return;
      var k=p.split(FY_SEP)[0];
      if(FY_OWNER_ONLY[k]) return;
      if(k==="epargne" && x && x.bourseLink) return;   // épargne liée à la Bourse : recalculée par le propriétaire
      fyPend[p]={ x:d?null:x, d:d?1:0, t:t };
    }
    function fyDetect(keys){
      var n=0, now=fyNow();
      (keys||Object.keys(FY_KEYS)).forEach(function(k){
        var cur=fyFlat(k, store.read(k, fyDefault(k))), b=fyBase[k]||{}, nb={};
        Object.keys(cur).forEach(function(p){ var h=fyHash(JSON.stringify(cur[p])); nb[p]=h; if(b[p]!==h){ n++; fyMark(p, cur[p], false, now); } });
        Object.keys(b).forEach(function(p){ if(!(p in nb)){ n++; fyMark(p, null, true, now); } });
        fyBase[k]=nb;
      });
      if(n){ fyVer++; fyRawWrite("fyBase", fyBase); if(fyRole()==="owner") fyRawWrite("fyMt", fyMt); else fyRawWrite("fyPend", fyPend); }
      return n;
    }
    function fyResetBase(){
      fyBase={};
      Object.keys(FY_KEYS).forEach(function(k){ var cur=fyFlat(k, store.read(k, fyDefault(k))), nb={}; Object.keys(cur).forEach(function(p){ nb[p]=fyHash(JSON.stringify(cur[p])); }); fyBase[k]=nb; });
      fyRawWrite("fyBase", fyBase); fyVer++;
    }
    // Toutes les écritures passent par ici : en consultation, rien n'est enregistré ; sinon les changements partent au relais.
    var fyRawWrite=store.write, fyTapAt=0, fyRoToastAt=0;
    document.addEventListener("click", function(){ fyTapAt=Date.now(); }, true);
    store.write=function(k, v){
      if(fyCfg && FY_KEYS.hasOwnProperty(k)){
        if(fyCfg.role==="view" || (fyCfg.role==="edit" && FY_OWNER_ONLY[k]) || (fyCfg.role==="edit" && FY_KEY_TAB[k] && !fyTabEd(FY_KEY_TAB[k]))){
          // geste de la personne (pas un calcul automatique) : on le dit, et on remet les vraies données
          if(!fyRendering && Date.now()-fyTapAt<2500 && Date.now()-fyRoToastAt>3000){
            fyRoToastAt=Date.now(); uiToast(fyCfg.role==="view"?"Consultation : tu ne peux rien modifier":(FY_OWNER_ONLY[k]?"La Bourse se modifie sur le téléphone de "+(fyCfg.owner||"la personne qui t'a invité"):"Lecture seule : "+((FY_TABS.filter(function(t){ return t.v===FY_KEY_TAB[k]; })[0]||{}).l||"cet onglet")+" n'est pas en modification pour toi"));
            setTimeout(function(){ fyReloadVars(); render(); }, 0);
          }
          return;
        }
        fyRawWrite(k, v); fyDirty[k]=1; clearTimeout(fyDetT); fyDetT=setTimeout(fyFlush, 700); return;
      }
      fyRawWrite(k, v);
    };
    // Envoi groupé (07/11, pour ménager le relais) : un changement part 90 s après, avec tous ceux faits entre-temps,
    // et tout de suite quand l'appli passe en arrière-plan ou avec « Mettre à jour ».
    var FY_PUSH=(window.__fyPush>0) ? window.__fyPush : 90000, fyDirtyAt=0;   // __fyPush : délai plus court dans les tests (horloge.py)
    function fyFlush(){ var ks=Object.keys(fyDirty); fyDirty={}; if(ks.length && fyDetect(ks)){ if(!fyDirtyAt) fyDirtyAt=Date.now(); fyIdle=0; fySyncSoon(FY_PUSH, true); } }
    // Relit les données en mémoire après une mise à jour reçue du foyer
    function fyReloadVars(){
      state.entries=store.read("entries", []);
      virements=store.read("virements", []); fraisCommuns=store.read("fraisCommuns", []); epargne=store.read("epargne", []);
      provisions=store.read("provisions", []); factures=store.read("factures", []); bourse=store.read("bourse", []); personnes=store.read("personnes", []);
      var cp=store.read("comptes", null); if(cp && cp.length) comptes=cp;
      argentMois=store.read("argentMois", {}); liquideMois=store.read("liquideMois", {}); soldeInit=store.read("soldeInit", {});
      budgets=store.read("budgets", {}); budgetsP=store.read("budgetsP", {})||{}; communParts=store.read("communParts", null); commRemb=store.read("commRemb", []); groupes=store.read("groupes", []); APPRIS=store.read("appris", {});
      var fd=store.read("familleDe", null); FAMILLE_DE=fd||{};
      var c=store.read("cats", null); if(c && c.length){ CATS=c; if(CATS.indexOf("Autre")<0) CATS.push("Autre"); }
      var cpa=store.read("catParent", null); if(cpa && typeof cpa==="object") CAT_PARENT=cpa;
      var f=store.read("familles", null); if(f && f.length){ FAMILLES=f; if(FAMILLES.indexOf(FAM_FB)<0) FAMILLES.push(FAM_FB); }
      for(var k in DEFAULT_FAMILLE_DE){ if(!(k in FAMILLE_DE)) FAMILLE_DE[k]=DEFAULT_FAMILLE_DE[k]; }
      FAMILLES.forEach(function(x){ FAMILLE_DE[x]=x; });
      var pr=store.read("produits", null); if(pr && pr.length){ PRODUITS=pr; var miss=FAMILLES.filter(function(x){ return PRODUITS.indexOf(x)<0; }); if(miss.length) PRODUITS=miss.concat(PRODUITS); if(PRODUITS.indexOf("Remise")<0) PRODUITS.push("Remise"); }
      if(store.read("taxoV3", null)===3 || fyMember()) famSync(false);   // produits rangés dans l'arbre des catégories
      var dv=store.read("devise", "EUR"); if(CURS[dv]) BASE=dv;
    }
    function fyBusyUI(){
      if(document.querySelector(".sheet-overlay, .drawer-ov")) return true;
      if(state.view==="form") return true;
      var ae=document.activeElement; return !!(ae && /^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName||""));
    }
    // ----- propriétaire -----
    function fyOwnerOf(x, def){ return ((x && x.owner) || "").trim() || def; }
    function fyRules(m){
      var acc=null, payers=Object.create(null);
      if(m.accts!=null){ acc=Object.create(null); m.accts.forEach(function(k){ acc[k]=1; }); comptes.forEach(function(a){ if(acc[a.key]) payers[acctOwner(a)||a.payer||""]=1; }); if(m.name) payers[m.name]=1; delete payers[""]; }
      return { acc:acc, payers:payers,
        inA:function(e){ if(m.accts.some(function(k){ return ticketInAcct(e,k); })) return true; return !!m.name && (e.payePar||"").trim()===m.name && !(e.compte && acctByKey(e.compte)); },
        inF:function(f){ return m.accts.some(function(k){ return !!fraisKind(f,k); }); } };
    }
    // Copie du foyer telle que la verra ce membre (seulement les comptes choisis)
    function fyFilter(m){
      var me=mePerson(), K={}, R=fyRules(m);
      Object.keys(FY_KEYS).forEach(function(k){ K[k]=store.read(k, fyDefault(k)); });
      // sur le téléphone du membre, « toi » c'est lui : on écrit en toutes lettres ce qui est au propriétaire
      K.comptes=(K.comptes||[]).map(function(a){ if(a.payer || !a.main) return a; a=JSON.parse(JSON.stringify(a)); a.payer=me; return a; });
      ["epargne","provisions"].forEach(function(k){ K[k]=(K[k]||[]).map(function(x){ if(x.owner) return x; x=JSON.parse(JSON.stringify(x)); x.owner=me; return x; }); });
      if(!(K.personnes||[]).some(function(p){ return p.nom===me; })) K.personnes=(K.personnes||[]).concat([{ nom:me }]);
      // frais communs payés en entier : le membre doit savoir par qui (pour l'Analyse « + Frais fixes »)
      K.fraisCommuns=(K.fraisCommuns||[]).map(function(f){ if(((f.personne||"").trim()||"Commun")!=="Commun" || f.split) return f; var x=JSON.parse(JSON.stringify(f)); x.payeur=fraisPayer(f); return x; });
      if(!fyTabOn(m,"bourse")){ K.bourse=[]; K.epargne=(K.epargne||[]).filter(function(x){ return !x.bourseLink; }); }
      if(!fyTabOn(m,"communes")){ K.commRemb=[]; K.groupes=[]; }   // remboursements du commun : avec l'onglet Commun
      if(!fyTabOn(m,"factures")) K.factures=[];   // les factures suivent l'onglet Factures   // la ligne Bourse de l'épargne suit l'onglet Bourse
      if(R.acc){
        K.comptes=K.comptes.filter(function(a){ return R.acc[a.key]; });
        if(m.tk!=="all") K.entries=(K.entries||[]).filter(R.inA);   // « Tickets visibles : tout le foyer » : tous les tickets, sans les comptes
        K.virements=(K.virements||[]).filter(function(v){ return R.acc[v.person]; });
        var comOn=fyTabOn(m,"communes");   // Commun visible : les frais communs et ses frais perso, même sans ces comptes (pas les frais perso des autres)
        if(m.tk!=="all") K.fraisCommuns=(K.fraisCommuns||[]).filter(function(f){ var w=(f.personne||"").trim()||"Commun"; return R.inF(f) || (comOn && (w==="Commun" || w===m.name)); });   // « tout le foyer » : tous les frais fixes aussi
        ["soldeInit","liquideMois","argentMois"].forEach(function(k){ var o={}, src=K[k]||{}; Object.keys(src).forEach(function(p){ if(R.acc[p] || R.payers[p]) o[p]=src[p]; }); K[k]=o; });
        K.epargne=K.epargne.filter(function(x){ return R.payers[x.owner]; });
        K.provisions=K.provisions.filter(function(x){ return R.payers[x.owner]; });
        if(!fyTabOn(m,"bourse")) K.bourse=[]; if(m.tk!=="all") K.budgets={};   // la Bourse n'est pas un compte : elle suit l'onglet
        var bp={}; Object.keys(K.budgetsP||{}).forEach(function(p){ if(R.payers[p]) bp[p]=K.budgetsP[p]; }); K.budgetsP=bp;   // seulement ses budgets à lui
        if(!K.comptes.length) K.comptes=[{ key:"__tickets", nom:"Mes tickets", payer:"", main:true }];
      }
      return K;
    }
    // Un changement envoyé par un membre : a-t-il le droit de le faire ?
    function fyAllowed(m, k, p, old, nw){
      if(m.role!=="edit" || FY_OWNER_ONLY[k]) return false;
      if(!FY_KEY_TAB[k] || fyEdTabs(m).indexOf(FY_KEY_TAB[k])<0 || !fyTabOn(m, FY_KEY_TAB[k])) return false;   // onglet de la donnée en modification pour ce membre
      if(m.accts==null) return true;
      var R=fyRules(m), me=mePerson();
      // liens vers d'autres comptes, livrets ou la Bourse : seulement ceux que ce membre voit (08/11, revue M4)
      function epOk(id){ if(id==null || id==="") return true; var e=(store.read("epargne", [])||[]).filter(function(y){ return String(y.id)===String(id); })[0]; return !!e && !e.bourseLink && !!R.payers[fyOwnerOf(e, me)]; }
      function cptOk(v){ if(v==null || v==="") return true; v=String(v); if(v.indexOf("cpt:")===0) return !!R.acc[v.slice(4)]; if(v.indexOf("ep:")===0) return epOk(v.slice(3)); return v==="ext"; }
      function linksOk(x){
        if(k==="virements") return cptOk(x.vers) && epOk(x.epargneId) && (x.bourseId==null || x.bourseId==="");
        if(k==="fraisCommuns") return (x.compte==null || x.compte==="" || !!R.acc[x.compte]);
        if(k==="provisions"){ if(x.ou==="cpt"){ var mk=(comptes.filter(function(a){ return a.main; })[0]||{}).key; return !!(mk && R.acc[mk]); } return (x.ou==null || x.ou==="" || cptOk(x.ou)); }
        return true;
      }
      function ok(x, isOld){
        if(x==null) return true;
        if(!linksOk(x)) return false;
        if(k==="entries") return R.inA(x);
        if(k==="virements") return !!R.acc[x.person];
        if(k==="fraisCommuns"){ var w=(x.personne||"").trim()||"Commun"; return R.inF(x) || w==="Commun" || w===m.name; }   // l'onglet Commun en modification est déjà vérifié
        if(k==="comptes") return !!R.acc[x.key];
        if(k==="epargne" || k==="provisions") return !!R.payers[fyOwnerOf(x, isOld?me:m.name)];
        if(k==="factures") return true;   // factures du foyer : l'onglet Factures en modification est déjà vérifié
        return false;
      }
      if(k==="soldeInit" || k==="liquideMois" || k==="argentMois"){ var pp=p.split(FY_SEP)[1]; return !!(R.acc[pp] || R.payers[pp]); }
      if(k==="budgetsP") return !!R.payers[p.split(FY_SEP)[1]];
      if(k==="communParts" || k==="commRemb" || k==="groupes") return true;   // parts et remboursements du commun : onglet Commun en modification
      if(k==="cats" || k==="catParent" || k==="familles" || k==="produits" || k==="appris" || k==="familleDe") return true;
      if(typeof FY_KEYS[k]==="string") return ok(old, true) && ok(nw, false);
      return false;
    }
    // Remet un changement de membre « à la façon du propriétaire » (son compte principal, ses épargnes sans nom…)
    function fyFromMember(k, x, old, m, me){
      if(x==null || typeof x!=="object") return x;
      x=JSON.parse(JSON.stringify(x));
      if(k==="comptes"){ if(old && old.main) x.main=true; else delete x.main; if(old && !old.payer && x.payer===me) x.payer=old.payer; }
      if(k==="epargne" || k==="provisions"){ if(!x.owner) x.owner=m.name; if(x.owner===me) delete x.owner; }
      if(k==="fraisCommuns") delete x.payeur;
      if(k==="entries" && typeof x.photo==="string" && !phSafe(x.photo)) x.photo=false;   // photo piégée refusée (revue C2)
      if(k==="entries"){ if(x.pay!=="esp"){ delete x.pay; delete x.liq; } else if(x.liq && !tkLiqFromOk(x, m)) delete x.liq; }   // payé en espèces : liquide d'un compte qu'il voit et modifie
      if(k==="personnes" && x.nom===me) return FY_SKIP;
      return x;
    }
    function fyApplyFromMember(m, recs, rt){
      var byKey={}, n=0, me=mePerson(), now=fyNow(), lim=Math.min(now+5*60000, Number(rt)||now);   // pas plus récent que l'arrivée au relais (revue F3)
      (recs||[]).forEach(function(r){
        if(!r || !fyPathOk(r.p)) return;
        var k=r.p.split(FY_SEP)[0]; if(!FY_KEYS.hasOwnProperty(k)) return;
        m.force=m.force||{}; m.force[r.p]=1;   // copie différentielle : la valeur retenue repart chez lui, même si son changement est refusé
        var t=Number(r.t)||0; if(t>lim) t=lim;   // horloge du membre en avance : ramenée à l'heure d'arrivée
        if(t<=(fyMt[r.p]||0)) return;                      // modifié plus récemment ici : on garde
        (byKey[k]=byKey[k]||{})[r.p]={ x:r.d?null:r.x, d:!!r.d, t:t };
      });
      Object.keys(byKey).forEach(function(k){
        var cur=store.read(k, fyDefault(k)), flat=fyFlat(k, cur), ch=byKey[k], ok={};
        Object.keys(ch).forEach(function(p){
          var c=ch[p], old=flat[p];
          if(c.d && !(p in flat)) return;
          if(!fyAllowed(m, k, p, old===undefined?null:old, c.d?null:c.x)) return;
          if(!c.d){ c.x=fyFromMember(k, c.x, old, m, me); if(c.x===FY_SKIP) return; }
          ok[p]=c;
        });
        var ps=Object.keys(ok); if(!ps.length) return;
        fyRawWrite(k, fyPatch(k, cur, ok));
        var nb=fyBase[k]||{};
        ps.forEach(function(p){ fyMt[p]=ok[p].t; if(ok[p].d) delete nb[p]; else nb[p]=fyHash(JSON.stringify(ok[p].x)); n++; });
        fyBase[k]=nb;
      });
      if(n){ fyVer++; fyRawWrite("fyBase", fyBase); fyRawWrite("fyMt", fyMt); }
      return n;
    }
    function fyOwnerSync(){
      var C=fyCfg, applied=0;
      return fyCall("GET","/inbox").then(function(r){
        if(r.status===410) throw fyGone("foyer", r.j && r.j.purged);
        if(r.status!==200) throw new Error("relais "+r.status);
        var items=r.j.items||[]; if(items.length) fyNew=true; if(!items.length || fyBusyUI()) return;
        var maxSeq=0, chain=Promise.resolve();
        items.forEach(function(it){ chain=chain.then(function(){
          maxSeq=Math.max(maxSeq, it.seq);
          var m=C.members && C.members[it.mid]; if(!m || !m.km) return;
          return fyOpen(m.km, it.v).then(function(b){
            // seulement un envoi de membre : jamais une copie du propriétaire renvoyée par le relais (08/11, revue F2)
            if(!b || b.keys || b.d || (b.w && b.w!=="m") || !Array.isArray(b.recs)) throw new Error("pas un envoi de membre");
            applied+=fyApplyFromMember(m, b.recs, it.t); }).catch(function(e){ console.warn("foyer : envoi illisible", e); })
            .then(function(){ m.ack=Math.max(m.ack||0, it.seq); fyVer++; });
        }); });
        return chain.then(function(){ fySave(); return fyCall("POST","/inbox/ack",{ upto:maxSeq }); }).then(function(){ if(r.j.more) return fyOwnerSync(); });
      }).then(function(){
        if(applied){ fyReloadVars(); render(); }
        // la liste des membres : seulement sur l'écran du foyer, pendant une invitation, ou toutes les 15 min (moins de requêtes)
        var pend=Object.keys(C.members||{}).some(function(id){ return !C.members[id].joinedOnce; });
        var nodv=Object.keys(C.members||{}).some(function(id){ return !(C.srv && C.srv[id] && C.srv[id].dv); });   // pas encore dit s'il lit les différences : revu toutes les 3 min
        if(fyMembersSeen && state.view!=="foyer" && !pend && C.srvAt && Date.now()-C.srvAt<(nodv ? 180000 : 900000)) return null;   // toujours une fois à l'ouverture
        fyMembersSeen=true;
        return fyCall("GET","/members");
      }).then(function(r){
        if(r && r.status===200){ C.srvAt=Date.now(); var srv={}; (r.j.members||[]).forEach(function(x){ srv[x.id]=x; }); C.srv=srv;
          // un membre a quitté le foyer de lui-même : on l'oublie ici aussi
          Object.keys(C.members||{}).forEach(function(id){ if(!srv[id] && C.members[id].joinedOnce){ delete C.members[id]; } else if(srv[id] && !srv[id].pending) C.members[id].joinedOnce=1; });
        }
        return fyPublishAll();
      }).then(function(){ return fyBkSeal(); });
    }
    function fySnapPayload(m){ return { v:1, w:"o", ts:fyNow(), plus:plusOwn(), owner:mePerson(), me:m.name, role:m.role, tabs:m.tabs||null, ed:fyEdTabs(m), accts:m.accts==null?null:m.accts, tk:m.tk||"own", ack:m.ack||0, keys:fyFilter(m) }; }
    // Copies différentielles (07/11) : à un membre dont l'appli sait les lire (« dv », dit par le relais), seulement les fiches changées
    // depuis la dernière copie ({ d:1, recs, ord }) ; copie complète la première fois, après 40 différences, si la différence pèse plus
    // de la moitié de la copie, ou si le relais ne suit plus (409). fyPubH (sur ce téléphone) : { membre: { h: {chemin: empreinte}, t, n, fs } }.
    var fyPubH=store.read("fyPubH", {}) || {};
    var FY_META=["v","plus","owner","me","role","tabs","ed","accts","tk","ack"];
    function fyFlatAll(keys){ var out={}; Object.keys(FY_KEYS).forEach(function(k){ var f=fyFlat(k, (keys && keys.hasOwnProperty(k)) ? keys[k] : fyDefault(k)); for(var p in f) out[p]=f[p]; }); return out; }
    function fyDeltaOf(P, flat, H, force){
      var recs=[], ord=[];
      Object.keys(H).forEach(function(p){ if(P.h[p]!==H[p] || (force && force[p])) recs.push({ p:p, x:flat[p] }); });
      Object.keys(P.h).forEach(function(p){ if(!(p in H)) recs.push({ p:p, d:1 }); });
      Object.keys(force||{}).forEach(function(p){ if(!(p in H) && !(p in P.h)) recs.push({ p:p, d:1 }); });
      // listes : l'ordre attendu chez le membre (anciennes fiches gardées, nouvelles à la fin) ; s'il diffère, on envoie l'ordre
      Object.keys(FY_KEYS).forEach(function(k){ if(typeof FY_KEYS[k]!=="string") return;
        var pre=k+FY_SEP, now=Object.keys(H).filter(function(p){ return p.indexOf(pre)===0; }), seen={};
        var exp=Object.keys(P.h).filter(function(p){ if(p.indexOf(pre)===0 && (p in H)){ seen[p]=1; return true; } return false; });
        now.forEach(function(p){ if(!seen[p]) exp.push(p); });
        if(exp.join("\n")!==now.join("\n")) ord.push({ k:k, o:now });
      });
      return { recs:recs, ord:ord };
    }
    function fyPublishAll(force){
      var C=fyCfg, chain=Promise.resolve();
      Object.keys(fyPubH).forEach(function(id){ if(!(C.members||{})[id]) delete fyPubH[id]; });
      Object.keys(C.members||{}).forEach(function(id){ chain=chain.then(function(){
        var m=C.members[id]; if(!m || !m.km || (!force && fyPubVer[id]===fyVer && m.pl===plusOwn())) return;
        var payload=fySnapPayload(m), h=fyHash(JSON.stringify(payload)), ver=fyVer;
        if(h===m.sh && !force && !m.force){ fyPubVer[id]=ver; return; }
        var flat=fyFlatAll(payload.keys), H={}; Object.keys(flat).forEach(function(p){ H[p]=fyHash(JSON.stringify(flat[p])); });
        function done(r, P){ m.sh=h; m.snapT=r.j.t; m.pl=payload.plus; delete m.force; fyPubVer[id]=ver; fyPubH[id]=P; fyRawWrite("fyPubH", fyPubH); fySave(); }
        function full(){
          payload.t=fyNow();
          return fySeal(m.km, payload).then(function(v){ return fyCall("PUT","/snap/"+id,{ v:v }).then(function(r){
            if(r.status===200) done(r, { h:H, t:r.j.t, n:0, fs:v.length });
            else console.warn("foyer : copie de "+m.name+" non envoyée ("+r.status+")");
          }); });
        }
        var P=fyPubH[id], srv=C.srv && C.srv[id];
        if(force || !P || !P.t || !P.h || !srv || !srv.dv || (P.n||0)>=40) return full();
        var D=fyDeltaOf(P, flat, H, m.force), dp={ d:1, w:"o", recs:D.recs, ord:D.ord, t:fyNow() };
        FY_META.forEach(function(f){ dp[f]=payload[f]; });
        var size=JSON.stringify(dp).length;
        if(P.fs && size>P.fs*0.4) return full();
        return fySeal(m.km, dp).then(function(v){ return fyCall("PUT","/snap/"+id,{ v:v, base:P.t }).then(function(r){
          if(r.status===200) done(r, { h:H, t:r.j.t, n:(P.n||0)+1, fs:P.fs });
          else if(r.status===409) return full();   // le relais ne suit plus (copie effacée, trop de différences) : copie complète
          else console.warn("foyer : différence pour "+m.name+" non envoyée ("+r.status+")");
        }); });
      }); });
      return chain;
    }
    // Le foyer dans les sauvegardes (07/11, à la place de la copie de secours sur le relais) : membres, leurs clés et dates des fiches,
    // chiffrés avec la clé du foyer (tirée du code de secours) ; « fyBk » = { fid, v } va dans la sauvegarde Drive et le fichier (backupDump).
    // Restaurer avec le code de secours rend le foyer : les membres gardent leur accès sans nouveau QR code.
    var fyBkSig="", fyBkAt=0;
    function fyBkSeal(force){
      var C=fyCfg; if(!C || C.role!=="owner" || !C.key || DEMO) return Promise.resolve();
      var mem={}; Object.keys(C.members||{}).forEach(function(id){ var m=C.members[id]; mem[id]={ name:m.name, role:m.role, tabs:m.tabs, ed:m.ed, accts:m.accts, tk:m.tk||"own", km:m.km, created:m.created, ack:m.ack||0 }; });
      var ms=JSON.stringify(mem);
      if(!force && ms===fyBkSig && Date.now()-fyBkAt<120000) return Promise.resolve();
      fyBkSig=ms; fyBkAt=Date.now();
      return fySeal(C.key, { v:1, me:mePerson(), members:mem, mt:fyMt }).then(function(v){ fyRawWrite("fyBk", { fid:C.fid, v:v }); }).catch(function(){});
    }
    // Remet le foyer d'une sauvegarde si l'un des codes donnés est le sien → promesse : true si le foyer est revenu
    function fyBkRestore(bk, secs){
      if(!bk || !bk.fid || !bk.v) return Promise.resolve(false);
      var list=(secs||[]).filter(function(x){ return x && x.length===16; }), i=0;
      function next(){
        if(i>=list.length) return Promise.resolve(false);
        var sec=list[i++];
        return fyFromSecret(sec).then(function(o){
          if(o.fid!==bk.fid) return next();
          return fyOpen(o.key, bk.v).then(function(p){
            fyCfg={ role:"owner", fid:o.fid, tok:o.tok, key:o.key, sec:fyB64u(sec), members:p.members||{}, created:Date.now(), lastOk:Date.now() };
            Object.keys(fyCfg.members).forEach(function(id){ fyCfg.members[id].sh=null; fyCfg.members[id].joinedOnce=1; });
            fyMt=p.mt||{}; fyRawWrite("fyMt", fyMt); fyRawWrite("fyPubH", {}); fyRawWrite("fyBk", bk);
            fySave(); fyResetBase(); fyRawWrite("fyRecovered", 1);
            return true;
          });
        }).catch(function(){ return next(); });
      }
      return next();
    }
    // ----- membre -----
    var fyHeldSnap=null;
    function fyMemberSync(){
      var C=fyCfg;
      if(fyHeldSnap && !fyBusyUI()){ var s0=fyHeldSnap; fyHeldSnap=null; fyApplySnap(s0); }
      return fyPushPending().then(function(){ return fyCall("GET","/snap?d=1"+(C.snapT?"&since="+C.snapT:"")); }).then(function(r){
        if(r.status===410) throw fyGone("removed", r.j && r.j.purged);
        if(r.status===401) throw fyGone("auth");
        if(r.status===204 || r.j.none) return;
        if(r.status!==200) throw new Error("relais "+r.status);
        fyNew=true;
        var ds=r.j.deltas||[], opened=[], chain=Promise.resolve(), base0=C.snapTs||0, top=0;
        function fromOwner(x, full){   // 08/11 (revue F2) : une copie ou une différence du propriétaire, jamais plus ancienne que la dernière
          if(!x || (x.w && x.w!=="o")) throw new Error("pas une copie du propriétaire");
          if(full ? !(x.keys && typeof x.keys==="object") : x.d!==1) throw new Error("format");
          var ts=Number(full ? x.ts : x.t)||0; if(ts>top) top=ts;
          return x; }
        function notOld(){ if(top && base0 && top<base0-1000) throw new Error("copie ancienne"); if(top) C.snapTs=Math.max(C.snapTs||0, top); }
        ds.forEach(function(d){ chain=chain.then(function(){ return fyOpen(C.km, d.v).then(function(x){ opened.push(fromOwner(x, false)); }); }); });
        chain=chain.catch(function(e){ C.snapT=null; fySave(); throw e; });   // une différence illisible : on redemandera tout
        if(!r.j.v) return chain.then(function(){ notOld(); fyApplySnap({ delta:opened, t:r.j.t }); });
        return fyOpen(C.km, r.j.v).then(function(s){ fromOwner(s, true); return chain.then(function(){ notOld(); opened.forEach(function(d){ fyDeltaOn(s, d); }); s.t=r.j.last||r.j.t; fyApplySnap(s); }); });
      });
    }
    function fyPushPending(){
      var C=fyCfg; if(C.role!=="edit") return Promise.resolve();
      var recs=[]; Object.keys(fyPend).forEach(function(p){ var e=fyPend[p]; if(!e.s) recs.push({ p:p, x:e.d?null:e.x, d:e.d?1:0, t:e.t }); });
      if(!recs.length) return Promise.resolve();
      var batches=[], cur=[], size=0;
      recs.forEach(function(r){ var l=JSON.stringify(r).length; if(cur.length && size+l>500000){ batches.push(cur); cur=[]; size=0; } cur.push(r); size+=l; });
      if(cur.length) batches.push(cur);
      var chain=Promise.resolve();
      batches.forEach(function(b){ chain=chain.then(function(){
        return fySeal(C.km, { w:"m", recs:b }).then(function(v){ return fyCall("POST","/inbox",{ v:v }); }).then(function(r){
          if(r.status===410) throw fyGone("removed", r.j && r.j.purged);
          if(r.status===401) throw fyGone("auth");
          if(r.status===403) return;   // passé en consultation : la prochaine copie le dira
          if(r.status!==200) throw new Error("envoi "+r.status);
          b.forEach(function(x){ var e=fyPend[x.p]; if(e && e.t===x.t && !e.s) e.s=r.j.seq; });
          fyRawWrite("fyPend", fyPend);
        });
      }); });
      return chain;
    }
    // Une différence reçue, appliquée sur une copie { keys, meta } : fiches remplacées ou retirées, puis l'ordre des listes
    function fyDeltaOn(s, d){
      s.keys=s.keys||{};
      var by={}; (d.recs||[]).forEach(function(r){ if(!r || !fyPathOk(r.p)) return; var k=r.p.split(FY_SEP)[0]; if(!FY_KEYS.hasOwnProperty(k)) return; (by[k]=by[k]||{})[r.p]={ x:r.d?null:r.x, d:!!r.d }; });
      Object.keys(by).forEach(function(k){ s.keys[k]=fyPatch(k, s.keys.hasOwnProperty(k) ? s.keys[k] : fyDefault(k), by[k]); });
      (d.ord||[]).forEach(function(o){ if(typeof FY_KEYS[o.k]!=="string") return;
        var arr=Array.isArray(s.keys[o.k]) ? s.keys[o.k] : [], at={}, used={}, out=[];
        arr.forEach(function(x){ at[o.k+FY_SEP+fyIdOf(o.k, x)]=x; });
        (o.o||[]).forEach(function(p){ if(p in at && !used[p]){ used[p]=1; out.push(at[p]); } });
        arr.forEach(function(x){ var p=o.k+FY_SEP+fyIdOf(o.k, x); if(!used[p]){ used[p]=1; out.push(x); } });
        s.keys[o.k]=out; });
      FY_META.forEach(function(f){ if(d.hasOwnProperty(f)) s[f]=d[f]; });
    }
    function fyApplySnap(snap){
      if(fyBusyUI()){ fyHeldSnap=snap; return; }   // une fenêtre est ouverte : on attend qu'elle soit fermée
      var C=fyCfg; if(!C) return;
      if(snap.delta){   // seulement des différences : elles s'appliquent sur ce qu'il y a déjà sur ce téléphone
        var s2={ keys:{}, t:snap.t, plus:C.plus, owner:C.owner, me:C.me, role:C.role, tabs:C.tabs, ed:C.ed, accts:C.accts, tk:C.tk, ack:0 };
        Object.keys(FY_KEYS).forEach(function(k){ s2.keys[k]=store.read(k, fyDefault(k)); });
        snap.delta.forEach(function(d){ fyDeltaOn(s2, d); });
        snap=s2;
      }
      Object.keys(fyPend).forEach(function(p){ var e=fyPend[p]; if(e.s && e.s<=(snap.ack||0)) delete fyPend[p]; });   // traité par le propriétaire
      if(snap.role!=="edit") fyPend={};
      var byKey={}; Object.keys(fyPend).forEach(function(p){ var k=p.split(FY_SEP)[0]; (byKey[k]=byKey[k]||{})[p]=fyPend[p]; });
      Object.keys(FY_KEYS).forEach(function(k){
        var v=(snap.keys && snap.keys.hasOwnProperty(k)) ? snap.keys[k] : fyDefault(k);
        if(byKey[k]) v=fyPatch(k, v, byKey[k]);   // mes changements pas encore pris en compte restent visibles
        fyRawWrite(k, v);
      });
      fyResetBase(); fyRawWrite("fyPend", fyPend); fyRawWrite("askName", false);
      C.role=snap.role; C.me=snap.me; C.owner=snap.owner; C.tabs=snap.tabs||null; C.ed=Array.isArray(snap.ed)?snap.ed:null; C.accts=snap.accts==null?null:snap.accts; C.tk=snap.tk||"own"; C.plus=!!snap.plus; C.snapT=snap.t; C.lastOk=Date.now();
      fySave(); fyReloadVars(); fyApplyMode(); render();
      if(C.imp){ delete C.imp; fySave(); if(C.role==="edit") setTimeout(fyImport, 0); }
    }
    // Ses données d'avant (gardées de côté en rejoignant) : combien, et faut-il les ajouter au foyer ?
    function fyPrevCount(prev){ prev=prev||store.read("fyAvant", null); if(!prev) return 0; var n=0; ["entries","virements","epargne","provisions","fraisCommuns"].forEach(function(k){ n+=(prev[k]||[]).length; }); return n; }
    function fyAskImport(snap){
      var prev=store.read("fyAvant", null), n=(prev && prev.entries || []).length;
      if(!fyCfg || fyCfg.role!=="edit" || !fyPrevCount(prev)) return Promise.resolve(false);
      var who=(snap && snap.owner) || "la personne qui t'invite";
      return new Promise(function(res){
        uiConfirm("Ajouter tes données actuelles au foyer de "+esc(who)+" ?<br><small style=\"color:var(--ink-soft)\">"+(n?n+" ticket"+(n>1?"s":"")+", ":"")+"tes virements, frais, épargnes et provisions partent sur son téléphone, sur ton compte. La Bourse et les budgets restent de côté. Sinon, tout est gardé de côté ici et revient si tu quittes le foyer.</small>",
          function(){ res(true); }, { ok:"Ajouter au foyer", no:"Garder de côté", onNo:function(){ res(false); } });
      });
    }
    // Verse les données d'avant dans le foyer, rattachées à ce membre (son compte, son prénom). Elles partent comme ses autres changements.
    function fyImport(){
      var prev=store.read("fyAvant", null); if(!prev || !fyCfg || fyCfg.role!=="edit") return 0;
      var me=fyCfg.me || mePerson(), restricted=fyCfg.accts!=null, pc=(prev.comptes||[]).filter(function(a){ return a && a.key; });
      var oldMain=pc.filter(function(a){ return a.main; })[0] || pc[0], oldMe=((oldMain && oldMain.payer) || "").trim() || "Moi";
      function pn(x){ x=(x||"").trim(); return (x===oldMe || x==="Moi") ? me : x; }
      var mine=comptes.filter(function(a){ return (a.payer||"")===me; })[0], target=mine || (restricted ? (comptes[0]||mainAcct()) : null);
      var used={}, amap={}, newAccts=[];
      comptes.forEach(function(a){ used[a.key]=1; });
      pc.forEach(function(a){
        var same=comptes.filter(function(c){ return c.nom===a.nom && (c.payer||"")===pn(a.payer); })[0];
        if(same) amap[a.key]=same.key;
        else if(a===oldMain && target) amap[a.key]=target.key;
        else if(restricted) amap[a.key]=target ? target.key : null;
        else { var k=a.key; while(used[k]) k=a.key+"-"+fyRand(3); used[k]=1; var na=JSON.parse(JSON.stringify(a)); na.key=k; delete na.main; na.payer=pn(a.payer)||me; newAccts.push(na); amap[a.key]=k; if(a===oldMain && !target) target=na; }
      });
      if(!target) return 0;
      function ak(k){ return amap[k] || target.key; }
      function idf(list){ var u={}; (list||[]).forEach(function(x){ if(x && x.id!=null) u[String(x.id)]=1; }); var n=0; return function(id){ var v=id; if(v==null || u[String(v)]){ v=Date.now()+(n++); while(u[String(v)]) v++; } u[String(v)]=1; return v; }; }
      function cp(x){ return JSON.parse(JSON.stringify(x)); }
      var count=0;
      // tickets
      var nid=idf(state.entries), ents=state.entries.slice();
      (prev.entries||[]).forEach(function(e){ e=cp(e); var old=e.id; e.id=nid(e.id); if(e.id!==old) e.photo=false; if((e.payePar||"").trim()) e.payePar=pn(e.payePar); if(e.compte) e.compte=ak(e.compte); ents.push(e); count++; });
      // virements, frais, épargne, provisions
      var vid=idf(virements), virs=virements.slice();
      (prev.virements||[]).forEach(function(v){ v=cp(v); v.id=vid(v.id); v.person=ak(v.person); virs.push(v); count++; });
      var fid2=idf(fraisCommuns), frs=fraisCommuns.slice();
      (prev.fraisCommuns||[]).forEach(function(f){ f=cp(f); f.id=fid2(f.id); if(f.personne) f.personne=pn(f.personne); if(f.compte) f.compte=ak(f.compte); frs.push(f); count++; });
      var eid=idf(epargne), eps=epargne.slice();
      (prev.epargne||[]).forEach(function(x){ if(x.bourseLink) return; x=cp(x); x.id=eid(x.id); x.owner=pn(x.owner)||me; eps.push(x); count++; });
      var pid=idf(provisions), pvs=provisions.slice();
      (prev.provisions||[]).forEach(function(x){ x=cp(x); x.id=pid(x.id); x.owner=pn(x.owner)||me; pvs.push(x); count++; });
      // soldes de départ, liquide, argent du mois : seulement là où le foyer n'a rien
      function mergeMap(cur, src){ var o=cp(cur||{}); Object.keys(src||{}).forEach(function(k){ var nk=amap[k]||(pc.some(function(a){ return a.key===k; })?target.key:pn(k)), v=src[k];
        if(v && typeof v==="object"){ if(!o[nk] || typeof o[nk]!=="object") o[nk]={}; Object.keys(v).forEach(function(m){ if(!(m in o[nk])) o[nk][m]=v[m]; }); } else if(!(nk in o)) o[nk]=v; }); return o; }
      // catégories, familles, produits, classement appris : on ajoute ce qui manque
      function union(cur, src){ var out=(cur||[]).slice(); (src||[]).forEach(function(x){ if(out.indexOf(x)<0) out.push(x); }); return out; }
      function addMissing(cur, src){ var o=cp(cur||{}); Object.keys(src||{}).forEach(function(k){ if(!(k in o)) o[k]=src[k]; }); return o; }
      if(newAccts.length) store.write("comptes", comptes.concat(newAccts));
      store.write("entries", ents); store.write("virements", virs); store.write("fraisCommuns", frs); store.write("epargne", eps); store.write("provisions", pvs);
      store.write("soldeInit", mergeMap(soldeInit, prev.soldeInit)); store.write("liquideMois", mergeMap(liquideMois, prev.liquideMois)); store.write("argentMois", mergeMap(argentMois, prev.argentMois));
      if(prev.cats) store.write("cats", union(CATS, prev.cats));
      if(prev.catParent) store.write("catParent", addMissing(CAT_PARENT||{}, prev.catParent));
      if(prev.familles) store.write("familles", union(FAMILLES, prev.familles));
      if(prev.produits) store.write("produits", union(PRODUITS, prev.produits));
      if(prev.appris) store.write("appris", addMissing(APPRIS, prev.appris));
      if(prev.familleDe) store.write("familleDe", addMissing(FAMILLE_DE, prev.familleDe));
      fyReloadVars(); render();
      uiToast(count+" élément"+(count>1?"s":"")+" ajouté"+(count>1?"s":"")+" au foyer");
      return count;
    }
    function fyGone(kind, purged){ var e=new Error("foyer"); e.fyGone=kind; e.purged=purged||null; return e; }
    // Foyer effacé faute d'utilisation (07/11) : le relais le dit (« purged » : empty = personne ne l'a rejoint en 15 jours, idle = 3 mois sans activité)
    function fyPurgedWhy(pg){ return pg.why==="empty" ? "personne ne l'a rejoint pendant 15 jours" : "il n'a pas été utilisé depuis 3 mois"; }
    function fyHandleGone(kind, pg){
      if(!fyCfg) return;
      if(fyCfg.role==="owner"){
        if(pg && pg.why){
          fyCfg.err="Ton foyer a été effacé car "+fyPurgedWhy(pg)+". Tes données sont intactes sur ce téléphone.";
          fyCfg.purged=pg; fySave();
          if(!fyCfg.purgedSeen){ fyCfg.purgedSeen=1; fySave();
            uiConfirm("Ton foyer a été effacé car "+esc(fyPurgedWhy(pg))+".<br>Tes données sont intactes sur ce téléphone. Recrée-le, puis invite à nouveau tes membres.", fyRecreate, { ok:"Recréer le foyer", no:"Plus tard" }); }
          return;
        }
        fyCfg.err="Ton foyer n'existe plus."; fySave(); return;
      }
      var who=fyCfg.owner||"ce foyer";
      fyLeaveLocal(false);
      var msg=(pg && pg.why) ? "Le foyer de "+esc(who)+" a été effacé car "+esc(fyPurgedWhy(pg))+".<br>Ses données ont été retirées de ce téléphone. Demande-lui un nouveau QR code pour le rejoindre."
        : (kind==="auth"?"Ton accès au foyer de "+esc(who)+" a changé.":"Tu ne fais plus partie du foyer de "+esc(who)+".")+"<br>Ses données ont été effacées de ce téléphone.";
      uiConfirm(msg, function(){ location.reload(); }, { ok:"OK", no:"Fermer", onNo:function(){ location.reload(); } });
    }
    // Recrée le foyer effacé, avec le même code (même foyer, mêmes clés) ; les membres sont à réinviter
    function fyRecreate(){
      var C=fyCfg; if(!C || C.role!=="owner") return;
      fySha(C.tok).then(function(hh){ return fyCall("POST","/create",{ fid:C.fid, otok:hh }, true); }).then(function(r){
        if(r.status===429) throw new Error("trop de foyers créés aujourd'hui depuis ce réseau : réessaie en Wi-Fi ou demain");
        if(r.status!==200) throw new Error((r.j && r.j.error)||("erreur "+r.status));
        C.members={}; C.srv={}; delete C.err; delete C.purged; delete C.purgedSeen; C.lastOk=Date.now();
        fyPubH={}; fyRawWrite("fyPubH", fyPubH); fySave();
        state.view="foyer"; render(); uiToast("Foyer recréé : invite à nouveau tes membres");
      }).catch(function(e){ uiToast("Impossible de recréer le foyer : "+((e && e.message)||"réseau")+"."); });
    }
    // Efface du téléphone tout ce qui vient du foyer et remet les données d'avant (s'il y en avait)
    function fyLeaveLocal(reload){
      var prev=store.read("fyAvant", null);
      Object.keys(FY_KEYS).forEach(function(k){ fyRawWrite(k, (prev && prev.hasOwnProperty(k) && prev[k]!==null) ? prev[k] : fyDefault(k)); });
      if(!prev || !prev.comptes || !prev.comptes.length){ try{ store.remove("comptes"); }catch(e){} fyRawWrite("askName", true); }
      ["fyCfg","fyBase","fyMt","fyPend","fyAvant","compteSel"].forEach(function(k){ try{ store.remove(k); }catch(e){} });
      fyCfg=null; fyBase={}; fyMt={}; fyPend={};
      if(reload!==false) location.reload();
    }
    // ----- synchronisation -----
    // Vérifications espacées (07/11) : appli ouverte, 1 min, puis 2, 5 et 10 min tant que rien n'arrive (de nouveau 1 min dès que quelque chose bouge) ;
    // rien quand l'appli est fermée ou en arrière-plan. fySyncSoon garde le rendez-vous le plus proche.
    var FY_LADDER=[60000, 120000, 300000, 600000], fyIdle=0, fyNew=false, fyLastAt=0, fyMembersSeen=false;
    var fySyncT=null, fySyncDue=0, fySyncing=false, fyAgain=false, fyLastErr=null;
    function fySave(){ if(fyCfg) fyRawWrite("fyCfg", fyCfg); }
    function fySyncSoon(ms, keep){ ms=ms||0; var due=Date.now()+ms; if(fySyncT && keep!==false && fySyncDue && fySyncDue<=due) return; clearTimeout(fySyncT); fySyncDue=due; fySyncT=setTimeout(function(){ fySyncT=null; fySyncDue=0; if(!document.hidden) fySync(); }, ms); }
    function fyPlanNext(){ if(!fyCfg || document.hidden) return; if(fyDirtyAt) return; clearTimeout(fySyncT); fySyncT=null; fySyncSoon(FY_LADDER[Math.min(fyIdle, FY_LADDER.length-1)]); }
    function fySync(){
      if(DEMO){ if(fyCfg){ fyCfg.lastOk=Date.now(); fyLastErr=null; } return Promise.resolve(); }
      if(!fyCfg || !fyCfg.tok) return Promise.resolve();
      if(fySyncing){ fyAgain=true; return Promise.resolve(); }
      fySyncing=true; fyNew=false; fyLastAt=Date.now();
      if(Object.keys(fyDirty).length){ clearTimeout(fyDetT); fyFlush(); }
      fyDirtyAt=0; clearTimeout(fySyncT); fySyncT=null; fySyncDue=0;
      var p=(fyCfg.role==="owner") ? fyOwnerSync() : fyMemberSync();
      return p.then(function(){ if(fyCfg){ fyCfg.lastOk=Date.now(); fyCfg.err=null; } fyLastErr=null; }).catch(function(e){
        if(e && e.fyGone) return fyHandleGone(e.fyGone, e.purged);
        fyLastErr=(e && e.message) || String(e); console.warn("foyer :", e);
      }).then(function(){
        fySyncing=false; fySave();
        if(state.view==="foyer" && !fyBusyUI()) render();
        fyIdle=fyNew ? 0 : fyIdle+1;
        if(fyAgain){ fyAgain=false; fySyncSoon(1000); } else fyPlanNext();
      });
    }
    function fyAgo(t){ if(!t) return "jamais"; var s=Math.round((Date.now()-t)/1000); if(s<60) return "à l'instant"; if(s<3600) return "il y a "+Math.round(s/60)+" min"; if(s<86400) return "il y a "+Math.round(s/3600)+" h"; return "le "+new Date(t).toLocaleDateString("fr-FR"); }
    function fySyncLabel(){ if(!fyCfg) return ""; if(fyLastErr && (!fyCfg.lastOk || Date.now()-fyCfg.lastOk>120000)) return "hors ligne · à jour "+fyAgo(fyCfg.lastOk); return "à jour "+fyAgo(fyCfg.lastOk); }
    // ----- consultation / onglets -----
    function fyApplyMode(){
      document.body.classList.toggle("fy-ro", fyMember() && (fyCfg.role==="view" || !fyTabEd("list")));   // pas de Scan sans l'Accueil en modification
      document.body.classList.toggle("fy-mem", fyMember());
    }
    function fyNavFilter(){
      [].forEach.call(navEl.querySelectorAll(".navi"), function(b){ var v=b.getAttribute("data-view"); b.style.display=(fyMember() && !(v==="depenses" ? depSubs().length>0 : (v==="compte" ? true : (v==="factures" ? avTabOn(fyCfg) : fyTabOn(fyCfg, v)))))?"none":""; });
    }
    function fyViewGuard(){
      if(!fyMember() || !FY_SUB) return;
      var v=state.view; if(v==="foyer" || v==="bilan") return;
      if(v==="form" || v==="photo"){ if((fyCfg.role==="edit" && fyTabEd("list")) || state.draftRO || v==="photo") return; state.view=fyFirstTab(); state.draft=null; return; }   // modification : saisir ; consultation : voir un ticket
      var tb=FY_SUB[v]||v; if(!(v==="factures" ? avTabOn(fyCfg) : fyTabOn(fyCfg, tb))) state.view=fyFirstTab();
    }
    function fyRoStrip(){
      if(!fyRO()) return;
      [].forEach.call(app.querySelectorAll("button, a.btn"), function(b){
        var t=(b.textContent||"").trim(), id=b.id||"", cl=" "+(b.className||"")+" ";
        if(/^(✎|✕|🔗|▲|▼|⋯|＋|\+ )/.test(t) || /^(add|del|edit|comParts$|budEdit$|manual2$)/i.test(id) || /(edit|del|more|addprl|linkbtn) /.test(cl)) b.style.display="none";
      });
    }
    // ----- code + empreinte sur les téléphones du foyer (08/11 : fortement conseillés, plus obligatoires) -----
    // Chaque téléphone choisit les siens (propriétaire à la création, membre en rejoignant) : un code est personnel.
    // « Passer » est retenu (lockSkip, ou lockCfg.bioSkip pour l'empreinte) ; Réglages › Code et empreinte pour changer d'avis.
    // L'empreinte n'est proposée qu'avec un code et un lecteur où une empreinte est enregistrée (fyBioOk).
    var fyBioOk=null;
    function fyCheckBio(){
      var NB=nativeBio();
      if(NB && NB.biometricAvailable) return NB.biometricAvailable().then(function(r){ fyBioOk=!!(r && r.available); }).catch(function(){ fyBioOk=false; });
      if(window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) return PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().then(function(ok){ fyBioOk=!!ok; }).catch(function(){ fyBioOk=false; });
      fyBioOk=false; return Promise.resolve();
    }
    function fyEnsureLock(after){
      if(!fyCfg || DEMO){ if(after) after(); return; }
      if(document.getElementById("lockscreen")){ setTimeout(function(){ fyEnsureLock(after); }, 600); return; }
      fyCheckBio().then(function(){
        if(lockCfg && (lockCfg.bioId || lockCfg.bioSkip || !fyBioOk)){ if(after) after(); return; }
        if(!lockCfg && store.read("lockSkip", null)){ if(after) after(); return; }
        fyLockScreen(after);
      });
    }
    function fyLockScreen(after){
      var ov=document.createElement("div"); ov.id="lockscreen"; ov.setAttribute("data-setup","1");
      document.body.appendChild(ov);
      var step=lockCfg?2:1, first="", typed="";
      function paint(){
        var h='<div class="lk-in"><div class="lk-ic">🛡️</div><div class="lk-t">Protège ce téléphone</div>';
        h+='<div class="lk-s">Fortement conseillé : ce sont les comptes du foyer'+(fyCfg.owner?' de '+esc(fyCfg.owner):'')+'. Choisis ton propre code'+(fyBioOk?', puis ton empreinte':'')+' : '+APP_NAME+' les demandera à chaque ouverture.</div>';
        h+='<div class="fy-steps"><span class="'+(step>1?'ok':'on')+'">'+(step>1?'✓':'1')+' Ton code</span>'+(fyBioOk?'<span class="'+(step===2?'on':'')+'">2 Ton empreinte</span>':'')+'</div>';
        if(step===1){
          h+='<div class="lk-s" style="margin-top:14px">'+(first?'Tape-le une deuxième fois':'Choisis un code de 6 chiffres')+'</div><div class="lk-dots">';
          for(var i=0;i<6;i++) h+='<i class="'+(i<typed.length?'f':'')+'"></i>';
          h+='</div><div class="lk-err"></div><div class="lk-pad">';
          ["1","2","3","4","5","6","7","8","9","","0","del"].forEach(function(k){ h+=k===""?'<span></span>':(k==="del"?'<button type="button" class="lk-x" data-k="del">⌫</button>':'<button type="button" data-k="'+k+'">'+k+'</button>'); });
          h+='</div><button type="button" class="btn ghost" id="fySkip" style="margin-top:14px;width:100%">Passer</button>';
        } else {
          h+='<button type="button" class="btn primary" id="fyBio" style="margin-top:26px;width:100%">👆 Ajouter mon empreinte</button><div class="lk-err" style="margin-top:10px"></div>';
          h+='<button type="button" class="btn ghost" id="fySkipB" style="margin-top:10px;width:100%">Pas d\'empreinte · le code suffit</button>';
        }
        h+='<div class="lk-s" style="margin-top:16px">Le code et l\'empreinte ne quittent jamais ce téléphone. Tu peux les changer dans Réglages › Code et empreinte.</div></div>';
        ov.innerHTML=h;
        [].forEach.call(ov.querySelectorAll("button[data-k]"), function(b){ b.onclick=function(){ key(b.getAttribute("data-k")); }; });
        var bb=ov.querySelector("#fyBio"); if(bb) bb.onclick=bio;
        var sk=ov.querySelector("#fySkip"); if(sk) sk.onclick=skip;
        var sb=ov.querySelector("#fySkipB"); if(sb) sb.onclick=function(){ lockCfg.bioSkip=1; store.write("lockCfg", lockCfg); done(); };
      }
      function skip(){
        uiConfirm("<b>Continuer sans code ?</b><br><small style=\"color:var(--ink-soft)\">Sans code, quiconque ouvre ton téléphone voit les comptes du foyer. Tu pourras en ajouter un dans Réglages › Code et empreinte.</small>",
          function(){ store.write("lockSkip", 1); try{ document.body.removeChild(ov); }catch(e){} render(); if(after) after(); }, { ok:"Continuer sans code", no:"Mettre un code" });
        var L=document.querySelectorAll(".sheet-overlay"); if(L.length) L[L.length-1].classList.add("lk-top");
      }
      function err(t){ var e=ov.querySelector(".lk-err"); if(e) e.textContent=t; }
      function key(k){
        if(k==="del"){ typed=typed.slice(0,-1); paint(); return; }
        if(typed.length>=6) return;
        typed+=k; paint();
        if(typed.length<6) return;
        if(!first){ first=typed; typed=""; paint(); return; }
        if(first!==typed){ first=""; typed=""; paint(); err("Les deux codes ne correspondent pas, recommence."); return; }
        var salt=b64(randBytes(16)), pin=typed;
        hashPin(pin, salt, 2).then(function(hv){
          lockCfg={ hash:hv, salt:salt, len:6, bioId:(lockCfg&&lockCfg.bioId)||null, v:2 }; store.write("lockCfg", lockCfg); store.remove("lockSkip");
          if(fyBioOk){ step=2; paint(); } else done();
        });
      }
      function bio(){
        var NB=nativeBio();
        var p=(NB && NB.biometric) ? NB.biometric({ title:"Ajouter l'empreinte", subtitle:"Pose ton doigt pour confirmer", cancel:"Annuler" }).then(function(){ return "native"; })
          : navigator.credentials.create({ publicKey:{ challenge:randBytes(32), rp:{ name:""+APP_NAME+"" }, user:{ id:randBytes(16), name:"tickets", displayName:""+APP_NAME+"" },
              pubKeyCredParams:[{ type:"public-key", alg:-7 },{ type:"public-key", alg:-257 }], authenticatorSelection:{ authenticatorAttachment:"platform", userVerification:"required", residentKey:"discouraged" }, timeout:60000, attestation:"none" } }).then(function(c){ return b64(c.rawId); });
        p.then(function(id){ lockCfg.bioId=id; delete lockCfg.bioSkip; store.write("lockCfg", lockCfg); done(); }).catch(function(){ err("Empreinte non enregistrée : réessaie."); });
      }
      function done(){ try{ document.body.removeChild(ov); }catch(e){} uiToast("Téléphone protégé ✓"); render(); if(after) after(); }
      paint();
    }
    // ----- écrans -----
    function fyPlusOk(){
      if(canUse("foyer")) return true;
      plusShow("foyer");
      return false;
    }
    function fyStatus(id){
      var s=fyCfg.srv && fyCfg.srv[id], m=fyCfg.members[id];
      if(s && !s.pending) return { c:"var(--accent)", t:"à jour "+fyAgo(s.seen||s.joined) };
      var exp=(s && s.exp) || m.exp || 0;
      if(exp>Date.now()){ var r=Math.max(0, Math.round((exp-Date.now())/1000)); return { c:"#e6b450", t:"en attente du scan · "+Math.floor(r/60)+":"+("0"+(r%60)).slice(-2) }; }
      return { c:"var(--coral)", t:"invitation expirée · nouveau QR code" };
    }
    var FY_COLS=["#c78bd6","#e0a458","#5bc0d4","#e88fb0","#9bd35e","#7c9cf4","#d6c35c"];
    // code de ce téléphone : rappel s'il n'y en a pas (08/11)
    function fyLockRow(){
      if(lockCfg) return '<div class="fy-info"><span>🔒</span><span><b>Code actif sur ce téléphone'+(lockCfg.bioId?' · empreinte':'')+'</b><small>Chaque téléphone du foyer a le sien. Réglages › Code et empreinte.</small></span></div>';
      return '<button type="button" class="fy-mrow" id="fyLk"><span class="fy-ic">🔓</span><span class="fy-grow"><b style="color:var(--coral)">Pas de code sur ce téléphone · Ajouter</b><small>Fortement conseillé : sans code, quiconque ouvre ton téléphone voit les comptes du foyer.</small></span><span class="chev">›</span></button>';
    }
    function fyBackupRow(){
      var on=drvOn(), a=backupAge(), t, sub, col="";
      if(on){ var ml=drvMenuLabel(); t="Sauvegarde : "+ml.t.replace("Drive · ","Google Drive · "); sub="Automatique, avec ton foyer et ses membres. Comment ça marche ?"; }
      else if(a.days===null){ t="Aucune sauvegarde"; sub="Sans sauvegarde, un téléphone perdu = données et foyer perdus. Touche pour en faire une."; col=' style="color:var(--coral)"'; }
      else { t="Dernière sauvegarde : "+a.label; sub=(a.days>=7?"Pense à en refaire une. ":"")+"Elle contient ton foyer et ses membres. Comment ça marche ?"; if(a.days>=7) col=' style="color:var(--coral)"'; }
      return '<button type="button" class="fy-mrow" id="fyBk"><span class="fy-ic">💾</span><span class="fy-grow"><b'+col+'>'+esc(t)+'</b><small>'+esc(sub)+'</small></span><span class="chev">›</span></button>';
    }
    function fyAvatar(name, i, big){ return '<span class="fy-av'+(big?' big':'')+'" style="background:'+(i<0?'var(--accent)':FY_COLS[i%FY_COLS.length])+'">'+esc((name||"?").charAt(0).toUpperCase())+'</span>'; }
    function renderFoyer(){
      var h=header(true, fyMember()?"Foyer partagé":"Foyer partagé")+'<section class="fy-page">';
      if(!fyCfg){
        h+='<div class="fy-card fy-hero"><div class="fy-big">👨‍👩‍👧 Suivre les comptes à plusieurs</div><div class="fy-txt">Ta famille voit les comptes sur son propre téléphone. Tu choisis pour chacun : <b>consultation</b> (il voit, ne modifie rien : idéal pour un enfant) ou <b>modification</b> (il ajoute ses tickets, la dernière modification gagne), et les onglets et comptes qu\'il voit.</div>'+
          '<div class="fy-txt muted">Tout est chiffré sur les téléphones avant de partir : le relais ne peut rien lire. Chaque téléphone choisit son code et son empreinte (fortement conseillé).</div></div>';
        h+='<div class="ui-stack"><button type="button" class="btn primary" id="fyNew">Créer mon foyer'+(canUse("foyer")?'':' · Plus')+'</button><button type="button" class="btn" id="fyJoin">Rejoindre un foyer (QR code)</button><button type="button" class="btn ghost" id="fyRec">Retrouver mon foyer (restaurer une sauvegarde)</button></div>';
      } else if(fyCfg.role==="owner"){
        var ids=Object.keys(fyCfg.members||{});
        h+='<div class="fy-card fy-own">'+fyAvatar(mePerson(), -1, true)+'<div class="fy-grow"><b>'+esc(mePerson())+'</b> <span class="fy-you">· toi</span><small>Propriétaire du foyer · tu choisis ce que chacun voit</small></div></div>';
        if(fyCfg.err) h+='<div class="fy-warn">'+esc(fyCfg.err)+(fyCfg.purged?' <button type="button" class="btn small primary" id="fyRe" style="margin-top:8px">Recréer le foyer</button>':'')+'</div>';
        h+='<div class="fy-sec">'+ids.length+' membre'+(ids.length>1?'s':'')+'</div>';
        if(ids.length){
          h+='<div class="fy-card fy-list">';
          ids.forEach(function(id, i){ var m=fyCfg.members[id], st=fyStatus(id);
            h+='<button type="button" class="fy-mrow" data-m="'+esc(id)+'">'+fyAvatar(m.name, i)+'<span class="fy-grow"><b>'+esc(m.name)+'</b><small>'+esc(fyRightsLabel(m)+(m.accts!=null?' ('+fyAcctsLabel(m)+')':''))+'</small><small style="color:'+st.c+'">● '+esc(st.t)+'</small></span><span class="chev">›</span></button>'; });
          h+='</div>';
        }
        h+='<button type="button" class="btn fy-add" id="fyAdd">＋ Ajouter un membre</button>';
        h+='<div class="fy-sec">Sécurité</div><div class="fy-card fy-list">'+
          fyLockRow()+
          '<div class="fy-info"><span>🔄</span><span><b>Copies des membres '+esc(fySyncLabel())+'</b><small>Chiffrées sur ton téléphone : illisibles sans vos clés.</small></span></div>'+
          fyBackupRow()+
          '<div class="fy-info"><span>⏳</span><span><b>Effacé s\'il ne sert plus</b><small>Après 3 mois sans utilisation par aucun téléphone du foyer (15 jours si personne ne l\'a rejoint). Tes données restent sur ton téléphone.</small></span></div>'+
          '<button type="button" class="fy-mrow" id="fyCode"><span class="fy-ic">🔑</span><span class="fy-grow"><b>Mon code de secours</b><small>À noter et garder précieusement</small></span><span class="chev">›</span></button></div>';
        h+='<button type="button" class="btn ghost fy-stop" id="fyStop">Arrêter le partage</button>';
      } else {
        h+='<div class="fy-card fy-own">'+fyAvatar(fyCfg.owner||"?", -1, true)+'<div class="fy-grow"><b>Foyer de '+esc(fyCfg.owner||"…")+'</b><small>Tu es '+esc(fyCfg.me||"")+' · '+esc(fyRightsLabel(fyCfg).toLowerCase())+'</small></div></div>';
        h+='<div class="fy-card fy-list"><div class="fy-info"><span>'+(fyRO()?'👁️':'✏️')+'</span><span><b>'+esc(fyRightsLabel(fyCfg))+'</b><small>'+(fyRO()?'Tu vois les chiffres, tu ne peux rien modifier.':'Tes tickets et changements partent au foyer ; la dernière modification gagne.')+'</small></span></div>'+
          fyLockRow()+'<div class="fy-info"><span>🗂️</span><span><b>Ce que tu vois</b><small>'+esc(fyTabsLabel(fyCfg)+(fyCfg.accts!=null?' · '+fyAcctsLabel(fyCfg):''))+'</small></span></div>'+
          '<div class="fy-info"><span>☁️</span><span><b>'+esc(fySyncLabel().replace(/^./, function(c){ return c.toUpperCase(); }))+'</b><small>'+(fyRole()==="edit" && Object.keys(fyPend).length?Object.keys(fyPend).length+' changement(s) en attente du téléphone de '+esc(fyCfg.owner||"")+'.':'Copie chiffrée reçue du téléphone de '+esc(fyCfg.owner||"")+'.')+'</small></span></div></div>';
        h+='<button type="button" class="btn" id="fyNow">Mettre à jour maintenant</button><button type="button" class="btn ghost fy-stop" id="fyLeave">Quitter le foyer</button>';
      }
      h+='</section>';
      app.innerHTML=h;
      setNav(null,false);
      bindBack(function(){ state.view=fyMember()?fyFirstTab():"list"; render(); window.scrollTo(0,0); });
      function on(id, fn){ var b=document.getElementById(id); if(b) b.onclick=fn; }
      on("fyNew", fyCreate); on("fyRe", fyRecreate); on("fyJoin", function(){ fyJoin(); }); on("fyRec", drvRestoreChooser); on("fyBk", function(){ backupData(); }); on("fyLk", lockSetup);
      on("fyAdd", function(){ fyMemberForm(null); }); on("fyCode", function(){ fyShowRecovery(false); }); on("fyStop", fyStop);
      on("fyNow", function(){ uiToast("Mise à jour…"); fySync().then(function(){ render(); }); }); on("fyLeave", fyLeave);
      [].forEach.call(app.querySelectorAll("[data-m]"), function(b){ b.onclick=function(){ fyMemberMenu(b.getAttribute("data-m")); }; });
    }
    function fyCreate(){
      if(!fyPlusOk()) return;
      if(!window.crypto || !crypto.subtle){ uiToast("Foyer partagé indisponible sur ce navigateur"); return; }
      uiConfirm("Créer ton foyer partagé ?<br><small style=\"color:var(--ink-soft)\">Tu en es le propriétaire : tes données restent sur ton téléphone, chaque membre reçoit une copie chiffrée de ce que tu choisis. Un code et ton empreinte seront demandés à l'ouverture de "+APP_NAME+".<br>Le foyer est effacé s'il n'est pas utilisé pendant 3 mois, ou si personne ne le rejoint en 15 jours ; tes données restent sur ton téléphone.</small>", function(){
        var ds=store.read("driveSec", null), sec=ds ? fyUnb64u(ds) : randBytes(16);   // même code que la sauvegarde Drive
        fyFromSecret(sec).then(function(o){
          return fySha(o.tok).then(function(hh){ return fyCall("POST","/create",{ fid:o.fid, otok:hh }, true); }).then(function(r){
            if(r.status===429) throw new Error("trop de foyers créés aujourd'hui depuis ce réseau : réessaie en Wi-Fi ou demain");
            if(r.status!==200) throw new Error(r.j.error||("relais "+r.status));
            fyCfg={ role:"owner", fid:o.fid, tok:o.tok, key:o.key, sec:fyB64u(sec), members:{}, created:Date.now(), lastOk:Date.now() };
            fySave(); fyMt={}; fyRawWrite("fyMt", fyMt); fyResetBase();
            state.view="foyer"; render();
            fyEnsureLock(function(){ fyShowRecovery(true); });
            fyBkSeal(true);
          });
        }).catch(function(e){ uiToast("Création impossible : "+((e && e.message)||"réseau")+". Réessaie connecté à Internet."); });
      }, { ok:"Créer" });
    }
    function fyFromSecret(sec){
      return Promise.all([fyHkdf(sec,"id",16), fyHkdf(sec,"auth",24), fyHkdf(sec,"data",32)]).then(function(a){ return { fid:fyB64u(a[0]), tok:fyB64u(a[1]), key:fyB64u(a[2]) }; });
    }
    // Après la création du foyer : le protéger par une sauvegarde (le foyer y est, avec ses membres)
    function fyBackupAsk(){
      if(window.__tkNoWelcome && !window.__fyBkAskTest) return;   // tests : pas de question (sauf ceux qui la testent)
      if(drvOn()) return;
      var a=backupAge(); if(a.days!==null && a.days<7) return;
      uiChoice("Protège ton foyer", esc("Téléphone perdu ou changé ? Ta sauvegarde et ton code de secours te rendent tes données et ton foyer : tes membres gardent leur accès. Sans sauvegarde, tes données sont perdues et il faut recréer le foyer."),
        [ drvNative() ? { l:"☁️ Sauvegarde automatique sur Google Drive", fn:drvIntro } : null,
          { l:"📂 Faire une sauvegarde maintenant (fichier)", primary:!drvNative(), fn:function(){ backupData(); } },
          { l:"Plus tard", primary:false, fn:function(){} } ].filter(function(x){ return x; }));
    }
    function fyShowRecovery(first){
      if(!fyCfg || !fyCfg.sec) return;
      var code=fyCodeTxt(fyCfg.sec);
      var s=uiSheet('<div class="sheet-title">Code de secours</div><div class="ui-intro">'+(first?'Ton foyer est prêt. ':'')+'Avec ce code et ta sauvegarde (Google Drive ou fichier), tu retrouves tes données et ton foyer sur un nouveau téléphone : tes membres gardent leur accès. <b>Note-le</b> sur papier ou dans un gestionnaire de mots de passe, et ne le donne à personne.</div>'+
        '<div class="fy-code">'+esc(code)+'</div><div class="ui-stack"><button type="button" class="btn" id="fyCopy">Copier le code</button><button type="button" class="btn primary ui-no">'+(first?'Je l\'ai noté':'Fermer')+'</button></div>');
      s.q(".ui-no").onclick=function(){ s.close(); if(first) fyBackupAsk(); };
      s.q("#fyCopy").onclick=function(){ try{ navigator.clipboard.writeText(code.replace(/-/g,"")).then(function(){ uiToast("Code copié"); }, function(){ uiToast("Copie impossible : recopie-le à la main"); }); }catch(e){ uiToast("Copie impossible : recopie-le à la main"); } };
    }
    // Ajouter un membre / modifier ses droits
    function fyMemberForm(id){
      var M=id ? fyCfg.members[id] : null, me=mePerson();
      var names=uniquePersons().filter(function(p){ return p!==me && !Object.keys(fyCfg.members).some(function(k){ return k!==id && fyCfg.members[k].name===p; }); });
      var st={ tk:M?(M.tk||"own"):"own", name:M?M.name:"", role:M?M.role:"view", tabs:M?(M.tabs||FY_TABS.map(function(t){ return t.v; })).slice():["list","compte"], accts:M?(M.accts==null?null:M.accts.slice()):null, touched:!!M };
      // par défaut : en consultation, ses propres comptes ; en modification, tous les comptes
      function defAccts(){ if(st.touched) return; var a=comptes.filter(function(c){ return st.name && acctOwner(c)===st.name; }).map(function(c){ return c.key; }); st.accts=(a.length && st.role==="view")?a:null; }
      if(!M) defAccts();
      // droit de chaque onglet : « off » (masqué), « r » (lecture), « w » (modification)
      st.mode={}; FY_TABS.forEach(function(t){ var vis=M ? fyTabOn(M, t.v) : (t.v==="list" || t.v==="compte"); st.mode[t.v]=!vis ? "off" : (M && fyEdTabs(M).indexOf(t.v)>=0 && t.v!=="analyse" && t.v!=="bourse" ? "w" : "r"); });   // Analyse et Bourse : lecture au plus
      function syncMode(){ st.tabs=FY_TABS.map(function(t){ return t.v; }).filter(function(v){ return st.mode[v]!=="off"; }); st.role=FY_TABS.some(function(t){ return st.mode[t.v]==="w"; }) ? "edit" : "view"; }
      syncMode();
      var s=uiSheet('<div class="sheet-title">'+(M?'Droits de '+esc(M.name):'Ajouter un membre')+'</div><div class="ui-intro">Son téléphone reçoit seulement ce que tu choisis ici, chiffré.</div><div id="fyF"></div>');
      function draw(){
        var h='';
        if(!M){
          h+='<label class="ui-l" for="fyName">Prénom</label><input class="f" id="fyName" type="text" value="'+esc(st.name)+'" placeholder="Ex. : Léa" autocomplete="off">';
          if(names.length) h+='<div class="fy-chips">'+names.map(function(n){ return '<button type="button" class="chip'+(n===st.name?' on':'')+'" data-n="'+esc(n)+'">'+esc(n)+'</button>'; }).join("")+'</div>';
        }
        var noTab=function(v){ return st.accts!=null && !st.accts.length && v==="compte"; };   // aucun compte : pas d'onglet Compte (Commun et Bourse ne sont pas des comptes)
        var TAB_SUB={ list:"toujours visible · ses chiffres · saisie, scan", articles:"articles, catégories, budgets", communes:"frais fixes, parts", compte:"comptes, virements, épargne, provisions", bourse:"modifiée sur ton téléphone", analyse:"toujours en lecture" };
        h+='<label class="ui-l">Droits par onglet</label><div class="fy-quick"><button type="button" data-q="r">Tout en lecture</button><button type="button" data-q="w">Tout en modification</button></div>';
        h+='<div class="fy-rights">'+FY_TABS.map(function(t){ var off=noTab(t.v), md=off?"off":st.mode[t.v], noW=(t.v==="analyse" || t.v==="bourse");
          return '<div class="fy-rr'+(off?' dis':'')+'"><span class="n">'+esc(t.l)+'<small>'+esc(off?(st.accts && !st.accts.length && t.v==="compte"?"aucun compte choisi":"pas avec des comptes choisis"):TAB_SUB[t.v])+'</small></span><span class="fy-seg3">'+
            [["off","Masqué"],["r","Lecture"],["w","Modif."]].map(function(o){ var dis=off || (o[0]==="w" && noW) || (o[0]==="off" && t.v==="list"); return '<button type="button" data-tm="'+t.v+'" data-v="'+o[0]+'"'+(md===o[0]?' class="on"':'')+(dis?' disabled':'')+'>'+o[1]+'</button>'; }).join("")+'</span></div>'; }).join("")+'</div>';
        h+='<div class="ui-help">Les tickets se modifient avec l\'Accueil ; le contrôle se fait sur ton téléphone : un changement venant d\'un onglet en lecture est refusé.</div>';
        if(comptes.length){   // même avec un seul compte : « Aucun · ses tickets » doit rester possible
          h+='<label class="ui-l">Comptes visibles</label><div class="fy-chips"><button type="button" class="chip'+(st.accts==null?' on':'')+'" data-a="__all">Tous</button><button type="button" class="chip'+(st.accts && !st.accts.length?' on':'')+'" data-a="__none">Aucun · ses tickets</button>'+comptes.map(function(a){ var on=st.accts!=null && st.accts.indexOf(a.key)>=0; return '<button type="button" class="chip'+(on?' on':'')+'" data-a="'+esc(a.key)+'">'+esc(a.nom)+(acctOwner(a)?' · '+esc(acctOwner(a)):'')+'</button>'; }).join("")+'</div>';
          if(st.accts && !st.accts.length) h+='<div class="ui-help">Ses tickets arrivent chez toi (Articles, Analyse, dépenses) sans toucher à aucun compte.</div>';
          else if(st.accts!=null) h+='<div class="ui-help">Avec des comptes choisis, il ne reçoit que leurs virements, soldes et frais perso.</div>';
          if(st.accts!=null && st.mode.communes!=="off") h+='<div class="ui-help">Commun : les frais communs, les parts et ses frais perso ; les articles partagés des autres seulement avec « Tickets visibles : tout le foyer ».</div>';
          if(st.accts!=null){
            h+='<label class="ui-l">Tickets visibles</label><div class="ui-seg" id="fyTk"><button type="button" data-v="own"'+(st.tk!=="all"?' class="on"':'')+'>Les siens</button><button type="button" data-v="all"'+(st.tk==="all"?' class="on"':'')+'>Tout le foyer</button></div>';
            h+='<div class="ui-help">'+(st.tk==="all"?'Il voit les tickets de chacun (Accueil, Articles, Analyse, par personne), sans les comptes ni les soldes. Il ne peut modifier que les siens.':'Il ne voit que ses propres tickets'+(st.accts.length?' et ceux de ses comptes':'')+'.')+'</div>';
          }
        }
        var visW=FY_TABS.filter(function(t){ return st.mode[t.v]==="w" && !noTab(t.v); }).map(function(t){ return t.l; }), visR=FY_TABS.filter(function(t){ return st.mode[t.v]==="r" && !noTab(t.v); }).map(function(t){ return t.l; });
        h+='<div class="fy-sum">'+esc((st.name||"Ce membre")+(visW.length?" pourra modifier : "+visW.join(", ")+(visR.length?" et consulter : "+visR.join(", "):""):" pourra consulter : "+(visR.join(", ")||"rien"))+(comptes.length?" · "+(st.accts==null?"tous les comptes":(fyAcctsLabel({accts:st.accts, tk:st.tk}))):"")+". Rien d'autre ne part sur son téléphone.")+'</div>';
        h+='<div class="ui-err" style="display:none"></div><div class="ui-actions"><button type="button" class="btn ghost ui-no">Annuler</button><button type="button" class="btn primary" id="fyOk">'+(M?'Enregistrer':'Créer le QR code')+'</button></div>';
        s.q("#fyF").innerHTML=h;
        var ni=s.q("#fyName"); if(ni){ ni.oninput=function(){ st.name=ni.value.trim(); defAccts(); }; ni.onchange=function(){ draw(); }; }
        [].forEach.call(s.qa("[data-n]"), function(b){ b.onclick=function(){ st.name=b.getAttribute("data-n"); defAccts(); draw(); }; });
        [].forEach.call(s.qa("[data-tm]"), function(b){ b.onclick=function(){ if(b.disabled) return; st.mode[b.getAttribute("data-tm")]=b.getAttribute("data-v"); syncMode(); if(!M) defAccts(); draw(); }; });
        [].forEach.call(s.qa("[data-q]"), function(b){ b.onclick=function(){ var q=b.getAttribute("data-q"); FY_TABS.forEach(function(t){ st.mode[t.v]=(q==="w" && t.v!=="analyse" && t.v!=="bourse") ? "w" : "r"; }); syncMode(); if(!M) defAccts(); draw(); }; });
        [].forEach.call(s.qa("#fyTk button"), function(b){ b.onclick=function(){ st.tk=b.getAttribute("data-v"); draw(); }; });
        [].forEach.call(s.qa("[data-a]"), function(b){ b.onclick=function(){ st.touched=true; var a=b.getAttribute("data-a");
          if(a==="__all") st.accts=null; else if(a==="__none") st.accts=[]; else { if(st.accts==null) st.accts=[]; var i=st.accts.indexOf(a); if(i>=0) st.accts.splice(i,1); else st.accts.push(a); if(!st.accts.length) st.accts=null; }
          draw(); }; });
        s.q(".ui-no").onclick=s.close;
        s.q("#fyOk").onclick=function(){
          var er=s.q(".ui-err"); function bad(t){ er.textContent=t; er.style.display=""; }
          if(!M){ st.name=(s.q("#fyName").value||"").trim(); if(!st.name) return bad("Indique son prénom."); if(st.name===me) return bad("C'est ton prénom : choisis celui du membre."); }
          syncMode(); if(!st.tabs.length) return bad("Mets au moins un onglet en lecture ou en modification.");
          var tabs=FY_TABS.map(function(t){ return t.v; }).filter(function(v){ return st.tabs.indexOf(v)>=0; });
          if(st.accts!=null){ tabs=tabs.filter(function(v){ return st.accts.length || v!=="compte"; }); if(!tabs.length) return bad(st.accts.length?"Avec des comptes choisis, le Commun et la Bourse ne sont pas visibles : choisis un autre onglet.":"Sans compte, choisis au moins l'Accueil, les Articles ou l'Analyse."); }
          var b=s.q("#fyOk"); b.disabled=true;
          if(M){
            var roleCh=M.role!==st.role;
            (roleCh ? fyCall("PATCH","/member/"+id,{ role:st.role }) : Promise.resolve({ status:200 })).then(function(r){
              if(r.status!==200) throw new Error("relais "+r.status);
              M.role=st.role; M.tabs=tabs; M.ed=tabs.filter(function(v){ return st.mode[v]==="w"; }); M.accts=st.accts; M.tk=(st.accts!=null && st.tk==="all")?"all":"own"; fyVer++; fySave(); s.close(); render(); uiToast("Droits de "+M.name+" enregistrés"); fySyncSoon(0);
            }).catch(function(e){ b.disabled=false; bad("Pas de connexion au relais : réessaie."); });
            return;
          }
          var mid=fyRand(9), km=fyRand(32);
          fyEnsurePerson(st.name);
          fyCfg.members[mid]={ name:st.name, role:st.role, tabs:tabs, ed:tabs.filter(function(v){ return st.mode[v]==="w"; }), accts:st.accts, tk:(st.accts!=null && st.tk==="all")?"all":"own", km:km, created:Date.now(), ack:0 };
          fyInvite(mid).then(function(){ s.close(); render(); }).catch(function(e){ delete fyCfg.members[mid]; fySave(); b.disabled=false; bad("Pas de connexion au relais : réessaie."); });
        };
      }
      draw();
    }
    // Nouvelle invitation (QR code valable 10 minutes, une seule fois)
    function fyInvite(mid){
      var m=fyCfg.members[mid], inv=fyRand(16), exp=Date.now()+10*60000;
      // nouvelle clé à chaque invitation (08/11, revue M5) : un ancien QR code ou texte d'invitation ne lit plus rien
      if(m.joinedOnce || m.km){ m.km=fyRand(32); delete fyPubH[mid]; fyRawWrite("fyPubH", fyPubH); }
      return fySha(inv).then(function(hh){ return fyCall("PUT","/member/"+mid,{ role:m.role, inv:hh, exp:exp }); }).then(function(r){
        if(r.status!==200) throw new Error(r.j.error||("relais "+r.status));
        m.exp=r.j.exp||exp; delete m.joinedOnce; m.sh=null; fyVer++; fySave();
        fyPublishAll();   // sa copie est prête quand il scanne
        fyShowQr(mid, "TK1."+fyCfg.fid+"."+mid+"."+inv+"."+m.km);
      });
    }
    function fyShowQr(mid, text){
      var m=fyCfg.members[mid];
      var s=uiSheet('<div class="sheet-title">Inviter '+esc(m.name)+'</div><div class="fy-qr">'+qrSvg(text, 236)+'</div>'+
        '<div class="fy-qrt"><b>Scanne ce code avec '+APP_NAME+' sur le téléphone de '+esc(m.name)+'</b><small id="fyExp"></small></div>'+
        '<div class="fy-qrhow"><b>Avant</b> : installe '+APP_NAME+' sur son téléphone, puis dans l\'appli : Menu › Gérer › Foyer partagé › Rejoindre un foyer (pas avec l\'appareil photo du téléphone).'+((EDITION==="store" && plusOwn()) ? ' Ton '+APP_NAME+' Plus couvre '+esc(m.name)+' : rien à acheter.' : '')+'</div>'+
        '<div class="fy-card fy-list fy-recap"><div><span>Accès</span><b>'+esc(fyRightsLabel(m))+'</b></div><div><span>Onglets</span><b>'+esc(fyTabsLabel(m))+'</b></div>'+(comptes.length?'<div><span>Comptes</span><b>'+esc(fyAcctsLabel(m))+'</b></div>':'')+'<div><span>Sur son téléphone</span><b style="color:var(--accent)">son code et son empreinte (conseillés)</b></div></div>'+
        '<div class="ui-stack"><button type="button" class="btn ghost" id="fyShare">Le QR ne passe pas ? Envoyer l\'invitation</button><button type="button" class="btn primary ui-no">Terminé</button></div>');
      var tick=setInterval(function(){
        var e=s.q("#fyExp"); if(!e || !document.body.contains(s.ov)){ clearInterval(tick); return; }
        var r=Math.round(((m.exp||0)-Date.now())/1000);
        e.innerHTML=r>0?'Valable encore <b>'+Math.floor(r/60)+':'+("0"+(r%60)).slice(-2)+'</b> · ne sert qu\'une seule fois':'<span style="color:var(--coral)">Expiré : ferme et crée un nouveau QR code</span>';
        if(r%3===0) fyCall("GET","/members").then(function(x){ var me2=x.status===200 && (x.j.members||[]).filter(function(y){ return y.id===mid; })[0];
          if(me2 && !me2.pending && document.body.contains(s.ov)){ clearInterval(tick); s.close(); fyCfg.srv=fyCfg.srv||{}; fyCfg.srv[mid]=me2; m.joinedOnce=1; fySave(); render(); uiToast(m.name+" a rejoint le foyer ✓"); } }).catch(function(){});
      }, 1000);
      s.q(".ui-no").onclick=function(){ clearInterval(tick); s.close(); render(); };
      s.q("#fyShare").onclick=function(){
        var msg="Invitation au foyer "+APP_NAME+" de "+mePerson()+" (valable 10 minutes, une seule fois). Dans "+APP_NAME+" : Menu › Gérer › Foyer partagé › Rejoindre un foyer, puis colle ce texte :\n"+text;
        var SH=capPlugin("Share");
        if(SH) SH.share({ title:"Invitation "+APP_NAME+"", text:msg }).catch(function(){});
        else if(navigator.share) navigator.share({ title:"Invitation "+APP_NAME+"", text:msg }).catch(function(){});
        else { try{ navigator.clipboard.writeText(text); uiToast("Invitation copiée"); }catch(e){} }
      };
    }
    function fyMemberMenu(id){
      var m=fyCfg.members[id]; if(!m) return;
      var s=fyCfg.srv && fyCfg.srv[id], joined=s && !s.pending;
      uiChoice(m.name, esc(fyRightsLabel(m)+(m.accts!=null?" · "+fyAcctsLabel(m):"")), [
        { l:"Modifier ses droits", fn:function(){ fyMemberForm(id); } },
        { l:joined?"Nouveau téléphone : nouveau QR code":"Nouveau QR code", fn:function(){
          var go=function(){ fyInvite(id).catch(function(){ uiToast("Pas de connexion au relais : réessaie."); }); };
          if(joined) uiConfirm("Créer un nouveau QR code pour "+esc(m.name)+" ?<br>Son téléphone actuel perdra l'accès au foyer.", go, { ok:"Continuer" }); else go(); } },
        { l:"Retirer du foyer", danger:true, fn:function(){
          // pas à jour depuis plus d'un jour : ce qui a été ajouté sur son téléphone depuis sera perdu
          var sv=fyCfg.srv && fyCfg.srv[id], seen=sv && (sv.seen || sv.joined), stale=!seen || Date.now()-seen>86400000;
          var warn=stale ? '<br><br><b style="color:var(--coral)">'+esc(m.name)+' n\'est pas à jour'+(seen ? ' depuis le '+new Date(seen).toLocaleDateString("fr-FR") : '')+' : ce qui a été ajouté sur son téléphone depuis sera perdu.</b><br>Demande-lui d\'ouvrir '+APP_NAME+' avec internet, puis attends « à jour à l\'instant ». Pour juste la reconnecter, « Nouveau téléphone : nouveau QR code » suffit.' : '';
          uiConfirm("Retirer "+esc(m.name)+" du foyer ?<br>Son accès et sa copie sont effacés tout de suite ; les données du foyer disparaissent de son téléphone à sa prochaine ouverture de "+APP_NAME+". Ses tickets déjà arrivés chez toi restent."+warn, function(){
            fyCall("DELETE","/member/"+id).then(function(r){
              if(r.status!==200) throw new Error();
              delete fyCfg.members[id]; if(fyCfg.srv) delete fyCfg.srv[id]; fySave(); render(); uiToast(m.name+" ne fait plus partie du foyer");
            }).catch(function(){ uiToast("Pas de connexion au relais : réessaie."); });
          }, { ok:"Retirer", danger:true }); } }
      ]);
    }
    function fyStop(){
      uiConfirm("Arrêter le partage ?<br>Le foyer est effacé du relais ; les membres perdent l'accès et les données du foyer disparaissent de leurs téléphones. Tes données restent sur ton téléphone.", function(){
        fyCall("DELETE","").then(function(r){
          if(r.status!==200 && r.status!==410) throw new Error();
          ["fyCfg","fyBase","fyMt","fyPend","fyPubH","fyBk"].forEach(function(k){ try{ store.remove(k); }catch(e){} }); fyPubH={};
          fyCfg=null; fyBase={}; fyMt={}; fyPend={}; fyApplyMode(); render(); uiToast("Partage arrêté");
        }).catch(function(){ uiToast("Pas de connexion au relais : réessaie."); });
      }, { ok:"Arrêter le partage", danger:true });
    }
    function fyLeave(){
      uiConfirm("Quitter le foyer de "+esc(fyCfg.owner||"")+" ?<br>Ses données sont effacées de ce téléphone"+(store.read("fyAvant", null)?" et tes anciennes données reviennent":"")+".", function(){
        fyCall("POST","/leave").catch(function(){}).then(function(){ fyLeaveLocal(true); });
      }, { ok:"Quitter", danger:true });
    }
    // ----- rejoindre (téléphone du membre) -----
    function fyScan(){
      var NP=capPlugin("TicketsNative");
      if(NP && typeof NP.scanQr==="function") return NP.scanQr().then(function(r){ return r && r.text; });
      if(!("BarcodeDetector" in window)) return Promise.reject(new Error("nolecteur"));
      return new Promise(function(res, rej){
        var inp=document.createElement("input"); inp.type="file"; inp.accept="image/*"; inp.setAttribute("capture","environment");
        inp.onchange=function(){ var f=inp.files && inp.files[0]; if(!f) return rej(new Error("annulé"));
          createImageBitmap(f).then(function(bmp){ return new BarcodeDetector({ formats:["qr_code"] }).detect(bmp); }).then(function(c){ if(c && c[0]) res(c[0].rawValue); else rej(new Error("aucun")); }).catch(rej); };
        inp.click();
      });
    }
    function fyJoin(text){
      if(DEMO){ uiToast("Pas en démo"); return; }
      if(fyCfg){ uiToast(fyCfg.role==="owner"?"Tu as déjà ton propre foyer":"Ce téléphone fait déjà partie d'un foyer"); return; }
      var s=uiSheet('<div class="sheet-title">Rejoindre un foyer</div><div class="ui-intro">Sur le téléphone de la personne qui t\'invite : <b>Menu › Gérer › Foyer partagé › Ajouter un membre</b>. Puis scanne son QR code.</div>'+
        '<div class="ui-stack"><button type="button" class="btn primary" id="fyScan">📷 Scanner le QR code</button></div>'+
        '<label class="ui-l" for="fyPaste">Ou colle l\'invitation reçue</label><textarea class="f" id="fyPaste" rows="3" placeholder="TK1.…">'+esc(text||"")+'</textarea>'+
        '<div class="ui-err" style="display:none"></div><div class="ui-actions"><button type="button" class="btn ghost ui-no">Annuler</button><button type="button" class="btn" id="fyGo">Rejoindre</button></div>');
      function bad(t){ var e=s.q(".ui-err"); e.textContent=t; e.style.display=t?"":"none"; }
      s.q(".ui-no").onclick=s.close;
      s.q("#fyScan").onclick=function(){ bad(""); fyScan().then(function(t){ if(t){ s.q("#fyPaste").value=t; go(); } }).catch(function(e){
        var m=String((e && e.message)||""); if(/annul|cancel/i.test(m)) return;
        bad(m==="nolecteur"?"Pas de lecteur de QR code ici : colle l'invitation ci-dessous.":(m==="aucun"?"Aucun QR code trouvé sur la photo : réessaie de plus près.":"Lecture impossible : "+m)); }); };
      s.q("#fyGo").onclick=go;
      function go(){
        var t=(s.q("#fyPaste").value||"").trim(), m=t.match(/TK1\.([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{8,16})\.([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{43})/);
        if(!m) return bad("Ce n'est pas une invitation "+APP_NAME+".");
        var has=state.entries.length || virements.length || epargne.length || fraisCommuns.length;
        var run=function(){ bad(""); var b=s.q("#fyGo"); b.disabled=true; fyJoinWith(m[1], m[2], m[3], m[4]).then(function(){ s.close(); }).catch(function(e){ b.disabled=false; bad((e && e.message)||"Pas de connexion au relais : réessaie."); }); };
        if(has) uiConfirm("Ce téléphone a déjà des données "+APP_NAME+".<br><small style=\"color:var(--ink-soft)\">Si on t'invite en modification, tu pourras les ajouter au foyer. Sinon elles sont gardées de côté ici et reviennent si tu quittes le foyer.</small>", run, { ok:"Continuer" });
        else run();
      }
    }
    function fyJoinWith(fid, mid, inv, km){
      var tok=fyRand(24);
      return fySha(tok).then(function(hh){ return fyCall("POST","/join",{ fid:fid, mid:mid, inv:inv, tok:hh }, true); }).then(function(r){
        if(r.status===403) throw new Error("Invitation expirée ou déjà utilisée : demande un nouveau QR code.");
        if(r.status===410) throw new Error("Ce foyer n'existe plus.");
        if(r.status!==200) throw new Error("Pas de connexion au relais : réessaie.");
        try{ var prev={}; Object.keys(FY_KEYS).forEach(function(k){ prev[k]=store.read(k, null); }); prev.comptes=comptes; fyRawWrite("fyAvant", prev); }catch(e){}
        fyCfg={ role:r.j.role, fid:fid, mid:mid, tok:tok, km:km, joined:Date.now() }; fyPend={}; fyRawWrite("fyPend", fyPend); fySave();
        return fyCall("GET","/snap");
      }).then(function(r){
        if(r.status===200 && r.j.v) return fyOpen(km, r.j.v).then(function(snap){ snap.t=r.j.t; return snap; });
        return null;
      }).then(function(snap){
        return fyAskImport(snap).then(function(imp){ if(imp){ fyCfg.imp=1; fySave(); } return snap; });
      }).then(function(snap){
        var done=function(){ fyApplyMode(); state.view=fyFirstTab(); render(); fyEnsureLock(function(){ uiToast("Bienvenue dans le foyer de "+(fyCfg.owner||"…")+" !"); }); };
        if(snap){ setTimeout(function(){ fyApplySnap(snap); done(); }, 50); return; }
        // copie pas encore prête : elle arrivera à la prochaine mise à jour
        Object.keys(FY_KEYS).forEach(function(k){ fyRawWrite(k, fyDefault(k)); }); fyRawWrite("comptes", [{ key:"principal", nom:"Compte courant", payer:"", main:true }]);
        fyRawWrite("askName", false); fyResetBase(); fyReloadVars(); setTimeout(done, 50); fySyncSoon(4000);
      });
    }
    // Première ouverture : commencer, rejoindre un foyer ou récupérer le sien
    // Un membre du foyer est une personne active chez le propriétaire : ajoutée, ou rétablie si elle avait été supprimée
    function fyEnsurePerson(n){
      n=(n||"").trim(); if(!n || n==="Commun" || n===mePerson()) return 0;
      var r=personRec(n);
      if(r && r.archived){
        fraisCommuns.forEach(function(f){ if((f.personne||"").trim()===n && f.endByArchive){ delete f.endMonth; delete f.endByArchive; } }); persistFrais();
        delete r.archived; persistPersonnes(); return 2;
      }
      if(!r){ personnes.push({ nom:n }); persistPersonnes(); return 1; }
      return 0;
    }
    function fyEnsureMembersPersons(){
      if(!fyCfg || fyCfg.role!=="owner") return;
      var back=[];
      Object.keys(fyCfg.members||{}).forEach(function(id){ var n=fyCfg.members[id].name; if(fyEnsurePerson(n)===2) back.push(n); });
      if(back.length) setTimeout(function(){ uiToast(back.join(", ")+(back.length>1?" sont":" est")+" de retour dans tes Personnes : membre du foyer"); }, 1200);
    }
