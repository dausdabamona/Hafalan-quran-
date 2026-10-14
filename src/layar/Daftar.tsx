import { daftarSurah } from '../data';
import { pergi } from '../navigasi';

export default function LayarDaftar() {
  return (
    <>
      <header className="kepala">
        <div className="judul-surah">
          <h1>Saku Hati</h1>
          <p className="sub">Sedikit Ayat, Kuat Ulangnya</p>
        </div>
        <button className="tombol-ikon" onClick={() => pergi('#/tentang')} aria-label="Tentang">
          i
        </button>
      </header>
      <p className="keterangan-daftar">Juz 30 · {daftarSurah.length} surah</p>
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
