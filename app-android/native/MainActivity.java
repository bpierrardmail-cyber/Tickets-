package fr.bpierrard.tickets.beta;

import android.content.Intent;
import android.os.Bundle;
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
    }

    // Appli déjà ouverte : un widget la ramène devant, sur l'onglet voulu
    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        TicketsNativePlugin.takeIntent(intent);
    }
}
