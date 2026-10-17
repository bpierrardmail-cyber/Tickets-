package fr.bpierrard.tickets.beta;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Lecteur de tickets ML Kit (sur le téléphone, hors ligne)
        registerPlugin(TicketOcrPlugin.class);
        // Impression du Bilan et empreinte digitale
        registerPlugin(TicketsNativePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
