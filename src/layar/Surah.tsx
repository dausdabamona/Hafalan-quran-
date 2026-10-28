import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CaretLeft,
  CaretRight,
  Check,
  CheckSquare,
  Headphones,
  Microphone,
  NotePencil,
  Pause,
  Play,
  Scroll,
  Warning,
} from '@phosphor-icons/react';
import {
  ayatPotongan,
  juzAyat,
  labelPotongan,
  potonganSurah,
  rukukSurah,
  segmenAyat,
  teksBasmalah,
  type Ayat,
  type Kata,
  type Segmen,
  type Surah,
} from '../data';
import {
  ambilHafalan,
  ambilJadwal,
  ambilKeteranganSurah,
  ambilMaknaSurah,
  ambilRekamanSurah,
  ambilTandaSurah,
  hapusTandaSalah,
  hapusTandaTertukar,
  kunciAyat,
  kunciKata,
  kunciKeterangan,
  simpanKeterangan,
  simpanMakna,
  batalkanAyatHafalanLama,
  batalkanHafalanLama,
  tandaiAyatHafalanLama,
  tandaiHafalanLama,
  type Keterangan,
  type Makna,
  type Rekaman,
  type TandaSurah,
  type TandaTertukar,
} from '../db';
import { adaTandaLama, ayatHafal, rentangMurojaah, type EntriHafalan, type EntriJadwal } from '../jadwal';
import { hashPotongan, pergi } from '../navigasi';
import { hashMurotal } from '../murotal';
import Kepala from '../komponen/Kepala';
import TeksAyat from '../komponen/TeksAyat';
import LembarHadits from '../komponen/LembarHadits';
import { kelasJenis } from '../komponen/PilihJenisSalah';
import { haditsSurah } from '../hadits';
import { gulirKe } from '../komponen/gulir';
import { susunMurotal } from '../murotalData';
import { mulai, putarJeda } from '../pemutar';
import { usePemutar } from './Murotal';

