"""Raster profiles for pair-clearance checks. Licensed under SIL OFL 1.1."""
import numpy as np
from PIL import Image, ImageDraw, ImageFont


def profile(path, characters):
    face = ImageFont.truetype(str(path), 1000)
    shapes = {}
    for char in characters:
        image = Image.new("L", (1600, 1500))
        ImageDraw.Draw(image).text((220, 1140), char, font=face, fill=255, anchor="ls")
        pixels = np.asarray(image) > 127
        rows = pixels.any(axis=1)
        shapes[char] = (
            np.where(rows, pixels.argmax(axis=1) - 220, 10000),
            np.where(rows, 1599 - pixels[:, ::-1].argmax(axis=1) - 220, -10000),
            rows,
        )
    return shapes
