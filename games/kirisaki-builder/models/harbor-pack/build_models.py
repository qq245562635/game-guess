import bpy, math, os, json, random
from mathutils import Vector

OUT = os.path.dirname(os.path.abspath(__file__))
random.seed(47)
# Author in game coordinates (Y up, front +Z); glTF exporter converts back to Y up.
def cv(p): return (p[0], -p[2], p[1])
PALETTE = {
 'Ivory':'ece5d7','Sand':'d9cdb8','RoofBlue':'46586b','RoofBrown':'6a4a3c',
 'Wood':'a7835a','WoodDark':'6b4e3a','HarborBlue':'2f5d8a','RescueRed':'d14b45',
 'FishBox':'3c84c4','Metal':'444e51','Window':'607e87','Lamp':'fff0bd',
 'Green':'2f6f52','Leaf':'719354','Grass':'8eb46d','Path':'d7cbb2',
 'Pink':'eaa4bc','PinkLight':'f4bfd0','Yellow':'e8b830','Net':'294449',
 'Concrete':'aaa99c','Sign':'efe8db','Steel':'a1afb3','EndGrain':'c7a270',
 'Terracotta':'b96f51','Door':'805e47','White':'efe8db'
}
def srgb(v): return v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4
MATS={}
for name,h in PALETTE.items():
 m=bpy.data.materials.new(name); rgb=tuple(srgb(int(h[i:i+2],16)/255) for i in (0,2,4))
 m.diffuse_color=(*rgb,1); m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=(*rgb,1)
 bs.inputs['Roughness'].default_value=.82; bs.inputs['Metallic'].default_value=.35 if name=='Metal' else 0
 MATS[name]=m

geo={}
def mesh(mat,vs,fs):
 v,f=geo.setdefault(mat,([],[])); n=len(v); v.extend(cv(p) for p in vs); f.extend(tuple(n+i for i in face) for face in fs)
def box(mat,p,s):
 x,y,z=p; a,b,c=[q/2 for q in s]
 v=[(x-a,y-b,z-c),(x+a,y-b,z-c),(x+a,y+b,z-c),(x-a,y+b,z-c),
    (x-a,y-b,z+c),(x+a,y-b,z+c),(x+a,y+b,z+c),(x-a,y+b,z+c)]
 mesh(mat,v,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),(0,4,7,3),(1,2,6,5)])
def rod(mat,a,b,r,r2=None,n=8):
 a,b=Vector(a),Vector(b); d=(b-a).normalized(); u=d.cross(Vector((0,1,0)))
 if u.length < .01: u=d.cross(Vector((1,0,0)))
 u.normalize(); v=d.cross(u); r2=r if r2 is None else r2
 pts=[tuple(p+rad*(u*math.cos(i*2*math.pi/n)+v*math.sin(i*2*math.pi/n))) for p,rad in ((a,r),(b,r2)) for i in range(n)]
 faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
 mesh(mat,pts,faces)
def cyl(mat,x,y,z,r,h,n=10,r2=None): rod(mat,(x,y-h/2,z),(x,y+h/2,z),r,r2,n)
def roof(mat,x,y,z,w,d,h):
 vs=[(x-w/2,y,z-d/2),(x+w/2,y,z-d/2),(x,y+h,z-d/2),(x-w/2,y,z+d/2),(x+w/2,y,z+d/2),(x,y+h,z+d/2)]
 mesh(mat,vs,[(0,2,1),(3,4,5),(0,3,5,2),(2,5,4,1),(0,1,4,3)])
def leaf(mat,p,s,seed=0):
 # Faceted ellipsoid: 8-sided equator plus staggered shoulders.
 x,y,z=p; sx,sy,sz=s; n=7; vs=[(x,y-sy,z)]
 for yy,rr,phase in [(-.45,.82,0),(.4,.9,.3)]:
  for i in range(n):
   a=i*math.tau/n+phase; vs.append((x+sx*rr*math.cos(a),y+sy*yy,z+sz*rr*math.sin(a)))
 vs.append((x,y+sy,z)); fs=[]
 for i in range(n):
  j=(i+1)%n; fs.extend([(0,1+j,1+i),(1+i,1+j,1+n+j),(1+i,1+n+j,1+n+i),(15,8+i,8+j)])
 mesh(mat,vs,fs)
