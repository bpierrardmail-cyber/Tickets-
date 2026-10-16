package fr.bpierrard.tickets.beta;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Point;
import android.graphics.Rect;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

/**
 * Lecture d'un ticket de caisse avec ML Kit (modèle latin intégré, hors ligne).
 * Entrée : { image: "<jpeg en base64>" }
 * Sortie : { text, width, height, lines: [{ t, p:[x0,y0,x1,y1,x2,y2,x3,y3] }] }
 * Les coins de chaque ligne servent à reconstituer les lignes du ticket
 * (libellé à gauche, prix à droite) côté appli.
 */
@CapacitorPlugin(name = "TicketOcr")
public class TicketOcrPlugin extends Plugin {

    private TextRecognizer recognizer;

    private TextRecognizer getRecognizer() {
        if (recognizer == null) {
            recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        }
        return recognizer;
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", true);
        ret.put("engine", "mlkit");
        call.resolve(ret);
    }

    @PluginMethod
    public void recognize(final PluginCall call) {
        String data = call.getString("image");
        if (data == null || data.isEmpty()) {
            call.reject("Image manquante");
            return;
        }
        int comma = data.indexOf(',');
        if (data.startsWith("data:") && comma > 0) {
            data = data.substring(comma + 1);
        }
        final Bitmap bmp;
        try {
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
        } catch (Exception e) {
            call.reject("Image illisible", e);
            return;
        }
        if (bmp == null) {
            call.reject("Image illisible");
            return;
        }
        InputImage image = InputImage.fromBitmap(bmp, 0);
        getRecognizer().process(image)
            .addOnSuccessListener(result -> {
                JSArray lines = new JSArray();
                for (Text.TextBlock block : result.getTextBlocks()) {
                    for (Text.Line line : block.getLines()) {
                        JSObject o = new JSObject();
                        o.put("t", line.getText());
                        JSArray p = new JSArray();
                        Point[] pts = line.getCornerPoints();
                        if (pts != null && pts.length == 4) {
                            for (Point pt : pts) { p.put(pt.x); p.put(pt.y); }
                        } else {
                            Rect r = line.getBoundingBox();
                            if (r != null) {
                                p.put(r.left); p.put(r.top); p.put(r.right); p.put(r.top);
                                p.put(r.right); p.put(r.bottom); p.put(r.left); p.put(r.bottom);
                            }
                        }
                        o.put("p", p);
                        lines.put(o);
                    }
                }
                JSObject ret = new JSObject();
                ret.put("text", result.getText());
                ret.put("width", bmp.getWidth());
                ret.put("height", bmp.getHeight());
                ret.put("lines", lines);
                call.resolve(ret);
            })
            .addOnFailureListener(e -> call.reject("ML Kit : " + e.getMessage(), e));
    }
}
