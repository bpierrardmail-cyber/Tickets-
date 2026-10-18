package fr.bpierrard.tickets.beta;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.DashPathEffect;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Shader;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.text.style.RelativeSizeSpan;
import android.view.View;
import android.widget.RemoteViews;

import androidx.core.content.ContextCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Widgets de l'écran d'accueil.
 * L'appli (page web) prépare un résumé JSON de tes chiffres et le donne à Android (TicketsNative.widgetData) ;
 * il est gardé ici, et chaque widget l'affiche. Le widget Bourse recalcule en plus le total
 * toutes les 15 minutes, sans ouvrir l'appli (TkBourseWorker).
 */
public final class TkWidgets {
    static final String PREFS = "tickets_widgets";
    static final int ACCENT = 0xFF4FD6A0, CORAL = 0xFFF4796B, AMBER = 0xFFE6B450, INK = 0xFFECEEF3, SOFT = 0xFFA4AAB6, MUTED = 0xFF7C828E,
            TRACK = 0x1FFFFFFF, GREY = 0xFF8A909C, BLUE = 0xFF7C9CF4, ORANGE = 0xFFE0A458, PURPLE = 0xFFC78BD6;
    static final String[] MOIS_COURTS = { "janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc." };

    static final Class<?>[] PROVIDERS = { TkWidgetScan.class, TkWidgetSolde.class, TkWidgetCommun.class,
            TkWidgetMois.class, TkWidgetFoyer.class, TkWidgetBourse.class };

    // ---------- Données ----------
    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    static JSONObject data(Context c) {
        try { String s = prefs(c).getString("data", null); return s == null ? null : new JSONObject(s); }
        catch (Exception e) { return null; }
    }

    static void save(Context c, String json) { prefs(c).edit().putString("data", json).apply(); }

    // ---------- Masquer / afficher (tous les widgets Tickets ensemble) ----------
    // Masqués par défaut. Toucher le montant : afficher (empreinte ou code du téléphone, TkUnlockActivity)
    // ou masquer (tout de suite). Ils se masquent seuls après 2 minutes, ou quand l'écran s'éteint.
    static final long SHOW_MS = 2 * 60 * 1000L;

    static boolean masked(Context c) { return System.currentTimeMillis() >= prefs(c).getLong("vis_until", 0); }

    /** Se masquer à nouveau après 2 minutes (réglage du widget, par un appui long). */
    static boolean autoMask(Context c) { return prefs(c).getBoolean("auto", true); }

    static void showAll(Context c) {
        boolean auto = autoMask(c);
        long until = auto ? System.currentTimeMillis() + SHOW_MS : Long.MAX_VALUE;
        prefs(c).edit().putLong("vis_until", until).commit();
        if (auto) scheduleHide(c); else cancelHide(c);
        watchScreen(c);
        updateAll(c);
    }

    static void hideAll(Context c) {
        prefs(c).edit().putLong("vis_until", 0).commit();
        cancelHide(c);
        updateAll(c);
    }

    static PendingIntent remaskIntent(Context c) {
        Intent i = new Intent(c, TkWidgetActions.class);
        i.setAction(TkWidgetActions.REMASK);
        return PendingIntent.getBroadcast(c, 8999, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void scheduleHide(Context c) {
        try {
            AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
            long at = SystemClock.elapsedRealtime() + SHOW_MS;
            PendingIntent pi = remaskIntent(c);
            if (Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms())
                am.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, at, pi);
            else am.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, at, pi);
        } catch (Exception e) { android.util.Log.w("TicketsWidgets", "masquage auto : " + e); }
    }

    static void cancelHide(Context c) {
        try { ((AlarmManager) c.getSystemService(Context.ALARM_SERVICE)).cancel(remaskIntent(c)); } catch (Exception ignored) { }
    }

    private static BroadcastReceiver screenOff;

    /** Écran éteint (verrouillé) : on masque tout de suite, tant que l'appli est encore en mémoire. */
    static synchronized void watchScreen(Context c) {
        if (screenOff != null) return;
        final Context app = c.getApplicationContext();
        screenOff = new BroadcastReceiver() {
            @Override
            public void onReceive(Context x, Intent i) { if (!masked(app)) hideAll(app); }
        };
        try { ContextCompat.registerReceiver(app, screenOff, new IntentFilter(Intent.ACTION_SCREEN_OFF), ContextCompat.RECEIVER_NOT_EXPORTED); }
        catch (Exception e) { screenOff = null; }
    }

