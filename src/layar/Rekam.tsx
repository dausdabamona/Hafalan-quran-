import { useEffect, useRef, useState } from 'react';
import {
  ArrowCounterClockwise,
  ArrowUUpLeft,
  Check,
  CheckCircle,
  Eye,
  EyeSlash,
  Microphone,
  StopCircle,
} from '@phosphor-icons/react';
import { gulirKe } from '../komponen/gulir';
import { cariSurah, labelPotongan, segmenAyat, type Potongan } from '../data';
import { labelDaftarAyat, useAyatMurojaah } from '../komponen/useAyatMurojaah';
import { ambilMaknaSurah, simpanRekaman, type Makna } from '../db';
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
  // K-52: teks ayat dibuka sementara untuk ayat yang sedang dibaca saja.
  const [intip, setIntip] = useState(false);
  const [makna, setMakna] = useState<Map<string, Makna>>(new Map());
  const [menyimpan, setMenyimpan] = useState(false);
  const refKini = useRef<HTMLDivElement>(null);

  const ayatKini = daftarAyat[indeks];
  const terakhir = indeks === daftarAyat.length - 1;
  const merekam = status === 'merekam';

  useEffect(() => {
    ambilMaknaSurah(surah.nomor).then(setMakna);
  }, [surah.nomor]);

  // Pindah ayat (maju atau mundur): teks yang dibuka sementara ditutup lagi.
  useEffect(() => setIntip(false), [indeks]);

  // Ayat yang sedang direkam selalu tampil di tengah layar.
  useEffect(() => {
    const t = setTimeout(() => gulirKe(refKini.current), 60);
    return () => clearTimeout(t);
  }, [indeks, daftarMuat, merekam, tampilkanTeks, intip]);

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

  // K-53: berhenti di tengah murojaah. Ayat yang sedang dibaca disimpan, lalu koreksi
  // hanya sampai ayat itu. Bila belum merekam, berhenti di ayat terakhir yang tersimpan.
  const berhentiDiSini = async () => {
    setMenyimpan(true);
    let sampai = indeks > 0 ? daftarAyat[indeks - 1].ayat : 0;
    if (merekam) {
      const hasil = await selesai();
      if (hasil) {
        await simpanRekaman(surah.nomor, ayatKini.ayat, hasil.audio, hasil.durasiMs);
        sampai = ayatKini.ayat;
      }
    }
    setMenyimpan(false);
    if (!sampai) return;
    lepas();
    ganti(hashPotongan('koreksi', potongan, rukuk, sampai));
  };

  // Membuang rekaman ayat yang sedang berjalan lalu mulai lagi dari awal ayat itu.
  const ulangiAyat = async () => {
    await selesai();
    await mulai();
  };

  // K-45: mundur ke ayat yang salah. Rekaman ayat yang sedang berjalan dibuang, lalu
  // perekaman berlanjut berurutan dari ayat itu; rekaman ayat sesudahnya ikut diganti.
  const mundurKe = async (tujuan: number) => {
    if (tujuan < 0 || tujuan >= indeks || menyimpan) return;
    if (merekam) await selesai();
    setIndeks(tujuan);
    if (merekam) await mulai();
  };

  if (!daftarMuat || !ayatKini) return null;

  return (
    <>
      <Kepala
        judul={`${rukuk ? 'Murojaah' : 'Rekam'} · ${surah.nama}`}
        sub={`${rukuk ? 'Rukuk' : 'Potongan'} ${rukuk && daftarAyat.length ? labelDaftarAyat(daftarAyat) : labelPotongan(potongan)}`}
      />

      <div className="isi-rekam">
        {indeks > 0 && (
          <p className="petunjuk-mundur">Ada yang salah? Ketuk ayatnya untuk mundur dan membaca ulang dari situ.</p>
        )}
        {daftarAyat.slice(0, indeks).map((a, i) => (
          <div
            key={a.ayat}
            role="button"
            tabIndex={0}
            className="ayat selesai bisa-mundur"
            onClick={() => mundurKe(i)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') mundurKe(i);
            }}
            aria-label={`Mundur ke ayat ${a.ayat} dan rekam ulang dari situ`}
          >
            <p className="status-ayat">
              <span>
                <Check weight="duotone" /> Ayat {a.ayat} tersimpan
              </span>
              <span className="label-mundur">
                <ArrowUUpLeft weight="duotone" /> Mundur ke sini
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
          {tampilkanTeks || intip ? (
            <TeksAyat ayat={ayatKini} />
          ) : rukuk ? (
            // K-52: saat murojaah yang tampil arti ayat; ragu → buka teks ayat ini saja.
            <button type="button" className="teks-tertutup arti-murojaah" onClick={() => setIntip(true)}>
              <span className="kicker">Arti ayat {ayatKini.ayat}</span>
              <span className="isi-arti">
                {segmenAyat(ayatKini)
                  .map((g) => makna.get(`${surah.nomor}:${ayatKini.ayat}:${g.indeks}`)?.isi ?? g.maknaBawaan)
                  .join(' · ')}
              </span>
              <span className="buka-teks">
                <Eye weight="duotone" /> Ragu? Ketuk untuk melihat ayat
              </span>
            </button>
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

      {/* K-46: bilah rekam berupa ikon seperti alat perekam; tombol utama besar di tengah. */}
      <div className="bilah-aksi bilah-rekam bilah-ikon">
        <button
          type="button"
          className={'ikon-aksi' + (tampilkanTeks ? ' nyala' : '')}
          onClick={() => setTampilkanTeks((v) => !v)}
          aria-pressed={tampilkanTeks}
        >
          <span className="bulat">{tampilkanTeks ? <Eye weight="duotone" /> : <EyeSlash weight="duotone" />}</span>
          <span className="keterangan">{tampilkanTeks ? 'Teks tampil' : 'Teks'}</span>
        </button>
        <button
          type="button"
          className="ikon-aksi"
          onClick={() => mundurKe(indeks - 1)}
          disabled={!merekam || indeks === 0 || menyimpan}
          aria-label={indeks > 0 ? `Mundur ke ayat ${daftarAyat[indeks - 1].ayat}` : 'Mundur'}
        >
          <span className="bulat">
            <ArrowUUpLeft weight="duotone" />
          </span>
          <span className="keterangan">Mundur</span>
        </button>
        {!merekam ? (
          <button
            type="button"
            className="tombol utama ikon-utama"
            onClick={mulai}
            disabled={status === 'meminta-izin' || status === 'tidak-didukung' || menyimpan}
          >
            <span className="bulat">
              <Microphone weight="fill" />
            </span>
            <span className="keterangan">
              {status === 'meminta-izin' ? 'Meminta izin…' : `Rekam ayat ${ayatKini.ayat}`}
            </span>
          </button>
        ) : (
          <button
            type="button"
            className={'tombol utama ikon-utama merekam' + (terakhir ? ' akhir' : '')}
            onClick={selesaiAyat}
            disabled={menyimpan}
          >
            <span className="bulat">{terakhir ? <CheckCircle weight="fill" /> : <Check weight="bold" />}</span>
            <span className="keterangan">
              {menyimpan ? 'Menyimpan…' : terakhir ? 'Selesai & koreksi' : 'Selesai ayat'}
            </span>
          </button>
        )}
        <button type="button" className="ikon-aksi" onClick={ulangiAyat} disabled={!merekam || menyimpan}>
          <span className="bulat">
            <ArrowCounterClockwise weight="duotone" />
          </span>
          <span className="keterangan">Ulangi</span>
        </button>
        {rukuk && !terakhir ? (
          <button
            type="button"
            className="ikon-aksi"
            onClick={berhentiDiSini}
            disabled={menyimpan || (!merekam && indeks === 0)}
            aria-label={`Berhenti di ayat ${merekam ? ayatKini.ayat : (daftarAyat[indeks - 1]?.ayat ?? '')} lalu koreksi`}
          >
            <span className="bulat">
              <StopCircle weight="duotone" />
            </span>
            <span className="keterangan">Berhenti</span>
          </button>
        ) : (
          <span className="ikon-aksi pengisi" aria-hidden="true" />
        )}
      </div>
    </>
  );
}
