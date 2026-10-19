import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from '@phosphor-icons/react';
import { useUrlAudio } from '../perekam';

// Tombol putar/berhenti untuk satu rekaman ayat.
export default function TombolPutar({ audio, label = 'Putar' }: { audio?: Blob; label?: string }) {
  const url = useUrlAudio(audio);
  const el = useRef<HTMLAudioElement>(null);
  const [main, setMain] = useState(false);

  useEffect(() => {
    const a = el.current;
    if (!a) return;
    const henti = () => setMain(false);
    a.addEventListener('ended', henti);
    a.addEventListener('pause', henti);
    return () => {
      a.removeEventListener('ended', henti);
      a.removeEventListener('pause', henti);
    };
  }, [url]);

  if (!url) return null;

  const tekan = () => {
    const a = el.current;
    if (!a) return;
    if (main) {
      a.pause();
    } else {
      a.currentTime = 0;
      a.play()
        .then(() => setMain(true))
        .catch(() => setMain(false));
    }
  };

  return (
    <>
      <audio ref={el} src={url} preload="auto" />
      <button className={'tombol-putar' + (main ? ' aktif' : '')} onClick={tekan}>
        {main ? (
          <>
            <Pause weight="duotone" /> Jeda
          </>
        ) : (
          <>
            <Play weight="duotone" /> {label}
          </>
        )}
      </button>
    </>
  );
}
