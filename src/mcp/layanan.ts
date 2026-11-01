import { db } from '../db';
import { GalatAlat, jalankanAlat } from './alat';

// K-90: jendela Saku Hati Windows melayani permintaan alat MCP yang diteruskan proses utama.
// Hanya dipasang di versi Windows (ada jembatan sakuHatiDesktop); di HP tidak ada.

type Jawaban = { ok: true; hasil: unknown } | { ok: false; pesan: string };

declare global {
  interface Window {
    __sakuMcp?: (nama: string, argumen: Record<string, unknown>) => Promise<string>;
  }
}

export function pasangLayananMcp() {
  if (!(window as unknown as { sakuHatiDesktop?: unknown }).sakuHatiDesktop) return;
  window.__sakuMcp = async (nama, argumen) => {
    let jawaban: Jawaban;
    try {
      jawaban = { ok: true, hasil: await jalankanAlat(db, nama, argumen ?? {}) };
    } catch (e) {
      const pesan = e instanceof GalatAlat ? e.message : `Galat di Saku Hati: ${(e as Error)?.message ?? e}`;
      jawaban = { ok: false, pesan };
    }
    return JSON.stringify(jawaban);
  };
}
