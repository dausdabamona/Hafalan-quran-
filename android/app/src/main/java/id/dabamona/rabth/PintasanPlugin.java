package id.dabamona.rabth;

import android.content.Intent;
import android.net.Uri;
import androidx.core.content.pm.ShortcutInfoCompat;
import androidx.core.content.pm.ShortcutManagerCompat;
import androidx.core.graphics.drawable.IconCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Shortcut layar utama (K-42): ikon "Murotal" yang langsung memutar murotal semua hafalan.
// Tindakan dari shortcut disimpan sampai halaman web memintanya (saat aplikasi baru dibuka),
// atau dikirim sebagai event bila aplikasi sudah berjalan.
@CapacitorPlugin(name = "Pintasan")
public class PintasanPlugin extends Plugin {
    static final String SKEMA = "sakuhati-pintasan";
    private static String tertunda = null;

    // Dipanggil MainActivity untuk setiap intent yang masuk.
    static String tindakanDari(Intent intent) {
        if (intent == null) return null;
        Uri data = intent.getData();
        if (data == null || !SKEMA.equals(data.getScheme())) return null;
        return data.getHost();
    }

    static void simpan(String tindakan) {
        tertunda = tindakan;
    }

    void kabarkan(String tindakan) {
        JSObject isi = new JSObject();
        isi.put("tindakan", tindakan);
        notifyListeners("pintasan", isi);
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        String t = tindakanDari(intent);
        if (t != null) kabarkan(t);
    }

    @PluginMethod
    public void ambil(PluginCall call) {
        JSObject hasil = new JSObject();
        hasil.put("tindakan", tertunda);
        tertunda = null;
        call.resolve(hasil);
    }

    @PluginMethod
    public void pasangMurotal(PluginCall call) {
        if (!ShortcutManagerCompat.isRequestPinShortcutSupported(getContext())) {
            JSObject hasil = new JSObject();
            hasil.put("didukung", false);
            call.resolve(hasil);
            return;
        }
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(SKEMA + "://murotal"));
        intent.setClass(getContext(), MainActivity.class);
        ShortcutInfoCompat info = new ShortcutInfoCompat.Builder(getContext(), "murotal-layar-utama")
            .setShortLabel("Murotal")
            .setLongLabel("Putar murotal hafalan")
            .setIcon(IconCompat.createWithResource(getContext(), R.drawable.ikon_pintasan_murotal))
            .setIntent(intent)
            .build();
        boolean ok = ShortcutManagerCompat.requestPinShortcut(getContext(), info, null);
        JSObject hasil = new JSObject();
        hasil.put("didukung", true);
        hasil.put("diminta", ok);
        call.resolve(hasil);
    }
}
