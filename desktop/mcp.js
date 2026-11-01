// Server MCP Saku Hati (K-89–K-92): alat baca (tahap a) dan alat usulan (tahap b).
// Dijalankan Claude desktop sebagai: "Saku Hati.exe" mcp.js dengan ELECTRON_RUN_AS_NODE=1,
// sehingga tidak perlu memasang Node.js. Berbicara MCP lewat stdio (JSON-RPC, satu pesan per baris)
// dan meneruskan setiap panggilan alat ke Saku Hati yang sedang terbuka lewat 127.0.0.1 bertoken.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const readline = require('node:readline');

const VERSI_PROTOKOL = ['2025-06-18', '2025-03-26', '2024-11-05'];

function berkasSambungan() {
  if (process.env.SAKU_HATI_SAMBUNGAN) return process.env.SAKU_HATI_SAMBUNGAN;
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  return path.join(appData, 'Saku Hati', 'mcp-sambungan.json');
}

const PETUNJUK =
  'Saku Hati adalah aplikasi hafalan Al-Qur\'an milik Firdaus. Data di komputer ini adalah cermin dari HP ' +
  '(database induk) per sinkron terakhir; setiap jawaban menyertakan sinkronHpTerakhir. ' +
  'Penomoran ayat mengikuti Saku Hati: Al-Fatihah ayat 1 = Alhamdulillah (basmalah tidak bernomor). ' +
  'Makna sendiri dan keterangan adalah hasil kajian pribadi Firdaus; sampaikan apa adanya. ' +
  'Potongan waqaf bernomor mulai 1 (lihat baca_makna). ' +
  'Claude tidak pernah mengubah data langsung: alat usul_* hanya menyimpan USULAN yang masuk ke HP saat sinkron ' +
  'dan berlaku setelah Firdaus menerimanya di layar Usulan Claude. Selalu baca isi sekarang dulu sebelum mengusulkan, ' +
  'beri catatan singkat alasannya, dan sampaikan kepada Firdaus bahwa itu masih usulan.';