    /** Toucher le widget : afficher (avec empreinte) ou masquer ; toucher le titre › : ouvrir Tickets. */
    static void taps(RemoteViews v, Context c, int id, boolean mask, String what, String target) {
        if (mask) {
            Intent i = new Intent(c, TkUnlockActivity.class);
            i.setAction("tickets.widget.SHOW." + id);
            i.putExtra("what", what);
            i.putExtra("target", target);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_ANIMATION | Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS);
            v.setOnClickPendingIntent(R.id.tk_root, PendingIntent.getActivity(c, 7000 + id, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        } else {
            Intent i = new Intent(c, TkWidgetActions.class);
            i.setAction(TkWidgetActions.HIDE);
            v.setOnClickPendingIntent(R.id.tk_root, PendingIntent.getBroadcast(c, 8000 + id, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        }
        v.setOnClickPendingIntent(R.id.tk_head, open(c, target, id));
    }

    /** Titre du widget suivi de « › » : c'est là qu'on touche pour ouvrir Tickets. */
    static CharSequence head(String t) {
        SpannableStringBuilder b = new SpannableStringBuilder(t + "  ›");
        b.setSpan(new ForegroundColorSpan(INK), b.length() - 1, b.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        return b;
    }

    static String scope(Context c, int id) { return prefs(c).getString("scope_" + id, "moi"); }

    static void forget(Context c, int[] ids) {
        SharedPreferences.Editor e = prefs(c).edit();
        for (int id : ids) { e.remove("mask_" + id); e.remove("scope_" + id); }
        e.apply();
    }

    static boolean hasWidgets(Context c, Class<?> k) {
        try { return AppWidgetManager.getInstance(c).getAppWidgetIds(new ComponentName(c, k)).length > 0; }
        catch (Exception e) { return false; }
    }

    static void updateAll(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        for (Class<?> k : PROVIDERS) {
            int[] ids;
            try { ids = m.getAppWidgetIds(new ComponentName(c, k)); } catch (Exception e) { continue; }
            for (int id : ids) update(c, m, id, k);
        }
    }

    static void update(Context c, AppWidgetManager m, int id, Class<?> k) {
        try {
            RemoteViews v = build(c, m, id, k);
            if (v != null) m.updateAppWidget(id, v);
        } catch (Exception e) {
            android.util.Log.w("TicketsWidgets", "widget " + k.getSimpleName() + " : " + e);
            // jamais de chiffres d'exemple : un message à la place
            try { m.updateAppWidget(id, message(c, id, "Tickets", "Touche pour ouvrir Tickets.", "list")); } catch (Exception ignored) { }
        }
    }

    // ---------- Ouvrir l'appli ----------
    static Intent openIntent(Context c, String target) {
        Intent i = new Intent(c, MainActivity.class);
        i.setAction("tickets.widget." + target);
        i.putExtra("tk_target", target);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return i;
    }

    static PendingIntent open(Context c, String target, int req) {
        return PendingIntent.getActivity(c, req, openIntent(c, target), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    // ---------- Construction des widgets ----------
    static RemoteViews build(Context c, AppWidgetManager m, int id, Class<?> k) throws Exception {
        String pkg = c.getPackageName();
        JSONObject d = data(c);
        // Version Store : réservé à Tickets Plus (avant le premier résumé, on sait l'édition par la compilation)
        boolean perso = c.getResources().getBoolean(R.bool.tk_bourse);
        boolean locked = d == null ? !perso : ("store".equals(d.optString("edition")) && !d.optBoolean("plus", false));
        if (locked)
            return message(c, id, "Tickets Plus", "Les widgets font partie de Tickets Plus. Touche pour en savoir plus.", "plus");
        if (k == TkWidgetScan.class) {
            RemoteViews v = new RemoteViews(pkg, R.layout.tk_widget_scan);
            v.setOnClickPendingIntent(R.id.tk_root, open(c, "scan", id));
            return v;
        }
        if (d == null) return message(c, id, "Tickets", "Ouvre Tickets une fois pour afficher tes chiffres ici.", "list");
        boolean mask = masked(c);
        String sym = d.optString("sym", "€");
        Bundle o = m.getAppWidgetOptions(id);
        if (k == TkWidgetSolde.class) return solde(c, id, d, mask, sym, o);
        if (k == TkWidgetCommun.class) return commun(c, id, d, mask, sym, o);
        if (k == TkWidgetMois.class) return mois(c, id, d, mask, sym, o);
        if (k == TkWidgetFoyer.class) return foyer(c, id, d, mask, sym, o);
        if (k == TkWidgetBourse.class) return bourse(c, id, d, mask, sym, o);
        return null;
    }

    static RemoteViews message(Context c, int id, String title, String text, String target) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.tk_widget_msg);
        v.setTextViewText(R.id.tk_title, title);
        v.setTextViewText(R.id.tk_text, text);
        v.setOnClickPendingIntent(R.id.tk_root, open(c, target, id));
        return v;
    }

    /** Solde de fin de mois prévu (Moi = compte principal, Foyer = tous les comptes). */
    static RemoteViews solde(Context c, int id, JSONObject d, boolean mask, String sym, Bundle o) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.tk_widget_small);
        boolean multi = d.optBoolean("multi", false);
        boolean foyer = multi && "foyer".equals(scope(c, id));
        JSONObject s = d.optJSONObject("solde");
        JSONObject x = s == null ? null : s.optJSONObject(foyer ? "foyer" : "moi");
        double val = x == null ? 0 : x.optDouble("v", 0), dl = x == null ? 0 : x.optDouble("d", 0);
        v.setTextViewText(R.id.tk_title, head("Fin de mois"));
        if (multi) { v.setViewVisibility(R.id.tk_chip, View.VISIBLE); v.setTextViewText(R.id.tk_chip, foyer ? "Foyer" : "Moi"); }
        else v.setViewVisibility(R.id.tk_chip, View.GONE);
        if (mask) {
            masquer(v, sym);
        } else {
            v.setTextViewText(R.id.tk_big, big(val, sym));
            v.setTextColor(R.id.tk_big, val < 0 ? CORAL : INK);
            v.setTextViewText(R.id.tk_sub, trend(dl, sym, prevMonthShort(d)));
            v.setTextColor(R.id.tk_sub, dl >= 0 ? ACCENT : CORAL);
        }
        // avancée du mois (jour 17 sur 31)
        float frac = monthFraction(d);
        v.setImageViewBitmap(R.id.tk_bar, bar(c, widthDp(o, 172) - 26, 4, frac, ACCENT));
        taps(v, c, id, mask, "Fin de mois", foyer ? "compte_foyer" : "compte");
        return v;
    }

    /** Ta part du Commun ce mois-ci et les frais communs pas encore payés. */
    static RemoteViews commun(Context c, int id, JSONObject d, boolean mask, String sym, Bundle o) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.tk_widget_commun);
        JSONObject x = d.optJSONObject("commun");
        v.setViewVisibility(R.id.tk_chip, View.GONE);
        if (x == null) {
            v.setTextViewText(R.id.tk_title, head("Commun"));
            v.setTextViewText(R.id.tk_big, "—");
            v.setTextViewText(R.id.tk_sub, "");
        } else {
            double pct = x.optDouble("pct", 0);
            v.setTextViewText(R.id.tk_title, head("Commun · ta part (" + pctTxt(pct) + ")"));
            if (mask) masquer(v, sym);
            else {
                v.setTextViewText(R.id.tk_big, big(x.optDouble("part", 0), sym));
                v.setTextColor(R.id.tk_big, INK);
                int todo = x.optInt("todo", 0);
                v.setTextViewText(R.id.tk_sub, todo > 0 ? "● " + todo + " frais à payer" : "✓ frais communs payés");
                v.setTextColor(R.id.tk_sub, todo > 0 ? CORAL : ACCENT);
            }
            v.setImageViewBitmap(R.id.tk_bar, stack(c, widthDp(o, 172) - 26, 4,
                    new double[] { x.optDouble("perso", 0), x.optDouble("com", 0), x.optDouble("prod", 0) }, new int[] { GREY, BLUE, ORANGE }));
        }
        taps(v, c, id, mask, "Commun", "communes");
        return v;
    }

