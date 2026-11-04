package fr.bpierrard.tickets.beta;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

/** Envoie sur Google Drive la sauvegarde préparée par l'appli (avec le réseau, même appli fermée). */
public class TkDriveWorker extends Worker {
    public TkDriveWorker(@NonNull Context c, @NonNull WorkerParameters p) { super(c, p); }

    @NonNull
    @Override
    public Result doWork() {
        TkDrive.DriveErr e = TkDrive.sendPending(getApplicationContext());
        if (e == null) return Result.success();
        if (e.auth) return Result.failure();            // l'utilisateur doit reconnecter son compte Google dans l'appli
        if (e.retry && getRunAttemptCount() < 8) return Result.retry();
        return Result.failure();
    }
}
