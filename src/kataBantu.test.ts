import { describe, expect, it } from 'vitest';
import { cariAyat, kataBantu, segmenAyat } from './data';

describe('kata bantu murojaah (K-61)', () => {
  it('ayat tanpa waqaf: kata pertama dan terakhir', () => {
    const a = cariAyat(112, 1)!; // qul huwa Allahu ahad
    const kata = segmenAyat(a).flatMap((g) => g.kata.map((k) => k.urutan));
    expect([...kataBantu(a)].sort((x, y) => x - y)).toEqual([kata[0], kata.at(-1)]);
  });

  it('ayat dengan waqaf: awal tiap potongan waqaf ikut', () => {
    const a = cariAyat(2, 25)!;
    const segmen = segmenAyat(a).filter(Boolean);
    expect(segmen.length).toBeGreaterThan(1);
    const bantu = kataBantu(a);
    for (const g of segmen) expect(bantu.has(g.kata[0].urutan)).toBe(true);
    expect(bantu.has(segmen.at(-1)!.kata.at(-1)!.urutan)).toBe(true);
    expect(bantu.size).toBeLessThanOrEqual(segmen.length + 1);
  });

  it('ayat satu kata tetap satu kata bantu', () => {
    const a = cariAyat(55, 1)!; // ar-Rahman
    expect(kataBantu(a).size).toBe(1);
  });

  it('ayat dua kata: hanya kata pertama (K-65)', () => {
    const a = cariAyat(55, 2)!; // 'allamal-Qur'an
    const kata = segmenAyat(a).flatMap((g) => g.kata);
    expect(kata).toHaveLength(2);
    expect([...kataBantu(a)]).toEqual([kata[0].urutan]);
  });

  it('semua ayat punya kata bantu', () => {
    for (let s = 1; s <= 114; s++)
      for (let n = 1; cariAyat(s, n); n++) expect(kataBantu(cariAyat(s, n)!).size).toBeGreaterThan(0);
  });
});
