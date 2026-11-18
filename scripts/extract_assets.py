"""Extract figures from the supplied private 34-page V3Cell manuscript using PyMuPDF."""
import argparse
import json
from pathlib import Path

import fitz


ASSETS = Path(__file__).resolve().parents[1] / "dist/assets"
SUBTYPES = [
    ("colon", "budding-opaque", "出芽 · 不透明"),
    ("colon", "budding-transparent", "出芽 · 透明"),
    ("colon", "non-budding-opaque", "无出芽 · 不透明"),
    ("colon", "non-budding-transparent", "无出芽 · 透明"),
    ("stomach", "apoptotic", "凋亡型"),
    ("stomach", "hollow", "空心型"),
    ("stomach", "solid", "实心型"),
    ("lung", "lumen", "有腔型"),
    ("lung", "non-lumen", "无腔型"),
]
FATES = ("formation", "collapse", "noncavity")

# Zero-based page and clip rectangle in PDF points (origin at upper left).
FIGURES = {
    "framework": (4, (93, 73, 473, 249)),
    "static-comparison": (5, (124, 73, 496, 371)),
    "quality": (6, (97, 73, 474, 319)),
    "phenotyping": (8, (97, 73, 474, 266)),
    "trajectories": (9, (124, 73, 496, 478)),
}


def export_atlas_and_figures(document, output):
    page = document[5]
    images = [(ref, page.get_image_rects(ref)[0]) for ref, *_ in page.get_images()]
    columns = []
    for left in sorted(rect.x0 for _, rect in images):
        if not columns or left - columns[-1] > 3:
            columns.append(left)
    if len(columns) != len(SUBTYPES):
        raise ValueError("Unexpected Figure 2 layout; verify this manuscript revision.")

    samples = []
    for left, (lineage, subtype, label) in zip(columns, SUBTYPES):
        column = sorted(((ref, rect) for ref, rect in images if abs(rect.x0 - left) < 3),
                        key=lambda item: item[1].y0)
        if len(column) != 8:
            raise ValueError(f"Expected eight examples for {lineage}/{subtype}.")
        for row, (ref, _) in enumerate(column):
            kind = "real" if row < 4 else "virtual"
            sample_id = f"{lineage}-{subtype}-{kind}-{row % 4 + 1}"
            filename = sample_id + ".png"
            (output / filename).write_bytes(document.extract_image(ref)["image"])
            samples.append(dict(id=sample_id, lineage=lineage, subtype=subtype, label=label,
                                kind=kind, image="assets/" + filename,
                                source="main_nbe.pdf · Figure 2 · p.6"))
    (output / "samples.json").write_text(json.dumps(samples, ensure_ascii=False, indent=2),
                                         encoding="utf-8")

    for fate, start in zip(FATES, (602, 609, 616)):
        for index in range(7):
            image = document.extract_image(start + index)["image"]
            (output / f"trajectory-{fate}-{index}.png").write_bytes(image)
    for name, (page_index, rect) in FIGURES.items():
        document[page_index].get_pixmap(matrix=fitz.Matrix(2.5, 2.5), clip=rect).save(
            output / f"{name}.png")


def crop_panel(document, output, figure, name, bounds):
    # Bounds are pixel offsets in the corresponding 2.5x overview, used only
    # to locate the panel. Render from the PDF at 5x so vector axes stay legible.
    page_index, (left, top, _, _) = FIGURES[figure]
    offset_x, offset_y = int(left * 2.5), int(top * 2.5)
    x0, y0, x1, y1 = bounds
    rect = fitz.Rect((x0 + offset_x) / 2.5, (y0 + offset_y) / 2.5,
                     (x1 + offset_x) / 2.5, (y1 + offset_y) / 2.5)
    document[page_index].get_pixmap(matrix=fitz.Matrix(5, 5), clip=rect).save(
        output / f"{name}.png")


def export_panels(document, output):
    for dimension, bounds in {
        "distribution": (6, 4, 710, 243),        # Figure 3A
        "texture": (6, 243, 713, 445),           # 3C: Q-Q and marginal distributions
        "morphometry": (6, 445, 940, 615),       # 3E–F: annotated examples and statistics
        "umap": (725, 243, 940, 445),            # 3D
    }.items():
        crop_panel(document, output, "quality", "quality-" + dimension, bounds)

    # Fig. 5C and G. The x-axis endpoints share a fixed offset within each
    # family; a browser can place a time cursor without estimating any y value.
    for fate, left in zip(FATES, (30, 318, 619)):
        crop_panel(document, output, "trajectories", "probability-" + fate,
                   (left, 278, left + 286, 488))
    for fate, left in zip(FATES, (28, 321, 637)):
        crop_panel(document, output, "trajectories", "morphometry-" + fate,
                   (left, 758, left + 270, 1012))
    crop_panel(document, output, "trajectories", "attribution-nef", (610, 495, 916, 749))

    # Fig. 5B contains non-square embedded source images. Rendering their
    # printed rectangles reproduces the display geometry and overlaid bars.
    page = document[9]
    channels = ("brightfield", "gradcam", "pmlc", "dapi")
    for condition, refs in {
        "ehdpp": (633, 634, 627, 628),
        "iddpp": (629, 630, 625, 626),
        "rgd": (631, 632, 623, 624),
    }.items():
        for channel, ref in zip(channels, refs):
            rect, = page.get_image_rects(ref)
            page.get_pixmap(matrix=fitz.Matrix(5, 5), clip=rect).save(
                output / f"attribution-{condition}-{channel}.png")

    for page_number in range(5, 12):
        document[page_number - 1].get_pixmap(matrix=fitz.Matrix(2, 2)).save(
            output / f"source-p{page_number}.png")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--panels-only", action="store_true",
                        help="Extract the study panels and the seven cited manuscript pages.")
    args = parser.parse_args()
    ASSETS.mkdir(parents=True, exist_ok=True)
    with fitz.open(args.pdf) as manuscript:
        if len(manuscript) != 34 or "V3Cell" not in manuscript[0].get_text():
            parser.error("Expected the supplied 34-page V3Cell manuscript.")
        if not args.panels_only:
            export_atlas_and_figures(manuscript, ASSETS)
        export_panels(manuscript, ASSETS)
    print("Extracted 23 study panels and 7 source pages." if args.panels_only else
          "Extracted 72 static samples, 21 trajectory frames, 5 figures, "
          "23 study panels and 7 source pages.")
