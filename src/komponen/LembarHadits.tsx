import { useEffect, useState } from 'react';
import { ArrowSquareOut, CaretDown, CaretUp } from '@phosphor-icons/react';
import { pergi } from '../navigasi';
import type { Hadits } from '../db';
import { ambilHadits, ambilSuntingan, infoDataHadits, type KitabHadits } from '../hadits';

// Lembar hadits terkait satu ayat (K-75): nama kitab + nomor, bab, terjemahan, teks Arab (buka/tutup).
export default function LembarHadits({ judul, kunci, tutup }: { judul: string; kunci: string[]; tutup: () => void }) {
  const [hadits, setHadits] = useState<Hadits[] | null>(null);
  const [kitab, setKitab] = useState<Map<string, KitabHadits>>(new Map());
  const [arabTerbuka, setArabTerbuka] = useState<Set<string>>(new Set());
  const [lengkap, setLengkap] = useState(false);
  const [sunting, setSunting] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    ambilHadits(kunci).then(setHadits);
    ambilSuntingan(kunci).then(setSunting);
    infoDataHadits().then((i) => {
      setKitab(new Map((i?.kitab ?? []).map((k) => [k.kode, k])));
      setLengkap(i?.jenis === 'lengkap');
    });
  }, [kunci]);

  const bukaTutupArab = (k: string) =>
    setArabTerbuka((lama) => {
      const baru = new Set(lama);
      if (baru.has(k)) baru.delete(k);
      else baru.add(k);
      return baru;
    });

  return (
    <div className="latar-lembar" onClick={tutup}>
      <div className="lembar lembar-hadits" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="pegangan" />
        <p className="lokasi">
          {judul} · {kunci.length} hadits
        </p>
        <div className="daftar-hadits">
          {hadits === null && <p className="keterangan-kecil">Memuat…</p>}
          {hadits?.map((h) => (
            <article key={h.kunci} className="butir-hadits">
              <p className="kepala-hadits">
                <strong>
                  {kitab.get(h.kitab)?.nama ?? h.kitab} no. {h.nomor.toLocaleString('id-ID')}
                </strong>
                {h.bab && <span className="bab-hadits">{h.bab}</span>}
              </p>
              <p className="terjemah-hadits">{sunting.get(h.kunci) ?? h.terjemah}</p>
              <div className="aksi-butir-hadits">
                <button type="button" className="tautan" onClick={() => bukaTutupArab(h.kunci)}>
                  {arabTerbuka.has(h.kunci) ? <CaretUp weight="bold" /> : <CaretDown weight="bold" />}{' '}
                  {arabTerbuka.has(h.kunci) ? 'Tutup teks Arab' : 'Teks Arab'}
                </button>
                {lengkap && (
                  <button type="button" className="tautan" onClick={() => pergi(`#/hadits/${h.kitab}/${h.nomor}`)}>
                    <ArrowSquareOut weight="bold" /> Buka lengkap
                  </button>
                )}
              </div>
              {arabTerbuka.has(h.kunci) && (
                <p className="arab-hadits" lang="ar" dir="rtl">
                  {h.arab}
                </p>
              )}
            </article>
          ))}
        </div>
        <div className="aksi-lembar">
          <button className="tombol sekunder" onClick={tutup}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
