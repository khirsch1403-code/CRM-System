#!/usr/bin/env python3
"""
Erzeugt kundenunterlagen.ico und backups.ico fuer Windows-Ordner-Icons.
Reine stdlib — keine Pillow/ImageMagick/Cairo noetig.

Ausgabe: app-icon/{kundenunterlagen,backups}.ico und
         app-icon/{kundenunterlagen,backups}-preview.png (256x256).

Wird bei 4x Supersampling auf 1024x1024 gerendert und dann per
Box-Filter auf 256/128/64/48/32/16 downgesampled.
"""

import os
import zlib
import struct
import binascii
import math

HERE       = os.path.dirname(os.path.abspath(__file__))
APP_ICON   = os.path.normpath(os.path.join(HERE, "..", "app-icon"))
SUPER      = 4        # Supersampling factor
BASE       = 256      # Final target size
SS_W       = BASE * SUPER

ICO_SIZES  = [16, 32, 48, 64, 128, 256]

# ---------------------------------------------------------------
# CANVAS mit Alpha
# ---------------------------------------------------------------
class Canvas:
    def __init__(self, w, h):
        self.w = w
        self.h = h
        self.px = bytearray(w * h * 4)

    def _blend(self, i, r, g, b, a):
        # Source-over auf existierendem RGBA
        da = self.px[i+3]
        if da == 0 or a == 255:
            self.px[i]   = r
            self.px[i+1] = g
            self.px[i+2] = b
            self.px[i+3] = max(da, a) if a < 255 else 255
            return
        inv = 255 - a
        self.px[i]   = (self.px[i]   * inv + r * a) // 255
        self.px[i+1] = (self.px[i+1] * inv + g * a) // 255
        self.px[i+2] = (self.px[i+2] * inv + b * a) // 255
        self.px[i+3] = da + (255 - da) * a // 255

    def fill_rect_opaque(self, x, y, w, h, r, g, b):
        # Schneller Pfad ohne Alpha-Blend
        x0 = max(0, int(x)); x1 = min(self.w, int(x + w))
        y0 = max(0, int(y)); y1 = min(self.h, int(y + h))
        if x1 <= x0 or y1 <= y0:
            return
        row = bytes([r, g, b, 255]) * (x1 - x0)
        rowlen = len(row)
        for yy in range(y0, y1):
            i = (yy * self.w + x0) * 4
            self.px[i:i+rowlen] = row

    def fill_rounded_rect(self, x, y, w, h, radius, color_fn):
        """color_fn(u, v) -> (r,g,b,a). u,v sind lokale Koords relativ zur Box."""
        r = radius
        x0 = max(0, int(x)); x1 = min(self.w, int(x + w))
        y0 = max(0, int(y)); y1 = min(self.h, int(y + h))
        for yy in range(y0, y1):
            for xx in range(x0, x1):
                # Distanz zur naechsten runden Ecke, wenn wir in einer Ecke sind
                dx = 0.0
                dy = 0.0
                if xx < x + r:
                    dx = (x + r) - (xx + 0.5)
                elif xx > x + w - r:
                    dx = (xx + 0.5) - (x + w - r)
                if yy < y + r:
                    dy = (y + r) - (yy + 0.5)
                elif yy > y + h - r:
                    dy = (yy + 0.5) - (y + h - r)
                if dx <= 0 and dy <= 0:
                    coverage = 1.0
                else:
                    d = math.sqrt(dx*dx + dy*dy)
                    if d >= r:
                        continue
                    coverage = 1.0  # 4x supersampling glaettet ohnehin
                col = color_fn(xx - x, yy - y)
                if col is None:
                    continue
                cr, cg, cb, ca = col
                if coverage < 1.0:
                    ca = int(ca * coverage)
                i = (yy * self.w + xx) * 4
                self._blend(i, cr, cg, cb, ca)

    def fill_polygon(self, pts, color):
        """Scanline-fill fuer ein einfaches Polygon."""
        if len(pts) < 3:
            return
        cr, cg, cb, ca = color
        ymin = max(0, int(min(p[1] for p in pts)))
        ymax = min(self.h - 1, int(max(p[1] for p in pts)))
        for yy in range(ymin, ymax + 1):
            xs = []
            n = len(pts)
            for i in range(n):
                x1, y1 = pts[i]
                x2, y2 = pts[(i+1) % n]
                if (y1 <= yy < y2) or (y2 <= yy < y1):
                    t = (yy - y1) / (y2 - y1)
                    xs.append(x1 + t * (x2 - x1))
            xs.sort()
            for j in range(0, len(xs) - 1, 2):
                x0 = max(0, int(xs[j]))
                x1 = min(self.w, int(xs[j+1]) + 1)
                for xx in range(x0, x1):
                    i = (yy * self.w + xx) * 4
                    self._blend(i, cr, cg, cb, ca)

    def fill_circle(self, cx, cy, r, color):
        cr, cg, cb, ca = color
        x0 = max(0, int(cx - r - 1)); x1 = min(self.w, int(cx + r + 1))
        y0 = max(0, int(cy - r - 1)); y1 = min(self.h, int(cy + r + 1))
        r2 = r * r
        for yy in range(y0, y1):
            for xx in range(x0, x1):
                dx = xx + 0.5 - cx
                dy = yy + 0.5 - cy
                if dx*dx + dy*dy <= r2:
                    i = (yy * self.w + xx) * 4
                    self._blend(i, cr, cg, cb, ca)

    def stroke_polyline(self, pts, width, color):
        """Dicker Strich mit Round-Caps und Round-Joins,
           umgesetzt als aneinandergereihte gefuellte Kreise."""
        r = width / 2.0
        # Kappen an jedem Vertex
        for p in pts:
            self.fill_circle(p[0], p[1], r, color)
        # Segmente auffuellen — schrittweise Kreise entlang der Linie
        for i in range(len(pts) - 1):
            x1, y1 = pts[i]
            x2, y2 = pts[i+1]
            dx = x2 - x1
            dy = y2 - y1
            length = math.sqrt(dx*dx + dy*dy)
            if length < 0.5:
                continue
            step = 0.5   # sub-pixel steps → glatte Linie
            n_steps = int(length / step)
            for s in range(1, n_steps):
                t = s / n_steps
                self.fill_circle(x1 + dx*t, y1 + dy*t, r, color)