    /** Dépenses du mois : total, budget, cumul jour par jour comparé au mois dernier, plus grosses catégories. */
    static RemoteViews mois(Context c, int id, JSONObject d, boolean mask, String sym, Bundle o) throws Exception {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.tk_widget_mois);
        JSONObject x = d.optJSONObject("mois");
        if (x == null) x = new JSONObject();
        double spent = x.optDouble("spent", 0), budget = x.optDouble("budget", 0), perDay = x.optDouble("perDay", 0);
        int w = widthDp(o, 358) - 30, h = heightDp(o, 180);
        v.setTextViewText(R.id.tk_title, head("Dépensé en " + d.optString("monthName", "ce mois")));
        if (mask) {
            v.setTextViewText(R.id.tk_big, "•••• " + sym); v.setTextColor(R.id.tk_big, SOFT);
            v.setTextViewText(R.id.tk_right, "touche pour afficher"); v.setTextViewText(R.id.tk_right2, "");
        } else {
            v.setTextViewText(R.id.tk_big, big(spent, sym)); v.setTextColor(R.id.tk_big, INK);
            v.setTextViewText(R.id.tk_right, budget > 0 ? "budget " + money(budget, sym, 0) : x.optInt("n", 0) + " ticket" + (x.optInt("n", 0) > 1 ? "s" : ""));
            v.setTextViewText(R.id.tk_right2, (budget > 0 ? Math.round(spent / budget * 100) + " % · " : "") + num(perDay, 2) + " " + sym + "/jour");
        }
        // Widget étroit (2 cases) : seulement le titre et le montant
        boolean narrow = w < 190;
        v.setViewVisibility(R.id.tk_right, narrow ? View.GONE : View.VISIBLE);
        v.setViewVisibility(R.id.tk_right2, narrow ? View.GONE : View.VISIBLE);
        if (budget > 0 && h >= 70 && !mask) {
            double r = spent / budget;
            v.setViewVisibility(R.id.tk_bar, View.VISIBLE);
            v.setImageViewBitmap(R.id.tk_bar, bar(c, w, 5, (float) Math.min(1, r), r > 1 ? CORAL : (r >= 0.8 ? AMBER : ACCENT)));
        } else v.setViewVisibility(R.id.tk_bar, View.GONE);
        // Place disponible : courbe du mois si le widget est assez haut, et 3 ou 5 catégories
        JSONArray cats = x.optJSONArray("cats");
        int nCats = cats == null ? 0 : cats.length();
        boolean chart = h >= 150 && !mask;
        int rowsMax = narrow ? 0 : (h >= 250 ? 5 : (h >= 150 ? 3 : Math.max(0, Math.min(3, (h - 24 - 18 - 38 - (budget > 0 ? 9 : 0)) / 22))));
        int fixedDp = 24 + 18 + 38 + (budget > 0 ? 9 : 0) + Math.min(nCats, rowsMax) * 22;
        if (chart) {
            int ch = Math.max(30, h - fixedDp - 20);
            v.setViewVisibility(R.id.tk_chart, View.VISIBLE);
            v.setViewVisibility(R.id.tk_legend, View.VISIBLE);
            v.setImageViewBitmap(R.id.tk_chart, cumul(c, w, ch, x.optJSONArray("cum"), x.optJSONArray("prevCum")));
            v.setTextViewText(R.id.tk_legend, legende(d));
        } else {
            v.setViewVisibility(R.id.tk_chart, View.GONE);
            v.setViewVisibility(R.id.tk_legend, View.GONE);
        }
        int[] rows = { R.id.tk_c1, R.id.tk_c2, R.id.tk_c3, R.id.tk_c4, R.id.tk_c5 }, names = { R.id.tk_c1n, R.id.tk_c2n, R.id.tk_c3n, R.id.tk_c4n, R.id.tk_c5n },
                bars = { R.id.tk_c1b, R.id.tk_c2b, R.id.tk_c3b, R.id.tk_c4b, R.id.tk_c5b }, vals = { R.id.tk_c1v, R.id.tk_c2v, R.id.tk_c3v, R.id.tk_c4v, R.id.tk_c5v };
        double max = 0;
        for (int i = 0; i < nCats; i++) max = Math.max(max, cats.getJSONObject(i).optDouble("v", 0));
        for (int i = 0; i < 5; i++) {
            if (i >= rowsMax || i >= nCats) { v.setViewVisibility(rows[i], View.GONE); continue; }
            JSONObject cx = cats.getJSONObject(i);
            v.setViewVisibility(rows[i], View.VISIBLE);
            v.setTextViewText(names[i], cx.optString("n"));
            v.setTextViewText(vals[i], mask ? "••••" : num(cx.optDouble("v", 0), 2));
            v.setImageViewBitmap(bars[i], bar(c, Math.max(40, w - 170), 4, max > 0 ? (float) (cx.optDouble("v", 0) / max) : 0, color(cx.optString("c"), BLUE)));
            v.setViewVisibility(bars[i], mask ? View.INVISIBLE : View.VISIBLE);
        }
        if (nCats == 0 && rowsMax > 0) { v.setViewVisibility(R.id.tk_c1, View.VISIBLE); v.setTextViewText(R.id.tk_c1n, "Aucun ticket ce mois-ci"); v.setTextViewText(R.id.tk_c1v, ""); }
        taps(v, c, id, mask, "Mois en cours", "mois");
        return v;
    }

    /** Légende de la courbe du mois : écart avec le mois dernier à la même date. */
    static CharSequence legende(JSONObject d) {
        JSONObject x = d.optJSONObject("mois");
        JSONArray cum = x == null ? null : x.optJSONArray("cum"), prev = x == null ? null : x.optJSONArray("prevCum");
        String pm = prevMonthShort(d);
        if (cum == null || cum.length() == 0 || prev == null || prev.length() == 0) return "Cumul du mois";
        int i = Math.min(cum.length(), prev.length()) - 1;
        double a = cum.optDouble(cum.length() - 1, 0), b = prev.optDouble(i, 0), dl = a - b;
        String t = "— ce mois   - - " + pm + "   ";
        String e = Math.abs(dl) < 0.5 ? "comme en " + pm : (dl > 0 ? "▲ " + num(dl, 0) + " de plus qu'en " + pm : "▼ " + num(-dl, 0) + " de moins qu'en " + pm) + " à cette date";
        SpannableStringBuilder s = new SpannableStringBuilder(t + e);
        s.setSpan(new ForegroundColorSpan(dl > 0.5 ? CORAL : ACCENT), t.length(), s.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        return s;
    }

    /** Foyer : ce qu'il y a en banque aujourd'hui, la répartition (comptes, épargne, provisions, bourse), puis le détail. */
    static RemoteViews foyer(Context c, int id, JSONObject d, boolean mask, String sym, Bundle o) throws Exception {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.tk_widget_foyer);
        JSONObject x = d.optJSONObject("foyer");
        if (x == null) x = new JSONObject();
        int n = x.optInt("n", 1), accts = x.optInt("accts", 1), w = widthDp(o, 358) - 30, h = heightDp(o, 180);
        double tot = x.optDouble("total", 0), ep = x.optDouble("ep", 0), prov = x.optDouble("prov", 0), bo = x.optDouble("bo", 0);
        v.setTextViewText(R.id.tk_title, head("Foyer · " + (n > 1 ? n + " personnes · " : "") + accts + " compte" + (accts > 1 ? "s" : "")));
        if (mask) { v.setTextViewText(R.id.tk_big, "•••• " + sym); v.setTextColor(R.id.tk_big, SOFT); }
        else { v.setTextViewText(R.id.tk_big, big(tot, sym)); v.setTextColor(R.id.tk_big, tot < 0 ? CORAL : INK); }
        v.setViewVisibility(R.id.tk_bar, h >= 80 && !mask ? View.VISIBLE : View.GONE);
        v.setImageViewBitmap(R.id.tk_bar, stack(c, w, 6, new double[] { Math.max(0, tot), ep, prov, bo }, new int[] { ACCENT, BLUE, PURPLE, ORANGE }));
        // Lignes : les personnes (ou les comptes s'il n'y a qu'une personne), puis épargne, provisions, bourse
        List<Object[]> items = new ArrayList<>(), fixed = new ArrayList<>();
        JSONArray src = n > 1 ? x.optJSONArray("ppl") : x.optJSONArray("list");
        if (src == null) src = x.optJSONArray("ppl");
        for (int i = 0; src != null && i < src.length(); i++) { JSONObject p = src.getJSONObject(i); items.add(new Object[] { p.optString("n"), p.optDouble("v", 0), color(p.optString("c"), ACCENT) }); }
        if (ep > 0) fixed.add(new Object[] { "Épargne", ep, BLUE });
        if (prov > 0) fixed.add(new Object[] { "Provisions", prov, PURPLE });
        if (bo > 0) fixed.add(new Object[] { "Bourse", bo, ORANGE });
        int rowsFit = Math.max(0, Math.min(4, (h - 24 - 18 - 38 - 14) / 22));
        v.setViewVisibility(R.id.tk_rows, rowsFit > 0 ? View.VISIBLE : View.GONE);
        int total = items.size() + fixed.size();
        boolean twoCols = total > rowsFit && w >= 220;
        int cells = twoCols ? rowsFit * 2 : rowsFit;
        if (total > cells) {   // trop de personnes : les dernières sont regroupées
            int keep = Math.max(0, cells - fixed.size() - 1);
            double rest = 0;
            for (int i = keep; i < items.size(); i++) rest += ((Number) items.get(i)[1]).doubleValue();
            int more = items.size() - keep;
            items = new ArrayList<>(items.subList(0, keep));
            items.add(new Object[] { "+ " + more + " autre" + (more > 1 ? "s" : ""), rest, GREY });
        }
        items.addAll(fixed);
        if (items.size() > cells) items = new ArrayList<>(items.subList(0, cells));
        int[] rows = { R.id.tk_r1, R.id.tk_r2, R.id.tk_r3, R.id.tk_r4 }, gaps = { R.id.tk_s1, R.id.tk_s2, R.id.tk_s3, R.id.tk_s4 };
        int[] cn = { R.id.tk_g1n, R.id.tk_g2n, R.id.tk_g3n, R.id.tk_g4n, R.id.tk_g5n, R.id.tk_g6n, R.id.tk_g7n, R.id.tk_g8n },
                cv = { R.id.tk_g1v, R.id.tk_g2v, R.id.tk_g3v, R.id.tk_g4v, R.id.tk_g5v, R.id.tk_g6v, R.id.tk_g7v, R.id.tk_g8v },
                cc = { R.id.tk_g1, R.id.tk_g2, R.id.tk_g3, R.id.tk_g4, R.id.tk_g5, R.id.tk_g6, R.id.tk_g7, R.id.tk_g8 };
        int nRows = twoCols ? (items.size() + 1) / 2 : items.size();
        for (int r = 0; r < 4; r++) {
            v.setViewVisibility(rows[r], r < nRows ? View.VISIBLE : View.GONE);
            v.setViewVisibility(gaps[r], twoCols ? View.VISIBLE : View.GONE);
            for (int k = 0; k < 2; k++) {
                int cell = r * 2 + k, idx = twoCols ? cell : (k == 0 ? r : -1);
                if (idx < 0) { v.setViewVisibility(cc[cell], View.GONE); continue; }
                if (idx >= items.size()) { v.setViewVisibility(cc[cell], View.INVISIBLE); continue; }
                Object[] it = items.get(idx);
                v.setViewVisibility(cc[cell], View.VISIBLE);
                v.setTextViewText(cn[cell], dot((String) it[0], ((Number) it[2]).intValue()));
                v.setTextViewText(cv[cell], mask ? "••••" : money(((Number) it[1]).doubleValue(), sym, 0));
            }
        }
        taps(v, c, id, mask, "Foyer", "foyer");
        return v;
    }

    /** Bourse : total, variation et courbe des 24 dernières heures (comme « 1J » dans l'onglet Bourse). */
    static RemoteViews bourse(Context c, int id, JSONObject d, boolean mask, String sym, Bundle o) throws Exception {
        JSONObject b = d.optJSONObject("bourse");
        if (b == null) return message(c, id, "Bourse", "Ajoute ton portefeuille dans l'onglet Bourse de Tickets.", "bourse");
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.tk_widget_bourse);
        SharedPreferences p = prefs(c);
        long now = System.currentTimeMillis(), from = now - 24 * 3600000L;
        long tApp = d.optLong("t", 0), tNat = p.getLong("bn_t", 0);
        double total = b.optDouble("total", 0);
        long tLast = tApp;
        if (tNat > tApp) { total = Double.longBitsToDouble(p.getLong("bn_total", Double.doubleToLongBits(total))); tLast = tNat; }
        // points : la courbe de l'appli, puis ceux calculés ici après elle
        List<double[]> pts = new ArrayList<>();
        double lastApp = 0;
        JSONArray h = b.optJSONArray("hist");
        for (int i = 0; h != null && i < h.length(); i++) { JSONArray q = h.optJSONArray(i); if (q != null && q.optLong(0) >= from) { pts.add(new double[] { q.optDouble(0), q.optDouble(1) }); lastApp = Math.max(lastApp, q.optDouble(0)); } }
        try {
            JSONArray nh = new JSONArray(p.getString("bn_hist", "[]"));
            for (int i = 0; i < nh.length(); i++) { JSONArray q = nh.optJSONArray(i); if (q != null && q.optLong(0) >= from && q.optDouble(0) > lastApp) pts.add(new double[] { q.optDouble(0), q.optDouble(1) }); }
        } catch (Exception ignored) { }
        if (total > 0 && tLast > lastApp) pts.add(new double[] { Math.max(tLast, lastApp + 1), total });
        Collections.sort(pts, (a, z) -> Double.compare(a[0], z[0]));
        double ref;
        if (!pts.isEmpty() && pts.get(0)[0] <= from + 3 * 3600000L) ref = pts.get(0)[1];
        else ref = b.isNull("ref") ? (pts.isEmpty() ? total : pts.get(0)[1]) : b.optDouble("ref", total);
        if (!pts.isEmpty() && pts.get(0)[0] > from) pts.add(0, new double[] { from, ref });
        double chg = total - ref, pc = ref != 0 ? chg / Math.abs(ref) * 100 : 0;
        v.setTextViewText(R.id.tk_title, head("Bourse · 24 h"));
        v.setTextViewText(R.id.tk_time, tLast > 0 ? "maj " + hhmm(tLast) : "");
        if (mask) {
            v.setTextViewText(R.id.tk_big, "•••• " + sym); v.setTextColor(R.id.tk_big, SOFT);
            v.setTextViewText(R.id.tk_chg, "");
        } else {
            v.setTextViewText(R.id.tk_big, big(total, sym)); v.setTextColor(R.id.tk_big, INK);
            v.setTextViewText(R.id.tk_chg, (chg >= 0 ? "▲ +" : "▼ −") + num(Math.abs(chg), 2) + " " + sym + " · " + (chg >= 0 ? "+" : "−") + num(Math.abs(pc), 2) + " %");
        }
        v.setTextColor(R.id.tk_chg, chg >= 0 ? ACCENT : CORAL);
        int w = widthDp(o, 358) - 30, hAll = heightDp(o, 180), hh = Math.max(36, hAll - 100);
        boolean narrow = w < 190, chart = hAll >= 110 && !mask;
        // masqué : ni montant ni courbe, une invitation à toucher
        v.setViewVisibility(R.id.tk_hint, mask && hAll >= 90 ? View.VISIBLE : View.GONE);
        v.setViewVisibility(R.id.tk_time, narrow ? View.GONE : View.VISIBLE);
        if (narrow && !mask) v.setTextViewText(R.id.tk_chg, (chg >= 0 ? "▲ +" : "▼ −") + num(Math.abs(pc), 2) + " %");
        v.setViewVisibility(R.id.tk_chart, chart ? View.VISIBLE : View.GONE);
        v.setViewVisibility(R.id.tk_xrow, chart ? View.VISIBLE : View.GONE);
        v.setImageViewBitmap(R.id.tk_chart, line(c, w, hh, pts, ref, from, now, chg >= 0 ? ACCENT : CORAL));
        int[] lab = { R.id.tk_x0, R.id.tk_x1, R.id.tk_x2, R.id.tk_x3 };
        long day0 = startOfDay(now);
        for (int i = 0; i < 4; i++) { long t = from + (now - from) * i / 3; v.setTextViewText(lab[i], (t < day0 ? "hier " : "") + hhmm(t)); }
        taps(v, c, id, mask, "Bourse · 24 h", "bourse");
        Intent r = new Intent(c, TkWidgetBourse.class);
        r.setAction(TkWidgetBourse.REFRESH);
        v.setOnClickPendingIntent(R.id.tk_refresh, PendingIntent.getBroadcast(c, 9000 + id, r, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        return v;
    }

    static void masquer(RemoteViews v, String sym) {
        v.setTextViewText(R.id.tk_big, "•••• " + sym);
        v.setTextColor(R.id.tk_big, SOFT);
        v.setTextViewText(R.id.tk_sub, "touche pour afficher");
        v.setTextColor(R.id.tk_sub, SOFT);
    }

    // ---------- Bourse : recalcul sans ouvrir l'appli ----------
    /** Total du portefeuille à partir des cours du moment (CoinGecko / relais), ou NaN si un cours manque. */
    static double fetchBourse(JSONObject b) throws Exception {
        String api = b.optString("api", "").replaceAll("/+$", ""), base = b.optString("base", "EUR");
        JSONObject fx = b.optJSONObject("fx");
        if (fx == null) fx = new JSONObject();
        JSONArray items = b.optJSONArray("items");
        double total = b.optDouble("fixed", 0);
        if (items == null || items.length() == 0) return total;
        List<String> cg = new ArrayList<>(), yf = new ArrayList<>();
        for (int i = 0; i < items.length(); i++) {
            JSONObject it = items.getJSONObject(i);
            List<String> L = "cg".equals(it.optString("s")) ? cg : yf;
            String r = it.optString("r");
            if (!L.contains(r)) L.add(r);
        }
        Map<String, double[]> px = new HashMap<>();
        Map<String, String> cur = new HashMap<>();
        if (!cg.isEmpty()) {
            String ids = URLEncoder.encode(join(cg), "UTF-8");
            JSONObject j = null;
            try { j = getJson("https://api.coingecko.com/api/v3/simple/price?ids=" + ids + "&vs_currencies=eur"); } catch (Exception ignored) { }
            if ((j == null || j.has("status") || j.has("error")) && !api.isEmpty()) j = getJson(api + "/crypto/price?ids=" + ids);
            for (String id : cg) { JSONObject x = j == null ? null : j.optJSONObject(id); if (x != null && x.has("eur") && !x.isNull("eur")) { px.put("cg:" + id, new double[] { x.getDouble("eur") }); cur.put("cg:" + id, "EUR"); } }
        }
        if (!yf.isEmpty() && !api.isEmpty()) {
            JSONObject j = getJson(api + "/quote?symbols=" + URLEncoder.encode(join(yf), "UTF-8"));
            JSONObject q = j == null ? null : j.optJSONObject("quotes");
            for (String s : yf) {
                JSONObject x = q == null ? null : q.optJSONObject(s);
                if (x != null && x.has("price") && !x.isNull("price")) { px.put("yf:" + s, new double[] { x.getDouble("price") }); cur.put("yf:" + s, x.isNull("currency") ? "USD" : x.optString("currency", "USD")); }
            }
        }
        for (int i = 0; i < items.length(); i++) {
            JSONObject it = items.getJSONObject(i);
            String key = it.optString("s") + ":" + it.optString("r");
            double[] p = px.get(key);
            if (p == null) return Double.NaN;
            Double vb = toBase(p[0], cur.get(key), base, fx);
            if (vb == null) return Double.NaN;
            total += vb * it.optDouble("q", 0);
        }
        return total;
    }

    static Double toBase(double amount, String cur, String base, JSONObject fx) {
        if ("GBp".equals(cur) || "GBX".equals(cur)) { amount = amount / 100; cur = "GBP"; }
        if (cur == null || cur.isEmpty()) cur = "EUR";
        if (cur.equals(base)) return amount;
        double rc = "EUR".equals(cur) ? 1 : fx.optDouble(cur, Double.NaN), rb = "EUR".equals(base) ? 1 : fx.optDouble(base, Double.NaN);
        if (Double.isNaN(rc) || Double.isNaN(rb) || rc == 0) return null;
        return amount / rc * rb;
    }

    static JSONObject getJson(String u) throws Exception {
        HttpURLConnection h = (HttpURLConnection) new URL(u).openConnection();
        h.setConnectTimeout(15000); h.setReadTimeout(15000);
        h.setRequestProperty("Accept", "application/json");
        h.setRequestProperty("User-Agent", "TicketsWidget/1");
        try {
            if (h.getResponseCode() >= 400) return null;
            StringBuilder sb = new StringBuilder();
            try (BufferedReader r = new BufferedReader(new InputStreamReader(h.getInputStream(), "UTF-8"))) { String l; while ((l = r.readLine()) != null) sb.append(l); }
            return new JSONObject(sb.toString());
        } finally { h.disconnect(); }
    }

    static String join(List<String> l) { StringBuilder s = new StringBuilder(); for (String x : l) { if (s.length() > 0) s.append(','); s.append(x); } return s.toString(); }

    /** Garde le total calculé ici et ajoute un point à la courbe (24 dernières heures). */
    static void recordNative(Context c, double total) {
        SharedPreferences p = prefs(c);
        long now = System.currentTimeMillis(), day0 = now - 24 * 3600000L;
        JSONArray out = new JSONArray();
        try {
            JSONArray h = new JSONArray(p.getString("bn_hist", "[]"));
            for (int i = 0; i < h.length(); i++) { JSONArray q = h.optJSONArray(i); if (q != null && q.optLong(0) >= day0) out.put(q); }
        } catch (Exception ignored) { }
        try { JSONArray q = new JSONArray(); q.put(now); q.put(Math.round(total * 100) / 100.0); out.put(q); } catch (Exception ignored) { }
        p.edit().putLong("bn_t", now).putLong("bn_total", Double.doubleToLongBits(total)).putString("bn_hist", out.toString()).apply();
    }

    // ---------- Mise en forme ----------
    static String num(double v, int dec) {
        DecimalFormatSymbols s = new DecimalFormatSymbols(Locale.FRANCE);
        s.setGroupingSeparator(' '); s.setDecimalSeparator(',');
        DecimalFormat f = new DecimalFormat(dec == 0 ? "#,##0" : "#,##0.00", s);
        return f.format(v);
    }

    static String money(double v, String sym, int dec) { return (v < 0 ? "−" : "") + num(Math.abs(v), dec) + " " + sym; }

    static String pctTxt(double v) { double r = Math.round(v * 10) / 10.0; return (r == Math.floor(r) ? String.valueOf((long) r) : String.valueOf(r).replace('.', ',')) + " %"; }

    /** « 1 236 » en grand, « ,40 € » plus petit et plus clair, comme dans l'appli. */
    static CharSequence big(double v, String sym) {
        String all = money(v, sym, 2);
        int i = all.lastIndexOf(',');
        SpannableStringBuilder b = new SpannableStringBuilder(all);
        if (i > 0) {
            b.setSpan(new RelativeSizeSpan(0.62f), i, all.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            b.setSpan(new ForegroundColorSpan(SOFT), i, all.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        }
        return b;
    }

    static CharSequence dot(String name, int color) {
        SpannableStringBuilder b = new SpannableStringBuilder("● " + name);
        b.setSpan(new ForegroundColorSpan(color), 0, 1, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        return b;
    }

    static CharSequence trend(double dl, String sym, String prev) {
        String t = (dl >= 0 ? "▲ +" : "▼ −") + num(Math.abs(dl), 0) + " " + sym;
        SpannableStringBuilder b = new SpannableStringBuilder(t + " vs " + prev);
        b.setSpan(new ForegroundColorSpan(SOFT), t.length(), b.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        return b;
    }

    static String prevMonthShort(JSONObject d) {
        String m = d.optString("month", "");
        try { int mo = Integer.parseInt(m.substring(5, 7)); return MOIS_COURTS[(mo + 10) % 12]; } catch (Exception e) { return "le mois dernier"; }
    }

    static float monthFraction(JSONObject d) {
        Calendar cal = Calendar.getInstance();
        String cur = String.format(Locale.ROOT, "%04d-%02d", cal.get(Calendar.YEAR), cal.get(Calendar.MONTH) + 1);
        if (!cur.equals(d.optString("month"))) return 1f;
        return cal.get(Calendar.DAY_OF_MONTH) / (float) cal.getActualMaximum(Calendar.DAY_OF_MONTH);
    }

    static long startOfDay(long t) {
        Calendar cal = Calendar.getInstance(); cal.setTimeInMillis(t);
        cal.set(Calendar.HOUR_OF_DAY, 0); cal.set(Calendar.MINUTE, 0); cal.set(Calendar.SECOND, 0); cal.set(Calendar.MILLISECOND, 0);
        return cal.getTimeInMillis();
    }

    static String hhmm(long t) {
        Calendar cal = Calendar.getInstance(); cal.setTimeInMillis(t);
        return String.format(Locale.FRANCE, "%d:%02d", cal.get(Calendar.HOUR_OF_DAY), cal.get(Calendar.MINUTE));
    }

    static int color(String hex, int def) {
        try { return android.graphics.Color.parseColor(hex); } catch (Exception e) { return def; }
    }

    // ---------- Tailles et dessins ----------
    static int widthDp(Bundle o, int def) { int w = o == null ? 0 : o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0); return w > 0 ? w : def; }
    static int heightDp(Bundle o, int def) { int h = o == null ? 0 : o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0); return h > 0 ? h : def; }

    static float density() { return android.content.res.Resources.getSystem().getDisplayMetrics().density; }

    static Bitmap bar(Context c, int wDp, int hDp, float frac, int color) {
        float k = density();
        int w = Math.max(8, Math.round(wDp * k)), h = Math.max(2, Math.round(hDp * k));
        Bitmap bm = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(bm);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        float r = h / 2f;
        p.setColor(TRACK); cv.drawRoundRect(new RectF(0, 0, w, h), r, r, p);
        float fw = Math.max(0, Math.min(1, frac)) * w;
        if (fw > 0) { p.setColor(color); cv.drawRoundRect(new RectF(0, 0, Math.max(fw, h), h), r, r, p); }
        return bm;
    }

    static Bitmap stack(Context c, int wDp, int hDp, double[] parts, int[] colors) {
        float k = density();
        int w = Math.max(8, Math.round(wDp * k)), h = Math.max(2, Math.round(hDp * k));
        Bitmap bm = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(bm);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        double tot = 0; for (double x : parts) tot += Math.max(0, x);
        float r = h / 2f, gap = 2 * k, x = 0;
        if (tot <= 0) { p.setColor(TRACK); cv.drawRoundRect(new RectF(0, 0, w, h), r, r, p); return bm; }
        for (int i = 0; i < parts.length; i++) {
            if (parts[i] <= 0) continue;
            float pw = (float) (parts[i] / tot * w);
            p.setColor(colors[i]);
            cv.drawRoundRect(new RectF(x, 0, Math.max(x + h, x + pw - gap), h), r, r, p);
            x += pw;
        }
        return bm;
    }

    /** Cumul des dépenses jour par jour : ce mois-ci (ligne pleine) et le mois dernier (pointillés). */
    static Bitmap cumul(Context c, int wDp, int hDp, JSONArray cur, JSONArray prev) {
        float k = density();
        int w = Math.max(40, Math.round(wDp * k)), h = Math.max(20, Math.round(hDp * k));
        Bitmap bm = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(bm);
        int days = 31;
        double hi = 1;
        for (int i = 0; cur != null && i < cur.length(); i++) hi = Math.max(hi, cur.optDouble(i, 0));
        for (int i = 0; prev != null && i < prev.length(); i++) hi = Math.max(hi, prev.optDouble(i, 0));
        hi *= 1.08;
        float top = 3 * k, bot = h - 2 * k;
        Paint grid = new Paint(Paint.ANTI_ALIAS_FLAG); grid.setColor(0x14FFFFFF); grid.setStrokeWidth(1 * k);
        cv.drawLine(0, bot, w, bot, grid);
        if (prev != null && prev.length() > 1) {
            Path pp = new Path();
            for (int i = 0; i < prev.length(); i++) { float x = (float) i / (days - 1) * w, y = (float) (bot - prev.optDouble(i, 0) / hi * (bot - top)); if (i == 0) pp.moveTo(x, y); else pp.lineTo(x, y); }
            Paint dp = new Paint(Paint.ANTI_ALIAS_FLAG); dp.setColor(0x73FFFFFF); dp.setStyle(Paint.Style.STROKE); dp.setStrokeWidth(1.5f * k);
            dp.setPathEffect(new DashPathEffect(new float[] { 4 * k, 4 * k }, 0));
            cv.drawPath(pp, dp);
        }
        if (cur != null && cur.length() > 0) {
            Path ln = new Path(), area = new Path();
            float lx = 0, ly = bot;
            for (int i = 0; i < cur.length(); i++) {
                float x = (float) i / (days - 1) * w, y = (float) (bot - cur.optDouble(i, 0) / hi * (bot - top));
                if (i == 0) { ln.moveTo(x, y); area.moveTo(x, bot); area.lineTo(x, y); } else { ln.lineTo(x, y); area.lineTo(x, y); }
                lx = x; ly = y;
            }
            area.lineTo(lx, bot); area.close();
            Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
            fill.setShader(new LinearGradient(0, top, 0, bot, 0x404FD6A0, 0x004FD6A0, Shader.TileMode.CLAMP));
            cv.drawPath(area, fill);
            Paint st = new Paint(Paint.ANTI_ALIAS_FLAG); st.setColor(ACCENT); st.setStyle(Paint.Style.STROKE); st.setStrokeWidth(2 * k);
            st.setStrokeJoin(Paint.Join.ROUND); st.setStrokeCap(Paint.Cap.ROUND);
            cv.drawPath(ln, st);
            Paint dt = new Paint(Paint.ANTI_ALIAS_FLAG); dt.setColor(ACCENT);
            cv.drawCircle(lx, ly, 3.5f * k, dt);
        }
        return bm;
    }

    /** Courbe : ligne de référence (début de période) en pointillés, courbe et dégradé dessous. */
    static Bitmap line(Context c, int wDp, int hDp, List<double[]> pts, double ref, long x0, long x1, int color) {
        float k = density();
        int w = Math.max(40, Math.round(wDp * k)), h = Math.max(20, Math.round(hDp * k));
        Bitmap bm = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(bm);
        double lo = ref, hi = ref;
        for (double[] q : pts) { lo = Math.min(lo, q[1]); hi = Math.max(hi, q[1]); }
        if (hi - lo < 1e-6) { hi += 1; lo -= 1; }
        double pad = (hi - lo) * 0.12; hi += pad; lo -= pad;
        float top = 4 * k, bot = h - 4 * k;
        Paint base = new Paint(Paint.ANTI_ALIAS_FLAG);
        base.setColor(0x38FFFFFF); base.setStrokeWidth(1 * k); base.setStyle(Paint.Style.STROKE);
        base.setPathEffect(new DashPathEffect(new float[] { 3 * k, 4 * k }, 0));
        float yRef = (float) (top + (hi - ref) / (hi - lo) * (bot - top));
        cv.drawLine(0, yRef, w, yRef, base);
        if (pts.size() < 2) return bm;
        Path ln = new Path(), area = new Path();
        float lastX = 0, lastY = 0, firstX = 0;
        for (int i = 0; i < pts.size(); i++) {
            double[] q = pts.get(i);
            float x = (float) ((q[0] - x0) / (double) Math.max(1, x1 - x0) * w);
            float y = (float) (top + (hi - q[1]) / (hi - lo) * (bot - top));
            if (i == 0) { ln.moveTo(x, y); area.moveTo(x, h); area.lineTo(x, y); firstX = x; } else { ln.lineTo(x, y); area.lineTo(x, y); }
            lastX = x; lastY = y;
        }
        area.lineTo(lastX, h); area.lineTo(firstX, h); area.close();
        Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
        fill.setShader(new LinearGradient(0, top, 0, h, (color & 0x00FFFFFF) | 0x55000000, color & 0x00FFFFFF, Shader.TileMode.CLAMP));
        cv.drawPath(area, fill);
        Paint stroke = new Paint(Paint.ANTI_ALIAS_FLAG);
        stroke.setColor(color); stroke.setStyle(Paint.Style.STROKE); stroke.setStrokeWidth(2 * k);
        stroke.setStrokeJoin(Paint.Join.ROUND); stroke.setStrokeCap(Paint.Cap.ROUND);
        cv.drawPath(ln, stroke);
        Paint dotP = new Paint(Paint.ANTI_ALIAS_FLAG); dotP.setColor(color);
        cv.drawCircle(lastX, lastY, 3.5f * k, dotP);
        return bm;
    }
}
