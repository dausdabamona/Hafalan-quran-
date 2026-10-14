import { describe, expect, it } from 'vitest';
import { daftarSurah } from './data';
import { perbaruiJadwal, kunciPotongan, type EntriJadwal } from './jadwal';
import { daftarRukuk, pilihDeresHariIni, rentangDeres, ayatHafal, type CatatanDeres } from './rukuk';

const HARI = '2026-10-20';

function jadwalDari(potongan: { surah: number; ayatAwal: number; ayatAkhir: number }[]) {
  const j = new Map<string, EntriJadwal>();
  for (const p of potongan) {
    const e = perbaruiJadwal(undefined, p, true, '2026-10-01')!;
    j.set(kunciPotongan(p), e);
  }
  return j;
}

describe('data rukuk Juz 30', () => {
  it('39 rukuk menutup 564 ayat tanpa celah dan tumpang tindih', () => {
    expect(daftarRukuk).toHaveLength(39);
    for (const s of daftarSurah) {
      const r = daftarRukuk.filter((x) => x.surah === s.nomor).sort((a, b) => a.ayatAwal - b.ayatAwal);
      expect(r[0].ayatAwal).toBe(1);
      expect(r[r.length - 1].ayatAkhir).toBe(s.jumlahAyat);
      for (let i = 1; i < r.length; i++) expect(r[i].ayatAwal).toBe(r[i - 1].ayatAkhir + 1);
    }
  });

  it("An-Naba' dan An-Nazi'at masing-masing dua rukuk", () => {
    expect(daftarRukuk.filter((r) => r.surah === 78)).toHaveLength(2);
    expect(daftarRukuk.filter((r) => r.surah === 79)).toHaveLength(2);
  });
});

describe('pemilihan deres rukuk', () => {
  it('rentang deres hanya ayat yang sudah hafal, berurutan dari awal', () => {
    const j = jadwalDari([
      { surah: 78, ayatAwal: 1, ayatAkhir: 3 },
      { surah: 78, ayatAwal: 4, ayatAkhir: 6 },
    ]);
    const r = daftarRukuk.find((x) => x.surah === 78)!;
    expect(rentangDeres(r, ayatHafal(j))).toEqual({ surah: 78, ayatAwal: 1, ayatAkhir: 6 });
  });

  it('memilih rukuk yang belum pernah dideres, lalu yang paling lama', () => {
    const j = jadwalDari([
      { surah: 114, ayatAwal: 1, ayatAkhir: 3 },
      { surah: 114, ayatAwal: 4, ayatAkhir: 6 },
      { surah: 113, ayatAwal: 1, ayatAkhir: 5 },
    ]);
    const catatan = new Map<number, CatatanDeres>([[556, { nomor: 556, terakhir: '2026-10-18', jumlah: 1 }]]);
    const pilih = pilihDeresHariIni(j, catatan, HARI);
    expect(pilih.status).toBe('deres');
    if (pilih.status === 'deres') expect(pilih.rukuk.surah).toBe(113);

    catatan.set(555, { nomor: 555, terakhir: '2026-10-19', jumlah: 1 });
    const berikut = pilihDeresHariIni(j, catatan, HARI);
    if (berikut.status === 'deres') expect(berikut.rukuk.surah).toBe(114);
  });

  it('satu rukuk per hari', () => {
    const j = jadwalDari([{ surah: 112, ayatAwal: 1, ayatAkhir: 4 }]);
    const catatan = new Map<number, CatatanDeres>([[554, { nomor: 554, terakhir: HARI, jumlah: 1 }]]);
    expect(pilihDeresHariIni(j, catatan, HARI).status).toBe('selesai');
  });

  it('belum ada rukuk bila hafalan kurang dari dua ayat berurutan', () => {
    expect(pilihDeresHariIni(new Map(), new Map(), HARI).status).toBe('belum-ada');
  });
});
