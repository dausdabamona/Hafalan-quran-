import { useEffect, useState } from 'react';
import { daftarEjaan, terapkanEjaan, type AturanEjaan } from '../hadits';

// K-80 C: ejaan pilihan dipakai saat menampilkan terjemah asli dan judul bab.
const pendengar = new Set<() => void>();

export function kabariEjaanBerubah() {
  pendengar.forEach((f) => f());
}

export function useEjaan(): (teks: string) => string {
  const [aturan, setAturan] = useState<AturanEjaan[]>([]);
  useEffect(() => {
    const muat = () => daftarEjaan().then(setAturan);
    muat();
    pendengar.add(muat);
    return () => {
      pendengar.delete(muat);
    };
  }, []);
  return (teks: string) => terapkanEjaan(teks, aturan);
}
