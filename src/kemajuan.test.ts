import { describe, expect, it } from 'vitest';
import { rentetanHari } from './kemajuan';

describe('rentetan hari (K-48)', () => {
  it('menghitung hari berturut sampai hari ini', () => {
    expect(rentetanHari(['2026-10-19', '2026-10-20', '2026-10-21'], '2026-10-21')).toBe(3);
  });
  it('belum latihan hari ini: dihitung sampai kemarin', () => {
    expect(rentetanHari(['2026-10-19', '2026-10-20'], '2026-10-21')).toBe(2);
  });
  it('putus bila ada hari kosong', () => {
    expect(rentetanHari(['2026-10-17', '2026-10-19', '2026-10-21'], '2026-10-21')).toBe(1);
    expect(rentetanHari(['2026-10-18'], '2026-10-21')).toBe(0);
  });
  it('melewati batas bulan', () => {
    expect(rentetanHari(['2026-09-30', '2026-10-01'], '2026-10-01')).toBe(2);
  });
});
