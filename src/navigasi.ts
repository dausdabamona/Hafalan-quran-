import { cariSurah, type Potongan } from './data';

// Navigasi berbasis hash: tombol kembali Android ikut berfungsi lewat riwayat WebView.
export type Layar =
  | { nama: 'hari-ini' }
  | { nama: 'daftar' }
  | { nama: 'sambung' }
  | { nama: 'surah'; nomor: number; ayat?: number }
  | { nama: 'rekam'; potongan: Potongan; rukuk?: number }
  | { nama: 'koreksi'; potongan: Potongan; rukuk?: number }
  | { nama: 'rukuk' }
  | { nama: 'tentang' };

function bacaPotongan(nomor: string, awal: string, akhir: string): Potongan | null {
  const surah = cariSurah(Number(nomor));
  const a = Number(awal);
  const b = Number(akhir);
  if (!surah || a < 1 || b < a || b > surah.jumlahAyat) return null;
  return { surah: surah.nomor, ayatAwal: a, ayatAkhir: b };
}

export function bacaHash(): Layar {
  const h = window.location.hash;
  let m = /^#\/surah\/(\d+)(?:\/(\d+))?$/.exec(h);
  if (m && cariSurah(Number(m[1]))) return { nama: 'surah', nomor: Number(m[1]), ayat: m[2] ? Number(m[2]) : undefined };
  // Akhiran /r<nomor> menandai murojaah per rukuk (K-23).
  m = /^#\/(rekam|koreksi)\/(\d+)\/(\d+)-(\d+)(?:\/r(\d+))?$/.exec(h);
  if (m) {
    const p = bacaPotongan(m[2], m[3], m[4]);
    if (p) return { nama: m[1] as 'rekam' | 'koreksi', potongan: p, rukuk: m[5] ? Number(m[5]) : undefined };
  }
  if (h === '#/rukuk') return { nama: 'rukuk' };
  if (h === '#/tentang') return { nama: 'tentang' };
  if (h === '#/semua') return { nama: 'daftar' };
  if (h === '#/sambung') return { nama: 'sambung' };
  return { nama: 'hari-ini' };
}

export function hashPotongan(jenis: 'rekam' | 'koreksi', p: Potongan, rukuk?: number): string {
  return `#/${jenis}/${p.surah}/${p.ayatAwal}-${p.ayatAkhir}${rukuk ? `/r${rukuk}` : ''}`;
}

export function pergi(hash: string) {
  window.location.hash = hash;
}

// Mengganti layar tanpa menambah riwayat (mis. dari Rekam langsung ke Koreksi).
export function ganti(hash: string) {
  window.location.replace(hash);
}
