package fr.bpierrard.tickets.beta;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
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
import com.google.mlkit.vision.barcode.common.Barcode;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanner;
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning;
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions;
import com.google.mlkit.vision.documentscanner.GmsDocumentScanning;
import com.google.mlkit.vision.documentscanner.GmsDocumentScanningResult;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;

/**
 * Fonctions Android utilisées par l'appli :
 *  - print({ name })              : imprime / enregistre en PDF la page affichée (Bilan)
 *  - biometricAvailable()         : { available } si une empreinte (ou le visage) est configurée
 *  - biometric({ title, ... })    : demande l'empreinte, sans adresse de site
 *  - widgetData({ json })         : résumé des chiffres pour les widgets de l'écran d'accueil
 *  - launchTarget()               : { target } si l'appli a été ouverte depuis un widget (une seule fois)
 *  - scanQr()                     : { text } lu par le lecteur de QR code de Google Play (invitation au foyer)
 *  - scanDoc({ pages })           : { images } pages scannées (JPEG base64) par le scanner de documents de Google Play
 */
@CapacitorPlugin(name = "TicketsNative", requestCodes = { TicketsNativePlugin.DOC_REQ })
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
