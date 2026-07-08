from __future__ import annotations

import json
import math
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


WIDTH = 3840
HEIGHT = 2160
OUT = Path(__file__).resolve().parents[1] / "public" / "assets" / "backgrounds"
SEED = 92841


PANELS = [
    {
        "id": "oxblood",
        "name": "Oxblood Roman clay",
        "base": (74, 24, 29),
        "lift": (156, 67, 64),
        "shadow": (20, 11, 13),
        "gold": 0.16,
    },
    {
        "id": "limewash-cream",
        "name": "Clouded limewash cream",
        "base": (222, 208, 181),
        "lift": (250, 241, 218),
        "shadow": (136, 121, 97),
        "gold": 0.1,
    },
    {
        "id": "soot",
        "name": "Soft soot black plaster",
        "base": (20, 21, 22),
        "lift": (70, 67, 62),
        "shadow": (4, 5, 6),
        "gold": 0.12,
    },
    {
        "id": "emerald",
        "name": "Forest emerald clay",
        "base": (17, 66, 50),
        "lift": (71, 121, 94),
        "shadow": (5, 24, 20),
        "gold": 0.15,
    },
]


def octave_noise(width: int, height: int, rng: np.random.Generator) -> np.ndarray:
    result = np.zeros((height, width), dtype=np.float32)
    total = 0.0
    for scale, weight in [(18, 0.12), (36, 0.18), (72, 0.24), (150, 0.25), (340, 0.21)]:
        small_w = max(2, math.ceil(width / scale))
        small_h = max(2, math.ceil(height / scale))
        noise = rng.random((small_h, small_w), dtype=np.float32)
        image = Image.fromarray((noise * 255).astype(np.uint8), "L")
        image = image.resize((width, height), Image.Resampling.BICUBIC).filter(ImageFilter.GaussianBlur(scale / 3))
        result += np.asarray(image, dtype=np.float32) / 255 * weight
        total += weight
    result /= total
    return result


def brushed_field(width: int, height: int, rng: np.random.Generator) -> np.ndarray:
    diagonal = np.zeros((height, width), dtype=np.float32)
    x = np.linspace(0, 1, width, dtype=np.float32)[None, :]
    y = np.linspace(0, 1, height, dtype=np.float32)[:, None]
    for _ in range(9):
        angle = rng.uniform(-0.9, 0.9)
        frequency = rng.uniform(1.4, 4.6)
        phase = rng.uniform(0, math.tau)
        diagonal += np.sin((x * math.cos(angle) + y * math.sin(angle)) * math.tau * frequency + phase) * rng.uniform(0.025, 0.055)
    return diagonal


