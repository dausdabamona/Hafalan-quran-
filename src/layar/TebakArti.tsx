import { useEffect, useRef, useState } from 'react';
import { Check, Eye, Microphone, X } from '@phosphor-icons/react';
import { catatTebakArti } from '../db';
import { gulirKe } from '../komponen/gulir';
import Kepala from '../komponen/Kepala';
import TeksAyat from '../komponen/TeksAyat';
import TombolPutar from '../komponen/TombolPutar';
import { usePerekam } from '../perekam';
import { susunSoalArti, type SoalArti } from '../tebakArti';

type Tahap = 'menebak' | 'merekam' | 'periksa';

// Latihan tebak ayat dari arti (K-41): arti tampil, ayat ditebak sambil direkam, lalu
// teks dibuka dan dinilai sendiri. Rekaman tebakan hanya untuk didengar, tidak disimpan.
export default function LayarTebakArti() {
  const [soal, setSoal] = useState<SoalArti[] | null>(null);
  const [indeks, setIndeks] = useState(0);
  const [tahap, setTahap] = useState<Tahap>('menebak');
  const [rekaman, setRekaman] = useState<Blob>();
  const [hasil, setHasil] = useState({ benar: 0, salah: 0 });
  const [menyimpan, setMenyimpan] = useState(false);
  const { status, mulai, selesai, lepas } = usePerekam();
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

  const mulaiRekam = async () => {
    if (await mulai()) setTahap('merekam');
  };

  const selesaiRekam = async () => {
    const h = await selesai();
    setRekaman(h?.audio);
    setTahap('periksa');
  };

  const nilai = async (benar: boolean) => {
    setMenyimpan(true);
    await catatTebakArti(kini.surah.nomor, kini.ayat.ayat, benar);
    setMenyimpan(false);
    setHasil((h) => (benar ? { ...h, benar: h.benar + 1 } : { ...h, salah: h.salah + 1 }));
    setRekaman(undefined);
    setTahap('menebak');
    setIndeks((i) => i + 1);
    if (indeks + 1 >= soal.length) lepas();
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
              {tahap === 'merekam' && <span className="titik-rekam" role="img" aria-label="Sedang merekam" />}
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
              {rekaman && (
                <div className="kaki-ayat">
                  <TombolPutar audio={rekaman} label="Dengar bacaan Anda" />
                </div>
              )}
            </div>
          ) : (
            <div className="teks-tertutup">
              {tahap === 'merekam' ? 'Sedang merekam — bacalah ayatnya' : 'Teks tertutup — tebak dan bacalah dulu'}
            </div>
          )}

          {status === 'ditolak' && (
            <p className="pesan-galat">
              Izin mikrofon belum diberikan. Buka Pengaturan HP → Aplikasi → Saku Hati → Izin, lalu aktifkan Mikrofon.
            </p>
          )}
        </div>
      )}

      {kini && (
        <div className="bilah-aksi">
          {tahap === 'menebak' && (
            <>
              <button className="tombol sekunder" onClick={() => setTahap('periksa')}>
                <Eye weight="duotone" /> Buka ayat
              </button>
              <button
                className="tombol utama besar"
                onClick={mulaiRekam}
                disabled={status === 'meminta-izin' || status === 'tidak-didukung'}
              >
                <Microphone weight="duotone" /> {status === 'meminta-izin' ? 'Meminta izin…' : 'Rekam tebakan'}
              </button>
            </>
          )}
          {tahap === 'merekam' && (
            <button className="tombol utama besar" onClick={selesaiRekam}>
              <Check weight="duotone" /> Selesai & buka ayat
            </button>
          )}
          {tahap === 'periksa' && (
            <>
              <button className="tombol sekunder" onClick={() => nilai(false)} disabled={menyimpan}>
                <X weight="duotone" /> Salah
              </button>
              <button className="tombol utama besar" onClick={() => nilai(true)} disabled={menyimpan}>
                <Check weight="duotone" /> Benar
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
