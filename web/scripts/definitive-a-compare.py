"""Native-size comparisons. No crops, alignment, resizing or acceptance threshold."""
import hashlib,json,os
from pathlib import Path
from PIL import Image,ImageChops,ImageStat
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'quality-reports/definitive-a/evidence'
REF=Path('C:/Users/Public/Documents/MercadoCero-Visual-Sync/references/DEFINITIVE')
manifest=json.loads((REF/'MANIFEST.json').read_text(encoding='utf-8-sig'))
rows=[]
after_phase=os.environ.get('COMPARE_AFTER_PHASE','after')
for item in manifest['items']:
 if item['kind']!='screen' or item['route'] not in ['/inicio','/fiados','/corte','/metas','/pendientes']:continue
 refpath=REF.parent/item['canonical']
 assert hashlib.sha256(refpath.read_bytes()).hexdigest()==item['sha256'],refpath
 name=f"{item['route'][1:]}-{item['width']}x{item['height']}"
 ref=Image.open(refpath).convert('RGB')
 for phase in ['before',after_phase]:
  actualpath=OUT/f'{phase}-{name}.png'
  if not actualpath.exists():
   rows.append({'screen':name,'phase':phase,'status':'NO VERIFICADO','reason':'capture unavailable','reference':item['canonical']})
   continue
  actual=Image.open(actualpath).convert('RGB');assert actual.size==ref.size
  diff=ImageChops.difference(ref,actual)
  Image.blend(ref,actual,.5).save(OUT/f'{phase}-overlay-{name}.png')
  diff.save(OUT/f'{phase}-diff-{name}.png')
  rows.append({'screen':name,'phase':phase,'reference':item['canonical'],'referenceSHA256':item['sha256'],'pixelIdentical':diff.getbbox() is None,'meanAbsoluteChannelError255':sum(ImageStat.Stat(diff).mean)/3})
regressions=[]
for before in OUT.glob('before-*.png'):
 if 'overlay' in before.name or 'diff' in before.name:continue
 after=OUT/before.name.replace('before-',after_phase+'-',1)
 if not after.exists():continue
 diff=ImageChops.difference(Image.open(before).convert('RGB'),Image.open(after).convert('RGB'))
 regressions.append({'screen':before.stem[7:],'pixelIdentical':diff.getbbox() is None,'meanAbsoluteChannelError255':sum(ImageStat.Stat(diff).mean)/3})
(OUT/('comparisons.json' if after_phase=='after' else f'comparisons-{after_phase}.json')).write_text(json.dumps({'afterPhase':after_phase,'references':rows,'beforeAfter':regressions},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'references':rows,'beforeAfter':regressions},indent=2))
