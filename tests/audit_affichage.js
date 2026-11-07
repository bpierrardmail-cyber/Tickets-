// Contrôle d'affichage générique, injecté par t141 : renvoie la liste des défauts visibles sur l'écran courant.
//   coupe-h / coupe-l : contenu coupé par un overflow:hidden sans moyen de défiler
//   deborde           : texte qui sort de son bouton / de sa case
//   hors-ecran        : élément qui sort de l'écran sur le côté (sans conteneur qui défile)
//   fenetre           : fenêtre (sheet, menu) plus haute que l'écran sans défilement, ou qui sort de l'écran
//   masque            : bouton / champ caché par un autre élément (barre du bas, « + », pastille…), donc impossible à toucher
window.__audit = function(phase){
  var W = innerWidth, H = innerHeight, out = [], seen = new Set();
  function vis(el){
    var r = el.getBoundingClientRect(); if(r.width < 2 || r.height < 2) return false;
    for(var e = el; e && e !== document.body; e = e.parentElement){ var s = getComputedStyle(e); if(s.display === "none" || s.visibility === "hidden" || parseFloat(s.opacity) < 0.05) return false; }
    return true;
  }
  function sig(el){ var s = el.tagName.toLowerCase(); if(el.id) s += "#" + el.id; var c = (typeof el.className === "string") ? el.className.trim().split(/\s+/).filter(function(x){ return x && !/^(on|sel|act|active|open)$/.test(x); }).slice(0, 3).join(".") : ""; if(c) s += "." + c; return s; }
  function txt(el){ return (el.innerText || el.value || el.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 50); }
  function add(kind, el, extra){ var k = kind + "|" + sig(el); if(seen.has(k)) return; seen.add(k); out.push({ kind: kind, sig: sig(el), txt: txt(el), extra: extra || "" }); }
  function scrollerX(el){ for(var e = el.parentElement; e && e !== document.documentElement; e = e.parentElement){ var s = getComputedStyle(e); if(/(auto|scroll|hidden|clip)/.test(s.overflowX)) return e; } return null; }
  function ellipsisInside(el){ var s = getComputedStyle(el); if(s.textOverflow === "ellipsis" || (s.webkitLineClamp && s.webkitLineClamp !== "none")) return true; return false; }
  // la couche du dessus : une fenêtre ouverte, sinon la page
  var layers = [].filter.call(document.querySelectorAll(".sheet-overlay, .drawer-ov, #lockscreen, .lb, .lightbox, .wlc-ov, .plus-ov, .ovl, [role=dialog]"), vis);
  var top = layers.length ? layers[layers.length - 1] : document.body;
  var all = top.querySelectorAll("*");
  for(var i = 0; i < all.length; i++){
    var el = all[i]; if(el.tagName === "svg" || el.closest("svg") || el.tagName === "CANVAS" || el.tagName === "OPTION" || el.tagName === "SCRIPT" || el.tagName === "STYLE") continue;
    if(!vis(el)) continue;
    var s = getComputedStyle(el), r = el.getBoundingClientRect();
    // contenu coupé en hauteur
    if(/(hidden|clip)/.test(s.overflowY) && el.clientHeight > 0 && !el.matches(".hm-ch")   /* .hm-ch : petite carte de l'Accueil, coupée exprès pour tenir dans l'écran (homeFit) ; elle s'ouvre en entier */ && el.scrollHeight > el.clientHeight + 3 && !ellipsisInside(el)){
      var cut = [].some.call(el.querySelectorAll("*"), function(ch){ if(!(ch.innerText || "").trim() && ch.tagName !== "BUTTON" && ch.tagName !== "INPUT") return false; var cr = ch.getBoundingClientRect(); return cr.height > 2 && cr.top < r.bottom - 2 && cr.bottom > r.bottom + 3 && vis(ch) && ch.children.length === 0; });
      if(cut) add("coupe-h", el, el.scrollHeight + " px dans " + el.clientHeight + " px");
    }
    // contenu coupé en largeur (sans « … »)
    if(/(hidden|clip)/.test(s.overflowX) && el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 3 && !ellipsisInside(el) && !/(auto|scroll)/.test(s.overflowY)){
      var cutx = [].some.call(el.querySelectorAll("*"), function(ch){ if(!(ch.innerText || "").trim()) return false; var cr = ch.getBoundingClientRect(); return cr.width > 2 && ch.children.length === 0 && (cr.right > r.right + 3 || cr.left < r.left - 3) && !ellipsisInside(ch) && vis(ch); });
      if(cutx) add("coupe-l", el, el.scrollWidth + " px dans " + el.clientWidth + " px");
    }
    // texte tronqué par « … » : jamais pour un montant, un titre, un onglet, un mois ou un bouton court (un nom de magasin dans une liste, oui)
    if(ellipsisInside(el) && el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0){
      var own = [].filter.call(el.childNodes, function(n){ return n.nodeType === 3; }).map(function(n){ return n.textContent; }).join("").trim();
      var tt = (el.children.length ? own : (el.textContent || "")).trim();   // le texte de l'élément lui-même (pas celui d'un sous-titre qui passe à la ligne)
      var money = /\d/.test(tt) && /(€|\$|£|%|\d[,.]\d\d)/.test(tt);
      var shortLbl = tt.length <= 22 && (/(BUTTON|H1|H2|H3)/.test(el.tagName) || el.closest(".avtabs, .htitle, .hmn, .acsel, .chip, .hstat, .head, .dash-split"));   // un nom dans une ligne de liste peut finir par « … »
      if(money || shortLbl) add("tronque", el, "« " + tt.slice(0, 30) + " » : " + el.scrollWidth + " px dans " + el.clientWidth);
    }
    // texte qui sort de son bouton ou de sa case
    if(/(BUTTON|LABEL|A)/.test(el.tagName) || /\b(chip|btn|cs|pill|tag|badge)\b/.test(el.className || "")){
      if(s.overflowX === "visible" && el.scrollWidth > el.clientWidth + 3 && el.clientWidth > 0) add("deborde", el, el.scrollWidth + " px dans " + el.clientWidth + " px");
    }
    // hors de l'écran sur le côté
    if((r.right > W + 1 || r.left < -1) && (el.children.length === 0 || /(BUTTON|INPUT|SELECT)/.test(el.tagName)) && (el.innerText || "").trim() && !scrollerX(el) && s.position !== "fixed")
      add("hors-ecran", el, "de " + Math.round(r.left) + " à " + Math.round(r.right) + " px (écran " + W + ")");
  }
  // fenêtres
  [].forEach.call(document.querySelectorAll(".sheet, .drawer"), function(sh){
    if(!vis(sh)) return; var r = sh.getBoundingClientRect(), s = getComputedStyle(sh);
    var scrollable = /(auto|scroll)/.test(s.overflowY) && sh.scrollHeight > sh.clientHeight + 2;
    if(r.top < -1 || r.bottom > H + 1) add("fenetre", sh, "de " + Math.round(r.top) + " à " + Math.round(r.bottom) + " px (écran " + H + ")");
    if(sh.scrollHeight > sh.clientHeight + 3 && !/(auto|scroll)/.test(s.overflowY)) add("fenetre", sh, "plus haute que sa place, ne défile pas");
  });
  // boutons et champs cachés par un autre élément
  function canScrollUp(e){ for(var a = e.parentElement; a; a = a.parentElement){ if(a === document.body || a === document.documentElement) return scrollY > 4; var as = getComputedStyle(a); if(/(auto|scroll)/.test(as.overflowY) && a.scrollHeight > a.clientHeight + 2) return a.scrollTop > 4; } return false; }
  function pinned(e){ for(; e && e !== document.documentElement; e = e.parentElement){ var p = getComputedStyle(e).position; if(p === "fixed" || p === "sticky") return e; } return null; }
  function canScrollDown(e){ for(var a = e.parentElement; a; a = a.parentElement){ if(a === document.body || a === document.documentElement) return document.documentElement.scrollHeight - (scrollY + H) > 4; var as = getComputedStyle(a); if(/(auto|scroll)/.test(as.overflowY) && a.scrollHeight > a.clientHeight + 2) return a.scrollHeight - a.clientHeight - a.scrollTop > 4; } return false; }
  [].forEach.call(top.querySelectorAll("button, a[href], input:not([type=hidden]), select, textarea, [data-k], .chip, .entry"), function(el){
    if(el.closest("svg") || !vis(el)) return; var r = el.getBoundingClientRect();
    var cx = Math.min(Math.max(r.left + r.width / 2, 1), W - 2), cy = r.top + Math.min(r.height / 2, 14);
    if(cy < 2 || cy > H - 2 || r.left + r.width / 2 < 0 || r.left + r.width / 2 > W) return;   // pas dans l'écran (on défile pour le voir)
    for(var a = el.parentElement; a && a !== document.body; a = a.parentElement){ var as = getComputedStyle(a); if(/(auto|scroll|hidden|clip)/.test(as.overflowY + as.overflowX)){ var ar = a.getBoundingClientRect(); if(cy < ar.top || cy > ar.bottom || cx < ar.left || cx > ar.right) return; } }   // défilé hors de sa boîte : pas caché
    var hit = document.elementFromPoint(cx, cy); if(!hit) return;
    if(hit === el || el.contains(hit) || hit.contains(el)) return;
    if(hit.closest && el.closest && hit.closest("label") && hit.closest("label").contains(el)) return;
    // ce qui est sous le bord haut de l'écran quand on a défilé (en-tête collé) n'est pas un défaut si la page peut défiler pour le montrer
    var hs = getComputedStyle(hit), cover = hit.closest("#nav, #navplus, .navplus, [id$=Pill], .pill, .ui-toast, header, .hdr, .sticky, .thead") || hit;
    var cs = getComputedStyle(cover);
    if((cs.position === "sticky" || cs.position === "fixed") && r.top < cover.getBoundingClientRect().bottom && cover.getBoundingClientRect().top < 60) return;   // en-tête collé en haut : on peut défiler
    var pin = pinned(hit);
    if(pin && pin.getBoundingClientRect().top > Math.min(H / 2, r.top - 1) && canScrollDown(el)) return;   // barre du bas, « + », boutons collés en bas d'une fenêtre : on peut encore défiler pour le montrer (vérifié une fois en bas)
    if(pin && pin.getBoundingClientRect().bottom < 90 && canScrollUp(el)) return;   // barre du bas : on peut encore défiler pour le montrer (vérifié une fois en bas de page)
    add("masque", el, "sous " + sig(cover) + (txt(cover) ? " «" + txt(cover).slice(0, 20) + "»" : ""));
  });
  return out;
};
