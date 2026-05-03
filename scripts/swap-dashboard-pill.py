#!/usr/bin/env python3
"""
Swap the top-right "Admin" pill on a captured dashboard screenshot for a
gold "VIP Sponsor" pill, then write the result to
public/dashboard-screenshot.png.

Why a script and not Photoshop: the dashboard preview shows up on
/sponsor/info and /sponsor — both surfaces where a sponsor-tier pill
reads cleaner than an admin one. Generating the swap programmatically
keeps the operation reproducible (re-run anytime the dashboard
re-screenshots).

Usage:
  python3 scripts/swap-dashboard-pill.py path/to/raw-screenshot.png
  # writes public/dashboard-screenshot.png

The script auto-detects the pill bbox by looking for the purple "Admin"
chip in the top-right band. If detection fails (different theme, image
crop), pass --bbox x0,y0,x1,y1 explicitly.
"""

import argparse
import os
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    sys.exit(
        "Pillow not installed. Run:\n"
        "  pip3 install --user pillow\n"
        "  # or: python3 -m pip install pillow"
    )

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "public" / "dashboard-screenshot.png"

# Colour reference points (sampled from the live nav pill on /dashboard).
ADMIN_PURPLE_BG = (76, 29, 149)        # ~purple-900/60
VIP_GOLD_BORDER = (245, 158, 11)       # amber-500
VIP_GOLD_TEXT = (252, 211, 77)         # amber-300
VIP_GOLD_BG = (35, 22, 8)              # dark amber wash so dark theme stays consistent


def find_admin_pill(img: Image.Image) -> tuple[int, int, int, int] | None:
    """
    Look for the purple Admin pill in the top 12% of the image, right 30%.
    Returns (x0, y0, x1, y1) or None.

    Heuristic: scan for clustered pixels close to ADMIN_PURPLE_BG. If we
    find a contiguous block ≥ 60×20 px in the top-right band, that's the
    pill.
    """
    px = img.load()
    w, h = img.size
    band_top = 0
    band_bot = int(h * 0.12)
    band_left = int(w * 0.70)

    target_r, target_g, target_b = ADMIN_PURPLE_BG
    matches = []
    for y in range(band_top, band_bot):
        for x in range(band_left, w):
            r, g, b = px[x, y][:3]
            if (
                abs(r - target_r) < 50
                and abs(g - target_g) < 50
                and abs(b - target_b) < 50
                and b > r  # purple has more blue than red
            ):
                matches.append((x, y))

    if not matches:
        return None

    xs = [m[0] for m in matches]
    ys = [m[1] for m in matches]
    x0, x1 = min(xs), max(xs)
    y0, y1 = min(ys), max(ys)

    # Reject if cluster is too small to be the pill.
    if (x1 - x0) < 50 or (y1 - y0) < 16:
        return None

    # Pad slightly to fully cover the rounded corners.
    return (max(0, x0 - 6), max(0, y0 - 6), min(w, x1 + 6), min(h, y1 + 6))


