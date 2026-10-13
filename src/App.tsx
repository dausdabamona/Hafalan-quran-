import { useCallback, useEffect, useState } from 'react';
import {
  angkaArab,
  cariSurah,
  daftarSurah,
  dataJuz30,
  susunToken,
  teksBasmalah,
  type Ayat,
  type Kata,
  type Surah,
} from './data';
import { ambilKeteranganSurah, kunciKeterangan, simpanKeterangan, type Keterangan } from './db';

// ---------- Navigasi berbasis hash: tombol kembali Android ikut berfungsi ----------

type Layar = { nama: 'daftar' } | { nama: 'surah'; nomor: number } | { nama: 'tentang' };

function bacaHash(): Layar {
  const h = window.location.hash;
  const cocok = /^#\/surah\/(\d+)$/.exec(h);
  if (cocok && cariSurah(Number(cocok[1]))) return { nama: 'surah', nomor: Number(cocok[1]) };
  if (h === '#/tentang') return { nama: 'tentang' };
  return { nama: 'daftar' };
}

function pergi(hash: string) {
  window.location.hash = hash;
}

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
      {layar.nama === 'daftar' && <LayarDaftar />}
      {layar.nama === 'surah' && <LayarSurah surah={cariSurah(layar.nomor)!} aturUkuran={aturUkuran} />}
      {layar.nama === 'tentang' && <LayarTentang />}
    </div>
  );
}

// ---------- Layar daftar surah ----------

