import { describe, expect, it } from 'vitest';
import { ambilTandaMurojaah, buangTandaMurojaah, kunciSesiRekam, titipTandaMurojaah } from './tandaMurojaah';

describe('tanda salah saat murojaah (K-72)', () => {
  const p = { surah: 112, ayatAwal: 1, ayatAkhir: 4 };
  it('diteruskan sekali ke koreksi potongan yang sama', () => {
    titipTandaMurojaah(kunciSesiRekam(p, 554), new Map([['1:2', 'hafalan' as const]]));
    expect([...ambilTandaMurojaah(kunciSesiRekam(p, 554))]).toEqual([['1:2', 'hafalan']]);
    expect(ambilTandaMurojaah(kunciSesiRekam(p, 554)).size).toBe(0);
  });
  it('tidak terbawa ke potongan lain dan bisa dibuang', () => {
    titipTandaMurojaah(kunciSesiRekam(p, 554), new Map([['1:2', 'hafalan' as const]]));
    expect(ambilTandaMurojaah(kunciSesiRekam({ ...p, ayatAkhir: 3 })).size).toBe(0);
    titipTandaMurojaah(kunciSesiRekam(p), new Map([['2:1', 'panjang' as const]]));
    buangTandaMurojaah();
    expect(ambilTandaMurojaah(kunciSesiRekam(p)).size).toBe(0);
  });
});
