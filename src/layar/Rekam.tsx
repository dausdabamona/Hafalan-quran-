import { useEffect, useRef, useState } from 'react';
import {
  ArrowCounterClockwise,
  ArrowUUpLeft,
  Check,
  CheckCircle,
  Eye,
  EyeSlash,
  Lifebuoy,
  Microphone,
  StopCircle,
} from '@phosphor-icons/react';
import { gulirKe } from '../komponen/gulir';
import { cariSurah, kataBantu, labelPotongan, segmenAyat, susunToken, type Kata, type Potongan } from '../data';
import { labelDaftarAyat, useAyatMurojaah } from '../komponen/useAyatMurojaah';
import {
  ambilMaknaSurah,
  ambilTandaSurah,
  BATAS_KATA_BANTU,
  hitungMurojaahRukuk,
  kunciKata,
  simpanRekaman,
  type Makna,
  type JenisSalah,
  type TandaSalah,
} from '../db';
import { ganti, hashPotongan } from '../navigasi';
import { usePerekam } from '../perekam';
import Kepala from '../komponen/Kepala';
import TeksAyat from '../komponen/TeksAyat';
import { buangTandaMurojaah, kunciSesiRekam, titipTandaMurojaah } from '../tandaMurojaah';
import PilihJenisSalah, { kelasJenis } from '../komponen/PilihJenisSalah';

