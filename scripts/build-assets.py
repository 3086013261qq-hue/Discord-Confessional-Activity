"""Derive runtime copies; leaves Library masters and tarot originals untouched."""
from PIL import Image
from pathlib import Path
import json,hashlib,sys
root=Path(__file__).resolve().parents[1]
source=Path(sys.argv[1]) if len(sys.argv)>1 else root.parent/'visual_sources/Discord忏悔室/视觉素材'
records=[]
def save(src,out,size):
 im=Image.open(src).convert('RGBA');im.thumbnail(size,Image.Resampling.LANCZOS);out.parent.mkdir(parents=True,exist_ok=True);im.save(out)
 records.append({'runtime':str(out.relative_to(root/'public')),'source':str(src.relative_to(source)),'source_sha256':hashlib.sha256(src.read_bytes()).hexdigest()})
for size in (128,256,512):save(source/'应用封面图标_黑白祈祷修女.png',root/f'public/assets/icon-{size}.png',(size,size))
for name,key in [('龙卷','tatsumaki'),('山城恋','ren_yamashiro'),('李柚巴','yuzuha_lee')]:save(source/f'三位修女老板娘/{name}_修女老板娘.png',root/f'public/assets/nuns/{key}.webp',(558,941))
sheet=Image.open(source/'哥特修女十六表情贴纸合集.png');w,h=sheet.size
stickers=[]
for row in range(4):
 for col in range(4):
  key=f'nun_{row*4+col+1:02}';out=root/f'public/assets/stickers/nun/{key}.png';out.parent.mkdir(parents=True,exist_ok=True)
  im=sheet.crop((round(col*w/4),round(row*h/4),round((col+1)*w/4),round((row+1)*h/4)));im.thumbnail((256,320),Image.Resampling.LANCZOS);im.save(out,optimize=True)
  stickers.append({'id':key,'url':f'/assets/stickers/nun/{key}.png'})
(root/'public/assets/stickers/manifest.json').write_text(json.dumps({'source':'/Discord忏悔室/视觉素材/哥特修女十六表情贴纸合集.png','layout':'4x4','stickers':stickers},ensure_ascii=False,indent=2)+'\n')
(root/'public/assets/runtime-sources.json').write_text(json.dumps({'sources':records,'sticker_master_sha256':hashlib.sha256((source/'哥特修女十六表情贴纸合集.png').read_bytes()).hexdigest(),'alternate_sticker_master':'哥特修女多姿态贴纸集.png (reserved, unchanged)'},ensure_ascii=False,indent=2)+'\n')
print('3 icons, 3 portraits, 16 stickers')
