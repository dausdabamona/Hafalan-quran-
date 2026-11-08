import { useEffect, useMemo, useState } from 'react';
import { BookOpen, MapTrifold } from '@phosphor-icons/react';
import { ambilAlamatSurah, kunciAlamat } from '../alamat';
import { angkaArab, juzAyat, rukukSurah, segmenAyat, susunToken, type Ayat, type Surah } from '../data';
import { kunciKeterangan, type AlamatAyat, type Keterangan, type Makna } from '../db';
import { pergi } from '../navigasi';

// K-98 (A): mushaf mode Baca — teks Arab mengalir seperti mushaf, tanpa arti per kata dan tombol.
// Ketuk ayat untuk lembar kecil: judul alamat, makna, keterangan, dan pindah ke mode Kajian.

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

export default function MushafBaca({
  surah,
  basmalah,
  makna,
  keterangan,
  hafalSet,
  tampilMakna,
  ayatTuju,
  keKajian,
}: {
  surah: Surah;
  basmalah: string | null;
  makna: Map<string, Makna>;
  keterangan: Map<string, Keterangan>;
  hafalSet: Set<string>;
  tampilMakna: boolean;
  ayatTuju?: number;
  keKajian: (ayat: number) => void;
}) {
  const [alamat, setAlamat] = useState<Map<string, AlamatAyat>>(new Map());
  const [dipilih, setDipilih] = useState<Ayat | null>(null);
  const [warnaHafal, setWarnaHafal] = useState(bacaWarnaHafal);
  const daftarRukuk = useMemo(() => rukukSurah(surah.nomor), [surah.nomor]);

  useEffect(() => {
    ambilAlamatSurah(surah.nomor).then(setAlamat);
  }, [surah.nomor]);

  useEffect(() => {
    if (!ayatTuju) return;
    const t = setTimeout(() => document.getElementById(`baca-${ayatTuju}`)?.scrollIntoView({ block: 'center' }), 80);
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

  const kelasAyat = (a: Ayat) =>
    'ayat-baca' +
    (warnaHafal && hafalSet.has(`${surah.nomor}:${a.ayat}`) ? ' hafal' : '') +
    (dipilih?.ayat === a.ayat ? ' dipilih' : '');

  const penanda = (a: Ayat) => <span className="nomor-baca"> ﴿{angkaArab(a.ayat)}﴾ </span>;

  const judul = dipilih ? alamat.get(kunciAlamat(surah.nomor, dipilih.ayat, 'judul'))?.isi : undefined;
  const ket = dipilih ? keterangan.get(kunciKeterangan(surah.nomor, dipilih.ayat, 0))?.isi : undefined;
  const rukukDipilih = dipilih
    ? daftarRukuk.find((r) => r.ayatAwal <= dipilih.ayat && r.ayatAkhir >= dipilih.ayat)
    : undefined;

  return (
    <div className="mushaf-baca">
      <div className="bilah-baca">
        <label className="saklar">
          <input type="checkbox" checked={warnaHafal} onChange={ubahWarnaHafal} />
          <span>Warnai ayat yang sudah hafal</span>
        </label>
      </div>

      {basmalah && (
        <p className="basmalah" lang="ar" dir="rtl">
          {basmalah}
        </p>
      )}

      {daftarRukuk.map((r, i) => {
        const ayat = surah.ayat.filter((a) => a.ayat >= r.ayatAwal && a.ayat <= r.ayatAkhir);
        return (
          <section key={r.nomor} className="rukuk-baca">
            {(daftarRukuk.length > 1 || i === 0) && (
              <p className="batas-baca">
                {daftarRukuk.length > 1 ? `Rukuk ${i + 1} · ` : ''}Juz {juzAyat(r.surah, r.ayatAwal)}
              </p>
            )}
            {tampilMakna ? (
              ayat.map((a) => (
                <div key={a.ayat} id={`baca-${a.ayat}`} className="blok-baca">
                  <p className="arab teks-baca" dir="rtl" lang="ar">
                    <span className={kelasAyat(a)} onClick={() => setDipilih(a)}>
                      {teksAyat(a)}
                      {penanda(a)}
                    </span>
                  </p>
                  <p className="makna-baca">
                    <span className="no">{a.ayat}</span> {maknaAyat(surah.nomor, a, makna)}
                  </p>
                </div>
              ))
            ) : (
              <p className="arab teks-baca mengalir" dir="rtl" lang="ar">
                {ayat.map((a) => (
                  <span key={a.ayat} id={`baca-${a.ayat}`} className={kelasAyat(a)} onClick={() => setDipilih(a)}>
                    {teksAyat(a)}
                    {penanda(a)}
                  </span>
                ))}
              </p>
            )}
          </section>
        );
      })}

      {dipilih && (
        <div className="latar-lembar" onClick={() => setDipilih(null)}>
          <div className="lembar lembar-baca" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="pegangan" />
            <p className="lokasi">
              {surah.nama} · ayat {dipilih.ayat}
            </p>
            {judul && (
              <p className="judul-baca">
                <MapTrifold size={16} weight="duotone" /> {judul}
              </p>
            )}
            <p className="arab teks-baca" dir="rtl" lang="ar">
              {teksAyat(dipilih)}
              {penanda(dipilih)}
            </p>
            <p className="makna-baca">{maknaAyat(surah.nomor, dipilih, makna)}</p>
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
                  const n = dipilih.ayat;
                  setDipilih(null);
                  keKajian(n);
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
