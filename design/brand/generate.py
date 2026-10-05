# /// script
# dependencies = ["fonttools", "brotli", "resvg-py"]
# ///
"""Generates the brand kit (design/brand/), the web favicons (apps/web/public/), and the logo on gallery link previews
(apps/web/server/assets/og/).

Run from anywhere: `uv run design/brand/generate.py`
"""
import json
import math
import struct
import urllib.request
from pathlib import Path

import resvg_py
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

YELLOW, INK, WHITE = "#FFD21F", "#151515", "#FFFFFF"
NAME = "FindPhotosOfMe"
KIT = Path(__file__).parent
PUBLIC = KIT.parents[1] / "apps/web/public"
SERVER_ASSETS = KIT.parents[1] / "apps/web/server/assets"
FONT_URL = "https://github.com/google/fonts/raw/main/ofl/archivo/Archivo%5Bwdth,wght%5D.ttf"


def aperture(size: float, fg: str, bg: str, gap: float, scale: float = 0.34) -> str:
    """Six-blade aperture centered in a size×size box; `bg` paints the gaps between blades."""
    c, R = size / 2, size * scale
    r, g = R * 0.39, size * gap
    hexagon = [(c + r * math.cos(math.radians(60 * i - 90)), c + r * math.sin(math.radians(60 * i - 90))) for i in range(6)]
    blades = []
    for i, (x1, y1) in enumerate(hexagon):
        x2, y2 = hexagon[(i + 1) % 6]
        n = math.hypot(x2 - x1, y2 - y1)
        blades.append(f'<line x1="{x1:.2f}" y1="{y1:.2f}" x2="{x1 + (x2 - x1) / n * size:.2f}" y2="{y1 + (y2 - y1) / n * size:.2f}"/>')
    points = " ".join(f"{x:.2f},{y:.2f}" for x, y in hexagon)
    return (
        f'<clipPath id="blades"><circle cx="{c}" cy="{c}" r="{R:.2f}"/></clipPath>'
        f'<circle cx="{c}" cy="{c}" r="{R:.2f}" fill="{fg}"/>'
        f'<g clip-path="url(#blades)" stroke="{bg}" stroke-width="{g:.2f}" stroke-linecap="round">{"".join(blades)}</g>'
        f'<polygon points="{points}" fill="{bg}" stroke="{bg}" stroke-width="{g:.2f}" stroke-linejoin="round"/>'
    )


def mark(size: float, fg: str, bg: str = "none", gap: float = 0.04, scale: float = 0.48) -> str:
    """The aperture alone. With no background the gaps are cut out, so it sits on any surface."""
    if bg != "none":
        return aperture(size, fg, bg, gap, scale)
    return f'<mask id="m"><rect width="{size}" height="{size}"/>{aperture(size, "#fff", "#000", gap, scale)}</mask>' \
           f'<rect width="{size}" height="{size}" fill="{fg}" mask="url(#m)"/>'


def tile(size: float, fg: str, bg: str, radius: float = 0.22, gap: float = 0.04, scale: float = 0.34) -> str:
    return f'<rect width="{size}" height="{size}" rx="{size * radius:.2f}" fill="{bg}"/>{aperture(size, fg, bg, gap, scale)}'


def svg(width: float, height: float, body: str) -> str:
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width:g} {height:g}">{body}</svg>\n'


def load_wordmark_font() -> TTFont:
    """Archivo at the site's heading cut: weight 900, width 118%."""
    cached = Path("/tmp/archivo-variable.ttf")
    if not cached.exists():
        urllib.request.urlretrieve(FONT_URL, cached)
    return instantiateVariableFont(TTFont(cached), {"wght": 900, "wdth": 118})


def wordmark(font: TTFont, height: float, fill: str) -> tuple[str, float, float]:
    """Outlined wordmark scaled so its ascender-to-baseline height equals `height`. Returns (svg, width, height)."""
    glyphs, cmap, hmtx = font.getGlyphSet(), font.getBestCmap(), font["hmtx"]
    tracking = -0.02 * font["head"].unitsPerEm
    names = [cmap[ord(ch)] for ch in NAME]
    bounds = BoundsPen(glyphs)
    x = 0.0
    for name in names:
        glyphs[name].draw(TransformPen(bounds, (1, 0, 0, 1, x, 0)))
        x += hmtx[name][0] + tracking
    x_min, _, x_max, y_max = bounds.bounds
    k = height / y_max
    pen = SVGPathPen(glyphs)
    x = 0.0
    for name in names:
        glyphs[name].draw(TransformPen(pen, (k, 0, 0, -k, (x - x_min) * k, height)))
        x += hmtx[name][0] + tracking
    return f'<path fill="{fill}" d="{pen.getCommands()}"/>', (x_max - x_min) * k, height


