// Gulir otomatis ke bagian yang sedang aktif (ayat yang direkam, diputar, dll.)
// agar tidak perlu menggulir manual. Posisi tengah dipakai supaya tidak tertutup
// kepala layar (atas) maupun bilah tombol (bawah).
export function gulirKe(el: Element | null | undefined, posisi: ScrollLogicalPosition = 'center') {
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: posisi });
}

// Gulir di dalam wadah yang punya batang gulir sendiri, tanpa menggeser halaman.
export function gulirDalam(wadah: HTMLElement | null, item: HTMLElement | null) {
  if (!wadah || !item) return;
  const tujuan = item.offsetTop - wadah.clientHeight / 2 + item.clientHeight / 2;
  wadah.scrollTo({ top: Math.max(0, tujuan), behavior: 'smooth' });
}