# ---------------------------------------------------------------
# GRADIENT-Helfer (vertikal)
# ---------------------------------------------------------------
def vgrad(y, y0, y1, stops):
    """stops: [(offset 0..1, (r,g,b)), ...] — linear interpoliert."""
    t = 0.0 if y1 == y0 else (y - y0) / (y1 - y0)
    if t <= 0: return stops[0][1]
    if t >= 1: return stops[-1][1]
    for i in range(len(stops) - 1):
        o1, c1 = stops[i]
        o2, c2 = stops[i+1]
        if o1 <= t <= o2:
            k = 0.0 if o2 == o1 else (t - o1) / (o2 - o1)
            return (
                int(c1[0] + (c2[0] - c1[0]) * k),
                int(c1[1] + (c2[1] - c1[1]) * k),
                int(c1[2] + (c2[2] - c1[2]) * k),
            )
    return stops[-1][1]


# ---------------------------------------------------------------
# ICON-GESTALTUNG (Koords im 512er Design, hochgerechnet auf SUPER)
# ---------------------------------------------------------------
def s(v):
    """512er Design-Koordinaten → Supersampling-Koordinaten"""
    return v * (SS_W / 512.0)

def render_kachel(cv, bg_stops, top_stops):
    """Weinrote/petrole abgerundete Kachel + heller Verlauf oben."""
    y_top    = s(16)
    y_bottom = s(496)
    def bg(u, v):
        c = vgrad(v, 0, y_bottom - y_top, bg_stops)
        return (c[0], c[1], c[2], 255)
    cv.fill_rounded_rect(s(16), s(16), s(480), s(480), s(100), bg)

    # Heller Verlauf oben (oberes Drittel), 55% opak
    y_top2 = 0
    y_bot2 = s(240 - 16)
    def bgtop(u, v):
        c = vgrad(v, y_top2, y_bot2, top_stops)
        return (c[0], c[1], c[2], int(255 * 0.55))
    # Verwende dieselbe rounded-Kachel-Silhouette, aber nur obere Haelfte
    # → einfacher Trick: begrenzen wir die Malflaeche per Sub-Canvas-Bereich
    # (Wir malen ueber alles und clippen implizit durch die Alpha-Regel)
    cv.fill_rounded_rect(s(16), s(16), s(480), s(224), s(100), bgtop)

