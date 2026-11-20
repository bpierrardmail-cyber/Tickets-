    // ---------- Sauvegarde : rappel + partage ----------
    function backupAgeDays(){ return backupAge().days; }
    try{ if(navigator.storage && navigator.storage.persist) navigator.storage.persist(); }catch(e){}

