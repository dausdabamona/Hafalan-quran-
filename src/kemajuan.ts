// Perhitungan untuk layar Hari ini dan Kemajuan (K-48, K-49).

// Tanggal lokal "YYYY-MM-DD" dari stempel ISO.
export function hariLokal(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function geser(hari: string, selisih: number): string {
  const [y, m, d] = hari.split('-').map(Number);
  const t = new Date(y, m - 1, d + selisih);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
}

// Rentetan hari berturut-turut yang ada latihannya (koreksi/murojaah tersimpan).
// Bila hari ini belum ada latihan, rentetan dihitung sampai kemarin (belum putus).
export function rentetanHari(hariLatihan: Iterable<string>, hari: string): number {
  const ada = new Set(hariLatihan);
  let mulai = ada.has(hari) ? hari : geser(hari, -1);
  let n = 0;
  while (ada.has(mulai)) {
    n++;
    mulai = geser(mulai, -1);
  }
  return n;
}