def draw_vip_pill(img: Image.Image, bbox: tuple[int, int, int, int]) -> None:
    """
    Replace the bbox region with a Fray-style VIP Sponsor badge:
    rounded-lg (NOT full pill), amber-tinted bg, amber border, crown
    glyph in amber-400, "VIP Sponsor" text in amber-300. Mirrors the
    runtime badge in app/dashboard/page.tsx so the screenshot looks
    consistent with what real VIP sponsors see in the top-right of
    the live dashboard.
    """
    x0, y0, x1, y1 = bbox
    w = x1 - x0
    h = y1 - y0
    draw = ImageDraw.Draw(img, "RGBA")

    # Erase old pill — fill with the page background (near-black).
    draw.rectangle(bbox, fill=(8, 5, 12, 255))

    # Fresh badge: rounded-lg (~8px radius, not full-pill). Match the
    # exact visible styling of the live Fray badge in app/dashboard:
    # bg-amber-500/10 over a black-near bg renders as a warm dark amber;
    # border-amber-500 reads as a crisp amber outline. We compute the
    # composited color so PIL renders identically without needing a
    # working alpha-blend in rounded_rectangle.
    radius = max(6, int(h * 0.20))
    draw.rounded_rectangle(
        bbox,
        # bg-amber-500/10 ≈ rgb(33, 21, 12) over rgb(8,5,12)
        radius=radius,
        fill=(33, 21, 12, 255),
        # border-amber-500 reads brighter on the live badge — bump to
        # the full amber-500 colour (not the .30 alpha computation)
        # so the outline pops the way it does in the navbar.
        outline=(245, 158, 11, 255),
        width=2,
    )

    # Load font: bold for the label.
    font = None
    for candidate in [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/Library/Fonts/Arial Bold.ttf",
    ]:
        if os.path.exists(candidate):
            try:
                font = ImageFont.truetype(candidate, max(14, int(h * 0.42)))
                break
            except OSError:
                continue
    if font is None:
        font = ImageFont.load_default()

    # Crown drawn as PIL primitives to match Lucide's `Crown` icon:
    # three rounded peaks with jewels at each peak top, sitting on a
    # horizontal band. Drawn in stroke-only style (lines + circles +
    # rect) instead of a solid polygon so it reads as a crown outline,
    # not a jagged silhouette.
    label = "VIP Sponsor"
    label_bbox = draw.textbbox((0, 0), label, font=font)
    label_w = label_bbox[2] - label_bbox[0]
    label_h = label_bbox[3] - label_bbox[1]

    crown_size = max(16, int(h * 0.55))   # crown glyph height in px
    gap_px = max(7, int(h * 0.18))
    total_w = crown_size + gap_px + label_w
    base_x = x0 + (w - total_w) // 2

    cy_top = y0 + (h - crown_size) // 2
    cy_bot = cy_top + crown_size
    cw = crown_size
    cx0 = base_x

    AMBER = (251, 191, 36, 255)  # amber-400

    # Three peaks: left, center (taller), right. Each peak is a
    # filled triangle with a small dip between, sitting on a base band.
    # Use a solid-fill polygon that traces: left base → up to left peak
    # → down to dip → up to center peak → down to dip → up to right
    # peak → down to right base → across base.
    peak_y_tall = cy_top + cw * 0.05         # center peak (tallest)
    peak_y_short = cy_top + cw * 0.18        # outer peaks
    dip_y = cy_top + cw * 0.42               # dip between peaks
    band_top = cy_bot - cw * 0.30            # top of horizontal base band
    band_bot = cy_bot - cw * 0.05            # bottom edge of band

    crown_pts = [
        (cx0 + cw * 0.05, band_top),                # left base top
        (cx0 + cw * 0.05, peak_y_short + cw * 0.05),
        (cx0 + cw * 0.18, peak_y_short),            # left peak
        (cx0 + cw * 0.34, dip_y),                   # left dip
        (cx0 + cw * 0.50, peak_y_tall),             # center peak
        (cx0 + cw * 0.66, dip_y),                   # right dip
        (cx0 + cw * 0.82, peak_y_short),            # right peak
        (cx0 + cw * 0.95, peak_y_short + cw * 0.05),
        (cx0 + cw * 0.95, band_top),                # right base top
        (cx0 + cw * 0.95, band_bot),                # right base bottom
        (cx0 + cw * 0.05, band_bot),                # left base bottom
    ]
    draw.polygon(crown_pts, fill=AMBER)

    # Tiny jewels at each peak so the silhouette unmistakably reads as
    # a crown.
    jewel_r = max(1, int(cw * 0.06))
    jewel_centers = [
        (cx0 + cw * 0.18, peak_y_short),
        (cx0 + cw * 0.50, peak_y_tall),
        (cx0 + cw * 0.82, peak_y_short),
    ]
    for jx, jy in jewel_centers:
        draw.ellipse(
            (jx - jewel_r, jy - jewel_r, jx + jewel_r, jy + jewel_r),
            fill=(120, 53, 15, 255),  # amber-900 — darker dot for jewel detail
        )

    # Label text.
    cy_label = y0 + (h - label_h) // 2 - label_bbox[1] - 1
    label_x = base_x + crown_size + gap_px
    draw.text((label_x, cy_label), label, fill=(252, 211, 77, 255), font=font)  # amber-300


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("source", help="Path to the raw dashboard screenshot")
    ap.add_argument(
        "--bbox",
        help="Override pill bbox: x0,y0,x1,y1 (skip auto-detect)",
        default=None,
    )
    ap.add_argument(
        "--out",
        help="Output path (default: public/dashboard-screenshot.png)",
        default=str(DEST),
    )
    args = ap.parse_args()

    src = Path(args.source).expanduser().resolve()
    if not src.exists():
        sys.exit(f"Source not found: {src}")

    img = Image.open(src).convert("RGBA")

    if args.bbox:
        bbox = tuple(int(v) for v in args.bbox.split(","))
        if len(bbox) != 4:
            sys.exit("--bbox must be x0,y0,x1,y1")
    else:
        detected = find_admin_pill(img)
        if not detected:
            sys.exit(
                "Could not auto-detect the Admin pill. "
                "Pass --bbox x0,y0,x1,y1 (pixel coordinates from top-left)."
            )
        bbox = detected
        print(f"[swap] Detected Admin pill at {bbox}")

    draw_vip_pill(img, bbox)

    out_path = Path(args.out).expanduser().resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.convert("RGB").save(out_path, "PNG", optimize=True)
    print(f"[swap] Wrote {out_path} ({out_path.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
