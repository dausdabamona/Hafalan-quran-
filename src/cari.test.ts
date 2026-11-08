import { describe, expect, it } from 'vitest';
import { cariLompatan, cariQuran } from './cari';

// K-98 (B): pencarian umum Al-Qur'an.
const kosong = { makna: [], keterangan: [], alamat: [] };

describe('pencarian umum (K-98)', () => {
  it('lompat langsung lewat nomor dan nama surah', () => {
    expect(cariLompatan('67:1').map((l) => [l.surah.nomor, l.ayat])).toEqual([[67, 1]]);
    expect(cariLompatan('67 1').map((l) => [l.surah.nomor, l.ayat])).toEqual([[67, 1]]);
    expect(cariLompatan('114').map((l) => l.surah.nomor)).toEqual([114]);
    expect(cariLompatan('al mulk').map((l) => l.surah.nomor)).toContain(67);
    expect(cariLompatan('mulk 3')[0]).toMatchObject({ ayat: 3 });
    expect(cariLompatan('67:99')[0].ayat).toBeUndefined(); // ayat di luar rentang
    expect(cariLompatan('ab')).toEqual([]);
  });

  it('teks Arab tanpa harakat menemukan ayat berharakat (ة/ه, alif disamakan)', () => {
    const { hasil, arab } = cariQuran('رحمة', kosong);
    expect(arab).toBe(true);
    expect(hasil.length).toBeGreaterThan(20);
    expect(hasil.every((h) => h.sumber === 'arab')).toBe(true);
    const ikhlas = cariQuran('قل هو الله احد', kosong).hasil;
    expect(ikhlas[0]).toMatchObject({ surah: 112, ayat: 1 });
  });

  it('kata Indonesia dicari di arti per kata; catatan sendiri didahulukan', () => {
    const umum = cariQuran('sabar', kosong);
    expect(umum.hasil.length).toBeGreaterThan(10);
    expect(umum.hasil[0].sumber).toBe('arti');
    const sendiri = cariQuran('sabar', {
      makna: [{ kunci: '103:3:0', surah: 103, ayat: 3, segmen: 0, isi: 'saling menasihati untuk sabar', diubah: '' }],
      keterangan: [],
      alamat: [{ kunci: '78:1:judul', surah: 78, ayat: 1, jenis: 'judul', isi: 'Kesabaran ditanyakan', diubah: '' }],
    });
    expect(sendiri.hasil[0]).toMatchObject({ surah: 78, ayat: 1, sumber: 'judul' });
    expect(sendiri.hasil[1]).toMatchObject({ surah: 103, ayat: 3, sumber: 'makna' });
    // Satu ayat hanya muncul sekali.
    const kunci = sendiri.hasil.map((h) => `${h.surah}:${h.ayat}`);
    expect(new Set(kunci).size).toBe(kunci.length);
  });

  it('semua kata harus ada (AND)', () => {
    const satu = cariQuran('langit', kosong).hasil.length;
    const dua = cariQuran('langit bumi', kosong).hasil.length;
    expect(dua).toBeLessThan(satu);
    expect(dua).toBeGreaterThan(0);
  });
});
