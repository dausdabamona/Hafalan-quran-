import { daftarSurah } from '../data';
import { pergi } from '../navigasi';
import Kepala from '../komponen/Kepala';

export default function LayarDaftar() {
  return (
    <>
      <Kepala judul="Semua surah" sub={`Juz 30 · ${daftarSurah.length} surah`} />
      <ul className="daftar-surah">
        {daftarSurah.map((s) => (
          <li key={s.nomor}>
            <button className="baris-surah" onClick={() => pergi(`#/surah/${s.nomor}`)}>
              <span className="nomor">{s.nomor}</span>
              <span className="info">
                <span className="nama">{s.nama}</span>
                <span className="detail">{s.arti}</span>
                <span className="detail">{s.jumlahAyat} ayat</span>
              </span>
              <span className="nama-arab" lang="ar" dir="rtl">
                {s.namaArab}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
