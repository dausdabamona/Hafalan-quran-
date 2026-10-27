import { ambilBahanMurotal, ambilHafalan, ambilJadwal, kunciAyat } from './db';
import { ayatHafal, type EntriJadwal } from './jadwal';
import {
  daftarAyatRentang,
  sangatLancar,
  statusRekaman,
  type LetakAyat,
  type Rentang,
  type StatusRekaman,
} from './murotal';
import type { ItemMurotal } from './pemutar';
import { ambilTarget, ayatTarget, namaTarget } from './target';

export interface DaftarMurotal {
  siap: ItemMurotal[];
  lain: { letak: LetakAyat; status: Exclude<StatusRekaman, 'siap'> }[];
  jadwal: Map<number, EntriJadwal>;
  lancar: LetakAyat[]; // K-82: ayat target yang sudah sangat lancar (keluar dari putaran)
  namaTarget?: string;
}

async function setAyatTarget(): Promise<{ ayat: Set<string>; nama: string } | null> {
  const t = await ambilTarget();
  return t ? { ayat: new Set(ayatTarget(t)), nama: namaTarget(t) } : null;
}

// Menyusun daftar putar murotal untuk satu rentang.
// K-28: hanya rekaman yang siap (dikoreksi dan bersih).
// K-82: rentang target memakai semua rekaman (benar maupun salah) kecuali ayat yang sudah sangat lancar.
export async function susunMurotal(rentang: Rentang): Promise<DaftarMurotal> {
  const [hafalan, jadwal, target] = await Promise.all([ambilHafalan(), ambilJadwal(), setAyatTarget()]);
  const daftar = daftarAyatRentang(rentang, ayatHafal(hafalan), target?.ayat ?? new Set());
  const bahan = await ambilBahanMurotal(daftar.map((l) => l.surah));
  const hasil: DaftarMurotal = { siap: [], lain: [], jadwal, lancar: [], namaTarget: target?.nama };
  const modeTarget = rentang.jenis === 'target';
  for (const l of daftar) {
    const b = bahan.get(l.surah)!;
    const rekaman = b.rekaman.get(kunciAyat(l.surah, l.ayat));
    const tandaAyat = b.tandaSalah.filter((t) => t.ayat === l.ayat);
    const status = statusRekaman(l.ayat, {
      rekaman,
      sesi: b.sesi,
      tandaSalah: tandaAyat,
      tertukar: b.tertukar.get(kunciAyat(l.surah, l.ayat - 1)),
    });
    if (modeTarget) {
      if (!rekaman) hasil.lain.push({ letak: l, status: 'belum-rekam' });
      else if (sangatLancar(l.surah, l.ayat, jadwal, tandaAyat)) hasil.lancar.push(l);
      else hasil.siap.push({ surah: l.surah, ayat: l.ayat, audio: rekaman.audio, salah: status === 'perbaiki' });
      continue;
    }
    if (status === 'siap') hasil.siap.push({ surah: l.surah, ayat: l.ayat, audio: rekaman!.audio });
    else hasil.lain.push({ letak: l, status });
  }
  return hasil;
}

// K-82: murotal otomatis masuk ke target selama putarannya berisi ayat.
export async function adaPutaranTarget(): Promise<boolean> {
  if (!(await ambilTarget())) return false;
  return (await susunMurotal({ jenis: 'target' })).siap.length > 0;
}
