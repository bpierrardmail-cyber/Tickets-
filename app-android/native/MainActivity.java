package fr.bpierrard.tickets.beta;

import android.content.Intent;
import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Lecteur de tickets ML Kit (sur le téléphone, hors ligne)
        registerPlugin(TicketOcrPlugin.class);
        // Impression du Bilan, empreinte digitale et widgets
        registerPlugin(TicketsNativePlugin.class);
        super.onCreate(savedInstanceState);
        TicketsNativePlugin.takeIntent(getIntent());
        // Geste / bouton retour : la page le gère (fermer une fenêtre, écran précédent, accueil).
        // Plus rien à défaire dans la page : comportement normal d'Android (l'appli se réduit).
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView wv = (getBridge() != null) ? getBridge().getWebView() : null;
                if (wv != null && wv.canGoBack()) { wv.goBack(); return; }
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
