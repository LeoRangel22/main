const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
for(const page of ['index.html','clientes.html','comunicacao.html','valores.html'])test(`approval cache rollout: ${page}`,()=>{
  const html=fs.readFileSync(`${__dirname}/../${page}`,'utf8');
  const app=html.match(/src="\.\/app\.js\?v=([^"]+)"/);
  const helper=html.match(/src="\.\/remote-approval-ui\.js\?v=([^"]+)"/);
  assert.ok(app&&helper);assert.equal(app[1],helper[1]);assert.ok(app[1].slice(0,8)>='20261013');assert.doesNotMatch(html,/app\.js\?v=20261012-integrity/);
});
for(const [page,asset,release] of [
  ['aprovacoes.html','aprovacoes.js','20261015-approval-evidence'],
  ['formulario.html','formulario.js','20261015-approval-closure'],
  ['proposta.html','proposta.js','20261018-synergy']
])test(`approval public cache rollout: ${page}`,()=>{
  const html=fs.readFileSync(`${__dirname}/../${page}`,'utf8');
  assert.ok(html.includes(asset+'?v='+release));
});
