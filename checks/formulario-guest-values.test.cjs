const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../formulario.js'),'utf8');
const slice=(start,end)=>{const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a);return source.slice(a,b)};
const context=vm.createContext({fields:{guests:{value:'30'}}});
vm.runInContext(slice('function toNumber(','function escapeHtml(')+slice('function getGuestCount(','function getGuestCountError('),context);
for(const [raw,value]of[['2',2],['30',30],['99',99],['100',100],['500',500],['002',2],['2.0',2],['1e2',100]])test('guest count retains numeric meaning '+raw,()=>assert.equal(context.getGuestCount(raw),value));
for(const raw of ['',' ','0','1','-1','501','999','2.5','2,5','abc','Infinity',null,false,NaN])test('invalid guest count is unavailable, never clamped or defaulted '+String(raw),()=>assert.equal(context.getGuestCount(raw),null));
test('default reads the current field rather than manufacturing thirty guests',()=>{context.fields.guests.value='501';assert.equal(context.getGuestCount(),null);context.fields.guests.value='500';assert.equal(context.getGuestCount(),500)});
