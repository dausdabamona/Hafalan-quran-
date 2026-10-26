import 'fake-indexeddb/auto';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { buatDb } from './db';
import { ambilHadits, ayatSakuHati, hapusDataHadits, haditsSurah, infoDataHadits, muatDataHadits } from './hadits';

const contoh = {
  format: 'saku-hati-hadits',
  versi: 1,
  penomoranAyat: 'kufah',
  sumber: 'uji',
  kitab: [
    { kode: 'bukhari', nama: 'Shahih Bukhari', namaArab: '' },
    { kode: 'muslim', nama: 'Shahih Muslim', namaArab: '' },
  ],
  hadits: [
    ['muslim', 600, 'Bab amin', 'عربي', 'terjemah muslim'],
    ['bukhari', 740, 'Bab amin', 'عربي', 'terjemah bukhari'],
    ['bukhari', 4658, null, 'عربي', 'basmalah'],
    ['bukhari', 1, 'Niat', 'عربي', 'tidak dirujuk'],
  ],
  rujukan: [
    [1, 7, 'muslim', 600],
    [1, 7, 'bukhari', 740],
    [1, 1, 'bukhari', 4658],
    [1, 2, 'bukhari', 740],
    [67, 1, 'bukhari', 9999], // hadits tidak ada di berkas: dilewati
  ],
};

describe('hadits terkait ayat (K-75)', () => {
  it('penomoran Al-Fatihah Kufah → Madinah', () => {
    expect([1, 2, 3, 6, 7].map((a) => ayatSakuHati(1, a))).toEqual([1, 1, 2, 5, 7]);
    expect(ayatSakuHati(2, 255)).toBe(255);
  });

  it('memuat berkas .json.gz, urut kitab lalu nomor, dan bisa dihapus', async () => {
    const d = buatDb('uji-hadits');
    const berkas = new Blob([gzipSync(JSON.stringify(contoh))]);
    const info = await muatDataHadits(berkas, d);
    expect(info.jumlahHadits).toBe(4);
    const peta = await haditsSurah(1, d);
    expect(peta.get(7)).toEqual(['bukhari:740', 'muslim:600']);
    expect(peta.get(1)).toEqual(['bukhari:740', 'bukhari:4658']);
    expect((await haditsSurah(67, d)).size).toBe(0);
    expect((await ambilHadits(['muslim:600'], d))[0].terjemah).toBe('terjemah muslim');
    expect((await infoDataHadits(d))?.kitab.length).toBe(2);
    await hapusDataHadits(d);
    expect((await haditsSurah(1, d)).size).toBe(0);
    expect(await infoDataHadits(d)).toBeUndefined();
  });

  it('menolak berkas lain', async () => {
    const d = buatDb('uji-hadits-2');
    await expect(muatDataHadits(new Blob(['{"a":1}']), d)).rejects.toThrow(/bukan data hadits/);
  });
});
