package id.dabamona.sakuhati;

import android.app.AppOpsManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Process;
import android.provider.Settings;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Penghubung JavaScript ↔ pengingat ayat (K-32): izin, pengaturan, daftar ayat hafal,
 * dan tujuan layar ketika kartu "Buka di Saku Hati" diketuk.
 */
@CapacitorPlugin(name = "PengingatAyat")
public class PengingatAyatPlugin extends Plugin {

    static final String PREF = "pengingat";
    static final String BERKAS_AYAT = "ayat-hafal.json";

    static SharedPreferences pref(Context c) {
        return c.getSharedPreferences(PREF, Context.MODE_PRIVATE);
    }

    static boolean bolehOverlay(Context c) {
        return Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(c);
    }

    @SuppressWarnings("deprecation")
    static boolean bolehPenggunaan(Context c) {
        AppOpsManager ops = (AppOpsManager) c.getSystemService(Context.APP_OPS_SERVICE);
        if (ops == null) return false;
        int mode = Build.VERSION.SDK_INT >= 29
            ? ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), c.getPackageName())
            : ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), c.getPackageName());
        return mode == AppOpsManager.MODE_ALLOWED;
    }

    @PluginMethod
    public void cekIzin(PluginCall call) {
        Context c = getContext();
        JSObject hasil = new JSObject();
        hasil.put("overlay", bolehOverlay(c));
        hasil.put("penggunaan", bolehPenggunaan(c));
        SharedPreferences p = pref(c);
        hasil.put("aktif", p.getBoolean("aktif", false));
        hasil.put("jedaMenit", p.getInt("jedaMenit", 15));
        hasil.put("paket", p.getString("paket", ""));
        call.resolve(hasil);
    }

    @PluginMethod
    public void bukaSetelanOverlay(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getContext().getPackageName()));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    @PluginMethod
    public void bukaSetelanPenggunaan(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    /** Daftar ayat hafal: [{surah, ayat, nama, teks, makna, bobot}] disimpan sebagai berkas JSON. */
    @PluginMethod
    public void simpanAyat(PluginCall call) {
        JSArray daftar = call.getArray("daftar");
        if (daftar == null) {
            call.reject("daftar kosong");
            return;
        }
        File berkas = new File(getContext().getFilesDir(), BERKAS_AYAT);
        try (FileOutputStream out = new FileOutputStream(berkas)) {
            out.write(daftar.toString().getBytes(StandardCharsets.UTF_8));
            JSObject hasil = new JSObject();
            hasil.put("jumlah", daftar.length());
            call.resolve(hasil);
        } catch (Exception e) {
            call.reject("Gagal menyimpan daftar ayat", e);
        }
    }

    @PluginMethod
    public void atur(PluginCall call) {
        Context c = getContext();
        boolean aktif = Boolean.TRUE.equals(call.getBoolean("aktif", false));
        int jeda = call.getInt("jedaMenit", 15);
        String paket = call.getString("paket", "");
        pref(c).edit().putBoolean("aktif", aktif).putInt("jedaMenit", jeda).putString("paket", paket).apply();
        Intent i = new Intent(c, LayananPengingat.class);
        if (aktif) ContextCompat.startForegroundService(c, i);
        else c.stopService(i);
        call.resolve();
    }

    /** Menampilkan satu kartu sekarang juga, untuk mencoba tampilan. */
    @PluginMethod
    public void coba(PluginCall call) {
        Context c = getContext();
        if (!bolehOverlay(c)) {
            call.reject("Izin tampil di atas aplikasi lain belum diberikan");
            return;
        }
        Intent i = new Intent(c, LayananPengingat.class);
        i.setAction(LayananPengingat.AKSI_COBA);
        ContextCompat.startForegroundService(c, i);
        call.resolve();
    }

    /** Tujuan layar dari kartu ("#/surah/S/A"), lalu dihapus. */
    @PluginMethod
    public void ambilTujuan(PluginCall call) {
        SharedPreferences p = pref(getContext());
        String tujuan = p.getString("tujuan", "");
        p.edit().remove("tujuan").apply();
        JSObject hasil = new JSObject();
        hasil.put("tujuan", tujuan);
        call.resolve(hasil);
    }
}
