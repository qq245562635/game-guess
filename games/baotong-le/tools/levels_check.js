// 关卡校准：每关用机器人跑若干局，看通关率、通关用了几周、星数分布。
// 机器人每 T 秒只能接一个小区（T 越大越像新手），不放环岛 / 红绿灯 / 高架。
// 用法：node tools/levels_check.js [局数=12] [T=6] [只跑第几关(1起)，0=全部] [RA=1：机器人会在最堵的路口放环岛 / 红绿灯]
Object.assign(global,{N:+process.argv[2]||12,T:+process.argv[3]||6,ONLY:+process.argv[4]||0,RA:+process.argv[5]||0});
require('./stub')(require('./botlib')+`
const out=[];
for(let li=0;li<LEVELS.length;li++){
  if(ONLY&&li!==ONLY-1)continue;
  const lv=LEVELS[li],res=[];
  for(let g=0;g<N;g++){
    newGame(li);
    // 关卡用固定种子，这里换种子让每局地图不同，测的是这一关的平均难度
    seedRng(li*7919+1013+g*101);
    let think=0;
    while(!G.over&&G.week<=20){
      update(1/30);
      if(G.modal){chooseWeek((RA&&G.weekOpts.find(o=>o.item==='ra'||o.item==='light'))||G.weekOpts.find(o=>!o.item)||G.weekOpts[0]);continue}
      think-=1/30;if(think<=0){think=0.5;
        const ds=G.dests.filter(d=>!servedDest(d)).sort((a,b)=>b.pins-a.pins);let done=false;
        for(const d of ds)if(connectDest(d)){done=true;break}
        if(!done)for(const h of G.houses)if(G.adj.get(h.idx).size===0&&connectHouse(h)){done=true;break}
        if(done)think=T;
        // 放设施：挑排队最长（等待车最多）的路口
        if(RA)for(const k of['ra','light'])if(G.items[k]>0){const w=new Map();for(const c of G.cars)if(c.halt>0.5&&c.path){const b=c.path[c.i+1];const n=G.nodes.get(b);if(n&&n.kind==='road'&&!n.ra&&!n.light&&!n.water&&deg(b)>=3)w.set(b,(w.get(b)||0)+1)}
          let best=-1,bw=1;for(const[i,v]of w)if(v>bw){bw=v;best=i}if(best>=0){G.nodes.get(best)[k]=true;G.items[k]--;markDirty()}}}
    }
    res.push({won:G.won,week:G.week,t:G.t,score:G.score,timer:G.everTimer,area:(G.area.x1-G.area.x0)+'x'+(G.area.y1-G.area.y0)});
  }
  const w=res.filter(r=>r.won),wk=w.map(r=>r.week).sort((a,b)=>a-b),med=wk.length?wk[wk.length>>1]:'-';
  const s3=w.filter(r=>r.week<=lv.weeks3).length,s2=w.filter(r=>!r.timer).length;
  out.push(\`\${String(li+1).padStart(2)} \${lv.name.padEnd(6,'　')} 目标\${String(lv.goal).padStart(3)}  通关 \${String(w.length).padStart(2)}/\${N}  通关周数 \${wk.length?wk[0]+'~'+wk[wk.length-1]:'-'}（中位 \${med}，三星线 \${lv.weeks3}）  无投诉 \${s2}/\${w.length}  三星周 \${s3}/\${w.length}  失败时 \${res.filter(r=>!r.won).map(r=>r.score+'袋@'+r.week+'周').join(' ')||'-'}  最终城区 \${res[0].area}\`);
}
console.log(out.join('\\n'));
`,400,800);
