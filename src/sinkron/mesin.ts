import { idAcak, TABEL_SINKRON, type SakuDB, type TabelSinkron } from '../db';

// Mesin sinkron Saku Hati (K-37). Tidak bergantung pada cara pengiriman (HTTP, uji, dll.).
//
// Setiap rekaman data membawa:
//   ubahMs   waktu perubahan oleh penulisnya — dipakai menentukan versi terbaru
//   terimaMs waktu diterima di perangkat ini — dipakai mencari perubahan sejak sinkron terakhir
//   asal     '' bila dibuat di perangkat ini, selain itu id perangkat pengirim
// Penghapusan dicatat di tabel `hapus` dengan penanda yang sama.

export type Rekaman = Record<string, unknown>;

export interface Paket {
  tabel: TabelSinkron | 'hapus';
  item: Rekaman[];
}

const BATAS: Record<string, number> = { rekaman: 5 };
const BATAS_BAWAAN = 300;

export function batasTabel(tabel: string): number {
  return BATAS[tabel] ?? BATAS_BAWAAN;
}

export function kunciRekaman(tabel: TabelSinkron, x: Rekaman): string {
  if (tabel === 'sesi') return String(x.uid);
  if (tabel === 'jadwalRukuk') return String(x.nomor);
  return String(x.kunci);
}

// ---------- Identitas perangkat ----------

export async function bacaMeta<T>(d: SakuDB, kunci: string): Promise<T | undefined> {
  return (await d.meta.get(kunci))?.nilai as T | undefined;
}

export async function tulisMeta(d: SakuDB, kunci: string, nilai: unknown) {
  await d.meta.put({ kunci, nilai });
}

export async function idPerangkat(d: SakuDB): Promise<string> {
  let id = await bacaMeta<string>(d, 'idPerangkat');
  if (!id) {
    id = idAcak();
    await tulisMeta(d, 'idPerangkat', id);
  }
  return id;
}

// ---------- Rekaman suara ↔ teks ----------

async function blobKeTeks(b: Blob): Promise<{ __blob: string; tipe: string }> {
  const bait = new Uint8Array(await b.arrayBuffer());
  let biner = '';
  const POTONG = 0x8000;
  for (let i = 0; i < bait.length; i += POTONG) biner += String.fromCharCode(...bait.subarray(i, i + POTONG));
  return { __blob: btoa(biner), tipe: b.type };
}

function teksKeBlob(t: { __blob: string; tipe: string }): Blob {
  const biner = atob(t.__blob);
  const bait = new Uint8Array(biner.length);
  for (let i = 0; i < biner.length; i++) bait[i] = biner.charCodeAt(i);
  return new Blob([bait], { type: t.tipe });
}

export async function siapKirim(tabel: string, x: Rekaman, idSaya: string): Promise<Rekaman> {
  const salin: Rekaman = { ...x };
  delete salin.terimaMs;
  if (tabel === 'sesi') delete salin.id;
  if (!salin.asal) salin.asal = idSaya;
  if (tabel === 'rekaman' && x.audio instanceof Blob) salin.audio = await blobKeTeks(x.audio);
  return salin;
}

function siapSimpan(tabel: string, x: Rekaman): Rekaman {
  const salin: Rekaman = { ...x };
  if (tabel === 'rekaman' && salin.audio && typeof salin.audio === 'object' && '__blob' in (salin.audio as object)) {
    salin.audio = teksKeBlob(salin.audio as { __blob: string; tipe: string });
  }
  return salin;
}

// ---------- Mengambil perubahan ----------

// Perubahan satu tabel dengan terimaMs di (sejak, sampai], halaman demi halaman.
// hanyaLokal: hanya yang dibuat di perangkat ini (untuk didorong ke pusat).
// kecualiAsal: lewati yang berasal dari perangkat peminta (agar tidak memantul balik).
export async function ambilPerubahan(
  d: SakuDB,
  tabel: TabelSinkron | 'hapus',
  o: { sejak: number; sampai: number; mulai: number; hanyaLokal?: boolean; kecualiAsal?: string },
): Promise<{ item: Rekaman[]; berikut: number | null }> {
  const batas = batasTabel(tabel);
  const mentah = (await d
    .table(tabel)
    .where('terimaMs')
    .between(o.sejak, o.sampai, false, true)
    .offset(o.mulai)
    .limit(batas)
    .toArray()) as Rekaman[];
  const idSaya = await idPerangkat(d);
  const item: Rekaman[] = [];
  for (const x of mentah) {
    if (o.hanyaLokal && x.asal) continue;
    if (o.kecualiAsal && x.asal === o.kecualiAsal) continue;
    item.push(await siapKirim(tabel, x, idSaya));
  }
  return { item, berikut: mentah.length < batas ? null : o.mulai + mentah.length };
}

