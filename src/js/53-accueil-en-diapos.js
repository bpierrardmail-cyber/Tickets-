    // ---------- Accueil en diapos : au premier démarrage, une fois pour un téléphone déjà utilisé, et une fois quand on devient membre d'un foyer ----------
    function welcomeKey(){ return fyMember() ? "welcomeFy" : "welcomeSeen"; }
    // icônes au trait (couleur de l'appli)
    var WLC_IC={
      ticket:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>',
      scan:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M4 12h16"/></svg>',
      aide:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6"/><path d="M12 17h.01"/></svg>',
      foyer:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 20v-1a5 5 0 0 1 5-5h1a5 5 0 0 1 5 5v1"/><circle cx="17" cy="9" r="2.4"/><path d="M17 14a4 4 0 0 1 4 4v1"/></svg>'
    };
    function welcomeSlides(){   // propriétaire : 3 diapos ; membre d'un foyer : 2 diapos (maquette du 02/11)
      var mem=fyMember(), own=mem ? (fyCfg.owner||"le propriétaire") : "";
      if(mem) return [
        { ic:"foyer", t:"Tu as rejoint le foyer de "+own, l:[
          "Tu vois ce que "+own+" partage avec toi",
          "Onglets en lecture ou en modification, selon ses choix",
          "Ton accueil est personnel : ta part, tes tickets",
          "Tes modifications partent chez "+own ] },
        { ic:"scan", t:"Ajouter tes tickets", l:[
          "Bien scanner : ticket à plat, bien éclairé, en entier ; vérifie le total",
          "Tes tickets vont dans ton compte",
          "Guide du membre : Menu › Aide" ] } ];
      return [
        { img:"accueil", t:"Bienvenue dans "+APP_NAME+"", l:[
          "Gère tes achats, comptes, frais fixes et le commun",
          "Invite ta famille et retrouve ses dépenses ✦",
          "Tes données restent privées : personne ne les récupère, pas même nous",
          "Sans compte, sans pub, hors ligne*" ],
          n:"*Sauf première connexion, transfert des tickets du foyer et sauvegarde sur Drive." },
        { img:"scan", t:"Scanne tes tickets", p:"Montant, magasin, date et articles lus sur ton téléphone. L'appli apprend de tes corrections.",
          tags:["Photo", "Galerie", "Saisie"], n:"Astuce : ticket à plat, bien éclairé, pris en entier." },
        { img:"releve", t:"Importe ton relevé", p:"Depuis l'appli de ta banque : Partager › "+APP_NAME+". Le relevé devient tickets, frais fixes et virements, sans doublon. Tout est lu sur ton téléphone.",
          tags:["OFX", "QIF", "CSV"] },
        { art:"sauv", t:"Ne perds jamais tes comptes", l:[
          "Sauvegarde automatique sur ton Google Drive, ou dans un fichier quand tu veux",
          "Chiffrée avec ton code de secours : personne d'autre ne peut l'ouvrir",
          "Nouveau téléphone ? Ta sauvegarde et ton code te rendent tout, ton foyer compris" ],
          tags:["Drive", "ZIP", "JSON"] },
        { img:"avenir", t:"Vois ce qui arrive", p:"Les 12 prochains mois : frais fixes, provisions, ce qui manquera. Le guide est dans Menu › Aide." } ];
    }
    function plusOffer(){ return (EDITION==="store" || DEMO) && !plusUnlocked(); }
    var WLC_ART={ sauv:'<svg width="230" height="110" viewBox="0 0 230 110" fill="none" aria-hidden="true"><rect x="8" y="20" width="44" height="74" rx="9" fill="#20242e" stroke="#4fd6a0" stroke-width="2"/><rect x="20" y="30" width="20" height="4" rx="2" fill="#4fd6a0"/><path d="M60 57h34M90 52l6 5-6 5" stroke="#4fd6a0" stroke-width="2"/><circle cx="115" cy="57" r="17" fill="#20242e" stroke="#e0a458" stroke-width="2"/><path d="M109 57a6 6 0 1 1 6 6h-6v-6z" fill="#e0a458"/><path d="M136 57h30M162 52l6 5-6 5" stroke="#4fd6a0" stroke-width="2"/><path d="M178 66a12 12 0 0 1 2-24 16 16 0 0 1 30 4 10 10 0 0 1 2 20z" fill="#20242e" stroke="#4fd6a0" stroke-width="2"/></svg>' };
    // capture absente : la carte s'en passe (plus de onerror="…" dans le HTML : la CSP n'autorise que le script de la page)
    document.addEventListener("error", function(ev){ var t=ev.target; if(t && t.tagName==="IMG" && t.parentNode && /\bwlc-shot\b/.test(t.parentNode.className||"")) t.parentNode.style.display="none"; }, true);
    function wlcCardHTML(d, S, i, btns, plusLink){
      var h='<div class="wlc-card'+(d.img||d.fin?' img':'')+'"><div class="wlc-dots">'; S.forEach(function(x, k){ h+='<i'+(k===i?' class="on"':'')+'></i>'; }); h+='</div>';
      if(d.art) h+='<div class="wlc-art">'+WLC_ART[d.art]+'</div>';
      else if(d.img) h+='<div class="wlc-shot"><img src="vitrine/'+d.img+'.jpg" alt=""></div>';
      else if(d.fin) h+='<div class="wlc-fin"><b>✦</b><span>'+APP_NAME+' Plus</span><small>Prix : bientôt</small></div>';
      else h+='<div class="wlc-ic">'+(WLC_IC[d.ic]||"")+'</div>';
      h+='<div class="wlc-t">'+(d.pro?'<span class="wlc-pro">✦ Plus</span>':'')+esc(d.t)+'</div>';
      if(d.p) h+='<p class="wlc-p">'+esc(d.p)+'</p>';
      if(d.l){ h+='<ul>'; d.l.forEach(function(x){ h+='<li>'+esc(x)+'</li>'; }); h+='</ul>'; }
      if(d.tags) h+='<div class="wlc-tags">'+d.tags.map(function(x){ return '<span>'+esc(x)+'</span>'; }).join("")+'</div>';
      if(d.n) h+='<div class="wlc-note">'+esc(d.n)+'</div>';
      if(plusLink) h+='<button type="button" class="wlc-plusl" id="wlcPlus">✦ Découvrir '+APP_NAME+' Plus</button>';
      return h+'<div class="wlc-bt">'+btns+'</div></div>';
    }
    function wlcSwipe(ov, go){ var x0=null;
      ov.addEventListener("touchstart", function(ev){ x0=ev.touches[0].clientX; }, { passive:true });
      ov.addEventListener("touchend", function(ev){ if(x0===null) return; var dx=ev.changedTouches[0].clientX-x0; x0=null; if(dx<-50) go(1); else if(dx>50) go(-1); }, { passive:true }); }
