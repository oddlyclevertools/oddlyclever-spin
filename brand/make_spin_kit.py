"""OddlyClever Spin icon kit (the Swatch fan). Writes everything into kit/.

    python make_spin_kit.py

The fan is drawn straight from its geometry (capsules round a pivot) with analytic
anti-aliasing, so every size is sharp without an SVG renderer. Units are the same
100x100 box as make_brand.py's spin_a().
"""
import json
import math
from pathlib import Path

import numpy as np
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).parent
KIT = HERE / "kit"

NAVY = "#001233"
RIVET = "#FFD166"
RAMP = ["#4CC9F0", "#4895EF", "#4361EE", "#7209B7", "#F72585"]
INK_LIGHT, INK_DARK = "#1d1426", "#f6eefc"

# Full fan (32 px and up): 5 pills 16 wide, a soft shadow under each.
FULL = dict(pivot=(29, 75), length=50, width=16, angles=[0, 20, 40, 60, 80], colours=RAMP,
            shadow=0.3, rivet=5.5)
# Small fan (20-24 px): 4 fatter pills and no shadows, so each pill keeps ~3 px.
SMALL = dict(pivot=(28, 76), length=48, width=19, angles=[0, 27, 53, 80],
             colours=["#4CC9F0", "#4361EE", "#7209B7", "#F72585"], shadow=0, rivet=6.5)
# Tiny fan (16 px): 3 pills; at 16 px five would blur into one blob.
TINY = dict(pivot=(27, 77), length=46, width=24, angles=[0, 40, 80],
            colours=["#4CC9F0", "#4361EE", "#F72585"], shadow=0, rivet=7.5)


def fan_for(px):
    fan = TINY if px <= 16 else SMALL if px <= 24 else FULL
    if px > 48:
        return fan
    # Snap the upright blade to whole pixels so its long edges stay crisp at small sizes.
    unit = 100 / px
    w = max(1, round(fan["width"] / unit)) * unit
    left = round((fan["pivot"][0] - fan["width"] / 2) / unit) * unit
    return {**fan, "width": w, "pivot": (left + w / 2, fan["pivot"][1])}


def rgb(hex_):
    return np.array([int(hex_[i:i + 2], 16) / 255 for i in (1, 3, 5)])


# ---------------------------------------------------------------- analytic shapes
def grid(px, scale=1.0):
    """Pixel centres in 100-unit art space; `scale` shrinks the art about the centre."""
    c = (np.arange(px) + 0.5) / px * 100
    x, y = np.meshgrid(c, c)
    return 50 + (x - 50) / scale, 50 + (y - 50) / scale, 100 / (px * scale)


def cover(d, unit):
    """Signed distance (art units) -> pixel coverage, a one-pixel ramp at the edge."""
    return np.clip(0.5 - d / unit, 0, 1)


def capsule_d(x, y, pivot, length, width, angle):
    a = math.radians(angle)  # clockwise from straight up, like SVG rotate()
    dx, dy = x - pivot[0], y - pivot[1]
    lx = dx * math.cos(a) + dy * math.sin(a)       # rotate the point back by -angle
    ly = -dx * math.sin(a) + dy * math.cos(a)
    t = np.clip(-ly, 0, length)                      # segment from pivot up `length` units
    return np.hypot(lx, -ly - t) - width / 2


def roundrect_d(x, y, r):
    qx = np.abs(x - 50) - (50 - r)
    qy = np.abs(y - 50) - (50 - r)
    return np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0) - r


def over(dst, colour, alpha):
    """Paint a straight colour with coverage `alpha` over a premultiplied RGBA float image."""
    a = alpha[..., None]
    dst[..., :3] = rgb(colour) * a + dst[..., :3] * (1 - a)
    dst[..., 3:] = a + dst[..., 3:] * (1 - a)


