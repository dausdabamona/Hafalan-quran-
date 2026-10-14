import { useCallback, useEffect, useRef, useState } from 'react';

// Format rekaman yang didukung WebView Android; urut dari yang paling hemat ruang.
const FORMAT = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/mp4'];

function pilihFormat(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return FORMAT.find((f) => MediaRecorder.isTypeSupported(f));
}

export type StatusPerekam = 'siap' | 'meminta-izin' | 'merekam' | 'ditolak' | 'tidak-didukung';

// Satu aliran mikrofon dipakai untuk semua ayat dalam satu sesi, sehingga izin
// hanya diminta sekali; tiap ayat direkam sebagai berkas tersendiri (K-12).
export function usePerekam() {
  const aliran = useRef<MediaStream | null>(null);
  const perekam = useRef<MediaRecorder | null>(null);
  const potongan = useRef<Blob[]>([]);
  const mulaiPada = useRef(0);
  const [status, setStatus] = useState<StatusPerekam>(
    typeof MediaRecorder === 'undefined' ? 'tidak-didukung' : 'siap',
  );

  const lepas = useCallback(() => {
    if (perekam.current && perekam.current.state !== 'inactive') perekam.current.stop();
    aliran.current?.getTracks().forEach((t) => t.stop());
    aliran.current = null;
    perekam.current = null;
  }, []);

  useEffect(() => lepas, [lepas]);

  const mulai = useCallback(async (): Promise<boolean> => {
    if (status === 'tidak-didukung') return false;
    try {
      if (!aliran.current) {
        setStatus('meminta-izin');
        aliran.current = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
      }
      const format = pilihFormat();
      const r = new MediaRecorder(aliran.current, format ? { mimeType: format } : undefined);
      potongan.current = [];
      r.ondataavailable = (e) => {
        if (e.data.size > 0) potongan.current.push(e.data);
      };
      r.start();
      perekam.current = r;
      mulaiPada.current = Date.now();
      setStatus('merekam');
      return true;
    } catch {
      setStatus('ditolak');
      return false;
    }
  }, [status]);

  // Menghentikan rekaman ayat yang sedang berjalan dan mengembalikan berkasnya.
  const selesai = useCallback((): Promise<{ audio: Blob; durasiMs: number } | null> => {
    const r = perekam.current;
    if (!r || r.state === 'inactive') return Promise.resolve(null);
    return new Promise((beres) => {
      r.onstop = () => {
        const audio = new Blob(potongan.current, { type: r.mimeType || 'audio/webm' });
        beres({ audio, durasiMs: Date.now() - mulaiPada.current });
      };
      r.stop();
      setStatus('siap');
    });
  }, []);

  return { status, mulai, selesai, lepas };
}

// URL sementara untuk memutar Blob; dilepas saat komponen selesai.
export function useUrlAudio(audio: Blob | undefined): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!audio) {
      setUrl(undefined);
      return;
    }
    const u = URL.createObjectURL(audio);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [audio]);
  return url;
}
