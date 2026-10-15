const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {webcrypto} = require('node:crypto');
const root = path.resolve(__dirname,'..');
const core = require('../availability-core.js');
const link = id => `https://scott-moura.github.io/ce186/materials/?q=anything#item=${id}`;
const row = (quantity,url,supplier='Moura Lab') => ({row:2,quantity,url,supplier});
const known = ['arduino','servo','resistors','unknown-count'];
const payload = changes => ({version:1,ok:true,read_at:new Date().toISOString(),requested:{arduino:12},uncertain_ids:[],review_count:0,matched_rows:1,team_count:9,...changes});

test('explicit catalog IDs: query parameters, encoded IDs and trailing slash', () => {
  assert.equal(core.itemId(link('arduino')), 'arduino');
  assert.equal(core.itemId(link('%61rduino')), 'arduino');
  assert.equal(core.itemId('https://scott-moura.github.io/ce186/materials#item=servo'), 'servo');
});
test('reject homepage, supplier links, wrong hosts/path, ambiguous and malformed IDs', () => {
  for (const value of ['', 'https://scott-moura.github.io/ce186/materials/', 'https://www.adafruit.com/product/4440', link('bad_id'), link('%ZZ'), link('arduino')+'&item=servo',link('arduino').replace('github.io','github.io.evil.example'), link('arduino').replace('/ce186/','/other/'),link('arduino').replace('https:','http:')]) assert.equal(core.itemId(value),null,value);
});
test('whole-number request counts preserve zero; reject missing, negative, fractional and non-numeric', () => {
  for (const value of [0,'0',1,' 2 ','2.0']) assert.notEqual(core.requestCount(value),null);
  for (const value of ['', ' ', null, true, -1,'-1',1.2,'1 kit','1,000',Infinity,NaN,1e12]) assert.equal(core.requestCount(value),null,String(value));
});
test('sum team requests only; no summary/example duplication, no status filtering', () => {
  const result = core.aggregate([
    {name:'Team1',rows:[row(2,link('arduino')),row(3,link('arduino'),' moura   LAB '),row(99,link('arduino'),'Jacobs Hall')]},
    {name:'Team10',rows:[row(1,link('arduino'))]},
    {name:'0.Example',rows:[row(100,link('arduino'))]},
    {name:'Moura Lab',rows:[row(100,link('arduino'))]}
  ],known);
  assert.equal(result.requested.arduino,6);
  assert.equal(result.matched_rows,3);
  assert.equal(result.team_count,2);
});
test('unmatched requests are flagged, not guessed; malformed known counts are unavailable', () => {
  const result = core.aggregate([{name:'Team1',rows:[row(1,''),row(2,link('deleted')),row('few',link('servo')),row(0,''),row(2,link('arduino'))]}],known);
  assert.equal(result.review_count,3);
  assert.deepEqual(result.uncertain_ids,['servo']);
  assert.equal(result.requested.arduino,2);
  assert.equal(result.requested.servo,undefined);
  assert.throws(()=>core.aggregate([],known));
});
test('response validation: counts and timestamp, errors/stale payloads rejected', () => {
  assert.equal(core.validatePayload(payload(),known).requested.arduino,12);
  for (const changed of [{ok:false},{version:2},{requested:{arduino:-1}},{requested:{arduino:'2'}},{requested:[]},{read_at:'bad'},{read_at:'2020-01-01T00:00:00Z'},{review_count:-1},{team_count:0},{uncertain_ids:['bad_id']}]) assert.throws(()=>core.validatePayload(payload(changed),known));
  assert.equal(core.validatePayload(payload({requested:{deleted:3}}),known).reviewCount,1);
});
test('remaining has two independent quantities: positive, zero, negative and unrequested', () => {
  const state={status:'ready',requested:{arduino:12,servo:4,resistors:3},uncertain:new Set()};
  const item={id:'arduino',quantity:10};
  assert.deepEqual(core.remaining(item,state),{text:'-2',value:-2,negative:true});
  assert.equal(item.quantity,10);
  assert.equal(core.remaining({id:'servo',quantity:4},state).value,0);
  assert.equal(core.remaining({id:'resistors',quantity:24},state).value,21);
  assert.equal(core.remaining({id:'other',quantity:8},state).value,8);
});
test('uncounted stock is not zero; no numeric balance on failed or uncertain readings', () => {
  for (const status of ['loading','error','unconfigured','ready']) assert.equal(core.remaining({quantity:null},{status}).text,'Not counted');
  for (const status of ['error','unconfigured']) assert.equal(core.remaining({quantity:10},{status}).text,'Unavailable');
  assert.equal(core.remaining({quantity:10},{status:'loading'}).text,'Loading…');
  assert.equal(core.remaining({id:'servo',quantity:4},{status:'ready',requested:{},uncertain:new Set(['servo'])}).text,'Unavailable');
});

