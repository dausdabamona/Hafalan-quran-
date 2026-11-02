import { useCallback, useEffect, useState } from 'react';
import { Sparkle } from '@phosphor-icons/react';
import { db, type TabelUsulan } from '../db';
import { terimaUsulan, tolakUsulan, usulanUntukBaris } from '../mcp/usulan';

// ---------- K-96: kotak Usulan Claude di dalam lembar makna / keterangan ----------

export type DataUsulanBaris = Awaited<ReturnType<typeof usulanUntukBaris>>;

// Memuat usulan menunggu untuk satu baris tujuan.
export function useUsulanBaris(tabel: TabelUsulan, kunciTujuan: string) {
  const [data, setData] = useState<DataUsulanBaris>(null);
  const muat = useCallback(async () => {
    try {
      setData(await usulanUntukBaris(db, tabel, kunciTujuan));
    } catch {
      setData(null);
    }
  }, [tabel, kunciTujuan]);
  useEffect(() => {
    muat();
  }, [muat]);
  return { data, muat };
}

export default function KotakUsulan({
  data,
  salin,
  sesudahTerima,
  sesudahTolak,
}: {
  data: DataUsulanBaris;
  salin: (isi: string) => void; // memasukkan isi usulan ke kolom sunting lembar
  sesudahTerima: () => Promise<void>; // muat ulang layar lalu tutup lembar
  sesudahTolak: () => Promise<void>; // muat ulang usulan & tanda di layar
}) {
  const [pesan, setPesan] = useState('');
  if (!data) return null;
  const { u, status } = data;
  const bentrok = status === 'bentrok';

  const jalankan = async (kerja: () => Promise<unknown>, sesudah: () => Promise<void>) => {
    try {
      await kerja();
      setPesan('');
      await sesudah();
    } catch (e) {
      setPesan((e as Error).message);
    }
  };

  return (
    <div className="usulan-blok usulan-baru kotak-usulan">
      <span className="usulan-label">
        <Sparkle weight="duotone" /> Usulan Claude{bentrok ? ' · bentrok' : ''}
      </span>
      <p className="usulan-isi">{u.isiBaru}</p>
      {u.catatan && <p className="usulan-catatan">{u.catatan}</p>}
      {bentrok && (
        <p className="kosong">Catatan ini sudah diubah sesudah usulan dibuat. Versi HP ada di kolom sunting di bawah.</p>
      )}
      {pesan && <p className="kosong">{pesan}</p>}
      <div className="usulan-tombol">
        <button
          className="tombol utama"
          onClick={() => jalankan(() => terimaUsulan(db, u.kunci, { paksa: bentrok }), sesudahTerima)}
        >
          {bentrok ? 'Pakai usulan Claude' : 'Terima'}
        </button>
        <button className="tombol sekunder" onClick={() => jalankan(() => tolakUsulan(db, u.kunci), sesudahTolak)}>
          {bentrok ? 'Pakai versi HP' : 'Tolak'}
        </button>
        <button className="tautan" onClick={() => salin(u.isiBaru)}>
          Salin ke kolom
        </button>
      </div>
    </div>
  );
}
