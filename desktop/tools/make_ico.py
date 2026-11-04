"""Draw the record logo from web/index.html (.brand .disc) into desktop/assets: OddlyCleverMusic.ico + logo-256.png.
Run from music-tool/: .venv/Scripts/python desktop/tools/make_ico.py   (needs Pillow)"""
from pathlib import Path

from PIL import Image, ImageDraw

S = 1024 / 40  # the logo's viewBox is 40x40; draw big, then shrink for smooth edges
img = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
d = ImageDraw.Draw(img)


def circle(r, fill=None, outline=None, width=0):
    d.ellipse([(20 - r) * S, (20 - r) * S, (20 + r) * S, (20 + r) * S], fill=fill, outline=outline, width=round(width * S))


circle(19, fill="#120b1a")
circle(14, outline="#3a2650", width=1)
circle(10, outline="#3a2650", width=1)
circle(7, fill="#ff6b3d")
for x in (17.5, 22.5):  # eyes
    d.ellipse([(x - 1.2) * S, 17.8 * S, (x + 1.2) * S, 20.2 * S], fill="#120b1a")
d.arc([17 * S, 20.2 * S, 23 * S, 24.2 * S], 30, 150, fill="#120b1a", width=round(1.1 * S))  # smile

out = Path(__file__).resolve().parent.parent / "assets"
out.mkdir(exist_ok=True)
img.resize((256, 256), Image.LANCZOS).save(out / "logo-256.png")
img.save(out / "OddlyCleverMusic.ico", sizes=[(s, s) for s in (16, 20, 24, 32, 40, 48, 64, 96, 128, 256)])
print("wrote", out / "OddlyCleverMusic.ico")
