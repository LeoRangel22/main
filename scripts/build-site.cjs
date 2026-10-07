const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const esbuild = require('esbuild');
const crypto = require('node:crypto');
const root=path.resolve(__dirname,'..');
const dest=path.join(root,'dist');
// Explicit public surface: tooling, SQL, tests and credentials cannot be copied.
const publicFiles=[
  'index.html','clientes.html','comunicacao.html','valores.html','formulario.html','proposta.html',
  'styles.css','app.js','event-operations.js','analytics.js','formulario.js','proposta.js',
  'event-data.js','event-performance.js','commercial-rules.js','commercial-dashboard.js',
  'assets/logo-embaixada.svg','assets/logo-reducao.svg','assets/venue.jpg',
  'orcamento/index.html','painel/index.html',
];
fs.rmSync(dest,{recursive:true,force:true});
for(const file of publicFiles) {
  const target=path.join(dest,file); fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.copyFileSync(path.join(root,file),target);
}
esbuild.buildSync({entryPoints:[path.join(root,'node_modules/@supabase/supabase-js/dist/module/index.js')],bundle:true,format:'iife',globalName:'supabase',platform:'browser',target:['es2020'],minify:true,outfile:path.join(dest,'vendor/supabase.js')});
fs.writeFileSync(path.join(dest,'.nojekyll'),'');
let commit='local'; try { commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(); } catch {}
const migrations=fs.readdirSync(path.join(root,'supabase/migrations')).filter(f=>f.endsWith('.sql')).sort();
const assets=Object.fromEntries([...publicFiles,'vendor/supabase.js'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(dest,f))).digest('hex')]));
fs.writeFileSync(path.join(dest,'release.json'),JSON.stringify({commit,schemaHead:migrations.at(-1),supabaseVersion:require('@supabase/supabase-js/package.json').version,assets},null,2));
console.log(`Public build: ${publicFiles.length+3} files, commit ${commit}`);
