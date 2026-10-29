import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeSlash, Microphone, NotePencil } from '@phosphor-icons/react';
import {
  angkaArab,
  cariAyat,
  cariSurah,
  labelPotongan,
  segmenAyat,
  susunToken,
  type Ayat,
  type Potongan,
  type Segmen,
} from '../data';
import { ambilMaknaSurah, type Makna } from '../db';
import Kepala from '../komponen/Kepala';
import LembarMakna from '../komponen/LembarMakna';
import { ganti, hashPotongan } from '../navigasi';

// K-88 (B): hafalan baru "makna dulu" untuk penghafal yang lebih kuat di makna daripada bunyi.
//  1. Pahami — makna per waqaf sebagai alur bernomor (bisa disunting).
//  2. Ikat   — per waqaf: baca dengan lafaz terbuka, lalu lafaz ditutup dan hanya makna yang
//              tampil, baca dari hafalan, buka untuk cek. Diakhiri uji seluruh potongan.
//  3. Rekam  — alur rekam & koreksi yang sudah ada (layar ini diganti, agar Kembali menuju Hari ini).

type Langkah = 'pahami' | 'ikat' | 'uji';
type Fase = 'baca' | 'tutup' | 'cek';

interface Bagian {
  no: number; // nomor urut di seluruh potongan, mulai 1
  ayat: Ayat;
  segmen: Segmen;
  token: string[]; // teks Arab per token (kata dan tanda waqaf)
  awalAyat: boolean;
  akhirAyat: boolean;
}

function susunBagian(p: Potongan): Bagian[] {
  const hasil: Bagian[] = [];
  for (let n = p.ayatAwal; n <= p.ayatAkhir; n++) {
    const ayat = cariAyat(p.surah, n);
    if (!ayat) continue;
    const token = susunToken(ayat);
    const semua = segmenAyat(ayat).filter(Boolean);
    semua.forEach((segmen, i) =>
      hasil.push({
        no: hasil.length + 1,
        ayat,
        segmen,
        token: token.filter((t) => t.segmen === segmen.indeks).map((t) => t.teks),
        awalAyat: i === 0,
        akhirAyat: i === semua.length - 1,
      }),
    );
  }
  return hasil;
}

