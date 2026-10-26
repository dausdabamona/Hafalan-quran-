import type { Potongan } from './data';

// K-72: kata yang ditandai salah langsung di layar murojaah/rekam, diteruskan ke layar Koreksi.
// Hanya disimpan di memori: baru masuk basis data bila koreksi disimpan; bila murojaah
// ditinggalkan tanpa koreksi, tandanya dibuang.

let simpanan: { kunci: string; tanda: Set<string> } | null = null;

export function kunciSesiRekam(p: Potongan, rukuk?: number): string {
  return `${p.surah}:${p.ayatAwal}-${p.ayatAkhir}:${rukuk ?? ''}`;
}

// tanda berisi "ayat:urutan".
export function titipTandaMurojaah(kunci: string, tanda: Set<string>) {
  simpanan = tanda.size ? { kunci, tanda: new Set(tanda) } : null;
}

// Diambil sekali oleh layar Koreksi untuk potongan yang sama, lalu dikosongkan.
export function ambilTandaMurojaah(kunci: string): Set<string> {
  const ada = simpanan && simpanan.kunci === kunci ? simpanan.tanda : new Set<string>();
  simpanan = null;
  return ada;
}

export function buangTandaMurojaah() {
  simpanan = null;
}