function clientHarness(mode='success') {
  const requests=[];
  const window={};
  const context={window,CE186Availability:core,URL,URLSearchParams,crypto:webcrypto,Uint8Array,Date,
    setTimeout(fn,ms){const timer=setTimeout(fn,ms); if(ms===60000) timer.unref(); return timer;},clearTimeout,
    document:{createElement(){return {remove(){this.removed=true;}};},head:{appendChild(script){requests.push(script); if(mode==='timeout') return; if(mode==='error'){queueMicrotask(()=>script.onerror());return;} const callback=new URL(script.src).searchParams.get('callback'); queueMicrotask(()=>window[callback](mode==='bad'?payload({ok:false}):payload()));}}}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'inventory-client.js'),'utf8'),context);
  return {client:window.CE186InventoryClient,requests};
}
test('client makes a fresh, configured-only request; callback removed after successful validation',async()=>{
  const {client,requests}=clientHarness();
  const endpoint='https://script.google.com/macros/s/EXAMPLE_EXECUTION_ID/exec';
  assert.equal((await client.load(endpoint,known)).requested.arduino,12);
  await client.load(endpoint,known);
  assert.notEqual(requests[0].src,requests[1].src);
  assert.ok(requests.every(script=>script.removed && script.referrerPolicy==='no-referrer'));
  for(const url of ['https://evil.example/exec','http://script.google.com/macros/s/test/exec','https://script.google.com/macros/s/test/dev',endpoint+'?callback=bad']) await assert.rejects(client.load(url,known));
});
test('client handles network error, malformed response and timeout',async()=>{
  for(const mode of ['error','bad','timeout']) await assert.rejects(clientHarness(mode).client.load('https://script.google.com/macros/s/test/exec',known,10));
});
test('sample preview is possible only on loopback, never on public host',()=>{
  const {client}=clientHarness();
  assert.equal(client.demoAllowed({hostname:'127.0.0.1',search:'?inventory=demo'}),true);
  assert.equal(client.demoAllowed({hostname:'localhost',search:''}),false);
  assert.equal(client.demoAllowed({hostname:'scott-moura.github.io',search:'?inventory=demo'}),false);
});

function serverHarness({badHeader=false,missingTeam=false}={}) {
  const privateAudit=[];
  const makeSheet = index => ({
    getName:()=>`Team${index}`, getLastColumn:()=>11, getLastRow:()=>3,
    getRange(start,column,height,width){
      const headers=['Team Name','Item Name','Description','Price per Item',badHeader?'Count':'Quantity','Cost','Supplier','Distributed','Received',index===3?'':'URL (REQUIRED)',index===3?'URL (REQUIRED)':''];
      const values = column===5 ? [[1],['']] : column===7 ? [['Moura Lab'],['']] : [[link('arduino')],['']];
      return {
        getDisplayValues:()=>start===1?[headers]:values,
        getValues:()=>values,
        getRichTextValues:()=>[[{getLinkUrl:()=>index===2?link('servo'):null,getRuns:()=>[]}],[null]],
        getFormulas:()=>[[index===4?'=HYPERLINK("'+link('resistors')+'","PRIVATE TEAM NAME")':''],['']]
      };
    }
  });
  const context={console:{log:message=>privateAudit.push(message),error:()=>{}},
    SpreadsheetApp:{openById:id=>{assert.equal(id,'1rc4oldV-4UBVAPdwYUdvE60H9zSEW7yMkq2k_D7CPlY');return {getSheets:()=>Array.from({length:missingTeam?8:9},(_,i)=>makeSheet(i+1))};}},
    ContentService:{MimeType:{JSON:'json',JAVASCRIPT:'javascript'},createTextOutput:text=>({text,setMimeType(mime){this.mime=mime;return this;}})}};
  vm.createContext(context);
  for(const file of ['availability-core.js','apps-script/CatalogIds.gs','apps-script/Code.gs']) vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
  return context;
}
test('Apps Script serves aggregates directly, handles header-based K links, rich links and HYPERLINK',()=>{
  const output=serverHarness().doGet({parameter:{}});
  const data=JSON.parse(output.text);
  assert.equal(data.ok,true);
  assert.equal(data.requested.arduino,7);
  assert.equal(data.requested.servo,1);
  assert.equal(data.requested.resistors,1);
  assert.equal(data.team_count,9);
  assert.deepEqual(Object.keys(data).sort(),['version','ok','read_at','requested','uncertain_ids','review_count','matched_rows','team_count'].sort());
  assert.ok(!output.text.includes('PRIVATE TEAM NAME'));
  assert.ok(!output.text.includes('Team1'));
});
test('Apps Script rejects callback injection and genericizes schema/missing-team failures',()=>{
  const context=serverHarness();
  assert.equal(JSON.parse(context.doGet({parameter:{callback:'alert(1);//'}}).text).error,'invalid_callback');
  const result=context.doGet({parameter:{callback:'__ce186Inventory_0123456789abcdef'}});
  assert.ok(result.text.startsWith('__ce186Inventory_0123456789abcdef('));
  assert.equal(result.mime,'javascript');
  for(const options of [{badHeader:true},{missingTeam:true}]) assert.deepEqual(JSON.parse(serverHarness(options).doGet({parameter:{}}).text),{version:1,ok:false,error:'inventory_unavailable'});
});
test('backend catalog allowlist stays in sync with the authoritative catalog',()=>{
  const source=fs.readFileSync(path.join(root,'data/catalog.js'),'utf8');
  const catalog=JSON.parse(source.slice(source.indexOf('=')+1).trim().replace(/;$/,''));
  const idsSource=fs.readFileSync(path.join(root,'apps-script/CatalogIds.gs'),'utf8');
  const ids=JSON.parse(idsSource.slice(idsSource.indexOf('=')+1).trim().replace(/;$/,''));
  assert.deepEqual(ids,catalog.items.map(item=>item.id));
});
