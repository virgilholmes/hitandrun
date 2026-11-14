import { inspectP3D } from './p3d.mjs';
// Layouts checked against the supplied Pure3D geometry, primitive group,
// texture and shader loaders. This is an asset renderer, not game simulation.
export function readScene(buffer) {
  const inspection = inspectP3D(buffer);
  const { chunks, littleEndian: le } = inspection;
  const view = new DataView(buffer);
  const children = chunks.map(() => []);
  chunks.forEach((c,i) => { if (c.parent >= 0) children[c.parent].push(i); });
  function reader(c) {
    let p = c.offset + 12;
    const end = c.offset + c.dataLength;
    const need = n => { if (n > end - p) throw new Error(`Truncated payload at ${p}.`); };
    return {
      u32() { need(4); const n = view.getUint32(p,le); p+=4; return n; },
      str() {
        need(1); const n = view.getUint8(p++); need(n);
        let s=''; for(let i=0;i<n;i++) { const b=view.getUint8(p+i); if(b) s+=String.fromCharCode(b); }
        p+=n; return s;
      },
      floats(n) {
        if (n > 6000000) throw new Error('Too many vertex values.');
        need(n*4); const a=new Float32Array(n);
        for(let i=0;i<n;i++) { a[i]=view.getFloat32(p,le); p+=4; if(!Number.isFinite(a[i])) throw new Error('Non-finite vertex value.'); }
        return a;
      },
      bytes(n) { need(n); const b=new Uint8Array(buffer,p,n); p+=n; return b; },
    };
  }
  const shaders = new Map(), textures = new Map(), groups = [], warnings = new Set();
  for(let i=0;i<chunks.length;i++) {
    const c=chunks[i];
    if(c.id===0x11000) {
      const r=reader(c), name=r.str();
      const shader={name,texture:null,uvMode:0};
      for(const j of children[i]) if(chunks[j].id===0x11002) {
        const p=reader(chunks[j]);
        // TEX\0 in the chunk's native byte order.
        if(p.u32()===(le ? 0x00584554 : 0x54455800)) shader.texture=p.str();
      }
      for(const j of children[i])if(chunks[j].id===0x11003){
        const p=reader(chunks[j]);if(p.u32()===(le?0x444d5655:0x55564d44))shader.uvMode=p.u32();
      }
      shaders.set(name,shader);
    }
    if(c.id===0x19000) {
      const name=reader(c).str();
      const imageIndex=children[i].find(j=>chunks[j].id===0x19001);
      if(imageIndex===undefined) continue;
      const dataIndex=children[imageIndex].find(j=>chunks[j].id===0x19002);
      if(dataIndex===undefined) continue;
      const r=reader(chunks[dataIndex]), bytes=r.bytes(r.u32());
      if(bytes.length>=8 && bytes[0]===137 && bytes[1]===80 && bytes[2]===78 && bytes[3]===71)
        textures.set(name,bytes);
      else warnings.add('Some textures use an unsupported image encoding.');
    }
    if(c.id!==0x10002) continue;
    const owner=chunks[c.parent];
    if(!owner || (owner.id!==0x10000 && owner.id!==0x10001)) continue;
    const name=reader(owner).str();
    const r=reader(c); r.u32(); const shader=r.str(), type=r.u32();
    r.u32(); const vertexCount=r.u32(), indexCount=r.u32(); r.u32();
    const g={name,shader,type,positions:null,normals:null,uvs:null,colors:null,indices:null};
    for(const j of children[i]) {
      const sub=chunks[j], s=reader(sub);
      if(![0x10005,0x10006,0x10007,0x10008,0x1000a].includes(sub.id)) continue;
      const n=s.u32();
      if(sub.id===0x1000a) {
        if(n!==indexCount || n>6000000) throw new Error('Invalid index count.');
        g.indices=new Uint32Array(n);
        for(let k=0;k<n;k++) { const index=s.u32(); if(index>=vertexCount) throw new Error('Vertex index out of range.'); g.indices[k]=index; }
      } else {
        if(n!==vertexCount) throw new Error('Vertex count mismatch.');
        if(sub.id===0x10005) g.positions=s.floats(n*3);
        if(sub.id===0x10006) g.normals=s.floats(n*3);
        if(sub.id===0x10007) { const channel=s.u32(), uv=s.floats(n*2); if(channel===0)g.uvs=uv; }
        if(sub.id===0x10008) {
          g.colors=new Float32Array(n*4);
          for(let k=0;k<n;k++) { const argb=s.u32(); g.colors.set([(argb>>>16&255)/255,(argb>>>8&255)/255,(argb&255)/255,(argb>>>24)/255],k*4); }
        }
      }
    }
    if(!g.positions) { warnings.add('Memory-imaged geometry is not supported.'); continue; }
    if(![0,1,2,3,4].includes(type)) { warnings.add('An unsupported primitive type was skipped.'); continue; }
    if(owner.id===0x10001) warnings.add('Skinned meshes are shown in their bind pose.');
    groups.push(g);
  }
  // Original skeleton.cpp computes world = local * parent (row vectors).
  // The same flat arrays act as transposed column matrices in WebGL notation.
  const multiply=(a,b)=>{
    const out=new Float32Array(16);
    for(let c=0;c<4;c++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)out[c*4+row]+=a[k*4+row]*b[c*4+k];
    return out;
  };
  const skeletons=new Map();
  for(let i=0;i<chunks.length;i++)if(chunks[i].id===0x4500){
    const r=reader(chunks[i]),name=r.str();r.u32();const count=r.u32(),joints=[];
    for(const j of children[i])if(chunks[j].id===0x4501){
      const p=reader(chunks[j]),jointName=p.str(),parent=p.u32();
      for(let k=0;k<5;k++)p.u32();
      const local=p.floats(16),index=joints.length;
      if(index && parent>=index)throw new Error('Invalid skeleton parent order.');
      joints.push({name:jointName,world:index?multiply(joints[parent].world,local):local});
    }
    if(joints.length!==count)throw new Error('Skeleton joint count mismatch.');
    skeletons.set(name,joints);
  }
  function transformGroup(g,m,instance){
    const positions=new Float32Array(g.positions.length);
    for(let i=0;i<positions.length;i+=3){
      const x=g.positions[i],y=g.positions[i+1],z=g.positions[i+2];
      positions[i]=m[0]*x+m[4]*y+m[8]*z+m[12];
      positions[i+1]=m[1]*x+m[5]*y+m[9]*z+m[13];
      positions[i+2]=m[2]*x+m[6]*y+m[10]*z+m[14];
    }
    let normals=null;
    if(g.normals){
      normals=new Float32Array(g.normals.length);
      // Cofactor matrix gives inverse-transpose up to a common determinant.
      const a=m[0],b=m[4],c=m[8],d=m[1],e=m[5],f=m[9],h=m[2],j=m[6],k=m[10];
      const n=[e*k-f*j,f*h-d*k,d*j-e*h,c*j-b*k,a*k-c*h,b*h-a*j,b*f-c*e,c*d-a*f,a*e-b*d];
      const determinant=a*n[0]+b*n[1]+c*n[2];
      if(Math.abs(determinant)<1e-12)throw new Error('Singular joint transform.');
      for(let i=0;i<normals.length;i+=3){
        const x=g.normals[i],y=g.normals[i+1],z=g.normals[i+2];
        const nx=(n[0]*x+n[1]*y+n[2]*z)/determinant,ny=(n[3]*x+n[4]*y+n[5]*z)/determinant,nz=(n[6]*x+n[7]*y+n[8]*z)/determinant;
        const length=Math.hypot(nx,ny,nz)||1;normals.set([nx/length,ny/length,nz/length],i);
      }
    }
    return {...g,positions,normals,instance};
  }
  let assembled=null,assembly=null;
  for(let i=0;i<chunks.length;i++)if(chunks[i].id===0x4512){
    const r=reader(chunks[i]),name=r.str(),skeleton=r.str(),joints=skeletons.get(skeleton);
    if(!joints)continue;
    const props=[];
    for(const list of children[i])if(chunks[list].id===0x4514)for(const j of children[list])if(chunks[j].id===0x4516){
      const p=reader(chunks[j]),mesh=p.str();p.u32();const joint=p.u32();
      if(joint>=joints.length)throw new Error('Composite prop joint is out of bounds.');
      if(groups.some(g=>g.name===mesh))props.push({mesh,joint,matrix:joints[joint].world});
    }
    if(!props.length || groups.some(g=>!props.some(prop=>prop.mesh===g.name)))continue;
    assembled=[];
    props.forEach((prop,instance)=>{for(const g of groups)if(g.name===prop.mesh)assembled.push(transformGroup(g,prop.matrix,instance));});
    assembly={name,skeleton,props};break;
  }
  return { groups:assembled||groups, rawGroups:groups, assembly, shaders, textures, warnings:[...warnings], inspection };
}
