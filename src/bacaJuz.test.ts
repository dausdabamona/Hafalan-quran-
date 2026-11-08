import { describe, expect, it } from 'vitest';
import { daftarJuz, daftarSurah, juzAyat, rentangJuz } from './data';

// K-98 (tambahan): pembagian Baca per juz untuk seluruh 30 juz.
describe('Baca per juz', () => {
  it('30 juz menutup 6.236 ayat, bersambung tanpa celah atau tumpang tindih', () => {
    const urutan: string[] = [];
    for (let j = 1; j <= 30; j++)
      for (const b of rentangJuz(j)) for (let a = b.ayatAwal; a <= b.ayatAkhir; a++) urutan.push(`${b.surah}:${a}`);
    expect(urutan.length).toBe(6236);
    const semua: string[] = [];
    for (const s of daftarSurah) for (let a = 1; a <= s.jumlahAyat; a++) semua.push(`${s.nomor}:${a}`);
    expect(urutan).toEqual(semua);
  });

  it('tiap juz mulai tepat di awal juznya dan setiap ayat di dalamnya milik juz itu', () => {
    for (let j = 1; j <= 30; j++) {
      const r = rentangJuz(j);
      const awal = daftarJuz.find((x) => x.nomor === j)!;
      expect(r[0]).toMatchObject({ surah: awal.surah, ayatAwal: awal.ayat });
      for (const b of r) {
        expect(b.ayatAkhir).toBeGreaterThanOrEqual(b.ayatAwal);
        expect(juzAyat(b.surah, b.ayatAwal)).toBe(j);
        expect(juzAyat(b.surah, b.ayatAkhir)).toBe(j);
      }
    }
  });

  it('Juz 1 = Al-Fatihah lengkap + Al-Baqarah 1–141; Juz 30 = An-Naba sampai An-Nas (37 surah)', () => {
    expect(rentangJuz(1)).toEqual([
      { surah: 1, ayatAwal: 1, ayatAkhir: 7 },
      { surah: 2, ayatAwal: 1, ayatAkhir: 141 },
    ]);
    const j30 = rentangJuz(30);
    expect(j30.length).toBe(37);
    expect(j30[0].surah).toBe(78);
    expect(j30[36]).toMatchObject({ surah: 114, ayatAwal: 1, ayatAkhir: 6 });
    expect(rentangJuz(31)).toEqual([]);
  });
});
