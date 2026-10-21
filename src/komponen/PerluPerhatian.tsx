import { WarningCircle } from '@phosphor-icons/react';
import { cariSurah } from '../data';
import type { TandaSalah, TandaTertukar } from '../db';
import { petaJuz } from '../kemajuan';
import { pergi } from '../navigasi';
import { namaRukuk } from '../layar/HariIni';

// Kartu "Perlu perhatian" (K-50): rukuk yang lemah dan sambungan yang sering tertukar.
export default function PerluPerhatian({
  hafal,
  tandaSalah,
  tertukar,
}: {
  hafal: Set<string>;
  tandaSalah: TandaSalah[];
  tertukar: TandaTertukar[];
}) {
  if (hafal.size === 0 || (tandaSalah.length === 0 && tertukar.length === 0)) return null;
  const lemah = Array.from({ length: 30 }, (_, i) => petaJuz(i + 1, hafal, tandaSalah, tertukar))
    .flat()
    .filter((p) => p.kekuatan === 'lemah')
    .sort((a, b) => b.salah - a.salah)
    .slice(0, 2);
  const sering = [...tertukar]
    .filter((t) => t.jumlah >= 2)
    .sort((a, b) => b.jumlah - a.jumlah)
    .slice(0, 2);
  if (lemah.length === 0 && sering.length === 0) return null;
  return (
    <section className="bagian kartu-perhatian">
      <p className="kicker merah">
        <WarningCircle size={18} weight="duotone" className="ikon" /> Perlu perhatian
      </p>
      <ul className="daftar-perhatian">
        {lemah.map((p) => (
          <li key={p.rukuk.nomor}>
            <button onClick={() => pergi(`#/surah/${p.rukuk.surah}/${p.rukuk.ayatAwal}`)}>
              <span>{namaRukuk(p.rukuk)}</span>
              <span className="nilai">{p.salah} kata/sambungan salah</span>
            </button>
          </li>
        ))}
        {sering.map((t) => (
          <li key={t.kunci}>
            <button onClick={() => pergi(`#/surah/${t.surah}/${t.ayatAsal}`)}>
              <span>
                Sambungan {cariSurah(t.surah)?.nama} {t.ayatAsal} → {t.ayatAsal + 1}
              </span>
              <span className="nilai">tertukar {t.jumlah}×</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
