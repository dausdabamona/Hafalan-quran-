import { useEffect, useState } from 'react';
import { CaretRight, Sparkle } from '@phosphor-icons/react';
import { db } from '../db';
import { pergi } from '../navigasi';

// K-92: lencana di Hari ini bila ada usulan Claude yang menunggu. Tidak tampil bila tidak ada.
export default function KartuUsulanClaude() {
  const [jumlah, setJumlah] = useState(0);
  useEffect(() => {
    db.usulanClaude.where('status').equals('menunggu').count().then(setJumlah).catch(() => setJumlah(0));
  }, []);
  if (jumlah === 0) return null;
  return (
    <section className="bagian kartu-perbaikan">
      <button className="baris-koran usulan-lencana" onClick={() => pergi('#/usulan-claude')}>
        <span className="isi">
          <span className="judul">
            <span className="nama">
              <Sparkle size={18} weight="duotone" /> {jumlah} usulan Claude menunggu
            </span>
          </span>
          <span className="detail">Saran suntingan makna & kajian — tinjau, terima, atau tolak</span>
        </span>
        <span className="bulat-ikon">
          <CaretRight weight="bold" />
        </span>
      </button>
    </section>
  );
}
