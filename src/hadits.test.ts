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
    expect(info.jenis).toBe('terkait');
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

describe('hadits lengkap baris demi baris (K-76)', () => {
  const baris = [
    {
      format: 'saku-hati-hadits',
      versi: 2,
      jenis: 'lengkap',
      penomoranAyat: 'kufah',
      sumber: 'uji',
      kitab: [
        { kode: 'bukhari', nama: 'Shahih Bukhari', namaArab: '' },
        { kode: 'muslim', nama: 'Shahih Muslim', namaArab: '' },
      ],
      jumlah: { hadits: 3 },
    },
    ['g', 'bukhari', 1, 'بدء', 'Permulaan Wahyu'],
    ['b', 'bukhari', 1, 1, 'بدء', ' Permulaan wahyu '],
    ['h', 'bukhari', 1, 1, 1, 'عربي', 'niat'],
    ['h', 'bukhari', 2, 1, 1, 'عربي', 'wahyu'],
    ['g', 'muslim', 33, 'الإمارة', 'Kepemimpinan'],
    ['b', 'muslim', 900, 33, 'نية', 'Niat'],
    ['h', 'muslim', 3530, 33, 900, 'عربي', 'niat muslim'],
    ['r', 1, 2, 'bukhari', 2],
    ['p', 'bukhari', 1, 'muslim', 3530],
    ['p', 'muslim', 3530, 'bukhari', 1],
  ];
  it('memuat bagian, bab, hadits, padanan, dan ayat terkait', async () => {
    const d = buatDb('uji-hadits-lengkap');
    const teks = baris.map((x) => JSON.stringify(x)).join('\n') + '\n';
    const tahap: number[] = [];
    const info = await muatDataHadits(new Blob([gzipSync(teks)]), d, (k) => tahap.push(k.hadits));
    expect(info.jenis).toBe('lengkap');
    expect(info.jumlahHadits).toBe(3);
    expect(info.kitab.map((k) => k.jumlah)).toEqual([2, 1]);
    expect(tahap.at(-1)).toBe(3);
    const { daftarBagian, haditsBagian, ambilKait, ambilSatuHadits } = await import('./hadits');
    expect((await daftarBagian('bukhari', d))[0]).toMatchObject({ judul: 'Permulaan Wahyu', jumlah: 2 });
    expect((await haditsBagian('bukhari', 1, 1, 10, d)).map((h) => h.nomor)).toEqual([2]);
    expect((await ambilSatuHadits('muslim', 3530, d))?.bab).toBe('Niat');
    expect(await ambilKait('bukhari:1', d)).toMatchObject({ padanan: ['muslim:3530'], ayat: [] });
    expect((await ambilKait('bukhari:2', d))?.ayat).toEqual(['1:1']);
    expect((await haditsSurah(1, d)).get(1)).toEqual(['bukhari:2']);
  });
});
