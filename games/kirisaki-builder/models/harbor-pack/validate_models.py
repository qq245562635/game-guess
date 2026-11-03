import json, struct, pathlib, math, zipfile
import numpy as np
from PIL import Image,ImageDraw,ImageFont
ROOT=pathlib.Path(__file__).resolve().parent
records=json.loads((ROOT/'manifest.json').read_text(encoding='utf-8'))
def accessor(doc,blob,idx):
 a=doc['accessors'][idx];v=doc['bufferViews'][a['bufferView']]
 typ={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']]
 n={'SCALAR':1,'VEC3':3,'VEC2':2,'VEC4':4}[a['type']]
 return np.frombuffer(blob,dtype=typ,count=a['count']*n,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,n)
for rec in records:
 b=(ROOT/rec['file']).read_bytes();magic,version,total=struct.unpack_from('<III',b);assert magic==0x46546c67 and version==2 and total==len(b)
 size,kind=struct.unpack_from('<II',b,12);assert kind==0x4e4f534a
 doc=json.loads(b[20:20+size]);bs,bk=struct.unpack_from('<II',b,20+size);assert bk==0x004e4942;blob=b[28+size:28+size+bs]
 assert len(b)<=500000
 assert not any(doc.get(k) for k in ['textures','images','animations','cameras','skins','extensionsRequired','extensionsUsed'])
 assert len(doc['meshes'])<=20 and len(doc['materials'])<=12
 assert all('mesh' in n and not any(k in n for k in ['matrix','translation','rotation','scale','camera','children']) for n in doc['nodes'])
 for m in doc['materials']:
  p=m['pbrMetallicRoughness'];assert .7<=p.get('roughnessFactor',1)<=.9
  assert p.get('metallicFactor',1)==0 or .3<=p.get('metallicFactor',1)<=.5
  assert all('Texture' not in k for k in p)
  assert m['name'].isascii() and '.' not in m['name']
 tris=0;positions=[];used=[]
 for m in doc['meshes']:
  assert len(m['primitives'])==1
  for p in m['primitives']:
   assert p.get('mode',4)==4;assert 'TEXCOORD_0' not in p['attributes'];used.append(p['material'])
   v=accessor(doc,blob,p['attributes']['POSITION']);n=accessor(doc,blob,p['attributes']['NORMAL']);ii=accessor(doc,blob,p['indices']).reshape(-1,3)
   assert np.isfinite(v).all() and np.isfinite(n).all();assert ii.max()<len(v)
   ns=n[ii];assert np.max(np.abs(ns[:,0]-ns[:,1]))<1e-4 and np.max(np.abs(ns[:,0]-ns[:,2]))<1e-4,'nonflat normals'
   tris+=len(ii);positions.append(v)
 assert len(set(used))==len(used),'material split into several meshes'
 limit=6000 if 'boat' in rec['file'] else 1500 if rec['file'] in ['pier.glb','fish-farm.glb'] else 3000
 assert tris<=limit
 verts=np.concatenate(positions);lo=verts.min(axis=0);hi=verts.max(axis=0)
 if rec['file'] not in ['fishing-boat-small.glb','pier.glb','fish-farm.glb']:
  assert abs(lo[1])<1e-5;assert max(abs(lo[0]),abs(hi[0]),abs(lo[2]),abs(hi[2]))<=1.0001
 if rec['file']=='pier.glb':
  deck=positions[[doc['materials'][u]['name'] for u in used].index('Wood')];assert abs(deck[:,2].min()+1)<1e-5 and abs(deck[:,2].max()-1)<1e-5
 rec.update(triangles=tris,dimensions_xyz_m=[round(float(x),3) for x in hi-lo],bounds_min_xyz=[round(float(x),3) for x in lo],bounds_max_xyz=[round(float(x),3) for x in hi],materials=[m['name'] for m in doc['materials']],validated=True)
(ROOT/'manifest.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
text=['# 雾岬港町：模型交付','', '全部为 glTF 2.0 GLB，Y 轴向上；建筑正面 +Z，小渔船船头 +X。尺寸单位为米，下表顺序为长 X × 宽 Z × 高 Y（含水下部分）。建筑地面 Y=0；船、码头和网箱水面 Y=0。', '', '每种材质合并为单独网格；纯色、无贴图、平直着色；roughness=0.82，Metal 的 metallic=0.35，其余为 0。节点变换均为单位变换，无空节点、相机、灯光、动画或压缩扩展。Window 和 Lamp 仅保留材质命名，夜间发光由游戏设置。','', '| 文件 | 实际尺寸（长×宽×高，米） | 三角面 | 网格 | 文件大小 | 材质列表 |','|---|---|---:|---:|---:|---|']
for r in records:
 x,y,z=r['dimensions_xyz_m'];text.append(f"| {r['file']} | {x:.3f} × {z:.3f} × {y:.3f} | {r['triangles']} | {r['meshes']} | {r['bytes']/1024:.1f} KB | {', '.join(r['materials'])} |")
text += ['', '## 交付说明', '', '- 10 个独立模型，文件名与需求一致。小渔船长宽比约 3:1；其他建筑基座接近 2×2 米。灯塔是高挑装饰模型，接入时可以单独缩放。', '- 码头保持整个 2×2 格子的中心为原点，木桥位于 −X，木板端部精确到 Z=−1/+1，按 2 米间隔拼接；桥面顶面 Y=0.53，木桩下伸到 Y=−1。不要单独按网格包围盒重新居中。', '- 鲜鱼市场正面留有独立 Sign 面板。仓库侧面的 07 是几何编号，无贴图。', '- 未取得 Margo-07 原文件，风格按提供的文字规格与色卡制作，未做参考模型的逐项视觉比对。', '- 附预览图、manifest.json、建模源脚本和验证脚本。验证直接读取交付 GLB，检查三角面、网格、材质、大小、无贴图、无压缩、坐标范围、单位变换及平直法线。未在 Three.js r128 游戏中实际接入测试。', '- 全部模型满足规定的面数、材质数、网格数和文件大小上限。']
(ROOT/'交付清单.md').write_text('\n'.join(text)+'\n',encoding='utf-8')
sheet=Image.new('RGB',(1800,820),'#e5e9e5');draw=ImageDraw.Draw(sheet)
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',17)
for i,r in enumerate(records):
 x=(i%5)*360;y=(i//5)*410
 sheet.paste(Image.open(ROOT/'previews'/r['file'].replace('.glb','.png')).convert('RGB').resize((360,360)),(x,y))
 draw.text((x+12,y+362),r['file'].replace('.glb',''),fill='#24393c',font=font)
 draw.text((x+12,y+386),f"{r['triangles']} tris / {r['meshes']} meshes",fill='#536367',font=font)
sheet.save(ROOT/'preview-sheet.png')
with zipfile.ZipFile(ROOT/'kirisaki-models.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p in ROOT.glob('*.glb'):z.write(p,p.name)
 for fn in ['交付清单.md','manifest.json','preview-sheet.png','build_models.py','validate_models.py']:z.write(ROOT/fn,fn)
 for p in (ROOT/'previews').glob('*.png'):z.write(p,'previews/'+p.name)
print('PASS: all 10 exported GLB files validated; package ready.')
print('\n'.join(f"{r['file']}: {r['triangles']} triangles, {r['meshes']} meshes, {r['bytes']} bytes" for r in records))