// Rekam berurutan per ayat (K-12, K-14). Teks ayat yang sedang dibaca tertutup
// sampai "Selesai ayat ini" ditekan (K-16); bisa dibuka untuk hafalan baru.
// Sakelar teks ada di bilah bawah agar tetap terjangkau selama merekam (K-39).
export default function LayarRekam({
  potongan,
  rukuk,
  perbaikan,
  mantap,
}: {
  potongan: Potongan;
  rukuk?: number;
  perbaikan?: boolean;
  mantap?: boolean; // K-88: pemantapan hafalan baru — isyarat makna, kata bantu mati bawaan
}) {
  const surah = cariSurah(potongan.surah)!;
  const daftarMuat = useAyatMurojaah(potongan, rukuk);
  const daftarAyat = daftarMuat ?? [];
  const { status, mulai, selesai, lepas } = usePerekam();
  const [indeks, setIndeks] = useState(0);
  const [tampilkanTeks, setTampilkanTeks] = useState(false);
  // K-52: teks ayat dibuka sementara untuk ayat yang sedang dibaca saja.
  const [intip, setIntip] = useState(false);
  const [makna, setMakna] = useState<Map<string, Makna>>(new Map());
  const [tandaSalah, setTandaSalah] = useState<Map<string, TandaSalah>>(new Map());
  const salahDi = (ayat: number, urutan: number) => tandaSalah.get(kunciKata(surah.nomor, ayat, urutan));
  const kelasKataSalah = (ayat: number) => (k: Kata) => {
    const t = salahDi(ayat, k.urutan);
    return t ? 'tanda-lama ' + kelasJenis(t.jenis) : '';
  };
  const [menyimpan, setMenyimpan] = useState(false);
  // K-61: kata bantu (awal ayat, awal tiap waqaf, akhir ayat). Nyala otomatis bila rukuk
  // ini dimurojaah kurang dari BATAS_KATA_BANTU kali; sesudahnya mati bawaan.
  const [jumlahMurojaah, setJumlahMurojaah] = useState<number | null>(null);
  // K-65: null = otomatis (di bawah 15× atau ayat pernah salah); true/false = dipilih lewat tombol.
  const [bantuPilih, setBantuPilih] = useState<boolean | null>(null);
  // K-65: jumlah kata yang dibuka satu per satu dengan mengetuk kotak ayat.
  // K-71: kata yang dibuka disimpan per urutan kata, agar satu kotak bisa dibuka langsung.
  const [terbuka, setTerbuka] = useState<Set<number>>(() => new Set());
  // K-72: kata yang ditandai salah langsung saat murojaah ("ayat:urutan"), diteruskan ke Koreksi.
  // K-83: tiap tanda punya jenis (hafalan / panjang-pendek / penyebutan).
  const [tandaSesi, setTandaSesi] = useState<Map<string, JenisSalah>>(() => {
    buangTandaMurojaah();
    return new Map();
  });
  const [pilihKata, setPilihKata] = useState<{ ayat: number; urutan: number; teks: string } | null>(null);
  const ditandai = (ayat: number, urutan: number) => tandaSesi.get(`${ayat}:${urutan}`);
  const tandaiKata = (ayat: number, urutan: number, teks: string) => setPilihKata({ ayat, urutan, teks });
  const aturJenis = (ayat: number, urutan: number, j: JenisSalah | null) =>
    setTandaSesi((lama) => {
      const baru = new Map(lama);
      const k = `${ayat}:${urutan}`;
      if (j) baru.set(k, j);
      else baru.delete(k);
      return baru;
    });
  const keKoreksi = (sampai?: number) => {
    titipTandaMurojaah(kunciSesiRekam(potongan, rukuk), tandaSesi);
    ganti(hashPotongan('koreksi', potongan, rukuk, sampai, sampai ? undefined : perbaikan));
  };
  const refKini = useRef<HTMLDivElement>(null);

  const ayatKini = daftarAyat[indeks];
  const terakhir = indeks === daftarAyat.length - 1;
  const merekam = status === 'merekam';

  useEffect(() => {
    ambilMaknaSurah(surah.nomor).then(setMakna);
    ambilTandaSurah(surah.nomor).then((t) => setTandaSalah(t.salah));
  }, [surah.nomor]);

  useEffect(() => {
    if (!rukuk) return;
    hitungMurojaahRukuk(surah.nomor, rukuk).then((n) => {
      setJumlahMurojaah(n);
    });
  }, [surah.nomor, rukuk]);

  // Pindah ayat (maju atau mundur): teks yang dibuka sementara ditutup lagi.
  useEffect(() => {
    setIntip(false);
    setTerbuka(new Set());
  }, [indeks]);

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
      keKoreksi();
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
    keKoreksi(sampai);
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

  // K-61/K-65: kata bantu ayat yang sedang dibaca.
  const tokenKini = susunToken(ayatKini).filter((t) => t.kata);
  const adaSalahKini = tokenKini.some((t) => salahDi(ayatKini.ayat, t.kata!.urutan));
  // K-66: hafalan baru (tanpa rukuk) selalu mendapat kata bantu bawaan.
  // K-88: pemantapan memakai isyarat makna saja; kata bantu bisa dinyalakan lewat tombol.
  const bantuKini =
    bantuPilih ??
    (!mantap && (!rukuk || (jumlahMurojaah !== null && jumlahMurojaah < BATAS_KATA_BANTU) || adaSalahKini));
  const bantuAyat = bantuKini ? kataBantu(ayatKini) : new Set<number>();
  const siapBantu = !rukuk || jumlahMurojaah !== null;

  return (
    <>
      {pilihKata && (
        <PilihJenisSalah
          kata={pilihKata.teks}
          jenisKini={ditandai(pilihKata.ayat, pilihKata.urutan)}
          pilih={(j) => {
            aturJenis(pilihKata.ayat, pilihKata.urutan, j);
            setPilihKata(null);
          }}
          tutup={() => setPilihKata(null)}
        />
      )}
      <Kepala
        judul={`${perbaikan ? 'Perbaiki' : mantap ? 'Pemantapan' : rukuk ? 'Murojaah' : 'Rekam'} · ${surah.nama}`}
        sub={
          perbaikan
            ? `Perbaiki ${labelPotongan(potongan)}`
            : `${rukuk ? 'Rukuk' : 'Potongan'} ${rukuk && daftarAyat.length ? labelDaftarAyat(daftarAyat) : labelPotongan(potongan)}`
        }
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
            {siapBantu && !tampilkanTeks && (
              <span className="ikon-status">
                {!intip && (
                  <button
                    type="button"
                    className={'sakelar-bantu ikon' + (bantuKini ? ' nyala' : '')}
                    onClick={() => setBantuPilih(!bantuKini)}
                    aria-pressed={bantuKini}
                    aria-label={bantuKini ? 'Sembunyikan kata bantu' : 'Tampilkan kata bantu'}
                    title={
                      rukuk
                        ? `Kata bantu: awal ayat, awal tiap waqaf, dan akhir ayat. Rukuk ini sudah dimurojaah ${jumlahMurojaah}×; nyala otomatis di bawah ${BATAS_KATA_BANTU}× atau bila ayat pernah salah.`
                        : mantap
                          ? 'Pemantapan memakai arti sebagai isyarat. Nyalakan kata bantu bila perlu: awal ayat, awal tiap waqaf, dan akhir ayat.'
                          : 'Kata bantu: awal ayat, awal tiap waqaf, dan akhir ayat.'
                    }
                  >
                    <Lifebuoy size={18} weight={bantuKini ? 'fill' : 'duotone'} />
                  </button>
                )}
                <button
                  type="button"
                  className={'sakelar-bantu ikon' + (intip ? ' nyala' : '')}
                  onClick={() => setIntip((v) => !v)}
                  aria-pressed={intip}
                  aria-label={intip ? 'Tutup ayat' : 'Lihat seluruh ayat'}
                  title={intip ? 'Tutup ayat' : 'Lihat seluruh ayat'}
                >
                  {intip ? <EyeSlash size={18} weight="duotone" /> : <Eye size={18} weight="duotone" />}
                </button>
              </span>
            )}
          </p>
          {tampilkanTeks || intip ? (
            <TeksAyat
              ayat={ayatKini}
              kelasKata={(k) => {
                const sesi = ditandai(ayatKini.ayat, k.urutan);
                return sesi ? 'salah-sesi ' + kelasJenis(sesi) : kelasKataSalah(ayatKini.ayat)(k);
              }}
              ketukKata={(k) => tandaiKata(ayatKini.ayat, k.urutan, k.teks)}
            />
          ) : (
            // K-52/K-65/K-66: murojaah dan hafalan baru — arti ayat, kata bantu, ketuk → buka satu kata berikutnya.
            <button
              type="button"
              className="teks-tertutup arti-murojaah"
              onClick={() => {
                // Ketuk di luar kotak: buka kata tertutup pertama berikutnya (K-65).
                const berikut = tokenKini.find(
                  (t) =>
                    !salahDi(ayatKini.ayat, t.kata!.urutan) &&
                    !bantuAyat.has(t.kata!.urutan) &&
                    !terbuka.has(t.kata!.urutan),
                );
                if (berikut) setTerbuka((s) => new Set(s).add(berikut.kata!.urutan));
              }}
              aria-label="Buka satu kata berikutnya"
            >
              {/* K-55: kata yang pernah salah merah; K-61: kata bantu hijau; K-65: kata yang dibuka gelap. */}
              <span className="ayat-salah" dir="rtl" lang="ar">
                {(() => {
                  return tokenKini.map((t, i) => {
                    const tanda = salahDi(ayatKini.ayat, t.kata!.urutan);
                    // K-72: kata yang terlihat (pernah salah, kata bantu, dibuka) diketuk → tandai salah.
                    const u = t.kata!.urutan;
                    const tandai = {
                      onClick: (e: React.MouseEvent) => {
                        e.stopPropagation();
                        tandaiKata(ayatKini.ayat, u, t.teks);
                      },
                      title: ditandai(ayatKini.ayat, u) ? 'Ubah atau hapus tanda' : 'Tandai salah',
                    };
                    const sesiJenis = ditandai(ayatKini.ayat, u);
                    const kelasTanda = sesiJenis ? ' ditandai ' + kelasJenis(sesiJenis) : '';
                    if (tanda)
                      return (
                        <span
                          key={i}
                          className={'kata-salah' + (kelasTanda || ' ' + kelasJenis(tanda.jenis))}
                          {...tandai}
                        >
                          {t.teks}
                          <small dir="ltr">{tanda.jumlah}×</small>
                        </span>
                      );
                    if (bantuAyat.has(t.kata!.urutan))
                      return (
                        <span key={i} className={'kata-bantu' + kelasTanda} {...tandai}>
                          {t.teks}
                        </span>
                      );
                    if (terbuka.has(t.kata!.urutan)) {
                      return (
                        <span key={i} className={'kata-terbuka' + kelasTanda} {...tandai}>
                          {t.teks}
                        </span>
                      );
                    }
                    return (
                      // K-71: ketuk kotak ini → hanya kata ini yang dibuka.
                      <span
                        key={i}
                        className="kotak-kata"
                        title="Buka kata ini"
                        style={{ width: `${Math.min(84, Math.max(26, t.teks.length * 7))}px` }}
                        onClick={(e) => {
                          e.stopPropagation();
                          const u = t.kata!.urutan;
                          setTerbuka((s) => new Set(s).add(u));
                        }}
                      />
                    );
                  });
                })()}
              </span>
              <span className="kicker">Arti ayat {ayatKini.ayat}</span>
              <span className="isi-arti">
                {segmenAyat(ayatKini)
                  .map((g) => makna.get(`${surah.nomor}:${ayatKini.ayat}:${g.indeks}`)?.isi ?? g.maknaBawaan)
                  .join(' · ')}
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
          aria-label={tampilkanTeks ? 'Tutup teks semua ayat' : 'Tampilkan teks semua ayat'}
          title={tampilkanTeks ? 'Tutup teks semua ayat' : 'Tampilkan teks semua ayat'}
        >
          <span className="bulat">{tampilkanTeks ? <Eye weight="duotone" /> : <EyeSlash weight="duotone" />}</span>
        </button>
        <button
          type="button"
          className="ikon-aksi"
          onClick={() => mundurKe(indeks - 1)}
          disabled={!merekam || indeks === 0 || menyimpan}
          aria-label={indeks > 0 ? `Mundur ke ayat ${daftarAyat[indeks - 1].ayat}` : 'Mundur'}
          title="Mundur ke ayat sebelumnya"
        >
          <span className="bulat">
            <ArrowUUpLeft weight="duotone" />
          </span>
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
            <span className="keterangan">{status === 'meminta-izin' ? 'Meminta izin…' : `Rekam ${ayatKini.ayat}`}</span>
          </button>
        ) : (
          <button
            type="button"
            className={'tombol utama ikon-utama merekam' + (terakhir ? ' akhir' : '')}
            onClick={selesaiAyat}
            disabled={menyimpan}
          >
            <span className="bulat">{terakhir ? <CheckCircle weight="fill" /> : <Check weight="bold" />}</span>
            <span className="keterangan">{menyimpan ? 'Menyimpan…' : terakhir ? 'Koreksi' : 'Selesai'}</span>
          </button>
        )}
        <button
          type="button"
          className="ikon-aksi"
          onClick={ulangiAyat}
          disabled={!merekam || menyimpan}
          aria-label="Ulangi ayat ini dari awal"
          title="Ulangi ayat ini dari awal"
        >
          <span className="bulat">
            <ArrowCounterClockwise weight="duotone" />
          </span>
        </button>
        {rukuk && !terakhir ? (
          <button
            type="button"
            className="ikon-aksi"
            onClick={berhentiDiSini}
            disabled={menyimpan || (!merekam && indeks === 0)}
            aria-label={`Berhenti di ayat ${merekam ? ayatKini.ayat : (daftarAyat[indeks - 1]?.ayat ?? '')} lalu koreksi`}
            title="Berhenti di sini lalu koreksi"
          >
            <span className="bulat">
              <StopCircle weight="duotone" />
            </span>
          </button>
        ) : (
          <span className="ikon-aksi pengisi" aria-hidden="true" />
        )}
      </div>
    </>
  );
}