export default function LayarHafal({ potongan }: { potongan: Potongan }) {
  const surah = cariSurah(potongan.surah)!;
  const bagian = useMemo(() => susunBagian(potongan), [potongan]);
  const [makna, setMakna] = useState<Map<string, Makna>>(new Map());
  const [langkah, setLangkah] = useState<Langkah>('pahami');
  const [lafazPahami, setLafazPahami] = useState(false);
  const [indeks, setIndeks] = useState(0);
  const [fase, setFase] = useState<Fase>('baca');
  const [bukaUji, setBukaUji] = useState<Set<number>>(() => new Set());
  const [sunting, setSunting] = useState<Bagian | null>(null);

  const muatMakna = () => ambilMaknaSurah(surah.nomor).then(setMakna);
  useEffect(() => {
    muatMakna();
  }, [surah.nomor]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [langkah, indeks]);

  if (!bagian.length) return null;

  const arti = (b: Bagian) =>
    makna.get(`${surah.nomor}:${b.ayat.ayat}:${b.segmen.indeks}`)?.isi ?? b.segmen.maknaBawaan;
  const disunting = (b: Bagian) => makna.has(`${surah.nomor}:${b.ayat.ayat}:${b.segmen.indeks}`);

  const lafaz = (b: Bagian) => (
    <p className="arab hafal-lafaz" dir="rtl" lang="ar">
      {b.token.join(' ')}
      {b.akhirAyat && <span> ﴿{angkaArab(b.ayat.ayat)}﴾</span>}
    </p>
  );

  const tertutup = (b: Bagian) => (
    <p className="hafal-tertutup" dir="rtl" aria-label="Lafaz ditutup">
      {b.token.map((t, i) => (
        <span key={i} className="kotak-kata" style={{ width: `${Math.min(84, Math.max(26, t.length * 7))}px` }} />
      ))}
    </p>
  );

  const tombolArti = (b: Bagian, besar = false) => (
    <button
      type="button"
      className={'hafal-arti bisa-sunting' + (besar ? ' besar' : '')}
      onClick={() => setSunting(b)}
      title="Sunting arti dengan gaya bahasa Anda"
    >
      {arti(b)}
      {disunting(b) && <NotePencil size={14} weight="duotone" className="tanda-sunting" aria-label="arti disunting" />}
    </button>
  );

  const pindahLangkah = (l: Langkah) => {
    setLangkah(l);
    if (l === 'ikat') {
      setIndeks(0);
      setFase('baca');
    }
    if (l === 'uji') setBukaUji(new Set());
  };

  const b = bagian[indeks];
  const terakhir = indeks === bagian.length - 1;

  return (
    <>
      <Kepala judul={`Hafalan baru · ${surah.nama}`} sub={`Potongan ${labelPotongan(potongan)}`} />
      {sunting && (
        <LembarMakna
          surah={surah}
          ayat={sunting.ayat}
          segmen={sunting.segmen}
          awal={makna.get(`${surah.nomor}:${sunting.ayat.ayat}:${sunting.segmen.indeks}`)?.isi ?? ''}
          tutup={() => setSunting(null)}
          sesudahSimpan={muatMakna}
        />
      )}

      <div className="isi-hafal">
        <ol className="langkah-hafal" aria-label="Langkah hafalan baru">
          {(
            [
              ['pahami', 'Pahami'],
              ['ikat', 'Ikat'],
            ] as const
          ).map(([l, judul], n) => (
            <li key={l}>
              <button
                type="button"
                className={'chip' + (langkah === l || (l === 'ikat' && langkah === 'uji') ? ' aktif' : '')}
                onClick={() => pindahLangkah(l)}
              >
                {n + 1}. {judul}
              </button>
            </li>
          ))}
          <li>
            <button type="button" className="chip" onClick={() => ganti(hashPotongan('rekam', potongan))}>
              3. Rekam
            </button>
          </li>
        </ol>

        {langkah === 'pahami' && (
          <section className="hafal-langkah">
            <p className="petunjuk-hafal">
              Baca alur maknanya sampai Anda bisa menceritakan isi potongan ini dengan kata-kata sendiri, tanpa melihat.
              Ketuk arti untuk menyuntingnya dengan gaya bahasa Anda.
            </p>
            <ol className="alur-makna">
              {bagian.map((x) => (
                <li key={x.no}>
                  <span className="no-alur">{x.no}</span>
                  <div className="isi-alur">
                    {x.awalAyat && <span className="label-ayat-alur">ayat {x.ayat.ayat}</span>}
                    {tombolArti(x)}
                    {lafazPahami && lafaz(x)}
                  </div>
                </li>
              ))}
            </ol>
            <button type="button" className="tautan" onClick={() => setLafazPahami((v) => !v)}>
              {lafazPahami ? <EyeSlash weight="duotone" /> : <Eye weight="duotone" />}{' '}
              {lafazPahami ? 'Sembunyikan lafaz' : 'Tampilkan lafaz di bawah tiap arti'}
            </button>
            <button type="button" className="tombol utama lebar" onClick={() => pindahLangkah('ikat')}>
              Sudah paham alurnya, lanjut ikat lafaz <ArrowRight weight="bold" />
            </button>
          </section>
        )}

        {langkah === 'ikat' && b && (
          <section className="hafal-langkah">
            <p className="kicker">
              Bagian {b.no} dari {bagian.length} <span className="istilah">ayat {b.ayat.ayat}</span>
            </p>
            <div className="kartu-ikat">
              {tombolArti(b, true)}
              {fase === 'tutup' ? tertutup(b) : lafaz(b)}
            </div>
            <p className="petunjuk-hafal">
              {fase === 'baca'
                ? 'Baca lafaznya tiga kali sambil memperhatikan artinya.'
                : fase === 'tutup'
                  ? 'Lafaz ditutup. Lihat artinya, lalu baca dari hafalan.'
                  : 'Cocokkan dengan bacaan Anda tadi.'}
            </p>
            {fase === 'baca' && (
              <button type="button" className="tombol utama lebar" onClick={() => setFase('tutup')}>
                <EyeSlash weight="duotone" /> Tutup lafaz, baca dari hafalan
              </button>
            )}
            {fase === 'tutup' && (
              <button type="button" className="tombol utama lebar" onClick={() => setFase('cek')}>
                <Eye weight="duotone" /> Buka &amp; cek
              </button>
            )}
            {fase === 'cek' && (
              <div className="aksi-lembar">
                <button type="button" className="tombol sekunder" onClick={() => setFase('baca')}>
                  Ulangi bagian ini
                </button>
                <button
                  type="button"
                  className="tombol utama"
                  onClick={() => {
                    if (terakhir) pindahLangkah('uji');
                    else {
                      setIndeks((i) => i + 1);
                      setFase('baca');
                    }
                  }}
                >
                  {terakhir ? 'Uji seluruh potongan' : 'Bagian berikutnya'} <ArrowRight weight="bold" />
                </button>
              </div>
            )}
            {indeks > 0 && (
              <button
                type="button"
                className="tautan"
                onClick={() => {
                  setIndeks((i) => i - 1);
                  setFase('baca');
                }}
              >
                <ArrowLeft weight="duotone" /> Bagian sebelumnya
              </button>
            )}
          </section>
        )}

        {langkah === 'uji' && (
          <section className="hafal-langkah">
            <p className="petunjuk-hafal">
              Uji seluruh potongan: ikuti alur makna dari atas, baca lafaznya dari hafalan tanpa berhenti. Ketuk satu
              bagian bila perlu mengintip.
            </p>
            <ol className="alur-makna">
              {bagian.map((x) => {
                const buka = bukaUji.has(x.no);
                return (
                  <li key={x.no}>
                    <span className="no-alur">{x.no}</span>
                    <div className="isi-alur">
                      {x.awalAyat && <span className="label-ayat-alur">ayat {x.ayat.ayat}</span>}
                      <span className="hafal-arti">{arti(x)}</span>
                      <button
                        type="button"
                        className="ketuk-lafaz"
                        onClick={() =>
                          setBukaUji((s) => {
                            const baru = new Set(s);
                            if (buka) baru.delete(x.no);
                            else baru.add(x.no);
                            return baru;
                          })
                        }
                        aria-label={buka ? 'Tutup lafaz' : 'Intip lafaz'}
                      >
                        {buka ? lafaz(x) : tertutup(x)}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
            <button type="button" className="tombol utama lebar" onClick={() => ganti(hashPotongan('rekam', potongan))}>
              <Microphone weight="duotone" /> Siap, rekam &amp; koreksi
            </button>
            <button type="button" className="tautan" onClick={() => pindahLangkah('ikat')}>
              <ArrowLeft weight="duotone" /> Ulangi ikat dari bagian pertama
            </button>
          </section>
        )}
      </div>
    </>
  );
}
