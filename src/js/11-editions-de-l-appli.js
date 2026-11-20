    // ---------- Éditions de l'appli ----------
    // « perso » : tout, Bourse comprise (navigateur et appli perso). « store » : version Play Store, sans Bourse.
    // L'appli Android annonce son édition dans son identifiant de navigateur (« TicketsApp/store ») ;
    // dans le navigateur, ajouter ?edition=store à l'adresse pour voir la version Store.
    var EDITION=(function(){
      var m=(navigator.userAgent||"").match(/TicketsApp\/(perso|store)/); if(m) return m[1];
      try{ var q=new URLSearchParams(location.search).get("edition"); if(q==="store"||q==="perso") return q; }catch(e){}
      return "perso";
    })();
    var FEAT={ bourse: EDITION!=="store" };
    // Version Plus (achat dans l'appli Store) : la liste des fonctions réservées sera remplie quand le partage
    // gratuit / Plus sera décidé. Tant qu'elle est vide, tout est ouvert.
    var PLUS_FEATURES=["widgets","foyer","avancee","factures","equilibre","groupes"];   // sauvegarde Drive gratuite pour tous depuis le 07/11 (décision de Benoît)   // à compléter (par ex. "scan", "provisions", "epargne")
    // Tickets Plus : acheté sur ce téléphone, ou (membre d'un foyer) celui du propriétaire, qui couvre tout le foyer
    function plusOwn(){ if(DEMO) return !store.read("demoFree", false); return EDITION!=="store" || !!store.read("plusUnlocked", false); }
    // le Plus du propriétaire couvre ses membres, y compris dans leur espace « Mes comptes » (foyer mis de côté dans fyPerso)
    function plusFoyer(){ if(fyCfg) return !!(fyCfg.role!=="owner" && fyCfg.plus); var P=store.read("fyPerso", null); return !!(P && P.cfg && P.cfg.role!=="owner" && P.cfg.plus); }
    function plusUnlocked(){ return plusOwn() || plusFoyer(); }
    function canUse(f){ if(PLUS_FEATURES.indexOf(f)<0) return true; return f==="widgets" ? plusOwn() : plusUnlocked(); }   // les widgets restent par téléphone
    function mainAcct(){ return comptes.filter(function(c){ return c.main; })[0] || comptes[0]; }
    function curAcctKey(){ var k=state.compteSel||store.read("compteSel", null), a=k&&acctByKey(k); return (a||mainAcct()).key; }
    // Ticket : compte choisi sur le ticket, sinon selon « payé par »
    function ticketInAcct(e, key){ if(e.compte && acctByKey(e.compte)) return e.compte===key; var a=acctByKey(key); return !!(a && a.payer && payerOf(e)===a.payer); }   // sans « payé par » : le titulaire (payerOf)
    function tkBank(e, key){ return e.pay!=="esp" && ticketInAcct(e, key); }   // le ticket sort-il de ce compte en banque ? Payé en espèces : non (il sort du liquide, ou de nulle part)
    // Frais fixe : compte choisi sur le frais, sinon frais perso du titulaire et frais « Commun » sur le compte principal
    function fraisKind(f, key){
      var a=acctByKey(key); if(!a || a.key==="__tickets") return null;
      var who=(f.personne||"").trim()||"Commun", kind=(who==="Commun")?"commun":"perso";
      if(who==="Commun" && f.split){ var pa=payAcctOf(acctOwner(a)); return (pa && pa.key===a.key) ? "commun" : null; }   // chacun sa part : sur le compte de chacun
      if(f.compte && acctByKey(f.compte)) return f.compte===key ? kind : null;
      if(who==="Commun") return a.main ? "commun" : null;
      return (who===a.payer || who===a.key) ? "perso" : null;
    }
    function prevMonthKey(m){ var a=m.split("-"), Y=+a[0], M=+a[1]-1; if(M<1){ M=12; Y--; } return Y+"-"+(M<10?"0"+M:M); }
    function nextMonthKey(m){ var a=m.split("-"), Y=+a[0], M=+a[1]+1; if(M>12){ M=1; Y++; } return Y+"-"+(M<10?"0"+M:M); }
    function monthLabelOf(mk){ var p=mk.split("-"); return new Date(+p[0], +p[1]-1, 1).toLocaleDateString("fr-FR",{month:"long",year:"numeric"}); }
    function monthNavHTML(title, month, curM){
      var x='<div class="mnav"><button type="button" id="mn-prev" class="mn-a" aria-label="Mois précédent">‹</button>'+
        '<div class="mn-t">'+title+'</div>'+
        '<button type="button" id="mn-next" class="mn-a" aria-label="Mois suivant">›</button></div>';
      if(month!==curM) x+='<div class="center"><span id="mn-today" class="mn-today">↩ Revenir au mois en cours</span></div>';
      return x;
    }
    function wireMonthNav(month, curM, key){
      if(!state.months) state.months={};
      var p=document.getElementById("mn-prev"); if(p) p.onclick=function(){ state.months[key]=prevMonthKey(month); render(); };
      var n=document.getElementById("mn-next"); if(n) n.onclick=function(){ var nx=nextMonthKey(month); state.months[key]=(nx===curM?null:nx); render(); };
      var t=document.getElementById("mn-today"); if(t) t.onclick=function(){ state.months[key]=null; render(); };
    }
    function bMonthsUpto(c, mk){ return bMonths(c).filter(function(m){ return m<=mk; }); }
    function bAt(c, mk){ var ms=bMonthsUpto(c,mk); return ms.length?c.vals[ms[ms.length-1]]:null; }
    function bPrevAt(c, mk){ var ms=bMonthsUpto(c,mk); return ms.length>1?c.vals[ms[ms.length-2]]:null; }
    // Reste à investir (liquidités du compte bourse) : compté dans la valeur et dans le capital, donc sans effet sur la plus-value
    function bCash(a){
      if(!a) return 0;
      if(a.cashCur && a.cashOrig!=null){ if(a.cashCur===BASE) return Number(a.cashOrig)||0; var v=toBase(Number(a.cashOrig), a.cashCur); if(v!==null) return Math.round(v*100)/100; }
      return Number(a.cash)||0;
    }
    function bTot(a){ return a?((Number(a.valeur)||0)+bCash(a)):0; }
    // Compte clôturé : il reste dans l'historique jusqu'au mois précédent et vaut 0 à partir de son mois de clôture
    function bClosedAt(c, mk){ return !!(c && c.closed && mk>=c.closed); }
    function bOpen(c){ return !bClosedAt(c, monthKey(todayISO())); }
    function closeBourse(c, m){
      if(!c.vals) c.vals={};
      Object.keys(c.vals).forEach(function(k){ if(k>=m) delete c.vals[k]; });
      c.vals[m]={ capital:0, valeur:0 }; c.closed=m;
      delete c.positions; c.sol=false; delete c.solQty; delete c.stock;
    }
    function bSnap(c, m, capital, valeur){ var src=(c.vals&&c.vals[m])||bAt(c,m), cash=bCash(src); if(!c.vals) c.vals={}; var o={ capital:capital, valeur:valeur }; if(cash) o.cash=cash; if(src && src.cashCur){ o.cashCur=src.cashCur; o.cashOrig=src.cashOrig; } c.vals[m]=o; }
    // Le compte « de paiement » d'une personne : son compte principal s'il en a un, sinon son premier compte
    function payAcctOf(p){ if(!p) return null; var l=comptes.filter(function(c){ return c.key!=="__tickets" && acctOwner(c)===p; }); return l.filter(function(c){ return c.main; })[0] || l[0] || null; }
    // Part des frais communs de chacun (onglet Commun › Parts), mémorisée le temps d'un affichage
    var fsMemo={};
    function communPct(p, month){ if(!fsMemo[month]) fsMemo[month]=communModel(month); return fsMemo[month].pctOf(p); }
    // Parts propres à un frais commun : f.parts = { "AAAA-MM": {prénom: %} ou null } (à partir de ce mois) ; null / rien = parts du commun
    function fraisPartsAt(f, month){
      if(!f || !f.parts) return null; var best=null, k; for(k in f.parts){ if(k<=month && (best===null || k>best)) best=k; }
      var P=(best!==null)?f.parts[best]:null, t=0; if(!P) return null; for(k in P) t+=Math.max(0, Number(P[k])||0); return t>0?P:null;
    }
    function partsPct(P, who){ var t=0, k; for(k in P) t+=Math.max(0, Number(P[k])||0); return t>0 ? Math.max(0, Number(P[who])||0)/t*100 : 0; }
    // Part (en %) d'une personne dans un frais commun ce mois-là
    function fraisPct(f, who, month){ var P=fraisPartsAt(f, month); return P ? partsPct(P, who) : communPct(who, month); }
    // Ce qu'un frais retire d'un compte : en entier, ou la part du titulaire quand c'est « chacun sa part »
    function fraisAcctAmt(f, key, month, raw){
      if(!raw && f.prov!=null && f.provFrom && month>=f.provFrom){ var pv=provById(f.prov); if(pv && provOnAcct(pv, key)) return 0; }   // mise de côté d'une provision dont l'argent reste sur ce compte
      var v=fraisMontant(f, month);
      if(!(f.split && ((f.personne||"").trim()||"Commun")==="Commun")) return v;
      var a=acctByKey(key), p=a && acctOwner(a); return p ? v*fraisPct(f, p, month)/100 : 0;
    }
    // Qui paie un frais commun « en entier » : le titulaire du compte qui le paie (envoyé tel quel aux membres du foyer)
    function fraisPayer(f){ if(fyMember() && f.payeur) return f.payeur; var a=(f.compte && acctByKey(f.compte)) || mainAcct(); return (a && acctOwner(a)) || mePerson(); }
    // Frais fixes d'un mois pour une personne (who) ou tout le foyer (who = null) : ce qui sort vraiment de son compte
    function fraisLines(month, who){
      var out=[];
      fraisCommuns.forEach(function(f){
        if(!fraisActif(f, month) || f.pp!=null) return;   // facture payée par une provision : c'est sa mise de côté qui compte
        var v=fraisMontant(f, month), p=(f.personne||"").trim()||"Commun"; if(!v) return;
        if(p!=="Commun"){ if(!who || who===p) out.push({ f:f, label:f.label, v:v, who:p, kind:"perso" }); return; }
        if(!who){ out.push({ f:f, label:f.label, v:v, who:"Commun", kind:"commun" }); return; }
        if(f.split){ var pc=fraisPct(f, who, month), sv=v*pc/100; if(sv>0.004) out.push({ f:f, label:f.label, v:sv, who:who, kind:"part", full:v, pct:pc }); return; }
        if(fraisPayer(f)===who){ var mine=v*fraisPct(f, who, month)/100; out.push({ f:f, label:f.label, v:v, who:who, kind:"paid", full:v, others:Math.max(0, v-mine) }); }
      });
      return out;
    }
    // Analyse : les frais fixes seulement à partir du premier mois avec des tickets (pas avant le début de l'appli), jamais dans le futur
    function anFraisLines(month, who){ var mk="an0|"+pvCur(), f0=fsMemo[mk];
      if(f0===undefined){ f0=null; vEntries().forEach(function(e){ var k=e.date && monthKey(e.date); if(k && (!f0 || k<f0)) f0=k; }); fsMemo[mk]=f0; }
      if(month<(f0||monthKey(todayISO())) || month>monthKey(todayISO())) return []; return fraisLines(month, who); }
    function anFraisTotal(month, who){ return anFraisLines(month, who).reduce(function(t,x){ return t+x.v; },0); }
    function anFraisOn(){ var v=state.anFrais; if(v==null) v=store.read("anFrais", false); return !!v && fraisCommuns.length>0; }
    // Montant compté dans les parts du Commun : une facture payée par une provision n'y est pas (la mise de côté y est déjà)
    function fraisPartV(f, month){ return f && f.pp!=null ? 0 : fraisMontant(f, month); }
    function fraisMontant(f, month){
      if(f && f.amounts){ var best=null; for(var k in f.amounts){ if(k<=month && (best===null||k>best)) best=k; } if(best!==null) return Number(f.amounts[best])||0; }
      return Number(f&&f.montant)||0;
    }
    // Premier mois d'un frais récurrent : startMonth, sinon déduit de sa création (id = date), de ses montants et des mois cochés
    function fraisStart(f){
      if(!f) return null; if(f.startMonth) return f.startMonth;
      var s=null; function lo(k){ if(/^[0-9]{4}-[0-9]{2}$/.test(k||"") && (!s || k<s)) s=k; }
      var n=Number(f.id); if(n>1e12 && n<4e12){ var d=new Date(n); lo(d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2)); }
      var k; for(k in (f.amounts||{})) lo(k); for(k in (f.doneMonths||{})) lo(k);
      return s;
    }
    function fraisActif(f, month){
      if(f.recurrent){ var st=fraisStart(f); return (!st || month>=st) && (!f.endMonth || month<=f.endMonth) && !(f.skipMonths && f.skipMonths[month]); }
      return f.month===month && !(f.skipMonths && f.skipMonths[month]);
    }
    function fraisDone(f, month){ return !!(f.doneMonths && f.doneMonths[month]); }
    function toggleFraisDone(id, month){
      var f=fraisCommuns.filter(function(x){ return String(x.id)===String(id); })[0]; if(!f) return; if(!fyFraisCanEdit(f)){ uiToast("Frais d'un autre compte : en consultation seulement"); return; }
      if(!f.doneMonths) f.doneMonths={};
      f.doneMonths[month]=!f.doneMonths[month]; provEpSync(f, month);
      if(f.doneMonths[month]){ var td=todayDay(month), fj=dayFix(f.jour, month); if(td && (!fj || fj>td)){ if(!f.doneDays) f.doneDays={}; f.doneDays[month]=td; } }   // le jour où c'est passé : aujourd'hui, sauf jour habituel déjà passé
      else if(f.doneDays && f.doneDays[month]) delete f.doneDays[month];
      persistFrais(); render();
    }
    // Jour d'une opération dans le mois (relevé du compte). 0 = inconnu (rangé au 1er).
    // Frais fixe : jour de l'import ou du jour où il a été coché « fait » (doneDays), sinon son jour habituel (jour).
    // Virement : day (import, coché « fait » ou saisi), sinon la date notée par un ancien import (« 05/10 · relevé »).
    function dimOf(month){ var p=String(month).split("-"); return new Date(+p[0], +p[1], 0).getDate(); }
    function dayFix(d, month){ d=Math.round(Number(d)||0); return d<1 ? 0 : Math.min(d, dimOf(month)); }
    function todayDay(month){ var t=todayISO(); return t.slice(0, 7)===month ? +t.slice(8, 10) : 0; }
    function virDay(v){ var d=dayFix(v.day, v.month); if(d) return d; var m=/^(\d{1,2})\/(\d{1,2})\b/.exec(String(v.note||"")); return (m && +m[2]===+String(v.month).slice(5, 7)) ? dayFix(m[1], v.month) : 0; }
    function fraisDay(f, month){ return dayFix(f.doneDays && f.doneDays[month], month) || dayFix(f.jour, month); }
    function dayField(v, label, help){ return { key:"jour", label:label, type:"qty", value:(v?String(v):""), placeholder:"1 à 31", help:help }; }
    function dayRead(r){ if(r.jour===null || r.jour===undefined || r.jour==="") return { v:null }; var d=Math.round(Number(r.jour)); if(!(d>=1 && d<=31)) return { err:"Le jour va de 1 à 31." }; return { v:d }; }
    function applyEp(accId, delta){
      var a=epargne.filter(function(x){ return String(x.id)===String(accId); })[0];
      if(!a || a.bourseLink) return;
      if(!a.vals) a.vals={};
      a.vals[monthKey(todayISO())] = epCurrent(a) + delta;
      persistEpargne();
    }
    function epNameOf(id){ if(!id) return ""; var a=epargne.filter(function(x){ return String(x.id)===String(id); })[0]; return a?a.nom:""; }
    function addVirement(sens){
      var hasEp=epargne.some(function(c){ return !c.bourseLink; });
      uiForm({ title:sens==="out"?"Virement envoyé":(sens==="in"?"Virement reçu":"Nouveau virement"), fields:[
        {key:"label", label:"Libellé", placeholder:"Salaire, virement sortant…", required:true},
        {key:"note", label:"Description (optionnel)"},
        {key:"montant", label:"Montant", type:"money", required:true},
        {key:"sens", label:"Sens", type:"seg", value:(sens==="out"?"out":"in"), options:SENS_OPTS},
        {key:"lien", label:(sens==="in" ? "Depuis" : "Vers"), type:"select", value:"", options:virLinkOpts(curAcctKey()), help:"Un de tes comptes, un livret ou la Bourse : l'argent y arrive (ou en part) aussi, avec un seul rond « fait ». Extérieur : rien à relier."},
        dayField(null, "Jour (facultatif)", "Range le virement dans la liste du compte. Vide : le jour où tu le coches « fait ».")
      ]}, function(r){
        var jd=dayRead(r); if(jd.err) return jd.err;
        var m=Math.abs(r.montant);
        var v={ id:Date.now(), person:curAcctKey(), month:((state.months&&state.months.compte)||monthKey(todayISO())), label:r.label||"Virement", note:r.note||"", montant:(r.sens==="out"?-m:m) };
        if(jd.v) v.day=jd.v;
        virLinkSet(v, r.lien);
        virements.push(v); virLinkSync(); persistVirements(); render();
      });
    }
    function editVirement(id){
      var v=virSrcOf(virById(id)); if(!v) return; id=v.id;   // la ligne d'en face se modifie par son virement d'origine
      uiForm({ title:"Modifier le virement", fields:[
        {key:"label", label:"Libellé", value:v.label, required:true},
        {key:"note", label:"Description (optionnel)", value:v.note||""},
        {key:"montant", label:"Montant", type:"money", value:Math.abs(Number(v.montant)||0), required:true},
        {key:"sens", label:"Sens", type:"seg", value:(Number(v.montant)<0?"out":"in"), options:SENS_OPTS},
        dayField(virDay(v)||"", "Jour (facultatif)", "Range le virement dans la liste du compte."),
        {key:"lien", label:"Vers / depuis", type:"select", value:virLinkVal(v), options:virLinkOpts(v.person), help:"Un de tes comptes, un livret ou la Bourse : l'argent y arrive (ou en part) aussi. Extérieur : rien à relier."}
      ]}, function(r){
        var jd=dayRead(r); if(jd.err) return jd.err;
        v.label=r.label||v.label; v.note=r.note||"";
        if(jd.v) v.day=jd.v; else delete v.day; delete v.dayAuto;
        var newM=(r.sens==="out"?-1:1)*Math.abs(r.montant);
        v.montant=newM; virLinkApply(v); virLinkSet(v, r.lien);
        virLinkSync(); persistVirements(); render();
      });
    }
    function delVirement(id){
      var v=virSrcOf(virById(id)); if(!v) return; id=v.id;
      uiConfirm("Supprimer le virement « "+esc(v.label)+" » ?"+(v.vers ? "<br><small>Sa ligne sur « "+esc(virLinkName(v.vers))+" » part aussi.</small>" : ""), function(){
        if(v.epargneId && v.done){ applyEp(v.epargneId, -(v.epApplied||0)); }
        if(v.bourseId!=null && v.bApplied) applyBourse(v.bourseId, -v.bApplied);
        if(v.liqAdd && v.liqAdd.k){ var lq=liquideMois[v.liqAdd.k]; if(lq && lq[v.liqAdd.m]!=null){ lq[v.liqAdd.m]=Math.round(((Number(lq[v.liqAdd.m])||0)-v.liqAdd.a)*100)/100; persistLiquide(); } }   // retrait d'espèces : l'argent sort aussi du liquide
        virements=virements.filter(function(x){ return String(x.id)!==String(id); });
        virLinkSync(); persistVirements(); render();
      }, {ok:"Supprimer", danger:true});
    }
