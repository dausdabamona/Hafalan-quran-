import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { buatDb } from '../db';
import { GalatAlat, jalankanAlat } from './alat';
import { barisTujuan, statusEfektif } from './usulan';

let n = 0;
const db = () => buatDb(`uji-usulan-${n++}`);
const tidur = (ms = 3) => new Promise((r) => setTimeout(r, ms));

describe('usulan Claude (K-91–K-93)', () => {
  it('usul_makna menyimpan usulan tanpa mengubah tabel makna', async () => {
    const d = db();
    const h = (await jalankanAlat(d, 'usul_makna', {
      surah: 1,
      ayat: 1,
      potongan: 1,
      isi: 'Segala puji hanya milik Allah',
      catatan: 'Menekankan makna pengkhususan',
    })) as { tersimpan: boolean; idUsulan: string; isiLama: string | null; isiBawaan: string | null };
    expect(h.tersimpan).toBe(true);
    expect(h.isiLama).toBeNull();
    expect(h.isiBawaan).toBeTruthy();
    expect(await d.makna.count()).toBe(0);
    const u = await d.usulanClaude.get(h.idUsulan);
    expect(u).toMatchObject({ tabel: 'makna', kunciTujuan: '1:1:0', status: 'menunggu', dasarUbahMs: 0, segmen: 0 });
    expect((u as { ubahMs?: number } | undefined)?.ubahMs ?? 0).toBeGreaterThan(0); // ikut penanda sinkron
  });

  it('potongan bernomor mulai 1 dan divalidasi', async () => {
    const d = db();
    await expect(jalankanAlat(d, 'usul_makna', { surah: 1, ayat: 1, potongan: 0, isi: 'x' })).rejects.toBeInstanceOf(GalatAlat);
    await expect(jalankanAlat(d, 'usul_makna', { surah: 1, ayat: 1, potongan: 99, isi: 'x' })).rejects.toBeInstanceOf(GalatAlat);
  });

  it('isi kosong ditolak (Claude tidak bisa menghapus) dan isi yang sama dengan sekarang ditolak', async () => {
    const d = db();
    await d.keterangan.put({ kunci: '112:1:0', surah: 112, ayat: 1, urutan: 0, isi: 'Tauhid', diubah: '' });
    await expect(jalankanAlat(d, 'usul_keterangan', { surah: 112, ayat: 1, isi: '   ' })).rejects.toBeInstanceOf(GalatAlat);
    await expect(jalankanAlat(d, 'usul_keterangan', { surah: 112, ayat: 1, isi: 'Tauhid' })).rejects.toThrow(/sama dengan/);
  });

  it('usul_keterangan untuk kata memakai urutan_kata dan menyimpan isi lama', async () => {
    const d = db();
    await d.keterangan.put({ kunci: '112:1:2', surah: 112, ayat: 1, urutan: 2, isi: 'lama', diubah: '' });
    const h = (await jalankanAlat(d, 'usul_keterangan', { surah: 112, ayat: 1, urutan_kata: 2, isi: 'baru' })) as {
      idUsulan: string;
      isiLama: string;
      rujukan: string;
    };
    expect(h.isiLama).toBe('lama');
    expect(h.rujukan).toMatch(/kata 2/);
    await expect(
      jalankanAlat(d, 'usul_keterangan', { surah: 112, ayat: 1, urutan_kata: 50, isi: 'x' }),
    ).rejects.toBeInstanceOf(GalatAlat);
  });

  it('usulan baru untuk baris yang sama menggantikan usulan yang masih menunggu', async () => {
    const d = db();
    const a = (await jalankanAlat(d, 'usul_makna', { surah: 112, ayat: 1, potongan: 1, isi: 'satu' })) as { idUsulan: string };
    const b = (await jalankanAlat(d, 'usul_makna', { surah: 112, ayat: 1, potongan: 1, isi: 'dua' })) as {
      idUsulan: string;
      menggantikanUsulanSebelumnya: number;
    };
    expect(b.menggantikanUsulanSebelumnya).toBe(1);
    expect((await d.usulanClaude.get(a.idUsulan))?.status).toBe('diganti');
    const l = (await jalankanAlat(d, 'daftar_usulan', {})) as { jumlah: number; usulan: { isiBaru: string }[] };
    expect(l.jumlah).toBe(1);
    expect(l.usulan[0].isiBaru).toBe('dua');
  });

  it('usulan hadits: perlu data hadits atau catatan yang sudah ada', async () => {
    const d = db();
    await expect(jalankanAlat(d, 'usul_catatan_hadits', { kitab: 'bukhari', nomor: 1, isi: 'x' })).rejects.toBeInstanceOf(
      GalatAlat,
    );
    await d.hadits.put({ kunci: 'bukhari:1', kitab: 'bukhari', nomor: 1, bab: 'Niat', arab: 'عربي', terjemah: 'Amal itu dengan niat' });
    const h = (await jalankanAlat(d, 'usul_terjemah_hadits', { kitab: 'Bukhari', nomor: 1, isi: 'Setiap amal tergantung niatnya' })) as {
      isiBawaan: string;
    };
    expect(h.isiBawaan).toBe('Amal itu dengan niat');
    await expect(
      jalankanAlat(d, 'usul_terjemah_hadits', { kitab: 'bukhari', nomor: 1, isi: 'Amal itu dengan niat' }),
    ).rejects.toThrow(/sama dengan/);
  });

  it('K-93: usulan menjadi bentrok bila baris tujuan diubah sesudahnya', async () => {
    const d = db();
    await d.makna.put({ kunci: '112:1:0', surah: 112, ayat: 1, segmen: 0, isi: 'awal', diubah: '' });
    const h = (await jalankanAlat(d, 'usul_makna', { surah: 112, ayat: 1, potongan: 1, isi: 'usulan' })) as { idUsulan: string };
    const u = (await d.usulanClaude.get(h.idUsulan))!;
    expect(statusEfektif(u, await barisTujuan(d, 'makna', '112:1:0'))).toBe('menunggu');
    await tidur();
    await d.makna.update('112:1:0', { isi: 'diubah di HP' });
    expect(statusEfektif(u, await barisTujuan(d, 'makna', '112:1:0'))).toBe('bentrok');
    const l = (await jalankanAlat(d, 'daftar_usulan', {})) as { usulan: { status: string }[] };
    expect(l.usulan[0].status).toBe('bentrok');
  });
});
