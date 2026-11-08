package fr.bpierrard.tickets.beta;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.work.Constraints;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;

import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.common.api.Scope;
import com.google.android.gms.tasks.Tasks;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.TimeZone;
import java.util.concurrent.TimeUnit;

/**
 * Sauvegarde sur Google Drive (accès « drive.file » : l'appli ne voit que les fichiers qu'elle a créés).
 * L'appli prépare le fichier, déjà chiffré, sur le téléphone (stage) ; Android l'envoie avec WorkManager,
 * même appli fermée, dès que le réseau est là. Conservation : la dernière de chaque jour / mois / année.
 */
public class TkDrive {
    static final String SCOPE = "https://www.googleapis.com/auth/drive.file";
    static final String FOLDER = "Tickets – sauvegardes";
    static final String API = "https://www.googleapis.com/drive/v3/";
    static final String UP = "https://www.googleapis.com/upload/drive/v3/files";
    static final String WORK = "tk_drive";
    static final String CHECK = "tk_drive_check";

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences("tk_drive", Context.MODE_PRIVATE); }
    static File pendingFile(Context c) { return new File(c.getFilesDir(), "tk_drive_pending.txt"); }

    /** Identifiant de ce téléphone (tiré au hasard, rien de personnel) : repère les sauvegardes d'un autre téléphone. */
    static String dev(Context c) {
        SharedPreferences p = prefs(c);
        String d = p.getString("dev", null);
        if (d == null) { d = java.util.UUID.randomUUID().toString().substring(0, 12); p.edit().putString("dev", d).apply(); }
        return d;
    }

    static AuthorizationRequest request() {
        List<Scope> s = Collections.singletonList(new Scope(SCOPE));
        return AuthorizationRequest.builder().setRequestedScopes(s).build();
    }

    /** Jeton d'accès sans rien afficher ; null si l'utilisateur doit redonner son accord. */
    static String silentToken(Context c) throws Exception {
        AuthorizationResult r = Tasks.await(Identity.getAuthorizationClient(c).authorize(request()), 60, TimeUnit.SECONDS);
        if (r.hasResolution()) return null;
        return r.getAccessToken();
    }

    // ---------- erreurs ----------
    static class DriveErr extends Exception {
        final boolean auth, retry;
        DriveErr(String m, boolean auth, boolean retry) { super(m); this.auth = auth; this.retry = retry; }
    }

    static class Http { int code; String body; byte[] raw; }

    static Http http(String method, String url, String token, String ctype, byte[] body) throws IOException {
        HttpURLConnection k = (HttpURLConnection) new URL(url).openConnection();
        k.setConnectTimeout(20000);
        k.setReadTimeout(60000);
        k.setRequestMethod(method);
        if (token != null) k.setRequestProperty("Authorization", "Bearer " + token);
        if (body != null) {
            k.setDoOutput(true);
            if (ctype != null) k.setRequestProperty("Content-Type", ctype);
            k.setFixedLengthStreamingMode(body.length);
            try (OutputStream o = k.getOutputStream()) { o.write(body); }
        }
        Http h = new Http();
        h.code = k.getResponseCode();
        InputStream in = h.code >= 400 ? k.getErrorStream() : k.getInputStream();
        h.raw = in == null ? new byte[0] : readAll(in);
        h.body = new String(h.raw, StandardCharsets.UTF_8);
        k.disconnect();
        return h;
    }

    static void check(Http h) throws DriveErr {
        if (h.code >= 200 && h.code < 300) return;
        String m = "Drive " + h.code;
        try { m += " : " + new JSONObject(h.body).getJSONObject("error").optString("message"); } catch (Exception ignored) {}
        if (h.code == 401) throw new DriveErr(m, true, false);
        if (h.code == 429 || h.code >= 500) throw new DriveErr(m, false, true);
        if (h.code == 403 && h.body.contains("ateLimit")) throw new DriveErr(m, false, true);
        throw new DriveErr(m, false, false);
    }

    static byte[] readAll(InputStream in) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[16384];
        int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        in.close();
        return out.toByteArray();
    }

    static String enc(String s) {
        try { return URLEncoder.encode(s, "UTF-8"); } catch (Exception e) { return s; }
    }

    // ---------- dossier, liste, envoi, téléchargement ----------
    static String ensureFolder(Context c, String token) throws Exception {
        SharedPreferences p = prefs(c);
        String id = p.getString("folder", null);
        if (id != null) {
            Http h = http("GET", API + "files/" + id + "?fields=id,trashed", token, null, null);
            if (h.code == 200 && !new JSONObject(h.body).optBoolean("trashed", false)) return id;
            if (h.code == 401) check(h);
        }
        String q = "mimeType='application/vnd.google-apps.folder' and name='" + FOLDER + "' and trashed=false";
        Http h = http("GET", API + "files?spaces=drive&fields=files(id)&q=" + enc(q), token, null, null);
        check(h);
        JSONArray f = new JSONObject(h.body).optJSONArray("files");
        if (f != null && f.length() > 0) id = f.getJSONObject(0).getString("id");
        else {
            JSONObject m = new JSONObject();
            m.put("name", FOLDER);
            m.put("mimeType", "application/vnd.google-apps.folder");
            Http cr = http("POST", API + "files?fields=id", token, "application/json; charset=UTF-8", m.toString().getBytes(StandardCharsets.UTF_8));
            check(cr);
            id = new JSONObject(cr.body).getString("id");
        }
        p.edit().putString("folder", id).apply();
        return id;
    }

    /** Sauvegardes de l'appli dans le dossier, la plus récente d'abord. */
    static List<JSONObject> list(String token, String folder) throws Exception {
        List<JSONObject> out = new ArrayList<>();
        String q = "'" + folder + "' in parents and trashed=false";
        String page = null;
        do {
            String u = API + "files?spaces=drive&pageSize=1000&orderBy=createdTime%20desc&fields=nextPageToken,files(id,name,createdTime,size,appProperties)&q=" + enc(q)
                    + (page != null ? "&pageToken=" + enc(page) : "");
            Http h = http("GET", u, token, null, null);
            check(h);
            JSONObject j = new JSONObject(h.body);
            JSONArray f = j.optJSONArray("files");
            for (int i = 0; f != null && i < f.length(); i++) {
                JSONObject o = f.getJSONObject(i);
                JSONObject ap = o.optJSONObject("appProperties");
                if (ap != null && "1".equals(ap.optString("tk"))) out.add(o);
            }
            page = j.optString("nextPageToken", null);
            if (page != null && page.isEmpty()) page = null;
        } while (page != null);
        return out;
    }

    static JSONObject upload(String token, String folder, String name, byte[] data, String kf, int n, int nc, String dev) throws Exception {
        JSONObject meta = new JSONObject();
        meta.put("name", name);
        meta.put("mimeType", "text/plain");
        meta.put("parents", new JSONArray().put(folder));
        JSONObject ap = new JSONObject();
        ap.put("tk", "1");
        ap.put("kf", kf == null ? "" : kf);
        ap.put("n", String.valueOf(n));
        ap.put("c", String.valueOf(nc));
        ap.put("d", dev == null ? "" : dev);
        meta.put("appProperties", ap);
        String b = "tkdrive" + System.currentTimeMillis();
        ByteArrayOutputStream body = new ByteArrayOutputStream();
        body.write(("--" + b + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n").getBytes(StandardCharsets.UTF_8));
        body.write(meta.toString().getBytes(StandardCharsets.UTF_8));
        body.write(("\r\n--" + b + "\r\nContent-Type: text/plain\r\n\r\n").getBytes(StandardCharsets.UTF_8));
        body.write(data);
        body.write(("\r\n--" + b + "--\r\n").getBytes(StandardCharsets.UTF_8));
        Http h = http("POST", UP + "?uploadType=multipart&fields=id,name,createdTime,size", token, "multipart/related; boundary=" + b, body.toByteArray());
        check(h);
        return new JSONObject(h.body);
    }

    static String download(String token, String id) throws Exception {
        Http h = http("GET", API + "files/" + id + "?alt=media", token, null, null);
        check(h);
        return h.body;
    }

    static String email(String token) {
        try {
            Http h = http("GET", API + "about?fields=user(emailAddress)", token, null, null);
            if (h.code != 200) return "";
            return new JSONObject(h.body).getJSONObject("user").optString("emailAddress", "");
        } catch (Exception e) { return ""; }
    }

    static long created(JSONObject f) {
        String s = f.optString("createdTime", "");
        try {
            SimpleDateFormat d = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US);
            d.setTimeZone(TimeZone.getTimeZone("UTC"));
            return d.parse(s.length() >= 19 ? s.substring(0, 19) : s).getTime();
        } catch (Exception e) { return 0; }
    }

    /**
     * Conservation : la plus récente de chaque jour pendant keepD jours, de chaque mois pendant keepM mois,
     * de chaque année pendant keepY ans. Jamais la plus récente de toutes. Rend le nombre de sauvegardes gardées.
     */
    static int prune(Context c, String token, List<JSONObject> files) {
        SharedPreferences p = prefs(c);
        // minimums imposés ici (08/11, revue E2) : même une page piratée ne peut pas faire effacer l'historique
        int kd = Math.max(7, p.getInt("keepD", 30)), km = Math.max(3, p.getInt("keepM", 12)), ky = Math.max(1, p.getInt("keepY", 5));
        long now = System.currentTimeMillis();
        Set<String> days = new HashSet<>(), months = new HashSet<>(), years = new HashSet<>();
        Calendar cal = Calendar.getInstance();
        int kept = 0;
        for (int i = 0; i < files.size(); i++) {
            JSONObject f = files.get(i);
            long t = created(f);
            cal.setTimeInMillis(t);
            String y = String.valueOf(cal.get(Calendar.YEAR)), m = y + "-" + cal.get(Calendar.MONTH), d = m + "-" + cal.get(Calendar.DAY_OF_MONTH);
            long ageD = (now - t) / 86400000L;
            boolean keep;
            if (i < 3 || t == 0) keep = true;   // les 3 plus récentes sont toujours gardées
            else if (ageD < kd) keep = !days.contains(d);
            else if (ageD < km * 31L) keep = !months.contains(m);
            else if (ageD < ky * 366L) keep = !years.contains(y);
            else keep = false;
            if (keep) {
                days.add(d); months.add(m); years.add(y); kept++;
            } else {
                try { http("DELETE", API + "files/" + f.getString("id"), token, null, null); }
                catch (Exception e) { kept++; }
            }
        }
        return kept;
    }

    // ---------- préparer, envoyer, rappeler ----------
    /** Le fichier chiffré est écrit sur le téléphone ; l'envoi part dès que le réseau est là. */
    static void stage(Context c, String data, String name, int n, int nc, String kf, boolean remind) throws IOException {
        File f = pendingFile(c), tmp = new File(c.getFilesDir(), "tk_drive_pending.tmp");
        try (FileOutputStream o = new FileOutputStream(tmp)) { o.write(data.getBytes(StandardCharsets.UTF_8)); }
        if (!tmp.renameTo(f)) throw new IOException("écriture impossible");
        SharedPreferences p = prefs(c);
        SharedPreferences.Editor e = p.edit()
                .putLong("seq", p.getLong("seq", 0) + 1)
                .putString("pname", name)
                .putInt("pn", n)
                .putInt("pc", nc)
                .putString("kf", kf)
                .putBoolean("remind", remind);
        if (p.getLong("pendingSince", 0) == 0) e.putLong("pendingSince", System.currentTimeMillis());
        e.apply();
        enqueue(c);
        if (remind) scheduleCheck(c);
    }

    static void enqueue(Context c) { enqueue(c, false); }

    /** now : relancer tout de suite (remplace un essai qui attend après un échec). */
    static void enqueue(Context c, boolean now) {
        boolean wifi = prefs(c).getBoolean("wifi", false);
        Constraints k = new Constraints.Builder().setRequiredNetworkType(wifi ? NetworkType.UNMETERED : NetworkType.CONNECTED).build();
        OneTimeWorkRequest r = new OneTimeWorkRequest.Builder(TkDriveWorker.class)
                .setConstraints(k)
                .setBackoffCriteria(androidx.work.BackoffPolicy.EXPONENTIAL, 60, TimeUnit.SECONDS)
                .build();
        WorkManager.getInstance(c).enqueueUniqueWork(WORK, now ? ExistingWorkPolicy.REPLACE : ExistingWorkPolicy.APPEND_OR_REPLACE, r);
    }

    static void scheduleCheck(Context c) {
        long since = prefs(c).getLong("pendingSince", 0);
        if (since == 0) return;
        long delay = Math.max(60000L, since + 24L * 3600000L - System.currentTimeMillis());
        OneTimeWorkRequest r = new OneTimeWorkRequest.Builder(TkDriveCheckWorker.class).setInitialDelay(delay, TimeUnit.MILLISECONDS).build();
        WorkManager.getInstance(c).enqueueUniqueWork(CHECK, ExistingWorkPolicy.KEEP, r);
    }

    static void cancelAll(Context c) {
        WorkManager.getInstance(c).cancelUniqueWork(WORK);
        WorkManager.getInstance(c).cancelUniqueWork(CHECK);
    }

    /** Envoie le fichier préparé. Rend null si tout va bien, sinon l'erreur. */
    static DriveErr sendPending(Context c) {
        SharedPreferences p = prefs(c);
        File f = pendingFile(c);
        if (!p.getBoolean("on", false) || !f.exists()) return null;
        long seq = p.getLong("seq", 0);
        try {
            byte[] data;
            try (FileInputStream in = new FileInputStream(f)) { data = readAll(in); }
            String token = silentToken(c);
            if (token == null) throw new DriveErr("accord à redonner", true, false);
            String folder = ensureFolder(c, token);
            upload(token, folder, p.getString("pname", "tickets.tkb"), data, p.getString("kf", ""), p.getInt("pn", 0), p.getInt("pc", 0), dev(c));
            SharedPreferences.Editor e = p.edit()
                    .putLong("lastOk", System.currentTimeMillis())
                    .putLong("lastSize", data.length)
                    .putInt("lastN", p.getInt("pn", 0))
                    .remove("err");
            boolean done = p.getLong("seq", 0) == seq;
            if (done) e.remove("pendingSince");
            if (p.getLong("since", 0) == 0) e.putLong("since", System.currentTimeMillis());
            e.apply();
            if (done) {
                //noinspection ResultOfMethodCallIgnored
                f.delete();
                WorkManager.getInstance(c).cancelUniqueWork(CHECK);
            }
            try {
                List<JSONObject> all = list(token, folder);
                // un autre téléphone envoie aussi ses sauvegardes ici (après la 1re sauvegarde de celui-ci)
                long since = p.getLong("since", 0), other = p.getLong("otherAt", 0);
                String me = dev(c);
                for (JSONObject x : all) {
                    JSONObject ap = x.optJSONObject("appProperties");
                    String d = ap == null ? "" : ap.optString("d", "");
                    long t = created(x);
                    if (!d.isEmpty() && !d.equals(me) && t > since && t > other) other = t;
                }
                p.edit().putLong("otherAt", other).putInt("count", prune(c, token, all)).apply();
            } catch (Exception ignored) {}
            return null;
        } catch (DriveErr e) {
            p.edit().putString("err", e.auth ? "auth" : ("fail:" + e.getMessage())).apply();
            return e;
        } catch (IOException e) {
            p.edit().putString("err", "net").apply();
            return new DriveErr(e.getMessage(), false, true);
        } catch (Exception e) {
            String m = String.valueOf(e.getMessage());
            boolean auth = m.contains("4: ") || m.contains("SIGN_IN") || m.contains("Unauthorized");
            p.edit().putString("err", auth ? "auth" : ("fail:" + m)).apply();
            return new DriveErr(m, auth, !auth);
        }
    }

    /** État pour l'appli. */
    static JSONObject status(Context c) {
        SharedPreferences p = prefs(c);
        JSONObject o = new JSONObject();
        try {
            o.put("on", p.getBoolean("on", false));
            o.put("email", p.getString("email", ""));
            o.put("wifi", p.getBoolean("wifi", false));
            o.put("keepD", p.getInt("keepD", 30));
            o.put("keepM", p.getInt("keepM", 12));
            o.put("keepY", p.getInt("keepY", 5));
            o.put("lastOk", p.getLong("lastOk", 0));
            o.put("lastSize", p.getLong("lastSize", 0));
            o.put("lastN", p.getInt("lastN", 0));
            o.put("pendingSince", pendingFile(c).exists() ? p.getLong("pendingSince", 0) : 0);
            o.put("count", p.getInt("count", 0));
            o.put("err", p.getString("err", ""));
            o.put("dev", dev(c));
            o.put("otherAt", p.getLong("otherAt", 0));
        } catch (Exception ignored) {}
        return o;
    }

    /** Rappel : la sauvegarde n'est pas partie depuis 24 h (canal privé des rappels). */
    static void notifyLate(Context c) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel("tk-rappels") == null) {
            NotificationChannel ch = new NotificationChannel("tk-rappels", "Rappels", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Prélèvements, factures, virements, budgets et sauvegarde");
            ch.setLockscreenVisibility(android.app.Notification.VISIBILITY_PRIVATE);
            nm.createNotificationChannel(ch);
        }
        Intent i = new Intent(c, MainActivity.class);
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        i.putExtra("tk_target", "drive");
        PendingIntent pi = PendingIntent.getActivity(c, 9742, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        int icon = c.getResources().getIdentifier("tk_ic_notif", "drawable", c.getPackageName());
        if (icon == 0) icon = android.R.drawable.stat_notify_sync;
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, "tk-rappels")
                .setSmallIcon(icon)
                .setContentTitle("Sauvegarde Drive en attente")
                .setContentText("Ta sauvegarde n'est pas partie depuis hier. Ouvre Tickets avec du réseau.")
                .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
                .setAutoCancel(true)
                .setContentIntent(pi);
        try { nm.notify(9742, b.build()); } catch (SecurityException ignored) {}
    }
}
