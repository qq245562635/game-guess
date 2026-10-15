// 在 Node 里加载规则层 src/core.js：给它一个假的平台（P）和界面（UI），然后把 extra 代码接在后面一起执行。
const fs=require('fs'),path=require('path');
module.exports=function run(extra,w,h){
  global.P={kind:'node',now:()=>0,size:()=>({w:w||400,h:h||800,dpr:1,safe:{top:0,bottom:0,left:0,right:0}}),
    store:{get:()=>null,set(){}},audio:()=>null,unlockAudio(){},vibrate(){}};
  global.UI={reset(){},toast(){},week(){},over(){},bump(){}};
  const src=fs.readFileSync(path.join(__dirname,'..','src','core.js'),'utf8');
  eval(src+'\n'+extra);
};