function LayarDaftar() {
  return (
    <>
      <header className="kepala">
        <div>
          <h1>Rabth</h1>
          <p className="sub">Hafalan Juz 30 · {daftarSurah.length} surah</p>
        </div>
        <button className="tombol-ikon" onClick={() => pergi('#/tentang')} aria-label="Tentang">
          i
        </button>
      </header>
      <ul className="daftar-surah">
        {daftarSurah.map((s) => (
          <li key={s.nomor}>
            <button className="baris-surah" onClick={() => pergi(`#/surah/${s.nomor}`)}>
              <span className="nomor">{s.nomor}</span>
              <span className="info">
                <span className="nama">{s.nama}</span>
                <span className="detail">
                  {s.arti} · {s.jumlahAyat} ayat
                </span>
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

// ---------- Layar surah: ayat per kata ----------

type Pilihan = { ayat: Ayat; kata: Kata | null }; // kata null = keterangan ayat

function LayarSurah({ surah, aturUkuran }: { surah: Surah; aturUkuran: (s: number) => void }) {
  const [keterangan, setKeterangan] = useState<Map<string, Keterangan>>(new Map());
  const [pilihan, setPilihan] = useState<Pilihan | null>(null);

  const muat = useCallback(async () => {
    setKeterangan(await ambilKeteranganSurah(surah.nomor));
  }, [surah.nomor]);

  useEffect(() => {
    muat();
  }, [muat]);

  const basmalah = surah.ayat[0] ? teksBasmalah(surah.ayat[0]) : null;

  return (
    <>
      <header className="kepala">
        <button className="tombol-ikon" onClick={() => history.back()} aria-label="Kembali">
          ‹
        </button>
        <div className="judul-surah">
          <h1>{surah.nama}</h1>
          <p className="sub">
            {surah.arti} · {surah.jumlahAyat} ayat
          </p>
        </div>
        <div className="atur-huruf">
          <button className="tombol-ikon kecil" onClick={() => aturUkuran(-2)} aria-label="Perkecil huruf">
            A−
          </button>
          <button className="tombol-ikon kecil" onClick={() => aturUkuran(2)} aria-label="Perbesar huruf">
            A+
          </button>
        </div>
      </header>

      {basmalah && (
        <p className="basmalah" lang="ar" dir="rtl">
          {basmalah}
        </p>
      )}

      <ol className="daftar-ayat">
        {surah.ayat.map((a) => {
          const ketAyat = keterangan.get(kunciKeterangan(surah.nomor, a.ayat, 0));
          return (
            <li key={a.ayat} className="ayat">
              <div className="teks-ayat" lang="ar" dir="rtl">
                {susunToken(a).map((t, i) =>
                  t.kata ? (
                    <button
                      key={i}
                      className={
                        'kata' + (keterangan.has(kunciKeterangan(surah.nomor, a.ayat, t.kata.urutan)) ? ' ada-catatan' : '')
                      }
                      onClick={() => setPilihan({ ayat: a, kata: t.kata })}
                    >
                      {t.teks}
                    </button>
                  ) : (
                    <span key={i} className="tanda">
                      {t.teks}
                    </span>
                  ),
                )}
                <span className="nomor-ayat">{angkaArab(a.ayat)}</span>
              </div>
              <div className="kaki-ayat">
                <button className="tautan" onClick={() => setPilihan({ ayat: a, kata: null })}>
                  {ketAyat ? 'Keterangan ayat ✎' : '+ Keterangan ayat'}
                </button>
                {ketAyat && <p className="catatan-ayat">{ketAyat.isi}</p>}
              </div>
            </li>
          );
        })}
      </ol>

      {pilihan && (
        <LembarKata
          surah={surah}
          pilihan={pilihan}
          keterangan={keterangan}
          tutup={() => setPilihan(null)}
          sesudahSimpan={muat}
        />
      )}
    </>
  );
}

// ---------- Lembar bawah: arti kata + keterangan pribadi ----------

function LembarKata({
  surah,
  pilihan,
  keterangan,
  tutup,
  sesudahSimpan,
}: {
  surah: Surah;
  pilihan: Pilihan;
  keterangan: Map<string, Keterangan>;
  tutup: () => void;
  sesudahSimpan: () => Promise<void>;
}) {
  const urutan = pilihan.kata?.urutan ?? 0;
  const kunci = kunciKeterangan(surah.nomor, pilihan.ayat.ayat, urutan);
  const [isi, setIsi] = useState(keterangan.get(kunci)?.isi ?? '');
  const [menyimpan, setMenyimpan] = useState(false);

  const simpan = async () => {
    setMenyimpan(true);
    await simpanKeterangan(surah.nomor, pilihan.ayat.ayat, urutan, isi);
    await sesudahSimpan();
    setMenyimpan(false);
    tutup();
  };

  return (
    <div className="latar-lembar" onClick={tutup}>
      <div className="lembar" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="pegangan" />
        <p className="lokasi">
          {surah.nama} · ayat {pilihan.ayat.ayat}
          {pilihan.kata ? ` · kata ke-${pilihan.kata.urutan}` : ''}
        </p>
        {pilihan.kata && (
          <>
            <p className="kata-besar" lang="ar" dir="rtl">
              {pilihan.kata.teks}
            </p>
            <p className="arti">{pilihan.kata.arti}</p>
          </>
        )}
        <label className="label-catatan" htmlFor="catatan">
          {pilihan.kata ? 'Keterangan kata' : 'Keterangan ayat'}
        </label>
        <textarea
          id="catatan"
          value={isi}
          onChange={(e) => setIsi(e.target.value)}
          placeholder="Tulis catatan pribadi Anda di sini"
          rows={4}
        />
        <div className="aksi-lembar">
          <button className="tombol sekunder" onClick={tutup}>
            Tutup
          </button>
          <button className="tombol utama" onClick={simpan} disabled={menyimpan}>
            {menyimpan ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Layar tentang: atribusi sumber data ----------

function LayarTentang() {
  return (
    <>
      <header className="kepala">
        <button className="tombol-ikon" onClick={() => history.back()} aria-label="Kembali">
          ‹
        </button>
        <div className="judul-surah">
          <h1>Tentang</h1>
          <p className="sub">Sumber data dan lisensi</p>
        </div>
      </header>
      <section className="tentang">
        <h2>Teks Al-Qur'an</h2>
        <p>
          Teks Utsmani Mushaf Madinah dari Tanzil Project, dipakai tanpa perubahan di bawah lisensi Creative Commons
          Attribution 3.0. Pembaruan teks dapat dipantau di <a href="https://tanzil.net">tanzil.net</a>.
        </p>
        <h2>Arti per kata</h2>
        <p>
          Terjemahan per kata bahasa Indonesia dari <a href="https://quran.com">Quran.com</a>, untuk pemakaian pribadi.
        </p>
        <h2>Catatan lisensi Tanzil</h2>
        <pre className="lisensi">{dataJuz30.sumber.lisensiTanzil}</pre>
      </section>
    </>
  );
}
