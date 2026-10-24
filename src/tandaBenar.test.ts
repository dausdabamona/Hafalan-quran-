import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { BATAS_BENAR_OTOMATIS, db, simpanKoreksi } from './db';

const dasar = { surah: 112, ayatAwal: 1, ayatAkhir: 4, tertukar: [] as { ayatAsal: number; ayatKeliru: number }[] };

describe('tanda kata yang sudah benar (K-57)', () => {
  it('terhapus otomatis setelah 3 koreksi benar berturut-turut; salah lagi mengulang hitungan', async () => {
    await simpanKoreksi({ ...dasar, kataSalah: [{ ayat: 1, urutan: 2 }] });
    expect(await db.tandaSalah.get('112:1:2')).toBeDefined();
    await simpanKoreksi({ ...dasar, kataSalah: [] });
    await simpanKoreksi({ ...dasar, kataSalah: [{ ayat: 1, urutan: 2 }] }); // salah lagi → 0
    expect((await db.tandaSalah.get('112:1:2'))?.benarBeruntun).toBe(0);
    for (let i = 0; i < BATAS_BENAR_OTOMATIS - 1; i++) await simpanKoreksi({ ...dasar, kataSalah: [] });
    expect(await db.tandaSalah.get('112:1:2')).toBeDefined();
    const h = await simpanKoreksi({ ...dasar, kataSalah: [] });
    expect(h.tandaDihapus).toBe(1);
    expect(await db.tandaSalah.get('112:1:2')).toBeUndefined();
    expect(await db.hapus.get('tandaSalah|112:1:2')).toBeDefined();
  });

  it('"Sekarang sudah benar" langsung menghapus tanda', async () => {
    await simpanKoreksi({ ...dasar, kataSalah: [{ ayat: 3, urutan: 1 }] });
    const h = await simpanKoreksi({ ...dasar, kataSalah: [], sudahBenar: [{ ayat: 3, urutan: 1 }] });
    expect(h.tandaDihapus).toBe(1);
    expect(await db.tandaSalah.get('112:3:1')).toBeUndefined();
  });

  it('tanda di luar ayat yang dikoreksi tidak berubah', async () => {
    await simpanKoreksi({ ...dasar, kataSalah: [{ ayat: 4, urutan: 1 }] });
    await simpanKoreksi({ surah: 112, ayatAwal: 1, ayatAkhir: 2, tertukar: [], kataSalah: [] });
    expect((await db.tandaSalah.get('112:4:1'))?.benarBeruntun).toBe(0);
  });
});
