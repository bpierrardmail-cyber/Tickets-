package fr.bpierrard.tickets.beta;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProviderInfo;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.RadioButton;
import android.widget.Switch;
import android.widget.TextView;

import org.json.JSONObject;

/**
 * Réglages d'un widget, par un appui long (« Paramètres du widget ») ; plus rien à régler au moment de le poser
 * sur Android 12 et plus récents. Moi ou Foyer (widget Solde, s'il y a plusieurs comptes) et masquage automatique.
 */
public class TkWidgetConfig extends Activity {
    private int id = AppWidgetManager.INVALID_APPWIDGET_ID;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        setResult(RESULT_CANCELED);
        Bundle ex = getIntent().getExtras();
        if (ex != null) id = ex.getInt(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        if (id == AppWidgetManager.INVALID_APPWIDGET_ID) { finish(); return; }
        setContentView(R.layout.tk_widget_config);

        final AppWidgetManager m = AppWidgetManager.getInstance(this);
        AppWidgetProviderInfo info = m.getAppWidgetInfo(id);
        String cls = info != null && info.provider != null ? info.provider.getClassName() : "";
        Class<?> k = TkWidgetSolde.class;
        try { k = Class.forName(cls); } catch (Exception ignored) { }
        final Class<?> kind = k;

        JSONObject d = TkWidgets.data(this);
        boolean isSolde = kind == TkWidgetSolde.class, multi = d != null && d.optBoolean("multi", false);
        String name = kind == TkWidgetSolde.class ? "Solde" : kind == TkWidgetCommun.class ? "Commun" : kind == TkWidgetMois.class ? "Mois en cours"
                : kind == TkWidgetFoyer.class ? "Foyer" : kind == TkWidgetBourse.class ? "Bourse du jour" : "Tickets";
        ((TextView) findViewById(R.id.tk_cfg_title)).setText("Widget « " + name + " »");

        final RadioButton moi = findViewById(R.id.tk_cfg_moi), foyer = findViewById(R.id.tk_cfg_foyer);
        findViewById(R.id.tk_cfg_scope).setVisibility(isSolde && multi ? View.VISIBLE : View.GONE);
        boolean isFoyer = "foyer".equals(TkWidgets.scope(this, id));
        moi.setChecked(!isFoyer);
        foyer.setChecked(isFoyer);

        final Switch mask = findViewById(R.id.tk_cfg_mask);
        mask.setChecked(TkWidgets.autoMask(this));
        ((TextView) findViewById(R.id.tk_cfg_mask_help)).setText(
                "Touche le montant d'un widget pour afficher les montants (ton empreinte ou le code du téléphone est demandé), "
                + "touche à nouveau pour les masquer. Touche le titre › pour ouvrir Tickets. Vaut pour tous les widgets Tickets.");

        findViewById(R.id.tk_cfg_cancel).setOnClickListener(v -> finish());
        findViewById(R.id.tk_cfg_ok).setOnClickListener(v -> {
            boolean auto = mask.isChecked();
            TkWidgets.prefs(this).edit()
                    .putBoolean("auto", auto)
                    .putString("scope_" + id, foyer.isChecked() ? "foyer" : "moi")
                    .apply();
            // masquage auto activé alors que les montants sont affichés pour toujours : ils se masquent dans 2 minutes
            long until = TkWidgets.prefs(this).getLong("vis_until", 0);
            if (auto && until == Long.MAX_VALUE) TkWidgets.showAll(this);
            else if (!auto && !TkWidgets.masked(this)) { TkWidgets.prefs(this).edit().putLong("vis_until", Long.MAX_VALUE).apply(); TkWidgets.cancelHide(this); }
            TkWidgets.updateAll(this);
            Intent r = new Intent();
            r.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id);
            setResult(RESULT_OK, r);
            finish();
        });
    }
}