const ALAT = [
  {
    name: 'baca_makna',
    description:
      'Membaca makna satu ayat per potongan waqaf: lafaz, arti per kata, makna bawaan (gabungan arti per kata), ' +
      'dan makna yang disusun sendiri oleh Firdaus beserta waktu ubah dan asalnya.',
    inputSchema: {
      type: 'object',
      properties: {
        surah: { type: 'integer', minimum: 1, maximum: 114, description: 'Nomor surah' },
        ayat: { type: 'integer', minimum: 1, description: 'Nomor ayat (penomoran Saku Hati)' },
      },
      required: ['surah', 'ayat'],
    },
    annotations: { title: 'Baca makna ayat', readOnlyHint: true },
  },
  {
    name: 'baca_keterangan',
    description: 'Membaca keterangan pribadi Firdaus untuk satu ayat dan untuk kata-kata di ayat itu.',
    inputSchema: {
      type: 'object',
      properties: {
        surah: { type: 'integer', minimum: 1, maximum: 114, description: 'Nomor surah' },
        ayat: { type: 'integer', minimum: 1, description: 'Nomor ayat (penomoran Saku Hati)' },
      },
      required: ['surah', 'ayat'],
    },
    annotations: { title: 'Baca keterangan ayat', readOnlyHint: true },
  },
  {
    name: 'baca_kajian_hadits',
    description:
      'Membaca satu hadits: teks Arab, terjemah asli, terjemah yang disunting sendiri, catatan kajian, ' +
      'ayat terkait (manual dan dari data), serta padanan antarkitab.',
    inputSchema: {
      type: 'object',
      properties: {
        kitab: {
          type: 'string',
          description: 'Kode kitab, mis. bukhari, muslim, abudaud, tirmidzi, nasai, ibnumajah, ahmad, malik, darimi',
        },
        nomor: { type: 'integer', minimum: 1, description: 'Nomor hadits di kitab itu' },
      },
      required: ['kitab', 'nomor'],
    },
    annotations: { title: 'Baca kajian hadits', readOnlyHint: true },
  },
  {
    name: 'cari_kajian',
    description:
      'Mencari kata di seluruh hasil kajian pribadi: makna ayat sendiri, keterangan ayat/kata, ' +
      'terjemah hadits sendiri, dan catatan hadits. Tidak mencari teks terjemah asli.',
    inputSchema: {
      type: 'object',
      properties: { kata: { type: 'string', minLength: 2, description: 'Kata atau frasa yang dicari' } },
      required: ['kata'],
    },
    annotations: { title: 'Cari kajian', readOnlyHint: true },
  },
  {
    name: 'status_sinkron',
    description: 'Menampilkan kapan data terakhir disinkronkan dari HP dan jumlah catatan kajian di komputer ini.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { title: 'Status sinkron', readOnlyHint: true },
  },
  {
    name: 'daftar_usulan',
    description:
      'Menampilkan usulan Claude yang sudah dibuat beserta statusnya (menunggu, bentrok, diterima, ditolak, diganti).',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['menunggu', 'semua'], description: 'Bawaan: menunggu (termasuk bentrok)' },
        batas: { type: 'integer', minimum: 1, maximum: 100, description: 'Jumlah usulan terbaru (bawaan 30)' },
      },
    },
    annotations: { title: 'Daftar usulan', readOnlyHint: true },
  },
  {
    name: 'usul_makna',
    description:
      'Mengusulkan makna baru untuk satu potongan waqaf. Tidak mengubah data; Firdaus meninjau di HP. ' +
      'Usulan baru untuk potongan yang sama menggantikan usulan sebelumnya yang masih menunggu.',
    inputSchema: {
      type: 'object',
      properties: {
        surah: { type: 'integer', minimum: 1, maximum: 114, description: 'Nomor surah' },
        ayat: { type: 'integer', minimum: 1, description: 'Nomor ayat (penomoran Saku Hati)' },
        potongan: { type: 'integer', minimum: 1, description: 'Nomor potongan waqaf, mulai 1 (lihat baca_makna)' },
        isi: { type: 'string', minLength: 1, maxLength: 4000, description: 'Isi baru yang diusulkan (lengkap, bukan potongan)' },
        catatan: { type: 'string', maxLength: 1000, description: 'Alasan singkat usulan, ditampilkan ke Firdaus' },
      },
      required: ['surah', 'ayat', 'potongan', 'isi'],
    },
    annotations: { title: 'Usulkan makna', readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  {
    name: 'usul_keterangan',
    description:
      'Mengusulkan keterangan pribadi untuk satu ayat (urutan_kata 0 atau kosong) atau untuk satu kata. Tidak mengubah data.',
    inputSchema: {
      type: 'object',
      properties: {
        surah: { type: 'integer', minimum: 1, maximum: 114, description: 'Nomor surah' },
        ayat: { type: 'integer', minimum: 1, description: 'Nomor ayat (penomoran Saku Hati)' },
        urutan_kata: { type: 'integer', minimum: 0, description: '0 atau kosong = keterangan ayat; 1.. = kata ke-n' },
        isi: { type: 'string', minLength: 1, maxLength: 4000, description: 'Isi baru yang diusulkan (lengkap, bukan potongan)' },
        catatan: { type: 'string', maxLength: 1000, description: 'Alasan singkat usulan, ditampilkan ke Firdaus' },
      },
      required: ['surah', 'ayat', 'isi'],
    },
    annotations: { title: 'Usulkan keterangan', readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  {
    name: 'usul_terjemah_hadits',
    description: 'Mengusulkan terjemah hadits versi sendiri (seluruh teks terjemah satu hadits). Tidak mengubah data.',
    inputSchema: {
      type: 'object',
      properties: {
        kitab: { type: 'string', description: 'Kode kitab, mis. bukhari, muslim, abudaud, tirmidzi' },
        nomor: { type: 'integer', minimum: 1, description: 'Nomor hadits di kitab itu' },
        isi: { type: 'string', minLength: 1, maxLength: 4000, description: 'Isi baru yang diusulkan (lengkap, bukan potongan)' },
        catatan: { type: 'string', maxLength: 1000, description: 'Alasan singkat usulan, ditampilkan ke Firdaus' },
      },
      required: ['kitab', 'nomor', 'isi'],
    },
    annotations: { title: 'Usulkan terjemah hadits', readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  {
    name: 'usul_catatan_hadits',
    description: 'Mengusulkan catatan kajian untuk satu hadits (menggantikan seluruh isi catatan). Tidak mengubah data.',
    inputSchema: {
      type: 'object',
      properties: {
        kitab: { type: 'string', description: 'Kode kitab, mis. bukhari, muslim, abudaud, tirmidzi' },
        nomor: { type: 'integer', minimum: 1, description: 'Nomor hadits di kitab itu' },
        isi: { type: 'string', minLength: 1, maxLength: 4000, description: 'Isi baru yang diusulkan (lengkap, bukan potongan)' },
        catatan: { type: 'string', maxLength: 1000, description: 'Alasan singkat usulan, ditampilkan ke Firdaus' },
      },
      required: ['kitab', 'nomor', 'isi'],
    },
    annotations: { title: 'Usulkan catatan hadits', readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
];

const PESAN_TERTUTUP =
  'Saku Hati di komputer sedang tertutup, jadi data belum bisa dibaca. Buka aplikasi Saku Hati di komputer lalu coba lagi.';

async function panggilSakuHati(nama, argumen) {
  let sambungan;
  try {
    sambungan = JSON.parse(fs.readFileSync(berkasSambungan(), 'utf8'));
  } catch {
    return { ok: false, pesan: PESAN_TERTUTUP };
  }
  try {
    const r = await fetch(`http://127.0.0.1:${sambungan.port}/alat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sambungan.token}` },
      body: JSON.stringify({ nama, argumen }),
      signal: AbortSignal.timeout(40_000),
    });
    return JSON.parse(await r.text());
  } catch {
    return { ok: false, pesan: PESAN_TERTUTUP };
  }
}

function kirim(pesan) {
  process.stdout.write(JSON.stringify(pesan) + '\n');
}

function jawab(id, result) {
  kirim({ jsonrpc: '2.0', id, result });
}

function galat(id, code, message) {
  kirim({ jsonrpc: '2.0', id, error: { code, message } });
}

async function tangani(p) {
  const { id, method, params } = p;
  const permintaan = id !== undefined && id !== null;
  switch (method) {
    case 'initialize': {
      const minta = params && params.protocolVersion;
      return jawab(id, {
        protocolVersion: VERSI_PROTOKOL.includes(minta) ? minta : VERSI_PROTOKOL[0],
        capabilities: { tools: {} },
        serverInfo: { name: 'saku-hati', title: 'Saku Hati', version: '0.2.0' },
        instructions: PETUNJUK,
      });
    }
    case 'ping':
      return jawab(id, {});
    case 'tools/list':
      return jawab(id, { tools: ALAT });
    case 'tools/call': {
      const nama = params && params.name;
      if (!ALAT.some((a) => a.name === nama)) return galat(id, -32602, `Alat tidak dikenal: ${nama}`);
      const h = await panggilSakuHati(nama, (params && params.arguments) || {});
      if (h && h.ok) {
        return jawab(id, { content: [{ type: 'text', text: JSON.stringify(h.hasil, null, 2) }] });
      }
      return jawab(id, { content: [{ type: 'text', text: (h && h.pesan) || PESAN_TERTUTUP }], isError: true });
    }
    case 'resources/list':
      return jawab(id, { resources: [] });
    case 'prompts/list':
      return jawab(id, { prompts: [] });
    default:
      // Pemberitahuan (tanpa id), mis. notifications/initialized, tidak dibalas.
      if (permintaan) galat(id, -32601, `Metode tidak didukung: ${method}`);
  }
}

const berjalan = new Set();
let masukanSelesai = false;

function selesaiBilaKosong() {
  if (masukanSelesai && berjalan.size === 0) process.exit(0);
}

const baris = readline.createInterface({ input: process.stdin });
baris.on('line', (teks) => {
  if (!teks.trim()) return;
  let p;
  try {
    p = JSON.parse(teks);
  } catch {
    return galat(null, -32700, 'JSON tidak sah.');
  }
  const kerja = tangani(p)
    .catch((e) => {
      console.error(e);
      if (p.id !== undefined) galat(p.id, -32603, String((e && e.message) || e));
    })
    .finally(() => {
      berjalan.delete(kerja);
      selesaiBilaKosong();
    });
  berjalan.add(kerja);
});
// Claude desktop menutup stdin saat berhenti; jawaban yang masih berjalan diselesaikan dulu.
baris.on('close', () => {
  masukanSelesai = true;
  selesaiBilaKosong();
});
