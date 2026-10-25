package id.dabamona.sakuhati;

import com.getcapacitor.BridgeActivity;

// Versi GitHub (K-56): lengkap, termasuk Pengingat ayat (K-32).
final class PluginSaluran {
    private PluginSaluran() {}

    static void daftar(BridgeActivity a) {
        a.registerPlugin(PengingatAyatPlugin.class);
    }
}
