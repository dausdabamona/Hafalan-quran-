import { describe, expect, it } from 'vitest';
import { cariRukuk, rukukAyat, rukukSurah } from './data';
import {
  adaTandaLama,
  ayatHafal,
  ayatHafalRukuk,
  batalkanAyatLama,
  rentangMurojaah,
  tandaiAyatLama,
  batalkanLama,
  daftarUlangHafalan,
  jalurHafalan,
  kelompok,
  kunciPotongan,
  migrasiJadwalLama,
  pilihHafalanBaru,
  selisihHari,
  setelahKoreksiPotongan,
  setelahMurojaahRukuk,
  tambahHari,
  tandaiLama,
  type EntriHafalan,
  type EntriJadwal,
} from './jadwal';

const AWAL = '2026-10-15';

interface Keadaan {
  hafalan: Map<string, EntriHafalan>;
  jadwal: Map<number, EntriJadwal>;
}

function baru(): Keadaan {
  return { hafalan: new Map(), jadwal: new Map() };
}

// Simulasi satu hari: ulang semua rukuk yang jatuh tempo, lalu satu hafalan baru.
function jalaniHari(k: Keadaan, hari: string, lancar: (jenis: string, hari: string) => boolean = () => true) {
  const ulang = daftarUlangHafalan(k.jadwal, hari);
  for (const j of ulang) {
    const b = setelahMurojaahRukuk(j, lancar(`r${j.nomor}`, hari), hari);
    k.jadwal.set(j.nomor, b ?? { ...j, terakhir: hari });
  }
  const hb = pilihHafalanBaru(k.hafalan, hari);
  if (hb.status === 'baru' || hb.status === 'ulang') {
    const u = setelahKoreksiPotongan(k.hafalan, k.jadwal, hb.potongan, lancar(kunciPotongan(hb.potongan), hari), hari);
    if (u.hafalan) k.hafalan.set(u.hafalan.kunci, u.hafalan);
    for (const j of u.jadwal) k.jadwal.set(j.nomor, j);
  }
  return { ulang: ulang.map((j) => j.nomor), baru: hb };
}

describe('tanggal', () => {
  it('menambah hari melewati akhir bulan', () => {
    expect(tambahHari('2026-10-30', 3)).toBe('2026-11-02');
    expect(selisihHari('2026-10-30', '2026-11-02')).toBe(3);
  });
});

describe('jalur Al-Fatihah → An-Nas (K-24)', () => {
  it('dimulai Al-Fatihah dan menutup 6236 ayat', () => {
    const j = jalurHafalan();
    expect(j[0].surah).toBe(1);
    expect(j.at(-1)!.surah).toBe(114);
    expect(j.reduce((n, p) => n + p.ayatAkhir - p.ayatAwal + 1, 0)).toBe(6236);
  });
});

describe('jadwal per rukuk (K-23)', () => {
  it('Al-Fatihah: berjalan diulang harian, lalu jarak 1–3–7–14–30 setelah lengkap', () => {
    const k = baru();
    const hariUlang: number[] = [];
    for (let i = 0; i < 70; i++) {
      const hari = tambahHari(AWAL, i);
      const h = jalaniHari(k, hari);
      if (h.ulang.includes(1)) hariUlang.push(i);
    }
    // Al-Fatihah = 3 potongan (hari 0, 1, 2); berjalan diulang hari 1 dan 2;
    // lengkap pada hari 2 → ulang hari 3, 6, 13, 27, 57.
    expect(hariUlang).toEqual([1, 2, 3, 6, 13, 27, 57]);
    expect(kelompok(k.jadwal.get(1)!)).toBe('lama');
  });

  it('satu hafalan baru per hari (P-04)', () => {
    const k = baru();
    jalaniHari(k, AWAL);
    expect(pilihHafalanBaru(k.hafalan, AWAL).status).toBe('selesai');
  });

  it('hafalan baru belum lancar diulang esok pagi (P-06)', () => {
    const k = baru();
    jalaniHari(k, AWAL, () => false);
    expect(pilihHafalanBaru(k.hafalan, tambahHari(AWAL, 1)).status).toBe('ulang');
    expect(k.jadwal.size).toBe(0);
  });

  it('kesalahan saat murojaah rukuk lengkap mengembalikan ke jarak 1 hari (P-03)', () => {
    const k = baru();
    for (let i = 0; i < 12; i++) jalaniHari(k, tambahHari(AWAL, i));
    const j = k.jadwal.get(1)!;
    expect(j.tingkat).toBeGreaterThan(0);
    const hari = tambahHari(AWAL, 12);
    const b = setelahMurojaahRukuk(j, false, hari)!;
    expect(b.tingkat).toBe(0);
    expect(b.jatuhTempo).toBe(tambahHari(hari, 1));
  });

  it('hari terlewat: tanggungan menumpuk, yang paling lama terlambat di atas (P-05)', () => {
    const k = baru();
    for (let i = 0; i < 20; i++) jalaniHari(k, tambahHari(AWAL, i));
    const daftar = daftarUlangHafalan(k.jadwal, tambahHari(AWAL, 60));
    const tempo = daftar.map((j) => j.jatuhTempo);
    expect(daftar.length).toBeGreaterThan(1);
    expect(tempo).toEqual([...tempo].sort());
  });

  it('rukuk masuk jadwal sejak potongan pertamanya lancar', () => {
    const k = baru();
    for (let i = 0; i < 4; i++) jalaniHari(k, tambahHari(AWAL, i));
    // hari ke-4 menghafal potongan pertama Al-Baqarah rukuk 1
    const r2 = rukukAyat(2, 1)!;
    expect(k.jadwal.get(r2.nomor)?.lengkap).toBe(false);
    expect(kelompok(k.jadwal.get(r2.nomor)!)).toBe('berjalan');
  });
});

