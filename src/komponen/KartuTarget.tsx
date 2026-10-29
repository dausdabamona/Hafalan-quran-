import { useEffect } from 'react';
import { Flag, Plus } from '@phosphor-icons/react';
import type { Potongan } from '../data';
import type { Sesi } from '../db';
import { tambahHari } from '../jadwal';
import { hashHafal, pergi } from '../navigasi';
import {
  catatHari,
  hitungTarget,
  namaTarget,
  susunBatang,
  warnaDariSesi,
  type Target,
  type WarnaHari,
} from '../target';
import { namaPotongan } from '../layar/HariIni';

const BATANG_TANPA_TARGET = 14;
const LABEL: Record<WarnaHari, string> = {
  hijau: 'selesai',
  kuning: 'sebagian',
  merah: 'terlewat',
  'hari-ini': 'hari ini',
  nanti: 'akan datang',
};

// Kartu target & batang hari (K-50). Satu batang = satu hari.
export default function KartuTarget({
  target,
  hafal,
  hari,
  sesi,
  catatan,
  warnaKini,
  tambahPotongan,
}: {
  target: Target | null;
  hafal: Set<string>;
  hari: string;
  sesi: Sesi[];
  catatan: Record<string, 'hijau' | 'kuning'>;
  warnaKini: WarnaHari;
  tambahPotongan?: Potongan;
}) {
  // Warna hari ini dicatat agar tetap benar besok (jadwal ulang tidak menyimpan riwayat).
  useEffect(() => {
    if (warnaKini === 'hijau' || warnaKini === 'kuning') catatHari(hari, warnaKini);
  }, [warnaKini, hari]);

  const dariSesi = warnaDariSesi(sesi);
  const h = target ? hitungTarget(target, hafal, hari) : null;
  const awal = target ? target.mulai : tambahHari(hari, -(BATANG_TANPA_TARGET - 1));
  const jumlah = target ? target.hari : BATANG_TANPA_TARGET;
  const batang = susunBatang(awal, jumlah, hari, catatan, dariSesi, warnaKini);

  return (
    <section className="bagian kartu-target">
      <div className="kepala-target">
        <p className="kicker">
          <Flag size={18} weight="duotone" className="ikon" /> {target ? 'Target' : '14 hari terakhir'}
        </p>
        <button className="tautan kecil" onClick={() => pergi('#/target')}>
          {target ? 'Ubah' : 'Buat target'}
        </button>
      </div>

      {target && h && (
        <>
          <h2 className="judul-target">
            {namaTarget(target)} dalam {target.hari} hari
          </h2>
          <div className="baris-target">
            <span>
              <strong>{h.hafal.toLocaleString('id-ID')}</strong> / {h.total.toLocaleString('id-ID')} ayat
            </span>
            <span>
              {h.selesai ? 'tercapai' : h.lewat ? 'waktu habis' : `hari ke-${Math.min(h.hariKe, target.hari)}`}
            </span>
          </div>
          <div className="garis-target" role="img" aria-label={`${h.hafal} dari ${h.total} ayat`}>
            <div style={{ width: `${h.total ? (h.hafal / h.total) * 100 : 0}%` }} />
            <span className="penanda-seharusnya" style={{ left: `${h.total ? (h.seharusnya / h.total) * 100 : 0}%` }} />
          </div>
        </>
      )}

      <div
        className={'batang-hari' + (jumlah > 30 ? ' rapat' : '')}
        role="img"
        aria-label={`${batang.filter((b) => b.warna === 'hijau').length} hari selesai, ${batang.filter((b) => b.warna === 'merah').length} hari terlewat`}
      >
        {batang.map((b) => (
          <span key={b.hari} className={'batang ' + b.warna} title={`${b.hari}: ${LABEL[b.warna]}`} />
        ))}
      </div>
      <div className="legenda-peta">
        {(['hijau', 'kuning', 'merah'] as WarnaHari[]).map((w) => (
          <span key={w}>
            <span className={'batang mini ' + w} />
            {LABEL[w]}
          </span>
        ))}
      </div>

      {h && !h.selesai && (
        <p className={'status-target' + (h.tertinggal > 0 ? ' tertinggal' : '')}>
          {h.tertinggal > 0
            ? `Tertinggal ${h.tertinggal} ayat dari jadwal. Perlu sekitar ${h.perHari} ayat per hari.`
            : `Sesuai jadwal. Sekitar ${h.perHari} ayat per hari sampai selesai.`}
        </p>
      )}
      {/* K-58: tombol tambah selalu ada selama target berjalan, setelah hafalan baru hari ini selesai. */}
      {h && !h.selesai && tambahPotongan && (
        <>
          {h.tertinggal === 0 && (
            <p className="keterangan-kecil">Hafalan baru hari ini sudah selesai. Bila sanggup, tambah dari target:</p>
          )}
          <button className="tombol sekunder lebar" onClick={() => pergi(hashHafal(tambahPotongan))}>
            <Plus weight="bold" /> Tambah satu potongan: {namaPotongan(tambahPotongan)}
          </button>
        </>
      )}
    </section>
  );
}
