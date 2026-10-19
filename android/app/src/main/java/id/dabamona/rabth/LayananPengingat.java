package id.dabamona.rabth;

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
import java.util.HashSet;
import java.util.Random;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Pengingat ayat (K-32). Layanan latar depan yang memantau aplikasi yang sedang dibuka
 * (izin Akses penggunaan). Bila yang dibuka adalah aplikasi pemicu (Facebook, YouTube,
 * Instagram, Chrome, TikTok) dan jeda minimal sudah lewat, satu kartu ayat hafalan tampil
 * di atas aplikasi itu (izin Tampil di atas aplikasi lain). Pemantauan berhenti saat layar mati.
 */
public class LayananPengingat extends Service {

    static final String AKSI_COBA = "id.dabamona.rabth.COBA_KARTU";
    private static final String KANAL = "pengingat-ayat";
    private static final int ID_NOTIFIKASI = 3201;
    private static final long SELANG_PANTAU_MS = 2000;
    private static final long LAMA_KARTU_MS = 45000;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Random acak = new Random();
    private String paketKini = "";
    private View kartu;
    private String kunciTerakhir = "";

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
        if (intent != null && AKSI_COBA.equals(intent.getAction())) tampilkanKartu();
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
            .setContentText("Saku Hati menampilkan ayat hafalan saat membuka media sosial")
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
        if (!p.getBoolean("aktif", false)) return;
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        if (pm != null && !pm.isInteractive()) return;
        if (!PengingatAyatPlugin.bolehPenggunaan(this) || !PengingatAyatPlugin.bolehOverlay(this)) return;

        String paket = aplikasiTerdepan();
        if (paket == null || paket.equals(paketKini)) return;
        paketKini = paket;

        Set<String> pemicu = new HashSet<>(Arrays.asList(p.getString("paket", "").split(",")));
        if (!pemicu.contains(paket)) return;
        long sekarang = System.currentTimeMillis();
        long jeda = p.getInt("jedaMenit", 15) * 60_000L;
        if (sekarang - p.getLong("terakhirTampil", 0) < jeda) return;
        tampilkanKartu();
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

    private void tampilkanKartu() {
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
        tutup.setText("Tutup");
        tutup.setAllCaps(false);
        tutup.setTextColor(teal);
        tutup.setBackgroundColor(Color.TRANSPARENT);
        tutup.setOnClickListener(v -> tutupKartu());
        tombol.addView(tutup);

        Button buka = new Button(this);
        buka.setText("Buka di Saku Hati");
        buka.setAllCaps(false);
        buka.setTextColor(Color.WHITE);
        GradientDrawable latarBuka = new GradientDrawable();
        latarBuka.setColor(teal);
        latarBuka.setCornerRadius(dp(10));
        buka.setBackground(latarBuka);
        buka.setPadding(dp(14), 0, dp(14), 0);
        buka.setOnClickListener(v -> {
            PengingatAyatPlugin.pref(this).edit().putString("tujuan", "#/surah/" + surah + "/" + nomor).apply();
            tutupKartu();
            Intent i = new Intent(this, MainActivity.class);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
            startActivity(i);
        });
        tombol.addView(buka);
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
