import { daftarJuz, daftarSurah } from '../data';
import { pergi } from '../navigasi';
import Kepala from '../komponen/Kepala';

// Daftar 114 surah, dengan judul juz di surah tempat juz itu dimulai.
export default function LayarDaftar() {
  return (
    <>
      <Kepala judul="Semua surah" sub="30 juz · 114 surah" />
      <ul className="daftar-surah">
        {daftarSurah.map((s) => {
          const juzMulai = daftarJuz.filter((j) => j.surah === s.nomor);
          return (
            <li key={s.nomor}>
              {juzMulai.map((j) => (
                <p key={j.nomor} className="judul-juz">
                  Juz {j.nomor}
                  {j.ayat > 1 ? ` · mulai ${s.nama} ayat ${j.ayat}` : ''}
                </p>
              ))}
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
          );
        })}
      </ul>
    </>
  );
}
