import { describe, expect, it } from 'vitest';
import { rentetanHari } from './kemajuan';

describe('rentetan hari (K-48)', () => {
  it('menghitung hari berturut sampai hari ini', () => {
    expect(rentetanHari(['2026-10-19', '2026-10-20', '2026-10-21'], '2026-10-21')).toBe(3);
  });
  it('belum latihan hari ini: dihitung sampai kemarin', () => {
    expect(rentetanHari(['2026-10-19', '2026-10-20'], '2026-10-21')).toBe(2);
  });
  it('putus bila ada hari kosong', () => {
    expect(rentetanHari(['2026-10-17', '2026-10-19', '2026-10-21'], '2026-10-21')).toBe(1);
    expect(rentetanHari(['2026-10-18'], '2026-10-21')).toBe(0);
  });
  it('melewati batas bulan', () => {
    expect(rentetanHari(['2026-09-30', '2026-10-01'], '2026-10-01')).toBe(2);
  });
});

import { akurasiKata, kataSeringSalah, petaJuz, rukukJuz } from './kemajuan';
import type { Sesi, TandaSalah } from './db';

describe('kemajuan & peta kesalahan (K-49)', () => {
  const sesi = (ayatAwal: number, ayatAkhir: number, kataSalah: number, tanggal = '2026-10-20T05:00:00Z'): Sesi => ({
    surah: 112,
    ayatAwal,
    ayatAkhir,
    tanggal,
    kataSalah,
    sambunganTertukar: 0,
    lancar: kataSalah === 0,
  });
  it('akurasi kata dari sesi dalam rentang waktu', () => {
    // Al-Ikhlas 1–4 = 15 kata
    expect(akurasiKata([sesi(1, 4, 0)], '2026-10-01')).toBe(100);
    expect(akurasiKata([sesi(1, 4, 3)], '2026-10-01')).toBe(80);
    expect(akurasiKata([sesi(1, 4, 3, '2026-09-01T00:00:00Z')], '2026-10-01')).toBeNull();
  });
  it('peta juz: belum / kuat / lemah per rukuk', () => {
    const r = rukukJuz(30).find((x) => x.surah === 112)!;
    const hafal = new Set(['112:1', '112:2', '112:3', '112:4']);
    const kuat = petaJuz(30, hafal, [], []).find((x) => x.rukuk.nomor === r.nomor)!;
    expect(kuat.kekuatan).toBe('kuat');
    const t: TandaSalah = { kunci: '112:2:1', surah: 112, ayat: 2, urutan: 1, pertama: '', terakhir: '', jumlah: 3 };
    expect(petaJuz(30, hafal, [t], []).find((x) => x.rukuk.nomor === r.nomor)!.kekuatan).toBe('lemah');
    expect(petaJuz(30, new Set(), [], []).every((x) => x.kekuatan === 'belum')).toBe(true);
    expect(rukukJuz(30).length).toBeGreaterThan(30);
  });
  it('kata paling sering salah memakai teks kata aslinya', () => {
    const t = (urutan: number, jumlah: number): TandaSalah => ({
      kunci: `112:1:${urutan}`,
      surah: 112,
      ayat: 1,
      urutan,
      pertama: '',
      terakhir: '2026-10-20',
      jumlah,
    });
    const hasil = kataSeringSalah([t(1, 1), t(3, 4)]);
    expect(hasil[0].urutan).toBe(3);
    expect(hasil[0].teks.length).toBeGreaterThan(0);
  });
});
