import { describe, expect, it } from 'vitest';
import {
  bagiPotongan,
  daftarJuz,
  daftarRukuk,
  daftarSurah,
  juzAyat,
  JUMLAH_AYAT,
  MAKS_AYAT_POTONGAN,
  MAKS_KATA_POTONGAN,
  rukukAyat,
  segmenAyat,
  susunToken,
  teksBasmalah,
} from './data';

const semuaAyat = daftarSurah.flatMap((s) => s.ayat.map((a) => ({ surah: s.nomor, ...a })));

describe('data 30 juz', () => {
  it('114 surah dan 6236 ayat', () => {
    expect(daftarSurah).toHaveLength(114);
    expect(semuaAyat).toHaveLength(JUMLAH_AYAT);
  });

  it('setiap kata punya arti', () => {
    const kosong = semuaAyat.flatMap((a) => a.kata.filter((k) => !k.arti).map((k) => `${a.surah}:${a.ayat}:${k.urutan}`));
    expect(kosong).toEqual([]);
  });

  it('basmalah ditambah token tampilan menyusun kembali teks ayat tanpa perubahan', () => {
    for (const a of semuaAyat) {
      const bagian = [teksBasmalah(a), ...susunToken(a).map((t) => t.teks)].filter(Boolean);
      expect(bagian.join(' '), `${a.surah}:${a.ayat}`).toBe(a.teks.split(/\s+/).filter(Boolean).join(' '));
    }
  });

  it('basmalah hanya di ayat pertama surah selain Al-Fatihah dan At-Taubah', () => {
    for (const a of semuaAyat) expect(a.basmalah, `${a.surah}:${a.ayat}`).toBe(a.ayat === 1 && a.surah !== 1 && a.surah !== 9);
  });

  it('setiap kata tampil tepat sekali dan berurutan', () => {
    for (const a of semuaAyat) {
      const urutan = susunToken(a).filter((t) => t.kata).map((t) => t.kata!.urutan);
      expect(urutan, `${a.surah}:${a.ayat}`).toEqual(a.kata.map((k) => k.urutan));
    }
  });

  it("ayat yang digabung Quran.com tetap dapat arti (mis. 2:181 'بَعْدَ مَا')", () => {
    const a = daftarSurah[1].ayat[180];
    expect(a.kata[2].arti).toBe(a.kata[3].arti);
  });
});

describe('potongan waqaf', () => {
  it('semua kata ayat terbagi habis ke potongan waqaf', () => {
    for (const a of semuaAyat) {
      const kata = segmenAyat(a).flatMap((s) => s.kata.map((k) => k.urutan));
      expect(kata).toEqual(a.kata.map((k) => k.urutan));
    }
  });

  it('Al-Baqarah 2 terbagi pada tanda waqaf', () => {
    const s = segmenAyat(daftarSurah[1].ayat[1]);
    expect(s.length).toBeGreaterThan(1);
    expect(s[0].maknaBawaan.length).toBeGreaterThan(0);
  });
});

describe('rukuk dan juz', () => {
  it('556 rukuk menutup semua ayat tanpa celah', () => {
    expect(daftarRukuk).toHaveLength(556);
    for (const s of daftarSurah) {
      const r = daftarRukuk.filter((x) => x.surah === s.nomor);
      expect(r[0].ayatAwal).toBe(1);
      expect(r.at(-1)!.ayatAkhir).toBe(s.jumlahAyat);
      for (let i = 1; i < r.length; i++) expect(r[i].ayatAwal).toBe(r[i - 1].ayatAkhir + 1);
    }
  });

  it('30 juz; Juz 30 mulai An-Naba', () => {
    expect(daftarJuz).toHaveLength(30);
    expect(juzAyat(78, 1)).toBe(30);
    expect(juzAyat(2, 141)).toBe(1);
    expect(juzAyat(2, 142)).toBe(2);
  });
});

describe('pembagian potongan', () => {
  it('setiap ayat masuk tepat satu potongan, 1–3 ayat, tidak melintasi rukuk', () => {
    for (const s of daftarSurah) {
      const potongan = bagiPotongan(s);
      const ayat = potongan.flatMap((p) => {
        const n = p.ayatAkhir - p.ayatAwal + 1;
        expect(n).toBeLessThanOrEqual(MAKS_AYAT_POTONGAN);
        expect(rukukAyat(p.surah, p.ayatAwal)).toBe(rukukAyat(p.surah, p.ayatAkhir));
        return Array.from({ length: n }, (_, i) => p.ayatAwal + i);
      });
      expect(ayat).toEqual(s.ayat.map((a) => a.ayat));
    }
  });

  it('potongan lebih dari satu ayat tidak melewati batas kata', () => {
    for (const s of daftarSurah) {
      for (const p of bagiPotongan(s)) {
        if (p.ayatAwal === p.ayatAkhir) continue;
        const kata = s.ayat.slice(p.ayatAwal - 1, p.ayatAkhir).reduce((n, a) => n + a.kata.length, 0);
        expect(kata).toBeLessThanOrEqual(MAKS_KATA_POTONGAN);
      }
    }
  });
});
