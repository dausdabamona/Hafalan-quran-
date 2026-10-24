// K-63: mode gelap. Pilihan disimpan di perangkat ini saja (tidak ikut sinkron).
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';

export type PilihanTema = 'terang' | 'gelap' | 'ikut';

const KUNCI = 'tema';
const WARNA_BILAH = { terang: '#146b38', gelap: '#0c2a1f' } as const;
const mediaGelap = () =>
  typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

export function bacaTema(): PilihanTema {
  try {
    const t = localStorage.getItem(KUNCI);
    if (t === 'terang' || t === 'gelap' || t === 'ikut') return t;
  } catch {
    // abaikan
  }
  return 'ikut';
}

export function temaGelapAktif(p: PilihanTema = bacaTema()): boolean {
  return p === 'gelap' || (p === 'ikut' && !!mediaGelap()?.matches);
}

function perbaruiBilah(p: PilihanTema) {
  const gelap = temaGelapAktif(p);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', gelap ? WARNA_BILAH.gelap : WARNA_BILAH.terang);
  if (Capacitor.isNativePlatform()) {
    // Ikon bilah status terang saat gelap; selain itu ikut isi halaman seperti sebelumnya.
    SystemBars.setStyle({ style: gelap ? SystemBarsStyle.Dark : SystemBarsStyle.Default }).catch(() => undefined);
  }
}

export function terapkanTema(p: PilihanTema = bacaTema()) {
  const root = document.documentElement;
  if (p === 'ikut') root.removeAttribute('data-tema');
  else root.setAttribute('data-tema', p);
  perbaruiBilah(p);
}

export function simpanTema(p: PilihanTema) {
  try {
    localStorage.setItem(KUNCI, p);
  } catch {
    // abaikan: tema tetap berlaku sampai aplikasi ditutup
  }
  terapkanTema(p);
}

// Dipanggil sekali saat aplikasi dibuka: terapkan pilihan dan ikuti perubahan tema HP.
export function pasangTema() {
  terapkanTema();
  mediaGelap()?.addEventListener?.('change', () => {
    if (bacaTema() === 'ikut') perbaruiBilah('ikut');
  });
}
