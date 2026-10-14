import { describe, expect, it } from 'vitest';
import {
  daftarUlangHafalan,
  jalurUrutan,
  kelompok,
  kunciPotongan,
  pilihHafalanBaru,
  perbaruiJadwal,
  selisihHari,
  tambahHari,
  type EntriJadwal,
} from './jadwal';

const AWAL = '2026-10-15';

// Simulasi satu hari: kerjakan hafalan baru dan semua ulang hafalan yang jatuh tempo.
function jalaniHari(
  jadwal: Map<string, EntriJadwal>,
  hari: string,
  lancar: (kunci: string, hari: string) => boolean = () => true,
) {
  const jalur = jalurUrutan('dari-an-nas');
  const ulang = daftarUlangHafalan(jadwal, hari);
  for (const e of ulang) {
    const baru = perbaruiJadwal(e, e, lancar(e.kunci, hari), hari);
    if (baru) jadwal.set(baru.kunci, baru);
  }
  const hb = pilihHafalanBaru(jalur, jadwal, hari);
  if (hb.status === 'baru' || hb.status === 'ulang') {
    const k = kunciPotongan(hb.potongan);
    const baru = perbaruiJadwal(jadwal.get(k), hb.potongan, lancar(k, hari), hari);
    if (baru) jadwal.set(baru.kunci, baru);
  }
  return { ulang: ulang.map((e) => e.kunci), baru: hb };
}

describe('tanggal', () => {
  it('menambah hari melewati akhir bulan', () => {
    expect(tambahHari('2026-10-30', 3)).toBe('2026-11-02');
    expect(selisihHari('2026-10-30', '2026-11-02')).toBe(3);
  });
});

describe('jalur urutan', () => {
  it('dari An-Nas dimulai surah 114, dari An-Naba dimulai surah 78', () => {
    expect(jalurUrutan('dari-an-nas')[0].surah).toBe(114);
    expect(jalurUrutan('dari-an-naba')[0].surah).toBe(78);
  });
});

describe('simulasi 30 hari, semua lancar', () => {
  it('satu hafalan baru per hari dan jarak ulang 1–3–7–14–30', () => {
    const jadwal = new Map<string, EntriJadwal>();
    const tanggalUlang: string[] = [];
    let pertama = '';
    for (let i = 0; i < 70; i++) {
      const hari = tambahHari(AWAL, i);
      const h = jalaniHari(jadwal, hari);
      if (i === 0 && h.baru.status === 'baru') pertama = kunciPotongan(h.baru.potongan);
      if (h.ulang.includes(pertama)) tanggalUlang.push(hari);
    }
    // Potongan pertama diulang pada hari ke-1, 4, 11, 25, 55 (jarak 1, 3, 7, 14, 30)
    expect(tanggalUlang.map((t) => selisihHari(AWAL, t))).toEqual([1, 4, 11, 25, 55]);
    // Satu potongan baru per hari selama 70 hari
    const mulai = new Set([...jadwal.values()].map((e) => e.mulai));
    expect(mulai.size).toBe(70);
  });

  it('setelah jarak 30 hari tetap 30 hari (P-02)', () => {
    const jadwal = new Map<string, EntriJadwal>();
    for (let i = 0; i < 120; i++) jalaniHari(jadwal, tambahHari(AWAL, i));
    const e = [...jadwal.values()].find((x) => x.mulai === AWAL)!;
    expect(e.tingkat).toBe(4);
    expect(kelompok(e)).toBe('lama');
  });
});

describe('kesalahan dan hari terlewat', () => {
  it('kesalahan baru mengembalikan ke jarak 1 hari (P-03)', () => {
    const jadwal = new Map<string, EntriJadwal>();
    for (let i = 0; i < 12; i++) jalaniHari(jadwal, tambahHari(AWAL, i));
    const k = [...jadwal.values()].find((x) => x.mulai === AWAL)!.kunci;
    const hari = tambahHari(AWAL, 25);
    const e = jadwal.get(k)!;
    const baru = perbaruiJadwal(e, e, false, hari)!;
    expect(baru.tingkat).toBe(0);
    expect(baru.jatuhTempo).toBe(tambahHari(hari, 1));
    expect(kelompok(baru)).toBe('dekat');
  });

  it('hafalan baru yang belum lancar diulang esok pagi, tanpa menambah yang baru (P-06)', () => {
    const jadwal = new Map<string, EntriJadwal>();
    jalaniHari(jadwal, AWAL, () => false);
    const besok = pilihHafalanBaru(jalurUrutan('dari-an-nas'), jadwal, tambahHari(AWAL, 1));
    expect(besok.status).toBe('ulang');
    expect(daftarUlangHafalan(jadwal, tambahHari(AWAL, 1))).toHaveLength(0);
  });

  it('hafalan baru hanya satu per hari (P-04)', () => {
    const jadwal = new Map<string, EntriJadwal>();
    jalaniHari(jadwal, AWAL);
    expect(pilihHafalanBaru(jalurUrutan('dari-an-nas'), jadwal, AWAL).status).toBe('selesai');
  });

  it('hari terlewat: tanggungan menumpuk, yang paling lama terlambat lebih dulu (P-05)', () => {
    const jadwal = new Map<string, EntriJadwal>();
    for (let i = 0; i < 5; i++) jalaniHari(jadwal, tambahHari(AWAL, i));
    const nanti = tambahHari(AWAL, 20);
    const daftar = daftarUlangHafalan(jadwal, nanti);
    expect(daftar.length).toBe(5);
    const tempo = daftar.map((e) => e.jatuhTempo);
    expect(tempo).toEqual([...tempo].sort());
  });

  it('mengulang sebelum jatuh tempo tidak mengubah jadwal', () => {
    const jadwal = new Map<string, EntriJadwal>();
    jalaniHari(jadwal, AWAL);
    jalaniHari(jadwal, tambahHari(AWAL, 1));
    const e = [...jadwal.values()].find((x) => x.mulai === AWAL)!;
    expect(perbaruiJadwal(e, e, true, tambahHari(AWAL, 2))).toBeNull();
  });
});