export function tanggalPendek(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function bacaTampilMakna(): boolean {
  try {
    return localStorage.getItem('tampilMakna') !== '0';
  } catch {
    return true;
  }
}

type Lembar =
  | { jenis: 'kata'; indeks: number } // indeks pada daftar kata se-surah
  | { jenis: 'ayat'; ayat: Ayat }
  | { jenis: 'makna'; ayat: Ayat; segmen: Segmen }
  | { jenis: 'hadits'; ayat: Ayat }; // K-75

export default function LayarSurah({
  surah,
  ayatTuju,
  tandaiAwal,
  aturUkuran,
}: {
  surah: Surah;
  ayatTuju?: number;
  tandaiAwal?: boolean;
  aturUkuran: (s: number) => void;
}) {
  const [keterangan, setKeterangan] = useState<Map<string, Keterangan>>(new Map());
  const [makna, setMakna] = useState<Map<string, Makna>>(new Map());
  const [rekaman, setRekaman] = useState<Map<string, Rekaman>>(new Map());
  const [tanda, setTanda] = useState<TandaSurah>({ salah: new Map(), tertukar: new Map() });
  const [hafalan, setHafalan] = useState<Map<string, EntriHafalan>>(new Map());
  const [jadwal, setJadwal] = useState<Map<number, EntriJadwal>>(new Map());
  const [lembar, setLembar] = useState<Lembar | null>(null);
  const [tampilMakna, setTampilMakna] = useState(bacaTampilMakna);
  const [modeTandai, setModeTandai] = useState(!!tandaiAwal);
  const [dari, setDari] = useState('');
  const [sampai, setSampai] = useState('');
  const [pesanTandai, setPesanTandai] = useState('');
  // K-75: hadits terkait ayat (bila data hadits sudah dimuat di perangkat ini).
  const [haditsAyat, setHaditsAyat] = useState<Map<number, string[]>>(new Map());

  const semuaKata = useMemo(() => surah.ayat.flatMap((a) => a.kata.map((k) => ({ ayat: a, kata: k }))), [surah]);

  const muat = useCallback(async () => {
    const [k, m, r, t, h, j] = await Promise.all([
      ambilKeteranganSurah(surah.nomor),
      ambilMaknaSurah(surah.nomor),
      ambilRekamanSurah(surah.nomor),
      ambilTandaSurah(surah.nomor),
      ambilHafalan(),
      ambilJadwal(),
    ]);
    setKeterangan(k);
    setMakna(m);
    setRekaman(r);
    setTanda(t);
    setHafalan(h);
    setJadwal(j);
  }, [surah.nomor]);

  useEffect(() => {
    muat();
  }, [muat]);

  useEffect(() => {
    haditsSurah(surah.nomor).then(setHaditsAyat);
  }, [surah.nomor]);

  // Posisi gulir surah diingat selama aplikasi terbuka, lalu dipulihkan saat kembali
  // dari layar Rekam, Koreksi, atau Murotal.
  useEffect(() => {
    const kunci = `gulir:surah:${surah.nomor}`;
    let tunggu = 0;
    const simpan = () => {
      cancelAnimationFrame(tunggu);
      tunggu = requestAnimationFrame(() => {
        try {
          sessionStorage.setItem(kunci, String(Math.round(window.scrollY)));
        } catch {
          // abaikan
        }
      });
    };
    let pulih: ReturnType<typeof setTimeout>[] = [];
    if (!ayatTuju) {
      let posisi = 0;
      try {
        posisi = Number(sessionStorage.getItem(kunci)) || 0;
      } catch {
        // abaikan
      }
      if (posisi > 0) pulih = [80, 400].map((ms) => setTimeout(() => window.scrollTo(0, posisi), ms));
    }
    window.addEventListener('scroll', simpan, { passive: true });
    return () => {
      window.removeEventListener('scroll', simpan);
      cancelAnimationFrame(tunggu);
      pulih.forEach(clearTimeout);
    };
  }, [surah.nomor]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ayatTuju) return;
    // Digulir dua kali: ayat sebelumnya baru diukur tingginya setelah tampil (content-visibility).
    const gulir = () => document.getElementById(`ayat-${ayatTuju}`)?.scrollIntoView({ block: 'start' });
    const t1 = setTimeout(gulir, 50);
    const t2 = setTimeout(gulir, 400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [ayatTuju]);

  const ubahTampilMakna = () => {
    setTampilMakna((v) => {
      try {
        localStorage.setItem('tampilMakna', v ? '0' : '1');
      } catch {
        // abaikan
      }
      return !v;
    });
  };

  const basmalah = surah.ayat[0] ? teksBasmalah(surah.ayat[0]) : null;

  // K-30: status hafal per ayat untuk mode Tandai hafal.
  const hafalSet = useMemo(() => ayatHafal(hafalan), [hafalan]);
  const lamaSet = useMemo(() => {
    const hasil = new Set<number>();
    for (const e of hafalan.values())
      if (e.lama && e.surah === surah.nomor) for (let a = e.ayatAwal; a <= e.ayatAkhir; a++) hasil.add(a);
    return hasil;
  }, [hafalan, surah.nomor]);

  const ubahAyat = async (ayat: number) => {
    if (lamaSet.has(ayat)) {
      await batalkanAyatHafalanLama(surah.nomor, [ayat]);
      setPesanTandai(`Tanda ayat ${ayat} dibatalkan.`);
    } else if (hafalSet.has(`${surah.nomor}:${ayat}`)) {
      setPesanTandai(`Ayat ${ayat} dihafal lewat Hafalan baru, jadi tandanya tetap.`);
      return;
    } else {
      await tandaiAyatHafalanLama(surah.nomor, [ayat]);
      setPesanTandai(`Ayat ${ayat} ditandai sudah hafal.`);
    }
    await muat();
  };

  const tandaiRentang = async () => {
    const a = Number(dari);
    const b = Number(sampai || dari);
    if (!a || !b || a > b || a < 1 || b > surah.jumlahAyat) {
      setPesanTandai(`Isi nomor ayat 1–${surah.jumlahAyat}, dengan ayat awal tidak lebih besar dari ayat akhir.`);
      return;
    }
    await tandaiAyatHafalanLama(
      surah.nomor,
      Array.from({ length: b - a + 1 }, (_, i) => a + i),
    );
    setPesanTandai(a === b ? `Ayat ${a} ditandai sudah hafal.` : `Ayat ${a}–${b} ditandai sudah hafal.`);
    setDari('');
    setSampai('');
    await muat();
  };

  const kelasKata = (a: Ayat) => (k: Kata) => {
    const kelas: string[] = [];
    if (keterangan.has(kunciKeterangan(surah.nomor, a.ayat, k.urutan))) kelas.push('ada-catatan');
    const t = tanda.salah.get(kunciKata(surah.nomor, a.ayat, k.urutan));
    if (t) kelas.push('tanda-lama', kelasJenis(t.jenis));
    if (lembar?.jenis === 'kata' && semuaKata[lembar.indeks]?.kata === k) kelas.push('dibuka');
    return kelas.join(' ');
  };

  const bukaKata = (a: Ayat, k: Kata) =>
    setLembar({ jenis: 'kata', indeks: semuaKata.findIndex((x) => x.ayat === a && x.kata === k) });

  const hapusTertukar = async (t: TandaTertukar) => {
    if (!window.confirm(`Hapus tanda sambungan ayat ${t.ayatAsal} → ${t.ayatAsal + 1}?`)) return;
    await hapusTandaTertukar(t.kunci);
    await muat();
  };

  // K-27: rukuk yang sudah hafal sebelum memakai aplikasi.
  const tandaiLalu = async (nomor: number, langsungMurojaah: boolean) => {
    const r = daftarRukuk.find((x) => x.nomor === nomor)!;
    const tanya = langsungMurojaah
      ? `Rukuk ayat ${r.ayatAwal}–${r.ayatAkhir} belum tercatat hafal. Tandai sebagai hafalan lama lalu murojaah sekarang?`
      : `Tandai seluruh rukuk ayat ${r.ayatAwal}–${r.ayatAkhir} sebagai sudah hafal?`;
    if (!window.confirm(tanya)) return;
    await tandaiHafalanLama([nomor]);
    if (langsungMurojaah) pergi(hashPotongan('rekam', r, nomor));
    else await muat();
  };

  const batalTanda = async (nomor: number) => {
    if (
      !window.confirm('Batalkan tanda hafalan lama rukuk ini? Bagian yang dihafal lewat Hafalan baru tetap tercatat.')
    )
      return;
    await batalkanHafalanLama([nomor]);
    await muat();
  };

  // Putar rekaman dari satu ayat lalu berlanjut ke ayat-ayat sesudahnya (satu suara saja).
  // Ayat yang diketuk selalu diputar; ayat sesudahnya mengikuti aturan murotal (K-28).
  const asalPutar = `#/surah/${surah.nomor}`;
  const pemutar = usePemutar();
  const kiniPutar = pemutar && pemutar.asal === asalPutar ? pemutar.daftar[pemutar.indeks] : null;
  const ayatDiputar = kiniPutar ? kiniPutar.ayat : null;

  const putarDariSini = async (ayat: number, audio: Blob) => {
    if (ayatDiputar === ayat) {
      putarJeda();
      return;
    }
    const h = await susunMurotal({ jenis: 'ayat', surah: surah.nomor, ayatAwal: ayat, ayatAkhir: surah.jumlahAyat });
    const sesudah = h.siap.filter((x) => x.ayat > ayat);
    mulai(`${surah.nama} dari ayat ${ayat}`, [{ surah: surah.nomor, ayat, audio }, ...sesudah], asalPutar);
  };

  useEffect(() => {
    if (ayatDiputar) gulirKe(document.getElementById(`ayat-${ayatDiputar}`));
  }, [ayatDiputar]);

  const daftarRukuk = rukukSurah(surah.nomor);
  const potongan = potonganSurah(surah.nomor);

  return (
    <>
      <Kepala
        judul={surah.nama}
        sub={`${surah.arti} · ${surah.jumlahAyat} ayat`}
        kanan={
          <div className="atur-huruf">
            <button
              className={'tombol-ikon kecil' + (tampilMakna ? ' aktif' : '')}
              onClick={ubahTampilMakna}
              aria-label="Tampilkan atau sembunyikan makna"
            >
              Makna
            </button>
            <button className="tombol-ikon kecil" onClick={() => aturUkuran(-4)} aria-label="Perkecil huruf">
              A−
            </button>
            <button className="tombol-ikon kecil" onClick={() => aturUkuran(4)} aria-label="Perbesar huruf">
              A+
            </button>
          </div>
        }
      />

      <div className={'bilah-tandai' + (modeTandai ? ' buka' : '')}>
        {modeTandai ? (
          <>
            <p>
              Ketuk <strong>kotak di atas ayat</strong> yang sudah Anda hafal, atau tandai sekaligus satu rentang. Ayat
              yang ditandai masuk Ulang hafalan per rukuk; yang direkam hanya ayat yang hafal.
            </p>
            <div className="isi-rentang">
              <span>Ayat</span>
              <input
                inputMode="numeric"
                value={dari}
                onChange={(e) => setDari(e.target.value.replace(/\D/g, ''))}
                aria-label="Dari ayat"
                placeholder="dari"
              />
              <span>–</span>
              <input
                inputMode="numeric"
                value={sampai}
                onChange={(e) => setSampai(e.target.value.replace(/\D/g, ''))}
                aria-label="Sampai ayat"
                placeholder="sampai"
              />
              <button className="tombol kecil utama" onClick={tandaiRentang}>
                Tandai
              </button>
            </div>
            {pesanTandai && <p className="pesan-tandai">{pesanTandai}</p>}
            <button
              className="tombol sekunder lebar"
              onClick={() => {
                setModeTandai(false);
                setPesanTandai('');
              }}
            >
              Selesai menandai
            </button>
          </>
        ) : (
          <button className="tautan" onClick={() => setModeTandai(true)}>
            <CheckSquare weight="duotone" /> Tandai ayat yang sudah hafal (
            {[...hafalSet].filter((k) => k.startsWith(`${surah.nomor}:`)).length} dari {surah.jumlahAyat} hafal)
          </button>
        )}
      </div>

      {basmalah && (
        <p className="basmalah" lang="ar" dir="rtl">
          {basmalah}
        </p>
      )}

      {daftarRukuk.map((r, iRukuk) => {
        const j = jadwal.get(r.nomor);
        const rentang = j ? rentangMurojaah(j, hafalan) : null;
        return (
          <section key={r.nomor} className="rukuk">
            <div className="kepala-rukuk">
              <span>
                {daftarRukuk.length > 1 ? `Rukuk ${iRukuk + 1} · ` : ''}ayat {r.ayatAwal}–{r.ayatAkhir} · Juz{' '}
                {juzAyat(r.surah, r.ayatAwal)}
              </span>
              <div className="aksi-rukuk">
                <button
                  className="tautan kecil"
                  onClick={() =>
                    pergi(hashMurotal({ jenis: 'ayat', surah: r.surah, ayatAwal: r.ayatAwal, ayatAkhir: r.ayatAkhir }))
                  }
                >
                  <Headphones weight="duotone" /> Murotal
                </button>
                {j && !j.lengkap && (
                  <button className="tautan kecil" onClick={() => tandaiLalu(r.nomor, false)}>
                    Tandai hafal semua
                  </button>
                )}
                {j && adaTandaLama(r.nomor, hafalan) && (
                  <button className="tautan kecil" onClick={() => batalTanda(r.nomor)}>
                    Batal tanda
                  </button>
                )}
                {rentang ? (
                  <button className="tombol kecil utama" onClick={() => pergi(hashPotongan('rekam', rentang, r.nomor))}>
                    <Microphone weight="duotone" /> Murojaah rukuk
                  </button>
                ) : (
                  <button className="tombol kecil sekunder" onClick={() => tandaiLalu(r.nomor, true)}>
                    <Microphone weight="duotone" /> Murojaah rukuk
                  </button>
                )}
              </div>
            </div>

            {potongan
              .filter((p) => p.ayatAwal >= r.ayatAwal && p.ayatAkhir <= r.ayatAkhir)
              .map((p) => {
                const daftarAyat = ayatPotongan(surah, p);
                const terekam = daftarAyat.every((a) => rekaman.has(kunciAyat(surah.nomor, a.ayat)));
                return (
                  <div key={p.ayatAwal} className="potongan">
                    <div className="kepala-potongan">
                      <span className="label-potongan">Potongan {labelPotongan(p)}</span>
                      <div className="aksi-potongan">
                        <button className="tombol kecil sekunder" onClick={() => pergi(hashPotongan('rekam', p))}>
                          <Microphone weight="duotone" /> Rekam
                        </button>
                        <button
                          className="tombol kecil sekunder"
                          onClick={() => pergi(hashPotongan('koreksi', p))}
                          disabled={!terekam}
                        >
                          <Check weight="duotone" /> Koreksi
                        </button>
                      </div>
                    </div>
                    <ol className="daftar-ayat">
                      {daftarAyat.map((a) => {
                        const ketAyat = keterangan.get(kunciKeterangan(surah.nomor, a.ayat, 0));
                        const rek = rekaman.get(kunciAyat(surah.nomor, a.ayat));
                        const tertukar = tanda.tertukar.get(kunciAyat(surah.nomor, a.ayat));
                        return (
                          <li key={a.ayat} id={`ayat-${a.ayat}`}>
                            {modeTandai && (
                              <button
                                className={
                                  'tandai-ayat tandai ' +
                                  (lamaSet.has(a.ayat)
                                    ? 'semua'
                                    : hafalSet.has(`${surah.nomor}:${a.ayat}`)
                                      ? 'semua baru'
                                      : 'belum')
                                }
                                onClick={() => ubahAyat(a.ayat)}
                              >
                                <span className="kotak" aria-hidden="true">
                                  {hafalSet.has(`${surah.nomor}:${a.ayat}`) ? '✓' : ''}
                                </span>
                                Ayat {a.ayat}
                                {lamaSet.has(a.ayat)
                                  ? ' · hafalan lama'
                                  : hafalSet.has(`${surah.nomor}:${a.ayat}`)
                                    ? ' · dari Hafalan baru'
                                    : ''}
                              </button>
                            )}
                            <div className={'ayat' + (ayatDiputar === a.ayat ? ' diputar' : '')}>
                              <p className="label-ayat kicker">
                                Ayat {a.ayat}
                                {rek ? ' · terekam' : ''}
                              </p>
                              <TeksAyat ayat={a} kelasKata={kelasKata(a)} ketukKata={(k) => bukaKata(a, k)} />
                              {tampilMakna && (
                                <ol className="daftar-makna">
                                  {segmenAyat(a).map((s) => {
                                    const m = makna.get(`${surah.nomor}:${a.ayat}:${s.indeks}`);
                                    return (
                                      <li key={s.indeks}>
                                        <button
                                          className={'makna' + (m ? ' diedit' : '')}
                                          onClick={() => setLembar({ jenis: 'makna', ayat: a, segmen: s })}
                                        >
                                          {m?.isi ?? s.maknaBawaan}
                                          <span className="pena">
                                            {' '}
                                            <NotePencil weight="duotone" />
                                          </span>
                                        </button>
                                      </li>
                                    );
                                  })}
                                </ol>
                              )}
                              <div className="kaki-ayat">
                                <button className="tautan" onClick={() => setLembar({ jenis: 'ayat', ayat: a })}>
                                  <NotePencil weight="duotone" /> {ketAyat ? 'Ubah keterangan' : 'Keterangan'}
                                </button>
                                {haditsAyat.get(a.ayat) && (
                                  <button className="tautan" onClick={() => setLembar({ jenis: 'hadits', ayat: a })}>
                                    <Scroll weight="duotone" /> {haditsAyat.get(a.ayat)!.length} hadits
                                  </button>
                                )}
                                {rek && (
                                  <button
                                    className={'tombol sekunder kecil' + (ayatDiputar === a.ayat ? ' aktif' : '')}
                                    onClick={() => putarDariSini(a.ayat, rek.audio)}
                                  >
                                    {ayatDiputar === a.ayat && pemutar?.main ? (
                                      <>
                                        <Pause weight="duotone" /> Jeda
                                      </>
                                    ) : (
                                      <>
                                        <Play weight="duotone" /> Putar dari sini
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                              {ketAyat && <p className="catatan-ayat">{ketAyat.isi}</p>}
                            </div>
                            {tertukar && (
                              <div className="sambungan-bertanda">
                                <span>
                                  <Warning weight="duotone" /> Sambungan ke ayat {tertukar.ayatAsal + 1} pernah tertukar{' '}
                                  {tertukar.jumlah}× (terbaca{' '}
                                  {tertukar.ayatKeliru ? `ayat ${tertukar.ayatKeliru}` : 'ayat lain'})
                                </span>
                                <button className="tautan kecil" onClick={() => hapusTertukar(tertukar)}>
                                  Hapus tanda
                                </button>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                );
              })}
          </section>
        );
      })}

      {lembar?.jenis === 'kata' && (
        <LembarKata
          surah={surah}
          daftar={semuaKata}
          indeksAwal={lembar.indeks}
          keterangan={keterangan}
          tanda={tanda}
          tutup={() => setLembar(null)}
          sesudahSimpan={muat}
        />
      )}
      {lembar?.jenis === 'hadits' && (
        <LembarHadits
          judul={`${surah.nama} · ayat ${lembar.ayat.ayat}`}
          kunci={haditsAyat.get(lembar.ayat.ayat) ?? []}
          tutup={() => setLembar(null)}
        />
      )}
      {lembar?.jenis === 'ayat' && (
        <LembarKeteranganAyat
          surah={surah}
          ayat={lembar.ayat}
          awal={keterangan.get(kunciKeterangan(surah.nomor, lembar.ayat.ayat, 0))?.isi ?? ''}
          tutup={() => setLembar(null)}
          sesudahSimpan={muat}
        />
      )}
      {lembar?.jenis === 'makna' && (
        <LembarMakna
          surah={surah}
          ayat={lembar.ayat}
          segmen={lembar.segmen}
          awal={makna.get(`${surah.nomor}:${lembar.ayat.ayat}:${lembar.segmen.indeks}`)?.isi ?? ''}
          tutup={() => setLembar(null)}
          sesudahSimpan={muat}
        />
      )}
    </>
  );
}

// ---------- Lembar arti kata dengan tombol sebelumnya/berikutnya ----------

function LembarKata({
  surah,
  daftar,
  indeksAwal,
  keterangan,
  tanda,
  tutup,
  sesudahSimpan,
}: {
  surah: Surah;
  daftar: { ayat: Ayat; kata: Kata }[];
  indeksAwal: number;
  keterangan: Map<string, Keterangan>;
  tanda: TandaSurah;
  tutup: () => void;
  sesudahSimpan: () => Promise<void>;
}) {
  const [indeks, setIndeks] = useState(indeksAwal);
  const kini = daftar[indeks];
  const kunci = kunciKeterangan(surah.nomor, kini.ayat.ayat, kini.kata.urutan);
  const [isi, setIsi] = useState(keterangan.get(kunci)?.isi ?? '');
  const [berubah, setBerubah] = useState(false);
  const tandaSalah = tanda.salah.get(kunciKata(surah.nomor, kini.ayat.ayat, kini.kata.urutan));

  // Keterangan yang sudah diketik ikut tersimpan saat pindah kata atau menutup lembar.
  const simpanBilaBerubah = async () => {
    if (!berubah) return;
    await simpanKeterangan(surah.nomor, kini.ayat.ayat, kini.kata.urutan, isi);
    await sesudahSimpan();
  };

  const pindah = async (arah: number) => {
    const tujuan = indeks + arah;
    if (tujuan < 0 || tujuan >= daftar.length) return;
    await simpanBilaBerubah();
    const t = daftar[tujuan];
    setIndeks(tujuan);
    setIsi(keterangan.get(kunciKeterangan(surah.nomor, t.ayat.ayat, t.kata.urutan))?.isi ?? '');
    setBerubah(false);
  };

  const selesai = async () => {
    await simpanBilaBerubah();
    tutup();
  };

  const hapusTanda = async () => {
    if (!tandaSalah || !window.confirm('Hapus tanda salah pada kata ini?')) return;
    await hapusTandaSalah(tandaSalah.kunci);
    await sesudahSimpan();
  };

  return (
    <div className="latar-lembar" onClick={selesai}>
      <div className="lembar" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="pegangan" />
        <p className="lokasi">
          {surah.nama} · ayat {kini.ayat.ayat} · kata ke-{kini.kata.urutan}
        </p>
        {/* Arah tombol mengikuti arah baca Arab: kata berikutnya ada di kiri. */}
        <div className="navigasi-kata">
          <button
            className="tombol-nav"
            onClick={() => pindah(1)}
            disabled={indeks === daftar.length - 1}
            aria-label="Kata berikutnya"
          >
            <CaretLeft weight="duotone" />
          </button>
          <p className="kata-besar" lang="ar" dir="rtl">
            {kini.kata.teks}
          </p>
          <button
            className="tombol-nav"
            onClick={() => pindah(-1)}
            disabled={indeks === 0}
            aria-label="Kata sebelumnya"
          >
            <CaretRight weight="duotone" />
          </button>
        </div>
        <p className="arti">{kini.kata.arti}</p>
        {tandaSalah && (
          <div className="info-tanda">
            <span>
              Pernah salah {tandaSalah.jumlah}× · terakhir {tanggalPendek(tandaSalah.terakhir)}
            </span>
            <button className="tautan kecil" onClick={hapusTanda}>
              Hapus tanda
            </button>
          </div>
        )}
        <label className="label-catatan" htmlFor="catatan">
          Keterangan kata
        </label>
        <textarea
          id="catatan"
          value={isi}
          onChange={(e) => {
            setIsi(e.target.value);
            setBerubah(true);
          }}
          placeholder="Tulis catatan pribadi Anda di sini"
          rows={3}
        />
        <div className="aksi-lembar">
          <button className="tombol utama" onClick={selesai}>
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Lembar keterangan ayat ----------

function LembarKeteranganAyat({
  surah,
  ayat,
  awal,
  tutup,
  sesudahSimpan,
}: {
  surah: Surah;
  ayat: Ayat;
  awal: string;
  tutup: () => void;
  sesudahSimpan: () => Promise<void>;
}) {
  const [isi, setIsi] = useState(awal);
  const simpan = async () => {
    await simpanKeterangan(surah.nomor, ayat.ayat, 0, isi);
    await sesudahSimpan();
    tutup();
  };
  return (
    <div className="latar-lembar" onClick={tutup}>
      <div className="lembar" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="pegangan" />
        <p className="lokasi">
          {surah.nama} · ayat {ayat.ayat}
        </p>
        <label className="label-catatan" htmlFor="catatan">
          Keterangan ayat
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
          <button className="tombol utama" onClick={simpan}>
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Lembar edit makna potongan waqaf (K-25) ----------

function LembarMakna({
  surah,
  ayat,
  segmen,
  awal,
  tutup,
  sesudahSimpan,
}: {
  surah: Surah;
  ayat: Ayat;
  segmen: Segmen;
  awal: string;
  tutup: () => void;
  sesudahSimpan: () => Promise<void>;
}) {
  const [isi, setIsi] = useState(awal || segmen.maknaBawaan);
  const simpan = async () => {
    // Bila sama dengan gabungan arti per kata, tidak perlu disimpan sebagai suntingan.
    await simpanMakna(surah.nomor, ayat.ayat, segmen.indeks, isi.trim() === segmen.maknaBawaan ? '' : isi);
    await sesudahSimpan();
    tutup();
  };
  const kembalikan = async () => {
    await simpanMakna(surah.nomor, ayat.ayat, segmen.indeks, '');
    await sesudahSimpan();
    tutup();
  };
  return (
    <div className="latar-lembar" onClick={tutup}>
      <div className="lembar" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="pegangan" />
        <p className="lokasi">
          {surah.nama} · ayat {ayat.ayat} · potongan {segmen.indeks + 1}
        </p>
        <p className="potongan-arab" lang="ar" dir="rtl">
          {segmen.kata.map((k) => k.teks).join(' ')}
        </p>
        <p className="kosong">Gabungan arti per kata: {segmen.maknaBawaan}</p>
        <label className="label-catatan" htmlFor="makna">
          Makna (boleh disusun ulang agar mudah dipahami)
        </label>
        <textarea id="makna" value={isi} onChange={(e) => setIsi(e.target.value)} rows={3} />
        <div className="aksi-lembar">
          {awal && (
            <button className="tombol sekunder" onClick={kembalikan}>
              Kembalikan
            </button>
          )}
          <button className="tombol sekunder" onClick={tutup}>
            Batal
          </button>
          <button className="tombol utama" onClick={simpan}>
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
}
