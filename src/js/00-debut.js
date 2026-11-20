  (function(){
    // Nom de l'appli affiché partout (08/11) : à changer ici le jour où le nom est choisi (+ <title>, guide/*.md, APP_NAME de apk-beta.yml)
    var APP_NAME="Tickets";
    try{ var bf=document.getElementById("bootfail"); if(bf) bf.parentNode.removeChild(bf); }catch(e){}
    // Sécurité (08/11, revue C1) : personne ne peut ajouter de propriété à tous les objets (« pollution de prototype »)
    try{ Object.freeze(Object.prototype); }catch(e){}
    "use strict";
