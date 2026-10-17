// Ajoute les widgets de l'écran d'accueil au manifeste généré par Capacitor (appelé par la compilation GitHub).
// Usage : node native/patch-manifest.js android/app/src/main/AndroidManifest.xml
const fs = require("fs");
const file = process.argv[2];
let x = fs.readFileSync(file, "utf8");
if (x.includes("TkWidgetSolde")) { console.log("widgets déjà présents"); process.exit(0); }

function receiver(cls, info, label, extra) {
  return `
        <receiver android:name=".${cls}" android:exported="false" android:label="@string/${label}"${extra || ""}>
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data android:name="android.appwidget.provider" android:resource="@xml/${info}" />
        </receiver>`;
}

const add =
  receiver("TkWidgetScan", "tk_info_scan", "tk_w_scan") +
  receiver("TkWidgetSolde", "tk_info_solde", "tk_w_solde") +
  receiver("TkWidgetCommun", "tk_info_commun", "tk_w_commun") +
  receiver("TkWidgetMois", "tk_info_mois", "tk_w_mois") +
  receiver("TkWidgetFoyer", "tk_info_foyer", "tk_w_foyer") +
  // Bourse : seulement dans l'appli perso (la version Store n'a pas de Bourse)
  receiver("TkWidgetBourse", "tk_info_bourse", "tk_w_bourse", ' android:enabled="@bool/tk_bourse"') + `
        <activity
            android:name=".TkWidgetConfig"
            android:exported="true"
            android:excludeFromRecents="true"
            android:taskAffinity=""
            android:theme="@android:style/Theme.DeviceDefault.NoActionBar">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_CONFIGURE" />
            </intent-filter>
        </activity>
`;

if (!x.includes("</application>")) throw new Error("manifeste sans </application>");
x = x.replace("</application>", add + "    </application>");
fs.writeFileSync(file, x);
console.log("widgets ajoutés au manifeste");
