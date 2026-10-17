package fr.bpierrard.tickets.beta;

import android.content.Context;
import android.content.Intent;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebView;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Fonctions Android utilisées par l'appli :
 *  - print({ name })              : imprime / enregistre en PDF la page affichée (Bilan)
 *  - biometricAvailable()         : { available } si une empreinte (ou le visage) est configurée
 *  - biometric({ title, ... })    : demande l'empreinte, sans adresse de site
 *  - widgetData({ json })         : résumé des chiffres pour les widgets de l'écran d'accueil
 *  - launchTarget()               : { target } si l'appli a été ouverte depuis un widget (une seule fois)
 */
@CapacitorPlugin(name = "TicketsNative")
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
