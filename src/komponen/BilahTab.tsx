import { BookOpen, ChartBar, DotsThreeCircle, Headphones, House } from '@phosphor-icons/react';
import type { Layar } from '../navigasi';
import { pergi } from '../navigasi';

type NamaLayar = Layar['nama'];

// Layar yang menampilkan menu tab bawah di HP (K-48). Layar kerja (rekam, koreksi,
// latihan) memakai bilah tombolnya sendiri di bawah, jadi tab tidak tampil di sana.
export const LAYAR_BERTAB: NamaLayar[] = ['hari-ini', 'daftar', 'rukuk', 'pilih-murotal', 'lainnya', 'kemajuan'];

const TAB: { judul: string; hash: string; ikon: typeof House; aktif: NamaLayar[] }[] = [
  { judul: 'Hari ini', hash: '#/', ikon: House, aktif: ['hari-ini'] },
  { judul: 'Mushaf', hash: '#/semua', ikon: BookOpen, aktif: ['daftar', 'rukuk'] },
  { judul: 'Kemajuan', hash: '#/kemajuan', ikon: ChartBar, aktif: ['kemajuan'] },
  { judul: 'Murotal', hash: '#/murotal', ikon: Headphones, aktif: ['pilih-murotal'] },
  { judul: 'Lainnya', hash: '#/lainnya', ikon: DotsThreeCircle, aktif: ['lainnya'] },
];

export default function BilahTab({ layar }: { layar: NamaLayar }) {
  if (!LAYAR_BERTAB.includes(layar)) return null;
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
            onClick={() => pergi(t.hash)}
          >
            <Ikon size={24} weight={aktif ? 'fill' : 'regular'} />
            <span>{t.judul}</span>
          </button>
        );
      })}
    </nav>
  );
}
