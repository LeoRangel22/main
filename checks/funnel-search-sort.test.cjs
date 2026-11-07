const { test } = require("node:test");
const assert = require("node:assert/strict");
const { FunnelView: view } = require("../commercial-rules.js");

test("search combines name and company, ignores accents/case, and finds e-mail and formatted mobile", () => {
  const item = { name: "Ána Cláudia", company: "Órbita Café", email: "ana@example.test", phone: "+55 (21) 98765-4321", date: "2026-11-18" };
  for (const query of ["ANA orbita", "cafe claudia", "ana@example.test", "21987654321", "(21) 98765-4321", "+55 21 98765 4321", "18/11", "18/11/2026", "18-11-2026", "2026-11-18", "ana 18/11"]) assert.equal(view.matches(item, query), true, query);
  for (const query of ["outra empresa", "31/02/2026", "19/11/2026", "2026-11-19"]) assert.equal(view.matches(item, query), false, query);
});
test("dates do not match phone digits, and receipt dates use the business timezone", () => {
  const item = { date: "2026-02-28", phone: "5518112026999", receivedAt: "2026-11-07T01:00:00Z" };
  assert.equal(view.matches(item, "18/11/2026"), false);
  assert.equal(view.matches(item, "06/11/2026"), true);
  assert.equal(view.matches(item, "07/11/2026"), false);
  assert.equal(view.matches(item, ""), true);
});
test("receipt belongs to the original request, shared by V1/V2 even after edits", () => {
  const dates = view.receiptDates({
    requests: [{ id: "lead", created_at: "2026-01-02T12:00:00Z" }],
    opportunities: [{ id: "op", created_at: "2026-01-04T12:00:00Z" }],
    proposals: [
      { id: "v1", solicitacao_id: "lead", oportunidade_id: "op", created_at: "2026-01-05T12:00:00Z" },
      { id: "v2", oportunidade_id: "op", created_at: "2026-02-05T12:00:00Z", updated_at: "2026-03-01T12:00:00Z" },
      { id: "other", oportunidade_id: "unrelated", created_at: "2026-02-01T12:00:00Z" },
    ],
  });
  assert.equal(dates.get("proposal:v1"), "2026-01-02T12:00:00.000Z");
  assert.equal(dates.get("proposal:v2"), dates.get("request:lead"));
  assert.equal(dates.get("proposal:other"), "2026-02-01T12:00:00.000Z");
});
test("receipt uses earliest known version when the request is not loaded, without inventing unknown dates", () => {
  const dates = view.receiptDates({ proposals: [
    {id:"v2",oportunidade_id:"op",created_at:"2026-03-02T12:00:00Z"},
    {id:"v1",oportunidade_id:"op",created_at:"2026-03-01T12:00:00Z"},
    {id:"unknown",created_at:"invalid"},
  ]});
  assert.equal(dates.get("proposal:v2"), "2026-03-01T12:00:00.000Z");
  assert.equal(dates.has("proposal:unknown"), false);
});
test("Portuguese names, next event and newest receipt sort without mutating the input", () => {
  const items = [
    {id:"z",name:"Zulu",date:"2026-12-01",receivedAt:"2026-11-03T00:00:00Z"},
    {id:"a",name:"Álvaro",date:"2026-11-18",receivedAt:"2026-11-01T00:00:00Z"},
    {id:"b",name:"Bruna",date:"2026-11-19",receivedAt:"2026-11-02T00:00:00Z"},
  ];
  const before = JSON.stringify(items);
  assert.deepEqual(view.sort(items,"name").map(x=>x.id), ["a","b","z"]);
  assert.deepEqual(view.sort(items,"event").map(x=>x.id), ["a","b","z"]);
  assert.deepEqual(view.sort(items,"received").map(x=>x.id), ["z","b","a"]);
  assert.equal(JSON.stringify(items), before);
});
test("missing/invalid dates sort last, ties remain deterministic, invalid preferences fall back safely", () => {
  const items = [
    {id:"b",name:"Ana",date:"2026-02-30",receivedAt:"invalid"},
    {id:"c",name:"Ana",date:"2026-11-18",receivedAt:"2026-11-01T12:00:00Z"},
    {id:"a",name:"Ana",date:"",receivedAt:""},
  ];
  assert.deepEqual(view.sort(items,"event").map(x=>x.id), ["c","a","b"]);
  assert.deepEqual(view.sort(items,"received").map(x=>x.id), ["c","a","b"]);
  assert.deepEqual(view.sort(items,"unrecognized"), view.sort(items,"received"));
});