describe('migrasi jadwal per potongan', () => {
  it('potongan Juz 30 lama menjadi hafalan + jadwal rukuk', () => {
    const lama = [
      { kunci: '114:1-3', surah: 114, ayatAwal: 1, ayatAkhir: 3, tingkat: 2, jatuhTempo: '2026-10-20', mulai: '2026-10-14', terakhir: '2026-10-14', sabaqLancar: true },
      { kunci: '114:4-6', surah: 114, ayatAwal: 4, ayatAkhir: 6, tingkat: 1, jatuhTempo: '2026-10-18', mulai: '2026-10-15', terakhir: '2026-10-15', sabaqLancar: true },
      { kunci: '113:1-3', surah: 113, ayatAwal: 1, ayatAkhir: 3, tingkat: 0, jatuhTempo: '2026-10-17', mulai: '2026-10-16', terakhir: '2026-10-16', sabaqLancar: true },
    ];
    const { hafalan, jadwal } = migrasiJadwalLama(lama);
    expect(hafalan).toHaveLength(3);
    const nas = jadwal.find((j) => j.nomor === 556)!;
    expect(nas.lengkap).toBe(true);
    expect(nas.tingkat).toBe(1);
    expect(nas.jatuhTempo).toBe('2026-10-18');
    expect(jadwal.find((j) => j.nomor === 555)!.lengkap).toBe(false);
  });
});

describe('hafalan lama (K-27)', () => {
  function tandai(k: Keadaan, nomor: number[], hari = AWAL) {
    const t = tandaiLama(nomor, k.hafalan, k.jadwal, hari);
    for (const h of t.hafalan) k.hafalan.set(h.kunci, h);
    for (const j of t.jadwal) k.jadwal.set(j.nomor, j);
    return t;
  }
  const juz30 = () => Array.from({ length: 556 - 517 + 1 }, (_, i) => 517 + i);

  it('Juz 30 ditandai: hafalan baru tetap mulai Al-Fatihah dan tidak terhalang', () => {
    const k = baru();
    tandai(k, juz30());
    const hb = pilihHafalanBaru(k.hafalan, AWAL);
    expect(hb.status).toBe('baru');
    if (hb.status === 'baru') expect(hb.potongan).toEqual({ surah: 1, ayatAwal: 1, ayatAkhir: 3 });
  });

  it('Al-Fatihah dan Al-Baqarah rukuk 1 ditandai: hafalan baru melompat ke rukuk 2', () => {
    const k = baru();
    tandai(k, [1, rukukSurah(2)[0].nomor]);
    const hb = pilihHafalanBaru(k.hafalan, AWAL);
    expect(hb.status === 'baru' && hb.potongan.ayatAwal).toBe(rukukSurah(2)[1].ayatAwal);
  });

  it('jadwal awal dicicil paling banyak 10 rukuk per hari, urut mushaf', () => {
    const k = baru();
    tandai(k, juz30());
    const perHari = new Map<string, number>();
    for (const j of k.jadwal.values()) perHari.set(j.jatuhTempo, (perHari.get(j.jatuhTempo) ?? 0) + 1);
    expect([...perHari.entries()].sort()).toEqual([
      [AWAL, 10],
      [tambahHari(AWAL, 1), 10],
      [tambahHari(AWAL, 2), 10],
      [tambahHari(AWAL, 3), 10],
    ]);
    expect(k.jadwal.get(517)!.jatuhTempo).toBe(AWAL);
    expect(daftarUlangHafalan(k.jadwal, AWAL)).toHaveLength(10);
  });

  it('murojaah pertama: lancar → 30 hari; salah → 1 hari', () => {
    const k = baru();
    tandai(k, [517, 518]);
    const a = setelahMurojaahRukuk(k.jadwal.get(517)!, true, AWAL)!;
    expect(selisihHari(AWAL, a.jatuhTempo)).toBe(30);
    const b = setelahMurojaahRukuk(k.jadwal.get(518)!, false, AWAL)!;
    expect(selisihHari(AWAL, b.jatuhTempo)).toBe(1);
  });

  it('rukuk yang sudah hafal lewat hafalan baru tidak ditandai ulang; batal tanda mengembalikan', () => {
    const k = baru();
    for (let i = 0; i < 3; i++) jalaniHari(k, tambahHari(AWAL, i));
    expect(tandai(k, [1]).jadwal).toHaveLength(0);
    tandai(k, [2]);
    expect(adaTandaLama(2, k.hafalan)).toBe(true);
    const b = batalkanLama(2, k.hafalan, k.jadwal, AWAL);
    expect(b.hapusJadwal).toBe(true);
    expect(b.hapusHafalan).toHaveLength(1);
  });
});

