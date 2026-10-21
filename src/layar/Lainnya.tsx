import { ArrowsClockwise, BellRinging, Info, Link, ListChecks, Translate } from '@phosphor-icons/react';
import Kepala from '../komponen/Kepala';
import { pergi } from '../navigasi';
import { pengingatTersedia } from '../pengingat';
import { peranSinkron } from '../sinkron/peran';

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
    { judul: 'Tentang Saku Hati', isi: 'Metode, sumber data, versi', ikon: Info, hash: '#/tentang' },
  ];
  return (
    <>
      <Kepala judul="Lainnya" sub="Semua fitur Saku Hati" kembali={false} />
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
