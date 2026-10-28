import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { rukukAyat } from './data';
import { db, simpanKoreksi } from './db';
import { ayatPerluPerbaikan } from './perluPerbaikan';
import { simpanTarget } from './target';

const tunggu = () => new Promise((r) => setTimeout(r, 5));
const rekam = (surah: number, ayat: number) =>
  db.rekaman.put({
    kunci: `${surah}:${ayat}`,
    surah,
    ayat,
    audio: new Blob([new Uint8Array([1])]),
    durasiMs: 100,
    direkam: new Date().toISOString(),
  });

describe('ayat yang rekamannya masih salah (K-86)', () => {
  it('masuk daftar, target didahulukan, hilang setelah rekam ulang bersih tanpa mengubah jadwal', async () => {
    const hari = '2026-10-28';
    const r = rukukAyat(112, 1)!;
    const jadwal = {
      nomor: r.nomor,
      lengkap: true,
      tingkat: 2,
      jatuhTempo: '2026-11-04',
      mulai: '2026-10-01',
      terakhir: hari,
    };
    await db.jadwalRukuk.put(jadwal as never);
    await rekam(112, 2);
    await rekam(67, 3);
    await tunggu();
    // Kesalahan dicatat sesudah rekaman (mis. dari murotal).
    await simpanKoreksi({
      surah: 112,
      ayatAwal: 2,
      ayatAkhir: 2,
      ayat: [2],
      kataSalah: [{ ayat: 2, urutan: 1, jenis: 'panjang' }],
      tertukar: [],
      tanpaJadwal: true,
    });
    await simpanKoreksi({
      surah: 67,
      ayatAwal: 3,
      ayatAkhir: 3,
      ayat: [3],
      kataSalah: [{ ayat: 3, urutan: 2 }],
      tertukar: [],
      tanpaJadwal: true,
    });
    await simpanTarget({ jenis: 'surah', nomor: 67, mulai: '2026-10-20', hari: 30 });

    let d = await ayatPerluPerbaikan(hari);
    expect(d.map((x) => `${x.surah}:${x.ayat}`)).toEqual(['67:3', '112:2']); // target dulu
    expect(d[1].jenis).toEqual({ hafalan: 0, panjang: 1, sebut: 0 });
    expect(d[1].rukuk).toBe(r.nomor);

    // Rekam ulang Al-Ikhlas 2 lalu koreksi bersih dalam mode perbaikan.
    await tunggu();
    await rekam(112, 2);
    await tunggu();
    await simpanKoreksi({
      surah: 112,
      ayatAwal: 2,
      ayatAkhir: 2,
      ayat: [2],
      rukuk: r.nomor,
      perbaikan: true,
      kataSalah: [],
      tertukar: [],
    });
    d = await ayatPerluPerbaikan(hari);
    expect(d.map((x) => `${x.surah}:${x.ayat}`)).toEqual(['67:3']);
    expect(await db.jadwalRukuk.get(r.nomor)).toMatchObject({ tingkat: 2, jatuhTempo: '2026-11-04' });
  });
});
