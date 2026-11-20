    // ---------- Carrousel Tickets Plus : depuis l'accueil, le menu et chaque bouton ✦ (version Store) ----------
    var PLUS_CARDS=[
      { k:"foyer", img:"foyer", pro:1, t:"Foyer partagé", p:"Invite ta famille : chacun ses droits, ses tickets arrivent chez toi. Tout est chiffré. Un achat pour tout le foyer : tes membres profitent aussi de "+APP_NAME+" Plus. Rejoindre le foyer de quelqu'un reste gratuit.", tags:["QR code", "Un achat pour le foyer"] },
      { k:"equilibre", img:"equilibre", pro:1, t:"Qui doit combien à qui", p:"Ce que chacun a vraiment payé pour le commun, comparé à sa part, et les remboursements en un geste. Aussi pour un voyage ou une sortie entre amis, même s'ils n'ont pas l'appli.", tags:["Avec ou sans virement", "Groupes"] },
      { k:"factures", img:"factures", pro:1, t:"Tes factures", p:"Électricité, gaz, eau, internet : le prélèvement dans « À venir » et la prochaine facture estimée, selon la saison.", tags:["PDF", "Factur-X", "Photos"] },
      { k:"avancee", img:"analyse", pro:1, t:"Analyse avancée", p:"Ton inflation à toi, tes alertes, ton reste à vivre et des pistes d'économies. Calculé sur ton téléphone.", tags:["Données INSEE"] },
      { k:"widgets", img:"widgets", pro:1, t:"Widgets", p:"Ton solde et tes dépenses sur l'écran du téléphone, masqués derrière ton empreinte.", tags:["Android"] },
      { k:"fin", fin:1, t:"Tout le reste est gratuit", p:"Tickets, comptes, frais fixes, provisions, commun, import de relevé, sauvegarde automatique sur Google Drive et restauration : gratuits, sans limite." } ];
    function plusShow(start){
      if(document.querySelector(".wlc.plus")) return;
      var S=PLUS_CARDS, i=0; S.forEach(function(c, k){ if(c.k===start) i=k; });
      var ov=document.createElement("div"); ov.className="wlc plus"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-label", ""+APP_NAME+" Plus");
      document.body.appendChild(ov);
      function close(){ try{ document.body.removeChild(ov); }catch(e){} }
      function go(dx){ var n=i+dx; if(n>=0 && n<S.length){ i=n; paint(); } }
      function paint(){
        var last=i===S.length-1;
        ov.innerHTML=wlcCardHTML(S[i], S, i, last ? '<button type="button" class="wlc-skip" id="plLater">Plus tard</button><button type="button" class="wlc-go" id="plBuy">Prendre '+APP_NAME+' Plus · bientôt</button>'
                                                  : '<button type="button" class="wlc-skip" id="plLater">Plus tard</button><button type="button" class="wlc-go" id="plNext">Suivant</button>', false);
        ov.querySelector("#plLater").onclick=close;
        var nx=ov.querySelector("#plNext"); if(nx) nx.onclick=function(){ go(1); };
        var by=ov.querySelector("#plBuy"); if(by) by.onclick=function(){ uiToast("L'achat de "+APP_NAME+" Plus arrive bientôt dans l'appli"); };
      }
      wlcSwipe(ov, go); paint();
    }
    function welcomeShow(after){
      if(document.querySelector(".wlc")) return;
      var S=welcomeSlides(), i=0, ov=document.createElement("div"); ov.className="wlc"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-label", "Bienvenue");
      document.body.appendChild(ov);
      function end(){ store.write(welcomeKey(), 1); try{ document.body.removeChild(ov); }catch(e){} if(after) after(); }
      function paint(){
        var d=S[i], h=wlcCardHTML(d, S, i, (i<S.length-1 ? '<button type="button" class="wlc-skip" id="wlcSkip">Passer</button>' : (i ? '<button type="button" class="wlc-skip" id="wlcPrev">‹ Retour</button>' : '<span></span>'))+
           '<button type="button" class="wlc-go" id="wlcNext">'+(i<S.length-1 ? "Suivant" : "Commencer")+'</button>', !fyMember() && plusOffer());
        ov.innerHTML=h;
        ov.querySelector("#wlcNext").onclick=function(){ if(i<S.length-1){ i++; paint(); } else end(); };
        var sk=ov.querySelector("#wlcSkip"); if(sk) sk.onclick=end;
        var pv=ov.querySelector("#wlcPrev"); if(pv) pv.onclick=function(){ i--; paint(); };
        var pl=ov.querySelector("#wlcPlus"); if(pl) pl.onclick=function(){ plusShow(null); };
      }
      wlcSwipe(ov, function(dx){ if(document.querySelector(".wlc.plus")) return; var n=i+dx; if(n>=0 && n<S.length){ i=n; paint(); } });
      paint();
    }
    // téléphone déjà utilisé, ou membre d'un foyer : une seule fois, après le code de verrouillage
    // Catégories en arbre : une fois, montrer où chaque ancienne catégorie a été rangée (après l'accueil et le code)
    function catMigAuto(){
      if(!store.read("catMigShow", false) || fyMember() || (window.__tkNoWelcome && !window.__catMigTest)) return;   // tests : seulement si demandé
      var n=0; (function wait(){ if(document.getElementById("lockscreen") || document.querySelector(".sheet-overlay") || document.querySelector(".wlc-card")){ if(++n<480) setTimeout(wait, 500); return; } catMigSheet(); })();
    }
    function catMigSheet(){
      var subs=[]; catMains().forEach(function(m){ catSubs(m).forEach(function(c){ subs.push(c); }); });
      var h='<div class="sheet-title">Tes catégories sont rangées</div><div class="ui-help" style="margin:0 2px 10px">Les catégories ont maintenant deux niveaux : une dizaine de grandes catégories, et dedans tes catégories, devenues des sous-catégories. Chacune garde ses tickets et ses budgets ; rien n\'est supprimé. Vérifie qu\'elles sont au bon endroit.</div><div class="dr-grp">'+
        subs.map(function(c){ return '<div class="dr-row"><span class="t">'+esc(c)+'<small>'+catIcon(catMain(c)).e+' '+esc(catMain(c))+'</small></span><button type="button" class="cmg" data-cat="'+esc(c)+'">Changer</button></div>'; }).join("")+'</div>'+
        '<div class="ui-stack" style="margin-top:12px"><button type="button" class="btn primary ui-no">C\'est bon</button></div>';
      var sh=uiSheet(h); sh.q(".ui-no").onclick=function(){ store.remove("catMigShow"); sh.close(); };
      [].forEach.call(sh.qa(".cmg"), function(b){ b.onclick=function(){ var c=b.getAttribute("data-cat"); sh.close();
        var cur=catMain(c);
        uiChoice("Ranger « "+c+" » dans", "", catMains().filter(function(m){ return m!==cur; }).map(function(m){ return { l:catIcon(m).e+"  "+m, primary:false, fn:function(){ CAT_PARENT[c]=m; persistCatParent(); render(); catMigSheet(); } }; }).concat([{ l:"Garder dans "+cur, primary:false, fn:catMigSheet }])); }; });
    }
    function welcomeAuto(){
      if(store.read(welcomeKey(), null) || window.__tkNoWelcome) return;   // __tkNoWelcome : posé par les tests automatiques
      var n=0; (function wait(){ if(document.getElementById("lockscreen") || document.querySelector(".sheet-overlay")){ if(++n<240) setTimeout(wait, 500); return; } welcomeShow(null); })();
    }
