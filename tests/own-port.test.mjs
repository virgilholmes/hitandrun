import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import createSourceCore from '../public/our-port/source-core.mjs';
import { inspectP3D } from '../lib/p3d.mjs';
import { readScene } from '../lib/scene.mjs';
let core;
before(async()=>{core=await createSourceCore();});
function probe(bytes){
 const ptr=core._malloc(Math.max(1,bytes.byteLength));
 try{
  core.HEAPU8.set(bytes,ptr);
  const ok=core._hr_source_probe(ptr,bytes.byteLength);
  return {ok,error:core.UTF8ToString(core._hr_source_last_error()),chunks:core._hr_source_chunk_count(),meshes:core._hr_source_mesh_count(),textures:core._hr_source_texture_count()};
 }finally{core._free(ptr);}
}
function words(values,little=true){const b=new Uint8Array(values.length*4),v=new DataView(b.buffer);values.forEach((n,i)=>v.setUint32(i*4,n,little));return b;}
test('original math executes in our compiled wasm',()=>{
 assert.equal(core._hr_math_init(),0);
 const ptr=core._malloc(12);
 try{
  let view=new DataView(core.HEAPU8.buffer);view.setFloat32(ptr,3,true);view.setFloat32(ptr+4,4,true);view.setFloat32(ptr+8,0,true);
  assert.equal(core._hr_math_normalize3(ptr),1);
  view=new DataView(core.HEAPU8.buffer);
  assert.ok(Math.abs(view.getFloat32(ptr,true)-0.6)<1e-6);
  assert.ok(Math.abs(view.getFloat32(ptr+4,true)-0.8)<1e-6);
 }finally{core._free(ptr);}
});
test('original C++ parser handles little and big endian chunks',()=>{
 for(const little of [true,false]){
  const r=probe(words([0xff443350,12,36,0x10000,12,12,0x19000,12,12],little));
  assert.equal(r.ok,1,r.error);assert.equal(r.chunks,3);assert.equal(r.meshes,1);assert.equal(r.textures,1);
 }
});
test('malformed files are caught inside wasm and valid calls still work',()=>{
 for(const values of [[],[0xff443350,12,24],[0xff443350,8,12],[0x5a443350,12,12],[0xff443350,12,28,1,12,16,0]]){
  const r=probe(words(values));assert.equal(r.ok,0);assert.notEqual(r.error,'');assert.equal(r.chunks,0);
 }
 assert.equal(probe(words([0xff443350,12,12])).ok,1);
});
for(const name of ['art/cars/famil_v.p3d','art/l1r1.p3d','art/L1_TERRA.p3d','art/l1z1.p3d','art/l1r7.p3d']){
 test('our wasm reads the retail asset: '+name,async t=>{
  let bytes;
  try{bytes=new Uint8Array(await readFile('/home/virgil/Games/The Simpsons Hit & Run/'+name));}
  catch(e){if(e.code==='ENOENT'){t.skip('Retail installation unavailable');return;}throw e;}
  const reference=inspectP3D(bytes.buffer);
  const r=probe(bytes);
  assert.equal(r.ok,1,r.error);assert.equal(r.chunks,reference.chunks.length);
  assert.equal(r.meshes,reference.chunks.filter(c=>c.id===0x10000||c.id===0x10001).length);
  assert.equal(r.textures,reference.chunks.filter(c=>c.id===0x19000).length);
 });
}

test('car prop assembly places four wheels and agrees with original C++ matrix transforms',async t=>{
 let bytes;
 try{bytes=new Uint8Array(await readFile('/home/virgil/Games/The Simpsons Hit & Run/art/cars/famil_v.p3d'));}
 catch(e){if(e.code==='ENOENT'){t.skip('Retail installation unavailable');return;}throw e;}
 const scene=readScene(bytes.buffer);
 assert.equal(scene.assembly.name,'famil_v');
 const wheels=scene.assembly.props.filter(p=>p.mesh==='wShape1');
 assert.equal(wheels.length,4);
 assert.equal(new Set(wheels.map(p=>Array.from(p.matrix.slice(12,15)).join(','))).size,4);
 const ptr=core._malloc(88);
 try{
  for(let i=0;i<scene.assembly.props.length;i++){
   const prop=scene.assembly.props[i],raw=scene.rawGroups.find(g=>g.name===prop.mesh),placed=scene.groups.find(g=>g.instance===i);
   core.HEAPU8.set(new Uint8Array(prop.matrix.buffer,prop.matrix.byteOffset,64),ptr);
   core.HEAPU8.set(new Uint8Array(raw.positions.buffer,raw.positions.byteOffset,12),ptr+64);
   assert.equal(core._hr_math_transform3(ptr,ptr+64,ptr+76),1);
   const view=new DataView(core.HEAPU8.buffer);
   for(let c=0;c<3;c++)assert.ok(Math.abs(view.getFloat32(ptr+76+c*4,true)-placed.positions[c])<1e-5,prop.mesh);
  }
 }finally{core._free(ptr);}
});
