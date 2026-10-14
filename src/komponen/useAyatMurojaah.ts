import { useEffect, useState } from 'react';
import { ayatPotongan, cariSurah, type Ayat, type Potongan } from '../data';
import { ambilHafalan } from '../db';
import { ayatHafal } from '../jadwal';

// Daftar ayat untuk layar Rekam dan Koreksi. Pada murojaah rukuk hanya ayat yang
// sudah hafal yang diambil, meskipun tidak berurutan (K-30). Null selama memuat.
export function useAyatMurojaah(potongan: Potongan, rukuk?: number): Ayat[] | null {
  const surah = cariSurah(potongan.surah)!;
  const semua = ayatPotongan(surah, potongan);
  const [daftar, setDaftar] = useState<Ayat[] | null>(rukuk ? null : semua);
  const kunci = `${potongan.surah}:${potongan.ayatAwal}-${potongan.ayatAkhir}:${rukuk ?? ''}`;

  useEffect(() => {
    if (!rukuk) {
      setDaftar(ayatPotongan(cariSurah(potongan.surah)!, potongan));
      return;
    }
    let batal = false;
    ambilHafalan().then((h) => {
      if (batal) return;
      const hafal = ayatHafal(h);
      const semuaAyat = ayatPotongan(cariSurah(potongan.surah)!, potongan);
      const saring = semuaAyat.filter((a) => hafal.has(`${potongan.surah}:${a.ayat}`));
      setDaftar(saring.length ? saring : semuaAyat);
    });
    return () => {
      batal = true;
    };
  }, [kunci]); // eslint-disable-line react-hooks/exhaustive-deps

  return daftar;
}

export function labelDaftarAyat(daftar: Ayat[]): string {
  // "ayat 1–3, 7–9" untuk ayat yang tidak berurutan
  const bagian: string[] = [];
  let awal = daftar[0]?.ayat;
  for (let i = 0; i < daftar.length; i++) {
    const kini = daftar[i].ayat;
    const berikut = daftar[i + 1]?.ayat;
    if (berikut !== kini + 1) {
      bagian.push(awal === kini ? `${kini}` : `${awal}–${kini}`);
      awal = berikut;
    }
  }
  return `ayat ${bagian.join(', ')}`;
}
