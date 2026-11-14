import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateRawSync,crc32 as zipCRC} from 'node:zlib';
import {readZip,selectGameEntries,entryStream,crc32} from '../public/engine/zip.mjs';
import {assetResponse} from '../public/engine/asset-response.mjs';
import {importGameZip,importedGame} from '../public/engine/local-files.mjs';
function zip({source=false,unsafe=false,stored=false}={}){
 const assets=['scripts.rcf','dialog.rcf','art/l1i00.p3d','art/frontend/menu.p3d','sound/typ/srrtypes.typ'];
 const files=source?[['code/main.cpp','int main(){}']]:assets.map(name=>['The Simpsons Hit & Run/'+name,('asset:'+name).repeat(2000)]);
 if(!source)files.push(['The Simpsons Hit & Run/Simpsons.exe','not imported'],['The Simpsons Hit & Run/mods/cheat.txt','not imported']);
 if(unsafe)files.push(['../scripts.rcf','unsafe']);
 const locals=[],directory=[];let offset=0;
 for(const [path,content] of files){
  const name=Buffer.from(path),raw=Buffer.from(content),data=stored?raw:deflateRawSync(raw),method=stored?0:8;
  const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(method,8);local.writeUInt32LE(zipCRC(raw),14);local.writeUInt32LE(data.length,18);local.writeUInt32LE(raw.length,22);local.writeUInt16LE(name.length,26);
  locals.push(local,name,data);
  const entry=Buffer.alloc(46);entry.writeUInt32LE(0x02014b50);entry.writeUInt16LE(20,4);entry.writeUInt16LE(20,6);entry.writeUInt16LE(method,10);entry.writeUInt32LE(zipCRC(raw),16);entry.writeUInt32LE(data.length,20);entry.writeUInt32LE(raw.length,24);entry.writeUInt16LE(name.length,28);entry.writeUInt32LE(offset,42);
  directory.push(entry,name);offset+=local.length+name.length+data.length;
 }
 const central=Buffer.concat(directory),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(central.length,12);end.writeUInt32LE(offset,16);
 return new Blob([...locals,central,end]);
}
async function consume(blob,entry){return new Uint8Array(await new Response(await entryStream(blob,entry)).arrayBuffer());}
test('retail folder ZIPs stream stored and deflated files and omit executables/mods',async()=>{
 for(const stored of [false,true]){
  const blob=zip({stored}),entries=selectGameEntries(await readZip(blob));
  assert.equal(entries.length,5);
  for(const entry of entries){const bytes=await consume(blob,entry);assert.equal(bytes.length,entry.size);assert.equal(crc32(bytes),entry.crc);assert.equal(new TextDecoder().decode(bytes),('asset:'+entry.path).repeat(2000));}
 }
});
test('rejects source code ZIPs, traversal, truncated archives and ZIP64 instead of treating them as game data',async()=>{
 assert.throws(()=>selectGameEntries([]),/retail PC game/);
 const sourceEntries=await readZip(zip({source:true}));assert.throws(()=>selectGameEntries(sourceEntries),/retail PC game/);
 await assert.rejects(readZip(zip({unsafe:true})),/unsafe/);
 await assert.rejects(readZip(new Blob(['not a zip'])),/not a supported ZIP/);
 const data=new Uint8Array(await zip().arrayBuffer());
 data[data.length-22+10]=255;data[data.length-22+11]=255;
 await assert.rejects(readZip(new Blob([data])),/Split ZIP|ZIP64/);
});
test('corrupted compressed data, declared sizes and CRCs fail before publication',async()=>{
 const blob=zip(),entry=selectGameEntries(await readZip(blob))[0];
 await assert.rejects(consume(blob,{...entry,crc:entry.crc^1}),/integrity/);
 await assert.rejects(consume(blob,{...entry,size:entry.size-1}),/declared/);
 await assert.rejects(consume(blob,{...entry,offset:blob.size-1}),/truncated/);
});
test('browser asset responses support full, HEAD, bounded and suffix byte ranges',async()=>{
 const file=new Blob(['0123456789']);
 for(const [range,expected,code] of [[null,'0123456789',200],['bytes=2-5','2345',206],['bytes=-3','789',206],['bytes=8-','89',206],['bytes=0-99','0123456789',206]]){
  const request=new Request('https://game.test/local-game-assets/art/car.p3d',{headers:range?{Range:range}:{}});
  const response=assetResponse(file,request);assert.equal(response.status,code);assert.equal(await response.text(),expected);
  assert.equal(response.headers.get('Cross-Origin-Resource-Policy'),'same-origin');
 }
 for(const range of ['bytes=100-','bytes=-0','bytes=5-2','bytes=0-1,3-4','bad'])assert.equal(assetResponse(file,new Request('https://game.test/file',{headers:{Range:range}})).status,416);
 const response=assetResponse(file,new Request('https://game.test/file',{method:'HEAD'}));assert.equal(response.headers.get('Content-Length'),'10');assert.equal(await response.text(),'');
 assert.equal(await assetResponse(new Blob(),new Request('https://game.test/empty')).text(),'');
});
class Directory{
 children=new Map();
 async getDirectoryHandle(name,{create=false}={}){if(!this.children.has(name)){if(!create)throw new Error('Not found');this.children.set(name,new Directory());}const item=this.children.get(name);if(!(item instanceof Directory))throw new Error('Not a directory');return item;}
 async getFileHandle(name,{create=false}={}){
  if(!this.children.has(name)){if(!create)throw new Error('Not found');this.children.set(name,{blob:new Blob()});}
  const item=this.children.get(name);return {getFile:async()=>item.blob,createWritable:async()=>{
   const chunks=[];const stream=new WritableStream({write:c=>chunks.push(c),close:()=>{item.blob=new Blob(chunks);}});stream.write=async c=>chunks.push(c);return stream;
  }};
 }
 async removeEntry(name){this.children.delete(name);}
 async *entries(){yield* this.children.entries();}
}
test('import publishes verified assets, preserves the previous mount on failure, and replaces it only after success',async()=>{
 const root=new Directory(),oldNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator'),oldFetch=globalThis.fetch;
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{storage:{getDirectory:async()=>root,estimate:async()=>({quota:10**12,usage:0})}}});
 globalThis.fetch=()=>{throw new Error('Game import must never upload files');};
 try{
  const first=await importGameZip(zip());assert.equal(first.count,5);assert.equal((await importedGame()).generation,first.generation);
  const original=zip({stored:true}),bytes=new Uint8Array(await original.arrayBuffer());
  const entry=selectGameEntries(await readZip(original))[0];
  const header=new DataView(bytes.buffer);const payload=entry.offset+30+header.getUint16(entry.offset+26,true)+header.getUint16(entry.offset+28,true);bytes[payload]^=1;
  await assert.rejects(importGameZip(new Blob([bytes])),/integrity/);
  assert.equal((await importedGame()).generation,first.generation);
  const directory=await root.getDirectoryHandle('hit-and-run-game');assert.ok(directory.children.has(first.generation));
  const next=await importGameZip(zip());assert.notEqual(next.generation,first.generation);assert.equal(directory.children.has(first.generation),false);
  assert.deepEqual([...directory.children.keys()].sort(),[next.generation,'mount.json'].sort());
 }finally{Object.defineProperty(globalThis,'navigator',oldNavigator);globalThis.fetch=oldFetch;}
});

