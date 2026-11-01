// Saku Hati untuk Windows (K-37). Membungkus aplikasi web yang sama dengan APK.
// Halaman dimuat lewat skema app:// agar asal (origin) tetap sama di setiap
// pembukaan — penting karena seluruh data tersimpan di IndexedDB asal tersebut.
const { app, BrowserWindow, ipcMain, Menu, net, protocol, session, shell } = require('electron');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const AKAR = path.join(__dirname, 'app');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

let jendela = null;

function buatJendela() {
  jendela = new BrowserWindow({
    width: 900,
    height: 940,
    minWidth: 380,
    minHeight: 600,
    title: 'Saku Hati',
    backgroundColor: '#fbf8f1',
    icon: path.join(__dirname, 'app', 'ikon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
      // Murotal tetap berputar saat jendela diperkecil.
      backgroundThrottling: false,
    },
  });
  jendela.loadURL('app://saku-hati/index.html');

  // Tautan luar (mis. tanzil.net di halaman Tentang) dibuka di peramban biasa.
  jendela.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });
  jendela.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('app://')) {
      e.preventDefault();
      if (url.startsWith('http')) shell.openExternal(url);
    }
  });
}

app.on('second-instance', () => {
  if (jendela) {
    if (jendela.isMinimized()) jendela.restore();
    jendela.focus();
  }
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);

  protocol.handle('app', (req) => {
    const { pathname } = new URL(req.url);
    const berkas = path.normalize(path.join(AKAR, decodeURIComponent(pathname)));
    if (!berkas.startsWith(AKAR)) return new Response('Tidak ditemukan', { status: 404 });
    return net.fetch(pathToFileURL(berkas).toString());
  });

  // Mikrofon (rekam murojaah) dan kamera (pindai kode QR pemasangan) diizinkan.
  const izin = new Set(['media', 'mediaKeySystem', 'clipboard-sanitized-write']);
  session.defaultSession.setPermissionRequestHandler((_wc, jenis, jawab) => jawab(izin.has(jenis)));
  session.defaultSession.setPermissionCheckHandler((_wc, jenis) => izin.has(jenis));

  buatJendela();
  nyalakanPintuMcp();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) buatJendela();
  });
});

app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => matikanPintuMcp());

// ---------- Sinkron dengan HP (K-37) ----------

// Hanya alamat jaringan lokal yang boleh dihubungi.
function alamatLokal(alamat) {
  const host = String(alamat).split(':')[0];
  return /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/.test(host);
}

