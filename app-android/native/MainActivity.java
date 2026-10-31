package fr.bpierrard.tickets.beta;

import android.content.Intent;
import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Lecteur de tickets ML Kit (sur le téléphone, hors ligne)
        registerPlugin(TicketOcrPlugin.class);
        // Impression du Bilan, empreinte digitale et widgets
        registerPlugin(TicketsNativePlugin.class);
        super.onCreate(savedInstanceState);
        // Appli Perso (chargée en ligne) : sans réseau, elle ouvre la copie de la page gardée sur le téléphone
        Bridge bridge = getBridge();
        if (TkOfflineClient.usable(bridge)) {
            TkOfflineClient offline = new TkOfflineClient(bridge, this);
            bridge.setWebViewClient(offline);
            // pas de réseau du tout : la copie tout de suite (le chargement lancé juste avant échouerait)
            if (offline.net() == 0 && offline.hasCopy()) bridge.getWebView().loadUrl(offline.appUrl());
        }
        TicketsNativePlugin.takeIntent(getIntent());
        // Geste / bouton retour : la page le gère (fermer une fenêtre, écran précédent, accueil).
        // Plus rien à défaire dans la page : comportement normal d'Android (l'appli se réduit).
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                final WebView wv = (getBridge() != null) ? getBridge().getWebView() : null;
                if (wv == null) { systemBack(); return; }
                // La page dit si elle a traité le retour (true) ou s'il faut quitter (false)
                wv.evaluateJavascript("(function(){try{return window.tkBack?String(window.tkBack()):'none'}catch(e){return 'none'}})()", value -> {
                    String v = value == null ? "" : value.replace("\"", "");
                    if ("true".equals(v)) return;
                    if ("none".equals(v) && wv.canGoBack()) { wv.goBack(); return; }
                    systemBack();
                });
            }
            private void systemBack() {
                setEnabled(false);
                getOnBackPressedDispatcher().onBackPressed();
                setEnabled(true);
            }
        });
    }

    // Appli déjà ouverte : un widget la ramène devant, sur l'onglet voulu
    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        TicketsNativePlugin.takeIntent(intent);
    }
}
