import { BookOpen, ChartBar, DotsThreeCircle, Headphones, House } from '@phosphor-icons/react';
import type { Layar } from '../navigasi';
import { pergi } from '../navigasi';

type NamaLayar = Layar['nama'];

// Layar utama menu tab (K-48): di layar ini tombol Kembali disembunyikan.
// K-64: menu bawah sendiri tampil di semua layar HP, berupa ikon saja.
export const LAYAR_BERTAB: NamaLayar[] = ['hari-ini', 'daftar', 'rukuk', 'pilih-murotal', 'lainnya', 'kemajuan'];

const TAB: { judul: string; hash: string; ikon: typeof House; aktif: NamaLayar[] }[] = [
  { judul: 'Hari ini', hash: '#/', ikon: House, aktif: ['hari-ini'] },
  { judul: 'Mushaf', hash: '#/semua', ikon: BookOpen, aktif: ['daftar', 'rukuk'] },
  { judul: 'Kemajuan', hash: '#/kemajuan', ikon: ChartBar, aktif: ['kemajuan'] },
  { judul: 'Murotal', hash: '#/murotal', ikon: Headphones, aktif: ['pilih-murotal'] },
  {
    judul: 'Lainnya',
    hash: '#/lainnya',
    ikon: DotsThreeCircle,
    aktif: ['lainnya', 'kitab-hadits', 'bagian-hadits', 'daftar-hadits', 'hadits', 'data-hadits'],
  },
];

export default function BilahTab({ layar }: { layar: NamaLayar }) {
  return (
    <nav className="bilah-tab" aria-label="Menu utama">
      {TAB.map((t) => {
        const aktif = t.aktif.includes(layar);
        const Ikon = t.ikon;
        return (
          <button
            key={t.hash}
            className={aktif ? 'aktif' : ''}
            aria-current={aktif ? 'page' : undefined}
            aria-label={t.judul}
            title={t.judul}
            onClick={() => pergi(t.hash)}
          >
            <Ikon size={26} weight={aktif ? 'fill' : 'regular'} />
          </button>
        );
      })}
    </nav>
  );
}
