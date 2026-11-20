    // ---------- Stockage ----------
    // La mémoire locale de la page (localStorage, environ 5 Mo) tant qu'il y a de la place. Une donnée qui n'y tient plus part
    // dans le stockage du téléphone (IndexedDB « tickets-kv », sans limite pratique) ; la liste de ces données est gardée dans
    // localStorage (« __idbOnly »). Au démarrage, s'il y en a, l'appli les charge d'abord, puis se relance (même script).
    // Mode démo : un foyer inventé, rangé à part (clés « demo:… ») ; les vraies données ne sont ni lues ni modifiées.
    // Drapeau « __demo » (seule clé hors de l'espace démo), ou lien web « ?demo ».
    var DEMO=(function(){ try{ return /[?&]demo(=|&|$)/.test(location.search) || localStorage.getItem("__demo")==="1"; }catch(e){ return false; } })();
    function SK(k){ return DEMO ? "demo:"+k : k; }
    var KVO=null, KVONLY={};   // données dans IndexedDB seulement : clé → texte JSON
    (function(){ var L=[]; try{ L=JSON.parse(localStorage.getItem("__idbOnly")||"[]")||[]; }catch(e){ L=[]; } KVO=L; })();
    if(KVO.length && !window.__tkKV){
      var me=document.currentScript, src=me ? me.textContent : "";
      kvLoadAll(function(all){ window.__tkKV=all||{}; var sc=document.createElement("script"); sc.textContent=src; document.body.appendChild(sc); });
      return;
    }
    if(window.__tkKV){ KVO.forEach(function(k){ if(window.__tkKV[k]!=null && localStorage.getItem(k)==null) KVONLY[k]=window.__tkKV[k]; }); }
    function kvOpen(cb){
      var I=window.indexedDB; if(!I){ cb(null); return; }
      try{ var rq=I.open("tickets-kv", 1); rq.onupgradeneeded=function(){ var db=rq.result; if(!db.objectStoreNames.contains("kv")) db.createObjectStore("kv"); };
        rq.onsuccess=function(){ cb(rq.result); }; rq.onerror=function(){ cb(null); }; }catch(e){ cb(null); }
    }
    function kvLoadAll(cb){
      var done=false, to=setTimeout(function(){ if(!done){ done=true; cb({}); } }, 4000);
      kvOpen(function(db){ if(!db){ if(!done){ done=true; clearTimeout(to); cb({}); } return; }
        try{ var out={}, tx=db.transaction("kv", "readonly"), os=tx.objectStore("kv"), cr=os.openCursor();
          cr.onsuccess=function(){ var c=cr.result; if(c){ out[c.key]=c.value; c.continue(); } else if(!done){ done=true; clearTimeout(to); cb(out); } };
          cr.onerror=function(){ if(!done){ done=true; clearTimeout(to); cb({}); } }; }catch(e){ if(!done){ done=true; clearTimeout(to); cb({}); } } });
    }
    var kvDb=null, kvWait=[];
    function kvPut(k, v){   // v = texte JSON, ou null pour effacer
      function go(db){ try{ var tx=db.transaction("kv", "readwrite"), os=tx.objectStore("kv"); if(v==null) os.delete(k); else os.put(v, k); }catch(e){} }
      if(kvDb){ go(kvDb); return; }
      kvWait.push(function(){ go(kvDb); }); if(kvWait.length>1) return;
      kvOpen(function(db){ kvDb=db; var w=kvWait; kvWait=[]; if(db) w.forEach(function(f){ f(); }); });
    }
    function kvOnlySave(){ try{ localStorage.setItem("__idbOnly", JSON.stringify(Object.keys(KVONLY))); }catch(e){} }
    var mem = {};
    var storageFull=false;
    var store = {
      read: function(k, def){
        k=SK(k);
        if(k in KVONLY){ try{ return JSON.parse(KVONLY[k]); }catch(e){ return def; } }
        try{ var v=localStorage.getItem(k); return v?JSON.parse(v):def; }catch(e){ return (k in mem)?mem[k]:def; } },
      write: function(k, val){
        k=SK(k); var t=JSON.stringify(val);
        try{ localStorage.setItem(k, t); storageFull=false;
          if(k in KVONLY){ delete KVONLY[k]; kvOnlySave(); kvPut(k, null); } }
        catch(e){   // plus de place : cette donnée part dans le stockage du téléphone
          if(window.indexedDB){ try{ localStorage.removeItem(k); }catch(e2){} KVONLY[k]=t; kvOnlySave(); kvPut(k, t); delete mem[k]; storageFull=false; }
          else { mem[k]=val; storageFull=true; } } },
      remove: function(k){ k=SK(k); try{ localStorage.removeItem(k); }catch(e){} delete mem[k]; if(k in KVONLY){ delete KVONLY[k]; kvOnlySave(); kvPut(k, null); } }
    };
    if(DEMO) demoEnsure();   // le foyer inventé, créé avant que l'appli lise ses données
    var fyCfg = store.read("fyCfg", null);   // foyer partagé (voir « Foyer partagé ») : null, propriétaire ou membre

