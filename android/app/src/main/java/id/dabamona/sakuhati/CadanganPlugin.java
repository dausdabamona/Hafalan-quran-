package id.dabamona.sakuhati;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

// Cadangan ke berkas (K-67). Isi cadangan dikirim dari halaman web sepotong demi sepotong ke
// berkas sementara, lalu Firdaus memilih tempat simpannya lewat pemilih berkas bawaan Android
// (Storage Access Framework) — tanpa izin penyimpanan tambahan.
@CapacitorPlugin(name = "Cadangan")
public class CadanganPlugin extends Plugin {
    private File sementara() {
        return new File(getContext().getCacheDir(), "cadangan-sementara.json");
    }

    @PluginMethod
    public void mulai(PluginCall call) {
        try (FileOutputStream out = new FileOutputStream(sementara(), false)) {
            call.resolve();
        } catch (Exception e) {
            call.reject("Berkas sementara tidak bisa dibuat: " + e.getMessage());
        }
    }

    @PluginMethod
    public void tambah(PluginCall call) {
        String teks = call.getString("teks", "");
        try (FileOutputStream out = new FileOutputStream(sementara(), true)) {
            out.write(teks.getBytes(StandardCharsets.UTF_8));
            call.resolve();
        } catch (Exception e) {
            call.reject("Cadangan gagal ditulis: " + e.getMessage());
        }
    }

    @PluginMethod
    public void selesai(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        intent.putExtra(Intent.EXTRA_TITLE, call.getString("nama", "saku-hati-cadangan.json"));
        startActivityForResult(call, intent, "hasilSimpan");
    }

    @ActivityCallback
    private void hasilSimpan(PluginCall call, ActivityResult hasil) {
        if (call == null) return;
        JSObject jawab = new JSObject();
        Uri tujuan = hasil.getData() == null ? null : hasil.getData().getData();
        if (hasil.getResultCode() != Activity.RESULT_OK || tujuan == null) {
            sementara().delete();
            jawab.put("tersimpan", false);
            call.resolve(jawab);
            return;
        }
        try (InputStream in = new FileInputStream(sementara());
             OutputStream out = getContext().getContentResolver().openOutputStream(tujuan, "wt")) {
            if (out == null) throw new Exception("tujuan tidak bisa dibuka");
            byte[] buf = new byte[64 * 1024];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            jawab.put("tersimpan", true);
            call.resolve(jawab);
        } catch (Exception e) {
            call.reject("Cadangan gagal disimpan: " + e.getMessage());
        } finally {
            sementara().delete();
        }
    }
}
