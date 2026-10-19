import type { ReactNode } from 'react';
import { ArrowLeft } from '@phosphor-icons/react';

// Kepala layar turunan (Broadsheet): sticky di atas kertas, tombol kembali ghost.
export default function Kepala({
  judul,
  sub,
  kembali = true,
  kanan,
}: {
  judul: string;
  sub?: string;
  kembali?: boolean;
  kanan?: ReactNode;
}) {
  return (
    <header className="kepala">
      {kembali && (
        <button className="tombol-ikon" onClick={() => history.back()} aria-label="Kembali">
          <ArrowLeft weight="duotone" />
        </button>
      )}
      <div className="judul-surah">
        <h1>{judul}</h1>
        {sub && <p className="sub">{sub}</p>}
      </div>
      {kanan}
    </header>
  );
}
