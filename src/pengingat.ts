import { Capacitor, registerPlugin } from '@capacitor/core';
import { cariSurah, daftarSurah, segmenAyat, susunToken } from './data';
import { ambilHafalan, db } from './db';
import { ayatHafal } from './jadwal';

// Pengingat ayat (K-32): kartu ayat hafalan tampil di atas aplikasi media sosial.
// Bagian Android ada di android/app/src/main/java/id/dabamona/rabth/.

interface StatusPengingat {
  overlay: boolean;
  penggunaan: boolean;
  aktif: boolean;
  jedaMenit: number;
  paket: string;
}

interface AyatKartu {
  surah: number;
  ayat: number;
  nama: string;
  teks: string;
  makna: string;
  bobot: number;
}

interface PluginPengingat {
  cekIzin(): Promise<StatusPengingat>;
  bukaSetelanOverlay(): Promise<void>;
  bukaSetelanPenggunaan(): Promise<void>;
  simpanAyat(o: { daftar: AyatKartu[] }): Promise<{ jumlah: number }>;
  atur(o: { aktif: boolean; jedaMenit: number; paket: string }): Promise<void>;
  coba(): Promise<void>;
  ambilTujuan(): Promise<{ tujuan: string }>;
}

export const Pengingat = registerPlugin<PluginPengingat>('PengingatAyat');

export function pengingatTersedia(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export const APLIKASI_PEMICU = [
  { nama: 'Facebook', paket: ['com.facebook.katana', 'com.facebook.lite'] },
  { nama: 'YouTube', paket: ['com.google.android.youtube'] },
  { nama: 'Instagram', paket: ['com.instagram.android'] },
  { nama: 'Chrome', paket: ['com.android.chrome'] },
  { nama: 'TikTok', paket: ['com.zhiliaoapp.musically', 'com.ss.android.ugc.trill', 'com.zhiliaoapp.musically.go'] },
];

export const PAKET_BAWAAN = APLIKASI_PEMICU.flatMap((a) => a.paket).join(',');

// Daftar ayat yang sudah dihafal beserta maknanya. Ayat yang pernah salah berbobot 3.
export async function susunAyatKartu(): Promise<AyatKartu[]> {
  const [hafalan, makna, salah] = await Promise.all([
    ambilHafalan(),
    db.makna.toArray(),
    db.tandaSalah.toArray(),
  ]);
  const hafal = ayatHafal(hafalan);
  const maknaEdit = new Map(makna.map((m) => [m.kunci, m.isi]));
  const pernahSalah = new Set(salah.map((t) => `${t.surah}:${t.ayat}`));
  const hasil: AyatKartu[] = [];
  for (const s of daftarSurah) {
    for (let n = 1; n <= s.jumlahAyat; n++) {
      const kunci = `${s.nomor}:${n}`;
      if (!hafal.has(kunci)) continue;
      const a = s.ayat[n - 1];
      hasil.push({
        surah: s.nomor,
        ayat: n,
        nama: cariSurah(s.nomor)!.nama,
        teks: susunToken(a)
          .map((t) => t.teks)
          .join(' '),
        makna: segmenAyat(a)
          .map((g) => maknaEdit.get(`${s.nomor}:${n}:${g.indeks}`) ?? g.maknaBawaan)
          .join(' · '),
        bobot: pernahSalah.has(kunci) ? 3 : 1,
      });
    }
  }
  return hasil;
}

export async function sinkronAyatKartu(): Promise<number> {
  if (!pengingatTersedia()) return 0;
  const daftar = await susunAyatKartu();
  const h = await Pengingat.simpanAyat({ daftar });
  return h.jumlah;
}
