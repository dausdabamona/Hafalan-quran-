import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { BookOpen, MapTrifold } from '@phosphor-icons/react';
import { kunciAlamat } from '../alamat';
import { angkaArab, juzAyat, rukukSurah, segmenAyat, susunToken, teksBasmalah, type Ayat, type Surah } from '../data';
import { db, kunciKeterangan, type AlamatAyat, type Keterangan, type Makna } from '../db';
import { pergi } from '../navigasi';

// K-98 (A): mushaf mode Baca — teks Arab mengalir seperti mushaf, tanpa arti per kata dan tombol.
// Ketuk ayat untuk lembar kecil: judul alamat, makna, keterangan, dan pindah ke mode Kajian.
// Tambahan 8 Nov: menerima beberapa bagian lintas surah (Baca per juz).

const KUNCI_HAFAL = 'bacaWarnaHafal';

function bacaWarnaHafal(): boolean {
  try {
    return localStorage.getItem(KUNCI_HAFAL) === '1';
  } catch {
    return false;
  }
}

function teksAyat(a: Ayat): string {
  return susunToken(a)
    .map((t) => t.teks)
    .join(' ');
}

export function maknaAyat(surah: number, a: Ayat, makna: Map<string, Makna>): string {
  return segmenAyat(a)
    .filter(Boolean)
    .map((g) => makna.get(`${surah}:${a.ayat}:${g.indeks}`)?.isi || g.maknaBawaan)
    .filter(Boolean)
    .join(' · ');
}

export interface BagianBaca {
  surah: Surah;
  ayatAwal: number;
  ayatAkhir: number;
}

export function idBaca(surah: number, ayat: number): string {
  return `baca-${surah}-${ayat}`;
}

