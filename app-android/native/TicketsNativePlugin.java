package fr.bpierrard.tickets.beta;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.database.Cursor;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebView;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.mlkit.vision.barcode.common.Barcode;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanner;
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning;
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions;
import com.google.mlkit.vision.documentscanner.GmsDocumentScanning;
import com.google.mlkit.vision.documentscanner.GmsDocumentScanningResult;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.json.JSONObject;

/**
 * Fonctions Android utilisées par l'appli :
 *  - print({ name })              : imprime / enregistre en PDF la page affichée (Bilan)
 *  - biometricAvailable()         : { available } si une empreinte (ou le visage) est configurée
 *  - biometric({ title, ... })    : demande l'empreinte, sans adresse de site
 *  - widgetData({ json })         : résumé des chiffres pour les widgets de l'écran d'accueil
 *  - launchTarget()               : { target } si l'appli a été ouverte depuis un widget (une seule fois)
 *  - scanQr()                     : { text } lu par le lecteur de QR code de Google Play (invitation au foyer)
 *  - scanDoc({ pages })           : { images } pages scannées (JPEG base64) par le scanner de documents de Google Play
 *  - driveConnect()               : connexion Google (accès drive.file) ; { email, count, kfs, last, lastN }
 *  - driveSetup({ on, wifi, keepD, keepM, keepY, remind }) / driveStatus() : réglages et état de la sauvegarde Drive
 *  - driveStage({ data, name, n, kf, remind }) : sauvegarde chiffrée préparée, envoyée dès que le réseau est là
 *  - sharedFile()                 : { name, mime, b64 } ou { text } : relevé partagé vers Tickets (une seule fois)
 *  - driveSendNow()               : relance l'envoi ; driveFetch() : { data, name, created, n } de la dernière sauvegarde
 */
@CapacitorPlugin(name = "TicketsNative", requestCodes = { TicketsNativePlugin.DOC_REQ, TicketsNativePlugin.DRIVE_REQ })
public class TicketsNativePlugin extends Plugin {

    @PluginMethod
    public void print(final PluginCall call) {
        final String name = call.getString("name", "Tickets");
        getActivity().runOnUiThread(() -> {
            try {
                WebView wv = getBridge().getWebView();
                PrintManager pm = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                PrintDocumentAdapter adapter = wv.createPrintDocumentAdapter(name);
                pm.print(name, adapter, new PrintAttributes.Builder()
                        .setMediaSize(PrintAttributes.MediaSize.ISO_A4).build());
                call.resolve();
            } catch (Exception e) {
                call.reject("Impression impossible : " + e.getMessage(), e);
            }
        });
    }

