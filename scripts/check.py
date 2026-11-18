"""Verify the manuscript explorer's asset inventory and provenance."""
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

assert (root / "assets/organoid-material.jpg").is_file(), "Missing organoid surface material"

html = (root / "index.html").read_text(encoding="utf-8")
for path in re.findall(r'(?:src|href)="([^"#]+)"', html):
    if not path.startswith(("https:", "http:")):
        assert (root / path).exists(), path
assert "live_inference:false" in (root / "app.js").read_text(encoding="utf-8")
ast.parse((root / "local-runner.py").read_text(encoding="utf-8"))
print("PASS: 72 static ROIs, 21 trajectory frames, 5 figures, 23 panels, "
      "7 source pages, local references and replay provenance.")
