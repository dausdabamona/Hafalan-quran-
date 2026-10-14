import { describe, expect, it } from 'vitest';
import { daftarAyatRentang, statusRekaman, tujuanPerbaikan } from './murotal';
import type { Rekaman, Sesi } from './db';

const rek = (direkam: string) => ({ kunci: '1:1', surah: 1, ayat: 1, audio: new Blob(), durasiMs: 1, direkam }) as Rekaman;
const sesi = (tanggal: string, awal = 1, akhir = 3): Sesi => ({
  surah: 1, ayatAwal: awal, ayatAkhir: akhir, tanggal, kataSalah: 0, sambunganTertukar: 0, lancar: true,
});
const T0 = '2026-10-15T05:00:00.000Z';
const T1 = '2026-10-15T05:05:00.000Z';
const T2 = '2026-10-15T05:10:00.000Z';

describe('status rekaman untuk murotal (K-28)', () => {
  it('belum direkam / belum dikoreksi / siap', () => {
    expect(statusRekaman(1, { sesi: [], tandaSalah: [] })).toBe('belum-rekam');
    expect(statusRekaman(1, { rekaman: rek(T1), sesi: [sesi(T0)], tandaSalah: [] })).toBe('belum-koreksi');
    expect(statusRekaman(1, { rekaman: rek(T1), sesi: [sesi(T2, 2, 3)], tandaSalah: [] })).toBe('belum-koreksi');
    expect(statusRekaman(1, { rekaman: rek(T1), sesi: [sesi(T2)], tandaSalah: [] })).toBe('siap');
  });

  it('kesalahan sesudah rekaman → perbaiki; tanda lama sebelum rekam ulang tidak menghalangi', () => {
    const salah = (terakhir: string) => ({ kunci: '1:1:2', surah: 1, ayat: 1, urutan: 2, pertama: T0, terakhir, jumlah: 1 });
    expect(statusRekaman(1, { rekaman: rek(T1), sesi: [sesi(T2)], tandaSalah: [salah(T2)] })).toBe('perbaiki');
    expect(statusRekaman(1, { rekaman: rek(T1), sesi: [sesi(T2)], tandaSalah: [salah(T0)] })).toBe('siap');
  });

  it('sambungan tertukar hanya dihitung bila ditandai saat koreksi', () => {
    const t = { kunci: '1:1', surah: 1, ayatAsal: 1, ayatKeliru: 3, pertama: T2, terakhir: T2, jumlah: 1 };
    expect(statusRekaman(2, { rekaman: rek(T1), sesi: [sesi(T2)], tandaSalah: [], tertukar: t })).toBe('perbaiki');
    const latihan = { ...t, terakhir: '2026-10-15T06:00:00.000Z' };
    expect(statusRekaman(2, { rekaman: rek(T1), sesi: [sesi(T2)], tandaSalah: [], tertukar: latihan })).toBe('siap');
  });
});

describe('rentang murotal', () => {
  it('juz 30 = 564 ayat, juz 1 dimulai Al-Fatihah 1 dan berakhir Al-Baqarah 141', () => {
    expect(daftarAyatRentang({ jenis: 'juz', nomor: 30 })).toHaveLength(564);
    const j1 = daftarAyatRentang({ jenis: 'juz', nomor: 1 });
    expect(j1[0]).toEqual({ surah: 1, ayat: 1 });
    expect(j1.at(-1)).toEqual({ surah: 2, ayat: 141 });
  });
  it('perbaikan lewat rukuk bila terjadwal', () => {
    expect(tujuanPerbaikan(1, 5, new Map([[1, {} as never]])).rukuk).toBe(1);
    expect(tujuanPerbaikan(1, 5, new Map()).potongan).toEqual({ surah: 1, ayatAwal: 4, ayatAkhir: 6 });
  });
});
