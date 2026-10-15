// 在 Node 里加载模拟层（data.js + core.js），把 extra 代码接在后面一起执行。模拟层不依赖平台和界面。
const fs=require('fs'),path=require('path');
module.exports=function run(extra){
  const src=['data.js','core.js'].map(f=>fs.readFileSync(path.join(__dirname,'..','src',f),'utf8')).join('\n');
  eval(src+'\n'+extra);
};
