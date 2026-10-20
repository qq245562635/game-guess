"use strict";
// ================= 声音：音乐和音效全部用 WebAudio 现场合成，不需要任何音频文件。
// 想换成正式音频：把文件放进 assets/audio/<key>.mp3（或 .ogg / .wav），并在 assets/audio/index.json 写 key 数组，
// 例如 ["bgm_office","sfx_coin"]。启动后自动加载，同名 key 优先用文件，缺的继续用合成版。key 一览见 AUDIO.md。
// 浏览器要求用户先点一下页面才能出声：第一次触屏 / 点击时自动打开音频。
const SND=(()=>{
  const PK='kaifa_wuyu_audio',MUS_VOL=.42,SFX_VOL=.9;
  const pref={mus:true,sfx:true};try{Object.assign(pref,JSON.parse(localStorage.getItem(PK)||'{}'));}catch(e){}
  const savePref=()=>{try{localStorage.setItem(PK,JSON.stringify(pref));}catch(e){}};
  let ctx=null,out,MUS,SFX,noiseBuf=null,cur=null,want='office';const FILES={},lastAt={};
  const mtof=m=>440*Math.pow(2,(m-69)/12);
  const r=(a,b)=>a+Math.random()*(b-a);
  const NN={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
  const nn=s=>{const m=/^([A-G])(b|#)?(\d)$/.exec(s);return 12*(+m[3]+1)+NN[m[1]]+(m[2]==='b'?-1:m[2]==='#'?1:0);};

  // ---- 初始化（第一次用户操作时）
  function makeIR(sec,decay){const n=Math.floor(ctx.sampleRate*sec),b=ctx.createBuffer(2,n,ctx.sampleRate);
    for(let c=0;c<2;c++){const d=b.getChannelData(c);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/n,decay);}return b;}
  // 一条总线：干声 g + 混响送 rv（混响出来也回到 g，静音时一起静）
  function mkBus(vol,dest,revAmt){const g=ctx.createGain();g.gain.value=vol;g.connect(dest);
    const rv=ctx.createGain();rv.gain.value=1;const cv=ctx.createConvolver();cv.buffer=makeIR(1.8,3);const wet=ctx.createGain();wet.gain.value=revAmt;
    rv.connect(cv);cv.connect(wet);wet.connect(g);return {g,rv};}
  function init(){if(ctx)return true;const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return false;
    try{ctx=new AC();}catch(e){return false;}
    const comp=ctx.createDynamicsCompressor();comp.threshold.value=-16;comp.knee.value=12;comp.ratio.value=4;comp.attack.value=.004;comp.release.value=.2;comp.connect(ctx.destination);
    out=ctx.createGain();out.gain.value=1;out.connect(comp);
    MUS=mkBus(pref.mus?MUS_VOL:0,out,.5);SFX=mkBus(pref.sfx?SFX_VOL:0,out,.6);
    noiseBuf=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    loadFiles();setInterval(tickMusic,25);return true;}
  function loadFiles(){fetch('assets/audio/index.json').then(x=>x.ok?x.json():[]).catch(()=>[]).then(keys=>{if(!Array.isArray(keys))return;
    for(const k of keys){const tryExt=exts=>{if(!exts.length)return;fetch(`assets/audio/${k}.${exts[0]}`).then(x=>{if(!x.ok)throw 0;return x.arrayBuffer();})
      .then(ab=>new Promise((ok,no)=>ctx.decodeAudioData(ab,ok,no))).then(buf=>{FILES[k]=buf;if(k.startsWith('bgm_')&&cur&&cur.name===k.slice(4))restartMusic();}).catch(()=>tryExt(exts.slice(1)));};
      tryExt(['mp3','ogg','wav']);}});}
  const unlock=()=>{if(!init())return;if(ctx.state!=='running')ctx.resume();};
  for(const ev of ['pointerdown','touchend','keydown'])addEventListener(ev,unlock,true);
  document.addEventListener('visibilitychange',()=>{if(!ctx)return;if(document.hidden)ctx.suspend();else ctx.resume();});
  const live=()=>ctx&&ctx.state==='running';

  // ---- 基础发声
  function route(node,bus,rev,pan){let n=node;if(pan&&ctx.createStereoPanner){const p=ctx.createStereoPanner();p.pan.value=pan;n.connect(p);n=p;}
    n.connect(bus.g);if(rev){const s=ctx.createGain();s.gain.value=rev;n.connect(s);s.connect(bus.rv);}}
  function env(g,t,a,vol,dur,rel=.05){g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+a);g.gain.setTargetAtTime(0,t+a+dur,rel);}
  function tone(t,f,o={}){const {type='sine',dur=.12,vol=.2,a=.004,f1=0,bus=SFX,rev=0,pan=0}=o;
    const os=ctx.createOscillator();os.type=type;os.frequency.setValueAtTime(f,t);if(f1)os.frequency.exponentialRampToValueAtTime(f1,t+dur);
    const g=ctx.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+a);g.gain.exponentialRampToValueAtTime(.0001,t+a+dur);
    os.connect(g);route(g,bus,rev,pan);os.start(t);os.stop(t+a+dur+.05);}
  function noise(t,o={}){const {dur=.08,vol=.15,type='bandpass',freq=2000,f1=0,q=1,a=.002,bus=SFX,rev=0,pan=0}=o;
    const s=ctx.createBufferSource();s.buffer=noiseBuf;s.loop=true;const fl=ctx.createBiquadFilter();fl.type=type;fl.frequency.setValueAtTime(freq,t);if(f1)fl.frequency.exponentialRampToValueAtTime(f1,t+dur);fl.Q.value=q;
    const g=ctx.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+a);g.gain.exponentialRampToValueAtTime(.0001,t+a+dur);
    s.connect(fl);fl.connect(g);route(g,bus,rev,pan);s.start(t,Math.random()*.5);s.stop(t+a+dur+.05);}
  // 钟琴：正弦 + 高次泛音，敲击感
  function bell(t,m,o={}){const {vol=.12,dur=.6,bus=SFX,rev=.35,pan=0}=o;const f=mtof(m);
    tone(t,f,{vol,dur,bus,rev,pan,a:.002});tone(t,f*2.76,{vol:vol*.25,dur:dur*.35,bus,rev,pan,a:.001});tone(t,f*5.4,{vol:vol*.08,dur:dur*.15,bus,rev,pan,a:.001});}
  // 铜管：锯齿波 + 低通开合
  function brass(t,m,dur,vol,bus=SFX,rev=.3){const f=mtof(m);const g=ctx.createGain();env(g,t,.03,vol,dur,.08);
    const fl=ctx.createBiquadFilter();fl.type='lowpass';fl.Q.value=1;fl.frequency.setValueAtTime(600,t);fl.frequency.linearRampToValueAtTime(2600,t+.05);fl.frequency.setTargetAtTime(1300,t+.08,.15);
    for(const dt of [-6,6]){const o=ctx.createOscillator();o.type='sawtooth';o.frequency.value=f;o.detune.value=dt;o.connect(fl);o.start(t);o.stop(t+dur+.6);}
    fl.connect(g);route(g,bus,rev);}
  // 电钢琴：FM（调制比 1，调制量快速衰减）+ 高八度亮音
  function epiano(t,m,dur,vol,bus,pan=0){const f=mtof(m);
    const c=ctx.createOscillator();c.frequency.value=f;const mo=ctx.createOscillator();mo.frequency.value=f;
    const mg=ctx.createGain();mg.gain.setValueAtTime(f*1.4,t);mg.gain.exponentialRampToValueAtTime(f*.1,t+.5);mo.connect(mg);mg.connect(c.frequency);
    const g=ctx.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.006);g.gain.exponentialRampToValueAtTime(vol*.4,t+.3);g.gain.setTargetAtTime(0,t+dur,.09);
    c.connect(g);route(g,bus,.25,pan);c.start(t);mo.start(t);c.stop(t+dur+.6);mo.stop(t+dur+.6);
    tone(t,f*2,{vol:vol*.18,dur:.25,bus,pan});}
  function bass(t,m,dur,vol,bus){const f=mtof(m);const g=ctx.createGain();env(g,t,.008,vol,dur*.8,.06);
    const fl=ctx.createBiquadFilter();fl.type='lowpass';fl.frequency.setValueAtTime(1400,t);fl.frequency.setTargetAtTime(500,t,.08);
    const o1=ctx.createOscillator();o1.type='triangle';o1.frequency.value=f;const o2=ctx.createOscillator();o2.type='sawtooth';o2.frequency.value=f;
    const g2=ctx.createGain();g2.gain.value=.25;o1.connect(fl);o2.connect(g2);g2.connect(fl);fl.connect(g);route(g,bus,0);
    for(const o of [o1,o2]){o.start(t);o.stop(t+dur+.4);}}
  // 旋律：颤音琴（正弦 + 弱三角泛音 + 轻微颤音）
  function vibes(t,m,dur,vol,bus){const f=mtof(m);const g=ctx.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.008);
    g.gain.exponentialRampToValueAtTime(vol*.5,t+.25);g.gain.setTargetAtTime(0,t+dur,.12);
    const trem=ctx.createOscillator();trem.frequency.value=5.2;const tg=ctx.createGain();tg.gain.value=vol*.12;trem.connect(tg);tg.connect(g.gain);
    const o1=ctx.createOscillator();o1.frequency.value=f;const o2=ctx.createOscillator();o2.type='triangle';o2.frequency.value=f*4;const g2=ctx.createGain();g2.gain.value=.04;
    o1.connect(g);o2.connect(g2);g2.connect(g);route(g,bus,.4,.15);for(const o of [o1,o2,trem]){o.start(t);o.stop(t+dur+.8);}}
  function kick(t,vol,bus){const o=ctx.createOscillator();o.frequency.setValueAtTime(150,t);o.frequency.exponentialRampToValueAtTime(45,t+.12);
    const g=ctx.createGain();g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0001,t+.3);o.connect(g);route(g,bus,0);o.start(t);o.stop(t+.35);}
  const hat=(t,vol,bus,open)=>noise(t,{type:'highpass',freq:7000,dur:open?.18:.03,vol,bus,pan:.25});
  const rim=(t,vol,bus)=>{noise(t,{freq:1900,q:3,dur:.04,vol,bus,rev:.2,pan:-.1});tone(t,820,{type:'triangle',dur:.03,vol:vol*.6,bus});};
  const clap=(t,vol,bus)=>{for(const d of [0,.012,.024])noise(t+d,{freq:1300,q:1.2,dur:d===.024?.12:.015,vol,bus,rev:.25});};
  const shaker=(t,vol,bus)=>noise(t,{freq:6000,q:1.5,dur:.05,vol,bus,a:.015,pan:-.3});

  // ---- 音乐：8 小节循环，每小节 8 个八分音符。旋律记谱：音名 / -（延长）/ .（休止）
  const mel=bars=>{const out=[];bars.forEach((bar,bi)=>{bar.split(' ').forEach((tk,si)=>{const st=bi*8+si;
    if(tk==='-'){if(out.length&&out[out.length-1].end===st)out[out.length-1].end++;}else if(tk!=='.')out.push({st,m:nn(tk),end:st+1});});});
    const m={};for(const n of out)m[n.st]=n;return m;};
  const TRACKS={
    // 平时：轻快的 bossa / lo-fi，F 大调
    office:{bpm:94,swing:.16,
      bass:['F2','A2','Bb2','C3','F2','D2','G2','C3'].map(nn),
      chords:[[53,57,60,64],[57,60,64,67],[53,57,62],[55,58,64],[53,57,60,64],[57,60,62,65],[53,58,62],[52,58,62]],
      mel:mel(['A4 . C5 . E5 - - .','D5 . C5 A4 - - G4 .','F4 . A4 . D5 - C5 .','Bb4 - A4 - G4 - - -',
               'A4 . C5 . F5 - E5 .','D5 - C5 . A4 . F4 .','G4 . Bb4 . D5 - C5 Bb4','A4 - - - G4 - - .']),
      step(t,i,bar,s,L,P){const B=P.bus,sd=P.sd;
        if(s===0)kick(t,.5,B);if(s===5)kick(t,.28,B);if(s===2||s===6)rim(t,.13,B);
        hat(t,s%2?.035:.05,B);if(s%2)shaker(t,.03,B);
        const root=L.bass[bar];if(s===0)bass(t,root,sd*2.6,.32,B);if(s===3)bass(t,root+7,sd*.9,.24,B);if(s===4)bass(t,root,sd*2.6,.28,B);if(s===7)bass(t,root+7,sd*.8,.2,B);
        if(s===0||s===3||s===6)for(const m of L.chords[bar])epiano(t+r(0,.012),m,sd*(s===0?2.6:1.6),s===0?.055:.04,B,r(-.3,.3));
        P.lead(t,i,.075);}},
    // 开发中：更有干劲的 pop，C 大调
    dev:{bpm:118,swing:0,
      bass:['C3','A2','F2','G2','C3','A2','F2','G2'].map(nn),
      chords:[[52,55,60],[52,57,60],[53,57,60],[50,55,59],[52,55,60],[52,57,60],[53,57,60,64],[53,55,59,62]],
      mel:mel(['E5 . G5 . E5 D5 C5 .','A4 . C5 . E5 - - .','F5 . E5 . D5 . C5 .','D5 - - . B4 . G4 .',
               'E5 . G5 . A5 G5 E5 .','C5 . E5 . A5 - G5 .','F5 E5 D5 . C5 . A4 .','B4 - - . D5 - - .']),
      step(t,i,bar,s,L,P){const B=P.bus,sd=P.sd;
        if(s===0||s===4)kick(t,.55,B);if(bar%2&&s===7)kick(t,.3,B);if(s===2||s===6)clap(t,.11,B);
        hat(t,s%2?.045:.03,B,s===7&&bar%4===3);
        const root=L.bass[bar];bass(t,s===3||s===7?root+12:root,sd*.85,s%2?.2:.27,B);
        if(s%2)for(const m of L.chords[bar])epiano(t+r(0,.008),m,sd*.6,.04,B,r(-.3,.3));
        if(s===0)for(const m of L.chords[bar])epiano(t,m+12,sd*3,.018,B,r(-.4,.4));
        P.lead(t,i,.07);}},
  };
  function startMusic(name){const L=TRACKS[name];if(!L)return null;const t0=ctx.currentTime+.08;
    const g=ctx.createGain();g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(1,t0+.6);g.connect(MUS.g);
    const P={name,L,bus:{g,rv:MUS.rv},sd:60/L.bpm/2,i:0,next:t0,g};
    const buf=FILES['bgm_'+name];
    if(buf){const s=ctx.createBufferSource();s.buffer=buf;s.loop=true;s.connect(g);s.start(t0);P.src=s;return P;}
    // 旋律：前两遍唱，第三遍只留伴奏换口气
    P.lead=(t,i,vol)=>{const loop=Math.floor(i/64)%3;if(loop===2)return;const n=L.mel[i%64];if(n)vibes(t,n.m,(n.end-n.st)*P.sd*.95,vol,P.bus);};
    return P;}
  function stopMusic(P){if(!P)return;const t=ctx.currentTime;P.g.gain.cancelScheduledValues(t);P.g.gain.setValueAtTime(P.g.gain.value,t);P.g.gain.linearRampToValueAtTime(0,t+.8);
    P.dead=true;if(P.src)P.src.stop(t+.9);setTimeout(()=>P.g.disconnect(),1500);}
  function restartMusic(){if(cur){stopMusic(cur);cur=null;}}
  function tickMusic(){if(!live())return;
    if(cur&&(cur.name!==want||!pref.mus)){stopMusic(cur);cur=null;}
    if(!cur&&want&&pref.mus)cur=startMusic(want);
    if(!cur||cur.src)return;
    while(cur.next<ctx.currentTime+.15){const P=cur,i=P.i,s=i%8,bar=Math.floor(i/8)%8;const t=P.next+(s%2?P.L.swing*P.sd:0);
      P.L.step(t,i,bar,s,P.L,P);P.i++;P.next+=P.sd;}}
  // 播放大段音效时把音乐压低一会儿
  function duck(sec){if(!MUS||!pref.mus)return;const t=ctx.currentTime,g=MUS.g.gain;g.cancelScheduledValues(t);g.setValueAtTime(g.value,t);
    g.linearRampToValueAtTime(MUS_VOL*.3,t+.05);g.setValueAtTime(MUS_VOL*.3,t+sec);g.linearRampToValueAtTime(MUS_VOL,t+sec+.6);}

  // ---- 音效。key = 文件名去掉 sfx_ 前缀
  const STAT_NOTE={fun:79,creat:83,gfx:86,snd:88};
  const FX={
    tap:t=>{tone(t,1050,{f1:700,dur:.04,vol:.09});noise(t,{type:'highpass',freq:5000,dur:.012,vol:.03});},
    talk:t=>{const f=r(560,640);tone(t,f,{f1:f*1.5,dur:.06,vol:.1});tone(t+.05,f*1.25,{f1:f*1.6,dur:.05,vol:.06});},
    pop:(t,k)=>{const m=STAT_NOTE[k]||84;tone(t,mtof(m),{f1:mtof(m)*1.3,dur:.07,vol:.07,rev:.2,pan:r(-.4,.4)});bell(t+.02,m+12,{vol:.03,dur:.2,rev:.3});},
    bug:t=>{tone(t,330,{type:'triangle',f1:150,dur:.2,vol:.12});tone(t+.09,260,{type:'triangle',f1:110,dur:.22,vol:.09});},
    tick:(t,n)=>tone(t,mtof(84+((n||0)%12)),{type:'triangle',dur:.03,vol:.05}),
    type:t=>{noise(t,{freq:r(2400,4200),q:4,dur:.02,vol:.05,pan:r(-.2,.2)});tone(t,r(180,240),{dur:.02,vol:.03});},
    coin:t=>{tone(t,1976,{type:'triangle',dur:.07,vol:.09});tone(t+.07,2637,{type:'triangle',dur:.4,vol:.09,rev:.3});bell(t+.07,100,{vol:.03,dur:.3});},
    save:t=>{[84,88,91].forEach((m,j)=>bell(t+j*.07,m,{vol:.08,dur:.5}));},
    deny:t=>{tone(t,233,{type:'triangle',dur:.16,vol:.14});tone(t,220,{type:'triangle',dur:.16,vol:.14});tone(t+.19,220,{type:'triangle',dur:.2,vol:.12});},
    roll:t=>tone(t,r(1500,1800),{type:'triangle',dur:.022,vol:.035}),
    land:(t,tier)=>{if(tier==='hi'){bell(t,88,{vol:.12});bell(t,95,{vol:.06});}else if(tier==='lo')tone(t,196,{type:'triangle',f1:150,dur:.25,vol:.15});else bell(t,84,{vol:.1,dur:.4});},
    plus:t=>bell(t,88+Math.floor(r(0,5)),{vol:.06,dur:.3}),
    good:t=>{duck(1);[76,79,84].forEach((m,j)=>bell(t+j*.1,m,{vol:.1,dur:.7}));},
    bad:t=>{duck(1.6);[[62,.22],[61,.22],[60,.22],[59,.8]].reduce((tt,[m,d])=>{const g=ctx.createGain();env(g,tt,.02,.12,d,.1);
      const o=ctx.createOscillator();o.type='triangle';o.frequency.value=mtof(m);const lf=ctx.createOscillator();lf.frequency.value=6;const lg=ctx.createGain();lg.gain.value=d>.5?6:0;
      lf.connect(lg);lg.connect(o.frequency);o.connect(g);route(g,SFX,.2);o.start(tt);lf.start(tt);o.stop(tt+d+.5);lf.stop(tt+d+.5);return tt+d+.03;},t);},
    levelup:t=>{duck(1);[72,76,79,84,88].forEach((m,j)=>bell(t+j*.065,m,{vol:.09,dur:.6}));},
    unlock:t=>{duck(1);for(let j=0;j<6;j++)bell(t+j*.06+r(0,.02),pick([88,91,93,96,100]),{vol:.06,dur:.5,pan:r(-.5,.5)});},
    start:t=>{duck(1.2);brass(t,67,.12,.07);brass(t+.14,72,.5,.08);brass(t+.14,76,.5,.05);},
    complete:t=>{duck(1.6);brass(t,72,.1,.07);brass(t+.12,76,.1,.07);brass(t+.24,79,.7,.08);brass(t+.24,84,.7,.05);bell(t+.24,96,{vol:.05});},
    fanfare:t=>{duck(2.6);const seq=[[67,0,.1],[72,.12,.1],[76,.24,.1],[79,.36,.22],[76,.6,.1],[79,.72,1.1]];
      for(const [m,d,l] of seq)brass(t+d,m,l,.075);for(const m of [72,76,84])brass(t+.72,m,1.1,.04);
      for(let j=0;j<5;j++)bell(t+.72+j*.08,pick([91,96,100]),{vol:.04,dur:.6,pan:r(-.5,.5)});noise(t+.7,{type:'highpass',freq:6000,dur:1.2,vol:.04,a:.05,rev:.4});},
    promo:t=>{duck(1.2);noise(t,{freq:500,f1:4000,q:1.5,dur:.4,vol:.12,a:.15,rev:.3});[79,84,88].forEach((m,j)=>bell(t+.35+j*.06,m,{vol:.09}));},
  };
  const GAP={pop:.07,tick:.03,type:.05,roll:.02,coin:.1,talk:.05,tap:.03};
  const pick=a=>a[Math.floor(Math.random()*a.length)];
  function sfx(k,arg){if(!pref.sfx||!live())return;const now=ctx.currentTime;if(GAP[k]&&now-(lastAt[k]||-9)<GAP[k])return;lastAt[k]=now;
    const buf=FILES['sfx_'+k];if(buf){const s=ctx.createBufferSource();s.buffer=buf;s.connect(SFX.g);s.start(now);return;}
    const f=FX[k];if(f)try{f(now+.005,arg);}catch(e){}}
  function music(name){want=name;}
  function set(k,on){pref[k]=on;savePref();if(!ctx)return;const bus=k==='mus'?MUS:SFX,v=on?(k==='mus'?MUS_VOL:SFX_VOL):0;
    bus.g.gain.cancelScheduledValues(ctx.currentTime);bus.g.gain.setTargetAtTime(v,ctx.currentTime,.05);}
  return {sfx,music,set,get:k=>pref[k]};
})();