def render(px, *, bg="square", scale=1.0, fan=None, mono=None):
    """bg: 'square' (full bleed), 'round' (circle), 'rounded' (rounded square), None (transparent).
    mono: draw every shape in this one colour (Android themed / iOS tinted layers)."""
    fan = fan or fan_for(px)
    x, y, unit = grid(px, scale)
    img = np.zeros((px, px, 4))
    if bg:
        # the background is never scaled: it is the icon's own edge
        bx, by, bunit = grid(px)
        d = {"square": np.full_like(bx, -1.0), "round": np.hypot(bx - 50, by - 50) - 50,
             "rounded": roundrect_d(bx, by, 22.5)}[bg]
        over(img, NAVY, cover(d, bunit))
    for ang, col in zip(fan["angles"], fan["colours"]):
        if fan["shadow"] and not mono:
            over(img, "#000000", fan["shadow"] * cover(capsule_d(x, y, fan["pivot"], fan["length"], fan["width"], ang + 4), unit))
        over(img, mono or col, cover(capsule_d(x, y, fan["pivot"], fan["length"], fan["width"], ang), unit))
        if mono:  # a thin gap between pills so the single-colour fan still shows its blades
            gap = cover(np.abs(capsule_d(x, y, fan["pivot"], fan["length"], fan["width"], ang)) - 0.9, unit)
            img[..., 3] *= 1 - gap * (ang != fan["angles"][0])
            img[..., :3] *= (1 - gap * (ang != fan["angles"][0]))[..., None]
    rivet = cover(np.hypot(x - fan["pivot"][0], y - fan["pivot"][1]) - fan["rivet"], unit)
    if mono:  # punch the rivet out so it still reads in one colour
        img[..., 3] *= 1 - rivet
        img[..., :3] *= (1 - rivet)[..., None]
    else:
        over(img, RIVET, rivet)
    a = img[..., 3:]
    out = np.where(a > 0, img[..., :3] / np.maximum(a, 1e-6), 0)
    return Image.fromarray(np.dstack([out, a]).__mul__(255).round().astype(np.uint8), "RGBA")


# ---------------------------------------------------------------- SVG versions
def svg_fan(fan=FULL, mono=None):
    px, py = fan["pivot"]
    w, ln = fan["width"], fan["length"]
    parts = []
    for ang, col in zip(fan["angles"], fan["colours"]):
        rect = f'x="{px - w / 2:g}" y="{py - ln - w / 2:g}" width="{w:g}" height="{ln + w:g}" rx="{w / 2:g}"'
        if fan["shadow"] and not mono:
            parts.append(f'<rect {rect} fill="#000" opacity="{fan["shadow"]}" transform="rotate({ang + 4} {px} {py})"/>')
        parts.append(f'<rect {rect} fill="{mono or col}" transform="rotate({ang} {px} {py})"/>')
    parts.append(f'<circle cx="{px}" cy="{py}" r="{fan["rivet"]}" fill="{"#000" if mono else RIVET}"/>')
    return "".join(parts)


def svg_doc(body, view="0 0 100 100"):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view}">{body}</svg>\n'


def write_svgs(out):
    out.mkdir(parents=True, exist_ok=True)
    fan = svg_fan()
    (out / "icon-square.svg").write_text(svg_doc(f'<rect width="100" height="100" fill="{NAVY}"/>{fan}'), encoding="utf8")
    (out / "icon-rounded.svg").write_text(svg_doc(f'<rect width="100" height="100" rx="22.5" fill="{NAVY}"/>{fan}'), encoding="utf8")
    (out / "mark.svg").write_text(svg_doc(fan), encoding="utf8")
    # Favicon: the small fan, so a browser tab gets the version drawn for 16-24 px.
    (out / "favicon.svg").write_text(svg_doc(f'<rect width="100" height="100" rx="22.5" fill="{NAVY}"/>{svg_fan(SMALL)}'), encoding="utf8")


# ---------------------------------------------------------------- outlined wordmark
FONTS = HERE / "fonts"


