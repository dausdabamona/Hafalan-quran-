import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { rukukAyat } from './data';
import { db } from './db';
import { adaPutaranTarget, susunMurotal } from './murotalData';
import { simpanTarget } from './target';

const suara = () => new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/webm' });

describe('murotal mengutamakan target (K-82)', () => {
  it('putaran target: semua rekaman (benar/salah), tanpa yang sangat lancar; selain target memakai aturan K-28', async () => {
    // Hafal Al-Mulk 1–4 dan Al-Ikhlas 1–4.
    await db.hafalan.bulkPut([
      {
        kunci: '67:1-4',
        surah: 67,
        ayatAwal: 1,
        ayatAkhir: 4,
        mulai: '2026-10-20',
        terakhir: '2026-10-27',
        sabaqLancar: true,
      },
      {
        kunci: '112:1-4',
        surah: 112,
        ayatAwal: 1,
        ayatAkhir: 4,
        mulai: '2026-01-01',
        terakhir: '2026-10-01',
        sabaqLancar: true,
      },
    ] as never);
    // Rekaman: Al-Mulk 1, 2, 3 (belum dikoreksi), Al-Ikhlas 1 (belum dikoreksi).
    for (const [s, a] of [
      [67, 1],
      [67, 2],
      [67, 3],
      [112, 1],
    ])
      await db.rekaman.put({
        kunci: `${s}:${a}`,
        surah: s,
        ayat: a,
        audio: suara(),
        durasiMs: 500,
        direkam: '2026-10-27T01:00:00Z',
      });
    expect(await adaPutaranTarget()).toBe(false); // belum ada target

    await simpanTarget({ jenis: 'surah', nomor: 67, mulai: '2026-10-20', hari: 30 });
    let t = await susunMurotal({ jenis: 'target' });
    expect(t.siap.map((x) => x.ayat)).toEqual([1, 2, 3]);
    expect(t.namaTarget).toBe('Al-Mulk');
    expect(await adaPutaranTarget()).toBe(true);

    // Rukuk Al-Mulk 1 mencapai jadwal 14 hari → ayat tanpa tanda salah keluar dari putaran.
    const r = rukukAyat(67, 1)!;
    await db.jadwalRukuk.put({
      nomor: r.nomor,
      lengkap: true,
      tingkat: 3,
      jatuhTempo: '2026-11-10',
      mulai: '2026-10-01',
      terakhir: '2026-10-27',
    } as never);
    await db.tandaSalah.put({
      kunci: '67:2:0',
      surah: 67,
      ayat: 2,
      urutan: 0,
      jumlah: 1,
      pertama: '2026-10-26',
      terakhir: '2026-10-26',
    } as never);
    t = await susunMurotal({ jenis: 'target' });
    expect(t.siap.map((x) => x.ayat)).toEqual([2]); // ayat 2 masih punya tanda salah
    expect(t.lancar.map((x) => x.ayat)).toEqual([1, 3]);

    // Selain target: hanya di luar Al-Mulk, aturan lama (Al-Ikhlas 1 belum dikoreksi → tidak diputar).
    const s = await susunMurotal({ jenis: 'selain-target' });
    expect(s.siap).toEqual([]);
    expect(s.lain.every((x) => x.letak.surah === 112)).toBe(true);
  });
});