def lockup(font: TTFont, icon: str, text: str) -> str:
    """Icon left, wordmark right, both centered on one line. `icon` is the 100-unit symbol body."""
    text_svg, text_w, text_h = wordmark(font, 44, text)
    gap = 26
    body = f'{icon}<g transform="translate({100 + gap},{(100 - text_h) / 2:.2f})">{text_svg}</g>'
    return svg(100 + gap + text_w, 100, body)


def png(svg_text: str, height: int) -> bytes:
    """Renders at `height` pixels, keeping the SVG's aspect ratio."""
    return bytes(resvg_py.svg_to_bytes(svg_string=svg_text, height=height))


def ico(images: list[bytes]) -> bytes:
    """Multi-size .ico that embeds PNGs (supported by every browser that still asks for favicon.ico)."""
    header = struct.pack("<HHH", 0, 1, len(images))
    offset = 6 + 16 * len(images)
    entries, data = b"", b""
    for image in images:
        w, h = struct.unpack(">II", image[16:24])
        entries += struct.pack("<BBBBHHII", w % 256, h % 256, 0, 0, 1, 32, len(image), offset + len(data))
        data += image
    return header + entries + data


def write(path: Path, content: str | bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content.encode() if isinstance(content, str) else content)
    print(f"wrote {path.relative_to(KIT.parents[1])}")


def brand_kit(font: TTFont) -> None:
    def standalone_wordmark(color: str) -> str:
        body, w, h = wordmark(font, 100, color)
        return svg(w, h, body)

    square = {
        "mark-ink": svg(100, 100, mark(100, INK)),
        "mark-yellow": svg(100, 100, mark(100, YELLOW)),
        "mark-white": svg(100, 100, mark(100, WHITE)),
        "icon-yellow": svg(100, 100, tile(100, INK, YELLOW)),
        "icon-ink": svg(100, 100, tile(100, YELLOW, INK)),
    }
    wide = {
        "wordmark-ink": standalone_wordmark(INK),
        "wordmark-white": standalone_wordmark(WHITE),
        "lockup-ink": lockup(font, tile(100, INK, YELLOW), INK),
        "lockup-white": lockup(font, tile(100, INK, YELLOW), WHITE),
        "lockup-mono-ink": lockup(font, mark(100, INK), INK),
        "lockup-mono-white": lockup(font, mark(100, WHITE), WHITE),
    }
    for svgs, height in ((square, 1024), (wide, 256)):
        for name, text in svgs.items():
            write(KIT / "svg" / f"{name}.svg", text)
            write(KIT / "png" / f"{name}.png", png(text, height))
    write(SERVER_ASSETS / "og" / "lockup-white.svg", wide["lockup-white"])


def favicons() -> None:
    # Tab icons are 16–32px, so the aperture grows and its blade gaps thicken to stay readable.
    small = svg(64, 64, tile(64, INK, YELLOW, gap=0.06, scale=0.38))
    write(PUBLIC / "icon.svg", small)
    write(PUBLIC / "favicon.ico", ico([png(small, size) for size in (16, 32, 48)]))
    # iOS and Android launchers apply their own corner masks, so these are full-bleed squares.
    write(PUBLIC / "apple-touch-icon.png", png(svg(180, 180, tile(180, INK, YELLOW, radius=0)), 180))
    write(PUBLIC / "icon-maskable-512.png", png(svg(512, 512, tile(512, INK, YELLOW, radius=0, scale=0.28)), 512))
    write(PUBLIC / "icon-192.png", png(svg(192, 192, tile(192, INK, YELLOW)), 192))
    write(PUBLIC / "icon-512.png", png(svg(512, 512, tile(512, INK, YELLOW)), 512))
    manifest = {
        "name": NAME,
        "short_name": NAME,
        "start_url": "/",
        "theme_color": YELLOW,
        "background_color": WHITE,
        "icons": [
            {"src": "/icon-192.png", "type": "image/png", "sizes": "192x192"},
            {"src": "/icon-512.png", "type": "image/png", "sizes": "512x512"},
            {"src": "/icon-maskable-512.png", "type": "image/png", "sizes": "512x512", "purpose": "maskable"},
        ],
    }
    write(PUBLIC / "manifest.webmanifest", json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    brand_kit(load_wordmark_font())
    favicons()
