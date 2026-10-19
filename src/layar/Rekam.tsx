import { useEffect, useRef, useState } from 'react';
import { Check, Eye, EyeSlash, Microphone } from '@phosphor-icons/react';
import { gulirKe } from '../komponen/gulir';
import { cariSurah, labelPotongan, type Potongan } from '../data';
import { labelDaftarAyat, useAyatMurojaah } from '../komponen/useAyatMurojaah';
import { simpanRekaman } from '../db';
import { ganti, hashPotongan } from '../navigasi';
import { usePerekam } from '../perekam';
import Kepala from '../komponen/Kepala';
import TeksAyat from '../komponen/TeksAyat';

// Rekam berurutan per ayat (K-12, K-14). Teks ayat yang sedang dibaca tertutup
// sampai "Selesai ayat ini" ditekan (K-16); bisa dibuka untuk hafalan baru.
// Sakelar teks ada di bilah bawah agar tetap terjangkau selama merekam (K-39).
export default function LayarRekam({ potongan, rukuk }: { potongan: Potongan; rukuk?: number }) {
  const surah = cariSurah(potongan.surah)!;
  const daftarMuat = useAyatMurojaah(potongan, rukuk);
  const daftarAyat = daftarMuat ?? [];
  const { status, mulai, selesai, lepas } = usePerekam();
  const [indeks, setIndeks] = useState(0);
  const [tampilkanTeks, setTampilkanTeks] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);
  const refKini = useRef<HTMLDivElement>(null);

  const ayatKini = daftarAyat[indeks];
  const terakhir = indeks === daftarAyat.length - 1;
  const merekam = status === 'merekam';

  // Ayat yang sedang direkam selalu tampil di tengah layar.
  useEffect(() => {
    const t = setTimeout(() => gulirKe(refKini.current), 60);
    return () => clearTimeout(t);
  }, [indeks, daftarMuat, merekam, tampilkanTeks]);

  const selesaiAyat = async () => {
    setMenyimpan(true);
    const hasil = await selesai();
    if (hasil) await simpanRekaman(surah.nomor, ayatKini.ayat, hasil.audio, hasil.durasiMs);
    setMenyimpan(false);
    if (terakhir) {
      lepas();
      ganti(hashPotongan('koreksi', potongan, rukuk));
      return;
    }
    setIndeks((i) => i + 1);
    await mulai();
  };

  // Membuang rekaman ayat yang sedang berjalan lalu mulai lagi dari awal ayat itu.
  const ulangiAyat = async () => {
    await selesai();
    await mulai();
  };

  if (!daftarMuat || !ayatKini) return null;

  return (
    <>
      <Kepala
        judul={`${rukuk ? 'Murojaah' : 'Rekam'} · ${surah.nama}`}
        sub={`${rukuk ? 'Rukuk' : 'Potongan'} ${rukuk && daftarAyat.length ? labelDaftarAyat(daftarAyat) : labelPotongan(potongan)}`}
      />

      <div className="isi-rekam">
        {daftarAyat.slice(0, indeks).map((a) => (
          <div key={a.ayat} className="ayat selesai">
            <p className="status-ayat">
              <span>
                <Check weight="duotone" /> Ayat {a.ayat} tersimpan
              </span>
            </p>
            <TeksAyat ayat={a} />
          </div>
        ))}

        <div ref={refKini} className={'ayat kini' + (merekam ? ' sedang-rekam' : '')}>
          <p className="status-ayat">
            <span>
              Ayat {ayatKini.ayat} · {indeks + 1} dari {daftarAyat.length}
              {merekam && <span className="titik-rekam" role="img" aria-label="Sedang merekam" />}
            </span>
          </p>
          {tampilkanTeks ? (
            <TeksAyat ayat={ayatKini} />
          ) : (
            <button type="button" className="teks-tertutup" onClick={() => setTampilkanTeks(true)}>
              Teks tertutup — bacalah dari hafalan
              <span className="buka-teks">
                <Eye weight="duotone" /> Lupa? Ketuk untuk melihat ayat
              </span>
            </button>
          )}
        </div>

        {status === 'ditolak' && (
          <p className="pesan-galat">
            Izin mikrofon belum diberikan. Buka Pengaturan HP → Aplikasi → Saku Hati → Izin, lalu aktifkan Mikrofon.
          </p>
        )}
        {status === 'tidak-didukung' && <p className="pesan-galat">Perangkat ini belum mendukung perekaman.</p>}
      </div>

      <div className="bilah-aksi bilah-rekam">
        <label className="saklar saklar-teks">
          <input type="checkbox" checked={tampilkanTeks} onChange={(e) => setTampilkanTeks(e.target.checked)} />
          <span>{tampilkanTeks ? <Eye weight="duotone" /> : <EyeSlash weight="duotone" />} Tampilkan teks ayat</span>
        </label>
        {!merekam ? (
          <button
            className="tombol utama besar"
            onClick={mulai}
            disabled={status === 'meminta-izin' || status === 'tidak-didukung' || menyimpan}
          >
            {status === 'meminta-izin' ? (
              'Meminta izin mikrofon…'
            ) : (
              <>
                <Microphone weight="duotone" /> Mulai rekam ayat {ayatKini.ayat}
              </>
            )}
          </button>
        ) : (
          <>
            <button className="tombol sekunder" onClick={ulangiAyat} disabled={menyimpan}>
              Ulangi ayat
            </button>
            <button className="tombol utama besar" onClick={selesaiAyat} disabled={menyimpan}>
              {menyimpan ? 'Menyimpan…' : terakhir ? 'Selesai & koreksi' : 'Selesai ayat ini'}
            </button>
          </>
        )}
      </div>
    </>
  );
}