def text_path(font_file, text, size, x, baseline, track=0.0):
    """The text as one SVG path (outlines, so no font is needed). Returns (d, advance)."""
    font = TTFont(font_file)
    gs, cmap, hmtx = font.getGlyphSet(), font.getBestCmap(), font["hmtx"]
    k = size / font["head"].unitsPerEm
    pen = SVGPathPen(gs)
    for ch in text:
        g = cmap[ord(ch)]
        gs[g].draw(TransformPen(pen, (k, 0, 0, -k, x, baseline)))
        x += hmtx[g][0] * k + track
    return pen.getCommands(), x


def write_wordmarks(out):
    """Stacked lockup: icon, then a small "OddlyClever" over a big "Spin"."""
    for theme, ink in (("light", INK_LIGHT), ("dark", INK_DARK)):
        kicker, kx = text_path(FONTS / "Rubik-Medium.ttf", "OddlyClever", 24, 128, 40, 0.4)
        word, wx = text_path(FONTS / "Fredoka-Bold.ttf", "Spin", 78, 124, 104, -1)
        width = math.ceil(max(kx, wx)) + 8
        icon = f'<svg x="0" y="4" width="108" height="108" viewBox="0 0 100 100"><rect width="100" height="100" rx="22.5" fill="{NAVY}"/>{svg_fan()}</svg>'
        body = f'{icon}<path d="{kicker}" fill="{ink}" opacity=".85"/><path d="{word}" fill="{ink}"/>'
        (out / f"wordmark-{theme}.svg").write_text(svg_doc(body, f"0 0 {width} 116"), encoding="utf8")
        # one-line version for narrow bars (window title, store header)
        kicker, kx = text_path(FONTS / "Rubik-Medium.ttf", "OddlyClever", 40, 76, 47, 0.2)
        word, wx = text_path(FONTS / "Fredoka-Bold.ttf", "Spin", 48, kx + 10, 47, -0.5)
        icon = f'<svg x="0" y="2" width="60" height="60" viewBox="0 0 100 100"><rect width="100" height="100" rx="22.5" fill="{NAVY}"/>{svg_fan()}</svg>'
        body = f'{icon}<path d="{kicker}" fill="{ink}" opacity=".85"/><path d="{word}" fill="{ink}"/>'
        (out / f"wordmark-inline-{theme}.svg").write_text(svg_doc(body, f"0 0 {math.ceil(wx) + 6} 64"), encoding="utf8")


# ---------------------------------------------------------------- platform sets
ANDROID_DENSITIES = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
# The 100-unit art is the 72dp visible area of a 108dp adaptive layer. The fan reaches 31dp from
# the centre, inside the 33dp safe circle.
ADAPTIVE_SCALE = 72 / 108


def save(img, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path)


def android(out):
    res = out / "res"
    for name, k in ANDROID_DENSITIES.items():
        d = res / f"mipmap-{name}"
        save(render(round(48 * k), bg="rounded"), d / "ic_launcher.png")          # legacy, pre-Android 8
        save(render(round(48 * k), bg="round"), d / "ic_launcher_round.png")
        layer = round(108 * k)
        save(render(layer, bg=None, scale=ADAPTIVE_SCALE, fan=FULL), d / "ic_launcher_foreground.png")
        save(render(layer, bg=None, scale=ADAPTIVE_SCALE, fan=FULL, mono="#ffffff"), d / "ic_launcher_monochrome.png")
    anydpi = res / "mipmap-anydpi-v26"
    anydpi.mkdir(parents=True, exist_ok=True)
    xml = ('<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
           '    <background android:drawable="@color/ic_launcher_background"/>\n'
           '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n'
           '    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>\n</adaptive-icon>\n')
    (anydpi / "ic_launcher.xml").write_text(xml, encoding="utf8")
    (anydpi / "ic_launcher_round.xml").write_text(xml, encoding="utf8")
    (res / "values").mkdir(exist_ok=True)
    (res / "values" / "ic_launcher_background.xml").write_text(
        f'<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">{NAVY}</color>\n</resources>\n', encoding="utf8")
    save(render(512, bg="square"), out / "play-store-512.png")  # Play masks the corners itself


ICO_SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256]


