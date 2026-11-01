'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
function assessBuffer(bytes,budget){const measured={rawBytes:bytes.length,gzipBytes:zlib.gzipSync(bytes,{level:9}).length};return{...measured,pass:measured.rawBytes<=budget.maxRawBytes&&measured.gzipBytes<=budget.maxGzipBytes};}
function check(root,budget){return budget.assets.map(asset=>{
 if(!asset.path||path.isAbsolute(asset.path)||asset.path.split(/[\\/]/).includes('..'))throw Error('INVALID_BUDGET_PATH');
 if(!Number.isSafeInteger(asset.maxRawBytes)||!Number.isSafeInteger(asset.maxGzipBytes)||asset.maxRawBytes<1||asset.maxGzipBytes<1)throw Error('INVALID_BYTE_BUDGET');
 return{path:asset.path,...assessBuffer(fs.readFileSync(path.join(root,'dist',asset.path)),asset)};
});}
if(require.main===module){const root=path.resolve(__dirname,'..'),budget=JSON.parse(fs.readFileSync(path.join(root,'checks/public-performance-budget.json')));const report={labOnly:true,fieldWebVitals:false,baselineCommit:budget.baselineCommit,compression:'gzip level 9; bytes, not network timing',assets:check(root,budget)};fs.mkdirSync(path.join(root,'quality-results'),{recursive:true});fs.writeFileSync(path.join(root,'quality-results/performance-assets.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(report.assets.some(a=>!a.pass))process.exitCode=1;}
module.exports={assessBuffer,check};
