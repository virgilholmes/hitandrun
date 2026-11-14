import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readScene} from '../lib/scene.mjs';
import {SPRINGFIELD,mergeArea} from '../lib/springfield.mjs';
import {createOrbitCamera} from '../lib/camera.mjs';
test('neighborhood merges original region geometry with shared terrain textures',async t=>{
 const scenes=[];
 try{for(const path of [SPRINGFIELD.resources,...SPRINGFIELD.regions]){
  const b=new Uint8Array(await readFile('/home/virgil/Games/The Simpsons Hit & Run/'+path));scenes.push(readScene(b.buffer));
 }}catch(e){if(e.code==='ENOENT'){t.skip('Retail installation unavailable');return;}throw e;}
 const scene=mergeArea(scenes[0],scenes.slice(1));
 assert.ok(scene.groups.length>300);
 assert.equal(scene.groups.length,scenes.slice(1).reduce((n,s)=>n+s.groups.length,0));
 assert.deepEqual(scene.missingTextures,[]);
 assert.ok(scene.textures.size>200);
 assert.ok(!scene.groups.some(g=>g.name==='visibility_testShape'));
 for(const g of scene.groups)assert.ok(scene.shaders.has(g.shader),'Missing shader '+g.shader);
});
test('inspection camera moves relative to its heading with bounded frame steps',()=>{
 const c=createOrbitCamera();c.focus([0,0,0],100);c.yaw=0;
 c.move(new Set(['KeyW']),.05);assert.ok(c.target[2]<0);assert.equal(c.target[0],0);
 c.focus([0,0,0],100);c.yaw=Math.PI/2;c.move(new Set(['KeyW']),.05);assert.ok(c.target[0]<0);assert.ok(Math.abs(c.target[2])<1e-10);
 c.focus([0,0,0],100);c.yaw=0;c.move(new Set(['KeyE','ShiftLeft']),.05);assert.equal(c.target[1],7.5);
 c.focus([0,0,0],100);c.move(new Set(['KeyE']),10);assert.equal(c.target[1],2.5);
 c.orbit(0,10000);assert.ok(c.pitch<Math.PI/2);
 c.zoom(-100000);assert.ok(c.distance>=.05);
});
