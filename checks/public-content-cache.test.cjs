'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const vm=require('node:vm');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const builder=fs.readFileSync(path.join(root,'scripts/build-site.cjs'),'utf8');
const start=builder.indexOf('const allowedAssets='),end=builder.indexOf("fs.writeFileSync(path.join(dest,'.nojekyll')",start);
assert.ok(start>=0&&end>start);
function stamp(script){
 const dest=fs.mkdtempSync(path.join(os.tmpdir(),'events-cache-'));
 try {
  const html='<script src="./app.js?v=unchanged-tag"></script><link href="./styles.css?v=style-tag" rel="stylesheet"><script src="./vendor/supabase.js"></script><script src="https://external.example.test/sdk.js?v=external"></script>';
  fs.writeFileSync(path.join(dest,'index.html'),html);fs.writeFileSync(path.join(dest,'app.js'),script);fs.writeFileSync(path.join(dest,'styles.css'),'body{}');
  const c={fs,path,crypto,URL,dest,publicFiles:['index.html','app.js','styles.css']};vm.runInNewContext(builder.slice(start,end),c);
  return fs.readFileSync(path.join(dest,'index.html'),'utf8');
 } finally {fs.rmSync(dest,{recursive:true,force:true});}
}
test('new script bytes invalidate cached URLs even when the human rollout tag is unchanged',()=>{
 const first=stamp('const version=1;'),second=stamp('const version=2;');
 assert.notEqual(first,second);assert.match(first,new RegExp('h='+sha('const version=1;').slice(0,16)));
 assert.match(second,new RegExp('h='+sha('const version=2;').slice(0,16)));
 assert.match(second,/v=unchanged-tag&amp;h=/);assert.equal(second,stamp('const version=2;'));
});
test('stamping preserves unversioned SDK and external paths, and independently identifies styles',()=>{
 const html=stamp('fixture');assert.ok(html.includes('src="./vendor/supabase.js"'));
 assert.ok(html.includes('src="https://external.example.test/sdk.js?v=external"'));
 assert.ok(html.includes('href="./styles.css?v=style-tag&amp;h='+sha('body{}').slice(0,16)+'"'));
});
test('every deployed versioned script or style points to the exact built bytes',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'dist/release.json'),'utf8'));let checked=0;
 for(const file of Object.keys(manifest.assets).filter(f=>f.endsWith('.html'))){
  const bytes=fs.readFileSync(path.join(root,'dist',file));assert.equal(sha(bytes),manifest.assets[file]);
  for(const [,reference] of bytes.toString().matchAll(/\b(?:src|href)="([^"]+\.(?:js|css)\?v=[^"]+)"/g)){
   const url=new URL(reference.replaceAll('&amp;','&'),'https://fixture.example.test/'+file);
   if(url.origin!=='https://fixture.example.test')continue;
   const asset=url.pathname.slice(1);assert.ok(manifest.assets[asset],asset);
   assert.equal(url.searchParams.get('h'),manifest.assets[asset].slice(0,16),file+' -> '+asset);checked++;
  }
 }
 assert.ok(checked>=10,'All public entry points must carry content fingerprints');
});
test('publication includes current application, portal and production code under stamped references',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'dist/release.json'),'utf8'));
 for(const [page,asset] of [['index.html','app.js'],['index.html','production-ui.js'],['proposta.html','proposta.js']]){
  const html=fs.readFileSync(path.join(root,'dist',page),'utf8');assert.ok(html.includes('h='+manifest.assets[asset].slice(0,16)));
  assert.equal(sha(fs.readFileSync(path.join(root,asset))),manifest.assets[asset]);
 }
});
