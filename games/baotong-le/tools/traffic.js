// 车流统计：机器人连路跑若干局，看路上平均有几辆车、有多少时间在排队（v=0 等前车 / 等路口）。
// 用法：node tools/traffic.js [局数=6] [第几关(0=无尽)] [环岛=0/1：机器人是否在路口放环岛]
Object.assign(global,{T:4,N:+process.argv[2]||6,LV:+process.argv[3]||0,RA:+process.argv[4]||0});
require('./stub')(require('./botlib')+`
let moving=0,stopped=0,samples=0,score=0,weeks=0,wins=0,overs=0,maxOut=0,jams=0;
for(let g=0;g<N;g++){
  newGame(LV?LV-1:undefined);seedRng(1234+g*77);let think=0,lastPos=new Map();
  while(!G.over&&G.week<=(LV?20:8)){
    update(1/30);
    if(G.modal){chooseWeek(G.weekOpts.find(o=>o.item==='ra')||G.weekOpts.find(o=>!o.item)||G.weekOpts[0]);continue}
    think-=1/30;if(think<=0){think=0.5;
      const ds=G.dests.filter(d=>!servedDest(d)).sort((a,b)=>b.pins-a.pins);let done=false;
      for(const d of ds)if(connectDest(d)){done=true;break}
      if(!done)for(const h of G.houses)if(G.adj.get(h.idx).size===0&&connectHouse(h)){done=true;break}
      if(done)think=T||4;
      if(RA&&G.items.ra>0){let best=-1,bd=0;for(const[i,n]of G.nodes){if(n.kind!=='road'||n.ra||n.water)continue;const d=deg(i);if(d>=3&&d>bd){bd=d;best=i}}if(best>=0){G.nodes.get(best).ra=true;G.items.ra--;markDirty()}}}
    if(G.t>2*K.weekLen&&Math.round(G.t*30)%15===0){samples++;let out=0;
      for(const c of G.cars){if(c.state!=='out'&&c.state!=='back')continue;out++;const k=c.px+','+c.py;if(lastPos.get(c)===k)stopped++;else moving++;lastPos.set(c,k)}
      maxOut=Math.max(maxOut,out)}
  }
  score+=G.score;weeks+=G.week;if(G.won)wins++;if(G.over&&!G.won)overs++;
}
const tot=moving+stopped;
console.log(\`\${LV?'第'+LV+'关':'无尽'} \${N}局\${RA?' 机器人放环岛':''}：路上平均 \${(tot/samples).toFixed(1)} 辆车（峰值 \${maxOut}），停着排队的占 \${(100*stopped/Math.max(1,tot)).toFixed(0)}%，平均清运 \${(score/N).toFixed(0)} 袋 / \${(weeks/N).toFixed(1)} 周，通关 \${wins}，投诉爆表 \${overs}\`);
`,400,800);
