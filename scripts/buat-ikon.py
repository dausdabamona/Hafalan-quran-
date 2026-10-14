"""Membuat semua PNG ikon Android dari aset/ikon.svg dan aset/ikon-depan.svg.

Jalankan: python3 scripts/buat-ikon.py  (butuh Playwright + Chromium)
"""
import pathlib
from playwright.sync_api import sync_playwright

AKAR = pathlib.Path(__file__).resolve().parent.parent
RES = AKAR / 'android/app/src/main/res'
KEPADATAN = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}

def render(hal, svg: str, ukuran: int, keluar: pathlib.Path, bulat=False):
    gaya = 'border-radius:50%;overflow:hidden;' if bulat else ''
    hal.set_viewport_size({'width': ukuran, 'height': ukuran})
    hal.set_content(
        f'<html><body style="margin:0;background:transparent">'
        f'<div style="width:{ukuran}px;height:{ukuran}px;{gaya}">'
        f'{svg.replace("<svg ", f"<svg width=\"{ukuran}\" height=\"{ukuran}\" ", 1)}</div></body></html>'
    )
    keluar.parent.mkdir(parents=True, exist_ok=True)
    hal.screenshot(path=str(keluar), omit_background=True)

with sync_playwright() as p:
    b = p.chromium.launch()
    hal = b.new_page()
    penuh = (AKAR / 'aset/ikon.svg').read_text()
    depan = (AKAR / 'aset/ikon-depan.svg').read_text()
    for nama, k in KEPADATAN.items():
        d = RES / f'mipmap-{nama}'
        render(hal, penuh, round(48 * k), d / 'ic_launcher.png')
        render(hal, penuh, round(48 * k), d / 'ic_launcher_round.png', bulat=True)
        render(hal, depan, round(108 * k), d / 'ic_launcher_foreground.png')
    render(hal, penuh, 512, AKAR / 'aset/ikon-512.png')
    b.close()
print('Ikon selesai dibuat.')
