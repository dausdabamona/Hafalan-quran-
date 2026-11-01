import { Capacitor } from '@capacitor/core';

// K-94: ukuran huruf Latin & tampilan, disimpan per perangkat (tidak ikut sinkron).
// Seluruh tampilan diskalakan lewat CSS zoom pada <html>; ukuran huruf Arab dikompensasi
// (dibagi --skala) agar tetap mengikuti setelan Arab sendiri.

export const PILIHAN_SKALA = [
  { nilai: 85, judul: 'Kecil' },
  { nilai: 92, judul: 'Sedang' },
  { nilai: 100, judul: 'Normal' },
  { nilai: 110, judul: 'Besar' },
] as const;

const KUNCI = 'skalaTampilan';

// HP Android bawaan Sedang 92%; laptop/browser Normal.
export function skalaBawaan(): number {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android' ? 92 : 100;
}

export function bacaSkala(): number {
  try {
    const n = Number(localStorage.getItem(KUNCI));
    if (PILIHAN_SKALA.some((p) => p.nilai === n)) return n;
  } catch {
    // penyimpanan tidak tersedia: pakai bawaan
  }
  return skalaBawaan();
}

export function terapkanSkala(n: number = bacaSkala()) {
  const root = document.documentElement;
  root.style.setProperty('--skala', String(n / 100));
  root.style.zoom = n === 100 ? '' : String(n / 100);
}

export function simpanSkala(n: number) {
  try {
    localStorage.setItem(KUNCI, String(n));
  } catch {
    // abaikan: berlaku sampai aplikasi ditutup
  }
  terapkanSkala(n);
}
