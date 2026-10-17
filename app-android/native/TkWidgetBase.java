package fr.bpierrard.tickets.beta;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;

/** Base commune des widgets : redessine à la demande d'Android et quand le widget change de taille. */
public abstract class TkWidgetBase extends AppWidgetProvider {
    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        for (int id : ids) TkWidgets.update(c, m, id, getClass());
    }

    @Override
    public void onAppWidgetOptionsChanged(Context c, AppWidgetManager m, int id, Bundle o) {
        TkWidgets.update(c, m, id, getClass());
    }

    @Override
    public void onDeleted(Context c, int[] ids) {
        TkWidgets.forget(c, ids);
    }
}
