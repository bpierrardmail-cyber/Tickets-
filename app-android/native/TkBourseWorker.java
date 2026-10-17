package fr.bpierrard.tickets.beta;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONObject;

import java.util.concurrent.TimeUnit;

/**
 * Recalcule le total Bourse sans ouvrir l'appli : cours du moment (CoinGecko, relais des cours),
 * positions et taux de change donnés par l'appli. Toutes les 15 minutes (le minimum d'Android), avec Internet.
 */
public class TkBourseWorker extends Worker {
    public TkBourseWorker(@NonNull Context c, @NonNull WorkerParameters p) { super(c, p); }

    static Constraints net() { return new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build(); }

    static void schedule(Context c) {
        PeriodicWorkRequest r = new PeriodicWorkRequest.Builder(TkBourseWorker.class, 15, TimeUnit.MINUTES).setConstraints(net()).build();
        WorkManager.getInstance(c).enqueueUniquePeriodicWork("tk_bourse", ExistingPeriodicWorkPolicy.KEEP, r);
    }

    static void runNow(Context c) {
        OneTimeWorkRequest r = new OneTimeWorkRequest.Builder(TkBourseWorker.class).setConstraints(net()).build();
        WorkManager.getInstance(c).enqueueUniqueWork("tk_bourse_now", ExistingWorkPolicy.REPLACE, r);
    }

    static void cancel(Context c) {
        WorkManager.getInstance(c).cancelUniqueWork("tk_bourse");
        WorkManager.getInstance(c).cancelUniqueWork("tk_bourse_now");
    }

    @NonNull
    @Override
    public Result doWork() {
        Context c = getApplicationContext();
        if (!TkWidgets.hasWidgets(c, TkWidgetBourse.class)) return Result.success();
        JSONObject d = TkWidgets.data(c);
        JSONObject b = d == null ? null : d.optJSONObject("bourse");
        if (b != null) {
            try {
                double t = TkWidgets.fetchBourse(b);
                if (!Double.isNaN(t) && t > 0) TkWidgets.recordNative(c, t);
            } catch (Exception e) {
                android.util.Log.w("TicketsWidgets", "bourse : " + e);
            }
        }
        TkWidgets.updateAll(c);
        return Result.success();
    }
}
