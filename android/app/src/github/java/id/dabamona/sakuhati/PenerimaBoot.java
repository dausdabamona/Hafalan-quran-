package id.dabamona.sakuhati;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import androidx.core.content.ContextCompat;

/** Menyalakan kembali pengingat ayat setelah HP dinyalakan ulang bila sedang aktif. */
public class PenerimaBoot extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent intent) {
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;
        if (!PengingatAyatPlugin.pref(c).getBoolean("aktif", false)) return;
        try {
            ContextCompat.startForegroundService(c, new Intent(c, LayananPengingat.class));
        } catch (Exception ignored) {
            // Sebagian ROM menolak; pengingat menyala lagi saat aplikasi dibuka.
        }
    }
}
