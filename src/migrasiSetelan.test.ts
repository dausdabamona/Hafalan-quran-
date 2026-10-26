import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { buatDb } from './db';

describe('migrasi versi 11 (K-73)', () => {
  it('target dan catatan hari pindah dari meta ke setelan', async () => {
    // Basis data versi 10 (Dexie menyimpan versi × 10) dengan target di meta.
    await new Promise<void>((selesai, gagal) => {
      const q = indexedDB.open('uji-migrasi', 100);
      q.onupgradeneeded = () => q.result.createObjectStore('meta', { keyPath: 'kunci' });
      q.onsuccess = () => {
        const d = q.result;
        const t = d.transaction('meta', 'readwrite');
        t.objectStore('meta').put({
          kunci: 'target',
          nilai: { jenis: 'surah', nomor: 67, mulai: '2026-10-23', hari: 14 },
        });
        t.objectStore('meta').put({ kunci: 'catatanHari', nilai: { '2026-10-24': 'hijau' } });
        t.oncomplete = () => {
          d.close();
          selesai();
        };
      };
      q.onerror = () => gagal(q.error);
    });
    const d = buatDb('uji-migrasi');
    const t = await d.setelan.get('target');
    expect((t?.nilai as { nomor: number }).nomor).toBe(67);
    expect((t as unknown as { asal: string }).asal).toBe('');
    expect((await d.setelan.get('catatanHari'))?.nilai).toEqual({ '2026-10-24': 'hijau' });
  });
});
