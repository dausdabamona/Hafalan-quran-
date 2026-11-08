import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import {
  ambilAlamatSurah,
  labelJembatan,
  permintaanClaude,
  ringkasanRukuk,
  rukukJuz,
  simpanAlamat,
  usulanAlamatSurah,
} from './alamat';
import { cariSurah, rukukAyat } from './data';
import { db } from './db';
import { jalankanAlat } from './mcp/alat';
import { terimaUsulan } from './mcp/usulan';

// K-97: Tata Alamat — judul ayat & jembatan.
describe('Tata Alamat (K-97)', () => {
  it('rukuk Juz 30 dimulai dari An-Naba dan berakhir di An-Nas', () => {
    const daftar = rukukJuz(30);
    expect(daftar[0]).toMatchObject({ surah: 78, ayatAwal: 1 });
    expect(daftar[daftar.length - 1]).toMatchObject({ surah: 114 });
    const ayat = daftar.reduce((n, r) => n + r.ayatAkhir - r.ayatAwal + 1, 0);
    expect(ayat).toBe(564);
  });

  it('jembatan menuju ayat berikutnya, ayat terakhir surah menuju surah berikutnya, An-Nas 6 tanpa jembatan', () => {
    expect(labelJembatan(78, 1)).toBe('ayat 2');
    expect(labelJembatan(78, cariSurah(78)!.jumlahAyat)).toBe(`surah ${cariSurah(79)!.nama}`);
    expect(labelJembatan(114, 6)).toBeNull();
  });

  it('simpan, ubah, dan hapus judul (hapus dicatat untuk sinkron); spasi dirapikan', async () => {
    expect(await simpanAlamat(78, 1, 'judul', '  Berita   besar  ditanyakan ')).toBe(true);
    let peta = await ambilAlamatSurah(78);
    expect(peta.get('78:1:judul')).toMatchObject({
      isi: 'Berita besar ditanyakan',
      jenis: 'judul',
      surah: 78,
      ayat: 1,
    });
    expect(await simpanAlamat(78, 1, 'judul', 'Berita besar ditanyakan')).toBe(false); // sama
    await simpanAlamat(78, 1, 'jembatan', 'Ditanyakan → dijawab: berita besar');
    await simpanAlamat(78, 2, 'judul', 'Berita yang besar');
    expect(await simpanAlamat(78, 2, 'judul', '   ')).toBe(true);
    peta = await ambilAlamatSurah(78);
    expect(peta.has('78:2:judul')).toBe(false);
    const hapus = (await db.hapus.toArray()).map((x) => JSON.stringify(x));
    expect(hapus.some((x) => x.includes('78:2:judul'))).toBe(true);
  });

  it('ringkasan per rukuk menghitung judul dan jembatan', async () => {
    const r = rukukAyat(78, 1)!;
    const h = (await ringkasanRukuk([r])).get(r.nomor)!;
    expect(h).toMatchObject({ judul: 1, jembatan: 1, jumlahAyat: r.ayatAkhir - r.ayatAwal + 1 });
    expect(h.jumlahJembatan).toBe(h.jumlahAyat); // ayat terakhir rukuk menuju ayat/surah berikutnya
  });

  it('permintaan untuk Claude hanya menyebut yang masih kosong', async () => {
    const r = rukukAyat(78, 1)!;
    const teks = permintaanClaude(r.nomor, await ambilAlamatSurah(78))!;
    expect(teks).toContain('baca_alamat');
    expect(teks).toMatch(/usul_judul_ayat untuk ayat 2–\d+\./);
    expect(teks).not.toMatch(/untuk ayat 1,/);
    expect(teks).toContain('biarkan tetap');
  });

  it('MCP: baca_alamat, usul_judul_ayat → usulan → diterima menulis judul', async () => {
    const baca = (await jalankanAlat(db, 'baca_alamat', { surah: 78, ayat_awal: 1, ayat_akhir: 2 })) as {
      ayat: { ayat: number; judul: { isi: string } | null; jembatanMenuju: string | null }[];
    };
    expect(baca.ayat[0].judul?.isi).toBe('Berita besar ditanyakan');
    expect(baca.ayat[1].judul).toBeNull();
    expect(baca.ayat[1].jembatanMenuju).toBe('ayat 3');

    const hasil = (await jalankanAlat(db, 'usul_judul_ayat', { surah: 78, ayat: 2, isi: 'Berita yang agung' })) as {
      idUsulan: string;
      rujukan: string;
    };
    expect(hasil.rujukan).toContain('judul ayat');
    const menunggu = await usulanAlamatSurah(78);
    expect(menunggu.get('78:2:judul')?.isiBaru).toBe('Berita yang agung');
    await terimaUsulan(db, hasil.idUsulan);
    expect((await ambilAlamatSurah(78)).get('78:2:judul')).toMatchObject({ isi: 'Berita yang agung', jenis: 'judul' });

    const jb = (await jalankanAlat(db, 'usul_jembatan', { surah: 78, ayat: 2, isi: 'Lalu diperselisihkan' })) as {
      rujukan: string;
    };
    expect(jb.rujukan).toContain('2 → 3');
  });

  it('MCP: judul terlalu panjang dan jembatan An-Nas 6 ditolak', async () => {
    await expect(jalankanAlat(db, 'usul_judul_ayat', { surah: 78, ayat: 3, isi: 'x'.repeat(81) })).rejects.toThrow(
      /terlalu panjang/,
    );
    await expect(jalankanAlat(db, 'usul_jembatan', { surah: 114, ayat: 6, isi: 'tidak ada' })).rejects.toThrow(
      /tidak punya jembatan/,
    );
  });
});
