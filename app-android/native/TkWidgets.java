package fr.bpierrard.tickets.beta;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.DashPathEffect;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Shader;
import android.os.Bundle;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.text.style.RelativeSizeSpan;
import android.view.View;
import android.widget.RemoteViews;

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
            TRACK = 0x1FFFFFFF, GREY = 0xFF8A909C, BLUE = 0xFF7C9CF4, ORANGE = 0xFFE0A458;
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

    /** Montants masqués : réglé sur le widget, sinon oui si le verrouillage par code est activé dans l'appli. */
    static boolean masked(Context c, int id, JSONObject d) {
        SharedPreferences p = prefs(c);
        if (p.contains("mask_" + id)) return p.getBoolean("mask_" + id, false);
        return d != null && d.optBoolean("lock", false);
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
    static PendingIntent open(Context c, String target, int req) {
        Intent i = new Intent(c, MainActivity.class);
        i.setAction("tickets.widget." + target);
        i.putExtra("tk_target", target);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(c, req, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
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
        boolean mask = masked(c, id, d);
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
        v.setTextViewText(R.id.tk_title, "Fin de mois");
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
        v.setOnClickPendingIntent(R.id.tk_root, open(c, foyer ? "compte_foyer" : "compte", id));
        return v;
    }

    /** Ta part du Commun ce mois-ci et les frais communs pas encore payés. */
    static RemoteViews commun(Context c, int id, JSONObject d, boolean mask, String sym, Bundle o) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.tk_widget_commun);
        JSONObject x = d.optJSONObject("commun");
        v.setViewVisibility(R.id.tk_chip, View.GONE);
        if (x == null) {
            v.setTextViewText(R.id.tk_title, "Commun");
            v.setTextViewText(R.id.tk_big, "—");
            v.setTextViewText(R.id.tk_sub, "");
        } else {
            double pct = x.optDouble("pct", 0);
            v.setTextViewText(R.id.tk_title, "Commun · ta part (" + pctTxt(pct) + ")");
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
        v.setOnClickPendingIntent(R.id.tk_root, open(c, "communes", id));
        return v;
    }

    /** Dépenses du mois (tickets), budget et 3 plus grosses catégories. */
    static RemoteViews mois(Context c, int id, JSONObject d, boolean mask, String sym, Bundle o) throws Exception {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.tk_widget_mois);
        JSONObject x = d.optJSONObject("mois");
        if (x == null) x = new JSONObject();
        double spent = x.optDouble("spent", 0), budget = x.optDouble("budget", 0), perDay = x.optDouble("perDay", 0);
        int w = widthDp(o, 358) - 30;
        v.setTextViewText(R.id.tk_title, "Dépensé en " + d.optString("monthName", "ce mois"));
        if (mask) {
            v.setTextViewText(R.id.tk_big, "•••• " + sym); v.setTextColor(R.id.tk_big, SOFT);
            v.setTextViewText(R.id.tk_right, "touche pour voir"); v.setTextViewText(R.id.tk_right2, "");
        } else {
            v.setTextViewText(R.id.tk_big, big(spent, sym)); v.setTextColor(R.id.tk_big, INK);
            v.setTextViewText(R.id.tk_right, budget > 0 ? "budget " + money(budget, sym, 0) : x.optInt("n", 0) + " tickets");
            v.setTextViewText(R.id.tk_right2, (budget > 0 ? Math.round(spent / budget * 100) + " % · " : "") + num(perDay, 2) + " " + sym + "/jour");
        }
        if (budget > 0) {
            double r = spent / budget;
            v.setViewVisibility(R.id.tk_bar, View.VISIBLE);
            v.setImageViewBitmap(R.id.tk_bar, bar(c, w, 5, (float) Math.min(1, r), r > 1 ? CORAL : (r >= 0.8 ? AMBER : ACCENT)));
        } else v.setViewVisibility(R.id.tk_bar, View.GONE);
        JSONArray cats = x.optJSONArray("cats");
        int[] rows = { R.id.tk_c1, R.id.tk_c2, R.id.tk_c3 }, names = { R.id.tk_c1n, R.id.tk_c2n, R.id.tk_c3n },
                bars = { R.id.tk_c1b, R.id.tk_c2b, R.id.tk_c3b }, vals = { R.id.tk_c1v, R.id.tk_c2v, R.id.tk_c3v };
        double max = 0;
        for (int i = 0; cats != null && i < cats.length(); i++) max = Math.max(max, cats.getJSONObject(i).optDouble("v", 0));
        for (int i = 0; i < 3; i++) {
            if (cats == null || i >= cats.length()) { v.setViewVisibility(rows[i], View.INVISIBLE); continue; }
            JSONObject cx = cats.getJSONObject(i);
            v.setViewVisibility(rows[i], View.VISIBLE);
            v.setTextViewText(names[i], cx.optString("n"));
            v.setTextViewText(vals[i], mask ? "••••" : num(cx.optDouble("v", 0), 2));
            v.setImageViewBitmap(bars[i], bar(c, Math.max(40, w - 160), 4, max > 0 ? (float) (cx.optDouble("v", 0) / max) : 0, color(cx.optString("c"), BLUE)));
        }
        if (cats == null || cats.length() == 0) { v.setViewVisibility(R.id.tk_c1, View.VISIBLE); v.setTextViewText(R.id.tk_c1n, "Aucun ticket ce mois-ci"); v.setTextViewText(R.id.tk_c1v, ""); }
        v.setOnClickPendingIntent(R.id.tk_root, open(c, "mois", id));
        return v;
    }

    /** Comptes du foyer : ce qu'il y a sur les comptes de chacun aujourd'hui (estimé). */
    static RemoteViews foyer(Context c, int id, JSONObject d, boolean mask, String sym, Bundle o) throws Exception {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.tk_widget_foyer);
        JSONObject x = d.optJSONObject("foyer");
        if (x == null) x = new JSONObject();
        int n = x.optInt("n", 1), accts = x.optInt("accts", 1);
        v.setTextViewText(R.id.tk_title, "Foyer · " + (n > 1 ? n + " personnes · " : "") + accts + " compte" + (accts > 1 ? "s" : ""));
        if (mask) { v.setTextViewText(R.id.tk_big, "•••• " + sym); v.setTextColor(R.id.tk_big, SOFT); }
        else { double t = x.optDouble("total", 0); v.setTextViewText(R.id.tk_big, big(t, sym)); v.setTextColor(R.id.tk_big, t < 0 ? CORAL : INK); }
        JSONArray ppl = x.optJSONArray("ppl");
        int cnt = ppl == null ? 0 : ppl.length();
        int[] cn = { R.id.tk_p1n, R.id.tk_p2n, R.id.tk_p3n, R.id.tk_p4n, R.id.tk_p5n }, cv = { R.id.tk_p1v, R.id.tk_p2v, R.id.tk_p3v, R.id.tk_p4v, R.id.tk_p5v },
                cr = { R.id.tk_p1, R.id.tk_p2, R.id.tk_p3, R.id.tk_p4, R.id.tk_p5 };
        int shown = cnt > 5 ? 4 : cnt;
        for (int i = 0; i < 5; i++) {
            if (i < shown) {
                JSONObject p = ppl.getJSONObject(i);
                v.setViewVisibility(cr[i], View.VISIBLE);
                v.setTextViewText(cn[i], dot(p.optString("n"), color(p.optString("c"), BLUE)));
                v.setTextViewText(cv[i], mask ? "••••" : money(p.optDouble("v", 0), sym, 0));
            } else if (i == 4 && cnt > 5) {
                double rest = 0;
                for (int j = 4; j < cnt; j++) rest += ppl.getJSONObject(j).optDouble("v", 0);
                v.setViewVisibility(cr[i], View.VISIBLE);
                v.setTextViewText(cn[i], dot("+ " + (cnt - 4) + " autres", GREY));
                v.setTextViewText(cv[i], mask ? "••••" : money(rest, sym, 0));
            } else v.setViewVisibility(cr[i], View.INVISIBLE);
        }
        double ep = x.optDouble("ep", 0);
        v.setTextViewText(R.id.tk_p6n, "Épargne");
        v.setTextViewText(R.id.tk_p6v, mask ? "••••" : money(ep, sym, 0));
        v.setOnClickPendingIntent(R.id.tk_root, open(c, "foyer", id));
        return v;
    }

    /** Bourse du jour : total, variation depuis hier soir, courbe de la journée. */
    static RemoteViews bourse(Context c, int id, JSONObject d, boolean mask, String sym, Bundle o) throws Exception {
        JSONObject b = d.optJSONObject("bourse");
        if (b == null) return message(c, id, "Bourse", "Ajoute ton portefeuille dans l'onglet Bourse de Tickets.", "bourse");
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.tk_widget_bourse);
        SharedPreferences p = prefs(c);
        long tApp = d.optLong("t", 0), tNat = p.getLong("bn_t", 0);
        double total = b.optDouble("total", 0);
        long tLast = tApp;
        if (tNat > tApp) { total = Double.longBitsToDouble(p.getLong("bn_total", Double.doubleToLongBits(total))); tLast = tNat; }
        // points du jour : ceux de l'appli + ceux calculés ici
        long day0 = startOfDay(System.currentTimeMillis());
        List<double[]> pts = new ArrayList<>();
        JSONArray h = b.optJSONArray("hist");
        for (int i = 0; h != null && i < h.length(); i++) { JSONArray q = h.optJSONArray(i); if (q != null && q.optLong(0) >= day0) pts.add(new double[] { q.optDouble(0), q.optDouble(1) }); }
        try { JSONArray nh = new JSONArray(p.getString("bn_hist", "[]")); for (int i = 0; i < nh.length(); i++) { JSONArray q = nh.optJSONArray(i); if (q != null && q.optLong(0) >= day0) pts.add(new double[] { q.optDouble(0), q.optDouble(1) }); } }
        catch (Exception ignored) { }
        if (tLast >= day0 && total > 0) pts.add(new double[] { tLast, total });
        Collections.sort(pts, (a, z) -> Double.compare(a[0], z[0]));
        double ref = b.isNull("ref") ? (pts.isEmpty() ? total : pts.get(0)[1]) : b.optDouble("ref", total);
        double chg = total - ref, pc = ref != 0 ? chg / Math.abs(ref) * 100 : 0;
        v.setTextViewText(R.id.tk_title, "Bourse · aujourd'hui");
        v.setTextViewText(R.id.tk_time, tLast > 0 ? "maj " + hhmm(tLast) : "");
        if (mask) {
            v.setTextViewText(R.id.tk_big, "•••• " + sym); v.setTextColor(R.id.tk_big, SOFT);
            v.setTextViewText(R.id.tk_chg, (chg >= 0 ? "▲ +" : "▼ −") + num(Math.abs(pc), 2) + " %");
        } else {
            v.setTextViewText(R.id.tk_big, big(total, sym)); v.setTextColor(R.id.tk_big, INK);
            v.setTextViewText(R.id.tk_chg, (chg >= 0 ? "▲ +" : "▼ −") + num(Math.abs(chg), 2) + " " + sym + " · " + (chg >= 0 ? "+" : "−") + num(Math.abs(pc), 2) + " %");
        }
        v.setTextColor(R.id.tk_chg, chg >= 0 ? ACCENT : CORAL);
        long x0 = day0 + 8 * 3600000L, x1 = day0 + 22 * 3600000L;
        if (!pts.isEmpty()) { x0 = Math.min(x0, (long) pts.get(0)[0]); x1 = Math.max(x1, (long) pts.get(pts.size() - 1)[0]); }
        int w = widthDp(o, 358) - 30, hh = Math.max(36, heightDp(o, 178) - 100);
        v.setImageViewBitmap(R.id.tk_chart, line(c, w, hh, pts, ref, x0, x1, chg >= 0 ? ACCENT : CORAL));
        int[] lab = { R.id.tk_x0, R.id.tk_x1, R.id.tk_x2, R.id.tk_x3 };
        for (int i = 0; i < 4; i++) v.setTextViewText(lab[i], hhmm(x0 + (x1 - x0) * i / 3));
        v.setOnClickPendingIntent(R.id.tk_root, open(c, "bourse", id));
        Intent r = new Intent(c, TkWidgetBourse.class);
        r.setAction(TkWidgetBourse.REFRESH);
        v.setOnClickPendingIntent(R.id.tk_refresh, PendingIntent.getBroadcast(c, 9000 + id, r, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        return v;
    }

    static void masquer(RemoteViews v, String sym) {
        v.setTextViewText(R.id.tk_big, "•••• " + sym);
        v.setTextColor(R.id.tk_big, SOFT);
        v.setTextViewText(R.id.tk_sub, "touche pour voir");
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

    /** Garde le total calculé ici et ajoute un point à la courbe du jour. */
    static void recordNative(Context c, double total) {
        SharedPreferences p = prefs(c);
        long now = System.currentTimeMillis(), day0 = startOfDay(now);
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

    /** Courbe du jour : ligne de référence (hier soir) en pointillés, courbe et dégradé dessous. */
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