describe('hafalan lama per ayat (K-30)', () => {
  const yasin = rukukSurah(36);
  const ayat = (awal: number, akhir: number) => Array.from({ length: akhir - awal + 1 }, (_, i) => ({ surah: 36, ayat: awal + i }));
  function tandai(k: Keadaan, daftar: { surah: number; ayat: number }[]) {
    const t = tandaiAyatLama(daftar, k.hafalan, k.jadwal, AWAL);
    for (const h of t.hafalan) k.hafalan.set(h.kunci, h);
    for (const j of t.jadwal) k.jadwal.set(j.nomor, j);
  }

  it('ayat tak berurutan: satu rukuk "sebagian" berjarak, murojaah hanya ayat hafal', () => {
    const k = baru();
    const r = yasin[1]; // rukuk kedua Yasin
    tandai(k, [...ayat(r.ayatAwal, r.ayatAwal + 2), ...ayat(r.ayatAwal + 6, r.ayatAwal + 8)]);
    expect(k.hafalan.size).toBe(2);
    const j = k.jadwal.get(r.nomor)!;
    expect(j.sebagian).toBe(true);
    expect(kelompok(j)).toBe('lama');
    expect(ayatHafalRukuk(r, ayatHafal(k.hafalan))).toEqual([0, 1, 2, 6, 7, 8].map((d) => r.ayatAwal + d));
    expect(rentangMurojaah(j, k.hafalan)).toEqual({ surah: 36, ayatAwal: r.ayatAwal, ayatAkhir: r.ayatAwal + 8 });
    // murojaah lancar → jarak naik, bukan harian
    const b = setelahMurojaahRukuk(j, true, j.jatuhTempo)!;
    expect(selisihHari(j.jatuhTempo, b.jatuhTempo)).toBe(30);
  });

  it('semua ayat rukuk ditandai satu per satu → rukuk lengkap', () => {
    const k = baru();
    const r = yasin[0];
    tandai(k, ayat(r.ayatAwal, r.ayatAkhir));
    expect(k.jadwal.get(r.nomor)!.lengkap).toBe(true);
    expect(k.hafalan.size).toBe(1);
  });

  it('hafalan baru masuk ke rukuk "sebagian" → menjadi berjalan (harian)', () => {
    const k = baru();
    const r = cariRukuk(1)!; // Al-Fatihah
    tandai(k, [{ surah: 1, ayat: 7 }]);
    expect(k.jadwal.get(1)!.sebagian).toBe(true);
    jalaniHari(k, AWAL);
    expect(kelompok(k.jadwal.get(r.nomor)!)).toBe('berjalan');
  });

  it('batal tanda per ayat memecah entri dan menurunkan rukuk lengkap menjadi sebagian', () => {
    const k = baru();
    const r = yasin[0];
    tandai(k, ayat(r.ayatAwal, r.ayatAkhir));
    const b = batalkanAyatLama(36, [r.ayatAwal + 3], k.hafalan, k.jadwal);
    expect(b.tambahHafalan.map((e) => [e.ayatAwal, e.ayatAkhir])).toEqual([
      [r.ayatAwal, r.ayatAwal + 2],
      [r.ayatAwal + 4, r.ayatAkhir],
    ]);
    expect(b.jadwal[0].sebagian).toBe(true);
  });
});
