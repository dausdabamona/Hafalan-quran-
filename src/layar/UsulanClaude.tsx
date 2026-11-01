import { useCallback, useEffect, useState } from 'react';
import { ArrowSquareOut, Sparkle } from '@phosphor-icons/react';
import Kepala from '../komponen/Kepala';
import { db, type UsulanClaude } from '../db';
import {
  barisTujuan,
  kembalikanUsulan,
  statusEfektif,
  terimaSemua,
  terimaUsulan,
  tolakUsulan,
  type StatusEfektif,
} from '../mcp/usulan';
import { pergi } from '../navigasi';

// K-92/K-93: usulan suntingan dari Claude ditinjau di sini — terima/tolak satu per satu atau terima semua;
// usulan yang bentrok menampilkan dua versi berdampingan. Tanpa keputusan, versi yang ada tetap berlaku.

interface Butir {
  u: UsulanClaude;
  status: StatusEfektif;
  isiSekarang: string | null; // isi baris tujuan sekarang (null = belum ada)
}

const LABEL_JENIS: Record<UsulanClaude['tabel'], string> = {
  makna: 'Makna',
  keterangan: 'Keterangan',
  maknaHadits: 'Terjemah hadits',
  catatanHadits: 'Catatan hadits',
};

function waktu(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function hashTujuan(u: UsulanClaude): string | null {
  if (u.surah && u.ayat) return `#/surah/${u.surah}/${u.ayat}`;
  if (u.kitab && u.nomor) return `#/hadits/${u.kitab}/${u.nomor}`;
  return null;
}

export default function LayarUsulanClaude() {
  const [menunggu, setMenunggu] = useState<Butir[] | null>(null);
  const [riwayat, setRiwayat] = useState<UsulanClaude[]>([]);
  const [pesan, setPesan] = useState('');

  const muat = useCallback(async () => {
    const tunggu = await db.usulanClaude.where('status').equals('menunggu').toArray();
    tunggu.sort((a, b) => a.dibuat.localeCompare(b.dibuat));
    const butir: Butir[] = [];
    for (const u of tunggu) {
      const baris = await barisTujuan(db, u.tabel, u.kunciTujuan);
      butir.push({ u, status: statusEfektif(u, baris), isiSekarang: baris?.isi ?? null });
    }
    setMenunggu(butir);
    const lain = await db.usulanClaude.where('status').anyOf('diterima', 'ditolak').toArray();
    lain.sort((a, b) => (b.diputuskan ?? '').localeCompare(a.diputuskan ?? ''));
    setRiwayat(lain.slice(0, 20));
  }, []);

  useEffect(() => {
    muat();
  }, [muat]);

  const jalankan = async (kerja: () => Promise<unknown>, berhasil: string) => {
    try {
      await kerja();
      setPesan(berhasil);
    } catch (e) {
      setPesan((e as Error).message);
    }
    await muat();
  };

  if (!menunggu) return <Kepala judul="Usulan Claude" />;

  const bisaSemua = menunggu.filter((b) => b.status === 'menunggu').length;
  const bentrok = menunggu.length - bisaSemua;

  return (
    <>
      <Kepala judul="Usulan Claude" sub="Saran suntingan makna & kajian" />
      {pesan && <p className="pesan-tandai tengah">{pesan}</p>}

      {menunggu.length === 0 ? (
        <section className="kartu">
          <p className="kosong">
            Belum ada usulan yang menunggu. Usulan dari Claude masuk ke sini lewat sinkron dengan komputer.
          </p>
        </section>
      ) : (
        bisaSemua > 1 && (
          <section className="kartu">
            <button
              className="tombol utama lebar"
              onClick={() => {
                if (!window.confirm(`Terima ${bisaSemua} usulan sekaligus?`)) return;
                jalankan(async () => {
                  const h = await terimaSemua(db);
                  return h;
                }, `${bisaSemua} usulan diterima.`);
              }}
            >
              Terima semua ({bisaSemua})
            </button>
            {bentrok > 0 && <p className="kosong">{bentrok} usulan bentrok dilewati dan perlu dipilih satu per satu.</p>}
          </section>
        )
      )}

      {menunggu.map((b) => (
        <KartuUsulan key={b.u.kunci} butir={b} jalankan={jalankan} />
      ))}

      {riwayat.length > 0 && (
        <section className="kartu">
          <p className="kicker">Riwayat</p>
          <ul className="usulan-riwayat">
            {riwayat.map((u) => (
              <li key={u.kunci}>
                <span className="usulan-riwayat-isi">
                  <strong>{u.rujukan}</strong>
                  <span className="kosong">
                    {u.status === 'diterima' ? (u.dikembalikan ? 'diterima lalu dikembalikan' : 'diterima') : 'ditolak'} ·{' '}
                    {waktu(u.dikembalikan ?? u.diputuskan)}
                  </span>
                </span>
                {u.status === 'diterima' && !u.dikembalikan && (
                  <button
                    className="tautan"
                    onClick={() => {
                      if (!window.confirm(`Kembalikan ${u.rujukan} ke isi sebelum usulan diterima?`)) return;
                      jalankan(() => kembalikanUsulan(db, u.kunci), 'Dikembalikan ke isi lama.');
                    }}
                  >
                    Kembalikan
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function KartuUsulan({
  butir,
  jalankan,
}: {
  butir: Butir;
  jalankan: (kerja: () => Promise<unknown>, berhasil: string) => Promise<void>;
}) {
  const { u, status, isiSekarang } = butir;
  const [sunting, setSunting] = useState<string | null>(null);
  const isBentrok = status === 'bentrok';
  const tujuan = hashTujuan(u);
  const sekarang = isiSekarang ?? u.isiBawaan;

  return (
    <section className={'kartu usulan' + (isBentrok ? ' usulan-bentrok' : '')}>
      <p className="kicker">
        <Sparkle size={18} weight="duotone" className="ikon" /> {LABEL_JENIS[u.tabel]}
        {isBentrok && <span className="lencana-target">bentrok</span>}
      </p>
      <div className="usulan-judul">
        <strong>{u.rujukan}</strong>
        {tujuan && (
          <button className="tombol-ikon" onClick={() => pergi(tujuan)} aria-label="Buka">
            <ArrowSquareOut weight="duotone" />
          </button>
        )}
      </div>
      <p className="kosong">Diusulkan {waktu(u.dibuat)}</p>
      {u.catatan && <p className="usulan-catatan">“{u.catatan}”</p>}
      {isBentrok && (
        <p className="pesan-galat">Catatan ini sudah Bapak ubah sesudah usulan dibuat. Pilih versi yang dipakai.</p>
      )}

      <div className="usulan-dua">
        <div className="usulan-blok">
          <span className="usulan-label">
            {isBentrok ? 'Versi HP sekarang' : isiSekarang === null && u.isiBawaan ? 'Sekarang (bawaan)' : 'Sekarang'}
          </span>
          <p className="usulan-isi">{sekarang || <em>belum ada</em>}</p>
        </div>
        <div className="usulan-blok usulan-baru">
          <span className="usulan-label">Usulan Claude</span>
          <p className="usulan-isi">{u.isiBaru}</p>
        </div>
      </div>

      {sunting !== null ? (
        <>
          <textarea
            className="isian"
            rows={5}
            value={sunting}
            onChange={(e) => setSunting(e.target.value)}
            aria-label="Sunting sebelum dipakai"
          />
          <div className="usulan-tombol">
            <button
              className="tombol utama"
              disabled={!sunting.trim()}
              onClick={() => jalankan(() => terimaUsulan(db, u.kunci, { isi: sunting, paksa: true }), 'Suntingan dipakai.')}
            >
              Simpan
            </button>
            <button className="tombol sekunder" onClick={() => setSunting(null)}>
              Batal
            </button>
          </div>
        </>
      ) : isBentrok ? (
        <div className="usulan-tombol">
          <button className="tombol sekunder" onClick={() => jalankan(() => tolakUsulan(db, u.kunci), 'Versi HP tetap dipakai.')}>
            Pakai versi HP
          </button>
          <button
            className="tombol utama"
            onClick={() => jalankan(() => terimaUsulan(db, u.kunci, { paksa: true }), 'Usulan Claude dipakai.')}
          >
            Pakai usulan Claude
          </button>
          <button className="tautan" onClick={() => setSunting(u.isiBaru)}>
            Sunting gabungan
          </button>
        </div>
      ) : (
        <div className="usulan-tombol">
          <button className="tombol utama" onClick={() => jalankan(() => terimaUsulan(db, u.kunci), 'Usulan diterima.')}>
            Terima
          </button>
          <button className="tombol sekunder" onClick={() => jalankan(() => tolakUsulan(db, u.kunci), 'Usulan ditolak.')}>
            Tolak
          </button>
          <button className="tautan" onClick={() => setSunting(u.isiBaru)}>
            Sunting dulu
          </button>
        </div>
      )}
    </section>
  );
}
