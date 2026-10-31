package fr.bpierrard.tickets.beta;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/**
 * Appli Perso (chargée en ligne) : garde sur le téléphone une copie de la dernière page ouverte
 * et l'ouvre quand il n'y a pas de réseau, ou si le chargement échoue (réseau trop faible, site indisponible).
 * La copie est servie à la même adresse : mêmes données, mêmes réglages. Le pont Capacitor est ajouté
 * par le WebView au début de chaque page de cette adresse (DOCUMENT_START_SCRIPT), copie comprise.
 * L'appli Store, elle, est entièrement dans l'APK : cette classe ne sert pas.
 */
public class TkOfflineClient extends BridgeWebViewClient {

    private static final String FILE = "tk-offline-page.html";
    private final Context ctx;
    private final Uri app;
    private volatile boolean saved = false;
    private int retries = 0;

    public TkOfflineClient(Bridge bridge, Context ctx) {
        super(bridge);
        this.ctx = ctx.getApplicationContext();
        this.app = Uri.parse(bridge.getAppUrl());
    }

    /** Seulement pour une appli chargée en ligne, avec un WebView qui ajoute lui-même le pont. */
    public static boolean usable(Bridge b) {
        String s = b == null ? null : b.getServerUrl();
        return s != null && !s.isEmpty() && WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT);
    }

    /** 0 = pas de réseau, 1 = réseau pas encore vérifié par Android, 2 = internet vérifié. */
    public int net() {
        try {
            ConnectivityManager cm = (ConnectivityManager) ctx.getSystemService(Context.CONNECTIVITY_SERVICE);
            Network n = cm == null ? null : cm.getActiveNetwork();
            NetworkCapabilities c = n == null ? null : cm.getNetworkCapabilities(n);
            if (c == null || !c.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)) return 0;
            return c.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED) ? 2 : 1;
        } catch (Exception e) {
            return 1;
        }
    }

    public boolean hasCopy() {
        File f = new File(ctx.getFilesDir(), FILE);
        return f.exists() && f.length() > 10000;
    }

    public String appUrl() {
        return app.toString();
    }

    private boolean isAppPage(Uri u) {
        if (u == null || u.getHost() == null || app.getHost() == null || !u.getHost().equalsIgnoreCase(app.getHost())) return false;
        String p = u.getPath() == null ? "/" : u.getPath();
        String ap = app.getPath() == null || app.getPath().isEmpty() ? "/" : app.getPath();
        if (!ap.endsWith("/")) return p.equals(ap);
        return p.equals(ap) || p.equals(ap + "index.html");
    }

    private static byte[] readAll(InputStream in) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream(1 << 20);
        byte[] buf = new byte[16384];
        int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        in.close();
        return out.toByteArray();
    }

    /** La page en ligne (toujours la dernière : on évite le cache du site), ou null. */
    private byte[] fetch(Uri u, boolean validated) {
        HttpURLConnection c = null;
        try {
            String url = u.buildUpon().appendQueryParameter("tkf", String.valueOf(System.currentTimeMillis())).build().toString();
            c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(validated ? 6000 : 3000);
            c.setReadTimeout(validated ? 15000 : 6000);
            c.setUseCaches(false);
            c.setRequestProperty("Accept", "text/html,application/xhtml+xml,*/*");
            if (c.getResponseCode() != 200) return null;
            byte[] b = readAll(c.getInputStream());
            // une vraie page de Tickets (et pas une page d'erreur du réseau ou du site)
            String head = new String(b, 0, Math.min(b.length, 8000), StandardCharsets.UTF_8);
            if (b.length < 10000 || !head.contains("name=\"build\"")) return null;
            return b;
        } catch (Exception e) {
            return null;
        } finally {
            if (c != null) c.disconnect();
        }
    }

    private void save(byte[] b) {
        try {
            File dir = ctx.getFilesDir(), tmp = new File(dir, FILE + ".tmp"), f = new File(dir, FILE);
            FileOutputStream o = new FileOutputStream(tmp);
            o.write(b);
            o.getFD().sync();
            o.close();
            if (!tmp.renameTo(f)) {
                f.delete();
                tmp.renameTo(f);
            }
            saved = true;
        } catch (Exception ignored) {}
    }

    private byte[] load() {
        try {
            File f = new File(ctx.getFilesDir(), FILE);
            if (!f.exists() || f.length() < 10000) return null;
            return readAll(new FileInputStream(f));
        } catch (Exception e) {
            return null;
        }
    }

    private static WebResourceResponse page(byte[] b) {
        Map<String, String> h = new HashMap<>();
        h.put("Cache-Control", "no-store");
        return new WebResourceResponse("text/html", "utf-8", 200, "OK", h, new ByteArrayInputStream(b));
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
        if (req.isForMainFrame() && "GET".equalsIgnoreCase(req.getMethod()) && isAppPage(req.getUrl())) {
            int n = net();
            byte[] b = n > 0 ? fetch(req.getUrl(), n == 2) : null;
            if (b != null) {
                save(b);
                return page(b);
            }
            byte[] copy = load();
            if (copy != null) return page(copy);
        }
        return super.shouldInterceptRequest(view, req);
    }

    @Override
    public void onPageFinished(WebView view, String url) {
        super.onPageFinished(view, url);
        if (!isAppPage(Uri.parse(url))) return;
        retries = 0;
        // page ouverte sans passer par la copie (tout premier chargement) : on l'enregistre quand même
        if (!saved && net() > 0) {
            new Thread(() -> {
                byte[] b = fetch(app, true);
                if (b != null) save(b);
            }).start();
        }
    }

    /** Échec d'ouverture de l'appli : la copie plutôt que la page « Pas de connexion ». */
    private boolean reopenFromCopy(WebView view, WebResourceRequest req) {
        if (!req.isForMainFrame() || !isAppPage(req.getUrl()) || !hasCopy() || retries >= 2) return false;
        retries++;
        view.post(() -> view.loadUrl(app.toString()));
        return true;
    }

    @Override
    public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError error) {
        if (reopenFromCopy(view, req)) return;
        super.onReceivedError(view, req, error);
    }

    @Override
    public void onReceivedHttpError(WebView view, WebResourceRequest req, WebResourceResponse resp) {
        if (reopenFromCopy(view, req)) return;
        super.onReceivedHttpError(view, req, resp);
    }
}
