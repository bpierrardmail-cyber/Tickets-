package fr.bpierrard.tickets.beta;

import android.content.Context;
import android.content.SharedPreferences;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

/** 24 h après une modification pas encore partie sur Drive : un rappel (si les rappels sont activés). */
public class TkDriveCheckWorker extends Worker {
    public TkDriveCheckWorker(@NonNull Context c, @NonNull WorkerParameters p) { super(c, p); }

    @NonNull
    @Override
    public Result doWork() {
        Context c = getApplicationContext();
        SharedPreferences p = TkDrive.prefs(c);
        long since = p.getLong("pendingSince", 0);
        if (!p.getBoolean("on", false) || !p.getBoolean("remind", false) || since == 0 || !TkDrive.pendingFile(c).exists()) return Result.success();
        if (System.currentTimeMillis() - since >= 23L * 3600000L) TkDrive.notifyLate(c);
        return Result.success();
    }
}
