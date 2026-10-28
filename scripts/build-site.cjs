const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const esbuild = require('esbuild');
const crypto = require('node:crypto');
const root=path.resolve(__dirname,'..');
const dest=path.join(root,'dist');
// Explicit public surface: tooling, SQL, tests and credentials cannot be copied.
const publicFiles=[
  'recibo-whatsapp.html','recibo-whatsapp.js',
  'piloto-whatsapp.html','piloto-whatsapp.js',
  'aditivos.html','aditivos.js','amendment-ui.js','amendment.css','index.html', 'aprovacoes.html', 'aprovacoes.js', 'approval-config.js', 'approval.css', 'remote-approval-ui.js','clientes.html','comunicacao.html','valores.html','formulario.html','proposta.html',
  'styles.css','app.js','event-readiness.js','event-operations.js','analytics.js','formulario.js','proposta.js',
  'production-planning.js','production-ui.js','payment-ui.js','sales-guide.js','event-metrics.js','event-workspace.js','operational-ui.js','event-data.js','event-performance.js','commercial-rules.js','commercial-dashboard.js',
  'assets/logo-embaixada.svg','assets/logo-reducao.svg','assets/venue.jpg',
  'orcamento/index.html','painel/index.html',
];
fs.rmSync(dest,{recursive:true,force:true});
for(const file of publicFiles) {
  const target=path.join(dest,file); fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.copyFileSync(path.join(root,file),target);
}
esbuild.buildSync({entryPoints:[path.join(root,'node_modules/@supabase/supabase-js/dist/module/index.js')],bundle:true,format:'iife',globalName:'supabase',platform:'browser',target:['es2020'],minify:true,outfile:path.join(dest,'vendor/supabase.js')});
// Preserve the human-readable rollout tag while making every already-versioned
// local script/style URL change whenever its bytes change. No source files,
// external URLs, credentials or unversioned SDK paths are rewritten.
const allowedAssets=new Set(publicFiles);
for(const file of publicFiles.filter(f=>f.endsWith('.html'))) {
  const target=path.join(dest,file);
  const html=fs.readFileSync(target,'utf8').replace(/\b(src|href)="([^"]+\.(?:js|css)\?v=[^"]+)"/g,(match,attribute,reference)=>{
    const decoded=reference.replaceAll('&amp;','&');
    if(/^(?:[a-z]+:|\/\/|\/)/i.test(decoded)) return match;
    const url=new URL(decoded,'https://public-build.invalid/'+file);
    const relative=path.posix.normalize(url.pathname.slice(1));
    if(!allowedAssets.has(relative)) throw Error(`Unlisted versioned asset in ${file}: ${relative}`);
    const hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(dest,relative))).digest('hex').slice(0,16);
    url.searchParams.set('h',hash);
    const originalPath=decoded.split(/[?#]/)[0];
    return `${attribute}="${originalPath}?${url.searchParams.toString().replaceAll('&','&amp;')}${url.hash}"`;
  });
  fs.writeFileSync(target,html);
}
fs.writeFileSync(path.join(dest,'.nojekyll'),'');
let commit='local'; try { commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(); } catch {}
const migrations=fs.readdirSync(path.join(root,'supabase/migrations')).filter(f=>f.endsWith('.sql')).sort();
const assets=Object.fromEntries([...publicFiles,'vendor/supabase.js'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(dest,f))).digest('hex')]));
fs.writeFileSync(path.join(dest,'release.json'),JSON.stringify({commit,schemaHead:migrations.at(-1),supabaseVersion:require('@supabase/supabase-js/package.json').version,assets},null,2));
console.log(`Public build: ${publicFiles.length+3} files, commit ${commit}`);
