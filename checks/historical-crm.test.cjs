const test=require("node:test"),assert=require("node:assert/strict");
const {formatDate,formatMoney,formatValue,params}=require("../historical-crm.js");
test("unknown financial information remains distinct from zero",()=>{
 assert.equal(formatMoney(null),"Não informado");assert.equal(formatMoney(""),"Não informado");
 assert.match(formatMoney("0"),/0,00/);assert.match(formatMoney("1491.75"),/1\.491,75/);
});
test("date-only evidence keeps its day and timestamps use the business timezone",()=>{
 assert.equal(formatDate("2024-02-19"),"19/02/2024");
 assert.match(formatDate("2026-11-07T01:30:00Z"),/06\/11\/2026.*22:30/);
 assert.equal(formatDate(null),"Não informado");
});
test("email addresses, references and quoted text retain their original characters",()=>{
 for(const [value,key]of [["nome_completo@example.test","email"],["FILE_26_001","booking_ref"],["Texto_original & <exemplo>","notes"]])
  assert.equal(formatValue(value,key),value);
});
test("read requests preserve the exact query and selected company scope",()=>{
 const s={kind:"contact",query:"(21) 98765-4321",sort:"recent",offset:20,organization:{id:"org-fixture"}};
 assert.deepEqual(params(s),{p_kind:"contact",p_query:"(21) 98765-4321",p_sort:"recent",p_limit:20,p_offset:20,p_record_id:null,p_organization_id:"org-fixture"});
 assert.equal(params(s,{p_record_id:"contact-fixture",p_offset:0}).p_record_id,"contact-fixture");
 assert.equal(s.offset,20);
});