async function minta(alamat, jalur, isi, batasMs = 120000) {
  if (!alamatLokal(alamat)) throw new Error('Alamat HP harus di jaringan Wi-Fi lokal.');
  const r = await fetch(`http://${alamat}${jalur}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(isi ?? {}),
    signal: AbortSignal.timeout(batasMs),
  });
  return { status: r.status, teks: await r.text() };
}

ipcMain.handle('saku:minta', async (_e, { alamat, jalur, isi }) => {
  try {
    return await minta(alamat, jalur, isi);
  } catch (e) {
    return { status: 0, teks: JSON.stringify({ pesan: String(e && e.message ? e.message : e) }) };
  }
});

ipcMain.handle('saku:nama-komputer', () => os.hostname());

// Mencari HP pasangan di jaringan yang sama bila alamatnya berubah: semua alamat /24
// di setiap kartu jaringan dicoba dengan /halo, lalu dicocokkan id pusatnya.
ipcMain.handle('saku:cari-pusat', async (_e, { port, idPusat }) => {
  const awalan = new Set();
  for (const daftar of Object.values(os.networkInterfaces())) {
    for (const a of daftar || []) {
      if (a.family === 'IPv4' && !a.internal && alamatLokal(a.address)) {
        awalan.add(a.address.split('.').slice(0, 3).join('.'));
      }
    }
  }
  for (const pre of awalan) {
    const calon = Array.from({ length: 254 }, (_, i) => `${pre}.${i + 1}:${port}`);
    for (let i = 0; i < calon.length; i += 64) {
      const hasil = await Promise.all(
        calon.slice(i, i + 64).map(async (alamat) => {
          try {
            const r = await minta(alamat, '/halo', {}, 700);
            const j = JSON.parse(r.teks);
            return j.aplikasi === 'saku-hati' && j.id === idPusat ? alamat : null;
          } catch {
            return null;
          }
        }),
      );
      const ketemu = hasil.find(Boolean);
      if (ketemu) return ketemu;
    }
  }
  return null;
});

// ---------- Pintu MCP untuk Claude (K-90) ----------
// Claude desktop menjalankan mcp.js (Saku Hati.exe dalam mode Node). mcp.js meneruskan setiap
// panggilan alat ke sini lewat 127.0.0.1 bertoken; di sini diteruskan ke jendela, tempat data
// (IndexedDB) berada. Alamat dan token ditulis ke berkas sambungan di folder data pengguna.

const BERKAS_SAMBUNGAN = path.join(app.getPath('userData'), 'mcp-sambungan.json');
let pintuMcp = null;

function bacaIsi(req, batas = 1_000_000) {
  return new Promise((selesai, gagal) => {
    let isi = '';
    req.setEncoding('utf8');
    req.on('data', (b) => {
      isi += b;
      if (isi.length > batas) {
        gagal(new Error('Permintaan terlalu besar.'));
        req.destroy();
      }
    });
    req.on('end', () => selesai(isi));
    req.on('error', gagal);
  });
}

function balas(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

async function jalankanDiJendela(nama, argumen) {
  if (!jendela || jendela.isDestroyed()) return { ok: false, pesan: 'Jendela Saku Hati sedang tertutup.' };
  const kode = `window.__sakuMcp ? window.__sakuMcp(${JSON.stringify(nama)}, ${JSON.stringify(argumen ?? {})}) : null`;
  const batas = new Promise((_, gagal) => setTimeout(() => gagal(new Error('Saku Hati tidak menjawab dalam 30 detik.')), 30_000));
  const teks = await Promise.race([jendela.webContents.executeJavaScript(kode, true), batas]);
  if (teks == null) return { ok: false, pesan: 'Saku Hati masih memuat. Coba lagi sebentar lagi.' };
  return JSON.parse(teks);
}

function nyalakanPintuMcp() {
  const token = crypto.randomBytes(24).toString('hex');
  pintuMcp = http.createServer(async (req, res) => {
    try {
      if (req.method !== 'POST' || req.url !== '/alat') return balas(res, 404, { ok: false, pesan: 'Tidak ditemukan.' });
      const kunci = String(req.headers.authorization || '');
      const harap = `Bearer ${token}`;
      if (kunci.length !== harap.length || !crypto.timingSafeEqual(Buffer.from(kunci), Buffer.from(harap))) {
        return balas(res, 401, { ok: false, pesan: 'Token tidak cocok.' });
      }
      const { nama, argumen } = JSON.parse(await bacaIsi(req));
      if (typeof nama !== 'string') return balas(res, 400, { ok: false, pesan: 'Nama alat kosong.' });
      balas(res, 200, await jalankanDiJendela(nama, argumen));
    } catch (e) {
      balas(res, 500, { ok: false, pesan: String(e && e.message ? e.message : e) });
    }
  });
  pintuMcp.on('error', (e) => console.error('Pintu MCP gagal:', e));
  // Port 0 = dipilih sistem; hanya alamat lokal komputer ini.
  pintuMcp.listen(0, '127.0.0.1', () => {
    const { port } = pintuMcp.address();
    try {
      fs.writeFileSync(BERKAS_SAMBUNGAN, JSON.stringify({ port, token, pid: process.pid }), { mode: 0o600 });
    } catch (e) {
      console.error('Berkas sambungan MCP tidak bisa ditulis:', e);
    }
  });
}

function matikanPintuMcp() {
  try {
    const isi = JSON.parse(fs.readFileSync(BERKAS_SAMBUNGAN, 'utf8'));
    if (isi.pid === process.pid) fs.unlinkSync(BERKAS_SAMBUNGAN);
  } catch {
    // berkas sudah tidak ada
  }
  if (pintuMcp) pintuMcp.close();
}

// Isi konfigurasi Claude desktop yang ditampilkan di layar Sinkron (K-90 butir 7).
ipcMain.handle('saku:mcp-konfig', () => {
  const skrip = path.join(__dirname, 'mcp.js').replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);
  return {
    mcpServers: {
      'saku-hati': {
        command: process.execPath,
        args: [skrip],
        env: { ELECTRON_RUN_AS_NODE: '1', SAKU_HATI_SAMBUNGAN: BERKAS_SAMBUNGAN },
      },
    },
  };
});
