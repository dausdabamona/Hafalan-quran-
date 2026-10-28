import type { Potongan } from './data';
import type { JenisSalah } from './db';

// K-72: kata yang ditandai salah langsung di layar murojaah/rekam, diteruskan ke layar Koreksi.
// Hanya disimpan di memori: baru masuk basis data bila koreksi disimpan; bila murojaah
// ditinggalkan tanpa koreksi, tandanya dibuang.

let simpanan: { kunci: string; tanda: Map<string, JenisSalah> } | null = null;

export function kunciSesiRekam(p: Potongan, rukuk?: number): string {
  return `${p.surah}:${p.ayatAwal}-${p.ayatAkhir}:${rukuk ?? ''}`;
}

// tanda: "ayat:urutan" → jenis kesalahan (K-83).
export function titipTandaMurojaah(kunci: string, tanda: Map<string, JenisSalah>) {
  simpanan = tanda.size ? { kunci, tanda: new Map(tanda) } : null;
}

// Diambil sekali oleh layar Koreksi untuk potongan yang sama, lalu dikosongkan.
export function ambilTandaMurojaah(kunci: string): Map<string, JenisSalah> {
  const ada = simpanan && simpanan.kunci === kunci ? simpanan.tanda : new Map<string, JenisSalah>();
  simpanan = null;
  return ada;
}

export function buangTandaMurojaah() {
  simpanan = null;
}
