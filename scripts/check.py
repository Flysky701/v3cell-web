"""Verify the manuscript explorer's asset inventory, i18n keys, and provenance."""
import ast
import json
import re
from collections import Counter
from pathlib import Path

root = Path(__file__).absolute().parents[1] / "dist"
samples = json.loads((root / "assets/samples.json").read_text(encoding="utf-8"))
assert len(samples) == len({sample["id"] for sample in samples}) == 72
groups = Counter((s["lineage"], s["subtype"], s["kind"]) for s in samples)
assert len(groups) == 18 and set(groups.values()) == {4}
assert Counter(s["lineage"] for s in samples) == {"colon": 32, "stomach": 24, "lung": 16}
for sample in samples:
    assert (root / sample["image"]).is_file(), sample["image"]

fates = ("formation", "collapse", "noncavity")
figures = ["framework", "static-comparison", "quality", "phenotyping", "trajectories"]
frames = [f"trajectory-{fate}-{i}" for fate in fates for i in range(7)]
panels = (
    [f"quality-{dimension}" for dimension in ("distribution", "texture", "morphometry", "umap")]
    + [f"{kind}-{fate}" for kind in ("probability", "morphometry") for fate in fates]
    + [f"attribution-{condition}-{channel}" for condition in ("ehdpp", "iddpp", "rgd")
       for channel in ("brightfield", "gradcam", "pmlc", "dapi")]
    + ["attribution-nef"]
)
for name in figures + frames + panels + [f"source-p{i}" for i in range(5, 12)]:
    assert (root / "assets" / (name + ".png")).is_file(), name

assert (root / "assets/organoid-material.webp").is_file(), "Missing organoid surface material"
assert (root / "assets/organoid-section.webp").is_file(), "Missing organoid section illustration"
assert (root / "assets/organoid-miniatures.webp").is_file(), "Missing organoid miniatures"
for film in ("phenotypes", "phenotypes-en", "fates", "fates-en"):
    assert (root / f"assets/films/{film}.mp4").is_file(), film
    assert (root / f"assets/films/{film}.webp").is_file(), film
for opening in ("phenotypes-opening", "phenotypes-en-opening"):
    assert (root / f"assets/films/{opening}.webp").is_file(), opening

for html_file in sorted(root.glob("*.html")):
    html = html_file.read_text(encoding="utf-8")
    for path in re.findall(r'(?:src|href)="([^"#?]+)', html):
        if path and not path.startswith(("https:", "http:", "data:", "mailto:")):
            assert (root / path).exists(), f"{html_file.name}: missing {path}"

i18n_src = (root / "i18n.js").read_text(encoding="utf-8")
defined_keys = {
    a or b
    for a, b in re.findall(r"^\s*(?:\"([^\"]+)\"|([A-Za-z_$][A-Za-z0-9_$]*))\s*:\s*\[", i18n_src, re.M)
}
for source_file in [root / "index.html", *sorted(root.glob("*.js"))]:
    if source_file.name == "i18n.js":
        continue
    text = source_file.read_text(encoding="utf-8")
    refs = set(re.findall(r'data-i18n(?:-[a-z]+)?="([A-Za-z0-9_-]+)"', text))
    refs |= set(re.findall(r"\b(?:t|msg|eye)\(\s*['\"]([A-Za-z0-9_-]+)['\"]", text))
    missing = refs - defined_keys
    assert not missing, f"{source_file.name}: missing i18n keys {sorted(missing)}"

assert "live_inference:false" in (root / "app.js").read_text(encoding="utf-8")
ast.parse((root / "local-runner.py").read_text(encoding="utf-8"))
print("PASS: 72 static ROIs, 21 trajectory frames, 5 figures, 23 panels, "
      "7 source pages, 4 films, all HTML references, i18n keys and replay provenance.")
