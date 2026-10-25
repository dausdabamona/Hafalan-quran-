import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { buatDb, catatHapus } from './db';
import { imporCadangan, namaBerkasCadangan, susunCadangan } from './cadangan';
import { tulisMeta, bacaMeta } from './sinkron/mesin';

describe('cadangan ke berkas (K-67)', () => {
  it('ekspor lalu impor ke aplikasi kosong memulihkan semua data, termasuk rekaman suara', async () => {
    const lama = buatDb('uji-cadangan-lama');
    const baru = buatDb('uji-cadangan-baru');
    await lama.hafalan.put({ kunci: '112:1', surah: 112, ayat: 1, mulai: '2026-10-01' } as never);
    await lama.makna.put({ kunci: '1:2:0', surah: 1, ayat: 2, segmen: 0, isi: 'makna saya', diubah: '' });
    await lama.makna.put({ kunci: '1:3:0', surah: 1, ayat: 3, segmen: 0, isi: 'dihapus', diubah: '' });
    await lama.makna.delete('1:3:0');
    await catatHapus(lama, 'makna', ['1:3:0']);
    const suara = new Blob([new Uint8Array([0, 1, 2, 200, 255])], { type: 'audio/webm' });
    await lama.rekaman.put({ kunci: '1:3', surah: 1, ayat: 3, audio: suara, durasiMs: 800, direkam: 'x' });
    await lama.sesi.add({
      surah: 1,
      ayatAwal: 1,
      ayatAkhir: 3,
      tanggal: new Date().toISOString(),
      kataSalah: 1,
      sambunganTertukar: 0,
      lancar: false,
    });
    await tulisMeta(lama, 'target', { jenis: 'juz', nomor: 30, mulai: '2026-10-01', hari: 30 });

    const teks = (await susunCadangan(lama)).join('');
    const isi = JSON.parse(teks);
    expect(isi.format).toBe('saku-hati-cadangan');
    expect(isi.tabel.rekaman[0].asal).toBeUndefined();

    const h = await imporCadangan(teks, baru);
    expect(h.diterima).toBe(4);
    expect((await baru.makna.get('1:2:0'))?.isi).toBe('makna saya');
    expect(await baru.hapus.count()).toBe(1);
    const r = await baru.rekaman.get('1:3');
    expect(new Uint8Array(await r!.audio.arrayBuffer())).toEqual(new Uint8Array([0, 1, 2, 200, 255]));
    expect((r as unknown as { asal: string }).asal).toBe('');
    expect(await baru.sesi.count()).toBe(1);
    expect((await bacaMeta<{ nomor: number }>(baru, 'target'))?.nomor).toBe(30);

    // Impor kedua kali tidak menggandakan apa pun.
    const h2 = await imporCadangan(teks, baru);
    expect(h2.diterima).toBe(0);
    expect(await baru.sesi.count()).toBe(1);
  });

  it('impor tidak menimpa data yang lebih baru di sini dan menolak berkas lain', async () => {
    const lama = buatDb('uji-cadangan-l2');
    const baru = buatDb('uji-cadangan-b2');
    await lama.makna.put({ kunci: '1:2:0', surah: 1, ayat: 2, segmen: 0, isi: 'lama', diubah: '' });
    const teks = (await susunCadangan(lama)).join('');
    await new Promise((r) => setTimeout(r, 5));
    await baru.makna.put({ kunci: '1:2:0', surah: 1, ayat: 2, segmen: 0, isi: 'lebih baru', diubah: '' });
    await imporCadangan(teks, baru);
    expect((await baru.makna.get('1:2:0'))?.isi).toBe('lebih baru');
    await expect(imporCadangan('{"a":1}', baru)).rejects.toThrow(/bukan cadangan/);
    await expect(imporCadangan('bukan json', baru)).rejects.toThrow(/bukan cadangan/);
  });

  it('nama berkas memakai tanggal', () => {
    expect(namaBerkasCadangan(new Date(2026, 9, 5))).toBe('saku-hati-cadangan-2026-10-05.json');
  });
});
