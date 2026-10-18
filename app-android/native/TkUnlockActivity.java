package fr.bpierrard.tickets.beta;

import android.app.KeyguardManager;
import android.content.Context;
import android.os.Bundle;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;

/**
 * Afficher les montants des widgets sans ouvrir Tickets : Android demande l'empreinte
 * (ou le code / schéma du téléphone) par-dessus l'écran d'accueil. Écran transparent, fermé aussitôt.
 */
public class TkUnlockActivity extends AppCompatActivity {
    static final int AUTH = BiometricManager.Authenticators.BIOMETRIC_WEAK | BiometricManager.Authenticators.DEVICE_CREDENTIAL;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        String what = getIntent().getStringExtra("what");
        final String target = getIntent().getStringExtra("target");
        int can = BiometricManager.from(this).canAuthenticate(AUTH);
        KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
        boolean secure = km != null && km.isDeviceSecure();
        if (can != BiometricManager.BIOMETRIC_SUCCESS && !secure) {
            // Téléphone sans verrouillage d'écran : rien à demander ici, on ouvre Tickets (son propre code le protège)
            Toast.makeText(this, "Ce téléphone n'a pas de verrouillage d'écran : ouverture de Tickets", Toast.LENGTH_LONG).show();
            try { startActivity(TkWidgets.openIntent(this, target == null ? "list" : target)); } catch (Exception ignored) { }
            done();
            return;
        }
        BiometricPrompt prompt = new BiometricPrompt(this, ContextCompat.getMainExecutor(this), new BiometricPrompt.AuthenticationCallback() {
            @Override
            public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult r) {
                TkWidgets.showAll(getApplicationContext());
                done();
            }

            @Override
            public void onAuthenticationError(int code, @NonNull CharSequence msg) { done(); }
        });
        if (b == null) {
            BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
                    .setTitle("Afficher les montants")
                    .setSubtitle("Tickets" + (what == null ? "" : " · " + what))
                    .setAllowedAuthenticators(AUTH)
                    .setConfirmationRequired(false)
                    .build();
            prompt.authenticate(info);
        }
    }

    private void done() {
        finish();
        overridePendingTransition(0, 0);
    }
}
