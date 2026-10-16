import { ambilBahanMurotal, ambilHafalan, ambilJadwal, kunciAyat } from './db';
import { ayatHafal, type EntriJadwal } from './jadwal';
import { daftarAyatRentang, statusRekaman, type LetakAyat, type Rentang, type StatusRekaman } from './murotal';
import type { ItemMurotal } from './pemutar';

export interface DaftarMurotal {
  siap: ItemMurotal[];
  lain: { letak: LetakAyat; status: Exclude<StatusRekaman, 'siap'> }[];
  jadwal: Map<number, EntriJadwal>;
}

// Menyusun daftar putar murotal untuk satu rentang (K-28): hanya rekaman yang siap.
export async function susunMurotal(rentang: Rentang): Promise<DaftarMurotal> {
  const [hafalan, jadwal] = await Promise.all([ambilHafalan(), ambilJadwal()]);
  const daftar = daftarAyatRentang(rentang, ayatHafal(hafalan));
  const bahan = await ambilBahanMurotal(daftar.map((l) => l.surah));
  const hasil: DaftarMurotal = { siap: [], lain: [], jadwal };
  for (const l of daftar) {
    const b = bahan.get(l.surah)!;
    const rekaman = b.rekaman.get(kunciAyat(l.surah, l.ayat));
    const status = statusRekaman(l.ayat, {
      rekaman,
      sesi: b.sesi,
      tandaSalah: b.tandaSalah.filter((t) => t.ayat === l.ayat),
      tertukar: b.tertukar.get(kunciAyat(l.surah, l.ayat - 1)),
    });
    if (status === 'siap') hasil.siap.push({ surah: l.surah, ayat: l.ayat, audio: rekaman!.audio });
    else hasil.lain.push({ letak: l, status });
  }
  return hasil;
}
