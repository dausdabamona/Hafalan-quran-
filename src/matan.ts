// K-81: menebak awal matan (isi hadits) agar sanad (rantai perawi) tidak tampil di awal.
// Data tidak memisahkan keduanya; pola hanya dipakai bila cukup yakin, selain itu teks tampil utuh.

export interface Pisah {
  sanad: string;
  matan: string;
}

const RANTAI_ID = /(?:telah\s+)?(?:menceritakan|mengabarkan|memberitakan|menuturkan|bercerita)\s+kepada/gi;
const NABI_ID =
  /\b(?:Nabi|Rasulullah|Rasul)(?:\s*shallallahu\s*'?\s*alaihi\s*wa\s*sallam|\s*shallallahu'alaihiwasallam)?[^"“:;]{0,50}?\b(?:bersabda|berkata|bertanya|menjawab|menjelaskan|mengatakan|menyebutkan|memerintahkan|melarang|berdoa|membaca|berkhutbah)\b/gi;
const DARI_ID = /\bdari\s+(?=[A-Z'‘])/g;
const VERBA_ID = /\b(?:berkata|bersabda|bertanya|mengatakan|menuturkan|menceritakan)\b/i;

function hasil(teks: string, i: number | null): Pisah | null {
  if (i === null || i <= 0 || i >= teks.length - 20) return null;
  const matan = teks.slice(i).trimStart();
  return { sanad: teks.slice(0, i).trimEnd(), matan: matan[0].toUpperCase() + matan.slice(1) };
}

export function pisahTerjemah(teks: string): Pisah | null {
  let ujung = -1;
  for (const m of teks.matchAll(RANTAI_ID)) ujung = m.index! + m[0].length;
  if (ujung < 0) return null;

  NABI_ID.lastIndex = ujung;
  const n = NABI_ID.exec(teks);
  if (n && n.index - ujung < 400) return hasil(teks, n.index);

  const kutip = teks.slice(ujung).search(/["“]/);
  const batas = kutip >= 0 ? ujung + kutip : Math.min(teks.length, ujung + 400);
  let awal = -1;
  DARI_ID.lastIndex = ujung;
  for (let m: RegExpExecArray | null; (m = DARI_ID.exec(teks)) && m.index < batas;) awal = m.index + m[0].length;
  if (awal < 0) return null;
  const b = /\bbahwa\s+/.exec(teks.slice(awal, batas));
  if (b && b.index < 150) return hasil(teks, awal + b.index + b[0].length);
  if (kutip >= 0 && batas - awal <= 120 && VERBA_ID.test(teks.slice(awal, batas))) return hasil(teks, awal);
  return null;
}

// ---------- Arab ----------

const HARAKAT = /[ً-ٰٟۖ-ۭـ]/;
const HURUF = '\\u0621-\\u064A';
const RANTAI_AR = new RegExp(`(?<![${HURUF}])(?:حدثنا|حدثني|أخبرنا|أخبرني|أنبأنا|حدثناه|ثنا)(?![${HURUF}])`, 'g');
const NABI_AR = /(?:رسول الله|النبي|رسول)\s*صلى الله عليه وسلم/g;
const QALA_AR = new RegExp(`(?<![${HURUF}])(?:قال|قالت|أن|أنه|أنها)(?![${HURUF}])`);
const AN_AR = new RegExp(`(?<![${HURUF}])عن\\s`, 'g');

export function pisahArab(arab: string): Pisah | null {
  // Pola dicari pada teks tanpa harakat, lalu posisinya dipetakan kembali ke teks asli.
  const asli: number[] = [];
  let polos = '';
  for (let i = 0; i < arab.length; i++) {
    if (HARAKAT.test(arab[i])) continue;
    asli.push(i);
    polos += arab[i];
  }
  let ujung = -1;
  for (const m of polos.matchAll(RANTAI_AR)) ujung = m.index! + m[0].length;
  if (ujung < 0) return null;
  const ke = (i: number) => hasilArab(arab, asli[i]);

  NABI_AR.lastIndex = ujung;
  const n = NABI_AR.exec(polos);
  if (n && n.index - ujung < 300) return ke(n.index);

  const sisa = polos.slice(ujung);
  const q = QALA_AR.exec(sisa);
  if (q) {
    let akhirAn = -1;
    AN_AR.lastIndex = 0;
    const depan = sisa.slice(0, q.index);
    for (const m of depan.matchAll(AN_AR)) akhirAn = m.index! + m[0].length;
    if (akhirAn >= 0 && q.index - akhirAn < 60) return ke(ujung + akhirAn);
  }
  return null;
}

function hasilArab(arab: string, i: number): Pisah | null {
  if (i <= 0 || i >= arab.length - 10) return null;
  return { sanad: arab.slice(0, i).trimEnd(), matan: arab.slice(i).trimStart() };
}

// Terjemah untuk cuplikan: matan bila dikenali, selain itu teks utuh.
export const matanAtauUtuh = (teks: string) => pisahTerjemah(teks)?.matan ?? teks;
