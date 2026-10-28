import type { JenisSalah } from '../db';

// K-83: tiga jenis kesalahan kata, masing-masing berwarna.
export const LABEL_JENIS: Record<JenisSalah, string> = {
  hafalan: 'Salah hafalan',
  panjang: 'Panjang-pendek',
  sebut: 'Salah penyebutan',
};

export const kelasJenis = (j: JenisSalah | undefined) => 'jenis-' + (j ?? 'hafalan');

// Lembar kecil untuk memilih jenis tanda pada satu kata.
export default function PilihJenisSalah({
  kata,
  jenisKini,
  pilih,
  tutup,
}: {
  kata: string;
  jenisKini?: JenisSalah;
  pilih: (j: JenisSalah | null) => void;
  tutup: () => void;
}) {
  return (
    <div className="latar-lembar latar-jenis" onClick={tutup}>
      <div className="lembar lembar-jenis" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <p className="kata-dipilih" lang="ar" dir="rtl">
          {kata}
        </p>
        <div className="pilihan-jenis">
          {(Object.keys(LABEL_JENIS) as JenisSalah[]).map((j) => (
            <button
              key={j}
              type="button"
              className={'tombol-jenis ' + kelasJenis(j) + (jenisKini === j ? ' aktif' : '')}
              aria-pressed={jenisKini === j}
              onClick={() => pilih(j)}
            >
              <span className="titik-jenis" aria-hidden="true" />
              {LABEL_JENIS[j]}
            </button>
          ))}
        </div>
        <div className="aksi-lembar">
          {jenisKini && (
            <button className="tombol sekunder" onClick={() => pilih(null)}>
              Hapus tanda
            </button>
          )}
          <button className="tombol sekunder" onClick={tutup}>
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}
