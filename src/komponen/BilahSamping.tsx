import {
  ArrowsClockwise,
  BellRinging,
  BookOpen,
  ChartBar,
  FloppyDisk,
  Scroll,
  Headphones,
  Info,
  Link,
  ListChecks,
  Newspaper,
  Translate,
} from '@phosphor-icons/react';
import type { Layar } from '../navigasi';
import { pergi } from '../navigasi';
import { pengingatTersedia } from '../pengingat';
import { PilihTema } from '../layar/Lainnya';
import { peranSinkron } from '../sinkron/peran';
import Plat from './Plat';

type NamaLayar = Layar['nama'];

interface Item {
  judul: string;
  hash: string;
  ikon: React.ReactNode;
  aktif: NamaLayar[];
}

// Menu samping untuk layar lebar (K-43): tampil di Windows dan tablet; di HP disembunyikan
// lewat CSS sehingga tampilan HP tetap seperti biasa.
export default function BilahSamping({ layar }: { layar: NamaLayar }) {
  const ikon = (I: typeof BookOpen) => <I size={22} weight="duotone" />;
  const item: Item[] = [
    { judul: 'Hari ini', hash: '#/', ikon: ikon(Newspaper), aktif: ['hari-ini', 'rekam', 'koreksi'] },
    { judul: 'Jelajah mushaf', hash: '#/semua', ikon: ikon(BookOpen), aktif: ['daftar', 'surah'] },
    { judul: 'Kemajuan', hash: '#/kemajuan', ikon: ikon(ChartBar), aktif: ['kemajuan'] },
    { judul: 'Rukuk yang dihafal', hash: '#/rukuk', ikon: ikon(ListChecks), aktif: ['rukuk'] },
    { judul: 'Murotal', hash: '#/murotal', ikon: ikon(Headphones), aktif: ['pilih-murotal', 'murotal'] },
    { judul: 'Sambung ayat', hash: '#/sambung', ikon: ikon(Link), aktif: ['sambung'] },
    { judul: 'Tebak dari arti', hash: '#/tebak-arti', ikon: ikon(Translate), aktif: ['tebak-arti'] },
    ...(pengingatTersedia()
      ? [{ judul: 'Pengingat ayat', hash: '#/pengingat', ikon: ikon(BellRinging), aktif: ['pengingat'] as NamaLayar[] }]
      : []),
    ...(peranSinkron()
      ? [{ judul: 'Sinkron', hash: '#/sinkron', ikon: ikon(ArrowsClockwise), aktif: ['sinkron'] as NamaLayar[] }]
      : []),
    { judul: 'Data hadits', hash: '#/data-hadits', ikon: ikon(Scroll), aktif: ['data-hadits'] },
    { judul: 'Cadangan', hash: '#/cadangan', ikon: ikon(FloppyDisk), aktif: ['cadangan'] },
  ];

  return (
    <nav className="bilah-samping" aria-label="Menu utama">
      <button className="merek-samping" onClick={() => pergi('#/')}>
        <img src="./ikon.png" alt="" />
        <span>
          <Plat as="span" jenis="head" teks="Saku Hati" />
          <small>Sedikit Ayat, Kuat Ulangnya</small>
        </span>
      </button>
      <ul>
        {item.map((x) => (
          <li key={x.hash}>
            <button
              className={x.aktif.includes(layar) ? 'aktif' : ''}
              aria-current={x.aktif.includes(layar) ? 'page' : undefined}
              onClick={() => pergi(x.hash)}
            >
              {x.ikon}
              {x.judul}
            </button>
          </li>
        ))}
      </ul>
      <div className="kaki-samping">
        <PilihTema ringkas />
        <button className={layar === 'tentang' ? 'aktif' : ''} onClick={() => pergi('#/tentang')}>
          {ikon(Info)} Tentang
        </button>
        <p>
          <strong>SAKU</strong> Sedikit Ayat, Kuat Ulangnya
          <br />
          <strong>HATI</strong> Hafalkan Arti, Tekun Ingat
        </p>
      </div>
    </nav>
  );
}
