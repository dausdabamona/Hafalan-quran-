import { useEffect, useState } from 'react';
import {
  ArrowsClockwise,
  BookOpenText,
  BellRinging,
  FloppyDisk,
  Scroll,
  DeviceMobile,
  Info,
  Link,
  ListChecks,
  Desktop,
  Moon,
  Sun,
  Translate,
} from '@phosphor-icons/react';
import Kepala from '../komponen/Kepala';
import { ambilSyaratMantap, simpanSyaratMantap } from '../db';
import { pergi } from '../navigasi';
import { pengingatTersedia } from '../pengingat';
import { peranSinkron } from '../sinkron/peran';
import { bacaTema, simpanTema, type PilihanTema } from '../tema';

// Semua fitur lain dalam satu layar (K-48), dibuka dari tab "Lainnya".
export default function LayarLainnya() {
  const item = [
    { judul: 'Sambung ayat', isi: 'Lanjutkan ayat sesudahnya', ikon: Link, hash: '#/sambung' },
    { judul: 'Tebak dari arti', isi: 'Tebak ayat dari maknanya', ikon: Translate, hash: '#/tebak-arti' },
    { judul: 'Rukuk yang dihafal', isi: 'Murojaah di luar jadwal', ikon: ListChecks, hash: '#/rukuk' },
    ...(pengingatTersedia()
      ? [{ judul: 'Pengingat ayat', isi: 'Kartu ayat di atas aplikasi lain', ikon: BellRinging, hash: '#/pengingat' }]
      : []),
    ...(peranSinkron()
      ? [{ judul: 'Sinkron HP ↔ Laptop', isi: 'Lewat Wi-Fi yang sama', ikon: ArrowsClockwise, hash: '#/sinkron' }]
      : []),
    { judul: 'Hadits', isi: '9 kitab: jelajah per bagian dan bab', ikon: BookOpenText, hash: '#/hadits' },
    { judul: 'Data hadits', isi: 'Muat atau hapus data hadits (berkas pribadi)', ikon: Scroll, hash: '#/data-hadits' },
    { judul: 'Cadangan', isi: 'Simpan & pulihkan semua data', ikon: FloppyDisk, hash: '#/cadangan' },
    { judul: 'Tentang Saku Hati', isi: 'Metode, sumber data, versi', ikon: Info, hash: '#/tentang' },
  ];
  return (
    <>
      <Kepala judul="Lainnya" sub="Semua fitur Saku Hati" kembali={false} />
      <PilihTema />
      <PilihSyaratMantap />
      <ul className="daftar-lainnya">
        {item.map((x) => {
          const Ikon = x.ikon;
          return (
            <li key={x.hash}>
              <button onClick={() => pergi(x.hash)}>
                <span className="ikon-kotak">
                  <Ikon size={24} weight="duotone" />
                </span>
                <span className="teks">
                  <strong>{x.judul}</strong>
                  <span>{x.isi}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

// K-88 (C): berapa hari berbeda potongan hafalan baru harus lancar sebelum dianggap mantap.
function PilihSyaratMantap() {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    ambilSyaratMantap().then(setN);
  }, []);
  if (n === null) return null;
  return (
    <section className="pilih-tema pilih-mantap" aria-label="Pemantapan hafalan baru">
      <p className="kicker">Pemantapan hafalan baru</p>
      <div className="kecepatan">
        {[1, 2, 3, 4, 5].map((m) => (
          <button
            key={m}
            className={'chip' + (n === m ? ' aktif' : '')}
            onClick={async () => {
              setN(m);
              await simpanSyaratMantap(m);
            }}
          >
            {m}×
          </button>
        ))}
      </div>
      <p className="keterangan-kecil">
        {n === 1
          ? 'Tanpa pemantapan: potongan baru setiap hari seperti sebelumnya.'
          : `Potongan baru dianggap mantap setelah lancar pada ${n} hari berbeda. Potongan berikutnya terbuka setelah pemantapan hari itu lancar. Menaikkan angka ini juga berlaku untuk potongan yang sudah mantap.`}
      </p>
    </section>
  );
}

// K-63: Terang / Gelap / Ikut HP, tersimpan di perangkat ini.
const PILIHAN: { nilai: PilihanTema; judul: string; ikon: typeof Sun }[] = [
  { nilai: 'terang', judul: 'Terang', ikon: Sun },
  { nilai: 'gelap', judul: 'Gelap', ikon: Moon },
  { nilai: 'ikut', judul: 'Ikut HP', ikon: DeviceMobile },
];

export function PilihTema({ ringkas = false }: { ringkas?: boolean }) {
  const [tema, setTema] = useState<PilihanTema>(bacaTema);
  return (
    <section className={'pilih-tema' + (ringkas ? ' ringkas' : '')} aria-label="Tampilan">
      {!ringkas && <p className="kicker">Tampilan</p>}
      <div className="segmen-tema" role="radiogroup" aria-label="Mode tampilan">
        {PILIHAN.map((p) => {
          const Ikon = ringkas && p.nilai === 'ikut' ? Desktop : p.ikon;
          const aktif = tema === p.nilai;
          return (
            <button
              key={p.nilai}
              type="button"
              role="radio"
              aria-checked={aktif}
              className={aktif ? 'aktif' : ''}
              title={ringkas && p.nilai === 'ikut' ? 'Ikut tema Windows' : p.judul}
              aria-label={ringkas && p.nilai === 'ikut' ? 'Ikut tema Windows' : p.judul}
              onClick={() => {
                simpanTema(p.nilai);
                setTema(p.nilai);
              }}
            >
              <Ikon size={20} weight={aktif ? 'fill' : 'regular'} /> {!ringkas && p.judul}
            </button>
          );
        })}
      </div>
    </section>
  );
}
