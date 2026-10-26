const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({testDir:'./tests',testMatch:'whatsapp-single-pilot.spec.js',timeout:25000,expect:{timeout:6000},reporter:[['list']],
 use:{baseURL:'http://127.0.0.1:8876',browserName:'chromium',screenshot:'only-on-failure',trace:'retain-on-failure',viewport:{width:1280,height:900}},
 webServer:{command:'npm run serve',env:{PORT:'8876'},url:'http://127.0.0.1:8876',reuseExistingServer:false,timeout:30000}});
