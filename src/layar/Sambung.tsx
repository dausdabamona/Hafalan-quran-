import { useEffect, useRef, useState } from 'react';
import { Check } from '@phosphor-icons/react';
import { gulirKe } from '../komponen/gulir';
import { cariSurah, type Ayat, type Surah } from '../data';
import { ambilHafalan, db, tandaiTertukarLatihan } from '../db';
import { ayatHafal } from '../jadwal';
import Kepala from '../komponen/Kepala';
import TeksAyat from '../komponen/TeksAyat';

const JUMLAH_SOAL = 10;

interface Soal {
  surah: Surah;
  asal: Ayat;
  berikut: Ayat;
  pernah: number; // jumlah tanda tertukar sebelumnya
}

// Sambungan ayat yang kedua ayatnya sudah masuk hafalan. Yang pernah tertukar
// didahulukan (paling sering lebih dulu), sisanya diacak (K-17).
async function susunSoal(): Promise<Soal[]> {
  const [hafalan, tertukar] = await Promise.all([ambilHafalan(), db.tandaTertukar.toArray()]);
  const hafal = ayatHafal(hafalan);
  const pernah = new Map(tertukar.map((t) => [t.kunci, t.jumlah]));
  const semua: Soal[] = [];
  for (const kunci of hafal) {
    const [s, a] = kunci.split(':').map(Number);
    if (!hafal.has(`${s}:${a + 1}`)) continue;
    const surah = cariSurah(s)!;
    semua.push({ surah, asal: surah.ayat[a - 1], berikut: surah.ayat[a], pernah: pernah.get(kunci) ?? 0 });
  }
  const bertanda = semua.filter((x) => x.pernah > 0).sort((x, y) => y.pernah - x.pernah);
  const lain = semua.filter((x) => x.pernah === 0);
  for (let i = lain.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [lain[i], lain[j]] = [lain[j], lain[i]];
  }
  return [...bertanda, ...lain].slice(0, JUMLAH_SOAL);
}

export default function LayarSambung() {
  const [soal, setSoal] = useState<Soal[] | null>(null);
  const [indeks, setIndeks] = useState(0);
  const [terbuka, setTerbuka] = useState(false);
  const [modeTertukar, setModeTertukar] = useState(false);
  const [keliru, setKeliru] = useState(0);
  const [hasil, setHasil] = useState({ lancar: 0, tertukar: 0 });
  const refJawaban = useRef<HTMLDivElement>(null);

  // Jawaban yang baru dibuka langsung tampil di tengah layar.
  useEffect(() => {
    if (terbuka) gulirKe(refJawaban.current);
  }, [terbuka]);

  useEffect(() => {
    susunSoal().then(setSoal);
  }, []);

  if (!soal) return null;

  const lanjut = () => {
    setIndeks((i) => i + 1);
    setTerbuka(false);
    setModeTertukar(false);
    setKeliru(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const kini = soal[indeks];

  return (
    <>
      <Kepala judul="Sambung ayat" sub={kini ? `Soal ${indeks + 1} dari ${soal.length}` : 'Selesai'} />

      {soal.length === 0 && (
        <p className="petunjuk">
          Latihan ini membutuhkan minimal dua ayat berurutan yang sudah lancar dihafal. Lanjutkan hafalan baru dulu.
        </p>
      )}

      {soal.length > 0 && !kini && (
        <div className="hasil-koreksi">
          <p className="hasil-besar">Latihan selesai</p>
          <p>
            {hasil.lancar} sambungan lancar, {hasil.tertukar} tertukar. Sambungan yang tertukar sudah ditandai dan masuk
            ulang hafalan besok.
          </p>
          <div className="aksi-lembar">
            <button className="tombol utama" onClick={() => history.back()}>
              Kembali
            </button>
          </div>
        </div>
      )}

      {kini && (
        <div className="isi-rekam">
          <p className="status-ayat">
            {kini.surah.nama} · ayat {kini.asal.ayat}
            {kini.pernah > 0 && <span className="redup"> · pernah tertukar {kini.pernah}×</span>}
          </p>
          <div className="ayat">
            <TeksAyat ayat={kini.asal} />
          </div>

          <p className="status-ayat">Ayat sesudahnya ({kini.berikut.ayat})?</p>
          {terbuka ? (
            <div className="ayat kini" ref={refJawaban}>
              <TeksAyat ayat={kini.berikut} />
            </div>
          ) : (
            <div className="teks-tertutup">Bacalah dari hafalan, lalu buka jawabannya</div>
          )}

          {modeTertukar && (
            <div className="sambungan tertukar">
              <span className="pilih-keliru">
                terbaca ayat
                <select value={keliru} onChange={(e) => setKeliru(Number(e.target.value))}>
                  <option value={0}>tidak yakin</option>
                  {kini.surah.ayat
                    .filter((a) => a.ayat !== kini.berikut.ayat && a.ayat !== kini.asal.ayat)
                    .map((a) => (
                      <option key={a.ayat} value={a.ayat}>
                        {a.ayat}
                      </option>
                    ))}
                </select>
              </span>
            </div>
          )}
        </div>
      )}

      {kini && (
        <div className="bilah-aksi">
          {!terbuka ? (
            <button className="tombol utama besar" onClick={() => setTerbuka(true)}>
              Buka jawaban
            </button>
          ) : !modeTertukar ? (
            <>
              <button className="tombol sekunder" onClick={() => setModeTertukar(true)}>
                Tertukar
              </button>
              <button
                className="tombol utama besar"
                onClick={() => {
                  setHasil((h) => ({ ...h, lancar: h.lancar + 1 }));
                  lanjut();
                }}
              >
                <Check weight="duotone" /> Lancar
              </button>
            </>
          ) : (
            <>
              <button className="tombol sekunder" onClick={() => setModeTertukar(false)}>
                Batal
              </button>
              <button
                className="tombol utama besar"
                onClick={async () => {
                  await tandaiTertukarLatihan(kini.surah.nomor, kini.asal.ayat, keliru);
                  setHasil((h) => ({ ...h, tertukar: h.tertukar + 1 }));
                  lanjut();
                }}
              >
                Simpan & lanjut
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