def tire(p,r=.12,axis='z'):
 vs=[]; n=10; m=4
 for i in range(n):
  a=i*math.tau/n
  for j in range(m):
   b=j*math.tau/m; q=((r+r*.3*math.cos(b))*math.cos(a),(r+r*.3*math.cos(b))*math.sin(a),r*.3*math.sin(b))
   if axis=='x': q=(q[2],q[1],q[0])
   vs.append(tuple(p[k]+q[k] for k in range(3)))
 mesh('Metal',vs,[(i*m+j,((i+1)%n)*m+j,((i+1)%n)*m+(j+1)%m,i*m+(j+1)%m) for i in range(n) for j in range(m)])
def crate(x,y,z,w=.28):
 h=w*.6; t=.025
 box('FishBox',(x,y+t/2,z),(w,t,w*.72))
 for xx in [-1,1]: box('FishBox',(x+xx*(w-t)/2,y+h/2,z),(t,h,w*.72))
 for zz in [-1,1]:
  box('FishBox',(x,y+h/2,z+zz*(w*.72-t)/2),(w,h,t))
  box('HarborBlue',(x,y+h*.67,z+zz*w*.365),(w*.5,.024,.008))
def window(x,y,z,w=.33,h=.4,side=False):
 if side:
  box('WoodDark',(x,y,z),(.035,h+.06,w+.06));box('Window',(x+.022,y,z),(.015,h,w));box('WoodDark',(x+.035,y,z),(.02,.025,w))
 else:
  box('WoodDark',(x,y,z),(w+.06,h+.06,.035));box('Window',(x,y,z+.023),(w,h,.015));box('WoodDark',(x,y,z+.035),(.025,h,.02))
def plant(x,y,z):
 cyl('WoodDark',x,y+.1,z,.09,.2,8,r2=.13);rod('WoodDark',(x,y+.18,z),(x,y+.4,z),.018)
 leaf('Leaf',(x,y+.44,z),(.18,.22,.16))
def base(): box('Concrete',(0,.045,0),(1.94,.09,1.94))
def house(tall):
 base(); h=1.85 if tall else 1.37; w=1.24 if tall else 1.57; d=1.22; wall='Sand' if tall else 'Ivory'; roofmat='RoofBrown' if tall else 'RoofBlue'
 box(wall,(0,.1+h/2,-.12),(w,h,d));box('WoodDark',(0,.2,-.12),(w+.03,.14,d+.03))
 roof(roofmat,0,h+.1,-.12,w+.22,d+.24,.45 if tall else .4)
 # Gable infill, fascia and ridge.
 roof(wall,0,h+.095,-.12,w,d,.36 if tall else .31)
 box(roofmat,(0,h+.56 if tall else h+.51,-.12),(.09,.07,d+.28))
 for zz in [-.12-(d+.24)/2,-.12+(d+.24)/2]:
  rod('WoodDark',(-w/2-.11,h+.1,zz),(0,h+.55 if tall else h+.5,zz),.026,n=4)
  rod('WoodDark',(0,h+.55 if tall else h+.5,zz),(w/2+.11,h+.1,zz),.026,n=4)
 front=.49
 box('WoodDark',(-.29,.48,front+.025),(.37,.76,.06));box(wall,(-.29,.73,front+.064),(.2,.16,.01))
 cyl('Metal',-.17,.45,front+.075,.025,.05,6)
 box('Concrete',(-.29,.13,.69),(.52,.13,.32))
 box(roofmat,(-.27,.96,.65),(.7,.065,.42))
 for x in [-.55,.03]: rod('WoodDark',(x,.74,.52),(x,.95,.81),.02,n=4)
 window(.36,.68,front+.035,.36,.43)
 for x in [-.32,.32]: window(x,h-.25,front+.035,.34,.37)
 window(w/2+.02,.78,-.17,.4,.43,True)
 if tall:
  window(w/2+.02,1.58,-.17,.4,.4,True)
  box(roofmat,(.1,1.32,.6),(1,.06,.3))
  for x in [-.38,-.14,.1,.34,.58]: rod('WoodDark',(x,1.35,.73),(x,1.58,.73),.013,n=4)
  rod('WoodDark',(-.4,1.58,.73),(.6,1.58,.73),.018,n=4)
 plant(.71,.09,.73)
 box('HarborBlue',(-.75,.48,.58),(.13,.2,.1))
