"""Extract manuscript figures for the private prototype. Usage: python scripts/extract_assets.py path/to/main_nbe.pdf"""
import json, sys
from pathlib import Path
import fitz
out=Path(__file__).resolve().parents[1]/'dist/assets'
out.mkdir(parents=True,exist_ok=True)
p=fitz.open(sys.argv[1])
page=p[5]
imgs=[(x[0],page.get_image_rects(x[0])[0]) for x in page.get_images()]
xs=[]
for v in sorted(r.x0 for _,r in imgs):
 if not xs or v-xs[-1]>3: xs.append(v)
subtypes=[('colon','budding-transparent','出芽 · 透明'),('colon','budding-opaque','出芽 · 不透明'),('colon','non-budding-transparent','无出芽 · 透明'),('colon','non-budding-opaque','无出芽 · 不透明'),('stomach','apoptotic','凋亡型'),('stomach','hollow','空心型'),('stomach','solid','实心型'),('lung','lumen','有腔型'),('lung','non-lumen','无腔型')]
samples=[]
for x,(lineage,subtype,label) in zip(xs,subtypes):
 col=sorted([(ref,r) for ref,r in imgs if abs(r.x0-x)<3],key=lambda v:v[1].y0)
 for row,(ref,rect) in enumerate(col):
  kind='real' if row<4 else 'virtual'
  name=f'{lineage}-{subtype}-{kind}-{row%4+1}.png'
  (out/name).write_bytes(p.extract_image(ref)['image'])
  samples.append(dict(id=name[:-4],lineage=lineage,subtype=subtype,label=label,kind=kind,image='assets/'+name,source='main_nbe.pdf · Figure 2 · p.6'))
for fate,start in [('formation',602),('collapse',609),('noncavity',616)]:
 for i in range(7):
  (out/f'trajectory-{fate}-{i}.png').write_bytes(p.extract_image(start+i)['image'])
for name,page_num,rect in [('framework',4,(93,73,473,249)),('static-comparison',5,(124,73,496,371)),('quality',6,(97,73,474,319)),('phenotyping',8,(97,73,474,266)),('trajectories',9,(124,73,496,478))]:
 p[page_num].get_pixmap(matrix=fitz.Matrix(2.5,2.5),clip=fitz.Rect(*rect)).save(str(out/f'{name}.png'))
(out/'samples.json').write_text(json.dumps(samples,ensure_ascii=False,indent=2))
print(f'Extracted {len(samples)} static samples, 21 trajectory frames, 5 figures.')
