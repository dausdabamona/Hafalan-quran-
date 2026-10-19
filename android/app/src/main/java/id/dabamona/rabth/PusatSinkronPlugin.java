package id.dabamona.rabth;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Pusat sinkron di HP (K-37). Server HTTP kecil di jaringan Wi-Fi. Setiap permintaan diteruskan
 * ke JavaScript (event "permintaan") karena seluruh data ada di IndexedDB WebView; jawabannya
 * dikembalikan lewat jawab(). Server ini hanya berjalan selama aplikasi hidup.
 */
@CapacitorPlugin(name = "PusatSinkron")
public class PusatSinkronPlugin extends Plugin {

    private static final int BATAS_ISI = 64 * 1024 * 1024;
    private static final long BATAS_TUNGGU_DETIK = 120;

    private ServerSocket server;
    private ExecutorService pekerja;
    private final AtomicLong nomor = new AtomicLong();
    private final Map<String, CompletableFuture<JSObject>> menunggu = new ConcurrentHashMap<>();

    @PluginMethod
    public void mulai(PluginCall call) {
        int portAwal = call.getInt("port", 47310);
        try {
            if (server == null || server.isClosed()) {
                server = bukaServer(portAwal);
                pekerja = Executors.newCachedThreadPool();
                final ServerSocket s = server;
                pekerja.execute(() -> terimaSambungan(s));
            }
            JSObject hasil = new JSObject();
            hasil.put("alamat", alamatWifi());
            hasil.put("port", server.getLocalPort());
            call.resolve(hasil);
        } catch (Exception e) {
            call.reject("Pusat sinkron gagal dinyalakan: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void berhenti(PluginCall call) {
        tutup();
        call.resolve();
    }

    @PluginMethod
    public void alamat(PluginCall call) {
        JSObject hasil = new JSObject();
        hasil.put("alamat", alamatWifi());
        hasil.put("port", server != null && !server.isClosed() ? server.getLocalPort() : 0);
        call.resolve(hasil);
    }

    /** Jawaban JavaScript untuk satu permintaan: {id, status, isi}. */
    @PluginMethod
    public void jawab(PluginCall call) {
        String id = call.getString("id", "");
        CompletableFuture<JSObject> f = menunggu.remove(id);
        if (f != null) {
            JSObject j = new JSObject();
            j.put("status", call.getInt("status", 200));
            j.put("isi", call.getString("isi", "{}"));
            f.complete(j);
        }
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        tutup();
        super.handleOnDestroy();
    }

    // ---------- Server ----------

    private ServerSocket bukaServer(int portAwal) throws Exception {
        Exception terakhir = null;
        for (int p = portAwal; p < portAwal + 10; p++) {
            try {
                ServerSocket s = new ServerSocket();
                s.setReuseAddress(true);
                s.bind(new InetSocketAddress(p));
                return s;
            } catch (Exception e) {
                terakhir = e;
            }
        }
        throw terakhir != null ? terakhir : new Exception("port tidak tersedia");
    }

    private void tutup() {
        try {
            if (server != null) server.close();
        } catch (Exception ignored) {
            // sudah tertutup
        }
        server = null;
        if (pekerja != null) pekerja.shutdownNow();
        pekerja = null;
        for (CompletableFuture<JSObject> f : menunggu.values()) f.cancel(true);
        menunggu.clear();
    }

    private void terimaSambungan(ServerSocket s) {
        while (!s.isClosed()) {
            try {
                Socket soket = s.accept();
                ExecutorService p = pekerja;
                if (p != null) p.execute(() -> layani(soket));
                else soket.close();
            } catch (Exception e) {
                if (s.isClosed()) return;
            }
        }
    }

    private void layani(Socket soket) {
        try (Socket so = soket) {
            so.setSoTimeout(60_000);
            InputStream in = new BufferedInputStream(so.getInputStream());
            String barisAwal = bacaBaris(in);
            if (barisAwal == null) return;
            String[] bagian = barisAwal.split(" ");
            if (bagian.length < 2) return;
            String metode = bagian[0];
            String jalur = bagian[1];
            int panjang = 0;
            String baris;
            while ((baris = bacaBaris(in)) != null && !baris.isEmpty()) {
                int t = baris.indexOf(':');
                if (t > 0 && baris.substring(0, t).trim().toLowerCase(Locale.ROOT).equals("content-length")) {
                    panjang = Integer.parseInt(baris.substring(t + 1).trim());
                }
            }
            if (panjang > BATAS_ISI) {
                kirim(so.getOutputStream(), 413, "{\"pesan\":\"Isi terlalu besar\"}");
                return;
            }
            byte[] isi = new byte[panjang];
            int dibaca = 0;
            while (dibaca < panjang) {
                int n = in.read(isi, dibaca, panjang - dibaca);
                if (n < 0) break;
                dibaca += n;
            }
            if ("OPTIONS".equals(metode)) {
                kirim(so.getOutputStream(), 204, "");
                return;
            }

            String id = String.valueOf(nomor.incrementAndGet());
            CompletableFuture<JSObject> f = new CompletableFuture<>();
            menunggu.put(id, f);
            JSObject data = new JSObject();
            data.put("id", id);
            data.put("jalur", jalur);
            data.put("isi", panjang > 0 ? new String(isi, 0, dibaca, StandardCharsets.UTF_8) : "{}");
            notifyListeners("permintaan", data);

            JSObject j;
            try {
                j = f.get(BATAS_TUNGGU_DETIK, TimeUnit.SECONDS);
            } catch (Exception e) {
                menunggu.remove(id);
                kirim(so.getOutputStream(), 503, "{\"pesan\":\"Saku Hati di HP sedang tidak aktif. Buka aplikasinya.\"}");
                return;
            }
            kirim(so.getOutputStream(), j.getInteger("status", 200), j.getString("isi", "{}"));
        } catch (Exception ignored) {
            // sambungan terputus
        }
    }

    private static String bacaBaris(InputStream in) throws Exception {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        int c;
        while ((c = in.read()) != -1) {
            if (c == '\n') break;
            if (c != '\r') b.write(c);
            if (b.size() > 16 * 1024) break;
        }
        if (c == -1 && b.size() == 0) return null;
        return b.toString("UTF-8");
    }

    private static void kirim(OutputStream out, int status, String isi) throws Exception {
        byte[] bait = isi.getBytes(StandardCharsets.UTF_8);
        String kepala = "HTTP/1.1 " + status + " " + (status < 300 ? "OK" : "Galat") + "\r\n"
            + "Content-Type: application/json; charset=utf-8\r\n"
            + "Access-Control-Allow-Origin: *\r\n"
            + "Access-Control-Allow-Headers: Content-Type\r\n"
            + "Content-Length: " + bait.length + "\r\n"
            + "Connection: close\r\n\r\n";
        out.write(kepala.getBytes(StandardCharsets.UTF_8));
        out.write(bait);
        out.flush();
    }

    /** Alamat IPv4 HP di jaringan Wi-Fi (atau jaringan lokal lain bila Wi-Fi tidak ada). */
    static String alamatWifi() {
        String cadangan = "";
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                for (InetAddress a : Collections.list(ni.getInetAddresses())) {
                    if (!(a instanceof Inet4Address) || a.isLoopbackAddress()) continue;
                    String ip = a.getHostAddress();
                    String nama = ni.getName().toLowerCase(Locale.ROOT);
                    if (nama.startsWith("wlan") || nama.startsWith("ap") || nama.startsWith("swlan")) return ip;
                    if (a.isSiteLocalAddress() && cadangan.isEmpty()) cadangan = ip;
                }
            }
        } catch (Exception ignored) {
            // tidak ada jaringan
        }
        return cadangan;
    }
}
