    // ---------- Budgets par catégorie ----------
    var budgets = store.read("budgets", {});
    function persistBudgets(){ store.write("budgets", budgets); }
    function budgetColor(ratio, base){ return ratio>1 ? "var(--coral)" : (ratio>=0.8 ? "#e6b450" : base); }
    // Budgets personnels : { prénom: { catégorie: montant } } ; « budgets » reste celui du foyer (tous les tickets)
    var budgetsP = store.read("budgetsP", {}) || {};
    function persistBudgetsP(){ store.write("budgetsP", budgetsP); }
