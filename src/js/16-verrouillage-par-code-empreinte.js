    // ---------- Verrouillage par code / empreinte ----------
    var lockCfg = store.read("lockCfg", null);
    function b64(buf){ var s="", a=new Uint8Array(buf); for(var i=0;i<a.length;i++) s+=String.fromCharCode(a[i]); return btoa(s); }
    function unb64(str){ var b=atob(str), a=new Uint8Array(b.length); for(var i=0;i<b.length;i++) a[i]=b.charCodeAt(i); return a; }
    function randBytes(n){ var a=new Uint8Array(n); crypto.getRandomValues(a); return a; }
    // code du téléphone (08/11, revue F1) : v2 = PBKDF2 200 000 tours (un code à 6 chiffres ne se retrouve plus en une seconde) ;
    // les anciens codes (SHA-256 simple) passent en v2 au prochain déverrouillage réussi
    var LOCK_IT=200000;
    function hashPin(pin, salt, v){
      if(v!==2) return crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt+":"+pin)).then(b64);
      return crypto.subtle.importKey("raw", new TextEncoder().encode(String(pin)), "PBKDF2", false, ["deriveBits"]).then(function(k){
        return crypto.subtle.deriveBits({ name:"PBKDF2", hash:"SHA-256", salt:new TextEncoder().encode("tk-lock:"+salt), iterations:LOCK_IT }, k, 256); }).then(b64);
    }
    // essais ratés : après 5, attente de 30 s, puis le double à chaque erreur (15 min au plus)
    function lockWait(){ var f=store.read("lockFail", null); return (f && f.u && f.u>Date.now()) ? Math.ceil((f.u-Date.now())/1000) : 0; }
    function lockFailed(){ var f=store.read("lockFail", null)||{ n:0 }; f.n=(f.n||0)+1; if(f.n>=5) f.u=Date.now()+Math.min(900000, 30000*Math.pow(2, f.n-5)); store.write("lockFail", f); return f; }
    var lockHiddenAt=0;
    function nativeBio(){ return (typeof capPlugin==="function") ? capPlugin("TicketsNative") : null; }
    function bioUnlock(){
      if(lockCfg && lockCfg.bioId==="native"){ var N=nativeBio(); return N ? N.biometric({ title:""+APP_NAME+"", subtitle:"Déverrouille avec ton empreinte", cancel:"Utiliser le code" }) : Promise.reject(); }
      if(!lockCfg || !lockCfg.bioId || !window.PublicKeyCredential) return Promise.reject();
      return navigator.credentials.get({ publicKey:{ challenge:randBytes(32), allowCredentials:[{ type:"public-key", id:unb64(lockCfg.bioId) }], userVerification:"required", timeout:60000 } });
    }
    function showLock(){
      if(!lockCfg || document.getElementById("lockscreen")) return;
      var len=lockCfg.len||4, typed="";
      var ov=document.createElement("div"); ov.id="lockscreen";
      var dots=""; for(var i=0;i<len;i++) dots+="<i></i>";
      var keys=["1","2","3","4","5","6","7","8","9",(lockCfg.bioId?"bio":""),"0","del"];
      ov.innerHTML='<div class="lk-in"><div class="lk-ic">🔒</div><div class="lk-t">'+APP_NAME+'</div><div class="lk-s">Tape ton code'+(lockCfg.bioId?' ou utilise l\'empreinte':'')+'</div>'+
        '<div class="lk-dots">'+dots+'</div><div class="lk-err"></div><div class="lk-pad">'+
        keys.map(function(k){ return k==="bio"?'<button type="button" class="lk-x" data-k="bio">👆</button>':(k==="del"?'<button type="button" class="lk-x" data-k="del">⌫</button>':(k===""?'<span></span>':'<button type="button" data-k="'+k+'">'+k+'</button>')); }).join("")+
        '</div></div>';
      document.body.appendChild(ov);
      var dotEls=ov.querySelectorAll(".lk-dots i"), err=ov.querySelector(".lk-err");
      function paint(){ [].forEach.call(dotEls, function(d,i){ d.className=i<typed.length?"f":""; }); }
      function unlock(){ try{ document.body.removeChild(ov); }catch(e){} }
      function tryBio(){ bioUnlock().then(unlock).catch(function(){}); }
      [].forEach.call(ov.querySelectorAll("button[data-k]"), function(b){ b.onclick=function(){
        var k=b.getAttribute("data-k");
        if(k==="bio"){ tryBio(); return; }
        if(k==="del"){ typed=typed.slice(0,-1); paint(); return; }
        if(typed.length>=len) return;
        var w0=lockWait(); if(w0){ err.textContent="Trop d'essais : réessaie dans "+w0+" s"; return; }
        typed+=k; paint(); err.textContent="";
        if(typed.length===len){
          var tp=typed;
          hashPin(tp, lockCfg.salt, lockCfg.v).then(function(hv){
            if(hv===lockCfg.hash){ store.remove("lockFail"); unlock();
              if(lockCfg.v!==2){ var sl=lockCfg.salt; hashPin(tp, sl, 2).then(function(h2){ if(lockCfg && lockCfg.salt===sl){ lockCfg.hash=h2; lockCfg.v=2; store.write("lockCfg", lockCfg); } }).catch(function(){}); } }
            else { var fl=lockFailed(); typed=""; paint(); err.textContent=fl.u ? "Code incorrect · réessaie dans "+lockWait()+" s" : "Code incorrect"; var dd=ov.querySelector(".lk-dots"); dd.classList.remove("shake"); void dd.offsetWidth; dd.classList.add("shake"); }
          });
        }
      }; });
      if(lockCfg.bioId) setTimeout(tryBio, 250);
    }
    document.addEventListener("visibilitychange", function(){
      if(!lockCfg) return;
      if(document.hidden){ lockHiddenAt=Date.now(); return; }
      if(lockHiddenAt && Date.now()-lockHiddenAt > 60000) showLock();
      lockHiddenAt=0;
    });
    function lockSetup(){
      if(!window.crypto || !crypto.subtle){ uiToast("Verrouillage indisponible sur ce navigateur"); return; }
      uiForm({ title:lockCfg?"Nouveau code":"Code de verrouillage",
        intro:"4 à 6 chiffres, demandés à l'ouverture de l'app.<br><b>Garde une sauvegarde à jour</b> : sans le code, il faudrait effacer les données de l'app et restaurer la sauvegarde.",
        fields:[ {key:"a", label:"Code", type:"pin", required:true}, {key:"b", label:"Confirme le code", type:"pin", required:true} ], ok:"Activer"
      }, function(r){
        if(!/^[0-9]{4,6}$/.test(r.a)) return "Le code doit faire 4 à 6 chiffres.";
        if(r.a!==r.b) return "Les deux codes ne correspondent pas.";
        var salt=b64(randBytes(16)), keepBio=lockCfg&&lockCfg.bioId;
        hashPin(r.a, salt, 2).then(function(hv){
          lockCfg={ hash:hv, salt:salt, len:r.a.length, bioId:keepBio||null, v:2 };
          store.write("lockCfg", lockCfg); store.remove("lockSkip"); render(); uiToast("Verrouillage activé ✓");
          var NB=nativeBio();
          if(!keepBio && NB){
            NB.biometricAvailable().then(function(r){ if(r && r.available) uiConfirm("Déverrouiller aussi avec ton empreinte ?", lockEnableBio, {ok:"Oui", no:"Non merci"}); }).catch(function(){});
          } else if(!keepBio && window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable){
            PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().then(function(ok){
              if(ok) uiConfirm("Déverrouiller aussi avec ton empreinte ?", lockEnableBio, {ok:"Oui", no:"Non merci"});
            }).catch(function(){});
          }
        });
      });
    }
    function lockEnableBio(){
      var NB=nativeBio();
      if(lockCfg && NB){
        NB.biometricAvailable().then(function(r){
          if(!(r && r.available)){ uiToast("Aucune empreinte configurée sur ce téléphone"); return; }
          return NB.biometric({ title:"Ajouter l'empreinte", subtitle:"Pose ton doigt pour confirmer", cancel:"Annuler" }).then(function(){
            lockCfg.bioId="native"; delete lockCfg.bioSkip; store.write("lockCfg", lockCfg); render(); uiToast("Empreinte ajoutée ✓");
          });
        }).catch(function(){ uiToast("Empreinte non enregistrée"); });
        return;
      }
      if(!lockCfg || !window.PublicKeyCredential){ uiToast("Empreinte indisponible sur ce téléphone"); return; }
      navigator.credentials.create({ publicKey:{
        challenge:randBytes(32), rp:{ name:""+APP_NAME+"" },
        user:{ id:randBytes(16), name:"tickets", displayName:""+APP_NAME+"" },
        pubKeyCredParams:[{ type:"public-key", alg:-7 },{ type:"public-key", alg:-257 }],
        authenticatorSelection:{ authenticatorAttachment:"platform", userVerification:"required", residentKey:"discouraged" },
        timeout:60000, attestation:"none"
      }}).then(function(cred){
        lockCfg.bioId=b64(cred.rawId); delete lockCfg.bioSkip; store.write("lockCfg", lockCfg); render(); uiToast("Empreinte ajoutée ✓");
      }).catch(function(){ uiToast("Empreinte non enregistrée"); });
    }
    function lockDisable(){
      uiForm({ title:"Retirer le code", intro:fyCfg?"Sans code, quiconque ouvre ton téléphone voit les comptes du foyer. Fortement déconseillé.":"", fields:[{key:"a", label:"Code actuel", type:"pin", required:true}], ok:"Retirer", danger:true }, function(r){
        hashPin(r.a||"", lockCfg.salt, lockCfg.v).then(function(hv){
          if(hv!==lockCfg.hash){ uiToast("Code incorrect"); return; }
          lockCfg=null; store.write("lockCfg", null); store.write("lockSkip", 1); render(); uiToast("Code retiré de ce téléphone");
        });
      });
    }
    // empreinte retirée : le code reste ; ne plus la proposer à l'ouverture (08/11)
    function lockBioOff(){
      uiForm({ title:"Retirer l'empreinte", intro:"Ton code sera demandé à chaque ouverture.", fields:[{key:"a", label:"Code actuel", type:"pin", required:true}], ok:"Retirer" }, function(r){
        hashPin(r.a||"", lockCfg.salt, lockCfg.v).then(function(hv){
          if(hv!==lockCfg.hash){ uiToast("Code incorrect"); return; }
          lockCfg.bioId=null; lockCfg.bioSkip=1; store.write("lockCfg", lockCfg); render(); uiToast("Empreinte retirée");
        });
      });
    }

    if(lockCfg) showLock();

