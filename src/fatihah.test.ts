import { describe, expect, it } from 'vitest';
import { petaAyatFatihah, petaKataFatihah, petaRentangFatihah } from './fatihah';

describe('pindah data Al-Fatihah ke hitungan Madinah', () => {
  it('kata', () => {
    expect(petaKataFatihah(1, 2)).toBeNull();
    expect(petaKataFatihah(2, 1)).toEqual({ ayat: 1, urutan: 1 });
    expect(petaKataFatihah(6, 3)).toEqual({ ayat: 5, urutan: 3 });
    expect(petaKataFatihah(7, 4)).toEqual({ ayat: 6, urutan: 4 });
    expect(petaKataFatihah(7, 5)).toEqual({ ayat: 7, urutan: 1 });
    expect(petaKataFatihah(7, 9)).toEqual({ ayat: 7, urutan: 5 });
  });
  it('ayat dan rentang', () => {
    expect(petaAyatFatihah(1)).toBeNull();
    expect(petaAyatFatihah(4)).toBe(3);
    expect(petaAyatFatihah(7)).toBe(6);
    expect(petaRentangFatihah(1, 1)).toBeNull();
    expect(petaRentangFatihah(1, 3)).toEqual({ awal: 1, akhir: 2 });
    expect(petaRentangFatihah(4, 6)).toEqual({ awal: 3, akhir: 5 });
    expect(petaRentangFatihah(7, 7)).toEqual({ awal: 6, akhir: 7 });
  });
});