def windows(out):
    out.mkdir(parents=True, exist_ok=True)
    frames = [render(s, bg="rounded") for s in ICO_SIZES]
    for s, f in zip(ICO_SIZES, frames):
        save(f, out / "png" / f"app-{s}.png")
    write_ico(out / "app.ico", frames)


def write_ico(path, frames):
    """Each size is drawn on its own (16 px gets the tiny fan), so build the ICO by hand
    rather than letting Pillow downscale one image."""
    import io
    blobs = []
    for f in frames:
        b = io.BytesIO()
        f.save(b, "PNG")
        blobs.append(b.getvalue())
    head = bytearray(b"\0\0\1\0" + len(frames).to_bytes(2, "little"))
    offset = 6 + 16 * len(frames)
    for f, blob in zip(frames, blobs):
        w = f.width if f.width < 256 else 0
        head += bytes([w, w, 0, 0]) + (1).to_bytes(2, "little") + (32).to_bytes(2, "little")
        head += len(blob).to_bytes(4, "little") + offset.to_bytes(4, "little")
        offset += len(blob)
    path.write_bytes(bytes(head) + b"".join(blobs))


def ios(out):
    s = out / "AppIcon.appiconset"
    s.mkdir(parents=True, exist_ok=True)
    save(render(1024, bg="square").convert("RGB"), s / "AppIcon-1024.png")        # no alpha allowed
    save(render(1024, bg=None, scale=0.82), s / "AppIcon-1024-dark.png")          # iOS 18 dark: art on clear
    save(render(1024, bg=None, scale=0.82, mono="#ffffff").convert("LA"), s / "AppIcon-1024-tinted.png")
    images = [
        {"filename": "AppIcon-1024.png", "idiom": "universal", "platform": "ios", "size": "1024x1024"},
        {"appearances": [{"appearance": "luminosity", "value": "dark"}], "filename": "AppIcon-1024-dark.png",
         "idiom": "universal", "platform": "ios", "size": "1024x1024"},
        {"appearances": [{"appearance": "luminosity", "value": "tinted"}], "filename": "AppIcon-1024-tinted.png",
         "idiom": "universal", "platform": "ios", "size": "1024x1024"},
    ]
    (s / "Contents.json").write_text(json.dumps({"images": images, "info": {"author": "xcode", "version": 1}}, indent=2), encoding="utf8")


def web(out):
    out.mkdir(parents=True, exist_ok=True)
    write_ico(out / "favicon.ico", [render(s, bg="rounded") for s in (16, 24, 32, 48)])
    save(render(180, bg="square"), out / "apple-touch-icon.png")
    save(render(192, bg="rounded"), out / "icon-192.png")
    save(render(512, bg="rounded"), out / "icon-512.png")
    save(render(512, bg="square", scale=0.9), out / "icon-maskable-512.png")  # maskable safe zone = 80% circle


# ---------------------------------------------------------------- review sheet
def sheet(path):
    W, H = 1600, 1300
    img = Image.new("RGB", (W, H), "#f4efe8")
    dr = ImageDraw.Draw(img)
    try:
        f_h, f_s = ImageFont.truetype(str(FONTS / "Fredoka-Bold.ttf"), 34), ImageFont.truetype("segoeui.ttf", 18)
    except OSError:
        f_h = f_s = ImageFont.load_default()
    dr.text((40, 28), "OddlyClever Spin · icon kit", font=f_h, fill=INK_LIGHT)
    dr.rectangle((800, 0, W, H), fill="#14101a")

    def row(y, label, items, dark):
        x = 840 if dark else 40
        dr.text((x, y), label, font=f_s, fill="#bbb" if dark else "#666")
        x0 = x
        for im in items:
            img.paste(im, (x0, y + 30), im)
            x0 += im.width + 24

    for dark in (False, True):
        row(90, "App icon 256 / 128 / 64", [render(s, bg="rounded") for s in (256, 128, 64)], dark)
        row(420, "Windows 48 / 40 / 32 / 24 / 20 / 16 (each drawn for its size)", [render(s, bg="rounded") for s in (48, 40, 32, 24, 20, 16)], dark)
        mask = [render(144, bg="round"), render(144, bg="rounded"),
                Image.composite(render(144, bg="square"), Image.new("RGBA", (144, 144)), squircle(144))]
        row(530, "Android: circle, rounded, squircle masks", mask, dark)
        themed = render(144, bg=None, mono="#e8def8")
        bgc = Image.new("RGBA", (144, 144), "#3b3150")
        bgc.alpha_composite(themed)
        row(730, "Android 13 themed (monochrome layer)", [Image.composite(bgc, Image.new("RGBA", (144, 144)), circle(144))], dark)
        ios_l = Image.composite(render(144, bg="square"), Image.new("RGBA", (144, 144)), squircle(144, 0.225))
        ios_d = Image.new("RGBA", (144, 144), "#1c1c1e")
        ios_d.alpha_composite(render(144, bg=None, scale=0.82))
        ios_d = Image.composite(ios_d, Image.new("RGBA", (144, 144)), squircle(144, 0.225))
        row(930, "iOS: default, dark", [ios_l, ios_d], dark)
        wm = Image.open(KIT / "png-preview" / f"wordmark-{'dark' if dark else 'light'}.png")
        row(1110, "", [wm], dark)
    img.save(path)


