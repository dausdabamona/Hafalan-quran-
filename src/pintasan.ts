import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { ganti } from './navigasi';

// Shortcut layar utama HP (K-42): ikon Murotal yang langsung memutar murotal semua hafalan.
interface PluginPintasan {
  ambil(): Promise<{ tindakan?: string | null }>;
  pasangMurotal(): Promise<{ didukung: boolean; diminta?: boolean }>;
  addListener(nama: 'pintasan', f: (isi: { tindakan: string }) => void): Promise<PluginListenerHandle>;
}

const Pintasan = registerPlugin<PluginPintasan>('Pintasan');

export const HASH_PUTAR_MUROTAL = '#/murotal/hafalan/putar';

export function pintasanTersedia(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

function jalankan(tindakan: string | null | undefined) {
  if (tindakan === 'murotal') ganti(HASH_PUTAR_MUROTAL);
}

// Dipanggil sekali saat aplikasi dimulai: membaca tindakan dari shortcut yang membuka
// aplikasi, dan mendengarkan shortcut yang diketuk saat aplikasi sudah berjalan.
export function pasangPintasan() {
  if (!pintasanTersedia()) return;
  Pintasan.ambil()
    .then((h) => jalankan(h.tindakan))
    .catch(() => undefined);
  Pintasan.addListener('pintasan', (isi) => jalankan(isi.tindakan)).catch(() => undefined);
}

export async function pasangIkonMurotal(): Promise<string> {
  try {
    const h = await Pintasan.pasangMurotal();
    if (!h.didukung)
      return 'HP ini belum mendukung pemasangan ikon. Tekan lama ikon Saku Hati, lalu seret "Murotal" ke layar utama.';
    return 'Ikuti permintaan di layar untuk menaruh ikon Murotal di layar utama.';
  } catch {
    return 'Ikon belum bisa dipasang. Tekan lama ikon Saku Hati, lalu seret "Murotal" ke layar utama.';
  }
}
