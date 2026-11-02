import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { buatDb } from '../db';
import { GalatAlat, jalankanAlat } from './alat';
import {
  barisTujuan,
  GalatUsulan,
  kembalikanUsulan,
  statusEfektif,
  terimaSemua,
  terimaUsulan,
  tolakUsulan,
  kunciUsulanSurah,
  usulanUntukBaris,
} from './usulan';

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

describe('keputusan atas usulan Claude (tahap c)', () => {
  const usul = (d: ReturnType<typeof db>, isi: string, ayat = 1) =>
    jalankanAlat(d, 'usul_makna', { surah: 112, ayat, potongan: 1, isi }) as Promise<{ idUsulan: string }>;

  it('terima menulis makna, menandai dariUsulan, dan bisa dikembalikan ke isi lama', async () => {
    const d = db();
    await d.makna.put({ kunci: '112:1:0', surah: 112, ayat: 1, segmen: 0, isi: 'lama', diubah: '' });
    const { idUsulan } = await usul(d, 'baru');
    await terimaUsulan(d, idUsulan);
    const m = await d.makna.get('112:1:0');
    expect(m?.isi).toBe('baru');
    expect((m as { dariUsulan?: string }).dariUsulan).toBeTruthy();
    expect(await d.usulanClaude.get(idUsulan)).toMatchObject({ status: 'diterima', isiDiterima: 'baru', isiLama: 'lama' });
    await kembalikanUsulan(d, idUsulan);
    expect((await d.makna.get('112:1:0'))?.isi).toBe('lama');
    await expect(kembalikanUsulan(d, idUsulan)).rejects.toBeInstanceOf(GalatUsulan);
  });

  it('kembalikan atas baris yang belum ada sebelumnya menghapus baris itu (kembali ke makna bawaan)', async () => {
    const d = db();
    const { idUsulan } = await usul(d, 'baru');
    await terimaUsulan(d, idUsulan);
    await kembalikanUsulan(d, idUsulan);
    expect(await d.makna.get('112:1:0')).toBeUndefined();
    expect(await d.hapus.get('makna|112:1:0')).toBeTruthy(); // penghapusan ikut tersinkron
  });

  it('kembalikan ditolak bila catatan sudah diubah lagi sesudah diterima', async () => {
    const d = db();
    const { idUsulan } = await usul(d, 'baru');
    await terimaUsulan(d, idUsulan);
    await d.makna.update('112:1:0', { isi: 'disunting sendiri' });
    await expect(kembalikanUsulan(d, idUsulan)).rejects.toThrow(/sudah diubah lagi/);
  });

  it('tolak tidak mengubah makna; usulan yang sudah diputuskan tidak bisa diputuskan lagi', async () => {
    const d = db();
    const { idUsulan } = await usul(d, 'baru');
    await tolakUsulan(d, idUsulan);
    expect(await d.makna.count()).toBe(0);
    expect((await d.usulanClaude.get(idUsulan))?.status).toBe('ditolak');
    await expect(terimaUsulan(d, idUsulan)).rejects.toBeInstanceOf(GalatUsulan);
  });

  it('K-93: bentrok tidak bisa diterima tanpa pilihan; sunting gabungan dipakai bila dipilih', async () => {
    const d = db();
    await d.makna.put({ kunci: '112:1:0', surah: 112, ayat: 1, segmen: 0, isi: 'awal', diubah: '' });
    const { idUsulan } = await usul(d, 'usulan');
    await tidur();
    await d.makna.update('112:1:0', { isi: 'versi HP' });
    await expect(terimaUsulan(d, idUsulan)).rejects.toThrow(/Pilih versi/);
    await terimaUsulan(d, idUsulan, { isi: 'gabungan HP dan usulan', paksa: true });
    expect((await d.makna.get('112:1:0'))?.isi).toBe('gabungan HP dan usulan');
    // Isi lama yang tercatat = versi HP yang benar-benar ditimpa, bukan isi saat usulan dibuat.
    expect((await d.usulanClaude.get(idUsulan))?.isiLama).toBe('versi HP');
  });

  it('terima semua melewati usulan yang bentrok', async () => {
    const d = db();
    await d.makna.put({ kunci: '112:2:0', surah: 112, ayat: 2, segmen: 0, isi: 'awal', diubah: '' });
    await usul(d, 'satu', 1);
    await usul(d, 'dua', 2);
    await tidur();
    await d.makna.update('112:2:0', { isi: 'versi HP' });
    expect(await terimaSemua(d)).toEqual({ diterima: 1, dilewati: 1 });
    expect((await d.makna.get('112:1:0'))?.isi).toBe('satu');
    expect((await d.makna.get('112:2:0'))?.isi).toBe('versi HP');
  });

  it('usulan keterangan kata dan catatan hadits ditulis ke tabel yang benar', async () => {
    const d = db();
    const a = (await jalankanAlat(d, 'usul_keterangan', { surah: 112, ayat: 1, urutan_kata: 2, isi: 'ket kata' })) as {
      idUsulan: string;
    };
    await d.hadits.put({ kunci: 'muslim:8', kitab: 'muslim', nomor: 8, bab: 'Iman', arab: 'عربي', terjemah: 'asli' });
    const b = (await jalankanAlat(d, 'usul_catatan_hadits', { kitab: 'muslim', nomor: 8, isi: 'catatan' })) as {
      idUsulan: string;
    };
    await terimaSemua(d);
    expect(await d.keterangan.get('112:1:2')).toMatchObject({ surah: 112, ayat: 1, urutan: 2, isi: 'ket kata' });
    expect(await d.catatanHadits.get('muslim:8')).toMatchObject({ kitab: 'muslim', nomor: 8, isi: 'catatan' });
    expect((await d.usulanClaude.get(a.idUsulan))?.status).toBe('diterima');
    expect((await d.usulanClaude.get(b.idUsulan))?.status).toBe('diterima');
  });
});

