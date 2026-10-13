import { describe, expect, it } from 'vitest';
import { daftarSurah, susunToken, teksBasmalah } from './data';

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
