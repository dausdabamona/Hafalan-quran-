package id.dabamona.rabth;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin lokal didaftarkan sebelum jembatan Capacitor dibuat.
        registerPlugin(PengingatAyatPlugin.class);
        registerPlugin(PusatSinkronPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
