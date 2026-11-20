    // ---------- Import d'un relevé (OFX, QIF, CSV) ----------
    // Le fichier est lu sur le téléphone, rien n'est envoyé. Paiements par carte → tickets sans articles, prélèvements → frais fixes
    // (regroupés, « chaque mois » ou « une fois »), argent reçu / envoyé → virements faits, solde de départ calculé avec le solde du fichier.
    // Chaque donnée créée porte imp (n° de l'import, pour l'annuler) et impKey / impKeys (pour ne pas importer deux fois).
    var impState=null;
    function impR2(n){ return Math.round((Number(n)||0)*100)/100; }
    // Montant : « -1 086,00 », « 1.234,56 », « 1,234.56 », « (12.50) », « 12,50- », « 25 € »
    function impNum(s){
      s=String(s==null?"":s).replace(/[\s  ']/g,"").replace(/€|\$|£|EUR|USD|GBP|CHF/gi,"");
      if(!s) return NaN;
      var neg=false;
      if(/^\(.*\)$/.test(s)){ neg=true; s=s.slice(1,-1); }
      s=s.replace(/^\+/,"");
      if(/^[−–-]/.test(s)){ neg=!neg; s=s.slice(1); }
      if(/[−–-]$/.test(s)){ neg=!neg; s=s.slice(0,-1); }
      var c=s.lastIndexOf(","), d=s.lastIndexOf(".");
      if(c>=0 && d>=0){ if(c>d) s=s.replace(/\./g,"").replace(",","."); else s=s.replace(/,/g,""); }
      else if(c>=0){ if(s.length-c-1===3 || s.indexOf(",")!==c) s=s.replace(/,/g,""); else s=s.replace(",","."); }
      else if(d>=0 && s.indexOf(".")!==d) s=s.replace(/\./g,"");
      if(!/^\d*\.?\d+$/.test(s)) return NaN;
      var v=parseFloat(s); return neg?-v:v;
    }
    function impYmd(y,m,d){ y=+y; m=+m; d=+d; if(y<100) y+=(y<70?2000:1900);
      if(!(m>=1 && m<=12 && d>=1 && d<=31 && y>1950 && y<2200) || new Date(y, m-1, d).getDate()!==d) return null;
      return y+"-"+("0"+m).slice(-2)+"-"+("0"+d).slice(-2); }
    // jj/mm/aaaa, aaaa-mm-jj, jj.mm.aa, mm/jj'aa (Quicken), 20261020 (OFX) ; ord = "dmy" ou "mdy" pour les dates ambiguës
    function impDate(s, ord){
      s=String(s||"").trim().replace(/\s+/g,""); var m;
      if((m=s.match(/^(\d{4})(\d{2})(\d{2})(?:\d|\[|\.|$)/))) return impYmd(m[1],m[2],m[3]);
      if((m=s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/))) return impYmd(m[1],m[2],m[3]);
      if((m=s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.'](\d{2,4})$/)) || (m=s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.'](\d{2,4})\b/))) return ord==="mdy" ? impYmd(m[3],m[1],m[2]) : impYmd(m[3],m[2],m[1]);
      return null;
    }
    // Ordre jour / mois d'une liste de dates : « 13/10 » prouve jj/mm, « 10/13 » prouve mm/jj ; sinon jj/mm (sauf l'apostrophe de Quicken)
    function impDateOrder(list){
      var dmy=0, mdy=0, apo=0;
      list.forEach(function(s){ var m=String(s||"").replace(/\s+/g,"").match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.'](\d{2,4})/); if(!m) return;
        if(+m[1]>12) dmy++; if(+m[2]>12) mdy++; if(String(s).indexOf("'")>=0) apo++; });
      if(mdy && !dmy) return "mdy"; if(dmy) return "dmy";
      return apo ? "mdy" : "dmy";
    }
    function impDecode(buf){
      var u8=new Uint8Array(buf), txt="";
      try{ txt=new TextDecoder("utf-8", { fatal:true }).decode(u8); }
      catch(e){ try{ txt=new TextDecoder("windows-1252").decode(u8); }catch(e2){ for(var i=0;i<u8.length;i++) txt+=String.fromCharCode(u8[i]); } }
      return txt.replace(/^﻿/,"");
    }
    function impFmtOf(txt, name){
      if(/<OFX>|OFXHEADER/i.test(txt.slice(0, 4000))) return "OFX";
      if(/^\s*!(Type|Account|Option|Clear)\b/im.test(txt.slice(0, 2000))) return "QIF";
      if(/\.qif$/i.test(name||"") && /^\s*[DTP]/m.test(txt)) return "QIF";
      return "CSV";
    }
    // ---- OFX / QFX (XML 2.x ou SGML 1.x, plusieurs comptes possibles)
    function impOfx(txt){
      function dec(v){ return String(v||"").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;|&#39;/g,"'").replace(/&amp;/g,"&").replace(/\s+/g," ").trim(); }
      function tag(b, t){ var m=b.match(new RegExp("<"+t+">([^<\\r\\n]*)","i")); return m?dec(m[1]):""; }
      function blocks(b, t){ var re=new RegExp("<"+t+">([\\s\\S]*?)(?=</"+t+">|<"+t+">|$)","gi"), out=[], m; while((m=re.exec(b))) out.push(m[1]); return out; }
      var bank=tag(txt, "ORG"), stm=blocks(txt, "STMTRS").concat(blocks(txt, "CCSTMTRS")), accts=[];
      if(!stm.length) stm=[txt];
      stm.forEach(function(b){
        var lb=blocks(b, "LEDGERBAL")[0], ab=blocks(b, "AVAILBAL")[0], bb=lb||ab||"", bal=impNum(tag(bb, "BALAMT"));
        var a={ id:tag(b, "ACCTID"), name:"", cur:tag(b, "CURDEF"), bal:isFinite(bal)?bal:null, balDate:impDate(tag(bb, "DTASOF")), ops:[] };
        blocks(b, "STMTTRN").forEach(function(t){
          var amt=impNum(tag(t, "TRNAMT")), d=impDate(tag(t, "DTPOSTED"))||impDate(tag(t, "DTUSER"));
          if(!isFinite(amt) || !d) return;
          var nm=tag(t, "NAME"), memo=tag(t, "MEMO"), lab=nm||memo;
          if(nm && memo && memo.length>nm.length && memo.toUpperCase().indexOf(nm.toUpperCase().slice(0, 12))===0) lab=memo;
          a.ops.push({ d:d, amt:amt, label:lab, memo:(memo!==lab?memo:""), type:tag(t, "TRNTYPE"), fitid:tag(t, "FITID"), bcat:"", name:"" });
        });
        accts.push(a);
      });
      return { fmt:"OFX", bank:bank, accounts:accts.filter(function(a){ return a.ops.length; }) };
    }
    // ---- QIF (Money, Quicken, Grisbi, HomeBank…) : comptes « !Account », solde d'ouverture, virements [Compte]
    function impQif(txt){
      var lines=txt.split(/\r?\n/), accts=[], curA=null, mode="", rec={}, recs=[];
      function acct(name){ for(var i=0;i<accts.length;i++) if(accts[i].name===name) return accts[i]; var a={ id:name, name:name, cur:"", bal:null, balDate:null, open:null, recs:[], ops:[] }; accts.push(a); return a; }
      lines.forEach(function(l){
        var s=l.replace(/\s+$/,""); if(!s.trim()) return;
        if(s.charAt(0)==="!"){ var h=s.slice(1).trim().toLowerCase();
          if(h==="account") mode="acct";
          else if(h.indexOf("type:")===0){ var ty=h.slice(5).trim(); mode=/^(bank|cash|ccard|oth a|oth l|banque|liquide|carte)/.test(ty)?"tr":"skip"; if(mode==="tr" && !curA) curA=acct(""); }
          else if(h.indexOf("option")===0 || h.indexOf("clear")===0){}
          rec={}; return; }
        var k=s.charAt(0), v=s.slice(1).trim();
        if(k==="^"){
          if(mode==="acct"){ if(rec.N!=null) curA=acct(rec.N); }
          else if(mode==="tr" && curA) curA.recs.push(rec);
          rec={}; return; }
        if(k==="S" || k==="$" || k==="E"){ return; }   // ventilations : le total de l'opération suffit
        if(rec[k]==null) rec[k]=v; else if(k==="A" || k==="M") rec[k]+=" "+v;
      });
      var raw=[]; accts.forEach(function(a){ a.recs.forEach(function(r){ if(r.D) raw.push(r.D); }); });
      var ord=impDateOrder(raw);
      accts.forEach(function(a){
        a.recs.forEach(function(r, i){
          var d=impDate(r.D, ord), amt=impNum(r.T!=null?r.T:r.U); if(!d || !isFinite(amt)) return;
          var p=(r.P||"").trim(), L=(r.L||"").trim(), xfer=/^\[.*\]$/.test(L);
          // solde d'ouverture (Money, Quicken) : « Opening Balance », « Solde d'ouverture », ou 1re ligne vers [ce compte]
          if(/^(opening balance|solde (d.ouverture|initial|de d[ée]part|d.origine))/i.test(p) || (i===0 && xfer && L.slice(1,-1)===a.name && !p)){ a.open={ d:d, amt:amt }; return; }
          a.ops.push({ d:d, amt:amt, label:p||(r.M||""), memo:(p?(r.M||""):""), type:"", fitid:"", bcat:xfer?"":L.replace(/:/g," › "), xfer:xfer?L.slice(1,-1):"", name:"", num:r.N||"" });
        });
        delete a.recs;
      });
      return { fmt:"QIF", bank:"", accounts:accts.filter(function(a){ return a.ops.length; }) };
    }
    // ---- CSV (banques, Bankin', Linxo, tableur) : séparateur, ligne d'en-tête et colonnes devinés ; map = colonnes choisies à la main
    function impCsvRows(txt){
      var first=txt.split(/\r?\n/).filter(function(l){ return l.trim(); }).slice(0, 12), sep=";", bc=-1;
      [";", ",", "\t", "|"].forEach(function(x){ var c=0; first.forEach(function(l){ var q=false; for(var i=0;i<l.length;i++){ var ch=l.charAt(i); if(ch==='"') q=!q; else if(!q && ch===x) c++; } }); if(c>bc){ bc=c; sep=x; } });
      var rows=[], row=[], f="", q=false, i, ch;
      function endRow(){ row.push(f); f=""; if(row.some(function(x){ return String(x).trim(); })) rows.push(row.map(function(x){ return String(x).trim(); })); row=[]; }
      for(i=0;i<txt.length;i++){ ch=txt.charAt(i);
        if(q){ if(ch==='"'){ if(txt.charAt(i+1)==='"'){ f+='"'; i++; } else q=false; } else f+=ch; }
        else if(ch==='"') q=true;
        else if(ch===sep){ row.push(f); f=""; }
        else if(ch==="\n" || ch==="\r"){ if(ch==="\r" && txt.charAt(i+1)==="\n") i++; endRow(); }
        else f+=ch;
      }
      endRow();
      return rows;
    }
    function impCsv(txt, map){
      var rows=impCsvRows(txt); if(rows.length<1) return { fmt:"CSV", bank:"", accounts:[], cols:null };
      var h=-1, i, j;
      for(i=0;i<Math.min(rows.length-1, 40);i++){ if(rows[i].length>=2 && rows[i].some(function(x){ return /date/i.test(x); }) && rows[i+1].some(function(x){ return !!impDate(x, "dmy"); })){ h=i; break; } }
      if(h<0 && rows.length>1 && !rows[0].some(function(x){ return !!impDate(x, "dmy"); }) && rows[1].some(function(x){ return !!impDate(x, "dmy"); })) h=0;   // en-tête sans le mot « date »
      var head=h>=0 ? rows[h].map(function(x){ return norm(x); }) : [], body=rows.slice(h+1), used=[];
      var width=0; body.forEach(function(r){ width=Math.max(width, r.length); });
      function col(re, not){ for(var k=0;k<head.length;k++){ if(used.indexOf(k)<0 && re.test(head[k]) && !(not && not.test(head[k]))){ used.push(k); return k; } } return -1; }
      function share(k, test){ var n=0, t=0; body.forEach(function(r){ var v=r[k]; if(v==null || v==="") return; t++; if(test(v)) n++; }); return t ? n/t : 0; }
      var C={ date:-1, label:-1, name:-1, amt:-1, debit:-1, credit:-1, bal:-1, cat:-1, acct:-1, acctName:-1 };
      if(head.length){
        C.date=col(/^date$|^date d ?operation|^date op|date comptable|transaction date|booking date|^date de l operation/); if(C.date<0) C.date=col(/date/, /valeur|value/); if(C.date<0) C.date=col(/date/);
        C.acctName=col(/libelle compte|nom du compte|account name|intitule du compte/);
        C.name=col(/sugg|marchand|merchant|commer/);
        C.label=col(/libelle|descr|intitule|label|nature|detail|payee|tiers|beneficiaire|operation|wording/, /date|categ|montant|compte/);
        C.amt=col(/montant|amount|somme/, /date/);
        if(C.amt<0){ C.debit=col(/debit/); C.credit=col(/credit/); }
        var sol=[]; for(j=0;j<head.length;j++) if(used.indexOf(j)<0 && /solde|balance/.test(head[j])) sol.push(j);
        if(C.amt<0 && C.debit<0 && C.credit<0 && sol.length){ C.amt=sol[0]; used.push(sol[0]); sol=sol.slice(1); }   // BoursoBank : la 1re « Solde » est le montant
        if(sol.length){ C.bal=sol[sol.length-1]; used.push(C.bal); }
        C.cat=col(/^categorie$|^category$/); if(C.cat<0) C.cat=col(/categ/, /parent/);
        C.acct=col(/numero compte|n compte|account number|^compte$|iban/);
      }
      if(C.date<0){ for(j=0;j<width;j++){ if(share(j, function(v){ return !!impDate(v, "dmy"); })>0.7){ C.date=j; break; } } }
      if(C.amt<0 && C.debit<0 && C.credit<0){ for(j=0;j<width;j++){ if(j!==C.date && share(j, function(v){ return isFinite(impNum(v)); })>0.7){ C.amt=j; break; } } }
      if(C.label<0){ var best=-1, bl=0; for(j=0;j<width;j++){ if(j===C.date || j===C.amt) continue; var L=0, n=0; body.forEach(function(r){ var v=r[j]||""; if(/[a-z]/i.test(v)){ L+=v.length; n++; } }); if(n && L/n>bl){ bl=L/n; best=j; } } C.label=best; }
      if(map) Object.keys(map).forEach(function(k){ C[k]=map[k]; });
      var dates=[]; body.forEach(function(r){ if(C.date>=0 && r[C.date]) dates.push(r[C.date]); });
      var ord=impDateOrder(dates), byAcct={}, order=[];
      body.forEach(function(r, ri){
        var d=C.date>=0 ? impDate(r[C.date], ord) : null; if(!d) return;
        var amt;
        if(C.amt>=0) amt=impNum(r[C.amt]);
        else { var de=C.debit>=0?impNum(r[C.debit]):NaN, cr=C.credit>=0?impNum(r[C.credit]):NaN; amt=(isFinite(cr)?Math.abs(cr):0)-(isFinite(de)?Math.abs(de):0); if(!isFinite(de) && !isFinite(cr)) amt=NaN; }
        if(!isFinite(amt) || !amt) return;
        var ak=C.acct>=0 ? (r[C.acct]||"") : "";
        if(!byAcct[ak]){ byAcct[ak]={ id:ak, name:C.acctName>=0?(r[C.acctName]||""):"", cur:"", bal:null, balDate:null, ops:[], _b:[] }; order.push(ak); }
        var a=byAcct[ak];
        a.ops.push({ d:d, amt:amt, label:C.label>=0?(r[C.label]||""):"", memo:"", type:"", fitid:"", bcat:C.cat>=0?(r[C.cat]||""):"", name:C.name>=0?(r[C.name]||""):"" });
        if(C.bal>=0){ var b=impNum(r[C.bal]); if(isFinite(b)) a._b.push({ d:d, v:b, i:ri }); }
      });
      order.forEach(function(k){ var a=byAcct[k], bs=a._b; delete a._b;
        if(!bs.length) return;
        var mx=bs.reduce(function(m, x){ return x.d>m ? x.d : m; }, ""), desc=a.ops.length>1 && a.ops[0].d>=a.ops[a.ops.length-1].d, at=bs.filter(function(x){ return x.d===mx; });
        a.bal=(desc ? at[0] : at[at.length-1]).v; a.balDate=mx; });
      var bank=""; order.forEach(function(k){ if(!bank && byAcct[k].name) bank=byAcct[k].name; });
      return { fmt:"CSV", bank:bank, accounts:order.map(function(k){ return byAcct[k]; }).filter(function(a){ return a.ops.length; }), cols:C, head:h>=0?rows[h]:[], width:width };
    }
    function impParse(txt, name, map){
      var f=impFmtOf(txt, name), r=null;
      try{ r= f==="OFX" ? impOfx(txt) : f==="QIF" ? impQif(txt) : impCsv(txt, map); }catch(e){ try{ console.warn(e); }catch(_){} r={ fmt:f, accounts:[] }; }
      return r;
    }

    // ---- Rangement des opérations
    function impKind(o){
      var t=((o.label||"")+" "+(o.memo||"")).toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g,"").trim(), ty=String(o.type||"").toUpperCase();
      if(o.xfer) return o.amt>0 ? "in" : "out";
      if(o.amt>0) return "in";
      if(/^(RETRAIT|RET DAB|RET\.? DAB|DAB|ATM)\b|\bRETRAIT (DAB|CB|ESPECES)\b/.test(t) || ty==="ATM" || ty==="CASH") return "cash";
      if(/^(PRLV|PRELEVEMENT|PRELEV|PRLVT|ECHEANCE|ECH\.? ?PRET|COTIS(ATION)?)\b|\bPRLV SEPA\b|\bPRELEVEMENT SEPA\b|\bSEPA DD\b|\bDIRECT DEBIT\b/.test(t) || ty==="DIRECTDEBIT" || ty==="REPEATPMT") return "prlv";
      if(/^(VIR|VIREMENT|VRT|VIRT)\b/.test(t) || ty==="XFER") return "out";
      return "card";
    }
    var IMP_KNOWN=[[/DGFIP|DIRECTION GENERALE DES FINANCE|FINANCES PUBLIQUES|TRESOR PUBLIC/, "Impôts (DGFiP)"], [/\bCAF\b|CAISSE D.?ALLOCATIONS/, "CAF"], [/\bCPAM\b|ASSURANCE MALADIE/, "Assurance maladie"],
      [/\bURSSAF\b/, "Urssaf"], [/POLE EMPLOI|FRANCE TRAVAIL/, "France Travail"], [/EPARGNE PROGRAMM|VERSEMENT EPARGNE/, "Épargne programmée"]];
    var IMP_SMALL={ de:1, des:1, du:1, la:1, le:1, les:1, et:1, en:1, au:1, aux:1, sur:1 };
    var IMP_ACR={ edf:1, gdf:1, sfr:1, caf:1, bnp:1, lcl:1, axa:1, gmf:1, mma:1, maaf:1, maif:1, macif:1, matmut:0, kfc:1, irs:1, bhv:1, sncf:1, ratp:1, aprr:1, sanef:1, cpam:1, urssaf:1, tnt:1, ups:1, dhl:1, bp:1, sa:1, sas:1, rte:1, sosh:0, ovh:1, hsbc:1, ing:1, cic:1, lbp:1 };
    function impTitle(s){
      return s.toLowerCase().split(" ").filter(function(w){ return w; }).map(function(w, i){
        if(i>0 && IMP_SMALL[w]) return w;
        if(IMP_ACR[w]) return w.toUpperCase();
        if(w.length>1 && !/[aeiouyàâäéèêëîïôöùûü]/.test(w)) return w.toUpperCase();
        return w.charAt(0).toUpperCase()+w.slice(1); }).join(" ");
    }
    function impClean(o, kind){
      var raw=((o.label||o.memo||"")+"").trim(), U=raw.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
      if(kind==="cash") return "Retrait d'espèces";
      for(var k=0;k<IMP_KNOWN.length;k++) if(IMP_KNOWN[k][0].test(U)) return IMP_KNOWN[k][1];
      if(o.xfer) return o.xfer;
      // déjà propre (Money, Quicken, tableur) : gardé tel quel, sauf s'il commence par CARTE, PRLV, VIR…
      var clean=/[a-zà-ÿ]/.test(raw) && !/^(carte|cb\b|prlv|pr[ée]l[eè]v|vir|paiement|achat|retrait|[ée]ch[ée]ance)/i.test(raw);
      if((kind==="card" || kind==="prlv") && o.name && !/^vir\b/i.test(o.name)){ var sg=o.name.replace(/\s+\d+\b/g, "").replace(/\s+/g, " ").trim(); if(sg) return sg; }   // CSV : « libellé suggéré » par la banque
      var s=U, g;
      for(g=0;g<4;g++) s=s.replace(/^(PAIEMENT PAR CARTE|PAIEMENT CB|ACHAT CB|CARTE BANCAIRE|FACTURE CARTE|CARTE|CB|PRLV SEPA|PRELEVEMENT SEPA|PRELEVEMENT|PRLV|ECHEANCE|VIREMENT SEPA|VIREMENT|VIR SEPA|VIR|VRT|INST(ANTANE)?|SEPA|RECU|EMIS|PERMANENT|EN VOTRE FAVEUR|FAVEUR|DE|DU|PAR|A|VERS|POUR)\b\.?\s*/, "");
      s=s.replace(/\b\d{1,2}[\/.]\d{1,2}([\/.]\d{2,4})?\b/g, " ").replace(/\bCB\*?\s?\d+|\*\d{3,}|\bX\d{3,}\b/g, " ").replace(/\*/g, " ")
         .replace(/\b(M|MR|MME|MLLE|MLE|MONSIEUR|MADAME|MADEMOISELLE|OU|ET)\b\.?/g, " ").replace(/\b(SARL|SAS|SASU|SA|EURL|SCI|SNC|LTD|GMBH|INC)\b/g, " ")
         .replace(/\b[A-Z]*\d[A-Z0-9]*\b/g, " ").replace(/[^A-Z' .&-]/g, " ").replace(/\s+/g, " ").trim().replace(/^[-.&' ]+|[-.&' ]+$/g, "");
      if(kind==="in" || kind==="out") s=s.replace(/(\s+[A-Z])+$/, "");   // « HARNISCH SYLVETTE O » (nom tronqué par la banque)
      if(!s) s=U.replace(/\s+/g, " ").trim();
      if(clean) s=raw.replace(/\s+/g, " ").trim();
      // une personne connue (« MLLE SYLVETTE HARNISCH ») : son prénom tel qu'il est dans l'appli
      var ppl=[mePerson()].concat(uniquePersons(true)), ns=" "+norm(s)+" ", who=null;
      ppl.forEach(function(p){ var np=norm(p); if(!who && np && np.length>=3 && ns.indexOf(" "+np+" ")>=0) who=p; });
      if(who) return who;
      var t=clean ? s : impTitle(s);
      if(kind==="card"){ try{ t=matchMerchant([t], t)||t; }catch(e){} }
      return t;
    }
    // Date d'achat d'un paiement par carte : « CARTE 12/10/26 … » passé en banque le 14/10
    function impBuyDate(o){
      var m=String(o.label||"").match(/\b(\d{2})[\/.](\d{2})(?:[\/.](\d{2,4}))?\b/); if(!m) return o.d;
      var y=m[3]?m[3]:o.d.slice(0, 4), d=impYmd(y, m[2], m[1]); if(!d) return o.d;
      if(!m[3] && d>o.d) d=impYmd(+o.d.slice(0, 4)-1, m[2], m[1]);
      var diff=(new Date(o.d)-new Date(d))/86400000;
      return (diff>=-2 && diff<=31) ? d : o.d;
    }
    var IMP_CATMAP=[[/aliment|supermarch|course|epicer|boulang|primeur/, "Alimentation"], [/restau|fast food|bar |cafe|traiteur/, "Restaurant"], [/carbur|essence|station|gazole/, "Carburant"],
      [/brico|jardin|maison|ameublement|electromenager|travaux|logement|decoration/, "Maison"], [/sante|pharma|medecin|soin|bien etre|beaute|coiffeur|optique|dentist|hopital/, "Santé"],
      [/transport|parking|peage|train|avion|taxi|vehicule|auto|moto|velo/, "Transport"], [/loisir|sport|culture|livre|jouet|vacance|voyage|sortie|cinema|jeux|hotel|spectacle/, "Loisirs"]];
    function impCatFor(o, name){
      var nn=norm(name), cnt={}, best=null;
      state.entries.forEach(function(e){ if(e.categorie && norm(e.marchand)===nn) cnt[e.categorie]=(cnt[e.categorie]||0)+1; });
      Object.keys(cnt).forEach(function(c){ if(CATS.indexOf(c)>=0 && (!best || cnt[c]>cnt[best])) best=c; });
      if(best) return { c:best, src:"comme tes tickets" };
      var g=guessCat(name+" "+o.label); if(g!=="Autre" && CATS.indexOf(g)>=0) return { c:g, src:"d'après l'enseigne" };
      var b=norm(o.bcat||"");
      if(b) for(var i=0;i<IMP_CATMAP.length;i++) if(IMP_CATMAP[i][0].test(b+" ") && CATS.indexOf(IMP_CATMAP[i][1])>=0) return { c:IMP_CATMAP[i][1], src:"banque : "+o.bcat };
      return { c:CATS.indexOf("Autre")>=0 ? "Autre" : CATS[CATS.length-1], src:(o.bcat?"banque : "+o.bcat+" · à vérifier":"à vérifier") };
    }
    function impKeyOf(a, o){ return o.fitid ? "f:"+(a.id||"")+":"+o.fitid : "h:"+fyHash([a.id||"", o.d, impR2(o.amt), o.label, o.num||""].join("|")); }
    function impMonthsBetween(a, b){ return (+b.slice(0, 4)-(+a.slice(0, 4)))*12+(+b.slice(5, 7))-(+a.slice(5, 7))+1; }   // a et b compris
    function impDays(a, b){ return Math.abs(new Date(a)-new Date(b))/86400000; }
    // Prépare l'aperçu : lignes rangées, doublons repérés, frais regroupés
    function impBuild(){
      var S=impState, a=S.acc, target=S.target, months={}, used={};
      var ops=a.ops.filter(function(o){ return !S.from || o.d.slice(0, 7)>=S.from; });
      var importedKeys={};
      // déjà importé dans CE compte (le même relevé peut remplir un autre compte)
      state.entries.forEach(function(e){ if(e.impKey && e.compte===target) importedKeys[e.impKey]=1; });
      virements.forEach(function(v){ if(v.impKey && v.person===target) importedKeys[v.impKey]=1; });
      fraisCommuns.forEach(function(f){ if(f.compte===target) (f.impKeys||[]).forEach(function(k){ importedKeys[k]=1; }); });
      var cards=[], vir=[], prlv=[], groups=[], pfirst=null;
      ops.forEach(function(o){ var m=o.d.slice(0, 7); if(!pfirst || m<pfirst) pfirst=m; });
      // Ce paiement est-il déjà dans l'appli ? Un frais fixe de ce compte (même montant ce mois-là), un virement du compte,
      // ou un ticket (même montant à 3 jours près). Même nom = sûr ; autre nom = « peut-être ». Chaque donnée ne sert qu'une fois.
      function words(t){ return norm(t).split(" ").filter(function(w){ return w.length>=4; }); }
      function sameName(a, b){ var wb=" "+norm(b)+" "; return words(a).some(function(w){ return wb.indexOf(" "+w+" ")>=0; }); }
      function fraisHit(L){ var amt=Math.abs(L.amt), best=null, bs=0;
        fraisCommuns.forEach(function(f){ if(used["f"+f.id+"|"+L.m] || !fraisActif(f, L.m) || !fraisKind(f, target)) return;
          var fa=fraisAcctAmt(f, target, L.m), exact=Math.abs(fa-amt)<0.006, near=Math.abs(fa-amt)<=Math.max(0.5, amt*0.05), same=sameName(f.label, L.name);
          var sc=exact&&same?3:(exact?2:(near&&same?1:0)); if(sc>bs){ bs=sc; best=f; } });
        return best ? { f:best, sure:bs!==2 } : null; }
      function impAcctGuess(txt, tgt){   // « VIR VERS CPTE COMMUN » : un autre compte de l'appli nommé dans le libellé
        var t=" "+norm(txt)+" ", best="", bs=0, gen=["compte","courant","banque","caisse","epargne","credit","agricole","societe","generale","postale","livret","joint","perso","principal"];
        comptes.forEach(function(a){ if(a.key===tgt || a.key==="__tickets") return; var sc=0;
          norm(a.nom||"").split(/\s+/).forEach(function(w){ if(w.length>=4 && gen.indexOf(w)<0 && t.indexOf(" "+w+" ")>=0) sc++; });
          var ow=acctOwner(a); if(ow && !a.main && t.indexOf(" "+norm(ow)+" ")>=0) sc++;
          if(sc>bs){ bs=sc; best="cpt:"+a.key; } });
        return best; }
      function provInHit(L){   // mise(s) de côté qui arrivent sur ce compte ce mois-là, pas encore faites : une seule au bon montant, sinon toutes ensemble
        var c=fraisCommuns.filter(function(f){ return f.prov!=null && !used["f"+f.id+"|"+L.m] && !fraisDone(f, L.m) && provInAmt(f, target, L.m)>0; }), one=null, tot=0;
        c.forEach(function(f){ var a=provInAmt(f, target, L.m); tot+=a; if(!one && Math.abs(a-L.amt)<0.006) one=f; });
        if(one) return [one]; if(c.length>1 && Math.abs(tot-L.amt)<0.006) return c; return null; }
      function virHit(L){ var best=null, bs=0;
        virements.forEach(function(v){ if(used["v"+v.id] || v.person!==target || v.month!==L.m || Math.abs((Number(v.montant)||0)-L.amt)>=0.006) return;
          var sc=sameName(v.label||"", L.name)?2:1; if(sc>bs){ bs=sc; best=v; } });
        return best ? { v:best, sure:bs===2 } : null; }
      function ticketHit(L, o){ var best=null, bs=0, bd=99;
        state.entries.forEach(function(e){ if(used["e"+e.id] || e.pay==="esp") return; if(e.imp && !ticketInAcct(e, target)) return;   // importé dans un autre compte : autre relevé
          var em=Number(e.montant)||0, la=Math.abs(L.amt), exact=Math.abs(em-la)<0.006, same=sameName(e.marchand||"", L.name);
          if(!exact && !(same && Math.abs(em-la)<=Math.max(1, la*0.1))) return;   // même magasin, total mal lu : le relevé le corrige
          var dd=Math.min(impDays(e.date, L.date||o.d), impDays(e.date, o.d)); if(dd>3) return;
          var sc=same?(exact?3:2):1; if(sc>bs || (sc===bs && dd<bd)){ bs=sc; bd=dd; best=e; } });
        return best ? { e:best, sure:bs>=2, fix:bs===2 } : null; }
      function dm(d){ return String(d||"").split("-").reverse().slice(0, 2).join("/"); }
      // Le versement des provisions : même montant que ce qui est mis de côté ce mois-là hors de ce compte (toutes, ou une seule).
      // D'abord les provisions du titulaire du compte, puis celles de tout le foyer.
      var tAcct=acctByKey(target)||{}, tOwner=acctOwner(tAcct);
      function provHit(L){
        function here(p){ var w=provWhere(p); return w==="cpt:"+target || (w==="cpt" && tAcct.main); }
        var all=provisions.filter(function(p){ return !here(p) && (p.skips||[]).indexOf(L.m)<0 && mensuelAt(p, L.m)>0; }), amt=Math.abs(L.amt);
        var sets=[all.filter(function(p){ return ownerOf(p)===tOwner; }), all];
        for(var i=0; i<sets.length; i++){ var list=sets[i], tot=0; list.forEach(function(p){ tot+=mensuelAt(p, L.m); });
          if(list.length>1 && Math.abs(tot-amt)<0.006) return { name:"Provisions du mois", note:"= tes "+list.length+" provisions "+impDeMois(L.m)+" ("+impMoney(impR2(tot))+")" };
          var one=list.filter(function(p){ return Math.abs(mensuelAt(p, L.m)-amt)<0.006; });
          if(one.length===1) return { name:"Provision · "+(one[0].nom||"enveloppe"), note:"= ce que tu mets de côté chaque mois pour « "+(one[0].nom||"enveloppe")+" »" }; }
        return null; }
      // le versement de plusieurs provisions d'un coup : la somme de leurs mises de côté (frais fixes reliés) sur ce compte ce mois-là
      function provFraisHit(L){ var amt=Math.abs(L.amt), all=fraisCommuns.filter(function(f){ return f.prov!=null && !used["f"+f.id+"|"+L.m] && fraisActif(f, L.m) && fraisKind(f, target) && fraisAcctAmt(f, target, L.m)>0.004; });
        var sets=[all.filter(function(f){ var p=provById(f.prov); return p && ownerOf(p)===tOwner; }), all];
        for(var i=0; i<sets.length; i++){ var l=sets[i], t=0; l.forEach(function(f){ t+=fraisAcctAmt(f, target, L.m); }); if(l.length>1 && Math.abs(t-amt)<0.006) return l; }
        return null; }
      ops.forEach(function(o, i){
        var k="o"+i, auto=impKind(o), kind=(o.amt>0) ? "in" : (S.kind[k]||auto), name=impClean(o, auto), key=impKeyOf(a, o), m=o.d.slice(0, 7),
            L={ k:k, kind:kind, auto:auto, o:o, d:o.d, m:m, amt:impR2(o.amt), name:name, key:key, dup:"" };
        months[m]=1;
        if(kind==="card"){ L.date=impBuyDate(o); if(L.date.slice(0, 7)<pfirst) L.date=o.d; }   // acheté avant la période : compté au mois du passage en banque
        if(importedKeys[key]) L.dup="Déjà importé";
        else if(L.amt<0){
          var hf=fraisHit(L), hp=hf?null:provFraisHit(L), hv=(hf||hp)?null:virHit(L), he=(hf||hp||hv)?null:ticketHit(L, o);
          if(hf){ used["f"+hf.f.id+"|"+m]=1; L.ref={ t:"f", id:hf.f.id, m:m }; L.dup=(hf.sure?"Déjà en frais fixe (":"Peut-être déjà en frais fixe (")+hf.f.label+(hf.sure?")":", même montant)"); }
          else if(hp){ hp.forEach(function(f){ used["f"+f.id+"|"+m]=1; }); L.refs=hp.map(function(f){ return { t:"f", id:f.id, m:m }; }); L.dup="Déjà en frais fixes (tes "+hp.length+" provisions du mois)"; }
          else if(hv){ used["v"+hv.v.id]=1; L.vref=hv.v.id; L.dup=(hv.sure?"Déjà dans les virements (":"Peut-être déjà dans les virements (")+(hv.v.label||"")+(hv.sure?")":", même montant)"); }
          else if(he){ var hit=he.e; used["e"+hit.id]=1; var here=ticketInAcct(hit, target), oa=null; comptes.forEach(function(c){ if(!oa && c.key!==target && ticketInAcct(hit, c.key)) oa=c; });
            L.dup=(he.sure?"Déjà dans tes tickets (":"Peut-être déjà dans tes tickets (")+(hit.marchand||"?")+" · "+dm(hit.date)+(he.sure?"":", même montant")+(here?"":(oa?" · sur "+oa.nom:" · sans compte"))+")"+(here?"":" : coche pour le passer sur ce compte");
            if(he.fix){ L.fixT={ id:hit.id, from:Number(hit.montant)||0, to:impR2(Math.abs(L.amt)) }; L.dup+=" · total corrigé : "+fmtK(L.fixT.from)+" → "+fmtK(L.fixT.to); }
            if(kind==="card"){ L.dupOther=!here; L.hit=hit.id; } }
        }
        else if(L.amt>0 && provInHit(L)){ var hpi=provInHit(L); hpi.forEach(function(f){ used["f"+f.id+"|"+m]=1; }); L.refs=hpi.map(function(f){ return { t:"f", id:f.id, m:m }; });
          L.dup=hpi.length>1 ? "Déjà en provisions (tes "+hpi.length+" mises de côté du mois)" : "Déjà en provision ("+(hpi[0].label||"")+", "+provInFrom(hpi[0])+")"; }
        else { var hv2=virHit(L); if(hv2){ used["v"+hv2.v.id]=1; L.vref=hv2.v.id; L.dup=(hv2.sure?"Déjà dans les virements (":"Peut-être déjà dans les virements (")+(hv2.v.label||"")+(hv2.sure?")":", même montant)"); } }
        if(kind==="out" && auto!=="cash" && !L.dup && !/[ée]pargne|livret|\bpel\b|assurance.vie/i.test(name+" "+(o.label||"")+" "+(o.memo||""))){ var pv=provHit(L); if(pv){ L.name=pv.name; L.note=pv.note; } }
        if(kind==="card"){ var c=impCatFor(o, name); L.cat=(S.cat[k]||c.c); L.catSrc=S.cat[k]?"choisie":c.src; cards.push(L); }
        else if(kind==="prlv") prlv.push(L);
        else { L.ep=(k in S.ep) ? S.ep[k] : (L.vref || L.refs ? "" : impAcctGuess(name+" "+(o.label||"")+" "+(o.memo||""), target)); vir.push(L); }
      });
      // prélèvements : un frais par abonnement (même nom, montant proche, au plus une fois par mois)
      prlv.sort(function(x, y){ return x.d<y.d?-1:1; }).forEach(function(L){
        var nn=norm(L.name), g=null;
        groups.forEach(function(G){ if(g || G.ms[L.m]) return; if(!(G.nn===nn || G.nn.indexOf(nn+" ")===0 || nn.indexOf(G.nn+" ")===0)) return;
          var last=G.occ[G.occ.length-1].amt; if(Math.abs(Math.abs(L.amt)-Math.abs(last))<=Math.max(1, Math.abs(last)*0.2)) g=G; });
        if(!g){ g={ k:"g"+groups.length, nn:nn, name:L.name, occ:[], ms:{}, dup:"" }; groups.push(g); }
        else if(L.name.length<g.name.length){ g.name=L.name; g.nn=nn; }
        g.occ.push(L); g.ms[L.m]=1;
      });
      var span=Object.keys(months).length, lastM=Object.keys(months).sort().pop();
      groups.forEach(function(g){
        g.months=Object.keys(g.ms).sort(); g.amt=g.occ[g.occ.length-1].amt; g.keys=g.occ.map(function(L){ return L.key; });
        g.d=g.occ[g.occ.length-1].d;
        g.opKeys=g.occ.map(function(L){ return L.k; });
        if(g.occ.every(function(L){ return L.dup; })) g.dup=g.occ[0].dup;
        var tax=/^Impôts|^Urssaf/.test(g.name), nb=impMonthsBetween(g.months[0], g.months[g.months.length-1]), cov=g.months.length/nb;
        g.defFreq=(g.months.length>=2) ? (cov>=0.6 ? "m" : "o") : ((tax || span>=3) ? "o" : "m");
        g.ended=(g.months.length>=2 && impMonthsBetween(g.months[g.months.length-1], lastM)>=3) ? g.months[g.months.length-1] : null;
        g.freq=S.freq[g.k]||g.defFreq;
      });
      function on(L){ return (L.k in S.sel) ? S.sel[L.k] : !L.dup; }
      cards.forEach(function(L){ L.on=on(L); }); vir.forEach(function(L){ L.on=on(L); }); groups.forEach(function(g){ g.on=on(g); });
      var all=cards.concat(vir), first=null, last=null;
      ops.forEach(function(o){ if(!first || o.d<first) first=o.d; if(!last || o.d>last) last=o.d; });
      return { cards:cards, vir:vir, prlv:groups, ops:ops, first:first, last:last, span:span, used:used };
    }
    // Écart avec la banque : ce qui a exactement ce montant (ligne laissée de côté, ou donnée de l'appli absente du relevé)
    function impGapHints(M, d, impId, bm, tgt){
      var out=[], m0=M.first.slice(0, 7), mS=m0, u=M.used||{};
      for(var m=m0; m<=bm; m=nextMonthKey(m)){ if(m>m0 && getSoldeInit(tgt, m)!==null) mS=m; }   // un solde saisi plus tard repart de zéro
      function eq(a, b){ return Math.abs(a-b)<0.006; }
      function inR(m){ return m>=mS && m<=bm; }
      function line(L, why){ if(inR(L.m) && eq(L.amt, d)) out.push("« "+L.name+" » du "+impDM(L.d)+", "+why); }
      M.cards.concat(M.vir).forEach(function(L){ if(!L.on) line(L, L.dup ? "laissée de côté (vue comme déjà présente)" : "décochée"); });
      M.prlv.forEach(function(g){ if(!g.on) g.occ.forEach(function(L){ line(L, g.dup ? "laissée de côté (vue comme déjà présente)" : "décochée"); }); });
      if(d>0){
        state.entries.forEach(function(e){ var m=monthKey(e.date); if(e.imp===impId || e.pay==="esp" || u["e"+e.id] || !inR(m) || !ticketInAcct(e, tgt) || !eq(Number(e.montant)||0, d)) return;
          out.push("le ticket « "+(e.marchand||"?")+" » du "+impDM(e.date)+", absent du relevé"); });
        fraisCommuns.forEach(function(f){ if(f.imp===impId || !fraisKind(f, tgt)) return;
          for(var m=mS; m<=bm; m=nextMonthKey(m)){ if(!u["f"+f.id+"|"+m] && fraisActif(f, m) && fraisDone(f, m) && eq(fraisAcctAmt(f, tgt, m), d)) out.push("le frais fixe « "+f.label+" » "+impDeMois(m)+", marqué payé mais absent du relevé"); } });
      }
      virements.forEach(function(v){ if(v.imp===impId || u["v"+v.id] || v.person!==tgt || !v.done || !inR(v.month) || !eq(Number(v.montant)||0, -d)) return;
        out.push("le virement « "+(v.label||"?")+" » "+impDeMois(v.month)+", absent du relevé"); });
      return out.slice(0, 4);
    }
    // Solde de départ au 1er jour du premier mois importé (null si le fichier n'en donne pas et qu'il n'a pas été saisi)
    function impOpening(M){
      var S=impState, a=S.acc, start=M.first ? M.first.slice(0, 7)+"-01" : null; if(!start) return null;
      var bal=null, bd=null;
      if(S.balTyped!=null && isFinite(S.balTyped)){ bal=S.balTyped; bd=M.last; }
      else if(a.bal!=null){ bal=a.bal; bd=a.balDate||M.last; }
      if(bal!=null){ var s=0; M.ops.forEach(function(o){ if(o.d<=bd) s+=o.amt; }); return impR2(bal-s); }
      if(a.open && a.open.d<=start){ var s2=0; a.ops.forEach(function(o){ if(o.d>=a.open.d && o.d<start) s2+=o.amt; }); return impR2(a.open.amt+s2); }
      if(a.open && a.open.d.slice(0, 7)===start.slice(0, 7)) return impR2(a.open.amt);
      return null;
    }
    function impBankBal(M){ var S=impState, a=S.acc; if(S.balTyped!=null && isFinite(S.balTyped)) return { v:S.balTyped, d:M.last }; if(a.bal!=null) return { v:a.bal, d:a.balDate||M.last }; return null; }
    function impCan(){ return comptes.some(function(a){ return a.key!=="__tickets"; }) && (!fyMember() || fyTabEd("compte")); }
    // Étape 1 : explications, puis choix du fichier
    function impStart(key){
      if(!impCan()){ uiToast("Import impossible ici (consultation seulement)"); return; }
      var def=fyMember() ? myAcct().key : curAcctKey();   // membre du foyer : son propre compte
      var tgt=(key && acctByKey(key) && key!=="__tickets") ? key : (def!=="__tickets" && acctByKey(def) ? def : comptes.filter(function(a){ return a.key!=="__tickets"; })[0].key);
      var h='<div class="sheet-title">Importer un relevé</div><div class="ui-intro">Les opérations du fichier remplissent <b>'+esc(acctByKey(tgt).nom)+'</b> : solde de départ, dépenses par carte, prélèvements et virements. Tu vérifies tout avant d\'importer.</div>'+
        '<div class="imp-fmts"><div><b style="color:var(--accent)">OFX · QFX</b><span>ta banque (souvent « format Money »), Money, Quicken, iCompta</span></div><div><b style="color:#7c9cf4">QIF</b><span>Money, Quicken, Grisbi, HomeBank, Money Manager Ex</span></div><div><b style="color:#e0a458">CSV</b><span>ta banque, Bankin\', Linxo, un tableur</span></div></div>'+
        '<div class="ui-intro" style="font-size:12px">Où le trouver : sur le site de ta banque, « Exporter les opérations ». Le fichier est lu sur ton téléphone, rien n\'est envoyé.</div>'+
        '<div class="ui-stack"><button type="button" class="btn primary" id="impPick">Choisir le fichier</button><button type="button" class="btn ghost ui-no">Annuler</button></div>';
      var s=uiSheet(h); s.q(".ui-no").onclick=s.close;
      s.q("#impPick").onclick=function(){
        var inp=document.createElement("input"); inp.type="file"; inp.style.display="none"; document.body.appendChild(inp);
        inp.onchange=function(){ var f=inp.files && inp.files[0]; try{ document.body.removeChild(inp); }catch(e){} if(!f) return; s.close(); impReadFile(f, tgt); };
        inp.click();
      };
    }
    function impReadFile(file, tgt){
      var rd=new FileReader();
      rd.onload=function(){ impOpen(impDecode(rd.result), file.name||"relevé", tgt); };
      rd.onerror=function(){ uiToast("Fichier illisible"); };
      rd.readAsArrayBuffer(file);
    }
    // Relevé partagé vers Tickets depuis l'appli de la banque (« Partager › Tickets ») : choix du compte, puis l'import habituel
    function impShared(r){
      if(!r || (!r.b64 && !r.text && !r.error && !r.tooBig)) return;
      if(document.getElementById("lockscreen")){ var n=0, iv=setInterval(function(){ if(!document.getElementById("lockscreen") || ++n>240){ clearInterval(iv); if(n<=240) impShared(r); } }, 500); return; }
      if(r.tooBig){ uiToast("Fichier trop gros pour un relevé (plus de 20 Mo)"); return; }
      if(r.error){ uiToast("Fichier partagé illisible : "+r.error); return; }
      if(!impCan()){ uiToast(fyMember() ? "Import impossible : l'onglet Compte est en lecture pour toi" : "Crée d'abord un compte (onglet Compte)"); return; }
      var txt;
      if(r.b64){ var bin=atob(r.b64), u=new Uint8Array(bin.length); for(var i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i); txt=impDecode(u.buffer); }
      else txt=String(r.text||"");
      var name=r.name||"relevé", P=impParse(txt, name);
      if(!P || (!P.accounts.length && !(P.fmt==="CSV" && P.head && P.head.length))){ uiToast("Ce fichier n'est pas un relevé lisible (OFX, QFX, QIF ou CSV)"); return; }
      var A=comptes.filter(function(a){ return a.key!=="__tickets" && (!fyMember() || !fyCfg.accts || fyCfg.accts.indexOf(a.key)>=0); });
      if(fyMember() && !A.length) A=[myAcct()];
      function go(k){ impOpen(txt, name, k); }
      if(A.length===1){ go(A[0].key); return; }
      var cur=fyMember() ? myAcct().key : curAcctKey();
      A.sort(function(a, b){ return (b.key===cur) - (a.key===cur); });
      uiChoice("Importer « "+name+" »", esc("Dans quel compte ? Tu vérifies tout avant d'importer."), A.map(function(a, i){ return { l:a.nom+(a.payer?" · "+a.payer:""), primary:i===0, fn:function(){ go(a.key); } }; }));
    }
    function impSharedCheck(){ if(DEMO) return; npCall("sharedFile").then(impShared).catch(function(){}); }
    document.addEventListener("visibilitychange", function(){ if(!document.hidden) setTimeout(impSharedCheck, 400); });
    setTimeout(impSharedCheck, 900);
    // Le texte du fichier → aperçu (choix du compte du fichier s'il y en a plusieurs)
    function impOpen(txt, name, tgt, map){
      var P=impParse(txt, name, map);
      if(!P || !P.accounts.length){
        if(P && P.fmt==="CSV" && P.head && P.head.length){ impState={ txt:txt, fileName:name, P:P, target:tgt }; impMapCols(); return; }
        uiToast("Aucune opération trouvée dans ce fichier"); return;
      }
      function go(a){
        var ms=a.ops.map(function(o){ return o.d.slice(0, 7); }).sort(), lastM=ms[ms.length-1], from=null;
        if(ms[0]<lastM){ var y=+lastM.slice(0, 4), mo=+lastM.slice(5, 7), f12=(mo===12 ? y : y-1)+"-"+("0"+(mo===12 ? 1 : mo+1)).slice(-2); if(ms[0]<f12) from=f12; }
        var hadSI=!!(soldeInit[tgt] && Object.keys(soldeInit[tgt]).length);
        impState={ txt:txt, fileName:name, P:P, acc:a, target:tgt, from:from, sel:{}, cat:{}, freq:{}, ep:{}, kind:{}, more:{}, balTyped:null, setOpen:!hadSI, map:map||null };
        state.view="import"; render(); window.scrollTo(0, 0);
      }
      if(P.accounts.length===1) return go(P.accounts[0]);
      uiChoice("Quel compte du fichier ?", "Ce fichier contient "+P.accounts.length+" comptes.", P.accounts.map(function(a, i){ return { l:([a.name, a.id && a.id!==a.name ? "…"+String(a.id).slice(-4) : ""].filter(function(x){ return x; }).join(" ")||("Compte "+(i+1)))+" · "+a.ops.length+" opération"+(a.ops.length>1?"s":""), fn:function(){ go(a); } }; }));
    }
    // CSV : choisir les colonnes à la main
    function impMapCols(){
      var S=impState, P=S.P, head=P.head||[], C=P.cols||{}, opts=[{ v:"-1", l:"—" }].concat(head.map(function(x, i){ return { v:String(i), l:(x||("Colonne "+(i+1))) }; }));
      function f(key, label, help){ return { key:key, label:label, type:"select", value:String(C[key]!=null?C[key]:-1), options:opts, help:help }; }
      uiForm({ title:"Colonnes du fichier", intro:"Indique où sont la date, le libellé et le montant (ou le débit et le crédit).", fields:[
        f("date", "Date"), f("label", "Libellé"), f("amt", "Montant", "Négatif pour une dépense"), f("debit", "Débit (si pas de montant)"), f("credit", "Crédit (si pas de montant)"), f("cat", "Catégorie (facultatif)"), f("bal", "Solde (facultatif)") ] },
        function(r){ var map={}; ["date", "label", "amt", "debit", "credit", "cat", "bal"].forEach(function(k){ map[k]=+r[k]; }); map.name=-1;
          impOpen(S.txt, S.fileName, S.target, map); });
    }
    function impLong(d, y){ var p=String(d).split("-"), j=+p[2]; return (j===1?"1er":String(j))+" "+MOIS_NOMS[+p[1]-1]+(y?" "+p[0]:""); }
    function impDM(d){ var p=String(d||"").split("-"); return p.length===3 ? p[2]+"/"+p[1] : ""; }
    function impDeMois(m){ var n=MOIS_NOMS[+String(m).slice(5, 7)-1]||""; return (/^[aeiou]/.test(n) ? "d'" : "de ")+n; }   // « d'octobre », « de mars »
    function impMoney(v, sign){ return (sign && v>0 ? "+" : "")+fmtK(v).replace(/^-/, "−"); }
    // Étape 2 : l'aperçu
    function renderImport(){
      var S=impState; if(!S || !S.acc){ state.view="comptedet"; state.cptPage="cfg"; return renderCompte(); }
      var M=impBuild(), A=acctByKey(S.target)||{ nom:"?" }, open=impOpening(M), bank=impBankBal(M);
      var h=header("compte", "Import");
      var fsub=[S.P.fmt+(S.P.bank?" · "+esc(S.P.bank):"")+(S.acc.id?" · compte …"+esc(String(S.acc.id).slice(-4)):""), (S.acc.bal!=null || S.acc.open ? "solde inclus" : "sans solde")].join(" · ");
      h+='<section class="paper imp-card"><div class="imp-file"><b>'+esc(S.fileName)+'</b><span>'+fsub+'</span><span>'+M.ops.length+' opération'+(M.ops.length>1?'s':'')+(M.first?' · du '+esc(impLong(M.first, false))+' au '+esc(impLong(M.last, true)):'')+'</span>';
      if(S.P.fmt==="CSV"){ var C=S.P.cols||{}, nm=[]; if(C.date>=0) nm.push("Date"); if(C.label>=0) nm.push("Libellé"); if(C.amt>=0) nm.push("Montant"); if(C.debit>=0) nm.push("Débit"); if(C.credit>=0) nm.push("Crédit"); if(C.cat>=0) nm.push("Catégorie"); if(C.bal>=0) nm.push("Solde");
        h+='<div class="imp-cols"><span>Colonnes reconnues : '+nm.join(" · ")+'</span><button type="button" data-imp="map">Changer</button></div>'; }
      h+='</div></section>';
      h+='<section class="paper imp-card imp-rows"><div class="imp-row"><span>Dans le compte</span><button type="button" class="imp-pill" data-imp="acct">'+esc(A.nom)+' ▾</button></div>';
      var allMs={}; S.acc.ops.forEach(function(o){ allMs[o.d.slice(0, 7)]=1; }); var msK=Object.keys(allMs).sort();
      if(msK.length>12) h+='<div class="imp-row"><span>Depuis</span><button type="button" class="imp-pill" data-imp="from">'+esc(capFirst(monthLabelOf(S.from||msK[0])))+' ▾</button></div>';
      if(bank) h+='<div class="imp-row"><span>Solde à la banque au '+impDM(bank.d)+'</span><b class="'+(bank.v<0?'neg':'')+'">'+impMoney(bank.v)+'</b></div>';
      if(S.acc.bal==null && !S.acc.open) h+='<div class="imp-row imp-in"><label for="impBal">Solde à la banque au '+impDM(M.last)+' <i>(facultatif)</i></label><input id="impBal" class="f" type="text" inputmode="decimal" placeholder="ex. −36,56" value="'+(S.balTyped!=null?esc(moneyStr(S.balTyped)):'')+'"></div>';
      if(open!=null){ var si=soldeInit[S.target]||{}, ks=Object.keys(si);
        h+='<div class="imp-row"><button type="button" class="imp-ck'+(S.setOpen?' on':'')+'" data-imp="open" aria-pressed="'+S.setOpen+'" aria-label="Solde de départ"><i>'+(S.setOpen?'✓':'')+'</i></button><span>Solde de départ au 1er '+esc(monthLabelOf(M.first.slice(0, 7)).split(" ")[0])+(ks.length?'<small>le compte en a déjà un ('+esc(monthLabelOf(ks.sort()[0]))+')</small>':'')+'</span><b class="'+(open<0?'neg':'')+'">'+impMoney(open)+'</b></div>'; }
      else if(S.acc.bal==null) h+='<div class="imp-note">Sans solde, le compte part de son solde actuel.</div>';
      h+='</section>';
      function tyPill(k, t){ return '<button type="button" class="imp-pill sm ty" data-imp="kind" data-k="'+esc(k)+'" aria-label="Type : '+t+'">'+t+' ▾</button>'; }
      function ck(on, k, kind){ return '<button type="button" class="imp-ck'+(on?' on':'')+'" data-imp="'+kind+'" data-k="'+esc(k)+'" aria-pressed="'+on+'" aria-label="Importer"><i>'+(on?'✓':'')+'</i></button>'; }
      function grp(id, title, hint, list, line){
        if(!list.length) return '';
        var n=0, tot=0; list.forEach(function(L){ if(L.on){ n++; tot+=(L.occ ? L.occ.reduce(function(t, x){ return t+x.amt; }, 0) : L.amt); } });
        var all=n===list.length, mark=all?'✓':(n?'–':''), cls=all?' on':(n?' some':'');
        var out='<section class="paper imp-card imp-grp"><div class="imp-gh"><button type="button" class="imp-ck'+cls+'" data-imp="gall" data-g="'+id+'" aria-pressed="'+all+'" aria-label="Tout cocher"><i>'+mark+'</i></button><span class="t">'+title+'<small>'+n+' sur '+list.length+' cochée'+(n>1?'s':'')+'</small></span><b class="'+(tot>0?'pos':'')+'">'+impMoney(impR2(tot), true)+'</b></div><div class="imp-hint">'+hint+'</div>';
        var lim=S.more[id] ? list.length : 40;
        list.slice(0, lim).forEach(function(L){ out+=line(L); });
        if(list.length>lim) out+='<button type="button" class="imp-more" data-imp="more" data-g="'+id+'">Voir les '+list.length+' lignes</button>';
        return out+'</section>';
      }
      h+=grp("card", "Dépenses par carte → Tickets", "Un ticket par paiement, à la date d'achat, sans articles. Ceux déjà dans l'appli sont laissés de côté.", M.cards, function(L){
        return '<div class="imp-l'+(L.on?'':' off')+'">'+ck(L.on, L.k, "sel")+'<div class="m"><div class="r1"><span class="d">'+impDM(L.date)+'</span><span class="n">'+esc(L.name)+'</span></div>'+
          '<div class="r2">'+tyPill(L.k, "Ticket")+'<button type="button" class="imp-pill sm" data-imp="cat" data-k="'+L.k+'">'+esc(L.cat)+' ▾</button><span>'+esc(L.catSrc)+'</span></div>'+(L.dup?'<div class="dup">'+esc(L.dup)+'</div>':'')+'</div><b>'+impMoney(L.amt)+'</b></div>'; });
      h+=grp("prlv", "Prélèvements → Frais fixes", "« Chaque mois » : il revient tout seul les mois suivants. « Une fois » : seulement le mois du prélèvement.", M.prlv, function(g){
        var info=(g.months.length>1 ? g.months.length+' mois · dernier le '+impDM(g.d) : 'le '+impDM(g.d))+(g.ended && g.freq==="m" ? ' · arrêté depuis' : '');
        return '<div class="imp-l'+(g.on?'':' off')+'">'+ck(g.on, g.k, "sel")+'<div class="m"><div class="r1"><span class="d">'+info+'</span></div><div class="r1"><span class="n">'+esc(g.name)+'</span></div><div class="r2">'+tyPill(g.k, "Frais fixe")+'</div>'+
          '<div class="imp-seg" role="group" aria-label="Fréquence"><button type="button" data-imp="freq" data-k="'+g.k+'" data-v="m" class="'+(g.freq==="m"?'on':'')+'" aria-pressed="'+(g.freq==="m")+'">Chaque mois</button><button type="button" data-imp="freq" data-k="'+g.k+'" data-v="o" class="'+(g.freq==="o"?'on':'')+'" aria-pressed="'+(g.freq==="o")+'">Une fois</button></div>'+
          (g.dup?'<div class="dup">'+esc(g.dup)+'</div>':'')+'</div><b>'+impMoney(g.amt)+'</b></div>'; });
      var vin=M.vir.filter(function(L){ return L.amt>0; }), vout=M.vir.filter(function(L){ return L.amt<0; }), epL=epargne.filter(function(c){ return !c.bourseLink; }), lnkA=comptes.filter(function(a){ return a.key!=="__tickets" && a.key!==S.target; });
      function vline(L){
        return '<div class="imp-l'+(L.on?'':' off')+'">'+ck(L.on, L.k, "sel")+'<div class="m"><div class="r1"><span class="d">'+impDM(L.d)+'</span><span class="n">'+esc(L.name)+'</span></div>'+
          ((L.amt<0 || lnkA.length) ? '<div class="r2">'+(L.amt<0 ? tyPill(L.k, "Virement") : '')+(L.kind!=="cash" && (epL.length || lnkA.length) ? '<span>'+(L.amt<0 ? 'vers' : 'depuis')+'</span><button type="button" class="imp-pill sm" data-imp="ep" data-k="'+L.k+'">'+esc(L.ep ? (String(L.ep).indexOf("cpt:")===0 ? virLinkName(L.ep) : (epNameOf(L.ep)||"?")) : "Extérieur")+' ▾</button>' : '')+'</div>' : '')+
          (L.note?'<div class="note">'+esc(L.note)+'</div>':'')+(L.dup?'<div class="dup">'+esc(L.dup)+'</div>':'')+'</div><b class="'+(L.amt>0?'pos':'')+'">'+impMoney(L.amt, true)+'</b></div>'; }
      h+=grp("in", "Argent reçu → Virements", "Entrées du compte, déjà faites.", vin, vline);
      h+=grp("out", "Virements envoyés et retraits → Virements", "Sorties du compte, déjà faites."+(epL.length?" Un virement vers l'épargne peut remplir ton livret (son solde augmente d'autant).":""), vout, vline);
      // ce que le compte affichera
      var nOn=0, offAmt=0, offN=0, otherN=0;
      M.cards.concat(M.vir).forEach(function(L){ if(L.on) nOn++; else if(!L.dup){ offN++; offAmt+=L.amt; } else if(L.dupOther){ otherN++; offAmt+=L.amt; } });
      M.prlv.forEach(function(g){ if(g.on) nOn+=g.occ.length; else if(!g.dup){ offN+=g.occ.length; g.occ.forEach(function(x){ offAmt+=x.amt; }); } });
      var nRec=M.prlv.filter(function(g){ return g.on && g.freq==="m"; }).length, msg="";
      if(bank && open!=null && S.setOpen){
        if(!offN && !otherN) msg='Après l\'import, '+esc(A.nom)+' affichera <b>'+impMoney(bank.v)+'</b> au '+impDM(bank.d)+', comme ta banque.';
        else msg=(offN?offN+' ligne'+(offN>1?'s':'')+' décochée'+(offN>1?'s':''):'')+(offN&&otherN?' et ':'')+(otherN?otherN+' ticket'+(otherN>1?'s':'')+' resté'+(otherN>1?'s':'')+' sur un autre compte':'')+' : le compte n\'affichera pas tout à fait le solde de ta banque ('+impMoney(impR2(-offAmt), true)+').';
      } else if(!bank && open==null) msg='Le fichier ne donne pas le solde : indique-le pour que le compte affiche le même montant que ta banque.';
      else if(!bank && open!=null && S.setOpen) msg='Le compte partira du solde d\'ouverture du fichier ('+impMoney(open)+').';
      if(nRec) msg+=(msg?' ':'')+nRec+' frais fixe'+(nRec>1?'s':'')+' reviendr'+(nRec>1?'ont':'a')+' chaque mois.';
      if(msg) h+='<div class="imp-check">'+msg+'</div>';
      h+='<div class="ui-stack" style="margin:12px 0 8px"><button type="button" class="btn primary" data-imp="go"'+(nOn||S.setOpen?'':' disabled')+'>Importer '+nOn+' opération'+(nOn>1?'s':'')+'</button><button type="button" class="btn ghost" data-imp="cancel">Annuler</button></div>';
      h+='<div class="imp-note" style="text-align:center">Tout est lu et enregistré sur ton téléphone. L\'import peut être annulé ensuite (Compte › Configuration).</div>';
      app.innerHTML=h;
      bindBack(function(){ impState=null; state.view="comptedet"; state.cptPage="cfg"; render(); window.scrollTo(0, 0); });
      var bi=document.getElementById("impBal"); if(bi) bi.onchange=function(){ var v=num(bi.value); S.balTyped=(String(bi.value).trim()!=="" && isFinite(v)) ? v : null; if(S.balTyped!=null) S.setOpen=true; render(); };
      function lists(g){ return g==="card" ? M.cards : g==="prlv" ? M.prlv : g==="in" ? M.vir.filter(function(L){ return L.amt>0; }) : M.vir.filter(function(L){ return L.amt<0; }); }
      function findL(k){ var r=null; M.cards.concat(M.vir, M.prlv).forEach(function(L){ if(L.k===k) r=L; }); return r; }
      [].forEach.call(app.querySelectorAll("[data-imp]"), function(b){ b.onclick=function(){
        var a=b.getAttribute("data-imp"), k=b.getAttribute("data-k"), sy=window.scrollY;
        function again(){ render(); window.scrollTo(0, sy); }
        if(a==="sel"){ var L=findL(k); if(L){ S.sel[k]=!L.on; again(); } }
        else if(a==="gall"){ var l=lists(b.getAttribute("data-g")), allOn=l.every(function(x){ return x.on; }); l.forEach(function(x){ S.sel[x.k]=!allOn; }); again(); }
        else if(a==="freq"){ S.freq[k]=b.getAttribute("data-v"); again(); }
        else if(a==="more"){ S.more[b.getAttribute("data-g")]=true; again(); }
        else if(a==="open"){ S.setOpen=!S.setOpen; again(); }
        else if(a==="kind"){
          var g0=null; M.prlv.forEach(function(g){ if(g.k===k) g0=g; }); var keys=g0 ? g0.opKeys : [k];
          function setK(v){ keys.forEach(function(x){ S.kind[x]=v; delete S.sel[x]; }); again(); }
          uiChoice("C'est…", "", [{ l:"Un ticket (dépense)", primary:false, fn:function(){ setK("card"); } }, { l:"Un frais fixe", primary:false, fn:function(){ setK("prlv"); } }, { l:"Un virement", primary:false, fn:function(){ setK("out"); } }]); }
        else if(a==="cat"){ uiChoice("Catégorie", "", CATS.map(function(c){ return { l:c, primary:false, fn:function(){ S.cat[k]=c; again(); } }; })); }
        else if(a==="ep"){ var LL=null; (M.vir||[]).forEach(function(x){ if(String(x.k)===String(k)) LL=x; }); var out=!LL || LL.amt<0;
          uiChoice(out ? "Vers" : "Depuis", "Un de tes comptes (la ligne d'en face est créée, un seul rond « fait ») ou un livret (son solde change d'autant).", [{ l:"Extérieur (rien à relier)", primary:false, fn:function(){ S.ep[k]=""; again(); } }]
            .concat(comptes.filter(function(x){ return x.key!=="__tickets" && x.key!==S.target; }).map(function(x){ return { l:x.nom, primary:false, fn:function(){ S.ep[k]="cpt:"+x.key; again(); } }; }))
            .concat(out ? epargne.filter(function(c){ return !c.bourseLink; }).map(function(c){ return { l:c.nom+" (épargne)", primary:false, fn:function(){ S.ep[k]=String(c.id); again(); } }; }) : [])); }
        else if(a==="acct"){ uiChoice("Dans quel compte ?", "", comptes.filter(function(x){ return x.key!=="__tickets"; }).map(function(x){ return { l:x.nom+(x.key===S.target?" ✓":""), primary:x.key===S.target, fn:function(){ S.target=x.key; S.sel={}; S.setOpen=!(soldeInit[x.key] && Object.keys(soldeInit[x.key]).length); again(); } }; })); }
        else if(a==="from"){ uiChoice("Importer depuis", "", msK.slice().reverse().map(function(m){ return { l:capFirst(monthLabelOf(m)), primary:m===(S.from||msK[0]), fn:function(){ S.from=(m===msK[0]?null:m); S.sel={}; again(); } }; })); }
        else if(a==="map") impMapCols();
        else if(a==="cancel"){ impState=null; state.view="comptedet"; state.cptPage="cfg"; render(); window.scrollTo(0, 0); }
        else if(a==="go") impApply(M, open);
      }; });
      setNav("compte", true);
    }
    // Étape 3 : création des données
