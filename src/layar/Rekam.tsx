import { useEffect, useState } from 'react';
import { ayatPotongan, cariSurah, labelPotongan, type Potongan } from '../data';
import { simpanRekaman } from '../db';
import { ganti, hashPotongan } from '../navigasi';
import { usePerekam } from '../perekam';
import Kepala from '../komponen/Kepala';
import TeksAyat from '../komponen/TeksAyat';

// Rekam berurutan per ayat (K-12, K-14). Teks ayat yang sedang dibaca tertutup
// sampai "Selesai ayat ini" ditekan (K-16); bisa dibuka untuk hafalan baru.
export default function LayarRekam({ potongan, rukuk }: { potongan: Potongan; rukuk?: number }) {
  const surah = cariSurah(potongan.surah)!;
  const daftarAyat = ayatPotongan(surah, potongan);
  const { status, mulai, selesai, lepas } = usePerekam();
  const [indeks, setIndeks] = useState(0);
  const [tampilkanTeks, setTampilkanTeks] = useState(false);
  const [detik, setDetik] = useState(0);
  const [menyimpan, setMenyimpan] = useState(false);

  const ayatKini = daftarAyat[indeks];
  const terakhir = indeks === daftarAyat.length - 1;
  const merekam = status === 'merekam';

  useEffect(() => {
    if (!merekam) return;
    setDetik(0);
    const t = setInterval(() => setDetik((d) => d + 1), 1000);
    return () => clearInterval(t);
  }, [merekam, indeks]);

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

  return (
    <>
      <Kepala
        judul={`${rukuk ? 'Deres' : 'Rekam'} · ${surah.nama}`}
        sub={`${rukuk ? 'Rukuk' : 'Potongan'} ${labelPotongan(potongan)}`}
      />

      <div className="isi-rekam">
        <label className="saklar">
          <input type="checkbox" checked={tampilkanTeks} onChange={(e) => setTampilkanTeks(e.target.checked)} />
          <span>Tampilkan teks saat merekam (untuk hafalan baru)</span>
        </label>

        {daftarAyat.slice(0, indeks).map((a) => (
          <div key={a.ayat} className="ayat selesai">
            <p className="status-ayat">✓ Ayat {a.ayat} tersimpan</p>
            <TeksAyat ayat={a} />
          </div>
        ))}

        <div className={'ayat kini' + (merekam ? ' sedang-rekam' : '')}>
          <p className="status-ayat">
            Ayat {ayatKini.ayat} · {indeks + 1} dari {daftarAyat.length}
            {merekam && <span className="indikator-rekam"> ● {detik} dtk</span>}
          </p>
          {tampilkanTeks ? (
            <TeksAyat ayat={ayatKini} />
          ) : (
            <div className="teks-tertutup">Teks tertutup — bacalah dari hafalan</div>
          )}
        </div>

        {status === 'ditolak' && (
          <p className="pesan-galat">
            Izin mikrofon belum diberikan. Buka Pengaturan HP → Aplikasi → Saku Hati → Izin, lalu aktifkan Mikrofon.
          </p>
        )}
        {status === 'tidak-didukung' && <p className="pesan-galat">Perangkat ini belum mendukung perekaman.</p>}
      </div>

      <div className="bilah-aksi">
        {!merekam ? (
          <button
            className="tombol utama besar"
            onClick={mulai}
            disabled={status === 'meminta-izin' || status === 'tidak-didukung' || menyimpan}
          >
            {status === 'meminta-izin' ? 'Meminta izin mikrofon…' : `🎙 Mulai rekam ayat ${ayatKini.ayat}`}
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
