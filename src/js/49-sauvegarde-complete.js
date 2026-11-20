    // ---------- Sauvegarde complète (ZIP sans compression : data.json + photos/AAAA-MM/<ticket>-<page>.jpg) ----------
    var CRCT=null;
    function crcTable(){ if(CRCT) return CRCT; CRCT=[]; for(var n=0;n<256;n++){ var c=n; for(var k=0;k<8;k++) c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1); CRCT[n]=c>>>0; } return CRCT; }
    function blobBuf(b){ return new Promise(function(res, rej){ var r=new FileReader(); r.onload=function(){ res(new Uint8Array(r.result)); }; r.onerror=function(){ rej(r.error||new Error("lecture impossible")); }; r.readAsArrayBuffer(b); }); }
    function blobB64(b){ return new Promise(function(res, rej){ var r=new FileReader(); r.onload=function(){ var t=String(r.result||""); res(t.slice(t.indexOf(",")+1)); }; r.onerror=function(){ rej(r.error||new Error("lecture impossible")); }; r.readAsDataURL(b); }); }
    function blobText(b){ return new Promise(function(res, rej){ var r=new FileReader(); r.onload=function(){ res(String(r.result||"")); }; r.onerror=function(){ rej(r.error||new Error("lecture impossible")); }; r.readAsText(b, "utf-8"); }); }
    function blobCrc(b){   // lu par morceaux de 4 Mo
      var T=crcTable(), c=0xFFFFFFFF, pos=0, CH=4194304;
      function step(){ if(pos>=b.size) return Promise.resolve((c^0xFFFFFFFF)>>>0);
        return blobBuf(b.slice(pos, pos+CH)).then(function(u){ for(var i=0;i<u.length;i++) c=T[(c^u[i])&255]^(c>>>8); pos+=CH; return step(); }); }
      return step();
    }
    function utf8Bytes(t){ var x=unescape(encodeURIComponent(t)), u=new Uint8Array(x.length); for(var i=0;i<x.length;i++) u[i]=x.charCodeAt(i); return u; }
    function utf8Text(u){ var x=""; for(var i=0;i<u.length;i++) x+=String.fromCharCode(u[i]); try{ return decodeURIComponent(escape(x)); }catch(e){ return x; } }
    function dataUrlBlob(d){ var p=String(d).split(","), bin=atob(p[1]||""), u=new Uint8Array(bin.length); for(var i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i);
      return new Blob([u], { type:((p[0]||"").match(/:(.*?);/)||[])[1]||"image/jpeg" }); }
    function zipBuild(files, onProg){   // files : [{n:nom, b:Blob}] → Blob ZIP
      var parts=[], cd=[], off=0, i=0, now=new Date(),
          dt=((now.getFullYear()-1980)<<9)|((now.getMonth()+1)<<5)|now.getDate(), tm=(now.getHours()<<11)|(now.getMinutes()<<5)|(now.getSeconds()>>1);
      function next(){
        if(i>=files.length){
          var cs=0; cd.forEach(function(x){ cs+=x.size; });
          var E=new DataView(new ArrayBuffer(22)); E.setUint32(0, 0x06054b50, true); E.setUint16(8, files.length, true); E.setUint16(10, files.length, true); E.setUint32(12, cs, true); E.setUint32(16, off, true);
          return Promise.resolve(new Blob(parts.concat(cd, [E.buffer]), { type:"application/zip" }));
        }
        var f=files[i];
        return blobCrc(f.b).then(function(crc){
          var nm=utf8Bytes(f.n), sz=f.b.size, L=new DataView(new ArrayBuffer(30)), C=new DataView(new ArrayBuffer(46));
          L.setUint32(0, 0x04034b50, true); L.setUint16(4, 20, true); L.setUint16(6, 0x0800, true); L.setUint16(10, tm, true); L.setUint16(12, dt, true);
          L.setUint32(14, crc, true); L.setUint32(18, sz, true); L.setUint32(22, sz, true); L.setUint16(26, nm.length, true);
          C.setUint32(0, 0x02014b50, true); C.setUint16(4, 20, true); C.setUint16(6, 20, true); C.setUint16(8, 0x0800, true); C.setUint16(12, tm, true); C.setUint16(14, dt, true);
          C.setUint32(16, crc, true); C.setUint32(20, sz, true); C.setUint32(24, sz, true); C.setUint16(28, nm.length, true); C.setUint32(42, off, true);
          parts.push(L.buffer, nm, f.b); cd.push(new Blob([C.buffer, nm]));
          off+=30+nm.length+sz; i++; if(onProg) onProg(i, files.length);
          return next();
        });
      }
      return next();
    }
    function zipRead(file){   // → {nom: {o: début des données, s: taille, m: méthode}}
      var tail=Math.min(file.size, 65557);
      return blobBuf(file.slice(file.size-tail)).then(function(u){
        var dv=new DataView(u.buffer), p=-1;
        for(var i=u.length-22;i>=0;i--){ if(dv.getUint32(i, true)===0x06054b50){ p=i; break; } }
        if(p<0) throw new Error("ce n'est pas une sauvegarde complète (ZIP)");
        var n=dv.getUint16(p+10, true), cs=dv.getUint32(p+12, true), co=dv.getUint32(p+16, true);
        return blobBuf(file.slice(co, co+cs)).then(function(c){
          var d=new DataView(c.buffer), q=0, L=[];
          for(var k=0;k<n;k++){
            if(d.getUint32(q, true)!==0x02014b50) throw new Error("archive abîmée");
            var nl=d.getUint16(q+28, true), xl=d.getUint16(q+30, true), cl=d.getUint16(q+32, true);
            L.push({ n:utf8Text(c.subarray(q+46, q+46+nl)), m:d.getUint16(q+10, true), s:d.getUint32(q+20, true), lo:d.getUint32(q+42, true) });
            q+=46+nl+xl+cl;
          }
          var out={}, j=0;
          function nx(){ if(j>=L.length) return out; var e=L[j++];
            return blobBuf(file.slice(e.lo, e.lo+30)).then(function(h){ var hd=new DataView(h.buffer); out[e.n]={ o:e.lo+30+hd.getUint16(26, true)+hd.getUint16(28, true), s:e.s, m:e.m }; return nx(); }); }
          return nx();
        });
      });
    }
    function uiProgress(msg){
      var el=document.createElement("div"); el.className="ui-toast"; el.setAttribute("role", "status"); el.id="uiProg"; el.textContent=msg; document.body.appendChild(el);
      return { set:function(m){ el.textContent=m; }, close:function(){ try{ document.body.removeChild(el); }catch(e){} } };
    }
    function backupZip(dump, ek){
      if(fyMember()) return;
      var L=photoEntries(), files=[], map=[], chain=Promise.resolve(), pr=uiProgress("Préparation de la sauvegarde complète…");
      L.forEach(function(e){ chain=chain.then(function(){ return origGet(e.id).then(function(o){
        var id=String(e.id), m=(e.date||"").slice(0,7)||"sans-date", safe=id.replace(/[^A-Za-z0-9_-]/g, "_"), bl=(o && o.b && o.b.length) ? o.b : null, orig=!!bl;
        if(!bl) bl=PHOTOS[id] ? [dataUrlBlob(PHOTOS[id])] : [];
        bl.forEach(function(b, k){ var t=b.type||"image/jpeg", ext=/png/.test(t)?"png":(/webp/.test(t)?"webp":(/hei[cf]/.test(t)?"heic":"jpg")), p="photos/"+m+"/"+safe+"-"+(k+1)+"."+ext;
          if(ek) p+=".enc";
          files.push({ n:p, b:b }); map.push({ p:p, id:id, n:k+1, o:orig?1:0, t:t }); });
      }); }); });
      if(ek) chain=chain.then(function(){ var c2=Promise.resolve(); files.forEach(function(f, i){ c2=c2.then(function(){ pr.set("Chiffrement des photos… "+Math.round((i+1)*100/files.length)+" %"); return encBlob(f.b, ek.key).then(function(eb){ f.b=eb; }); }); }); return c2; });
      chain.then(function(){
        var tot=0; files.forEach(function(f){ tot+=f.b.size; });
        if(tot>3.9*1073741824 || files.length>65000){ pr.close(); window.alert("Trop de photos pour une seule sauvegarde complète ("+fmtBytes(tot)+").\nSupprime d'abord les photos des années anciennes (Menu › Sauvegarde › Stockage), ou fais une sauvegarde des données seules."); return; }
        dump._zip=map; dump._version=2;
        return (ek ? fySeal(ek.key, dump).then(function(v){ return { _app:"tickets", _enc:1, _date:dump._date, kf:ek.kf, v:v }; }) : Promise.resolve(dump)).then(function(top){
          files.unshift({ n:"data.json", b:new Blob([JSON.stringify(top)], { type:"application/json" }) });
          return zipBuild(files, function(i, n){ pr.set("Sauvegarde complète… "+Math.round(i*100/n)+" %"); }).then(function(z){ pr.close(); saveZip(z, "tickets-sauvegarde-complete-"+todayISO()+(ek?"-chiffree":"")+".zip"); });
        });
      }).catch(function(e){ pr.close(); window.alert("Sauvegarde impossible : "+((e&&e.message)||e)); });
    }
    // Enregistre un fichier : Documents/Tickets ou partage (Android), téléchargement (navigateur). o = { what, done }
    function saveFile(z, fname, o){
      o=o||{}; var what=o.what||"Fichier";
      function done(msg){ if(o.done) o.done(); uiToast(msg); if(state.view==="list" || state.view==="stockage") setTimeout(render, 50); }
      var FS=capPlugin("Filesystem"), SH=capPlugin("Share");
      if(FS){
        // par morceaux de 3 Mo (multiple de 3 : chaque morceau en base64 se suffit)
        var write=function(path, dir){ var CH=3145728, pos=0, uri=null, pr=uiProgress("Enregistrement… 0 %");
          function nx(first){ if(pos>=z.size){ pr.close(); return Promise.resolve(uri); }
            return blobB64(z.slice(pos, pos+CH)).then(function(b64){ var a={ path:path, data:b64, directory:dir }; if(first) a.recursive=true; pos+=CH;
              pr.set("Enregistrement… "+Math.min(100, Math.round(pos*100/z.size))+" %"); return first ? FS.writeFile(a) : FS.appendFile(a); })
              .then(function(r){ if(first && r && r.uri) uri=r.uri; return nx(false); }); }
          return nx(true).catch(function(e){ pr.close(); throw e; }); };
        var toPhone=function(){ write(""+APP_NAME+"/"+fname, "DOCUMENTS").then(function(){ done(what+" dans Documents/"+APP_NAME+" ✓"); })
          .catch(function(e){ window.alert("Enregistrement impossible dans Documents : "+((e&&e.message)||e)+"\nEssaie « Envoyer vers… »."); }); };
        var toShare=function(){ var old=store.read("zipCache", null); if(old && old!==fname){ try{ FS.deleteFile({ path:old, directory:"CACHE" }).catch(function(){}); }catch(e){} }
          write(fname, "CACHE").then(function(uri){ store.write("zipCache", fname); return SH.share({ title:what+" · "+APP_NAME+"", files:[uri] }); })
          .then(function(){ done(what+" envoyé"+(o.fem?"e":"")+" ✓"); })
          .catch(function(e){ var m=(e&&e.message)||String(e); if(!/cancel|annul/i.test(m)) window.alert("Envoi impossible : "+m); }); };
        if(!SH){ toPhone(); return; }
        uiChoice(what+" · "+fmtBytes(z.size), esc("Garde le fichier sur le téléphone, ou envoie-le vers Google Drive, un ordinateur…"), [
          { l:"Sur le téléphone (Documents/"+APP_NAME+")", fn:toPhone }, { l:"Envoyer vers… (Drive, mail)", fn:toShare } ]);
        return;
      }
      try{
        var url=URL.createObjectURL(z), a=document.createElement("a"); a.href=url; a.download=fname; document.body.appendChild(a); a.click();
        done(what+" téléchargé"+(o.fem?"e":"")+" ✓");
        setTimeout(function(){ try{ document.body.removeChild(a); }catch(e){} URL.revokeObjectURL(url); }, 4000);
      }catch(e){ window.alert("Enregistrement impossible : "+((e&&e.message)||e)); }
    }
    function saveZip(z, fname){
      saveFile(z, fname, { what:"Sauvegarde complète", fem:true, done:function(){ var now=new Date().toISOString(); store.write("lastBackup", now); store.write("lastBackupFull", now); } });
    }
