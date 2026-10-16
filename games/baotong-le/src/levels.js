/* 爆桶了 · 关卡表
   设计思路：前 4 关一关只教一件事；第 5 关起城区每周向外扩 2 列 3 行（开局格子大、后面看到的地图越来越大）；
   新元素按 颜色 → 河与桥 → 扩城 → 第三种颜色 → 环岛 → 大厂 → 督导员 → 红绿灯 → 第四种颜色 → 高架 的顺序逐个解锁。
   v6：河只留在第 4、12、14、15 关，每关最多一条；车多了、路口会堵，环岛和红绿灯从第 7 关起派上用场。
   字段（尺寸都按竖屏写，横屏自动转置）：
     size      最终地图 [列, 行]
     area      城区扩张：start 开局 [宽, 高]，step 每次扩 [宽, 高]，every 每几周扩一次；不写就是整张图
     colors    开局几种颜色（按 ORDER：蓝 → 绿 → 灰 → 红），addColors 第几周开始各加一种
     river     河的条数 0 / 1 / 2（两条时一横一竖交叉）
     pool      周拨款里可能出现的设施；items 开局送的设施
     circle    第几周起会出圆形大厂（0 = 不出）；insp 有没有督导员
     goal      清运目标（袋）；weeks3 三星要在第几周内完成
     cfg       覆盖 CFG 的数值（节奏）
     feat      这一关的新元素（关卡介绍里高亮）；tip 开局提示；ghost 第一关画出示范路线 */
