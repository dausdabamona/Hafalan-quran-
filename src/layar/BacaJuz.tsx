import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Translate } from '@phosphor-icons/react';
import { cariSurah, rentangJuz } from '../data';
import { ambilHafalan, db, type Keterangan, type Makna } from '../db';
import { ayatHafal, type EntriHafalan } from '../jadwal';
import Kepala from '../komponen/Kepala';
import MushafBaca, { type BagianBaca } from '../komponen/MushafBaca';
import { ganti, pergi } from '../navigasi';

// K-98 (tambahan 8 Nov): Baca per juz — seluruh ayat satu juz lintas surah, seperti mushaf.

function bacaTampilMakna(): boolean {
  try {
    return localStorage.getItem('tampilMakna') !== '0';
  } catch {
    return true;
  }
}

export default function LayarBacaJuz({ nomor }: { nomor: number }) {
  const bagian: BagianBaca[] = useMemo(
    () => rentangJuz(nomor).map((b) => ({ surah: cariSurah(b.surah)!, ayatAwal: b.ayatAwal, ayatAkhir: b.ayatAkhir })),
    [nomor],
  );
  const [makna, setMakna] = useState<Map<string, Makna>>(new Map());
  const [keterangan, setKeterangan] = useState<Map<string, Keterangan>>(new Map());
  const [hafalan, setHafalan] = useState<Map<string, EntriHafalan>>(new Map());
  const [tampilMakna, setTampilMakna] = useState(bacaTampilMakna);

  useEffect(() => {
    const surah = bagian.map((b) => b.surah.nomor);
    db.makna
      .where('surah')
      .anyOf(surah)
      .toArray()
      .then((x) => setMakna(new Map(x.map((m) => [m.kunci, m]))));
    db.keterangan
      .where('surah')
      .anyOf(surah)
      .toArray()
      .then((x) => setKeterangan(new Map(x.map((k) => [k.kunci, k]))));
    ambilHafalan().then(setHafalan);
    window.scrollTo(0, 0);
  }, [bagian]);

  const hafalSet = useMemo(() => ayatHafal(hafalan), [hafalan]);
  if (!bagian.length) return null;

  const pertama = bagian[0];
  const terakhir = bagian[bagian.length - 1];
  const jumlahAyat = bagian.reduce((n, b) => n + b.ayatAkhir - b.ayatAwal + 1, 0);
  const ubahMakna = () =>
    setTampilMakna((v) => {
      try {
        localStorage.setItem('tampilMakna', v ? '0' : '1');
      } catch {
        // abaikan
      }
      return !v;
    });

  return (
    <>
      <Kepala
        judul={`Juz ${nomor}`}
        sub={`${pertama.surah.nama} ${pertama.ayatAwal} – ${terakhir.surah.nama} ${terakhir.ayatAkhir} · ${jumlahAyat} ayat`}
        kanan={
          <button
            className={'tombol-ikon kecil' + (tampilMakna ? ' aktif' : '')}
            onClick={ubahMakna}
            aria-label="Tampilkan atau sembunyikan makna"
          >
            <Translate size={18} weight="duotone" /> Makna
          </button>
        }
      />
      <MushafBaca
        bagian={bagian}
        makna={makna}
        keterangan={keterangan}
        hafalSet={hafalSet}
        tampilMakna={tampilMakna}
        kepalaSurah
        keKajian={(s, a) => {
          try {
            localStorage.setItem('modeMushaf', 'kajian');
          } catch {
            // abaikan
          }
          pergi(`#/surah/${s}/${a}`);
        }}
      >
        <div className="nav-baca nav-juz">
          {nomor > 1 ? (
            <button className="tombol sekunder" onClick={() => ganti(`#/juz/${nomor - 1}`)}>
              <ArrowLeft weight="bold" /> Juz {nomor - 1}
            </button>
          ) : (
            <span />
          )}
          {nomor < 30 && (
            <button className="tombol utama" onClick={() => ganti(`#/juz/${nomor + 1}`)}>
              Juz {nomor + 1} <ArrowRight weight="bold" />
            </button>
          )}
        </div>
      </MushafBaca>
    </>
  );
}
