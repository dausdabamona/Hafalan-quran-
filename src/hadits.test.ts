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

describe('suntingan terjemah hadits (K-77)', () => {
  it('disimpan terpisah, dikembalikan ke asli, dan tercatat untuk sinkron', async () => {
    const { simpanSuntingan, ambilSuntingan } = await import('./hadits');
    const d = buatDb('uji-sunting-hadits');
    await simpanSuntingan('bukhari', 1, '  Amal tergantung niat.  ', 'asli', d);
    expect((await ambilSuntingan(['bukhari:1', 'bukhari:2'], d)).get('bukhari:1')).toBe('Amal tergantung niat.');
    const x = (await d.maknaHadits.get('bukhari:1')) as unknown as { asal: string; ubahMs: number };
    expect(x.asal).toBe('');
    expect(x.ubahMs).toBeGreaterThan(0);
    await simpanSuntingan('bukhari', 1, 'asli', 'asli', d);
    expect((await ambilSuntingan(['bukhari:1'], d)).size).toBe(0);
    expect(await d.hapus.get('maknaHadits|bukhari:1')).toBeTruthy();
    // Hapus data hadits tidak menghapus suntingan.
    await simpanSuntingan('muslim', 5, 'gaya saya', 'asli', d);
    await hapusDataHadits(d);
    expect((await ambilSuntingan(['muslim:5'], d)).get('muslim:5')).toBe('gaya saya');
  });
});

describe('pencarian hadits (K-78)', () => {
  it('indeks kata, awalan, Arab tanpa harakat, saring kitab, dan suntingan', async () => {
    const { cariHadits, haditsMenurutUrut, cuplikan, simpanSuntingan, kataDari } = await import('./hadits');
    expect(kataDari("Shallallahu 'alaihi, الصَّلَاةُ")).toEqual(['shallallahu', 'alaihi', 'الصلاه']);
    const kepala = {
      format: 'saku-hati-hadits',
      versi: 2,
      kitab: [
        { kode: 'bukhari', nama: 'Bukhari', namaArab: '' },
        { kode: 'muslim', nama: 'Muslim', namaArab: '' },
      ],
      jumlah: { hadits: 4 },
    };
    const baris = [
      kepala,
      ['g', 'bukhari', 1, '', 'Puasa'],
      ['b', 'bukhari', 1, 1, '', 'Puasa'],
      ['h', 'bukhari', 1, 1, 1, 'الصَّوْمُ جُنَّةٌ', 'telah menceritakan kepada kami: puasa adalah perisai'],
      ['h', 'bukhari', 2, 1, 1, 'الصَّلَاةُ نُورٌ', 'telah menceritakan kepada kami: shalat adalah cahaya'],
      ['g', 'muslim', 1, '', 'Puasa'],
      ['b', 'muslim', 1, 1, '', 'Puasa'],
      ['h', 'muslim', 1, 1, 1, 'الصِّيَامُ', 'telah menceritakan kepada kami: puasa Ramadhan'],
      ['h', 'muslim', 2, 1, 1, 'الزَّكَاةُ', 'telah menceritakan kepada kami: zakat fitri'],
    ];
    const d = buatDb('uji-cari-hadits');
    const info = await muatDataHadits(new Blob([gzipSync(baris.map((x) => JSON.stringify(x)).join('\n'))]), d);
    expect(info.indeks?.kataUmum).toContain('telah');
    const r1 = await cariHadits('Telah puasa', null, info, d);
    expect(r1.kataDiabaikan).toEqual(['telah']);
    expect((await haditsMenurutUrut(r1.urut, d)).map((h) => h.kunci)).toEqual(['bukhari:1', 'muslim:1']);
    expect((await cariHadits('puas', 'muslim', info, d)).urut).toEqual([2]);
    expect((await cariHadits('puasa ramadhan', null, info, d)).urut).toEqual([2]);
    expect((await cariHadits('الصلاة', null, info, d)).urut).toEqual([1]);
    expect((await cariHadits('zzz', null, info, d)).urut).toEqual([]);
    await simpanSuntingan('muslim', 2, 'Zakat fitrah wajib bagi setiap muslim', 'x', d);
    expect((await cariHadits('wajib', null, info, d)).urut).toEqual([3]);
    const c = cuplikan('Rasulullah bersabda: puasa adalah perisai', ['puas']);
    expect(c.filter((x) => x.tebal).map((x) => x.teks)).toEqual(['puasa']);
  });
});

describe('cuplikan (K-78)', () => {
  it('Arab tampil tanpa harakat tetapi huruf aslinya tetap', async () => {
    const { cuplikan } = await import('./hadits');
    const c = cuplikan('وَتُقِيمُ الصَّلَاةَ وَتُؤْتِيَ الزَّكَاةَ', ['الصلاه']);
    expect(c.map((x) => x.teks).join('')).toBe('وتقيم الصلاة وتؤتي الزكاة');
    expect(c.filter((x) => x.tebal).map((x) => x.teks)).toEqual(['الصلاة']);
    const l = cuplikan('Puasa adalah perisai. PUASA', ['puasa']);
    expect(l.filter((x) => x.tebal).map((x) => x.teks)).toEqual(['Puasa', 'PUASA']);
  });
});
