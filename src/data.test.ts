import { describe, expect, it } from 'vitest';
import { bagiPotongan, daftarSurah, MAKS_AYAT_POTONGAN, MAKS_KATA_POTONGAN, susunToken, teksBasmalah } from './data';

describe('pembagian potongan', () => {
  it('setiap ayat masuk tepat satu potongan, berurutan, 1–3 ayat', () => {
    for (const s of daftarSurah) {
      const potongan = bagiPotongan(s);
      const ayat = potongan.flatMap((p) => {
        const n = p.ayatAkhir - p.ayatAwal + 1;
        expect(n).toBeGreaterThanOrEqual(1);
        expect(n).toBeLessThanOrEqual(MAKS_AYAT_POTONGAN);
        return Array.from({ length: n }, (_, i) => p.ayatAwal + i);
      });
      expect(ayat).toEqual(s.ayat.map((a) => a.ayat));
    }
  });

  it('potongan lebih dari satu ayat tidak melewati batas kata', () => {
    for (const s of daftarSurah) {
      for (const p of bagiPotongan(s)) {
        if (p.ayatAwal === p.ayatAkhir) continue;
        const kata = s.ayat
          .filter((a) => a.ayat >= p.ayatAwal && a.ayat <= p.ayatAkhir)
          .reduce((n, a) => n + a.kata.length, 0);
        expect(kata).toBeLessThanOrEqual(MAKS_KATA_POTONGAN);
      }
    }
  });
});

describe('data Juz 30', () => {
  const semuaAyat = daftarSurah.flatMap((s) => s.ayat.map((a) => ({ surah: s.nomor, ...a })));

  it('berisi 37 surah dan 564 ayat', () => {
    expect(daftarSurah).toHaveLength(37);
    expect(semuaAyat).toHaveLength(564);
  });

  it('setiap kata data tampil tepat satu kali, berurutan, pada token ayatnya', () => {
    for (const a of semuaAyat) {
      const kataTampil = susunToken(a)
        .filter((t) => t.kata)
        .map((t) => t.kata!);
      expect(kataTampil.map((k) => k.urutan), `${a.surah}:${a.ayat}`).toEqual(a.kata.map((k) => k.urutan));
      expect(kataTampil.map((k) => k.teks)).toEqual(susunToken(a).filter((t) => t.kata).map((t) => t.teks));
    }
  });

  it('basmalah ditambah token tampilan menyusun kembali teks ayat tanpa perubahan', () => {
    for (const a of semuaAyat) {
      const bagian = [teksBasmalah(a), ...susunToken(a).map((t) => t.teks)].filter(Boolean);
      expect(bagian.join(' '), `${a.surah}:${a.ayat}`).toBe(a.teks.split(/\s+/).filter(Boolean).join(' '));
    }
  });

  it('basmalah hanya ada di ayat pertama tiap surah', () => {
    for (const a of semuaAyat) expect(a.basmalah).toBe(a.ayat === 1);
  });
});