// ---------- Menerapkan perubahan dari perangkat lain ----------

function sama(tabel: string, a: Rekaman, b: Rekaman): boolean {
  if (tabel === 'rekaman') return a.direkam === b.direkam && a.ubahMs === b.ubahMs;
  const bersih = (x: Rekaman) => {
    const { terimaMs: _t, asal: _a, id: _i, ...sisa } = x;
    return JSON.stringify(
      Object.keys(sisa)
        .sort()
        .map((k) => [k, sisa[k]]),
    );
  };
  return bersih(a) === bersih(b);
}

const angka = (x: unknown) => (typeof x === 'number' ? x : 0);

// Menentukan versi yang dipakai bila kedua perangkat punya rekaman dengan kunci sama.
// Hasilnya sama di kedua perangkat (tidak bergantung urutan), sehingga data menyatu.
export function gabung(tabel: TabelSinkron, lokal: Rekaman, jauh: Rekaman): Rekaman {
  if (tabel === 'tandaSalah' || tabel === 'tandaTertukar') {
    const baru = angka(jauh.ubahMs) > angka(lokal.ubahMs) ? jauh : lokal;
    return {
      ...baru,
      jumlah: Math.max(angka(lokal.jumlah), angka(jauh.jumlah)),
      pertama: [String(lokal.pertama), String(jauh.pertama)].sort()[0],
      terakhir: [String(lokal.terakhir), String(jauh.terakhir)].sort()[1],
      ubahMs: Math.max(angka(lokal.ubahMs), angka(jauh.ubahMs)),
    };
  }
  if (tabel === 'tandaArti') {
    const baru = angka(jauh.ubahMs) > angka(lokal.ubahMs) ? jauh : lokal;
    const benar = [String(lokal.benar ?? ''), String(jauh.benar ?? '')].sort()[1];
    return {
      ...baru,
      jumlah: Math.max(angka(lokal.jumlah), angka(jauh.jumlah)),
      pertama: [String(lokal.pertama), String(jauh.pertama)].sort()[0],
      terakhir: [String(lokal.terakhir), String(jauh.terakhir)].sort()[1],
      ...(benar ? { benar } : {}),
      ubahMs: Math.max(angka(lokal.ubahMs), angka(jauh.ubahMs)),
    };
  }
  if (tabel === 'setelan' && lokal.kunci === 'catatanHari') {
    // Catatan warna per hari digabung: hijau mengalahkan kuning, hari dari kedua perangkat dipakai.
    const a = (lokal.nilai ?? {}) as Record<string, string>;
    const b = (jauh.nilai ?? {}) as Record<string, string>;
    const nilai: Record<string, string> = { ...a };
    for (const [hari, w] of Object.entries(b)) if (nilai[hari] !== 'hijau') nilai[hari] = w;
    const baru = angka(jauh.ubahMs) > angka(lokal.ubahMs) ? jauh : lokal;
    const urut = Object.fromEntries(
      Object.keys(nilai)
        .sort()
        .map((k) => [k, nilai[k]]),
    );
    return { ...baru, nilai: urut, ubahMs: Math.max(angka(lokal.ubahMs), angka(jauh.ubahMs)) };
  }
  if (tabel === 'jadwalRukuk') {
    // Murojaah yang terakhir dipakai; bila di hari yang sama, kesalahan (jatuh tempo lebih dekat) dipakai.
    const ta = String(lokal.terakhir);
    const tb = String(jauh.terakhir);
    if (ta !== tb) return ta > tb ? lokal : jauh;
    const ja = String(lokal.jatuhTempo);
    const jb = String(jauh.jatuhTempo);
    if (ja !== jb) return ja < jb ? lokal : jauh;
  }
  if (angka(jauh.ubahMs) !== angka(lokal.ubahMs)) return angka(jauh.ubahMs) > angka(lokal.ubahMs) ? jauh : lokal;
  // Seri: urutan asal sebagai pemutus agar tetap pasti.
  return String(jauh.asal ?? '') > String(lokal.asal ?? '') ? jauh : lokal;
}

