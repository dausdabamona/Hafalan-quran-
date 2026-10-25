package id.dabamona.rabth;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin lokal didaftarkan sebelum jembatan Capacitor dibuat.
        registerPlugin(PengingatAyatPlugin.class);
        registerPlugin(PusatSinkronPlugin.class);
        registerPlugin(PintasanPlugin.class);
        registerPlugin(CadanganPlugin.class);
        // Aplikasi dibuka dari shortcut Murotal (K-42): tindakan disimpan sampai halaman siap.
        String t = PintasanPlugin.tindakanDari(getIntent());
        if (t != null) PintasanPlugin.simpan(t);
        super.onCreate(savedInstanceState);
    }
}