def smallboat():
 # Cross sections along +X, pointed bow. Waterline exactly y=0.
 sections=[(-1.5,.37),(-1.25,.49),(.55,.5),(1.18,.31),(1.5,.015)]
 def hull(mat,y0,y1,scale0,scale1):
  vs=[]
  for y,s in [(y0,scale0),(y1,scale1)]:
   vs.extend((x,y,sg*w*s) for sg in [-1,1] for x,w in sections)
  n=len(sections); fs=[]
  for side in [0,1]:
   for i in range(n-1):
    a=side*n+i; fs.append((a,a+1,a+1+2*n,a+2*n) if side==0 else (a+2*n,a+1+2*n,a+1,a))
  fs.extend([(0,2*n,3*n,n),(n-1,2*n-1,4*n-1,3*n-1),tuple(list(range(2*n,3*n))+list(reversed(range(3*n,4*n)))),tuple(list(range(n,2*n))+list(reversed(range(n))))])
  mesh(mat,vs,fs)
 hull('RescueRed',-.28,.025,.58,.94);hull('Ivory',.025,.32,.94,1);hull('HarborBlue',.18,.245,.99,1.005)
 # Planked deck inset and perimeter gunwales.
 hull('Wood',.31,.35,.86,.86)
 for z in [-.28,-.14,0,.14,.28]:box('WoodDark',(-.2,.351,z),(2.3,.008,.009))
 for sign in [-1,1]:
  for (x,w),(xx,ww) in zip(sections,sections[1:]):rod('Ivory',(x,.36,sign*w),(xx,.36,sign*ww),.035,n=4)
 box('Ivory',(-.57,.65,0),(.72,.63,.66));box('HarborBlue',(-.57,.99,0),(.88,.08,.8))
 box('Window',(-.195,.76,0),(.018,.3,.51))
 for z in [-.34,.34]:
  box('Window',(-.57,.77,z),(.51,.3,.018));box('Ivory',(-.57,.77,z*1.02),(.045,.31,.025))
 rod('Metal',(-.2,.99,0),(-.2,1.67,0),.025,n=6);rod('Metal',(-.2,1.4,-.23),(-.2,1.4,.23),.014,n=6)
 cyl('Lamp',-.2,1.72,0,.047,.09,8)
 mesh('RescueRed',[(-.19,1.61,0),(.1,1.57,0),(-.19,1.43,0)],[(0,1,2),(2,1,0)])
 for x,z in [(.18,-.2),(.59,-.15),(.35,.19)]:crate(x,.36,z,.31)
 for x in [-1.12,.73]:
  for z in [-.5,.5]:tire((x,.12,z),.105)
 box('Metal',(-1.51,.12,0),(.15,.38,.25));rod('Metal',(-1.57,.12,0),(-1.57,-.37,0),.035,n=6)
def market():
 base();box('Ivory',(0,.66,-.2),(1.7,1.16,1.1));roof('Green',0,1.24,-.2,1.87,1.3,.27)
 for x in [-.49,.39]:
  box('Metal',(x,.56,.365),(.66,.88,.025))
  for y in [.2,.3,.4,.5,.6,.7,.8,.9]:box('Steel',(x,y,.386),(.62,.055,.025))
 box('Green',(0,1.11,.64),(1.87,.08,.65))
 for x in [-.85,.85]:rod('Metal',(x,.1,.88),(x,1.12,.88),.025,n=6)
 box('WoodDark',(0,1.4,.5),(1.2,.29,.055));box('Sign',(0,1.4,.534),(1.12,.22,.016))
 for x,z,y in [(-.62,.68,.1),(-.62,.68,.29),(-.29,.72,.1),(.64,.72,.1)]:crate(x,y,z,.3)
 box('Steel',(.25,.41,.73),(.42,.09,.32))
 for x in [.08,.42]:rod('Metal',(x,.1,.73),(x,.4,.73),.022,n=4)
 box('Metal',(.25,.49,.73),(.18,.1,.17));box('Steel',(.25,.555,.73),(.28,.025,.22));rod('Metal',(.25,.5,.61),(.25,.76,.61),.016,n=4)
 box('Window',(.25,.76,.62),(.15,.11,.04))
