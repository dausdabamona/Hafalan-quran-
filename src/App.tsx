import { useEffect, useState } from 'react';
import { cariSurah } from './data';
import { bacaHash, type Layar } from './navigasi';
import LayarDaftar from './layar/Daftar';
import LayarSurah from './layar/Surah';
import LayarRekam from './layar/Rekam';
import LayarKoreksi from './layar/Koreksi';
import LayarTentang from './layar/Tentang';
import LayarHariIni from './layar/HariIni';
import LayarSambung from './layar/Sambung';
import LayarRukuk from './layar/Rukuk';
import LayarMurotal, { BilahPemutar, LayarPilihMurotal } from './layar/Murotal';
import { hashMurotal } from './murotal';

// ---------- Ukuran huruf Arab (P-15) ----------

const UKURAN_MIN = 22;
const UKURAN_MAX = 48;
const UKURAN_AWAL = 32;

function bacaUkuran(): number {
  try {
    const n = Number(localStorage.getItem('ukuranHuruf'));
    if (n >= UKURAN_MIN && n <= UKURAN_MAX) return n;
  } catch {
    // penyimpanan tidak tersedia: pakai ukuran awal
  }
  return UKURAN_AWAL;
}

export default function App() {
  const [layar, setLayar] = useState<Layar>(bacaHash);
  const [ukuran, setUkuran] = useState(bacaUkuran);

  useEffect(() => {
    const ubah = () => {
      setLayar(bacaHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', ubah);
    return () => window.removeEventListener('hashchange', ubah);
  }, []);

  const aturUkuran = (selisih: number) => {
    setUkuran((u) => {
      const baru = Math.min(UKURAN_MAX, Math.max(UKURAN_MIN, u + selisih));
      try {
        localStorage.setItem('ukuranHuruf', String(baru));
      } catch {
        // abaikan
      }
      return baru;
    });
  };

  return (
    <div className="aplikasi" style={{ ['--ukuran-arab' as string]: `${ukuran}px` }}>
      {layar.nama === 'hari-ini' && <LayarHariIni />}
      {layar.nama === 'daftar' && <LayarDaftar />}
      {layar.nama === 'sambung' && <LayarSambung />}
      {layar.nama === 'surah' && (
        <LayarSurah
          key={layar.nomor}
          surah={cariSurah(layar.nomor)!}
          ayatTuju={layar.ayat}
          aturUkuran={aturUkuran}
        />
      )}
      {layar.nama === 'rekam' && (
        <LayarRekam key={JSON.stringify(layar)} potongan={layar.potongan} rukuk={layar.rukuk} />
      )}
      {layar.nama === 'koreksi' && (
        <LayarKoreksi key={JSON.stringify(layar)} potongan={layar.potongan} rukuk={layar.rukuk} />
      )}
      {layar.nama === 'rukuk' && <LayarRukuk />}
      {layar.nama === 'tentang' && <LayarTentang />}
      {layar.nama === 'pilih-murotal' && <LayarPilihMurotal />}
      {layar.nama === 'murotal' && <LayarMurotal key={hashMurotal(layar.rentang)} rentang={layar.rentang} />}
      <BilahPemutar layarHash={layar.nama === 'murotal' ? hashMurotal(layar.rentang) : ''} />
    </div>
  );
}
