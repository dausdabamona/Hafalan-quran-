import { describe, expect, it } from 'vitest';
import { pisahArab, pisahTerjemah } from './matan';

describe('pisah sanad dan matan (K-81)', () => {
  it('sabda Nabi', () => {
    const p = pisahTerjemah(
      'Telah menceritakan kepada kami Al Humaidi dari Umar bin Al Khaththab diatas mimbar berkata; saya mendengar Rasulullah shallallahu \'alaihi wasallam bersabda: "Semua perbuatan tergantung niatnya"',
    );
    expect(p?.matan.startsWith("Rasulullah shallallahu 'alaihi wasallam bersabda")).toBe(true);
    expect(p?.sanad.startsWith('Telah menceritakan')).toBe(true);
  });
  it('perkataan sahabat dan "bahwa"', () => {
    expect(
      pisahTerjemah(
        'Telah menceritakan kepada kami Ahmad telah menceritakan kepada kami Zuhair dari Jabir ia berkata, "Dahulu kami pernah berperang bersama Rasulullah."',
      )?.matan,
    ).toMatch(/^Jabir ia berkata, "Dahulu/);
    expect(
      pisahTerjemah(
        "Telah menceritakan kepada kami Abu Bakar dari Anas bahwa Nabi shallallahu 'alaihi wasallam pernah mengenakan pakaian dari wol bersama keluarganya.",
      )?.matan,
    ).toMatch(/^Nabi shallallahu 'alaihi wasallam pernah/);
  });
  it('tanpa pola yang yakin → utuh', () => {
    expect(pisahTerjemah('Abu Isa berkata; hadits ini hasan.')).toBeNull();
  });
  it('Arab: mulai dari sabda Nabi, harakat tetap utuh', () => {
    const p = pisahArab(
      'حَدَّثَنَا قُتَيْبَةُ عَنْ أَبِي هُرَيْرَةَ قَالَ قَالَ رَسُولُ اللَّهِ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ',
    );
    expect(p?.matan.startsWith('رَسُولُ اللَّهِ صَلَّى')).toBe(true);
    expect(p?.sanad.startsWith('حَدَّثَنَا')).toBe(true);
  });
  it('Arab: perkataan sahabat', () => {
    const p = pisahArab(
      'حَدَّثَنَا مُسَدَّدٌ حَدَّثَنَا يَحْيَى عَنْ جَابِرٍ قَالَ كُنَّا نَغْزُو مَعَ أَصْحَابِنَا فِي الْبِلَادِ',
    );
    expect(p?.matan.startsWith('جَابِرٍ قَالَ')).toBe(true);
  });
});
