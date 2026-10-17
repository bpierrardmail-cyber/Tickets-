package fr.bpierrard.tickets.beta;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;

/** Widget : Bourse du jour (appli perso). Recalculé toutes les 15 minutes, ou tout de suite avec ↻. */
public class TkWidgetBourse extends TkWidgetBase {
    static final String REFRESH = "tickets.widget.BOURSE_REFRESH";

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        super.onUpdate(c, m, ids);
        TkBourseWorker.schedule(c);
    }

    @Override
    public void onEnabled(Context c) { TkBourseWorker.schedule(c); TkBourseWorker.runNow(c); }

    @Override
    public void onDisabled(Context c) { TkBourseWorker.cancel(c); }

    @Override
    public void onReceive(Context c, Intent i) {
        if (REFRESH.equals(i.getAction())) { TkBourseWorker.runNow(c); return; }
        super.onReceive(c, i);
    }
}
