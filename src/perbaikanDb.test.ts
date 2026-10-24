import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { cariAyat, rukukAyat } from './data';
import { db, hitungMurojaahRukuk, simpanKoreksi } from './db';
import { selisihHari, tambahHari } from './jadwal';

const H = '2026-10-24';
const r = rukukAyat(67, 1)!;
const dasar = { surah: 67, ayatAwal: r.ayatAwal, ayatAkhir: r.ayatAkhir, rukuk: r.nomor, hari: H };
let jumlahKata = 0;
for (let a = r.ayatAwal; a <= r.ayatAkhir; a++) jumlahKata += cariAyat(67, a)!.kata.length;

async function siapkanRukuk(tingkat: number) {
  await db.jadwalRukuk.put({ nomor: r.nomor, lengkap: true, tingkat, jatuhTempo: H, mulai: '2026-09-01', terakhir: '2026-09-25' });
}

describe('kesalahan kecil saat murojaah rukuk (K-62)', () => {
  beforeEach(async () => {
    await Promise.all([db.jadwalRukuk.clear(), db.perbaikan.clear(), db.sesi.clear(), db.tandaSalah.clear()]);
  });

  it('di bawah 5%: turun satu tingkat dan ayat salah masuk perbaikan besok', async () => {
    await siapkanRukuk(4);
    const h = await simpanKoreksi({
      ...dasar,
      kataSalah: [{ ayat: 9, urutan: 2 }],
      tertukar: [{ ayatAsal: 3, ayatKeliru: 5 }],
    });
    expect(h.mutu).toBe('kecil');
    expect(h.jumlahKata).toBe(jumlahKata);
    expect(h.ayatDiperbaiki).toEqual([3, 9]);
    const j = (await db.jadwalRukuk.get(r.nomor))!;
    expect(selisihHari(H, j.jatuhTempo)).toBe(14);
    expect((await db.perbaikan.get('67:9'))?.jatuhTempo).toBe(tambahHari(H, 1));
    expect(await db.perbaikan.get('67:3')).toBeDefined();
  });

  it('5% atau lebih: kembali ke 1 hari tanpa perbaikan', async () => {
    await siapkanRukuk(4);
    const banyak = Math.ceil(jumlahKata * 0.05);
    const kataSalah = Array.from({ length: banyak }, (_, i) => ({ ayat: 1 + (i % 5), urutan: 1 + Math.floor(i / 5) }));
    const h = await simpanKoreksi({ ...dasar, kataSalah, tertukar: [] });
    expect(h.mutu).toBe('besar');
    expect((await db.jadwalRukuk.get(r.nomor))!.jatuhTempo).toBe(tambahHari(H, 1));
    expect(await db.perbaikan.count()).toBe(0);
  });

  it('perbaikan besok dan lusa menuntaskan; jadwal rukuk tidak berubah; tidak dihitung murojaah', async () => {
    await siapkanRukuk(4);
    await simpanKoreksi({ ...dasar, kataSalah: [{ ayat: 9, urutan: 2 }], tertukar: [] });
    const jadwal = await db.jadwalRukuk.get(r.nomor);
    const satuAyat = { surah: 67, ayatAwal: 9, ayatAkhir: 9, rukuk: r.nomor, perbaikan: true, tertukar: [] };

    await simpanKoreksi({ ...satuAyat, kataSalah: [], hari: tambahHari(H, 1) });
    expect((await db.perbaikan.get('67:9'))?.sisa).toBe(1);
    const akhir = await simpanKoreksi({ ...satuAyat, kataSalah: [], hari: tambahHari(H, 2) });
    expect(akhir.perbaikanSelesai).toEqual([9]);
    expect(await db.perbaikan.get('67:9')).toBeUndefined();
    expect(await db.hapus.get('perbaikan|67:9')).toBeDefined();

    expect(await db.jadwalRukuk.get(r.nomor)).toEqual(jadwal);
    expect(await hitungMurojaahRukuk(67, r.nomor)).toBe(1);
  });
});