test('service worker serves imported files and ranges locally, handles refresh, and ignores unrelated network requests',async()=>{
 const root=new Directory(),oldNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator'),oldSelf=globalThis.self;
 const handlers={};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{storage:{getDirectory:async()=>root,estimate:async()=>({quota:10**12,usage:0})}}});
 globalThis.self={location:{origin:'https://game.test'},skipWaiting:async()=>{},clients:{claim:async()=>{}},addEventListener:(name,handler)=>{handlers[name]=handler;}};
 async function serve(path,options={}){
  let reply;handlers.fetch({request:new Request('https://game.test'+path,options),respondWith:result=>{reply=result;}});return reply;
 }
 try{
  await importGameZip(zip());
  await import('../public/game-files-sw.js');
  const response=await serve('/local-game-assets/ART/L1I00.P3D',{headers:{Range:'bytes=0-4'}});
  assert.equal(response.status,206);assert.equal(await response.text(),'asset');
  const head=await serve('/local-game-assets/scripts.rcf',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
  assert.equal(await serve('/engine/index.html'),undefined);
  assert.equal((await serve('/local-game-assets/missing.rcf')).status,404);
  assert.equal((await serve('/local-game-assets/scripts.rcf',{method:'POST'})).status,405);
  await importGameZip(zip());handlers.message({data:{type:'refresh-game-files'}});
  assert.equal((await serve('/local-game-assets/scripts.rcf',{headers:{Range:'bytes=-3'}})).status,206);
 }finally{Object.defineProperty(globalThis,'navigator',oldNavigator);globalThis.self=oldSelf;}
});
