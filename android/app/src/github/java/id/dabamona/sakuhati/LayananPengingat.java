package id.dabamona.sakuhati;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import androidx.core.app.NotificationCompat;
import java.io.File;
import java.io.FileInputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Pengingat ayat (K-32). Layanan latar depan yang memantau aplikasi yang sedang dibuka
 * (izin Akses penggunaan). Bila yang dibuka adalah aplikasi pemicu (Facebook, YouTube,
 * Instagram, Chrome, TikTok) dan jeda minimal sudah lewat, satu kartu ayat hafalan tampil
 * di atas aplikasi itu (izin Tampil di atas aplikasi lain). Pemantauan berhenti saat layar mati.
 *
 * K-87: lama pemakaian aplikasi pemicu dihitung. Sesudah batas pertama (batasMenit) tampil kartu
 * teguran, lalu diulang tiap ulangMenit selama masih di aplikasi pemicu. Hitungan digabung untuk
 * semua aplikasi pemicu dan berlanjut bila kembali dalam 2 menit.
 */
public class LayananPengingat extends Service {

    static final String AKSI_COBA = "id.dabamona.sakuhati.COBA_KARTU";
    static final String EKSTRA_TEGURAN = "teguran";
    private static final long JEDA_LANJUT_MS = 120_000;
    private static final Map<String, String> NAMA_APLIKASI = new HashMap<>();

    static {
        NAMA_APLIKASI.put("com.facebook.katana", "Facebook");
        NAMA_APLIKASI.put("com.facebook.lite", "Facebook");
        NAMA_APLIKASI.put("com.google.android.youtube", "YouTube");
        NAMA_APLIKASI.put("com.instagram.android", "Instagram");
        NAMA_APLIKASI.put("com.android.chrome", "Chrome");
        NAMA_APLIKASI.put("com.zhiliaoapp.musically", "TikTok");
        NAMA_APLIKASI.put("com.ss.android.ugc.trill", "TikTok");
        NAMA_APLIKASI.put("com.zhiliaoapp.musically.go", "TikTok");
        NAMA_APLIKASI.put("com.anthropic.claude", "Claude");
    }
    private static final String KANAL = "pengingat-ayat";
    private static final int ID_NOTIFIKASI = 3201;
    private static final long SELANG_PANTAU_MS = 2000;
    private static final long LAMA_KARTU_MS = 45000;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Random acak = new Random();
    private String paketKini = "";
    private View kartu;
    private String kunciTerakhir = "";

    // K-87: hitungan lama pemakaian aplikasi pemicu.
    private long putaranTerakhir = 0;
    private boolean diPemicuTadi = false;
    private long keluarPemicu = 0;
    private long dipakaiMs = 0;
    private long teguranBerikutMs = 0;

    private final Runnable pantau = new Runnable() {
        @Override
        public void run() {
            try {
                periksa();
            } catch (Exception ignored) {
                // Pemantauan diteruskan pada putaran berikutnya.
            }
            handler.postDelayed(this, SELANG_PANTAU_MS);
        }
    };

    private final Runnable tutupOtomatis = this::tutupKartu;

