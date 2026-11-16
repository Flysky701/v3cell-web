"""Verify the scientific demo's asset inventory and local document references."""
import json,re
from pathlib import Path
root=Path(__file__).resolve().parents[1]/'dist'
samples=json.loads((root/'assets/samples.json').read_text())
assert len(samples)==72, f'Expected 72 manuscript samples, found {len(samples)}'
assert len({s['id'] for s in samples})==72
for lineage,count in [('colon',32),('stomach',24),('lung',16)]:
 assert sum(s['lineage']==lineage for s in samples)==count
for s in samples: assert (root/s['image']).is_file(), s['image']
for fate in ['formation','collapse','noncavity']:
 for i in range(7): assert (root/f'assets/trajectory-{fate}-{i}.png').is_file()
for file in ['framework','static-comparison','quality','phenotyping','trajectories']:
 assert (root/f'assets/{file}.png').is_file()
for path in re.findall(r'(?:src|href)="([^"#]+)"',(root/'index.html').read_text()):
 if not path.startswith(('https:','http:')): assert (root/path).exists(),path
assert 'live_inference:false' in (root/'app.js').read_text()
print('PASS: 72 uniquely identified static samples, 21 trajectory frames, 5 figures, local asset references, and demo provenance.')