def make_panel(panel: dict, index: int) -> Image.Image:
    rng = np.random.default_rng(SEED + index * 101)
    base = np.array(panel["base"], dtype=np.float32)
    lift = np.array(panel["lift"], dtype=np.float32)
    shadow = np.array(panel["shadow"], dtype=np.float32)

    large_cloud = octave_noise(WIDTH, HEIGHT, rng)
    mineral = octave_noise(WIDTH, HEIGHT, rng)
    brush = brushed_field(WIDTH, HEIGHT, rng)
    x = np.linspace(-1, 1, WIDTH, dtype=np.float32)[None, :]
    y = np.linspace(-1, 1, HEIGHT, dtype=np.float32)[:, None]
    vignette = np.clip(1 - (x * x * 0.28 + y * y * 0.18), 0, 1)
    plaster = np.clip(large_cloud * 0.82 + mineral * 0.22 + brush + vignette * 0.11, 0, 1)

    color = shadow[None, None, :] * (1 - plaster[..., None]) + lift[None, None, :] * plaster[..., None]
    color = color * 0.42 + base[None, None, :] * 0.58

    grain = rng.normal(0, 3.2, (HEIGHT, WIDTH, 1)).astype(np.float32)
    color = np.clip(color + grain, 0, 255).astype(np.uint8)
    image = Image.fromarray(color, "RGB")

    glaze = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(glaze, "RGBA")
    random.seed(SEED + index * 29)
    for _ in range(34):
        y0 = random.randint(-HEIGHT // 5, HEIGHT + HEIGHT // 5)
        color_a = random.choice([(255, 250, 235, 15), (0, 0, 0, 18), (220, 190, 135, 10)])
        points = []
        for step in range(8):
            px = int(step / 7 * WIDTH)
            py = int(y0 + math.sin(step * 0.9 + random.random() * 2) * random.randint(30, 120))
            points.append((px, py))
        draw.line(points, fill=color_a, width=random.randint(22, 58), joint="curve")
    glaze = glaze.filter(ImageFilter.GaussianBlur(22))
    image = Image.alpha_composite(image.convert("RGBA"), glaze).convert("RGB")

    foil = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    foil_draw = ImageDraw.Draw(foil, "RGBA")
    for _ in range(10):
        if random.random() > panel["gold"]:
            continue
        y0 = random.randint(0, HEIGHT)
        points = []
        for step in range(7):
            points.append((int(step / 6 * WIDTH), int(y0 + math.sin(step * 1.7) * random.randint(6, 28))))
        foil_draw.line(points, fill=(226, 187, 102, random.randint(24, 44)), width=random.choice([1, 1, 2]))
    foil = foil.filter(ImageFilter.GaussianBlur(0.35))
    return Image.alpha_composite(image.convert("RGBA"), foil).convert("RGB")


def draw_transition_foil(atlas: Image.Image) -> Image.Image:
    overlay = Image.new("RGBA", atlas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")
    rng = random.Random(SEED * 3)
    for seam in [HEIGHT, HEIGHT * 2, HEIGHT * 3]:
        for _ in range(18):
            y0 = seam + rng.randint(-120, 120)
            points = []
            for step in range(12):
                px = int(step / 11 * WIDTH)
                py = int(y0 + math.sin(step * rng.uniform(0.7, 1.6) + rng.random() * 2) * rng.randint(8, 54))
                points.append((px, py))
            draw.line(points, fill=(230, 191, 108, rng.randint(16, 38)), width=rng.choice([1, 1, 2]))
    overlay = overlay.filter(ImageFilter.GaussianBlur(0.45))
    return Image.alpha_composite(atlas.convert("RGBA"), overlay).convert("RGB")


def blend_panel_seams(atlas: Image.Image, panels: list[Image.Image]) -> Image.Image:
    data = np.asarray(atlas).astype(np.float32)
    band = 360
    for seam_index in range(1, len(panels)):
        seam = HEIGHT * seam_index
        upper = np.asarray(panels[seam_index - 1].crop((0, HEIGHT - band, WIDTH, HEIGHT))).astype(np.float32)
        lower = np.asarray(panels[seam_index].crop((0, 0, WIDTH, band))).astype(np.float32)
        cloud = np.asarray(
            Image.fromarray((octave_noise(WIDTH, band, np.random.default_rng(SEED + seam_index * 707)) * 255).astype(np.uint8), "L")
            .filter(ImageFilter.GaussianBlur(18)),
            dtype=np.float32,
        )
        for row in range(band):
            t = row / max(1, band - 1)
            ease = t * t * (3 - 2 * t)
            wobble = (cloud[row, :, None] / 255 - 0.5) * 0.12
            alpha = np.clip(ease + wobble, 0, 1)
            data[seam - band // 2 + row] = upper[min(row + band // 2, band - 1)] * (1 - alpha) + lower[max(row - band // 2, 0)] * alpha
    return Image.fromarray(np.clip(data, 0, 255).astype(np.uint8), "RGB")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    generated = []
    panels = []
    for index, panel in enumerate(PANELS):
        image = make_panel(panel, index)
        file_name = f"omni-limewash-{panel['id']}-4k.webp"
        image.save(OUT / file_name, "WEBP", quality=88, method=6)
        panels.append(image)
        generated.append({"id": panel["id"], "name": panel["name"], "file": file_name, "size": [WIDTH, HEIGHT]})

    atlas = Image.new("RGB", (WIDTH, HEIGHT * len(panels)))
    for index, image in enumerate(panels):
        atlas.paste(image, (0, HEIGHT * index))
    atlas = blend_panel_seams(atlas, panels)
    atlas = draw_transition_foil(atlas)
    atlas_name = "omni-limewash-atlas-4k.webp"
    atlas.save(OUT / atlas_name, "WEBP", quality=88, method=6)
    atlas_2k_name = "omni-limewash-atlas-2k.webp"
    atlas.resize((1920, 4320), Image.Resampling.LANCZOS).save(OUT / atlas_2k_name, "WEBP", quality=90, method=6)

    manifest = {
        "description": "Four 3840x2160 Roman clay and limewash material panels stacked as a vertical stage atlas.",
        "atlas": {"file": atlas_name, "size": [WIDTH, HEIGHT * len(panels)]},
        "runtimeAtlas": {"file": atlas_2k_name, "size": [1920, 4320]},
        "panels": generated,
    }
    (OUT / "omni-limewash-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
