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
    """Replace the bbox region with a gold VIP Sponsor pill."""
    x0, y0, x1, y1 = bbox
    w = x1 - x0
    h = y1 - y0
    draw = ImageDraw.Draw(img, "RGBA")

    # Erase old pill — fill with the page background (near-black).
    draw.rectangle(bbox, fill=(8, 5, 12, 255))

    # Fresh pill: rounded amber bg + amber border.
    radius = h // 2
    draw.rounded_rectangle(
        bbox,
        radius=radius,
        fill=(*VIP_GOLD_BG, 255),
        outline=(*VIP_GOLD_BORDER, 255),
        width=2,
    )

    # Crown glyph (★ as fallback if no font emoji) + text.
    label = "★ VIP Sponsor"
    font = None
    for candidate in [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/Library/Fonts/Arial Bold.ttf",
    ]:
        if os.path.exists(candidate):
            try:
                # Pick a size that fits ~60% of the pill height.
                font = ImageFont.truetype(candidate, max(12, int(h * 0.45)))
                break
            except OSError:
                continue
    if font is None:
        font = ImageFont.load_default()

    # Center text within the pill.
    bbox_text = draw.textbbox((0, 0), label, font=font)
    text_w = bbox_text[2] - bbox_text[0]
    text_h = bbox_text[3] - bbox_text[1]
    tx = x0 + (w - text_w) // 2
    ty = y0 + (h - text_h) // 2 - 1
    draw.text((tx, ty), label, fill=(*VIP_GOLD_TEXT, 255), font=font)


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
