import { describe, expect, it } from 'vitest';
import { cariSurah } from './data';
import type { Makna, TandaArti } from './db';
import { artiAyat, masihSalah, urutkanSoal } from './tebakArti';

const tanda = (kunci: string, jumlah: number, terakhir: string, benar?: string): TandaArti => {
  const [surah, ayat] = kunci.split(':').map(Number);
  return { kunci, surah, ayat, jumlah, pertama: '2026-10-01', terakhir, ...(benar ? { benar } : {}) };
};

describe('latihan tebak ayat dari arti (K-41)', () => {
  it('tanda salah berlaku sampai ada tebakan benar sesudahnya', () => {
    expect(masihSalah(undefined)).toBe(false);
    expect(masihSalah(tanda('1:2', 1, '2026-10-05'))).toBe(true);
    expect(masihSalah(tanda('1:2', 1, '2026-10-05', '2026-10-04'))).toBe(true);
    expect(masihSalah(tanda('1:2', 1, '2026-10-05', '2026-10-06'))).toBe(false);
  });

  it('ayat yang masih salah didahulukan, paling sering paling depan, lalu dibatasi 10', () => {
    const hafal = Array.from({ length: 20 }, (_, i) => `112:${(i % 4) + 1}`)
      .slice(0, 4)
      .concat(Array.from({ length: 16 }, (_, i) => `2:${i + 1}`));
    const peta = new Map([
      ['2:9', tanda('2:9', 1, '2026-10-05')],
      ['2:3', tanda('2:3', 4, '2026-10-05')],
      ['2:7', tanda('2:7', 9, '2026-10-05', '2026-10-08')], // sudah ditebus
    ]);
    const urut = urutkanSoal(hafal, peta, 10, () => 0.5);
    expect(urut).toHaveLength(10);
    expect(urut.slice(0, 2)).toEqual(['2:3', '2:9']);
    expect(new Set(urut).size).toBe(10);
  });

  it('arti memakai makna sunting bila ada, selain itu makna bawaan', () => {
    const ikhlas = cariSurah(112)!;
    const bawaan = artiAyat(112, ikhlas.ayat[0], new Map());
    expect(bawaan.length).toBeGreaterThan(0);
    const sunting: Makna = {
      kunci: '112:1:0',
      surah: 112,
      ayat: 1,
      segmen: 0,
      isi: 'Katakanlah: Dialah Allah, Yang Maha Esa',
      diubah: '',
    };
    expect(artiAyat(112, ikhlas.ayat[0], new Map([[sunting.kunci, sunting]]))[0]).toBe(sunting.isi);
  });
});
