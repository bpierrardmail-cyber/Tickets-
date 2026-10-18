package fr.bpierrard.tickets.beta;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Actions des widgets qui n'ouvrent pas l'appli : masquer les montants (toucher, ou au bout de 2 minutes). */
public class TkWidgetActions extends BroadcastReceiver {
    static final String HIDE = "tickets.widget.HIDE";
    static final String REMASK = "tickets.widget.REMASK";

    @Override
    public void onReceive(Context c, Intent i) {
        String a = i == null ? null : i.getAction();
        if (HIDE.equals(a)) { TkWidgets.hideAll(c); return; }
        if (REMASK.equals(a)) {
            // l'alarme peut arriver un peu en avance : on ne masque que si les 2 minutes sont (presque) écoulées
            long until = TkWidgets.prefs(c).getLong("vis_until", 0);
            if (until != Long.MAX_VALUE && System.currentTimeMillis() + 3000 >= until) TkWidgets.hideAll(c);
            else if (until != Long.MAX_VALUE) TkWidgets.scheduleHide(c);
        }
    }
}
