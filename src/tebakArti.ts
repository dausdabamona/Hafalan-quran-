import { cariSurah, segmenAyat, type Ayat, type Surah } from './data';
import { ambilHafalan, db, type Makna, type TandaArti } from './db';
import { ayatHafal } from './jadwal';

export const JUMLAH_SOAL_ARTI = 10;

export interface SoalArti {
  surah: Surah;
  ayat: Ayat;
  arti: string[]; // makna per potongan waqaf
  pernahSalah: number; // jumlah salah yang belum "ditebus" tebakan benar
}

// Tanda yang masih berlaku: pernah salah dan belum ditebak benar sesudahnya.
export function masihSalah(t: TandaArti | undefined): boolean {
  return !!t && (!t.benar || t.benar < t.terakhir);
}

// Urutan soal (K-41): ayat yang masih bertanda salah lebih dulu (paling sering salah
// paling depan), sisanya diacak. acak dapat diganti untuk uji.
export function urutkanSoal(
  hafal: string[],
  tanda: Map<string, TandaArti>,
  jumlah = JUMLAH_SOAL_ARTI,
  acak: () => number = Math.random,
): string[] {
  const bertanda = hafal
    .filter((k) => masihSalah(tanda.get(k)))
    .sort((a, b) => tanda.get(b)!.jumlah - tanda.get(a)!.jumlah);
  const lain = hafal.filter((k) => !masihSalah(tanda.get(k)));
  for (let i = lain.length - 1; i > 0; i--) {
    const j = Math.floor(acak() * (i + 1));
    [lain[i], lain[j]] = [lain[j], lain[i]];
  }
  return [...bertanda, ...lain].slice(0, jumlah);
}

// Arti ayat per potongan waqaf; makna yang disunting pengguna (K-25) didahulukan.
export function artiAyat(surah: number, ayat: Ayat, makna: Map<string, Makna>): string[] {
  return segmenAyat(ayat)
    .map((s) => makna.get(`${surah}:${ayat.ayat}:${s.indeks}`)?.isi ?? s.maknaBawaan)
    .filter((t) => t.trim() !== '');
}

export async function susunSoalArti(): Promise<SoalArti[]> {
  const [hafalan, tanda] = await Promise.all([ambilHafalan(), db.tandaArti.toArray()]);
  const petaTanda = new Map(tanda.map((t) => [t.kunci, t]));
  const kunci = urutkanSoal([...ayatHafal(hafalan)], petaTanda);
  const hasil: SoalArti[] = [];
  for (const k of kunci) {
    const [s, a] = k.split(':').map(Number);
    const surah = cariSurah(s);
    const ayat = surah?.ayat[a - 1];
    if (!surah || !ayat) continue;
    const makna = await db.makna.where('[surah+ayat]').equals([s, a]).toArray();
    const arti = artiAyat(s, ayat, new Map(makna.map((m) => [m.kunci, m])));
    if (arti.length === 0) continue;
    const t = petaTanda.get(k);
    hasil.push({ surah, ayat, arti, pernahSalah: masihSalah(t) ? t!.jumlah : 0 });
  }
  return hasil;
}
