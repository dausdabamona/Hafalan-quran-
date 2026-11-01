import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { buatDb } from '../db';
import { tulisMeta } from '../sinkron/mesin';
import { GalatAlat, jalankanAlat } from './alat';

let n = 0;
async function siapkan() {
  const d = buatDb(`uji-mcp-${n++}`);
  await tulisMeta(d, 'pusat', { id: 'hp-1', alamat: '192.168.1.5:47310', token: 't' });
  await tulisMeta(d, 'sinkronTerakhir', { dikirim: 1, diterima: 2, dihapus: 0, waktu: '2026-11-01T12:00:00.000Z' });
  return d;
}

describe('alat MCP (K-91, baca saja)', () => {
  it('baca_makna: potongan waqaf, arti per kata, makna sendiri dan asal', async () => {
    const d = await siapkan();
    // Seolah datang dari HP lewat sinkron (penanda waktu tidak diubah selama _terapkan).
    d._terapkan = true;
    await d.makna.put({
      kunci: '1:1:0', surah: 1, ayat: 1, segmen: 0, isi: 'Segala puji milik Allah', diubah: '',
      ubahMs: Date.UTC(2026, 10, 1), terimaMs: Date.now(), asal: 'hp-1',
    } as never);
    d._terapkan = false;
    const h = (await jalankanAlat(d, 'baca_makna', { surah: 1, ayat: 1 })) as Awaited<ReturnType<typeof import('./alat').bacaMakna>>;
    expect(h.surah.nomor).toBe(1);
    expect(h.potongan.length).toBeGreaterThan(0);
    expect(h.potongan[0].artiPerKata.length).toBeGreaterThan(0);
    expect(h.potongan[0].maknaSendiri).toBe('Segala puji milik Allah');
    expect(h.potongan[0].asal).toBe('HP');
    expect(h.sinkronHpTerakhir).toBe('2026-11-01T12:00:00.000Z');
  });

  it('baca_makna menerima nomor berbentuk teks dan menolak ayat di luar surah', async () => {
    const d = await siapkan();
    await expect(jalankanAlat(d, 'baca_makna', { surah: '112', ayat: '4' })).resolves.toBeTruthy();
    await expect(jalankanAlat(d, 'baca_makna', { surah: 112, ayat: 9 })).rejects.toBeInstanceOf(GalatAlat);
    await expect(jalankanAlat(d, 'baca_makna', { surah: 115, ayat: 1 })).rejects.toBeInstanceOf(GalatAlat);
  });

  it('baca_keterangan: keterangan ayat dan kata dipisah, kata dilengkapi lafaz', async () => {
    const d = await siapkan();
    await d.keterangan.bulkPut([
      { kunci: '112:1:0', surah: 112, ayat: 1, urutan: 0, isi: 'Tauhid uluhiyah', diubah: '' },
      { kunci: '112:1:3', surah: 112, ayat: 1, urutan: 3, isi: 'Allah', diubah: '' },
    ]);
    const h = (await jalankanAlat(d, 'baca_keterangan', { surah: 112, ayat: 1 })) as {
      keteranganAyat: { isi: string; asal: string };
      keteranganKata: { urutan: number; kata: string | null }[];
    };
    expect(h.keteranganAyat.isi).toBe('Tauhid uluhiyah');
    expect(h.keteranganAyat.asal).toBe('komputer ini');
    expect(h.keteranganKata).toHaveLength(1);
    expect(h.keteranganKata[0].kata).toBeTruthy();
  });

  it('baca_kajian_hadits: suntingan dan catatan tetap terbaca walau data hadits belum dimuat', async () => {
    const d = await siapkan();
    await d.maknaHadits.put({ kunci: 'bukhari:1', kitab: 'bukhari', nomor: 1, isi: 'Amal tergantung niat', diubah: '' });
    await d.catatanHadits.put({ kunci: 'bukhari:1', kitab: 'bukhari', nomor: 1, isi: 'Kajian niat', diubah: '' });
    const h = (await jalankanAlat(d, 'baca_kajian_hadits', { kitab: 'Bukhari', nomor: 1 })) as {
      terjemahSendiri: { isi: string };
      catatan: { isi: string };
      dataHaditsTersedia: boolean;
    };
    expect(h.terjemahSendiri.isi).toBe('Amal tergantung niat');
    expect(h.catatan.isi).toBe('Kajian niat');
    expect(h.dataHaditsTersedia).toBe(false);
    await expect(jalankanAlat(d, 'baca_kajian_hadits', { kitab: 'muslim', nomor: 5 })).rejects.toBeInstanceOf(GalatAlat);
  });

  it('cari_kajian mencari di keempat jenis catatan tanpa membedakan huruf besar', async () => {
    const d = await siapkan();
    await d.makna.put({ kunci: '2:153:0', surah: 2, ayat: 153, segmen: 0, isi: 'mohonlah pertolongan dengan Sabar', diubah: '' });
    await d.keterangan.put({ kunci: '2:155:0', surah: 2, ayat: 155, urutan: 0, isi: 'ujian kesabaran', diubah: '' });
    await d.catatanHadits.put({ kunci: 'muslim:2999', kitab: 'muslim', nomor: 2999, isi: 'sabar saat musibah', diubah: '' });
    await d.maknaHadits.put({ kunci: 'bukhari:5', kitab: 'bukhari', nomor: 5, isi: 'tentang puasa', diubah: '' });
    const h = (await jalankanAlat(d, 'cari_kajian', { kata: 'SABAR' })) as { jumlah: number; hasil: { jenis: string }[] };
    expect(h.jumlah).toBe(3);
    expect(h.hasil.map((x) => x.jenis)).toEqual(['makna', 'keterangan ayat', 'catatan hadits']);
    await expect(jalankanAlat(d, 'cari_kajian', { kata: 's' })).rejects.toBeInstanceOf(GalatAlat);
  });

  it('status_sinkron dan alat tak dikenal', async () => {
    const d = await siapkan();
    const h = (await jalankanAlat(d, 'status_sinkron')) as { terpasangDenganHp: boolean; sinkronHpTerakhir: string };
    expect(h.terpasangDenganHp).toBe(true);
    expect(h.sinkronHpTerakhir).toBe('2026-11-01T12:00:00.000Z');
    await expect(jalankanAlat(d, 'hapus_semua')).rejects.toBeInstanceOf(GalatAlat);
  });
});
