// Jembatan aman antara halaman Saku Hati dan proses utama Windows (K-37).
// Permintaan ke HP dilakukan proses utama agar tidak terhalang aturan keamanan halaman.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sakuHatiDesktop', {
  minta: (alamat, jalur, isi) => ipcRenderer.invoke('saku:minta', { alamat, jalur, isi }),
  cariPusat: (port, idPusat) => ipcRenderer.invoke('saku:cari-pusat', { port, idPusat }),
  namaKomputer: () => ipcRenderer.invoke('saku:nama-komputer'),
});
