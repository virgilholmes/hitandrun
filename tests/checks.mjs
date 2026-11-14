import { inspectP3D } from '../lib/p3d.mjs';
import { readScene } from '../lib/scene.mjs';
export function runChecks() {
 let passed=0;
 const assert=(condition,message)=>{if(!condition)throw new Error(message);};
 function words(values,little=true) {const b=new ArrayBuffer(values.length*4),d=new DataView(b);values.forEach((v,i)=>d.setUint32(i*4,v,little));return b;}
 function reject(fn) {let threw=false;try{fn();}catch(e){threw=true;}assert(threw,'Expected rejection');passed++;}
 const tree=inspectP3D(words([0xff443350,12,60,1,12,36,2,12,12,2,12,12,3,12,12]));
 assert(tree.chunks.map(c=>c.id).join(',')==='4282659664,1,2,2,3','Nested chunk traversal');
 assert(tree.chunks.map(c=>c.parent).join(',')==='-1,0,1,1,0','Chunk ownership');passed+=2;
 assert(inspectP3D(words([0xff443350,12,24,1,12,12],false)).littleEndian===false,'Big endian');passed++;
 for(const v of [[],[0xff443350,12,24],[0xff443350,8,12],[0xff443350,12,28,1,12,16,0],[0x5a443350,12,12],[0,12,12]])reject(()=>inspectP3D(words(v)));
 const u32=n=>Array.from(new Uint8Array(words([n])));
 const pstr=s=>[s.length,...Array.from(s).map(c=>c.charCodeAt(0))];
 const chunk=(id,data=[],children=[])=>[...u32(id),...u32(12+data.length),...u32(12+data.length+children.length),...data,...children];
 const floats=values=>Array.from(new Uint8Array(new Float32Array(values).buffer));
 const positions=[0,0,0,1,0,0,0,1,0];
 function mesh(indices=[0,1,2],verts=positions) {
   const list=chunk(0x10005,[...u32(3),...floats(verts)]);
   const index=chunk(0x1000a,[...u32(indices.length),...indices.reduce((out,n)=>out.concat(u32(n)),[])]);
   const prim=chunk(0x10002,[...u32(0),...pstr('shader'),...u32(0),...u32(1),...u32(3),...u32(indices.length),...u32(0)],[...list,...index]);
   return new Uint8Array(chunk(0xff443350,[],chunk(0x10000,pstr('test-mesh'),prim))).buffer;
 }
 const scene=readScene(mesh());
 assert(scene.groups.length===1 && scene.groups[0].positions.length===9,'Original vertex layout');
 assert(scene.groups[0].indices[2]===2,'Original index layout');passed+=2;
 reject(()=>readScene(mesh([0,1,5])));
 reject(()=>readScene(mesh([0,1,2],[NaN,0,0,1,0,0,0,1,0])));
 assert(readScene(words([0xff443350,12,12])).groups.length===0,'Empty scene');passed++;
 return passed;
}
