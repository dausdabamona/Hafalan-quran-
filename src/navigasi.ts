import { cariSurah, type Potongan } from './data';
import type { Rentang } from './murotal';

// Navigasi berbasis hash: tombol kembali Android ikut berfungsi lewat riwayat WebView.
export type Layar =
  | { nama: 'hari-ini' }
  | { nama: 'daftar' }
  | { nama: 'sambung' }
  | { nama: 'tebak-arti' }
  | { nama: 'surah'; nomor: number; ayat?: number; tandai?: boolean }
  | { nama: 'rekam'; potongan: Potongan; rukuk?: number }
  | { nama: 'koreksi'; potongan: Potongan; rukuk?: number }
  | { nama: 'rukuk' }
  | { nama: 'tentang' }
  | { nama: 'pilih-murotal' }
  | { nama: 'pengingat' }
  | { nama: 'sinkron' }
  | { nama: 'murotal'; rentang: Rentang };

function bacaPotongan(nomor: string, awal: string, akhir: string): Potongan | null {
  const surah = cariSurah(Number(nomor));
  const a = Number(awal);
  const b = Number(akhir);
  if (!surah || a < 1 || b < a || b > surah.jumlahAyat) return null;
  return { surah: surah.nomor, ayatAwal: a, ayatAkhir: b };
}

export function bacaHash(): Layar {
  const h = window.location.hash;
  // #/surah/N/tandai membuka layar surah langsung dalam mode tandai hafal per ayat (K-36).
  let m = /^#\/surah\/(\d+)\/tandai$/.exec(h);
  if (m && cariSurah(Number(m[1]))) return { nama: 'surah', nomor: Number(m[1]), tandai: true };
  m = /^#\/surah\/(\d+)(?:\/(\d+))?$/.exec(h);
  if (m && cariSurah(Number(m[1]))) return { nama: 'surah', nomor: Number(m[1]), ayat: m[2] ? Number(m[2]) : undefined };
  // Akhiran /r<nomor> menandai murojaah per rukuk (K-23).
  m = /^#\/(rekam|koreksi)\/(\d+)\/(\d+)-(\d+)(?:\/r(\d+))?$/.exec(h);
  if (m) {
    const p = bacaPotongan(m[2], m[3], m[4]);
    if (p) return { nama: m[1] as 'rekam' | 'koreksi', potongan: p, rukuk: m[5] ? Number(m[5]) : undefined };
  }
  // Murotal (K-28): #/murotal, #/murotal/hafalan, #/murotal/juz/N, #/murotal/S/A-B
  if (h === '#/murotal') return { nama: 'pilih-murotal' };
  if (h === '#/pengingat') return { nama: 'pengingat' };
  if (h === '#/sinkron') return { nama: 'sinkron' };
  if (h === '#/murotal/hafalan') return { nama: 'murotal', rentang: { jenis: 'hafalan' } };
  m = /^#\/murotal\/juz\/(\d+)$/.exec(h);
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 30) return { nama: 'murotal', rentang: { jenis: 'juz', nomor: Number(m[1]) } };
  m = /^#\/murotal\/(\d+)\/(\d+)-(\d+)$/.exec(h);
  if (m) {
    const p = bacaPotongan(m[1], m[2], m[3]);
    if (p) return { nama: 'murotal', rentang: { jenis: 'ayat', ...p } };
  }
  if (h === '#/rukuk') return { nama: 'rukuk' };
  if (h === '#/tentang') return { nama: 'tentang' };
  if (h === '#/semua') return { nama: 'daftar' };
  if (h === '#/sambung') return { nama: 'sambung' };
  if (h === '#/tebak-arti') return { nama: 'tebak-arti' };
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