    @Override
    public void onCreate() {
        super.onCreate();
        mulaiLatarDepan();
        handler.post(pantau);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        mulaiLatarDepan();
        if (intent != null && AKSI_COBA.equals(intent.getAction())) {
            tampilkanKartu(intent.getBooleanExtra(EKSTRA_TEGURAN, false) ? "Contoh: sudah 10 menit di YouTube" : null);
        }
        if (!PengingatAyatPlugin.pref(this).getBoolean("aktif", false) && kartu == null && intent != null
            && !AKSI_COBA.equals(intent.getAction())) {
            stopSelf();
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        tutupKartu();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    // ---------- Notifikasi layanan ----------

    private void mulaiLatarDepan() {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm != null) {
            NotificationChannel ch = new NotificationChannel(KANAL, "Pengingat ayat", NotificationManager.IMPORTANCE_MIN);
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
        Intent buka = new Intent(this, MainActivity.class);
        buka.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, 0, buka, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification n = new NotificationCompat.Builder(this, KANAL)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Pengingat ayat aktif")
            .setContentText("Saku Hati mengingatkan dengan ayat hafalan saat memakai media sosial")
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setOngoing(true)
            .setContentIntent(pi)
            .build();
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(ID_NOTIFIKASI, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(ID_NOTIFIKASI, n);
        }
    }

    // ---------- Pemantauan aplikasi yang dibuka ----------

    private void periksa() {
        SharedPreferences p = PengingatAyatPlugin.pref(this);
        long sekarang = System.currentTimeMillis();
        // Selang dibatasi agar waktu saat pemantauan terhenti (layar mati, layanan tertunda) tidak ikut terhitung.
        long selang = Math.min(Math.max(0, sekarang - putaranTerakhir), 10_000);
        putaranTerakhir = sekarang;
        if (!p.getBoolean("aktif", false)) return;
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        if (pm != null && !pm.isInteractive()) {
            tinggalkanPemicu(sekarang);
            paketKini = "";
            return;
        }
        if (!PengingatAyatPlugin.bolehPenggunaan(this) || !PengingatAyatPlugin.bolehOverlay(this)) return;

        String baru = aplikasiTerdepan();
        boolean pindah = baru != null && !baru.equals(paketKini);
        if (pindah) paketKini = baru;

        Set<String> pemicu = new HashSet<>(Arrays.asList(p.getString("paket", "").split(",")));
        if (!pemicu.contains(paketKini)) {
            tinggalkanPemicu(sekarang);
            return;
        }

        int batas = p.getInt("batasMenit", 10);
        if (!diPemicuTadi) {
            // Kembali dalam 2 menit: hitungan berlanjut. Lebih lama: mulai dari nol.
            if (sekarang - keluarPemicu > JEDA_LANJUT_MS) {
                dipakaiMs = 0;
                teguranBerikutMs = batas * 60_000L;
            }
            diPemicuTadi = true;
        } else {
            dipakaiMs += selang;
        }

        // K-32: kartu saat aplikasi pemicu baru dibuka.
        if (pindah && p.getBoolean("kartuBuka", true)) {
            long jeda = p.getInt("jedaMenit", 15) * 60_000L;
            if (sekarang - p.getLong("terakhirTampil", 0) >= jeda) {
                tampilkanKartu(null);
                return;
            }
        }

        // K-87: teguran sesudah batas, diulang tiap ulangMenit.
        if (batas > 0 && dipakaiMs >= teguranBerikutMs && kartu == null) {
            int ulang = Math.max(1, p.getInt("ulangMenit", 5));
            teguranBerikutMs = dipakaiMs + ulang * 60_000L;
            long menit = Math.max(1, Math.round(dipakaiMs / 60_000.0));
            String nama = NAMA_APLIKASI.containsKey(paketKini) ? NAMA_APLIKASI.get(paketKini) : "aplikasi ini";
            tampilkanKartu("Sudah " + menit + " menit di " + nama);
        }
    }

    private void tinggalkanPemicu(long sekarang) {
        if (!diPemicuTadi) return;
        diPemicuTadi = false;
        keluarPemicu = sekarang;
    }

    /** Paket aplikasi yang terakhir masuk ke depan dalam 30 detik terakhir. */
    private String aplikasiTerdepan() {
        UsageStatsManager usm = (UsageStatsManager) getSystemService(Context.USAGE_STATS_SERVICE);
        if (usm == null) return null;
        long sekarang = System.currentTimeMillis();
        UsageEvents events = usm.queryEvents(sekarang - 30_000, sekarang);
        UsageEvents.Event e = new UsageEvents.Event();
        String hasil = null;
        while (events.hasNextEvent()) {
            events.getNextEvent(e);
            // 1 = MOVE_TO_FOREGROUND / ACTIVITY_RESUMED
            if (e.getEventType() == 1) hasil = e.getPackageName();
        }
        return hasil;
    }

    // ---------- Kartu ayat ----------

    private JSONObject pilihAyat() {
        try {
            File berkas = new File(getFilesDir(), PengingatAyatPlugin.BERKAS_AYAT);
            if (!berkas.exists()) return null;
            byte[] isi = new byte[(int) berkas.length()];
            try (FileInputStream in = new FileInputStream(berkas)) {
                int dibaca = 0;
                while (dibaca < isi.length) {
                    int n = in.read(isi, dibaca, isi.length - dibaca);
                    if (n < 0) break;
                    dibaca += n;
                }
            }
            JSONArray daftar = new JSONArray(new String(isi, StandardCharsets.UTF_8));
            if (daftar.length() == 0) return null;
            // Acak berbobot: ayat yang pernah salah lebih sering muncul. Hindari ayat yang sama berturut-turut.
            int total = 0;
            for (int i = 0; i < daftar.length(); i++) total += Math.max(1, daftar.getJSONObject(i).optInt("bobot", 1));
            for (int coba = 0; coba < 5; coba++) {
                int r = acak.nextInt(total);
                for (int i = 0; i < daftar.length(); i++) {
                    JSONObject o = daftar.getJSONObject(i);
                    r -= Math.max(1, o.optInt("bobot", 1));
                    if (r < 0) {
                        String kunci = o.optInt("surah") + ":" + o.optInt("ayat");
                        if (!kunci.equals(kunciTerakhir) || daftar.length() == 1) {
                            kunciTerakhir = kunci;
                            return o;
                        }
                        break;
                    }
                }
            }
            return daftar.getJSONObject(0);
        } catch (Exception e) {
            return null;
        }
    }

    private int dp(float n) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, n, getResources().getDisplayMetrics()));
    }

    /** teguran null = kartu biasa (K-32); berisi teks = kartu teguran batas pemakaian (K-87). */
    private void tampilkanKartu(String teguran) {
        if (!PengingatAyatPlugin.bolehOverlay(this)) return;
        JSONObject ayat = pilihAyat();
        if (ayat == null) return;
        tutupKartu();
        PengingatAyatPlugin.pref(this).edit().putLong("terakhirTampil", System.currentTimeMillis()).apply();

        final int surah = ayat.optInt("surah");
        final int nomor = ayat.optInt("ayat");
        int teal = Color.parseColor("#146B38");

        LinearLayout isi = new LinearLayout(this);
        isi.setOrientation(LinearLayout.VERTICAL);
        isi.setPadding(dp(16), dp(12), dp(16), dp(10));
        GradientDrawable latar = new GradientDrawable();
        latar.setColor(Color.parseColor("#FFFDF7"));
        latar.setCornerRadius(dp(16));
        latar.setStroke(dp(2), teal);
        isi.setBackground(latar);
        isi.setElevation(dp(8));

        if (teguran != null) {
            TextView tegur = new TextView(this);
            tegur.setText(teguran);
            tegur.setTextColor(Color.parseColor("#8A4B00"));
            tegur.setTextSize(TypedValue.COMPLEX_UNIT_SP, 17);
            tegur.setTypeface(Typeface.DEFAULT_BOLD);
            tegur.setPadding(0, 0, 0, dp(4));
            isi.addView(tegur);
        }

        TextView judul = new TextView(this);
        judul.setText("Saku Hati · " + ayat.optString("nama") + " · ayat " + nomor);
        judul.setTextColor(teal);
        judul.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        judul.setTypeface(Typeface.DEFAULT_BOLD);
        isi.addView(judul);

        LinearLayout gulirIsi = new LinearLayout(this);
        gulirIsi.setOrientation(LinearLayout.VERTICAL);

        TextView arab = new TextView(this);
        arab.setText(ayat.optString("teks"));
        try {
            arab.setTypeface(Typeface.createFromAsset(getAssets(), "fonts/AmiriQuran.ttf"));
        } catch (Exception ignored) {
            // huruf bawaan HP
        }
        arab.setTextSize(TypedValue.COMPLEX_UNIT_SP, 26);
        arab.setTextColor(Color.parseColor("#1F2A28"));
        arab.setTextDirection(View.TEXT_DIRECTION_RTL);
        arab.setGravity(Gravity.END);
        arab.setLineSpacing(0, 1.25f);
        arab.setPadding(0, dp(8), 0, dp(6));
        gulirIsi.addView(arab);

        TextView makna = new TextView(this);
        makna.setText(ayat.optString("makna"));
        makna.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        makna.setTextColor(Color.parseColor("#3D4A47"));
        makna.setLineSpacing(0, 1.2f);
        gulirIsi.addView(makna);

        // Ayat panjang digulir di dalam kartu agar kartu tidak menutupi seluruh layar.
        final int tinggiMaks = (int) (getResources().getDisplayMetrics().heightPixels * 0.45f);
        ScrollView gulir = new ScrollView(this) {
            @Override
            protected void onMeasure(int lebar, int tinggi) {
                super.onMeasure(lebar, MeasureSpec.makeMeasureSpec(tinggiMaks, MeasureSpec.AT_MOST));
            }
        };
        gulir.addView(gulirIsi);
        isi.addView(gulir);

        LinearLayout tombol = new LinearLayout(this);
        tombol.setOrientation(LinearLayout.HORIZONTAL);
        tombol.setGravity(Gravity.END);
        tombol.setPadding(0, dp(6), 0, 0);

        Button tutup = new Button(this);
        int ulang = Math.max(1, PengingatAyatPlugin.pref(this).getInt("ulangMenit", 5));
        tutup.setText(teguran != null ? ulang + " menit lagi" : "Tutup");
        tutup.setAllCaps(false);
        tutup.setTextColor(teal);
        tutup.setBackgroundColor(Color.TRANSPARENT);
        tutup.setOnClickListener(v -> tutupKartu());
        tombol.addView(tutup);

        Button utama = new Button(this);
        utama.setText(teguran != null ? "Cukup, keluar" : "Buka di Saku Hati");
        utama.setAllCaps(false);
        utama.setTextColor(Color.WHITE);
        GradientDrawable latarUtama = new GradientDrawable();
        latarUtama.setColor(teal);
        latarUtama.setCornerRadius(dp(10));
        utama.setBackground(latarUtama);
        utama.setPadding(dp(14), 0, dp(14), 0);
        if (teguran != null) {
            // Kembali ke layar utama HP. Hitungan tetap berlanjut bila aplikasi dibuka lagi dalam 2 menit.
            utama.setOnClickListener(v -> {
                tutupKartu();
                Intent rumah = new Intent(Intent.ACTION_MAIN);
                rumah.addCategory(Intent.CATEGORY_HOME);
                rumah.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                try {
                    startActivity(rumah);
                } catch (Exception ignored) {
                    // tidak ada peluncur
                }
            });
        } else {
            utama.setOnClickListener(v -> {
                PengingatAyatPlugin.pref(this).edit().putString("tujuan", "#/surah/" + surah + "/" + nomor).apply();
                tutupKartu();
                Intent i = new Intent(this, MainActivity.class);
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
                startActivity(i);
            });
        }
        tombol.addView(utama);
        isi.addView(tombol);

        FrameLayout bingkai = new FrameLayout(this);
        bingkai.setPadding(dp(12), 0, dp(12), 0);
        bingkai.addView(isi, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        int jenis = Build.VERSION.SDK_INT >= 26
            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            : WindowManager.LayoutParams.TYPE_PHONE;
        WindowManager.LayoutParams lp = new WindowManager.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
            jenis,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
            PixelFormat.TRANSLUCENT
        );
        lp.gravity = Gravity.TOP;
        lp.y = dp(56);

        WindowManager wm = (WindowManager) getSystemService(WINDOW_SERVICE);
        if (wm == null) return;
        try {
            wm.addView(bingkai, lp);
            kartu = bingkai;
            handler.removeCallbacks(tutupOtomatis);
            handler.postDelayed(tutupOtomatis, LAMA_KARTU_MS);
        } catch (Exception ignored) {
            kartu = null;
        }
    }

    private void tutupKartu() {
        if (kartu == null) return;
        WindowManager wm = (WindowManager) getSystemService(WINDOW_SERVICE);
        try {
            if (wm != null) wm.removeView(kartu);
        } catch (Exception ignored) {
            // sudah tertutup
        }
        kartu = null;
        handler.removeCallbacks(tutupOtomatis);
    }
}
