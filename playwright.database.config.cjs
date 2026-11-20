const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({
 testDir:'./integration',testMatch:'*.spec.cjs',workers:1,timeout:60000,
 expect:{timeout:10000},reporter:[['list'],['json',{outputFile:'database-integration-results/results.json'}]],
 outputDir:'database-integration-results/artifacts',
 use:{baseURL:'http://127.0.0.1:8774',browserName:'chromium',viewport:{width:1440,height:1000},trace:'on',screenshot:'only-on-failure'},
 webServer:{command:'npm run serve',env:{PORT:'8774'},url:'http://127.0.0.1:8774',reuseExistingServer:false,timeout:60000},
});