def lumber():
 base();box('WoodDark',(-.33,.14,-.12),(1.18,.15,1.44))
 for x in [-.83,.17]:
  for z in [-.73,.51]:box('WoodDark',(x,.69,z),(.09,1.15,.09))
 roof('RoofBrown',-.33,1.28,-.12,1.3,1.55,.31)
 for z in [-.7,.47]:
  rod('Wood',(-.8,.93,z),(-.5,1.26,z),.035,n=4);rod('Wood',(.14,.93,z),(-.16,1.26,z),.035,n=4)
 for y,x in [(.27,-.67),(.27,-.34),(.27,-.01),(.54,-.5),(.54,-.17)]:
  rod('WoodDark',(x,y,-.65),(x,y,.22),.145,n=9);rod('EndGrain',(x,y,.222),(x,y,.232),.12,n=9)
 box('Wood',(.61,.48,-.4),(.56,.78,.8));roof('RoofBrown',.61,.89,-.4,.68,.9,.16)
 box('WoodDark',(.61,.45,.01),(.32,.6,.025));box('Metal',(.71,.43,.03),(.025,.04,.03))
 cyl('WoodDark',.57,.25,.54,.25,.32,9);cyl('EndGrain',.57,.416,.54,.224,.014,9)
 rod('Wood',(.57,.44,.54),(.73,.95,.57),.025,n=6)
 mesh('Metal',[(.59,.83,.55),(.76,.89,.55),(.91,.76,.55),(.65,.73,.55),(.59,.83,.6),(.76,.89,.6),(.91,.76,.6),(.65,.73,.6)],[(0,1,2,3),(7,6,5,4),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)])
def warehouse():
 base();box('Steel',(0,.72,-.12),(1.65,1.26,1.46))
 # Faceted barrel vault, five broad roof panels.
 xs=[-.91,-.74,-.28,.28,.74,.91];ys=[1.31,1.62,1.83,1.83,1.62,1.31]
 vs=[(x,y,z) for z in [-.93,.69] for x,y in zip(xs,ys)]
 mesh('RoofBlue',vs,[(i,i+6,i+7,i+1) for i in range(5)]+[(0,1,2,3,4,5),(11,10,9,8,7,6)])
 for x in [-.78,-.64,-.5,.5,.64,.78]: box('RoofBlue',(x,.72,.616),(.018,1.2,.015))
 for z in [-.76,-.56,-.36,-.16,.04,.24,.44]:box('RoofBlue',(.836,.72,z),(.016,1.2,.022))
 box('Metal',(0,.64,.63),(.86,1.08,.055))
 for i in range(12): box('Concrete',(0,.15+i*.082,.668),(.79,.055,.025))
 box('Metal',(0,.19,.69),(.16,.025,.02));box('Concrete',(0,.12,.78),(1.04,.09,.3))
 box('Sign',(.851,.95,-.17),(.018,.43,.65))
 # Geometric side marking 07, no text texture.
 for z in [-.34,-.12]:
  if z==-.34:
   for zz in [z-.06,z+.06]:box('RoofBlue',(.866,.95,zz),(.014,.24,.024))
   for y in [.83,1.07]:box('RoofBlue',(.866,y,z),(.014,.025,.14))
  else:
   box('RoofBlue',(.866,1.07,z+.1),(.014,.025,.14));rod('RoofBlue',(.866,1.06,z+.16),(.866,.83,z+.05),.018,n=4)
 box('Metal',(0,1.27,.72),(.25,.08,.13));box('Lamp',(0,1.245,.74),(.16,.025,.08))
