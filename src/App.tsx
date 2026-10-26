import { useEffect, useState } from 'react';
import BilahSamping from './komponen/BilahSamping';
import BilahTab, { LAYAR_BERTAB } from './komponen/BilahTab';
import LayarLainnya from './layar/Lainnya';
import LayarKemajuan from './layar/Kemajuan';
import LayarTarget from './layar/Target';
import { cariSurah } from './data';
import { bacaHash, pergi, type Layar } from './navigasi';
import LayarDaftar from './layar/Daftar';
import LayarSurah from './layar/Surah';
import LayarRekam from './layar/Rekam';
import LayarKoreksi from './layar/Koreksi';
import LayarTentang from './layar/Tentang';
import LayarHariIni from './layar/HariIni';
import LayarSambung from './layar/Sambung';
import LayarTebakArti from './layar/TebakArti';
import LayarRukuk from './layar/Rukuk';
import LayarMurotal, { BilahPemutar, LayarPilihMurotal } from './layar/Murotal';
import { hashMurotal } from './murotal';
import LayarPengingat from './layar/Pengingat';
import LayarSinkron from './layar/Sinkron';
import LayarCadangan from './layar/Cadangan';
import LayarDataHadits from './layar/DataHadits';
import { LayarBagianHadits, LayarDaftarHadits, LayarHadits, LayarKitabHadits } from './layar/Hadits';
import { mulaiPusatOtomatis, mulaiSinkronOtomatis } from './sinkron/peran';
import { Pengingat, pengingatTersedia, sinkronAyatKartu } from './pengingat';

// ---------- Ukuran huruf Arab (P-15) ----------

const UKURAN_MIN = 22;
const UKURAN_MAX = 48;
const UKURAN_AWAL = 34;

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

  // K-37: pusat sinkron (HP) dan sinkron otomatis (Windows).
  useEffect(() => {
    mulaiPusatOtomatis();
    return mulaiSinkronOtomatis();
  }, []);

  // K-32: buka ayat dari kartu pengingat; perbarui daftar ayat kartu saat aplikasi ditinggalkan.
  useEffect(() => {
    if (!pengingatTersedia()) return;
    const cekTujuan = () =>
      Pengingat.ambilTujuan()
        .then((t) => t.tujuan && pergi(t.tujuan))
        .catch(() => undefined);
    const ubah = () => {
      if (document.visibilityState === 'visible') cekTujuan();
      else
        Pengingat.cekIzin()
          .then(async (s) => {
            if (s.aktif) await sinkronAyatKartu();
          })
          .catch(() => undefined);
    };
    cekTujuan();
    document.addEventListener('visibilitychange', ubah);
    return () => document.removeEventListener('visibilitychange', ubah);
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
    <div className="kerangka">
      <BilahSamping layar={layar.nama} />
      <div
        className={'aplikasi bertab' + (LAYAR_BERTAB.includes(layar.nama) ? ' layar-tab' : '')}
        style={{ ['--ukuran-arab' as string]: `${ukuran}px` }}
      >
        {layar.nama === 'hari-ini' && <LayarHariIni />}
        {layar.nama === 'daftar' && <LayarDaftar />}
        {layar.nama === 'sambung' && <LayarSambung />}
        {layar.nama === 'tebak-arti' && <LayarTebakArti />}
        {layar.nama === 'surah' && (
          <LayarSurah
            key={layar.nomor}
            surah={cariSurah(layar.nomor)!}
            ayatTuju={layar.ayat}
            tandaiAwal={layar.tandai}
            aturUkuran={aturUkuran}
          />
        )}
        {layar.nama === 'rekam' && (
          <LayarRekam
            key={JSON.stringify(layar)}
            potongan={layar.potongan}
            rukuk={layar.rukuk}
            perbaikan={layar.perbaikan}
          />
        )}
        {layar.nama === 'koreksi' && (
          <LayarKoreksi
            key={JSON.stringify(layar)}
            potongan={layar.potongan}
            rukuk={layar.rukuk}
            sampai={layar.sampai}
            perbaikan={layar.perbaikan}
          />
        )}
        {layar.nama === 'rukuk' && <LayarRukuk />}
        {layar.nama === 'tentang' && <LayarTentang />}
        {layar.nama === 'lainnya' && <LayarLainnya />}
        {layar.nama === 'kemajuan' && <LayarKemajuan />}
        {layar.nama === 'target' && <LayarTarget />}
        {layar.nama === 'pilih-murotal' && <LayarPilihMurotal />}
        {layar.nama === 'pengingat' && <LayarPengingat />}
        {layar.nama === 'sinkron' && <LayarSinkron />}
        {layar.nama === 'cadangan' && <LayarCadangan />}
        {layar.nama === 'data-hadits' && <LayarDataHadits />}
        {layar.nama === 'kitab-hadits' && <LayarKitabHadits />}
        {layar.nama === 'bagian-hadits' && <LayarBagianHadits key={layar.kitab} kitab={layar.kitab} />}
        {layar.nama === 'daftar-hadits' && (
          <LayarDaftarHadits key={`${layar.kitab}:${layar.bagian}`} kitab={layar.kitab} bagian={layar.bagian} />
        )}
        {layar.nama === 'hadits' && <LayarHadits kitab={layar.kitab} nomor={layar.nomor} />}
        {layar.nama === 'murotal' && (
          <LayarMurotal key={hashMurotal(layar.rentang)} rentang={layar.rentang} putar={layar.putar} />
        )}
        <BilahTab layar={layar.nama} />
        <BilahPemutar layarHash={layar.nama === 'murotal' ? hashMurotal(layar.rentang) : ''} />
      </div>
    </div>
  );
}
