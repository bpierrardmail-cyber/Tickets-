package fr.bpierrard.tickets.beta;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProviderInfo;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.CheckBox;
import android.widget.LinearLayout;
import android.widget.RadioButton;
import android.widget.Switch;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

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
                : kind == TkWidgetFoyer.class ? "Foyer" : kind == TkWidgetBourse.class ? "Bourse" : kind == TkWidgetEpargne.class ? "Épargne" : "Tickets";
        ((TextView) findViewById(R.id.tk_cfg_title)).setText("Widget « " + name + " »");

        final RadioButton moi = findViewById(R.id.tk_cfg_moi), foyer = findViewById(R.id.tk_cfg_foyer);
        // Épargne : Moi / Foyer s'il y a l'épargne de plusieurs personnes, puis courbe, lignes comptées, provisions
        final boolean isEp = kind == TkWidgetEpargne.class;
        JSONObject ep = d == null ? null : d.optJSONObject("epargne");
        boolean epMulti = isEp && TkWidgets.epMultiOwner(ep);
        if (isEp) { moi.setText("Moi · mon épargne"); foyer.setText("Foyer · toute l'épargne"); }
        findViewById(R.id.tk_cfg_scope).setVisibility((isSolde && multi) || epMulti ? View.VISIBLE : View.GONE);
        findViewById(R.id.tk_cfg_ep).setVisibility(isEp ? View.VISIBLE : View.GONE);
        final List<CheckBox> boxes = new ArrayList<>();
        final List<String> boxIds = new ArrayList<>();
        final RadioButton p6 = findViewById(R.id.tk_cfg_p6), p12 = findViewById(R.id.tk_cfg_p12), pall = findViewById(R.id.tk_cfg_pall);
        final Switch noProv = findViewById(R.id.tk_cfg_noprov);
        if (isEp) {
            int per = TkWidgets.prefs(this).getInt("epp_" + id, 12);
            p6.setChecked(per == 6); p12.setChecked(per == 12); pall.setChecked(per <= 0);
            noProv.setChecked(TkWidgets.prefs(this).getBoolean("epnp_" + id, false));
            // le montant retiré : toutes les provisions, où qu'elles soient
            JSONArray pH = ep == null ? null : ep.optJSONArray("provH");
            double pv = pH == null || pH.length() == 0 ? 0 : pH.optDouble(pH.length() - 1, 0);
            String sym = d == null ? "€" : d.optString("sym", "€");
            ((TextView) findViewById(R.id.tk_cfg_noprov_t)).setText(pv > 0.004
                    ? "Retirer les provisions du total (" + TkWidgets.money(pv, sym, 0) + ")"
                    : "Retirer les provisions du total (aucune pour l'instant)");
            String epEx = "," + TkWidgets.prefs(this).getString("epx_" + id, "") + ",";
            LinearLayout list = findViewById(R.id.tk_cfg_eplist);
            JSONArray items = ep == null ? null : ep.optJSONArray("items");
            for (int i = 0; items != null && i < items.length(); i++) {
                JSONObject it = items.optJSONObject(i);
                if (it == null) continue;
                CheckBox cb = new CheckBox(this);
                String who = epMulti ? " · " + it.optString("o") : "";
                cb.setText(it.optString("n") + who);
                cb.setTextColor(0xFFECEEF3);
                cb.setTextSize(16);
                cb.setMinHeight((int) (48 * getResources().getDisplayMetrics().density));
                cb.setButtonTintList(android.content.res.ColorStateList.valueOf(0xFF4FD6A0));
                cb.setChecked(!epEx.contains("," + it.optString("id") + ","));
                list.addView(cb);
                boxes.add(cb); boxIds.add(it.optString("id"));
            }
        }
        // Bourse : période (24 h, ce mois, 1 mois, 6 mois, 1 an, depuis le début)
        final boolean isBo = kind == TkWidgetBourse.class;
        findViewById(R.id.tk_cfg_bo).setVisibility(isBo ? View.VISIBLE : View.GONE);
        final String[] boK = { "24h", "mois", "1m", "6m", "1a", "max" };
        final int[] boR = { R.id.tk_cfg_b24, R.id.tk_cfg_bmois, R.id.tk_cfg_b1m, R.id.tk_cfg_b6m, R.id.tk_cfg_b1a, R.id.tk_cfg_bmax };
        if (isBo) {
            String cur = TkWidgets.prefs(this).getString("bp_" + id, "24h");
            for (int i = 0; i < boK.length; i++) ((RadioButton) findViewById(boR[i])).setChecked(boK[i].equals(cur));
        }
        boolean isFoyer = kind == TkWidgetEpargne.class ? TkWidgets.epFoyer(this, id) : "foyer".equals(TkWidgets.scope(this, id));
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
            if (isEp) {
                StringBuilder off = new StringBuilder();
                for (int i = 0; i < boxes.size(); i++) if (!boxes.get(i).isChecked()) { if (off.length() > 0) off.append(','); off.append(boxIds.get(i)); }
                TkWidgets.prefs(this).edit()
                        .putString("epx_" + id, off.toString())
                        .putString("escope_" + id, foyer.isChecked() ? "foyer" : "moi")
                        .putInt("epp_" + id, p6.isChecked() ? 6 : pall.isChecked() ? 0 : 12)
                        .putBoolean("epnp_" + id, noProv.isChecked())
                        .apply();
            }
            if (isBo) {
                String bp = "24h";
                for (int i = 0; i < boK.length; i++) if (((RadioButton) findViewById(boR[i])).isChecked()) bp = boK[i];
                TkWidgets.prefs(this).edit().putString("bp_" + id, bp).apply();
            }
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