def pier():
 # Tile bounds [-1,1], endpoints exactly Z=+-1.
 for z in [-.9,-.45,0,.45,.9]:
  for x in [-.88,-.23]:cyl('WoodDark',x,-.2,z,.065,1.6,7)
 for x in [-.88,-.23]:box('WoodDark',(x,.35,0),(.12,.15,2))
 for i in range(12):
  lo=-1+i*2/12+(.004 if i else 0);hi=-1+(i+1)*2/12-(.004 if i<11 else 0)
  box('Wood',(-.56,.48,(lo+hi)/2),(.8,.1,hi-lo))
 for z in [-.64,.64]:
  cyl('Metal',-.2,.61,z,.055,.16,8);box('Metal',(-.2,.7,z),(.17,.045,.07))
  tire((-.12,.27,z),.13,'x')
def farm():
 for x in [-.82,.82]:box('Yellow',(x,.07,0),(.14,.18,1.78))
 for z in [-.82,.82]:box('Yellow',(0,.07,z),(1.78,.18,.14))
 # Solid opaque shallow net liner plus visible lattice (no alpha texture).
 box('Net',(0,-.17,0),(1.5,.025,1.5))
 for i in range(9):
  t=-.7+i*.175;rod('Metal',(-.75,-.06,t),(.75,-.06,t),.009,n=4);rod('Metal',(t,-.055,-.75),(t,-.055,.75),.009,n=4)
 for x in [-.83,.83]:
  for z in [-.83,.83]:leaf('RescueRed',(x,.09,z),(.16,.15,.16))
 box('Wood',(.46,.19,-.46),(.58,.08,.58));box('Ivory',(.46,.43,-.46),(.43,.42,.4));roof('HarborBlue',.46,.65,-.46,.55,.53,.17)
 box('Window',(.46,.47,-.25),(.18,.17,.015))
def lighthouse():
 cyl('Concrete',0,.18,0,.94,.36,12,r2=.85)
 cyl('Concrete',0,.4,0,.72,.12,12)
 for i in range(6):
  cyl('Ivory' if i%2==0 else 'RescueRed',0,.46+(i+.5)*.41,0,.52-i*.028,.41,12,r2=.52-(i+1)*.028)
 box('Metal',(0,.76,.505),(.24,.59,.055));box('Concrete',(0,.42,.69),(.4,.12,.26))
 for y in [1.25,2.07]:box('Window',(0,y,.47-(y-.8)*.07),(.14,.22,.03))
 cyl('Metal',0,2.98,0,.57,.12,12)
 cyl('Lamp',0,3.32,0,.34,.55,10)
 for i in range(10):
  a=i*math.tau/10;x,z=.36*math.cos(a),.36*math.sin(a);rod('Metal',(x,3.05,z),(x,3.61,z),.022,n=5)
  x,z=.53*math.cos(a),.53*math.sin(a);a2=(i+1)*math.tau/10
  rod('Metal',(x,3.04,z),(x,3.29,z),.014,n=4);rod('Metal',(x,3.29,z),(.53*math.cos(a2),3.29,.53*math.sin(a2)),.015,n=4)
 cyl('Green',0,3.62,0,.47,.08,10);cyl('Green',0,3.87,0,.47,.42,10,r2=.015)
 rod('Metal',(0,4.08,0),(0,4.28,0),.017,n=5)
def park():
 box('Grass',(0,.045,0),(1.94,.09,1.94));box('Path',(.16,.094,0),(.38,.016,1.94));box('Path',(-.35,.094,.48),(1.1,.016,.34))
 for x,z,s in [(-.43,-.35,.8),(.5,.51,.6)]:
  rod('WoodDark',(x,.09,z),(x+.03,1.08*s,z),.075*s,.045*s,7)
  for dx,dz in [(-.28,.02),(.25,.12),(.05,-.24)]:
   rod('WoodDark',(x,.65*s,z),(x+dx*s,1.23*s,z+dz*s),.033*s,.017*s,6)
  for dx,dy,dz,col in [(-.25,1.3,.02,'Pink'),(.22,1.4,.12,'PinkLight'),(.04,1.52,-.22,'Pink'),(0,1.7,0,'PinkLight')]:
   leaf(col,(x+dx*s,dy*s,z+dz*s),(.4*s,.33*s,.37*s))
 for z in [.6,.72,.84]:box('Wood',(-.54,.34,z),(.59,.045,.08))
 for x in [-.77,-.31]:
  rod('Metal',(x,.1,.63),(x,.35,.63),.022,n=4);rod('Metal',(x,.1,.82),(x,.62,.82),.022,n=4)
 for y in [.47,.58]:box('Wood',(-.54,y,.83),(.62,.07,.04))
 rod('Metal',(.68,.09,-.67),(.68,1.4,-.67),.028,n=7)
 box('Metal',(.68,1.42,-.67),(.21,.045,.21));box('Lamp',(.68,1.55,-.67),(.15,.22,.15));roof('Green',.68,1.68,-.67,.27,.27,.12)