describe('usulan langsung di ayat (K-96)', () => {
  it('usulanUntukBaris mengembalikan usulan menunggu terbaru, null sesudah diputuskan', async () => {
    const d = db();
    expect(await usulanUntukBaris(d, 'makna', '1:1:0')).toBeNull();
    await jalankanAlat(d, 'usul_makna', { surah: 1, ayat: 1, potongan: 1, isi: 'Versi pertama' });
    await tidur();
    await jalankanAlat(d, 'usul_makna', { surah: 1, ayat: 1, potongan: 1, isi: 'Versi kedua' });
    const h = await usulanUntukBaris(d, 'makna', '1:1:0');
    expect(h?.u.isiBaru).toBe('Versi kedua');
    expect(h?.status).toBe('menunggu');
    await tolakUsulan(d, h!.u.kunci);
    expect(await usulanUntukBaris(d, 'makna', '1:1:0')).toBeNull();
  });

  it('usulanUntukBaris menandai bentrok bila makna diubah sesudah usulan dibuat', async () => {
    const d = db();
    await jalankanAlat(d, 'usul_makna', { surah: 1, ayat: 1, potongan: 1, isi: 'Usulan' });
    await tidur();
    await d.table('makna').put({ kunci: '1:1:0', surah: 1, ayat: 1, segmen: 0, isi: 'Suntingan HP', diubah: '', ubahMs: Date.now() });
    expect((await usulanUntukBaris(d, 'makna', '1:1:0'))?.status).toBe('bentrok');
  });

  it('kunciUsulanSurah hanya berisi makna & keterangan surah itu yang menunggu', async () => {
    const d = db();
    await jalankanAlat(d, 'usul_makna', { surah: 1, ayat: 1, potongan: 1, isi: 'Makna baru' });
    await jalankanAlat(d, 'usul_keterangan', { surah: 1, ayat: 2, isi: 'Keterangan baru' });
    await jalankanAlat(d, 'usul_makna', { surah: 112, ayat: 1, potongan: 1, isi: 'Surah lain' });
    const set = await kunciUsulanSurah(d, 1);
    expect([...set].sort()).toEqual(['keterangan|1:2:0', 'makna|1:1:0']);
    const u = await usulanUntukBaris(d, 'makna', '1:1:0');
    await terimaUsulan(d, u!.u.kunci, { isi: 'Gabungan sendiri', paksa: true });
    expect([...(await kunciUsulanSurah(d, 1))]).toEqual(['keterangan|1:2:0']);
    expect((await barisTujuan(d, 'makna', '1:1:0'))?.isi).toBe('Gabungan sendiri');
  });
});