def render_kundenunterlagen(cv):
    # Kachel (weinrot)
    render_kachel(
        cv,
        bg_stops = [
            (0.00, (0x8f, 0x2d, 0x47)),
            (0.55, (0x7a, 0x1e, 0x35)),
            (1.00, (0x4d, 0x12, 0x20)),
        ],
        top_stops = [
            (0.00, (0xa4, 0x45, 0x60)),
            (1.00, (0x8f, 0x2d, 0x47)),
        ],
    )

    weiss   = (255, 255, 255, 255)
    weinrot = (0x7a, 0x1e, 0x35, 255)
    reg_col = (0xf0, 0xd5, 0xdb, 255)

    # Aktenordner-Reiter
    reiter = [
        (s(108), s(152)), (s(226), s(152)),
        (s(258), s(188)), (s(404), s(188)),
        (s(404), s(216)), (s(108), s(216)),
    ]
    cv.fill_polygon(reiter, weiss)

    # Korpus (leicht gerundet)
    def kfill(u, v): return weiss
    cv.fill_rounded_rect(s(108), s(204), s(296), s(240), s(14), kfill)

    # Register-Trennblaetter (Reiter innen)
    def rfill(u, v): return reg_col
    cv.fill_rounded_rect(s(150), s(196), s(44), s(20), s(4), rfill)
    cv.fill_rounded_rect(s(222), s(196), s(44), s(20), s(4), rfill)
    cv.fill_rounded_rect(s(294), s(196), s(44), s(20), s(4), rfill)

    # Angedeutete Zeilen
    def line(u, v): return weinrot
    cv.fill_rounded_rect(s(152), s(272), s(208), s(10), s(5), line)
    cv.fill_rounded_rect(s(152), s(308), s(208), s(10), s(5), line)
    cv.fill_rounded_rect(s(152), s(344), s(208), s(10), s(5), line)
    cv.fill_rounded_rect(s(152), s(380), s(140), s(10), s(5), line)


def render_backups(cv):
    render_kachel(
        cv,
        bg_stops = [
            (0.00, (0x2a, 0x7a, 0x99)),
            (0.55, (0x1e, 0x5a, 0x7a)),
            (1.00, (0x0f, 0x3a, 0x52)),
        ],
        top_stops = [
            (0.00, (0x45, 0x93, 0xb0)),
            (1.00, (0x2a, 0x7a, 0x99)),
        ],
    )

    weiss  = (255, 255, 255, 255)
    petrol = (0x1e, 0x5a, 0x7a, 255)

    # Schild-Silhouette per Bezier-Approximation
    def bezier(p0, p1, p2, p3, n=24):
        out = []
        for i in range(1, n+1):
            t = i / n
            u = 1 - t
            x = u*u*u*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t*t*t*p3[0]
            y = u*u*u*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t*t*t*p3[1]
            out.append((x, y))
        return out

    # Punkte in 512er-Koords
    top      = (256, 96)
    ur       = (400, 132)
    rmid     = (400, 268)
    br_start = (400, 268)
    br_end   = (256, 434)
    bl_end   = (112, 268)
    lmid     = (112, 268)
    ul       = (112, 132)

    pts = []
    # top → ur (leichter Bogen ueber die "Schulter" — quasi eine gerade Linie)
    pts += bezier(top, (316, 96), (372, 116), ur, n=20)
    # ur → rmid (senkrecht runter)
    pts.append(rmid)
    # rmid → br_end (Bogen unten rechts)
    pts += bezier(br_start, (400, 348), (344, 404), br_end, n=28)
    # br_end → bl_end (Bogen unten links)
    pts += bezier(br_end, (168, 404), (112, 348), bl_end, n=28)
    # bl_end → ul (senkrecht hoch)
    pts.append(ul)
    # ul → top (Bogen)
    pts += bezier(ul, (140, 116), (196, 96), top, n=20)

    pts_ss = [(s(x), s(y)) for (x, y) in pts]
    cv.fill_polygon(pts_ss, weiss)

    # Haken
    haken = [(s(172), s(268)), (s(236), s(332)), (s(344), s(208))]
    cv.stroke_polyline(haken, s(38), petrol)