    @PluginMethod
    public void biometricAvailable(PluginCall call) {
        int r = BiometricManager.from(getContext()).canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK);
        JSObject ret = new JSObject();
        ret.put("available", r == BiometricManager.BIOMETRIC_SUCCESS);
        ret.put("code", r);
        call.resolve(ret);
    }

    @PluginMethod
    public void biometric(final PluginCall call) {
        final String title = call.getString("title", "Tickets");
        final String subtitle = call.getString("subtitle", "Déverrouille avec ton empreinte");
        final String cancel = call.getString("cancel", "Utiliser le code");
        getActivity().runOnUiThread(() -> {
            try {
                BiometricPrompt prompt = new BiometricPrompt((FragmentActivity) getActivity(),
                        ContextCompat.getMainExecutor(getContext()),
                        new BiometricPrompt.AuthenticationCallback() {
                            @Override
                            public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                                JSObject ret = new JSObject();
                                ret.put("ok", true);
                                call.resolve(ret);
                            }

                            @Override
                            public void onAuthenticationError(int code, @NonNull CharSequence msg) {
                                call.reject(msg.toString(), String.valueOf(code));
                            }
                        });
                BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
                        .setTitle(title)
                        .setSubtitle(subtitle)
                        .setNegativeButtonText(cancel)
                        .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_WEAK)
                        .build();
                prompt.authenticate(info);
            } catch (Exception e) {
                call.reject("Empreinte indisponible : " + e.getMessage(), e);
            }
        });
    }

    @PluginMethod
    public void scanQr(final PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                GmsBarcodeScannerOptions o = new GmsBarcodeScannerOptions.Builder()
                        .setBarcodeFormats(Barcode.FORMAT_QR_CODE).build();
                GmsBarcodeScanner sc = GmsBarcodeScanning.getClient(getActivity(), o);
                sc.startScan()
                        .addOnSuccessListener(bc -> { JSObject r = new JSObject(); r.put("text", bc.getRawValue()); call.resolve(r); })
                        .addOnCanceledListener(() -> call.reject("Lecture annulée", "cancel"))
                        .addOnFailureListener(e -> call.reject("Lecteur de QR code indisponible : " + e.getMessage(), "fail"));
            } catch (Exception e) {
                call.reject("Lecteur de QR code indisponible : " + e.getMessage(), "fail");
            }
        });
    }

    // ---------- Scanner de documents (ML Kit, services Google Play) ----------
    // Ticket ou pages d'une facture : recadrés, redressés, contrastés. Résultat : { images: [jpeg en base64] }.
    static final int DOC_REQ = 9741;
    private PluginCall docCall;

    @PluginMethod
    public void scanDoc(final PluginCall call) {
        final int max = Math.max(1, Math.min(20, call.getInt("pages", 1)));
        getActivity().runOnUiThread(() -> {
            try {
                GmsDocumentScannerOptions o = new GmsDocumentScannerOptions.Builder()
                        .setPageLimit(max)
                        .setGalleryImportAllowed(true)
                        .setResultFormats(GmsDocumentScannerOptions.RESULT_FORMAT_JPEG)
                        .setScannerMode(GmsDocumentScannerOptions.SCANNER_MODE_FULL)
                        .build();
                GmsDocumentScanning.getClient(o).getStartScanIntent(getActivity())
                        .addOnSuccessListener(sender -> {
                            try {
                                docCall = call;
                                getActivity().startIntentSenderForResult(sender, DOC_REQ, null, 0, 0, 0);
                            } catch (Exception e) {
                                docCall = null;
                                call.reject("Scanner indisponible : " + e.getMessage(), "fail");
                            }
                        })
                        .addOnFailureListener(e -> call.reject("Scanner indisponible : " + e.getMessage(), "fail"));
            } catch (Exception e) {
                call.reject("Scanner indisponible : " + e.getMessage(), "fail");
            }
        });
    }

    @Override
    protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
        super.handleOnActivityResult(requestCode, resultCode, data);
        if (requestCode == DRIVE_REQ) { driveResult(resultCode, data); return; }
        if (requestCode != DOC_REQ) return;
        PluginCall call = docCall;
        docCall = null;
        if (call == null) return;
        if (resultCode != Activity.RESULT_OK) { call.reject("Scan annulé", "cancel"); return; }
        try {
            GmsDocumentScanningResult res = GmsDocumentScanningResult.fromActivityResultIntent(data);
            if (res == null || res.getPages() == null || res.getPages().isEmpty()) { call.reject("Aucune page", "cancel"); return; }
            JSArray imgs = new JSArray();
            for (GmsDocumentScanningResult.Page pg : res.getPages()) {
                Uri u = pg.getImageUri();
                try (InputStream in = getContext().getContentResolver().openInputStream(u)) {
                    if (in == null) continue;
                    ByteArrayOutputStream out = new ByteArrayOutputStream();
                    byte[] buf = new byte[16384];
                    int n;
                    while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                    imgs.put(Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP));
                }
            }
            JSObject r = new JSObject();
            r.put("images", imgs);
            call.resolve(r);
        } catch (Exception e) {
            call.reject("Scan illisible : " + e.getMessage(), "fail");
        }
    }

    // ---------- Sauvegarde sur Google Drive (TkDrive) ----------
    static final int DRIVE_REQ = 9743;
    private PluginCall driveCall;

    private JSObject driveStatusJS() {
        try { return new JSObject(TkDrive.status(getContext()).toString()); } catch (Exception e) { return new JSObject(); }
    }

    @PluginMethod
    public void driveConnect(final PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                Identity.getAuthorizationClient(getActivity()).authorize(TkDrive.request())
                        .addOnSuccessListener(r -> {
                            if (r.hasResolution() && r.getPendingIntent() != null) {
                                try {
                                    driveCall = call;
                                    getActivity().startIntentSenderForResult(r.getPendingIntent().getIntentSender(), DRIVE_REQ, null, 0, 0, 0);
                                } catch (Exception e) {
                                    driveCall = null;
                                    call.reject("Connexion Google impossible : " + e.getMessage(), "fail");
                                }
                            } else driveAfterAuth(call, r.getAccessToken());
                        })
                        .addOnFailureListener(e -> call.reject("Connexion Google impossible : " + e.getMessage(), "fail"));
            } catch (Exception e) {
                call.reject("Connexion Google impossible : " + e.getMessage(), "fail");
            }
        });
    }

    private void driveResult(int resultCode, Intent data) {
        PluginCall call = driveCall;
        driveCall = null;
        if (call == null) return;
        if (resultCode != Activity.RESULT_OK) { call.reject("Connexion annulée", "cancel"); return; }
        try {
            AuthorizationResult r = Identity.getAuthorizationClient(getActivity()).getAuthorizationResultFromIntent(data);
            driveAfterAuth(call, r.getAccessToken());
        } catch (Exception e) {
            call.reject("Connexion Google impossible : " + e.getMessage(), "fail");
        }
    }

    private void driveAfterAuth(final PluginCall call, final String token) {
        if (token == null) { call.reject("Accès à Drive refusé", "fail"); return; }
        final Context c = getContext();
        new Thread(() -> {
            try {
                String folder = TkDrive.ensureFolder(c, token);
                List<JSONObject> l = TkDrive.list(token, folder);
                String mail = TkDrive.email(token);
                TkDrive.prefs(c).edit().putString("email", mail).putInt("count", l.size()).remove("err").apply();
                JSObject r = new JSObject();
                r.put("email", mail);
                r.put("count", l.size());
                JSArray kfs = new JSArray();
                Set<String> seen = new HashSet<>();
                for (JSONObject o : l) {
                    JSONObject ap = o.optJSONObject("appProperties");
                    String kf = ap == null ? "" : ap.optString("kf", "");
                    if (!kf.isEmpty() && seen.add(kf)) kfs.put(kf);
                }
                r.put("kfs", kfs);
                if (!l.isEmpty()) {
                    r.put("last", TkDrive.created(l.get(0)));
                    JSONObject ap = l.get(0).optJSONObject("appProperties");
                    r.put("lastN", ap == null ? "" : ap.optString("n", ""));
                }
                call.resolve(r);
            } catch (Exception e) {
                call.reject("Drive : " + e.getMessage(), "fail");
            }
        }).start();
    }

    @PluginMethod
    public void driveSetup(PluginCall call) {
        Context c = getContext();
        android.content.SharedPreferences.Editor e = TkDrive.prefs(c).edit();
        if (call.hasOption("on")) e.putBoolean("on", Boolean.TRUE.equals(call.getBoolean("on", false)));
        if (call.hasOption("wifi")) e.putBoolean("wifi", Boolean.TRUE.equals(call.getBoolean("wifi", false)));
        if (call.hasOption("remind")) e.putBoolean("remind", Boolean.TRUE.equals(call.getBoolean("remind", false)));
        if (call.hasOption("keepD")) e.putInt("keepD", call.getInt("keepD", 30));
        if (call.hasOption("keepM")) e.putInt("keepM", call.getInt("keepM", 12));
        if (call.hasOption("keepY")) e.putInt("keepY", call.getInt("keepY", 5));
        e.commit();
        if (!TkDrive.prefs(c).getBoolean("on", false)) {
            TkDrive.cancelAll(c);
            //noinspection ResultOfMethodCallIgnored
            TkDrive.pendingFile(c).delete();
            TkDrive.prefs(c).edit().remove("pendingSince").remove("err").apply();
        } else if (call.hasOption("wifi") && TkDrive.pendingFile(c).exists()) TkDrive.enqueue(c);
        call.resolve(driveStatusJS());
    }

    @PluginMethod
    public void driveStatus(PluginCall call) { call.resolve(driveStatusJS()); }

    @PluginMethod
    public void driveStage(final PluginCall call) {
        final String data = call.getString("data");
        if (data == null || data.isEmpty()) { call.reject("données manquantes"); return; }
        final Context c = getContext();
        if (!TkDrive.prefs(c).getBoolean("on", false)) { call.reject("sauvegarde Drive désactivée", "off"); return; }
        final String name = call.getString("name", "tickets.tkb");
        final int n = call.getInt("n", 0);
        final int nc = call.getInt("c", 0);
        final String kf = call.getString("kf", "");
        final boolean remind = Boolean.TRUE.equals(call.getBoolean("remind", false));
        new Thread(() -> {
            try {
                TkDrive.stage(c, data, name, n, nc, kf, remind);
                call.resolve(driveStatusJS());
            } catch (Exception e) {
                call.reject("Sauvegarde impossible : " + e.getMessage(), "fail");
            }
        }).start();
    }

    @PluginMethod
    public void driveSendNow(PluginCall call) {
        Context c = getContext();
        TkDrive.prefs(c).edit().remove("err").apply();
        if (TkDrive.pendingFile(c).exists()) TkDrive.enqueue(c, true);
        call.resolve(driveStatusJS());
    }

    /** Liste des sauvegardes : { files: [{ id, created, n, c, d, kf, size }], dev } (la plus récente d'abord). */
    @PluginMethod
    public void driveList(final PluginCall call) {
        final Context c = getContext();
        new Thread(() -> {
            try {
                String token = TkDrive.silentToken(c);
                if (token == null) { call.reject("Reconnecte ton compte Google", "auth"); return; }
                String folder = TkDrive.ensureFolder(c, token);
                List<JSONObject> l = TkDrive.list(token, folder);
                JSArray a = new JSArray();
                for (JSONObject f : l) {
                    JSONObject ap = f.optJSONObject("appProperties");
                    JSObject o = new JSObject();
                    o.put("id", f.optString("id"));
                    o.put("created", TkDrive.created(f));
                    o.put("size", f.optString("size", ""));
                    o.put("n", ap == null ? "" : ap.optString("n", ""));
                    o.put("c", ap == null ? "" : ap.optString("c", ""));
                    o.put("d", ap == null ? "" : ap.optString("d", ""));
                    o.put("kf", ap == null ? "" : ap.optString("kf", ""));
                    a.put(o);
                }
                TkDrive.prefs(c).edit().putInt("count", l.size()).apply();
                JSObject r = new JSObject();
                r.put("files", a);
                r.put("dev", TkDrive.dev(c));
                call.resolve(r);
            } catch (Exception e) {
                call.reject("Drive : " + e.getMessage(), "fail");
            }
        }).start();
    }

    /** Une sauvegarde ({ id }), sinon la plus récente : { data, name, created, count }. */
    @PluginMethod
    public void driveFetch(final PluginCall call) {
        final Context c = getContext();
        final String want = call.getString("id", null);
        new Thread(() -> {
            try {
                String token = TkDrive.silentToken(c);
                if (token == null) { call.reject("Reconnecte ton compte Google", "auth"); return; }
                String folder = TkDrive.ensureFolder(c, token);
                List<JSONObject> l = TkDrive.list(token, folder);
                if (l.isEmpty()) { call.reject("Aucune sauvegarde sur Drive", "none"); return; }
                JSONObject f = l.get(0);
                if (want != null) {
                    f = null;
                    for (JSONObject x : l) if (want.equals(x.optString("id"))) { f = x; break; }
                    if (f == null) { call.reject("Sauvegarde introuvable sur Drive", "none"); return; }
                }
                JSObject r = new JSObject();
                r.put("data", TkDrive.download(token, f.getString("id")));
                r.put("name", f.optString("name", ""));
                r.put("created", TkDrive.created(f));
                r.put("count", l.size());
                call.resolve(r);
            } catch (Exception e) {
                call.reject("Drive : " + e.getMessage(), "fail");
            }
        }).start();
    }

    // ---------- Relevé partagé vers Tickets (« Partager » depuis l'appli de la banque, ou « Ouvrir avec ») ----------
    private static JSObject pendingShare = null;

    /** Appelé par MainActivity : lit le fichier partagé (20 Mo au plus) et le garde pour la page. */
    static void takeShare(Context c, Intent i) {
        if (i == null) return;
        String a = i.getAction();
        if (!Intent.ACTION_SEND.equals(a) && !Intent.ACTION_VIEW.equals(a)) return;
        Uri u = null;
        if (Intent.ACTION_SEND.equals(a)) {
            Object st = i.getExtras() == null ? null : i.getExtras().get(Intent.EXTRA_STREAM);
            if (st instanceof Uri) u = (Uri) st;
        } else u = i.getData();
        JSObject r = new JSObject();
        try {
            if (u != null) {
                String name = null;
                try (Cursor cu = c.getContentResolver().query(u, new String[]{ OpenableColumns.DISPLAY_NAME }, null, null, null)) {
                    if (cu != null && cu.moveToFirst()) name = cu.getString(0);
                } catch (Exception ignored) {}
                if (name == null) name = u.getLastPathSegment();
                try (InputStream in = c.getContentResolver().openInputStream(u)) {
                    if (in == null) return;
                    ByteArrayOutputStream out = new ByteArrayOutputStream();
                    byte[] buf = new byte[16384];
                    int n, tot = 0;
                    while ((n = in.read(buf)) > 0) { out.write(buf, 0, n); tot += n; if (tot > 20 * 1024 * 1024) { r.put("tooBig", true); break; } }
                    if (!r.has("tooBig")) r.put("b64", Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP));
                }
                r.put("name", name == null ? "relevé" : name);
                r.put("mime", i.getType() == null ? "" : i.getType());
            } else {
                String t = i.getStringExtra(Intent.EXTRA_TEXT);
                if (t == null || t.isEmpty()) return;
                r.put("text", t);
                r.put("name", "texte partagé");
            }
        } catch (Exception e) {
            r.put("error", String.valueOf(e.getMessage()));
        }
        pendingShare = r;
        // une rotation ou un retour dans l'appli ne relit pas le même fichier
        i.setAction(Intent.ACTION_MAIN);
        i.removeExtra(Intent.EXTRA_STREAM);
        i.removeExtra(Intent.EXTRA_TEXT);
        i.setData(null);
    }

    @PluginMethod
    public void sharedFile(PluginCall call) {
        JSObject r = pendingShare == null ? new JSObject() : pendingShare;
        pendingShare = null;
        call.resolve(r);
    }

    // ---------- Widgets ----------
    private static String pendingTarget = null;

    /** Appelé par MainActivity : l'appli a été ouverte (ou ramenée devant) par un widget. */
    static void takeIntent(Intent i) {
        if (i == null) return;
        String t = i.getStringExtra("tk_target");
        if (t != null) { pendingTarget = t; i.removeExtra("tk_target"); }
    }

    @PluginMethod
    public void launchTarget(PluginCall call) {
        JSObject r = new JSObject();
        r.put("target", pendingTarget);
        pendingTarget = null;
        call.resolve(r);
    }

    @PluginMethod
    public void widgetData(PluginCall call) {
        String json = call.getString("json");
        if (json == null) { call.reject("json manquant"); return; }
        try {
            Context c = getContext();
            TkWidgets.save(c, json);
            TkWidgets.updateAll(c);
            if (TkWidgets.hasWidgets(c, TkWidgetBourse.class)) TkBourseWorker.schedule(c);
            call.resolve();
        } catch (Exception e) {
            call.reject("Widgets : " + e.getMessage(), e);
        }
    }
}