export default function MushafBaca({
  bagian,
  makna,
  keterangan,
  hafalSet,
  tampilMakna,
  kepalaSurah = false,
  ayatTuju,
  keKajian,
  children,
}: {
  bagian: BagianBaca[];
  makna: Map<string, Makna>;
  keterangan: Map<string, Keterangan>;
  hafalSet: Set<string>;
  tampilMakna: boolean;
  kepalaSurah?: boolean; // tampilkan kepala tiap surah (Baca per juz)
  ayatTuju?: { surah: number; ayat: number };
  keKajian: (surah: number, ayat: number) => void;
  children?: ReactNode; // navigasi di bawah bacaan
}) {
  const [alamat, setAlamat] = useState<Map<string, AlamatAyat>>(new Map());
  const [dipilih, setDipilih] = useState<{ surah: Surah; ayat: Ayat } | null>(null);
  const [warnaHafal, setWarnaHafal] = useState(bacaWarnaHafal);
  const nomorSurah = useMemo(() => bagian.map((b) => b.surah.nomor), [bagian]);

  useEffect(() => {
    db.alamatAyat
      .where('surah')
      .anyOf(nomorSurah)
      .toArray()
      .then((x) => setAlamat(new Map(x.map((a) => [a.kunci, a]))));
  }, [nomorSurah]);

  useEffect(() => {
    if (!ayatTuju) return;
    const t = setTimeout(
      () => document.getElementById(idBaca(ayatTuju.surah, ayatTuju.ayat))?.scrollIntoView({ block: 'center' }),
      80,
    );
    return () => clearTimeout(t);
  }, [ayatTuju]);

  const ubahWarnaHafal = () =>
    setWarnaHafal((v) => {
      try {
        localStorage.setItem(KUNCI_HAFAL, v ? '0' : '1');
      } catch {
        // abaikan
      }
      return !v;
    });

  const kelasAyat = (s: number, a: Ayat) =>
    'ayat-baca' +
    (warnaHafal && hafalSet.has(`${s}:${a.ayat}`) ? ' hafal' : '') +
    (dipilih?.surah.nomor === s && dipilih.ayat.ayat === a.ayat ? ' dipilih' : '');

  const penanda = (a: Ayat) => <span className="nomor-baca"> ﴿{angkaArab(a.ayat)}﴾ </span>;

  const sDipilih = dipilih?.surah.nomor ?? 0;
  const judul = dipilih ? alamat.get(kunciAlamat(sDipilih, dipilih.ayat.ayat, 'judul'))?.isi : undefined;
  const ket = dipilih ? keterangan.get(kunciKeterangan(sDipilih, dipilih.ayat.ayat, 0))?.isi : undefined;
  const rukukDipilih = dipilih
    ? rukukSurah(sDipilih).find((r) => r.ayatAwal <= dipilih.ayat.ayat && r.ayatAkhir >= dipilih.ayat.ayat)
    : undefined;

  return (
    <div className="mushaf-baca">
      <div className="bilah-baca">
        <label className="saklar">
          <input type="checkbox" checked={warnaHafal} onChange={ubahWarnaHafal} />
          <span>Warnai ayat yang sudah hafal</span>
        </label>
      </div>

      {bagian.map(({ surah, ayatAwal, ayatAkhir }) => {
        const s = surah.nomor;
        const basmalah = ayatAwal === 1 && surah.ayat[0] ? teksBasmalah(surah.ayat[0]) : null;
        const semuaRukuk = rukukSurah(s);
        const rukuk = semuaRukuk.filter((r) => r.ayatAkhir >= ayatAwal && r.ayatAwal <= ayatAkhir);
        return (
          <section key={s} className="surah-baca">
            {kepalaSurah && (
              <header className="kepala-surah-baca">
                <span className="nama">
                  {s}. {surah.nama}
                </span>
                <span className="arti-surah-baca">
                  {surah.arti}
                  {ayatAwal > 1 ? ` · lanjutan dari ayat ${ayatAwal}` : ` · ${surah.jumlahAyat} ayat`}
                </span>
              </header>
            )}
            {basmalah && (
              <p className="basmalah" lang="ar" dir="rtl">
                {basmalah}
              </p>
            )}
            {rukuk.map((r) => {
              const awal = Math.max(r.ayatAwal, ayatAwal);
              const akhir = Math.min(r.ayatAkhir, ayatAkhir);
              const ayat = surah.ayat.filter((a) => a.ayat >= awal && a.ayat <= akhir);
              const ke = semuaRukuk.indexOf(r) + 1;
              return (
                <section key={r.nomor} className="rukuk-baca">
                  <p className="batas-baca">
                    {semuaRukuk.length > 1 ? `Rukuk ${ke} · ` : ''}Juz {juzAyat(s, awal)}
                  </p>
                  {tampilMakna ? (
                    ayat.map((a) => (
                      <div key={a.ayat} id={idBaca(s, a.ayat)} className="blok-baca">
                        <p className="arab teks-baca" dir="rtl" lang="ar">
                          <span className={kelasAyat(s, a)} onClick={() => setDipilih({ surah, ayat: a })}>
                            {teksAyat(a)}
                            {penanda(a)}
                          </span>
                        </p>
                        <p className="makna-baca">
                          <span className="no">{a.ayat}</span> {maknaAyat(s, a, makna)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="arab teks-baca mengalir" dir="rtl" lang="ar">
                      {ayat.map((a) => (
                        <span
                          key={a.ayat}
                          id={idBaca(s, a.ayat)}
                          className={kelasAyat(s, a)}
                          onClick={() => setDipilih({ surah, ayat: a })}
                        >
                          {teksAyat(a)}
                          {penanda(a)}
                        </span>
                      ))}
                    </p>
                  )}
                </section>
              );
            })}
          </section>
        );
      })}

      {children}

      {dipilih && (
        <div className="latar-lembar" onClick={() => setDipilih(null)}>
          <div className="lembar lembar-baca" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="pegangan" />
            <p className="lokasi">
              {dipilih.surah.nama} · ayat {dipilih.ayat.ayat}
            </p>
            {judul && (
              <p className="judul-baca">
                <MapTrifold size={16} weight="duotone" /> {judul}
              </p>
            )}
            <p className="arab teks-baca" dir="rtl" lang="ar">
              {teksAyat(dipilih.ayat)}
              {penanda(dipilih.ayat)}
            </p>
            <p className="makna-baca">{maknaAyat(sDipilih, dipilih.ayat, makna)}</p>
            {ket && <p className="ket-baca">{ket}</p>}
            <div className="aksi-lembar">
              {rukukDipilih && (
                <button className="tombol sekunder" onClick={() => pergi(`#/alamat/r${rukukDipilih.nomor}`)}>
                  <MapTrifold weight="duotone" /> Tata Alamat
                </button>
              )}
              <button
                className="tombol utama"
                onClick={() => {
                  const { surah, ayat } = dipilih;
                  setDipilih(null);
                  keKajian(surah.nomor, ayat.ayat);
                }}
              >
                <BookOpen weight="duotone" /> Buka di mode Kajian
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