# ---------------------------------------------------------------
# DOWNSAMPLE (Box-Filter, Faktor n)
# ---------------------------------------------------------------
def downsample_box(src, src_w, src_h, dst_w, dst_h):
    """Generischer Box-Filter — funktioniert auch bei nicht-ganzzahligen
       Faktoren (z. B. 1024 → 48)."""
    fx = src_w / dst_w
    fy = src_h / dst_h
    out = bytearray(dst_w * dst_h * 4)
    for y in range(dst_h):
        y0 = int(y * fy)
        y1 = int((y + 1) * fy)
        if y1 <= y0: y1 = y0 + 1
        if y1 > src_h: y1 = src_h
        for x in range(dst_w):
            x0 = int(x * fx)
            x1 = int((x + 1) * fx)
            if x1 <= x0: x1 = x0 + 1
            if x1 > src_w: x1 = src_w
            r = g = b = a = 0
            n = 0
            for sy in range(y0, y1):
                base = sy * src_w * 4
                for sx in range(x0, x1):
                    i = base + sx * 4
                    r += src[i]
                    g += src[i+1]
                    b += src[i+2]
                    a += src[i+3]
                    n += 1
            o = (y * dst_w + x) * 4
            if n > 0:
                out[o]   = r // n
                out[o+1] = g // n
                out[o+2] = b // n
                out[o+3] = a // n
    return out


# ---------------------------------------------------------------
# PNG-Encoder
# ---------------------------------------------------------------
def encode_png(pixels, w, h):
    def chunk(name, data):
        return (
            struct.pack(">I", len(data))
            + name
            + data
            + struct.pack(">I", binascii.crc32(name + data) & 0xffffffff)
        )
    sig  = bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    stride = w * 4
    raw = bytearray()
    for y in range(h):
        raw.append(0)  # filter=None
        raw.extend(pixels[y*stride:(y+1)*stride])
    idat = zlib.compress(bytes(raw), 9)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


# ---------------------------------------------------------------
# ICO-Encoder (PNG-in-ICO, Vista+)
# ---------------------------------------------------------------
def encode_ico(png_by_size):
    entries = sorted(png_by_size.items())
    n = len(entries)
    header = struct.pack("<HHH", 0, 1, n)
    dir_entries = b""
    data = b""
    offset = 6 + 16 * n
    for size, png in entries:
        w = 0 if size >= 256 else size
        h = 0 if size >= 256 else size
        dir_entries += struct.pack(
            "<BBBBHHII",
            w, h, 0, 0, 1, 32, len(png), offset,
        )
        offset += len(png)
        data += png
    return header + dir_entries + data


# ---------------------------------------------------------------
# HAUPTPROGRAMM
# ---------------------------------------------------------------
def build_icon(name, render_fn):
    print(f"Rendere {name} bei {SS_W}x{SS_W} ...")
    cv = Canvas(SS_W, SS_W)
    render_fn(cv)
    supersampled = bytes(cv.px)

    print(f"Downsample {name} zu {ICO_SIZES} ...")
    pngs = {}
    for size in ICO_SIZES:
        px = downsample_box(supersampled, SS_W, SS_W, size, size)
        pngs[size] = encode_png(px, size, size)
        print(f"  {size}x{size} → {len(pngs[size])} B PNG")

    ico_path = os.path.join(APP_ICON, f"{name}.ico")
    with open(ico_path, "wb") as f:
        f.write(encode_ico(pngs))
    print(f"  ICO geschrieben: {ico_path} ({os.path.getsize(ico_path)} B)")

    preview = os.path.join(APP_ICON, f"{name}-preview.png")
    with open(preview, "wb") as f:
        f.write(pngs[256])
    print(f"  Vorschau: {preview}")


if __name__ == "__main__":
    os.makedirs(APP_ICON, exist_ok=True)
    build_icon("kundenunterlagen", render_kundenunterlagen)
    build_icon("backups",          render_backups)
    print("Fertig.")
