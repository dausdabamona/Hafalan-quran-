import { describe, expect, it } from 'vitest';
import { ayatTarget, hitungTarget, susunBatang, warnaDariSesi, warnaHariIni, type Target } from './target';
import type { Sesi } from './db';

const t: Target = { jenis: 'surah', nomor: 67, mulai: '2026-10-01', hari: 30 }; // Al-Mulk 30 ayat

describe('target hafalan (K-50)', () => {
  it('ayat dalam target', () => {
    expect(ayatTarget(t)).toHaveLength(30);
    expect(ayatTarget({ jenis: 'juz', nomor: 30, mulai: '', hari: 1 }).length).toBe(564);
  });
  it('sesuai jadwal dan tertinggal', () => {
    const hafal = new Set(Array.from({ length: 10 }, (_, i) => `67:${i + 1}`));
    const h10 = hitungTarget(t, hafal, '2026-10-10'); // hari ke-10 → seharusnya 10
    expect([h10.hariKe, h10.seharusnya, h10.tertinggal]).toEqual([10, 10, 0]);
    const h15 = hitungTarget(t, hafal, '2026-10-15'); // seharusnya 15
    expect(h15.tertinggal).toBe(5);
    expect(h15.perHari).toBe(2); // 20 ayat dalam 16 hari
  });
  it('selesai dan lewat', () => {
    const semua = new Set(ayatTarget(t));
    expect(hitungTarget(t, semua, '2026-10-20').selesai).toBe(true);
    expect(hitungTarget(t, new Set(), '2026-11-15').lewat).toBe(true);
  });
  it('batang hari: catatan, sesi, merah, hari ini, nanti', () => {
    const sesi = (tgl: string, rukuk?: number): Sesi => ({
      surah: 67,
      ayatAwal: 1,
      ayatAkhir: 2,
      rukuk,
      tanggal: `${tgl}T03:00:00`,
      kataSalah: 0,
      sambunganTertukar: 0,
      lancar: true,
    });
    const dariSesi = warnaDariSesi([sesi('2026-10-02'), sesi('2026-10-02', 5), sesi('2026-10-03')]);
    const b = susunBatang('2026-10-01', 6, '2026-10-05', { '2026-10-04': 'hijau' }, dariSesi, warnaHariIni(true, 1, 0));
    expect(b.map((x) => x.warna)).toEqual(['merah', 'hijau', 'kuning', 'hijau', 'kuning', 'nanti']);
    expect(warnaHariIni(false, 2, 0)).toBe('hari-ini');
    expect(warnaHariIni(true, 0, 3)).toBe('hijau');
  });
});
