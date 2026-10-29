import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { rukukAyat } from './data';
import { ambilHafalan, ambilSyaratMantap, batalkanHafalanBaru, db, simpanKoreksi, simpanSyaratMantap } from './db';

// K-88: lapisan database — hitungan pemantapan di hasil koreksi, kembalikan ke belum hafal, syarat mantap.
describe('pemantapan di database (K-88)', () => {
  it('koreksi potongan melaporkan hitungan mantap; hanya salah hafalan yang menahan', async () => {
    const dasar = { surah: 114, ayatAwal: 1, ayatAkhir: 3, tertukar: [] };
    let h = await simpanKoreksi({ ...dasar, kataSalah: [], hari: '2026-11-01' });
    expect(h.mantap).toEqual({ ke: 1, naik: true });
    // Salah panjang-pendek tidak menahan (K-83).
    h = await simpanKoreksi({ ...dasar, kataSalah: [{ ayat: 2, urutan: 1, jenis: 'panjang' }], hari: '2026-11-02' });
    expect(h.mantap).toEqual({ ke: 2, naik: true });
    // Salah hafalan: hitungan tetap.
    h = await simpanKoreksi({ ...dasar, kataSalah: [{ ayat: 2, urutan: 1 }], hari: '2026-11-03' });
    expect(h.mantap).toEqual({ ke: 2, naik: false });
    expect((await ambilHafalan()).get('114:1-3')).toMatchObject({ mantap: 2, goyah: true });
    h = await simpanKoreksi({ ...dasar, kataSalah: [], hari: '2026-11-03' });
    expect(h.mantap).toEqual({ ke: 3, naik: true });
  });

  it('kembalikan ke belum hafal: entri, jadwal rukuk, dan perbaikan ayat dihapus serta dicatat untuk sinkron', async () => {
    const r = rukukAyat(114, 1)!.nomor;
    expect(await db.jadwalRukuk.get(r)).toBeTruthy();
    await db.perbaikan.put({
      kunci: '114:2',
      surah: 114,
      ayat: 2,
      rukuk: r,
      jatuhTempo: '2026-11-04',
      sisa: 2,
      mulai: '2026-11-03',
      terakhir: '2026-11-03',
    });
    await db.perbaikan.put({
      kunci: '114:5',
      surah: 114,
      ayat: 5,
      rukuk: r,
      jatuhTempo: '2026-11-04',
      sisa: 2,
      mulai: '2026-11-03',
      terakhir: '2026-11-03',
    });
    expect(await batalkanHafalanBaru('114:1-3', '2026-11-04')).toBe(true);
    expect((await ambilHafalan()).has('114:1-3')).toBe(false);
    expect(await db.jadwalRukuk.get(r)).toBeUndefined();
    expect(await db.perbaikan.get('114:2')).toBeUndefined();
    expect(await db.perbaikan.get('114:5')).toBeTruthy(); // bukan ayat potongan ini
    const hapus = await db.hapus.toArray();
    const tercatat = hapus.map((x) => JSON.stringify(x));
    expect(tercatat.some((x) => x.includes('114:1-3'))).toBe(true);
    expect(tercatat.some((x) => x.includes('114:2'))).toBe(true);
    // Sudah tidak ada: tidak bisa dibatalkan lagi.
    expect(await batalkanHafalanBaru('114:1-3', '2026-11-04')).toBe(false);
  });

  it('syarat mantap: bawaan 3, dibatasi 1–5', async () => {
    expect(await ambilSyaratMantap()).toBe(3);
    await simpanSyaratMantap(9);
    expect(await ambilSyaratMantap()).toBe(5);
    await simpanSyaratMantap(0);
    expect(await ambilSyaratMantap()).toBe(1);
    await simpanSyaratMantap(2);
    expect(await ambilSyaratMantap()).toBe(2);
  });
});
