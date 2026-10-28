import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { rukukAyat } from './data';
import { db, simpanKoreksi } from './db';

describe('jenis kesalahan (K-83)', () => {
  it('tanda menyimpan jenis; hanya salah hafalan yang membuat sesi tidak lancar dan menurunkan jadwal', async () => {
    const r = rukukAyat(112, 1)!;
    const hari = '2026-10-28';
    await db.jadwalRukuk.put({
      nomor: r.nomor,
      lengkap: true,
      tingkat: 2,
      jatuhTempo: hari,
      mulai: '2026-10-01',
      terakhir: '2026-10-21',
    } as never);
    const dasar = { surah: 112, ayatAwal: 1, ayatAkhir: 4, rukuk: r.nomor, tertukar: [], hari };

    // Hanya tajwid → tetap lancar, jadwal naik satu tingkat.
    const s1 = await simpanKoreksi({
      ...dasar,
      kataSalah: [
        { ayat: 1, urutan: 2, jenis: 'panjang' },
        { ayat: 2, urutan: 1, jenis: 'sebut' },
      ],
    });
    expect(s1.lancar).toBe(true);
    expect(s1.kataSalah).toBe(0);
    expect(s1.kataTajwid).toBe(2);
    expect((await db.tandaSalah.get('112:1:2'))?.jenis).toBe('panjang');
    expect((await db.jadwalRukuk.get(r.nomor))?.tingkat).toBe(3);

    // Salah hafalan → tidak lancar, jadwal turun.
    const s2 = await simpanKoreksi({
      ...dasar,
      hari: '2026-11-11',
      kataSalah: [{ ayat: 3, urutan: 1, jenis: 'hafalan' }],
    });
    expect(s2.lancar).toBe(false);
    expect((await db.jadwalRukuk.get(r.nomor))!.tingkat).toBeLessThan(3);
  });

  it('tanda tajwid dari murotal (tanpaJadwal) tidak mengubah jadwal maupun hafalan', async () => {
    const r = rukukAyat(113, 1)!;
    await db.jadwalRukuk.put({
      nomor: r.nomor,
      lengkap: true,
      tingkat: 1,
      jatuhTempo: '2026-10-30',
      mulai: '2026-10-01',
      terakhir: '2026-10-27',
    } as never);
    const sebelum = await db.jadwalRukuk.get(r.nomor);
    await simpanKoreksi({
      surah: 113,
      ayatAwal: 2,
      ayatAkhir: 2,
      ayat: [2],
      kataSalah: [{ ayat: 2, urutan: 1, jenis: 'sebut' }],
      tertukar: [],
      tanpaJadwal: true,
    });
    expect(await db.jadwalRukuk.get(r.nomor)).toEqual(sebelum);
    expect((await db.tandaSalah.get('113:2:1'))?.jenis).toBe('sebut');
    expect(await db.hafalan.count()).toBe(0);
  });
});
