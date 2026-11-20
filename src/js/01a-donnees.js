    // ---------- Données : forme attendue et versions (20/11, architecture étape 3) ----------
    // Toute donnée venue d'une sauvegarde (fichier, ZIP, Google Drive) passe par dataClean avant d'être écrite :
    // une clé à la mauvaise forme est laissée de côté au lieu d'abîmer l'appli ; dans une liste, une fiche illisible est retirée.
    // (Les changements venus d'un membre du foyer ont leurs propres contrôles : fyPathOk, fyAllowed, fyFromMember.)
    var DATA_SHAPE={
      entries:"tickets", fraisCommuns:"fiches", virements:"fiches", virRec:"fiches", provisions:"fiches", factures:"fiches",
      epargne:"fiches", bourse:"fiches", commRemb:"fiches", groupes:"fiches", comptes:"fiches", personnes:"fiches", releve:"liste",
      cats:"liste", familles:"liste", produits:"liste", bourseHist:"liste",
      catParent:"objet", familleDe:"objet", appris:"objet", argentMois:"objet", liquideMois:"objet", budgets:"objet", budgetsP:"objet",
      soldeInit:"objet", factAlias:"objet", factAppris:"objet", tkAppris:"objet", tkMag:"objet", communParts:"objet", comProd:"objet"
    };
    function dataIsObj(v){ return !!v && typeof v==="object" && !Array.isArray(v); }
    // rend la valeur à écrire, ou undefined si elle n'a pas la forme attendue
    function dataClean(k, v){
      var sh=DATA_SHAPE[k];
      if(v===null || !sh) return v;   // null = « pas de valeur » ; clé sans forme connue (réglages simples) : telle quelle
      if(sh==="objet") return dataIsObj(v) ? v : undefined;
      if(!Array.isArray(v)) return undefined;
      if(sh==="liste") return v;
      var out=v.filter(dataIsObj);
      if(sh==="tickets") out=out.filter(function(e){ return (typeof e.id==="number" || typeof e.id==="string") && typeof (e.date==null ? "" : e.date)==="string"; })
        .map(function(e){ if(e.articles!=null && !Array.isArray(e.articles)) e.articles=[]; if(e.articles) e.articles=e.articles.filter(dataIsObj); return e; });
      return out;
    }
    // Versions des données : chaque migration faite une fois laisse une marque (clé → valeur). Une sauvegarde d'avant
    // une migration la refait au redémarrage (restoreApply retire les marques qu'elle n'a pas). Une nouvelle migration s'ajoute ici.
    var DATA_MIGRATIONS=[
      { k:"taxoV2", v:2, quoi:"catégories, 1re version de la taxonomie", ou:"14-fiche-d-une-action-crypto.js" },
      { k:"virEpV2", v:1, quoi:"virements vers l'épargne reliés aux livrets", ou:"07-categories-en-arbre.js" },
      { k:"taxoV3", v:3, quoi:"produits rangés dans l'arbre des catégories (famMerge)", ou:"15-produits-ranges-dans-l-arbre-des-categor.js" },
      { k:"taxoV4", v:4, quoi:"réparation des familles migrées sous un autre nom (catRepair)", ou:"15-produits-ranges-dans-l-arbre-des-categor.js" },
      { k:"catParent", v:null, quoi:"arbre des catégories (catSetup) : absent de la sauvegarde → refait", ou:"07-categories-en-arbre.js" }
    ];
    function dataMigReset(data){
      DATA_MIGRATIONS.forEach(function(m){ var has=(m.v===null) ? (m.k in data) : data[m.k]===m.v; if(!has) store.remove(m.k); });
    }
