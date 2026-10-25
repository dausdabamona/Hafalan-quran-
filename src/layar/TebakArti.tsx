import { useEffect, useRef, useState } from 'react';
import { Check, Eye, X } from '@phosphor-icons/react';
import { catatTebakArti } from '../db';
import { gulirKe } from '../komponen/gulir';
import Kepala from '../komponen/Kepala';
import TeksAyat from '../komponen/TeksAyat';
import { susunSoalArti, type SoalArti } from '../tebakArti';

type Tahap = 'menebak' | 'periksa';

// Latihan tebak ayat dari arti (K-41): arti tampil, ayat ditebak dan dibaca dari hafalan,
// lalu teks dibuka dan dinilai sendiri. K-67: tanpa rekaman suara.
export default function LayarTebakArti() {
  const [soal, setSoal] = useState<SoalArti[] | null>(null);
  const [indeks, setIndeks] = useState(0);
  const [tahap, setTahap] = useState<Tahap>('menebak');
  const [hasil, setHasil] = useState({ benar: 0, salah: 0 });
  const [menyimpan, setMenyimpan] = useState(false);
  const refJawaban = useRef<HTMLDivElement>(null);

  useEffect(() => {
    susunSoalArti().then(setSoal);
  }, []);

  // Ayat yang baru dibuka langsung tampil di tengah layar.
  useEffect(() => {
    if (tahap === 'periksa') gulirKe(refJawaban.current);
  }, [tahap]);

  if (!soal) return null;
  const kini = soal[indeks];

  const nilai = async (benar: boolean) => {
    setMenyimpan(true);
    await catatTebakArti(kini.surah.nomor, kini.ayat.ayat, benar);
    setMenyimpan(false);
    setHasil((h) => (benar ? { ...h, benar: h.benar + 1 } : { ...h, salah: h.salah + 1 }));
    setTahap('menebak');
    setIndeks((i) => i + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <Kepala judul="Tebak dari arti" sub={kini ? `Soal ${indeks + 1} dari ${soal.length}` : 'Selesai'} />

      {soal.length === 0 && (
        <p className="petunjuk">
          Latihan ini memakai ayat yang sudah dihafal. Tandai hafalan atau selesaikan hafalan baru dulu.
        </p>
      )}

      {soal.length > 0 && !kini && (
        <div className="hasil-koreksi">
          <p className="hasil-besar">Latihan selesai</p>
          <p>
            {hasil.benar} ayat tertebak benar, {hasil.salah} salah.
            {hasil.salah > 0 && ' Ayat yang salah akan didahulukan pada latihan berikutnya.'}
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
            <span>
              {kini.surah.nama}
              {kini.pernahSalah > 0 && <span className="redup"> · pernah salah {kini.pernahSalah}×</span>}
            </span>
          </p>
          <div className="arti-soal">
            <p className="kicker">Arti ayat</p>
            <ol>
              {kini.arti.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ol>
          </div>

          <p className="status-ayat">Ayat manakah ini? Bacalah dari hafalan.</p>
          {tahap === 'periksa' ? (
            <div className="ayat kini" ref={refJawaban}>
              <p className="label-ayat kicker">
                {kini.surah.nama} · ayat {kini.ayat.ayat}
              </p>
              <TeksAyat ayat={kini.ayat} />
            </div>
          ) : (
            <div className="teks-tertutup">Teks tertutup — tebak dan bacalah dulu</div>
          )}
        </div>
      )}

      {kini && (
        <div className="bilah-aksi bilah-ikon-ringkas">
          {tahap === 'menebak' && (
            <button
              type="button"
              className="tombol utama ikon-utama"
              onClick={() => setTahap('periksa')}
              title="Buka ayat"
            >
              <span className="bulat">
                <Eye weight="fill" />
              </span>
              <span className="keterangan">Buka</span>
            </button>
          )}
          {tahap === 'periksa' && (
            <>
              <button
                type="button"
                className="ikon-aksi"
                onClick={() => nilai(false)}
                disabled={menyimpan}
                aria-label="Salah"
                title="Salah"
              >
                <span className="bulat salah">
                  <X weight="bold" />
                </span>
              </button>
              <button
                type="button"
                className="tombol utama ikon-utama"
                onClick={() => nilai(true)}
                disabled={menyimpan}
                title="Benar"
              >
                <span className="bulat">
                  <Check weight="bold" />
                </span>
                <span className="keterangan">Benar</span>
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
