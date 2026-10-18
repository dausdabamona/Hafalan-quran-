// Saku Hati untuk Windows (K-37). Membungkus aplikasi web yang sama dengan APK.
// Halaman dimuat lewat skema app:// agar asal (origin) tetap sama di setiap
// pembukaan — penting karena seluruh data tersimpan di IndexedDB asal tersebut.
const { app, BrowserWindow, Menu, net, protocol, session, shell } = require('electron');
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
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) buatJendela();
  });
});

app.on('window-all-closed', () => app.quit());
