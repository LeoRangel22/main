const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'../dist');
test('public bundle excludes database, development and operating files',()=>{
  assert.ok(fs.existsSync(path.join(root,'index.html')));
  for(const name of ['supabase','checks','tests','scripts','node_modules','package.json','package-lock.json','README.md','.github']) assert.equal(fs.existsSync(path.join(root,name)),false,name);
});
test('local HTML references resolve inside public bundle',()=>{
  function walk(dir) { return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]); }
  for(const file of walk(root).filter(f=>f.endsWith('.html'))) {
    const html=fs.readFileSync(file,'utf8');
    assert.equal(html.includes('supabase-js@2'),false,'SDK must be pinned and bundled');
    for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
      const ref=match[1].split('?')[0]; if(/^(?:https?:|mailto:|tel:|data:)/.test(ref)) continue;
      assert.ok(fs.existsSync(path.resolve(path.dirname(file),ref)),`${path.basename(file)} -> ${ref}`);
    }
  }
});