def circle(px):
    m = Image.new("L", (px * 4, px * 4))
    ImageDraw.Draw(m).ellipse((0, 0, px * 4 - 1, px * 4 - 1), fill=255)
    return m.resize((px, px), Image.LANCZOS)


def squircle(px, r=0.32):
    m = Image.new("L", (px * 4, px * 4))
    ImageDraw.Draw(m).rounded_rectangle((0, 0, px * 4 - 1, px * 4 - 1), radius=int(px * 4 * r), fill=255)
    return m.resize((px, px), Image.LANCZOS)


def wordmark_preview(out):
    """PNG previews of the lockup for the sheet (Pillow text, same fonts as the outlined SVG)."""
    out.mkdir(parents=True, exist_ok=True)
    k = ImageFont.truetype(str(FONTS / "Rubik-Medium.ttf"), 24)
    w = ImageFont.truetype(str(FONTS / "Fredoka-Bold.ttf"), 78)
    for theme, ink in (("light", INK_LIGHT), ("dark", INK_DARK)):
        im = Image.new("RGBA", (420, 116))
        im.alpha_composite(render(108, bg="rounded"), (0, 4))
        d = ImageDraw.Draw(im)
        d.text((128, 40), "OddlyClever", font=k, fill=ink, anchor="ls")
        d.text((124, 104), "Spin", font=w, fill=ink, anchor="ls")
        im.save(out / f"wordmark-{theme}.png")


def check():
    """Self-check: shapes land where the design says, and the adaptive art stays in the safe zone."""
    big = np.asarray(render(200, bg="square"))
    assert tuple(big[150, 58, :3]) == (255, 209, 102), "rivet should be gold at the pivot"
    assert tuple(big[4, 4, :3]) == (0, 18, 51), "corner should be navy"
    fg = np.asarray(render(432, bg=None, scale=ADAPTIVE_SCALE, fan=FULL))[..., 3]
    ys, xs = np.nonzero(fg > 8)
    r = np.hypot(xs + 0.5 - 216, ys + 0.5 - 216).max() / 4  # dp
    assert r <= 33, f"adaptive art reaches {r:.1f}dp, past the 33dp safe circle"
    for px in (16, 24):
        a = np.asarray(render(px, bg=None))[..., 3]
        assert (a > 128).sum() > px * px * 0.2, f"{px}px fan too thin"
    return r


def main():
    r = check()
    write_svgs(KIT / "svg")
    write_wordmarks(KIT / "svg")
    android(KIT / "android")
    windows(KIT / "windows")
    ios(KIT / "ios")
    web(KIT / "web")
    wordmark_preview(KIT / "png-preview")
    sheet(KIT / "sheet.png")
    print(f"kit written to {KIT} (adaptive art reaches {r:.1f}dp of 33dp)")


if __name__ == "__main__":
    main()