const LEVELS=[
  {name:'第一条路',size:[7,9],colors:1,river:0,pool:[],goal:20,weeks3:3,ghost:true,
   cfg:{pinBase:6,houseEvery:18,destFirst:1e9,startRoads:30},
   feat:{icon:'road',label:'修路'},desc:'临江市第一个小区开始垃圾分类了。按住小区，拖一条路连到同色的分拣中心，清运车就会自己跑起来。',
   tip:'按住小区，沿着虚线拖到分拣中心门口'},
  {name:'两种垃圾',size:[8,10],colors:2,river:0,pool:[],goal:45,weeks3:4,
   cfg:{pinBase:7,houseEvery:15,destFirst:1e9,startRoads:34},
   feat:{icon:'kinds',label:'颜色配对'},desc:'湿垃圾也开始分出来了。蓝色小区只能送去蓝色的厂，绿色只能送去绿色的厂，别接错。',
   tip:'颜色要对上：同色小区连同色处理厂'},
  {name:'连成一片',size:[8,11],colors:2,river:0,pool:[],goal:70,weeks3:4,
   cfg:{pinBase:7,houseEvery:13,destFirst:70,destEvery:110,startRoads:34},
   feat:{icon:'combo',label:'一笔接通'},desc:'新小区总是挨着老小区盖。先修一条街把一片小区串起来，最后一笔接到厂里，一次接通 3 户以上奖励路段。',
   tip:'先串起一片小区，再一笔接到厂里'},
  {name:'过河',size:[9,12],colors:2,river:1,pool:['bridge'],items:{bridge:2},goal:85,weeks3:4,
   cfg:{destFirst:60,destEvery:100},
   feat:{icon:'bridge',label:'跨河大桥'},desc:'城里有条河。从岸边按住把路往河里拖，会自动修一座桥；桥不够了，周拨款里可以申请。',
   tip:'从岸边按住往河里拖，会自动修桥'},
  {name:'城市长大了',size:[10,14],area:{start:[7,9],step:[2,3],every:1},colors:2,river:0,pool:[],goal:120,weeks3:4,
   feat:{icon:'expand',label:'城区扩张'},desc:'每过一周，城区就往外扩一大圈，新的小区和处理厂会出现在新地块上。路网要留出往外长的余地。',
   tip:'每过一周，城区会向外扩一大圈'},
  {name:'焚烧厂',size:[10,14],area:{start:[8,10],step:[2,3],every:1},colors:2,addColors:[2],river:0,pool:[],goal:140,weeks3:4,
   feat:{icon:'c3',label:'干垃圾'},desc:'第 2 周起，干垃圾也要分出来，会出现灰色的焚烧厂和灰色小区。三种颜色的路要尽量分开走。',
   tip:'第 2 周会出现灰色的干垃圾'},
  {name:'环岛',size:[11,15],area:{start:[8,10],step:[2,3],every:1},colors:2,addColors:[2],river:0,pool:['ra'],items:{ra:2},goal:190,weeks3:5,
   feat:{icon:'ra',label:'环岛'},desc:'普通路口一次只能过一辆车，车一多就排长队（车尾亮红灯）。在路口放个环岛，能同时过 3 辆、几乎不减速。',
   tip:'哪个路口堵了，就在那里放环岛'},
  {name:'大厂来了',size:[11,15],area:{start:[9,11],step:[2,3],every:1},colors:3,river:0,circle:2,pool:['ra'],items:{ra:2},goal:210,weeks3:5,
   feat:{icon:'circle',label:'圆形大厂'},desc:'圆形的大厂门口能多堆几袋才开始投诉，但它往往开在远处，路要修得更长，车也更容易堵。',
   tip:'圆形大厂能多堆几袋'},
  {name:'突击检查',size:[12,16],area:{start:[9,11],step:[2,3],every:1},colors:3,river:0,circle:3,insp:true,pool:['ra'],items:{ra:2},goal:230,weeks3:5,
   feat:{icon:'insp',label:'督导员'},desc:'督导员会不定期突击检查一座处理厂，90 秒内清运够袋数就有奖励，不合格会被追加垃圾。',
   tip:'督导员来时，优先保那座厂'},
  {name:'红绿灯',size:[12,17],area:{start:[9,12],step:[2,3],every:1},colors:3,river:0,circle:3,insp:true,pool:['ra','light'],items:{ra:1,light:2},goal:250,weeks3:5,
   feat:{icon:'light',label:'红绿灯'},desc:'红绿灯让横竖两个方向交替放行，同时能过 2 辆车，十字路口不会再挤成一团。比环岛好拿，但车要等灯。',
   tip:'点底部「红绿灯」，再点一个十字路口'},
  {name:'有害垃圾',size:[13,18],area:{start:[9,12],step:[2,3],every:1},colors:2,addColors:[2,3],river:0,circle:3,insp:true,pool:['ra','light'],items:{ra:1,light:1},goal:270,weeks3:5,
   feat:{icon:'c1',label:'有害垃圾'},desc:'四种垃圾到齐了：第 3 周起出现红色的有害垃圾处理厂。它们离得都不近，路网要提前规划。',
   tip:'第 3 周会出现红色的有害垃圾'},
  {name:'跨河高架',size:[13,19],area:{start:[10,13],step:[2,3],every:1},colors:3,addColors:[3],river:1,circle:3,insp:true,pool:['bridge','ra','light','mw'],items:{bridge:2,mw:1},goal:300,weeks3:5,
   feat:{icon:'mw',label:'转运高架'},desc:'河把城市切成两半。转运高架可以把任意两个路点直接连起来，不管中间隔着什么，还能绕开拥堵的路口。',
   tip:'点底部「高架」，依次点两个路点'},
  {name:'早高峰',size:[14,20],area:{start:[10,13],step:[2,3],every:1},colors:3,addColors:[2],river:0,circle:2,insp:true,pool:['ra','light','mw'],items:{ra:2},goal:330,weeks3:5,
   cfg:{pinBase:5,houseEvery:11.5},
   feat:{icon:'fast',label:'节奏更快'},desc:'早高峰来了，小区冒得更快，垃圾也出得更快，路口会更堵。所有设施都可能出现在拨款里。',
   tip:'节奏变快了，堵的路口赶紧处理'},
  {name:'全城清运',size:[14,21],area:{start:[9,12],step:[2,3],every:1},colors:2,addColors:[2,3],river:1,circle:2,insp:true,pool:['bridge','ra','light','mw'],items:{bridge:2,ra:1},goal:380,weeks3:6,
   cfg:{pinBase:5,houseEvery:11},
   feat:{icon:'expand',label:'大地图'},desc:'整座临江城都交给你了：四种垃圾、一条大河，城区一路扩到最大。',
   tip:'城区会一直扩到最大'},
  {name:'临江大考',size:[15,22],area:{start:[10,13],step:[2,3],every:1},colors:3,addColors:[2],river:1,circle:2,insp:true,pool:['bridge','ra','light','mw'],items:{bridge:2,ra:2},goal:420,weeks3:6,
   cfg:{pinBase:4.6,houseEvery:10.5,destEvery:85},
   feat:{icon:'fast',label:'最终关'},desc:'市里的年终考核。最大的地图、最快的节奏，撑过去就是临江最强的环卫调度员。',
   tip:'最终关，祝你好运'},
];
