import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { buatDb, catatHapus, type SakuDB } from '../db';
import { buatKodePasang, layani, pasang, sinkronkan, type Kirim } from './protokol';

let n = 0;
const tidur = (ms = 3) => new Promise((r) => setTimeout(r, ms));

// HP (pusat) dan laptop (anggota) dengan pengiriman lewat JSON, seperti HTTP sungguhan.
async function pasangan() {
  n++;
  const hp = buatDb(`uji-hp-${n}`);
  const laptop = buatDb(`uji-laptop-${n}`);
  const kirim: Kirim = async (jalur, isi) =>
    JSON.parse(JSON.stringify(await layani(hp, jalur, JSON.parse(JSON.stringify(isi)))));
  const { kode } = buatKodePasang();
  await pasang(laptop, kirim, '192.168.1.5:47310', kode, 'Laptop');
  return { hp, laptop, kirim };
}

const ket = (kunci: string, isi: string) => ({
  kunci,
  surah: 1,
  ayat: 1,
  urutan: 0,
  isi,
  diubah: new Date().toISOString(),
});

async function isiKet(d: SakuDB, kunci: string) {
  return (await d.keterangan.get(kunci))?.isi;
}

describe('sinkron HP ↔ laptop (K-37)', () => {
  it('pemasangan: kode salah ditolak, kode benar memberi token', async () => {
    const hp = buatDb('uji-pasang');
    const laptop = buatDb('uji-pasang-l');
    const kirim: Kirim = (j, i) => layani(hp, j, i);
    buatKodePasang();
    await expect(pasang(laptop, kirim, 'x', '000000', 'L')).rejects.toThrow(/Kode pemasangan/);
    await expect(
      layani(hp, '/tarik', { idPerangkat: 'palsu', token: 'palsu', tabel: 'makna', sampai: 1 }),
    ).rejects.toThrow(/belum dipasangkan/);
  });

  it('data dua arah menyatu, termasuk rekaman suara', async () => {
    const { hp, laptop, kirim } = await pasangan();
    await hp.keterangan.put(ket('1:1:0', 'dari HP'));
    await laptop.makna.put({ kunci: '1:2:0', surah: 1, ayat: 2, segmen: 0, isi: 'makna laptop', diubah: '' });
    const suara = new Blob([new Uint8Array([1, 2, 3, 250, 251, 252])], { type: 'audio/webm' });
    await laptop.rekaman.put({
      kunci: '1:3',
      surah: 1,
      ayat: 3,
      audio: suara,
      durasiMs: 900,
      direkam: new Date().toISOString(),
    });
    await laptop.sesi.add({
      surah: 1,
      ayatAwal: 1,
      ayatAkhir: 3,
      tanggal: new Date().toISOString(),
      kataSalah: 0,
      sambunganTertukar: 0,
      lancar: true,
    });

    const h = await sinkronkan(laptop, kirim);
    expect(h.dikirim).toBe(3);
    expect(await isiKet(laptop, '1:1:0')).toBe('dari HP');
    expect((await hp.makna.get('1:2:0'))?.isi).toBe('makna laptop');
    const r = await hp.rekaman.get('1:3');
    expect(new Uint8Array(await r!.audio.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 250, 251, 252]));
    expect(r!.audio.type).toBe('audio/webm');
    expect(await hp.sesi.count()).toBe(1);

    // Sinkron berikutnya tanpa perubahan: tidak ada yang memantul balik.
    const h2 = await sinkronkan(laptop, kirim);
    expect(h2.dikirim).toBe(0);
    expect(h2.diterima).toBe(0);
  });

  it('perubahan terakhir menang', async () => {
    const { hp, laptop, kirim } = await pasangan();
    await hp.keterangan.put(ket('2:1:0', 'lama'));
    await sinkronkan(laptop, kirim);
    await tidur();
    await laptop.keterangan.put(ket('2:1:0', 'laptop'));
    await tidur();
    await hp.keterangan.put(ket('2:1:0', 'hp terbaru'));
    await sinkronkan(laptop, kirim);
    await sinkronkan(laptop, kirim);
    expect(await isiKet(hp, '2:1:0')).toBe('hp terbaru');
    expect(await isiKet(laptop, '2:1:0')).toBe('hp terbaru');
  });

  it('hapus tanda salah manual ikut tersinkron; tanda baru sesudahnya tetap', async () => {
    const { hp, laptop, kirim } = await pasangan();
    const tanda = { kunci: '3:1:2', surah: 3, ayat: 1, urutan: 2, pertama: 'a', terakhir: 'a', jumlah: 1 };
    await hp.tandaSalah.put(tanda);
    await sinkronkan(laptop, kirim);
    expect(await laptop.tandaSalah.get('3:1:2')).toBeTruthy();
    await tidur();
    await laptop.transaction('rw', laptop.tandaSalah, laptop.hapus, async () => {
      await laptop.tandaSalah.delete('3:1:2');
      await catatHapus(laptop, 'tandaSalah', ['3:1:2']);
    });
    await sinkronkan(laptop, kirim);
    expect(await hp.tandaSalah.get('3:1:2')).toBeUndefined();
    await tidur();
    await hp.tandaSalah.put({ ...tanda, terakhir: 'b', jumlah: 1 });
    await sinkronkan(laptop, kirim);
    expect(await laptop.tandaSalah.get('3:1:2')).toBeTruthy();
  });

  it('tanda salah dari dua perangkat digabung', async () => {
    const { hp, laptop, kirim } = await pasangan();
    await hp.tandaSalah.put({
      kunci: '4:1:1',
      surah: 4,
      ayat: 1,
      urutan: 1,
      pertama: '2026-10-01',
      terakhir: '2026-10-05',
      jumlah: 3,
    });
    await tidur();
    await laptop.tandaSalah.put({
      kunci: '4:1:1',
      surah: 4,
      ayat: 1,
      urutan: 1,
      pertama: '2026-10-03',
      terakhir: '2026-10-09',
      jumlah: 1,
    });
    await sinkronkan(laptop, kirim);
    await sinkronkan(laptop, kirim);
    for (const d of [hp, laptop]) {
      const t = await d.tandaSalah.get('4:1:1');
      expect([t!.pertama, t!.terakhir, t!.jumlah]).toEqual(['2026-10-01', '2026-10-09', 3]);
    }
  });

  it('tanda latihan tebak arti (K-41) digabung dan ikut tersinkron', async () => {
    const { hp, laptop, kirim } = await pasangan();
    await hp.tandaArti.put({
      kunci: '36:5',
      surah: 36,
      ayat: 5,
      jumlah: 2,
      pertama: '2026-10-01',
      terakhir: '2026-10-04',
    });
    await tidur();
    await laptop.tandaArti.put({
      kunci: '36:5',
      surah: 36,
      ayat: 5,
      jumlah: 1,
      pertama: '2026-10-02',
      terakhir: '2026-10-03',
      benar: '2026-10-06',
    });
    await sinkronkan(laptop, kirim);
    await sinkronkan(laptop, kirim);
    for (const d of [hp, laptop]) {
      const t = await d.tandaArti.get('36:5');
      expect([t!.pertama, t!.terakhir, t!.jumlah, t!.benar]).toEqual(['2026-10-01', '2026-10-04', 2, '2026-10-06']);
    }
  });

  it('jadwal: di hari yang sama, kesalahan selalu dipakai', async () => {
    const { hp, laptop, kirim } = await pasangan();
    const dasar = { nomor: 7, lengkap: true, mulai: '2026-10-01', terakhir: '2026-10-19' };
    await laptop.jadwalRukuk.put({ ...dasar, tingkat: 0, jatuhTempo: '2026-10-20' }); // salah → besok
    await tidur();
    await hp.jadwalRukuk.put({ ...dasar, tingkat: 4, jatuhTempo: '2026-11-18' }); // lancar, lebih baru
    await sinkronkan(laptop, kirim);
    await sinkronkan(laptop, kirim);
    expect((await hp.jadwalRukuk.get(7))?.jatuhTempo).toBe('2026-10-20');
    expect((await laptop.jadwalRukuk.get(7))?.jatuhTempo).toBe('2026-10-20');
  });
});
