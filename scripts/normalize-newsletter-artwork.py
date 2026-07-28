#!/usr/bin/env python3
"""Normalize generated newsletter artwork to a full-bleed 1200x630 raster.

The crop is always cover-style (never contain/letterbox). Optional dark-band
trimming removes only contiguous near-black edge bands before the cover crop.
"""
from __future__ import annotations

import argparse
from pathlib import Path
from PIL import Image, ImageOps


def dark_band_bounds(image: Image.Image) -> tuple[int, int, int, int]:
    rgb = image.convert("RGB")
    w, h = rgb.size
    ys = list(range(0, h, max(1, h // 128)))
    xs = list(range(0, w, max(1, w // 160)))

    def dark_col(x: int) -> bool:
        values = [rgb.getpixel((x, y)) for y in ys]
        return sum(max(pixel) < 24 for pixel in values) / len(values) >= 0.94

    def dark_row(y: int) -> bool:
        values = [rgb.getpixel((x, y)) for x in xs]
        return sum(max(pixel) < 24 for pixel in values) / len(values) >= 0.94

    left = 0
    while left < w // 2 and dark_col(left):
        left += 1
    right = 0
    while right < w // 2 and dark_col(w - 1 - right):
        right += 1
    top = 0
    while top < h // 2 and dark_row(top):
        top += 1
    bottom = 0
    while bottom < h // 2 and dark_row(h - 1 - bottom):
        bottom += 1
    return left, top, w - right, h - bottom


def normalize(source: Path, destination: Path, trim_dark_bands: bool) -> None:
    with Image.open(source) as opened:
        image = ImageOps.exif_transpose(opened).convert("RGB")
        if trim_dark_bands:
            bounds = dark_band_bounds(image)
            l, t, r, b = bounds
            # Trim only meaningful edge bands. Natural dark art is preserved
            # unless at least two opposing edges prove a letterbox/pillarbox.
            w, h = image.size
            horizontal_pair = l >= w * 0.03 and (w - r) >= w * 0.03
            vertical_pair = t >= h * 0.03 and (h - b) >= h * 0.03
            if horizontal_pair or vertical_pair:
                image = image.crop(bounds)
        image = ImageOps.fit(
            image,
            (1200, 630),
            method=Image.Resampling.LANCZOS,
            centering=(0.5, 0.5),
        )
        destination.parent.mkdir(parents=True, exist_ok=True)
        image.save(destination, format="PNG", optimize=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    parser.add_argument("--trim-dark-bands", action="store_true")
    args = parser.parse_args()
    normalize(args.source, args.destination, args.trim_dark_bands)
