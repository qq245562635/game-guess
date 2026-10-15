// 无头模拟：node tools/sim.js
// 1 产线：采矿机 → 传送带 → 分拣器 → 熔炉 → 分拣器 → 储物箱，电力不足时同比降速
// 2 无人机按蓝图施工、拆除返还
// 3 手搓自动补中间件
// 4 科研：手动科技 + 科研站矩阵科技
// 5 存档往返 + 离线结算
// 6 性能：1 万个物品在带上跑，单 tick 耗时
require('./stub')(`
let fails=0;const ok=(c,msg)=>{console.log((c?'  ok  ':'  FAIL ')+msg);if(!c)fails++};
const run=s=>{for(let k=0;k<Math.round(s*15);k++)tick()};
/* 找一块 2×2 全是某种矿的位置（离出生点最近） */
function spot(type){const t=ORE_TYPES.indexOf(type);let best=null,bd=1e9;
  for(let y=100;y<156;y++)for(let x=100;x<156;x++){let n=0;for(const i of tilesOf(x,y,2))if(G.ore[i]===t)n++;
    if(n===4){const d=Math.hypot(x-128,y-128);if(d<bd){bd=d;best=[x,y]}}}return best}
function free(x,y,w,h){for(let j=0;j<h;j++)for(let i=0;i<w;i++){if(!inB(x+i,y+j)||G.occ[idx(x+i,y+j)])return false}return true}
/* 在采矿机东边搭一条线：采矿机(朝东) → 6 格带 → 分拣器 → 熔炉 → 分拣器 → 储物箱；旁边风机 + 电线杆 */
function line(winds){
  const [mx,my]=spot('iron_ore');
  const m=addBuilding('miner',mx,my,0);
  for(let k=0;k<6;k++)addBuilding('belt',mx+2+k,my,0);
  addBuilding('sorter',mx+8,my,0);
  /* 熔炉占 mx+9..10, my..my+1，矿要清掉不然没关系（建筑可以盖在矿上） */
  const s=addBuilding('smelter',mx+9,my,0);
  addBuilding('sorter',mx+11,my,0);
  const bx=addBuilding('box',mx+12,my,0);
  for(let k=0;k<winds;k++)addBuilding('wind',mx+3+k,my+3,0);
  addBuilding('pole',mx+1,my+2,0);addBuilding('pole',mx+8,my+2,0);addBuilding('pole',mx+12,my+2,0);
  return {m,s,bx};
}

console.log('1 产线');
newGame(42);
let L=line(3);
run(120);
const plates=L.bx.inv.iron_plate||0;
ok(L.m.ore==='iron_ore'&&L.m.tiles.length===4,'采矿机盖住 4 格铁矿');
ok(G.grids.length===1&&L.s.grid===0&&L.m.grid===0,'电线杆把采矿机、熔炉、风机连成一个电网');
ok(plates>=90&&plates<=120,'120 秒进箱铁板 '+plates+'（采矿机满速 1/s，熔炉 1/s）');
{const c=G.cnt;ok(c.poweredSmelter&&c.smeltPlate>=10&&c.minerToBelt>=10&&c.sorterToMachine>=10&&c.boxIn>=20,'引导目标计数：通电 '+c.poweredSmelter+' 铁板 '+c.smeltPlate+' 出矿 '+c.minerToBelt+' 送料 '+c.sorterToMachine+' 进箱 '+c.boxIn);
 G.goal=1;for(let k=0;k<15*3;k++)tick();ok(G.goal>=2,'目标卡片随计数自动推进（到第 '+(G.goal+1)+' 个）')}
const r=rates();ok(Math.abs(r.iron_plate.p-60)<6,'产能面板：铁板 '+r.iron_plate.p.toFixed(1)+'/分');
console.log('     电网 供 '+G.grids[0].supply+' kW / 需 '+G.grids[0].lastDem.toFixed(0)+' kW，满足率 '+G.grids[0].sat.toFixed(2));

newGame(42);L=line(1);run(120);
const p1=L.bx.inv.iron_plate||0;
ok(p1<plates*0.6&&p1>plates*0.25,'只有 1 台风机时同比降速：'+p1+' 块（满足率 '+G.grids[0].sat.toFixed(2)+'）');

console.log('2 无人机');
newGame(7);
const m=G.mech;G.inv.belt=10;const X0=Math.floor(m.x),Y0=Math.floor(m.y);
const gs=[];for(let k=0;k<5;k++)gs.push(addGhost('belt',X0+3+k,Y0-4,0));
const far=addGhost('belt',X0+40,Y0,0);
run(6);
ok(gs.every(g=>!G.ghosts.has(g.id))&&beltAt(X0+3,Y0-4),'范围内 5 个蓝图 6 秒内建完');
ok(G.ghosts.has(far.id),'范围外的蓝图排队不动');
m.tx=far.x;m.ty=far.y;run(10);
ok(!G.ghosts.has(far.id),'机甲靠近后自动开工');
const bb=beltAt(X0+7,Y0-4);bb.items.push({it:'iron_ore',pos:0.2,p0:0.2});
m.tx=bb.x;m.ty=bb.y;run(4);addDelGhost(bb);run(4);
ok(!bAt(bb.x,bb.y)&&G.inv.belt===10-6+1-0&&G.inv.iron_ore===1,'拆除：带和带上的矿都回到背包（传送带 '+G.inv.belt+'）');

console.log('3 手搓');
newGame(7);G.done.add('auto_mining');G.inv={iron_plate:20,copper_plate:10};
ok(planCraft('miner',1),'背包只有铁板铜板也能排「采矿机」');
console.log('     队列：'+G.craftQ.map(j=>j.r+'×'+j.n).join(' → '));
run(20);
ok(G.inv.miner===1,'20 秒后做好 1 台采矿机，剩铁板 '+(G.inv.iron_plate||0));
G.inv={iron_ore:3};ok(!planCraft('miner',1),'材料不够时不排队');
newGame(7);G.inv={iron_plate:30,copper_plate:30,brick:10};const gw=addGhost('wind',Math.floor(G.mech.x)+2,Math.floor(G.mech.y)+2,0);G.inv.wind=0;delete G.inv.wind;
run(15);ok(!G.ghosts.has(gw.id)&&G.b.size===1,'放了风机蓝图但背包没有风机 → 自动手搓再施工');

console.log('4 科研');
newGame(7);G.inv={iron_plate:10,copper_plate:10};
ok(payTech('auto_mining')&&G.done.has('auto_mining')&&!G.inv.iron_plate,'手动科技扣背包物品');
for(const t of ['automation','em'])G.done.add(t);
const lab=addBuilding('lab',130,140,0);addBuilding('wind',132,140,0);addBuilding('wind',133,140,0);addBuilding('pole',131,142,0);
ok(startResearch('drones1'),'科研站研究「无人机扩编」');lab.in.matrix1=20;run(70);
ok(G.done.has('drones1')&&G.drones.length===6,'20 个矩阵 × 3 秒后完成，无人机 '+G.drones.length+' 架');

console.log('5 存档');
newGame(42);L=line(3);run(60);G.inv.gear=7;startResearch;const s1=serialize(1000);
const before={b:G.b.size,box:L.bx.inv.iron_plate||0,belt:G.beltOrder.reduce((a,b)=>a+b.items.length,0),ore:G.amt[L.m.tiles[0]]};
const rep=deserialize(s1,1000+3600*1000);
const box2=[...G.b.values()].find(b=>b.k==='box');
ok(G.b.size===before.b&&G.inv.gear===7,'建筑 '+G.b.size+' 栋、背包原样恢复');
ok(G.amt[[...G.b.values()].find(b=>b.k==='miner').tiles[0]]===before.ore,'矿量恢复');
ok(rep&&rep.got.iron_plate>0&&box2.inv.iron_plate===Math.min(200,before.box+rep.got.iron_plate),'离线 1 小时：储物箱 +'+(rep&&rep.got.iron_plate)+'（箱满 200 截止）');
run(5);ok(true,'加载后继续跑 5 秒没有报错');
console.log('     存档大小 '+(s1.length/1024).toFixed(1)+' KB');

console.log('6 性能');
newGame(3);
/* 40 条 120 格的直带，首尾相接成环（每条 240 格），每格放 1 个物品 → 约 1 万个物品 */
let nItems=0;
for(let k=0;k<40;k++){const y=8+k*6;
  for(let x=8;x<128;x++)addBuilding('belt',x,y,0);
  addBuilding('belt',128,y,1);addBuilding('belt',128,y+1,1);addBuilding('belt',128,y+2,2);
  for(let x=127;x>=8;x--)addBuilding('belt',x,y+2,2);
  addBuilding('belt',7,y+2,3);addBuilding('belt',7,y+1,3);addBuilding('belt',7,y,0);}
for(const b of G.b.values())if(b.k==='belt'&&b.items.length===0){b.items.push({it:'iron_ore',pos:0.3,p0:0.3});nItems++}
/* 再加 2000 台建筑（熔炉 + 分拣器，空转） */
for(let k=0;k<500;k++){const x=140+(k%25)*4,y=10+((k/25)|0)*6;addBuilding('smelter',x,y,0);addBuilding('sorter',x+2,y,0);addBuilding('sorter',x,y+2,0);addBuilding('box',x+3,y+3,0)}
run(1);
const t0=Date.now();const N=300;for(let k=0;k<N;k++)tick();const ms=(Date.now()-t0)/N;
let moved=0;for(const b of G.beltOrder)moved+=b.items.length;
ok(moved===nItems,'物品守恒：'+moved+' / '+nItems);
console.log('     '+nItems+' 个物品、'+G.b.size+' 栋建筑：单 tick '+ms.toFixed(2)+' ms（预算：中端安卓 8 ms）');

process.exitCode=fails?1:0;console.log(fails?fails+' 项失败':'全部通过');
`);
