import { rukukAyat } from './data';
import { ambilBahanMurotal, ambilHafalan, ambilJadwal, db, jenisTanda, kunciAyat, type JenisSalah } from './db';
import { statusRekaman } from './murotal';
import { ambilTarget, dalamTarget } from './target';

// K-86: ayat yang rekaman terakhirnya masih ada kesalahan, untuk kartu "Perbaiki ayat" di Hari ini.
export interface AyatPerluPerbaikan {
  surah: number;
  ayat: number;
  rukuk?: number;
  jenis: Record<JenisSalah, number>; // jumlah tanda sesudah rekaman, per jenis
  tertukar: boolean;
  target: boolean;
}

export async function ayatPerluPerbaikan(hari: string): Promise<AyatPerluPerbaikan[]> {
  const [semuaTanda, semuaTertukar, sudahDijadwal, target, hafalan, jadwal] = await Promise.all([
    db.tandaSalah.toArray(),
    db.tandaTertukar.toArray(),
    db.perbaikan.toArray(),
    ambilTarget(),
    ambilHafalan(),
    ambilJadwal(),
  ]);
  // Calon: ayat yang punya tanda kata, atau ayat sesudah sambungan yang tertukar.
  const calon = new Map<string, { surah: number; ayat: number }>();
  for (const t of semuaTanda) calon.set(kunciAyat(t.surah, t.ayat), { surah: t.surah, ayat: t.ayat });
  for (const t of semuaTertukar)
    calon.set(kunciAyat(t.surah, t.ayatAsal + 1), { surah: t.surah, ayat: t.ayatAsal + 1 });
  for (const e of sudahDijadwal) calon.delete(e.kunci); // sudah ada di jadwal K-62
  if (!calon.size) return [];

  const bahan = await ambilBahanMurotal([...calon.values()].map((c) => c.surah));
  const batasBaru = new Date(new Date(hari).getTime() - 30 * 86400000).toISOString().slice(0, 10);
  const baru = new Set<string>();
  for (const e of hafalan.values())
    if (!e.lama && e.mulai >= batasBaru)
      for (let a = e.ayatAwal; a <= e.ayatAkhir; a++) baru.add(kunciAyat(e.surah, a));

  const hasil: (AyatPerluPerbaikan & { urut: number })[] = [];
  for (const c of calon.values()) {
    const b = bahan.get(c.surah)!;
    const rekaman = b.rekaman.get(kunciAyat(c.surah, c.ayat));
    if (!rekaman) continue;
    const tandaAyat = b.tandaSalah.filter((t) => t.ayat === c.ayat);
    const tertukar = b.tertukar.get(kunciAyat(c.surah, c.ayat - 1));
    const status = statusRekaman(c.ayat, { rekaman, sesi: b.sesi, tandaSalah: tandaAyat, tertukar });
    if (status !== 'perbaiki') continue;
    const jenis: Record<JenisSalah, number> = { hafalan: 0, panjang: 0, sebut: 0 };
    for (const t of tandaAyat) if (t.terakhir >= rekaman.direkam) jenis[jenisTanda(t)]++;
    const r = rukukAyat(c.surah, c.ayat);
    const diTarget = !!target && dalamTarget(target, c.surah, c.ayat);
    hasil.push({
      surah: c.surah,
      ayat: c.ayat,
      rukuk: r && jadwal.has(r.nomor) ? r.nomor : undefined,
      jenis,
      tertukar: !!tertukar && tertukar.terakhir >= rekaman.direkam,
      target: diTarget,
      urut: diTarget ? 0 : baru.has(kunciAyat(c.surah, c.ayat)) ? 1 : 2,
    });
  }
  return hasil.sort((a, b) => a.urut - b.urut || a.surah - b.surah || a.ayat - b.ayat).map(({ urut: _u, ...x }) => x);
}
