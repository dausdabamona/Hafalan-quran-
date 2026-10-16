import { MediaSession } from '@capgo/capacitor-media-session';
import { cariSurah } from './data';

// Pemutar murotal (K-28). Satu elemen audio untuk seluruh aplikasi, sehingga
// pemutaran tetap berjalan saat pindah layar. Di Android, MediaSession menjalankan
// layanan latar depan (notifikasi pemutar) agar tetap terdengar saat layar mati.
// Ayat berikutnya dimulai dari peristiwa 'ended' tanpa pewaktu, karena pewaktu
// diperlambat oleh WebView saat aplikasi di latar belakang.

export interface ItemMurotal {
  surah: number;
  ayat: number;
  audio: Blob;
}

export interface KeadaanPemutar {
  judul: string;
  daftar: ItemMurotal[];
  indeks: number;
  main: boolean;
  kecepatan: number;
  selesai: boolean;
  asal: string; // hash layar murotal, untuk kembali dari bilah pemutar
}

let keadaan: KeadaanPemutar | null = null;
const pendengar = new Set<(k: KeadaanPemutar | null) => void>();
let audio: HTMLAudioElement | null = null;
let url: string | null = null;

function kabari() {
  const salinan = keadaan ? { ...keadaan } : null;
  for (const f of pendengar) f(salinan);
}

export function dengarkan(f: (k: KeadaanPemutar | null) => void): () => void {
  pendengar.add(f);
  f(keadaan ? { ...keadaan } : null);
  return () => pendengar.delete(f);
}

export function keadaanPemutar(): KeadaanPemutar | null {
  return keadaan ? { ...keadaan } : null;
}

function elemen(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio();
    audio.preload = 'auto';
    audio.addEventListener('ended', () => {
      if (!keadaan) return;
      if (keadaan.indeks < keadaan.daftar.length - 1) muat(keadaan.indeks + 1, true);
      else {
        keadaan.main = false;
        keadaan.selesai = true;
        sesi('paused');
        kabari();
      }
    });
    audio.addEventListener('pause', () => {
      if (keadaan && keadaan.main && !audio!.ended) {
        keadaan.main = false;
        sesi('paused');
        kabari();
      }
    });
    audio.addEventListener('play', () => {
      // Hanya satu suara: rekaman lain yang sedang diputar dihentikan.
      jedaAudioLain(audio);
      if (keadaan && !keadaan.main) {
        keadaan.main = true;
        sesi('playing');
        kabari();
      }
    });
    pasangTombolNotifikasi();
  }
  return audio;
}

function muat(indeks: number, putar: boolean) {
  if (!keadaan) return;
  const a = elemen();
  const item = keadaan.daftar[indeks];
  keadaan.indeks = indeks;
  keadaan.selesai = false;
  if (url) URL.revokeObjectURL(url);
  url = URL.createObjectURL(item.audio);
  a.src = url;
  a.playbackRate = keadaan.kecepatan;
  metadata();
  if (putar) {
    keadaan.main = true;
    a.play().catch(() => {
      if (keadaan) keadaan.main = false;
      kabari();
    });
    sesi('playing');
  }
  kabari();
}

export function mulai(judul: string, daftar: ItemMurotal[], asal: string, indeks = 0) {
  if (daftar.length === 0) return;
  keadaan = { judul, daftar, indeks, main: false, kecepatan: keadaan?.kecepatan ?? 1, selesai: false, asal };
  muat(indeks, true);
}

export function putarJeda() {
  if (!keadaan || !audio) return;
  if (keadaan.main) audio.pause();
  else if (keadaan.selesai) muat(0, true);
  else {
    keadaan.main = true;
    audio.play().catch(() => undefined);
    sesi('playing');
    kabari();
  }
}

export function lompat(arah: number) {
  if (!keadaan) return;
  const tujuan = keadaan.indeks + arah;
  if (tujuan < 0 || tujuan >= keadaan.daftar.length) return;
  muat(tujuan, keadaan.main || keadaan.selesai);
}

export function pilihAyat(indeks: number) {
  if (!keadaan) return;
  muat(indeks, true);
}

export function aturKecepatan(k: number) {
  if (!keadaan) return;
  keadaan.kecepatan = k;
  if (audio) audio.playbackRate = k;
  kabari();
}

export function berhenti() {
  if (audio) {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }
  if (url) URL.revokeObjectURL(url);
  url = null;
  keadaan = null;
  sesi('none');
  kabari();
}

// ---------- Satu suara dalam satu waktu ----------

function jedaAudioLain(kecuali: HTMLMediaElement | null) {
  document.querySelectorAll('audio, video').forEach((el) => {
    const m = el as HTMLMediaElement;
    if (m !== kecuali && !m.paused) m.pause();
  });
}

// Dipasang sekali saat aplikasi dimulai: setiap kali satu rekaman mulai diputar
// (tombol putar ayat, Putar semua, dll.), rekaman lain dan murotal dijeda.
export function pasangSatuSuara() {
  document.addEventListener(
    'play',
    (e) => {
      const el = e.target as HTMLMediaElement;
      if (el === audio) return;
      jedaAudioLain(el);
      if (audio && !audio.paused) audio.pause();
    },
    true,
  );
}

// ---------- Notifikasi pemutar & layanan latar depan ----------

function sesi(status: 'playing' | 'paused' | 'none') {
  MediaSession.setPlaybackState({ playbackState: status }).catch(() => undefined);
}

function metadata() {
  if (!keadaan) return;
  const item = keadaan.daftar[keadaan.indeks];
  MediaSession.setMetadata({
    title: `${cariSurah(item.surah)?.nama ?? item.surah} · ayat ${item.ayat}`,
    artist: 'Rekaman murojaah saya',
    album: `Saku Hati · ${keadaan.judul}`,
  }).catch(() => undefined);
}

function pasangTombolNotifikasi() {
  const pasang = (action: 'play' | 'pause' | 'nexttrack' | 'previoustrack' | 'stop', f: () => void) =>
    MediaSession.setActionHandler({ action }, f).catch(() => undefined);
  pasang('play', () => keadaan && !keadaan.main && putarJeda());
  pasang('pause', () => keadaan?.main && putarJeda());
  pasang('nexttrack', () => lompat(1));
  pasang('previoustrack', () => lompat(-1));
  pasang('stop', berhenti);
}
