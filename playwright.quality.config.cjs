const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({
 testDir:'./tests',testMatch:['pipeline-mobile-navigation.spec.js','client-workspace-navigation.spec.js','navigation-usability.spec.js','quality-gates.spec.js','formulario-state-consistency.spec.js','formulario-accessibility-followup.spec.js','mailbox-owner-pilot.spec.js'],timeout:35000,expect:{timeout:8000},workers:2,retries:0,
 reporter:[['list'],['json',{outputFile:'quality-results/results.json'}]],outputDir:'quality-results/browser',
 use:{baseURL:'http://127.0.0.1:8781',viewport:{width:390,height:900},trace:'retain-on-failure',screenshot:'only-on-failure'},
 projects:['chromium','firefox','webkit'].map(browserName=>({name:browserName,use:{browserName}})),
 webServer:{command:'node scripts/static-server.cjs',url:'http://127.0.0.1:8781',reuseExistingServer:false,timeout:15000,env:{PORT:'8781'}}
});