def export_model(name,fn):
 global geo; geo={}; bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 fn(); obs=[]
 for mat,(vs,fs) in geo.items():
  me=bpy.data.meshes.new(mat);me.from_pydata(vs,[],fs);me.update()
  ob=bpy.data.objects.new(mat,me);bpy.context.collection.objects.link(ob);me.materials.append(MATS[mat]);obs.append(ob)
  # Recalculate outward normals consistently per disconnected closed component.
  bpy.context.view_layer.objects.active=ob;ob.select_set(True)
  bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT');ob.select_set(False)
 for ob in obs: ob.select_set(True)
 path=os.path.join(OUT,name+'.glb')
 bpy.ops.export_scene.gltf(filepath=path,export_format='GLB',use_selection=True,export_yup=True,export_animations=False,export_cameras=False,export_lights=False,export_texcoords=False,export_normals=True,export_materials='EXPORT',export_extras=False)
 pts=[Vector(v) for vs,fs in geo.values() for v in vs];lo=Vector(tuple(min(p[k] for p in pts) for k in range(3)));hi=Vector(tuple(max(p[k] for p in pts) for k in range(3)))
 tris=sum(len(f)-2 for vs,fs in geo.values() for f in fs)
 dims=hi-lo
 record={'file':name+'.glb','dimensions_xyz_m':[round(dims.x,3),round(dims.z,3),round(dims.y,3)],'triangles':tris,'meshes':len(obs),'materials':list(geo),'bytes':os.path.getsize(path)}
 # Studio preview only: camera/lights are added AFTER exporting GLB.
 sc=bpy.context.scene;sc.render.engine='BLENDER_WORKBENCH';sc.render.resolution_x=600;sc.render.resolution_y=600;sc.render.resolution_percentage=100
 sh=sc.display.shading;sh.light='STUDIO';sh.studiolight_rotate_z=.4;sh.color_type='MATERIAL';sh.show_shadows=True;sh.show_cavity=True;sh.cavity_type='BOTH';sh.curvature_ridge_factor=1.3;sh.curvature_valley_factor=1.0;sh.show_specular_highlight=True
 sh.background_type='WORLD';sc.world.color=(.78,.81,.79);sc.render.image_settings.file_format='PNG';sc.view_settings.view_transform='Standard'
 center=(lo+hi)/2;camdata=bpy.data.cameras.new('Preview');cam=bpy.data.objects.new('Preview',camdata);bpy.context.collection.objects.link(cam)
 cam.location=center+Vector((4,-6,4.3));cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();camdata.type='ORTHO';camdata.ortho_scale=max(dims)*1.65;sc.camera=cam
 sc.render.filepath=os.path.join(OUT,'previews',name+'.png');bpy.ops.render.render(write_still=True)
 print('MODEL_RESULT '+json.dumps(record),flush=True);return record

tasks=[('fishing-boat-small',smallboat),('house-a',lambda:house(False)),('house-b',lambda:house(True)),('fish-market',market),('lumber-camp',lumber),('warehouse',warehouse),('pier',pier),('fish-farm',farm),('lighthouse',lighthouse),('cherry-park',park)]
results=[export_model(n,fn) for n,fn in tasks]
with open(os.path.join(OUT,'manifest.json'),'w',encoding='utf-8') as f:json.dump(results,f,ensure_ascii=False,indent=2)