export interface HasilTerap {
  diterima: number;
  dihapus: number;
}

// Menerapkan satu paket dari perangkat `pengirim`.
export async function terapkan(d: SakuDB, pengirim: string, paket: Paket): Promise<HasilTerap> {
  const hasil: HasilTerap = { diterima: 0, dihapus: 0 };
  // Tabel dari versi aplikasi yang lebih baru diabaikan agar sinkron tetap berjalan.
  if (!SEMUA_TABEL.includes(paket.tabel)) return hasil;
  const kini = Date.now();
  const tabelTerlibat = paket.tabel === 'hapus' ? [...TABEL_SINKRON, 'hapus'] : [paket.tabel, 'hapus'];
  await d.transaction('rw', tabelTerlibat, async () => {
    d._terapkan = true;
    try {
      if (paket.tabel === 'hapus') {
        for (const t of paket.item) {
          const tabel = t.tabel as TabelSinkron;
          const tab = d.table(tabel);
          const kunci = String(t.kunciRekaman);
          const lokal = (
            tabel === 'sesi'
              ? await tab.where('uid').equals(kunci).first()
              : await tab.get(tabel === 'jadwalRukuk' ? Number(kunci) : kunci)
          ) as Rekaman | undefined;
          if (lokal && angka(lokal.ubahMs) > angka(t.ubahMs)) {
            // Data di sini lebih baru daripada penghapusannya: dipertahankan dan dikirim balik.
            await tab.put({ ...lokal, terimaMs: kini, asal: '' });
            continue;
          }
          if (lokal) {
            await tab.delete(tabel === 'sesi' ? (lokal.id as number) : tabel === 'jadwalRukuk' ? Number(kunci) : kunci);
            hasil.dihapus++;
          }
          const ada = (await d.hapus.get(String(t.kunci))) as Rekaman | undefined;
          if (!ada || angka(ada.ubahMs) < angka(t.ubahMs)) {
            await d.hapus.put({ ...t, terimaMs: kini, asal: String(t.asal || pengirim) } as never);
          }
        }
        return;
      }

      const tabel = paket.tabel;
      const tab = d.table(tabel);
      for (const mentah of paket.item) {
        const jauh = siapSimpan(tabel, { ...mentah, asal: String(mentah.asal || pengirim) });
        const kunci = kunciRekaman(tabel, jauh);
        const kunciHapus = `${tabel}|${kunci}`;
        const nisan = (await d.hapus.get(kunciHapus)) as Rekaman | undefined;
        if (nisan && angka(nisan.ubahMs) >= angka(jauh.ubahMs)) {
          // Sudah dihapus di sini setelah perubahan itu: penghapusan dikirim balik.
          await d.hapus.put({ ...nisan, terimaMs: kini, asal: '' } as never);
          continue;
        }
        const lokal = (
          tabel === 'sesi'
            ? await tab.where('uid').equals(kunci).first()
            : await tab.get(tabel === 'jadwalRukuk' ? Number(kunci) : kunci)
        ) as Rekaman | undefined;

        if (!lokal) {
          await tab.put({ ...jauh, terimaMs: kini });
          if (nisan) await d.hapus.delete(kunciHapus);
          hasil.diterima++;
          continue;
        }
        if (tabel === 'sesi') continue; // riwayat sesi hanya ditambah, tidak diubah

        const pilih = gabung(tabel, lokal, jauh);
        if (pilih === lokal || (pilih !== jauh && sama(tabel, pilih, lokal))) {
          // Versi di sini yang dipakai; bila berbeda, dikirim balik agar perangkat lain menyamakan.
          if (!sama(tabel, lokal, jauh)) await tab.put({ ...lokal, terimaMs: kini, asal: '' });
        } else if (pilih === jauh) {
          await tab.put({ ...jauh, terimaMs: kini });
          hasil.diterima++;
        } else {
          // Gabungan baru (tanda): disimpan dan dikirim ke perangkat lain.
          await tab.put({ ...pilih, terimaMs: kini, asal: sama(tabel, pilih, jauh) ? jauh.asal : '' });
          hasil.diterima++;
        }
      }
    } finally {
      d._terapkan = false;
    }
  });
  return hasil;
}

export const SEMUA_TABEL: (TabelSinkron | 'hapus')[] = [...TABEL_SINKRON, 'hapus'];
