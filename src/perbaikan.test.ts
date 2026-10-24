import { describe, expect, it } from 'vitest';
import {
  ayatPerbaikan,
  daftarPerbaikanHariIni,
  KALI_PERBAIKAN,
  mulaiPerbaikan,
  mutuMurojaah,
  selisihHari,
  setelahMurojaahRukuk,
  setelahPerbaikan,
  tambahHari,
  type EntriJadwal,
} from './jadwal';

const H = '2026-10-24';
const rukuk = (tingkat: number): EntriJadwal => ({
  nomor: 7,
  lengkap: true,
  tingkat,
  jatuhTempo: H,
  mulai: '2026-09-01',
  terakhir: '2026-09-25',
});

describe('mutu murojaah (K-62)', () => {
  it('0 salah = lancar; di bawah 5% = kecil; 5% atau lebih = besar', () => {
    expect(mutuMurojaah(0, 0, 150)).toBe('lancar');
    expect(mutuMurojaah(7, 0, 150)).toBe('kecil'); // 4,7%
    expect(mutuMurojaah(7, 1, 150)).toBe('besar'); // 5,3%: tertukar = satu kata
    expect(mutuMurojaah(5, 2, 140)).toBe('besar'); // tepat 5%
    expect(mutuMurojaah(1, 0, 10)).toBe('besar'); // 10%
  });
});

describe('jadwal rukuk sesudah murojaah (K-62)', () => {
  it('kesalahan kecil turun satu tingkat: 30 → 14 hari', () => {
    const b = setelahMurojaahRukuk(rukuk(4), 'kecil', H)!;
    expect(b.tingkat).toBe(3);
    expect(selisihHari(H, b.jatuhTempo)).toBe(14);
  });
  it('kesalahan kecil di anak tangga terbawah tetap 1 hari', () => {
    const b = setelahMurojaahRukuk(rukuk(0), 'kecil', H)!;
    expect(b.tingkat).toBe(0);
    expect(b.jatuhTempo).toBe(tambahHari(H, 1));
  });
  it('kesalahan besar kembali ke 1 hari; lancar naik', () => {
    expect(setelahMurojaahRukuk(rukuk(4), 'besar', H)!.jatuhTempo).toBe(tambahHari(H, 1));
    expect(setelahMurojaahRukuk(rukuk(2), 'lancar', H)!.tingkat).toBe(3);
  });
  it('rukuk berjalan tetap harian walau salah kecil', () => {
    const b = setelahMurojaahRukuk({ ...rukuk(0), lengkap: false }, 'kecil', H)!;
    expect(b.jatuhTempo).toBe(tambahHari(H, 1));
  });
});

describe('perbaiki ayat (K-62)', () => {
  it('ayat salah dan ayat asal sambungan tertukar, tanpa ganda', () => {
    expect(ayatPerbaikan([{ ayat: 9 }, { ayat: 3 }, { ayat: 9 }], [{ ayatAsal: 3 }, { ayatAsal: 12 }])).toEqual([3, 9, 12]);
  });
  it('besok dan lusa, lalu selesai', () => {
    let e = mulaiPerbaikan(67, 9, 1, H);
    expect(e.jatuhTempo).toBe(tambahHari(H, 1));
    expect(daftarPerbaikanHariIni([e], H)).toHaveLength(0);
    const besok = tambahHari(H, 1);
    expect(daftarPerbaikanHariIni([e], besok)).toHaveLength(1);
    e = setelahPerbaikan(e, true, besok)!;
    expect(e.sisa).toBe(KALI_PERBAIKAN - 1);
    expect(e.jatuhTempo).toBe(tambahHari(H, 2));
    expect(setelahPerbaikan(e, true, tambahHari(H, 2))).toBeNull();
  });
  it('salah lagi mengulang dua hari; dikerjakan lebih awal tidak dihitung', () => {
    const e = mulaiPerbaikan(67, 9, 1, H);
    expect(setelahPerbaikan(e, true, H)!.sisa).toBe(KALI_PERBAIKAN);
    const besok = tambahHari(H, 1);
    const ulang = setelahPerbaikan({ ...e, sisa: 1 }, false, besok)!;
    expect(ulang.sisa).toBe(KALI_PERBAIKAN);
    expect(ulang.jatuhTempo).toBe(tambahHari(besok, 1));
    expect(ulang.mulai).toBe(H);
  });
  it('terlewat tetap muncul sampai dikerjakan', () => {
    const e = mulaiPerbaikan(67, 9, 1, H);
    expect(daftarPerbaikanHariIni([e], tambahHari(H, 5))).toHaveLength(1);
  });
});
