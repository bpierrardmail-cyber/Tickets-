    // ---------- Lecture d'une facture : texte du PDF ou des photos → fournisseur, date, montant, prélèvement (parseBill) ----------
    // Fonctions sans écran (sauf ce qui a été appris, gardé sur le téléphone) : testées par tests/unit.
    var FACT_FOURS=[["EDF","elec"],["Engie","gaz"],["TotalEnergies","elec"],["Total Direct Energie","elec"],["Eni","gaz"],["Vattenfall","elec"],["ekWateur","elec"],["Mint Energie","elec"],["OHM Energie","elec"],["Octopus Energy","elec"],["Enercoop","elec"],["Alpiq","elec"],["Planete OUI","elec"],["Veolia","eau"],["Saur","eau"],["Suez","eau"],["Eau de Paris","eau"],["Bouygues Telecom","net"],["RED by SFR","net"],["SFR","net"],["Sosh","net"],["Orange","net"],["Free Mobile","net"],["Free","net"]];
    // dates mal lues sur une photo : « O04/03/2025 », « 02/11I2026 », « 02/1 1/2026 », « 0408/2026 », « 03/11/202s »
    function factDateFix(s){
      return String(s||"").replace(/[Oo](?=\d)/g, "0").replace(/(\d)[Il|](?=\d)/g, "$1/").replace(/(\/\d) (\d\/)/g, "$1$2")
        .replace(/(^|[^\d\/])(\d{2})(\d{2})\/(\d{4})(?!\d)/g, "$1$2/$3/$4").replace(/(\d{1,2}\/\d{1,2}\/20\d)[sS](?![\w])/g, function(x, a){ return a+"5"; });
    }
    // date en chiffres (« 27/10/2026 », « 27-10-26 ») ou en lettres (« 27 octobre 2026 », « 1er déc. 2025 ») : la première des deux
    var FACT_MOIS=["janv","f[ée]vr?","mars","avr","mai","juin","juil","ao[uû]t","sept","oct","nov","d[ée]c"];
    var FACT_MOISRE=new RegExp("(\\d{1,2})(?:er)?\\s+("+FACT_MOIS.join("|")+")[a-zéû]*\\.?\\s+(\\d{4})(?!\\d)", "i");
    function factYMD(y, mo, d){ if(d<1||d>31||mo<1||mo>12||y<2000||y>2099) return ""; return y+"-"+(mo<10?"0":"")+mo+"-"+(d<10?"0":"")+d; }
    // toutes les dates d'un texte, dans l'ordre : { iso, i, e } (une date qui en chevauche une autre plus tôt est écartée)
    function factDatesIdx(s){
      var t=factDateFix(s), all=[], m, re;
      re=/(20\d\d)-(\d{2})-(\d{2})(?!\d)/g; while((m=re.exec(t))) all.push({ iso:factYMD(+m[1], +m[2], +m[3]), i:m.index, e:m.index+m[0].length });
      re=/(\d{1,2}) ?[\/.\-] ?(\d{1,2}) ?[\/.\-] ?(\d{4}|\d{2})(?!\d)/g; while((m=re.exec(t))) all.push({ iso:factYMD(m[3].length===2?2000+(+m[3]):+m[3], +m[2], +m[1]), i:m.index, e:m.index+m[0].length });
      re=new RegExp(FACT_MOISRE.source, "gi"); while((m=re.exec(t))){ var mo=0; for(var k=0;k<FACT_MOIS.length;k++) if(new RegExp("^"+FACT_MOIS[k], "i").test(m[2])){ mo=k+1; break; } all.push({ iso:factYMD(+m[3], mo, +m[1]), i:m.index, e:m.index+m[0].length }); }
      all.sort(function(a,b){ return a.i-b.i; });
      var out=[], end=-1; all.forEach(function(x){ if(x.i<end) return; end=x.e; if(x.iso) out.push(x); });
      return out;
    }
    function factDate(s){ var D=factDatesIdx(s); return D.length ? D[0].iso : ""; }
    // montants d'une ligne (« 183,55 », « 1 234,56 ») ; une suite de chiffres (« N° 32 394 240 173 183,55 ») n'est pas un millier
    function factAmtsIdx(s){
      var r=[], m, re=/(\d{1,3}(?:[   ]\d{3})?|\d+) ?, ?(\d{2})(?!\d)/g;
      while((m=re.exec(s||""))){ var ip=m[1], pre=s.slice(Math.max(0, m.index-2), m.index);
        if(/[   ]/.test(ip) && /\d[   ]$/.test(pre)) ip=ip.split(/[   ]/).pop();
        r.push({ v:parseFloat(ip.replace(/[   ]/g,"")+"."+m[2]), i:m.index, e:m.index+m[0].length }); }
      return r;
    }
    function factAmts(s){ return factAmtsIdx(s).map(function(a){ return a.v; }); }
    // la date qui suit un libellé (« Prélevé le », puis la date un peu plus loin, parfois à la ligne)
    function factDateAfter(flat, re, span){ var m=re.exec(flat); if(!m) return ""; return factDate(flat.slice(m.index+m[0].length, m.index+m[0].length+(span||40))); }
    function factLabelAmt(lines, re){
      for(var i=0;i<lines.length;i++){ var m=re.exec(lines[i]); if(!m) continue;
        var a=factAmts(lines[i].slice(m.index+m[0].length)); if(a.length) return a[a.length-1];
        for(var j=1;j<=2 && i+j<lines.length;j++){ a=factAmts(lines[i+j]); if(a.length) return a[a.length-1]; } }
      return null;
    }
    var FACT_PAYRE=/montant\s+total\s+[àa]\s+payer|net\s+[àa]\s+payer|total\s+[àa]\s+payer|montant\s+[àa]\s+(?:payer|r[ée]gler)|somme\s+[àa]\s+payer|reste\s+[àa]\s+payer/i;
    // Texte de certains PDF (Free…) : accents détachés (« pr ´elev ´ee », « `a payer »), « N◦ », montants « 15.99 e » → « prélevée », « à payer », « N° », « 15,99 € »
    var FACT_ACC={ "´":"\u0301", "`":"\u0300", "ˆ":"\u0302", "¨":"\u0308", "˜":"\u0303" };
    var FACT_INIT=/^(?:etant|egal|ecri|emis|echeanc|electri|energ|etat|etabli|eventu|etre|etes)/i;
    function factTxtFix(s){
      // l'espace devant l'accent est gardé pour « `a » seul (« à ») et devant un mot qui commence par un accent (« sommes ´etant ») ;
      // sinon l'accent est au milieu du mot (« abonn ´e », « l ´egal »)
      return String(s||"").replace(/(?:([A-Za-zÀ-ÿ]+)( ?))?([´`ˆ¨˜])([A-Za-z])(?=([A-Za-zÀ-ÿ]*))/g, function(x, pre, sp, a, l, nx){
          var c=(l+FACT_ACC[a]).normalize("NFC"), word=(a==="`" && /a/i.test(l) && !nx) || (pre && pre.length>1 && FACT_INIT.test(l+nx));
          return (pre||"")+(pre && sp && word ? " " : "")+c; })
        .replace(/([Nn])[◦º](?=\s|\d)/g, "$1°")
        .replace(/(\d)[.,](\d{2}) ?e(?![A-Za-zÀ-ÿ0-9])/g, "$1,$2 €").replace(/(\d)\.(\d{2}) ?(€|EUR\b)/g, "$1,$2 $3");
    }
    function titleCase(s){ return String(s||"").toLowerCase().replace(/(^|[\s\-'’])([a-zà-ÿ])/g, function(x, a, b){ return a+b.toUpperCase(); }); }
    // ----- Lecture générale : chaque montant et chaque date reçoit une note selon les mots de sa ligne (ou de la ligne
    // au-dessus quand il est seul), et le mieux noté l'emporte. Sert quand les règles ci-dessous ne trouvent rien.
    function factWords(l){ return " "+norm(l||"")+" "; }
    function factAmtScore(n){
      var s=0, ttc=/ ttc /.test(n), tot=/ total /.test(n);
      if(/ a payer | a regler | a prelever | net a /.test(n)) s+=5;
      if(/ preleve| prelevement /.test(n)) s+=3;
      if(ttc) s+=3; if(tot) s+=2; if(/ montant /.test(n)) s+=1; if(/ cotisation | facture | echeance /.test(n)) s+=1;
      if(/ ht | hors taxe/.test(n) && !ttc) s-=4;
      if(/ tva /.test(n) && !ttc) s-=5;
      if(/ dont /.test(n)) s-=3;
      if(/ capital | siret | siren | rcs | iban /.test(n)) s-=10;
      if(/ kwh | prix unitaire| quantite | index | releve | consommation /.test(n)) s-=2;
      if(/ ancien solde| solde precedent| deja | acompte| report | avoir /.test(n)) s-=3;
      if(!tot && !ttc && / abonnement | options? | taxes? | forfait /.test(n)) s-=1;
      return s;
    }
    function factGuessAmt(lines){
      var best=null;
      lines.forEach(function(l, i){ var A=factAmtsIdx(l); if(!A.length) return;
        var alone=!/[a-zà-ÿ]{3,}/i.test(l), sc0=alone ? factAmtScore(factWords(lines[i-1]))-0.5 : factAmtScore(factWords(l));
        A.forEach(function(a){ if(!(a.v>0 && a.v<100000)) return; var sc=sc0+(/^\s*(?:€|eur)/i.test(l.slice(a.e, a.e+5)) ? 1 : 0);
          if(!best || sc>best.s || (sc===best.s && a.v>best.v)) best={ s:sc, v:a.v }; }); });
      return best && best.s>=3 ? best.v : null;
    }
    function factDateScore(n){
      var s=0;
      if(/ date de (?:la )?factur| facture du | factur\w* n | emise? le | editee? le | date d emission | date de facturation | facture emise | invoice date /.test(n)) s+=5;
      else { if(/ date /.test(n)) s+=3; if(/ factur/.test(n)) s+=2; if(/^ le $/.test(n)) s+=3; }
      if(/ echeance | avant le | limite | prelev| paiement | payable /.test(n)) s-=4;
      if(/ periode | consommation | releve | index | abonnement | au /.test(n)) s-=3;
      if(/ contrat | souscri| depuis | naissance | mise en service | adhesion | engagement /.test(n)) s-=4;
      if(/ prochaine /.test(n)) s-=6;
      return s;
    }
    function factGuessDate(lines){
      var best=null;
      lines.forEach(function(l, i){ var D=factDatesIdx(l); if(!D.length) return;
        var lw=l.replace(new RegExp("(?:"+FACT_MOIS.join("|")+")[a-zéû]*\\.?", "gi"), ""), alone=!/[a-zà-ÿ]{2,}/i.test(lw), sc0=(alone ? factDateScore(factWords(lines[i-1]))-0.5 : factDateScore(factWords(lw)))+(i<25 ? 1 : 0)-(D.length>1 ? 3 : 0);
        D.forEach(function(d){ if(!best || sc0>best.s) best={ s:sc0, iso:d.iso }; }); });
      return best && best.s>=3 ? best.iso : "";
    }
    function factGuessPrelev(lines){
      for(var i=0;i<lines.length;i++){ var n=factWords(lines[i]); if(!/ prelev/.test(n) || / mandat | rum /.test(n)) continue; var D=factDatesIdx(lines[i]); if(D.length) return D[0].iso; }
      return "";
    }
    // ----- Ce qui a été appris d'un fournisseur : les mots juste avant la date et le montant (ou la ligne au-dessus
    // quand la valeur est seule sur sa ligne). Gardé sur le téléphone, par nom de fournisseur tel qu'il est lu.
    function factLines(text){ return factTxtFix(text).replace(/[\u00a0\u202f]/g," ").split("\n").map(function(l){ return l.trim(); }).filter(Boolean); }
    function tkAmtsIdx(l){ var out=[], m, re=/(\d{1,4}) ?[.,] ?(\d{2})(?![\d.,])/g; while((m=re.exec(l||""))){ out.push({ v:parseFloat(m[1]+"."+m[2]), i:m.index, e:m.index+m[0].length }); } return out; }
    // le total d'un ticket : la ligne de total qui porte ce montant, sinon la dernière (un article seul a le même prix que le total)
    function tkAnchorOf(lines, val){
      var cand=[]; lines.forEach(function(l, i){ if(tkAmtsIdx(l).some(function(x){ return Math.abs(x.v-val)<0.005; })) cand.push(i); }); if(!cand.length) return null;
      var tot=cand.filter(function(i){ return /t[o0]ta[l1i]|\bt[o0]t\b|montant|[aà] payer|net [aà]|\bdu\b/i.test(lines[i]); }), i=tot.length ? tot[0] : cand[cand.length-1];
      var x=tkAmtsIdx(lines[i]).filter(function(x){ return Math.abs(x.v-val)<0.005; })[0], a=factTail(lines[i].slice(0, x.i));
      if(a) return { a:a }; var b=factTail(lines[i-1]||""); return b ? { a:b, prev:1 } : null;
    }
    function factItems(l, kind){ return kind==="date" ? factDatesIdx(l) : (kind==="tamt" ? tkAmtsIdx(l) : factAmtsIdx(l)); }
    function factTail(t){ return norm(t).split(" ").filter(Boolean).slice(-4).join(" "); }
    function factAnchorOf(lines, kind, val){
      for(var i=0;i<lines.length;i++){ var It=factItems(lines[i], kind);
        for(var k=0;k<It.length;k++){ var x=It[k]; if(kind!=="date" ? Math.abs(x.v-val)>0.004 : x.iso!==val) continue;
          var a=factTail(lines[i].slice(0, x.i)); if(a) return { a:a };
          var b=factTail(lines[i-1]||""); if(b) return { a:b, prev:1 }; } }
      return null;
    }
    // trois passes, de la plus stricte à la plus souple : les mêmes derniers mots juste avant la valeur ; le libellé appris
    // n'importe où avant elle sur la ligne (un mot ou un nombre ajouté entre les deux) ; ses 2 derniers mots seulement (libellé un peu changé)
    function factAnchorFind(lines, kind, A){
      var aw=A.a.split(" "), a2=aw.slice(-2).join(" ");
      function hit(pass, before, prevLine){
        if(A.prev){ if(factTail(before)) return false; var pl=" "+norm(prevLine||"")+" "; return pass===0 ? factTail(prevLine||"")===A.a : (pass===1 ? pl.indexOf(" "+A.a+" ")>=0 : aw.length>2 && pl.indexOf(" "+a2+" ")>=0); }
        var b=" "+norm(before)+" "; return pass===0 ? factTail(before)===A.a : (pass===1 ? b.indexOf(" "+A.a+" ")>=0 : aw.length>2 && b.indexOf(" "+a2+" ")>=0);
      }
      for(var pass=0;pass<3;pass++) for(var i=0;i<lines.length;i++){ var It=factItems(lines[i], kind);
        for(var k=0;k<It.length;k++){ var x=It[k]; if(hit(pass, lines[i].slice(0, x.i), lines[i-1])) return kind!=="date" ? x.v : x.iso; } }
      return null;
    }
    function factKnown(four){ return !!(four && (store.read("factAppris", {})||{})[norm(four)]); }
    function factLearntApply(r, lines){
      var L=r.four ? (store.read("factAppris", {})||{})[norm(r.four)] : null; if(!L) return;
      var v; if(L.amt && (v=factAnchorFind(lines, "amt", L.amt))!=null && v>0){ r.montant=v; r.learnt=true; }
      if(L.date && (v=factAnchorFind(lines, "date", L.date))){ r.date=v; r.learnt=true; }
    }
    // retenir pour ce fournisseur où étaient la date et le montant corrigés ; vrai si quelque chose est appris
    function factLearn(four, text, amt, date){
      if(!four || (!(amt>0) && !date)) return false;
      var lines=factLines(text), A=amt>0 ? factAnchorOf(lines, "amt", amt) : null, D=date ? factAnchorOf(lines, "date", date) : null;
      if(!A && !D) return false;
      var all=store.read("factAppris", {})||{}, k=norm(four), L=all[k]||{}; if(A) L.amt=A; if(D) L.date=D; all[k]=L; store.write("factAppris", all);
      return true;
    }
    // la correction de la plus récente sert aussitôt aux plus anciennes du même fournisseur qui n'ont pas leur date ou leur montant
    function factFillOthers(d){
      if(!d.multi || !d.multi.others.length) return 0;
      var p=d.p, lines=factLines(d.pages.join("\n")), A=Number(p.montant)>0 ? factAnchorOf(lines, "amt", Number(p.montant)) : null, D=p.date ? factAnchorOf(lines, "date", p.date) : null;
      if(!A && !D) return 0;
      var n=0;
      d.multi.others.forEach(function(o){ var q=o.p, hit=false; if(o.four0 && d.four0 && norm(o.four0)!==norm(d.four0)) return;
        var L=factLines(o.tx.join("\n")), v;
        if(A && !(q.montant>0) && (v=factAnchorFind(L, "amt", A))!=null && v>0){ q.montant=v; hit=true; }
        if(D && !q.date && (v=factAnchorFind(L, "date", D))){ q.date=v; hit=true; }
        if(hit) n++;
        o.check=o.short || !q.date || !(q.montant>0); });
      return n;
    }
    function parseBill(text){
      var FX=null, fxm=/^\[Factur-X\] (.*)$/m.exec(String(text||""));
      if(fxm){ FX={}; fxm[1].split(" ; ").forEach(function(kv){ var i=kv.indexOf("="); if(i>0) FX[kv.slice(0,i)]=kv.slice(i+1); }); text=String(text).replace(fxm[0], ""); }
      var T=factTxtFix(text).replace(/[  ]/g," "), lines=T.split("\n").map(function(l){ return l.trim(); }).filter(Boolean), flat=lines.join("\n"), low=flat.toLowerCase();
      var r={ four:"", fourSure:false, type:"autre", date:"", montant:null, prelev:"", aPayer:false, due:"", du:"", au:"", conso:null, next:"", regul:false }, m;
      // fournisseur : les grands fournisseurs, sinon le créancier du TIP, sinon le nom en tête de la facture
      var nl=" "+norm(flat.replace(/[0-9]/g," "))+" ";
      for(var i=0;i<FACT_FOURS.length;i++){ var nf=norm(FACT_FOURS[i][0]); if(nl.indexOf(" "+nf+" ")>=0 || (nf.indexOf(" ")<0 && nl.indexOf(" "+nf.replace(/ /g,"")+" ")>=0)){ r.four=FACT_FOURS[i][0]; r.fourSure=true; r.type=FACT_FOURS[i][1]; break; } }
      var crN=""; if(!r.four){ m=/cr[ée]ancier\s*:\s*([^\n]+)/i.exec(flat); if(m){ var cr=m[1].replace(/\s*-\s*tip\b.*$/i,"").replace(/[\s\-]+$/,"").replace(/^(?:s\s?i?\s?v\s?o\s?m|siaep|syndicat|sm|sie)\s+/i,"").trim(); if(/[a-zà-ÿ]{3,}/i.test(cr)){ r.four=titleCase(cr); crN=norm(cr); } } }
      if(!r.four || crN){
        var stop=/factur|r[ée]f[ée]rence|adresse|occupant|contrat|client|madame|monsieur|\bm\.|\bmme\b|centre|\brue\b|avenue|route|chemin|t[ée]l|e-?mail|page|rappeler|service|horaires/i;
        for(var j=0;j<Math.min(lines.length, 10);j++){
          var w=lines[j].split(/\s{2,}/)[0];
          if(/\d/.test(w) || stop.test(w) || !/^[A-ZÀ-Ý][A-ZÀ-Ý '’\-]{3,30}$/.test(w)) continue;
          // la suite du nom, en capitales, une ou deux lignes plus bas (« RÉGION » … « MINIÈRE »)
          for(var jn=1;jn<=2;jn++){ var nx=(lines[j+jn]||"").split(/\s{2,}/)[0];
            if(/^[A-ZÀ-Ý][A-ZÀ-Ý'’\-]{3,20}$/.test(nx) && !stop.test(nx) && (!crN || crN.indexOf(norm(w+" "+nx))>=0)){ w+=" "+nx; break; } }
          if(!crN || crN.indexOf(norm(w))>=0) r.four=titleCase(w); break;
        }
      }
      // type : ce qui est facturé
      if(r.type==="autre" || !r.fourSure){
        if(/\bkwh\b/.test(low) && /[ée]lectricit/.test(low)) r.type="elec";
        else if(/\bgaz\b/.test(low) && /\bkwh\b/.test(low)) r.type="gaz";
        else if((/\bm ?[3³]\b/.test(low) || /consommation\s+d['’ ]?eau|eau\s+potable/.test(low)) && /\beau\b|assainissement/.test(low)) r.type="eau";
        else if(/\b(box|fibre|forfait mobile|ligne fixe)\b/.test(low) || /(?:abonnement|acc[eè]s|offre)\s+internet/.test(low)) r.type="net";
      }
      // date de la facture
      r.date=factDateAfter(flat, /factur\w*(?:\s+r[ée]elle|\s+n[°o]\.?\s*\S+)?\s+(?:du|en date du|[ée]mise le|[ée]dit[ée]e? le)\s*:?\s*/i, 20) ||
             factDateAfter(flat, /date\s+(?:de\s+(?:la\s+)?)?facture?\s*:?\s*/i, 20) || factDateAfter(flat, /date\s+d['’][ée]mission\s*:?\s*/i, 20);
      // montant à payer (et prélèvement : « Le montant de 183,55€ sera prélevé le 12/11/2025 »)
      m=/montant\s+de\s+(\d[\d ]*,\d\d)\s*€?\s*sera\s+pr[ée]lev[ée]\s+(?:le|à partir du|vers le)\s*:?\s*([^\n]{0,14})/i.exec(flat);
      if(m){ r.montant=factAmts(m[1])[0]; r.prelev=factDate(m[2]); }
      if(r.montant==null) r.montant=factLabelAmt(lines, FACT_PAYRE);
      if(r.montant==null) r.montant=factLabelAmt(lines, /montant\s+total(?!\s*(?:ht|hors))|total\s+(?:de\s+)?(?:la|votre)\s+facture|total\s+facture\s+ttc|montant\s+ttc|total\s+ttc/i);
      if(!r.prelev) r.prelev=factDateAfter(flat, /pr[ée]l[èe]vement\s+(?:le|à partir du|a partir du|du)\s*:?\s*/i, 30);
      if(!r.prelev) r.prelev=factDateAfter(flat, /(?:sera\s+)?pr[ée]lev[ée]e?s?\s+(?:sur\s+[^\n]{1,40}?\s+)?(?:le|à partir du|vers le)\s*:?\s*/i, 40) || factDateAfter(flat, /date\s+(?:du|de)\s+pr[ée]l[èe]vement\s*:?\s*/i, 30);
      if(!r.prelev && /[àa]\s+payer\s+[àa]\s+r[ée]ception|r[èe]glement\s+[àa]\s+r[ée]ception|tip\s*sepa|payfip|[àa]\s+r[ée]gler\s+avant|date\s+limite\s+de\s+(?:paiement|r[èe]glement)\s*:?\s*(?:le\s+)?\d|[àa]\s+payer\s+avant/i.test(flat)){
        r.aPayer=true; r.due=factDateAfter(flat, /(?:[àa]\s+(?:payer|r[ée]gler)\s+avant\s+le|date\s+limite\s+de\s+(?:paiement|r[èe]glement))\s*:?\s*/i, 30);
      }
      r.next=factDateAfter(flat, /prochaine\s+facture[^\n\d]{0,20}/i, 30);
      r.regul=/paiements?\s+d[ée]j[àa]\s+effectu|d[ée]j[àa]\s+r[ée]gl[ée]s?\b|acomptes?\s+(?:d[ée]j[àa]\s+)?(?:vers|pay|r[ée]gl)|remboursement\s+en\s+votre\s+faveur/i.test(flat);
      // période de consommation
      m=/consommation\s+du\s+([^\n]{6,12}?)\s+au\s+([^\n]{6,12})/i.exec(flat);
      if(m && factDate(m[1])){ r.du=factDate(m[1]); r.au=factDate(m[2]); }
      else if(r.date){ var re=/\bdu\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/gi, d0=""; while((m=re.exec(flat))){ var dd=factDate(m[1]); if(dd && dd<r.date && (!d0 || dd<d0)) d0=dd; } if(d0){ r.du=d0; r.au=r.date; } }
      // consommation : kWh (électricité, gaz) ou m³ (eau)
      if(r.type==="eau") lines.some(function(l){ var c=/consommation\s+(?:d['’ ]?eau|factur[ée]e?|totale\s+relev[ée]e)[ \t]*(?:\(m\s?[3³]\))?[^\d]{0,30}?(\d{1,5})(?!\d|[.,]\d)/i.exec(l);
        if(!c || /m\s?$/i.test(l.slice(0, c.index+c[0].length-c[1].length))) return false; r.conso=+c[1]; return true; });
      else if(r.type==="elec" || r.type==="gaz"){
        m=/total\s+consommation[^\n]*?\)?\s+(\d{1,3}(?: \d{3})?|\d+)\s+\d[\d ]*,\d\d\s*$/im.exec(flat);
        if(!m) m=/consommation[^\n]{0,60}?(\d{1,3}(?: \d{3})?|\d+)\s*kwh/i.exec(flat);
        if(m) r.conso=+m[1].replace(/ /g,"");
      }
      // rien de trouvé par les règles : la date et le montant les plus probables d'après les mots autour
      if(!r.date) r.date=factGuessDate(lines);
      if(r.montant==null) r.montant=factGuessAmt(lines);
      if(!r.prelev && !r.aPayer) r.prelev=factGuessPrelev(lines);
      // ce fournisseur a déjà été corrigé : relire au même endroit
      factLearntApply(r, lines);
      // données Factur-X jointes au PDF : exactes, elles l'emportent
      if(FX){ if(FX.date) r.date=FX.date; if(+FX.montant>0) r.montant=+FX.montant; if(FX.echeance){ r.due=FX.echeance; if(!r.prelev) r.aPayer=true; }
        if(FX.fournisseur && !r.fourSure){ r.four=titleCase(FX.fournisseur); r.fourSure=true; } r.fx=true; }
      return r;
    }
