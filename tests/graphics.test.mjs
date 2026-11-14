import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeGraphics,renderSize,correctProjection,installGraphics} from '../public/engine/graphics.mjs';
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-5,`${actual} != ${expected}`);
test('widescreen increases horizontal field of view without changing vertical projection or engine memory',()=>{
 const source=new Float32Array([1,0,0,0,0,4/3,0,0,0,0,1,1,0,0,-1,0]);
 const fixed=correctProjection(source,16/9,4/3);
 near(fixed[0],.75);near(fixed[5],4/3);assert.equal(source[0],1);
 // At constant depth, an original center-to-edge distance of 1 fits at .75.
 near(fixed[0]/source[0],.75);assert.deepEqual(correctProjection(source,16/9,4/3),fixed);
});
test('UI stays centered and retains its original proportions',()=>{
 const ui=new Float32Array([2/800,0,0,0,0,-2/600,0,0,0,0,1,0,-1,1,0,1]);
 const fixed=correctProjection(ui,16/9,4/3);
 near(0*fixed[0]+fixed[12],-.75);near(800*fixed[0]+fixed[12],.75);
 near(400*fixed[0]+fixed[12],0);assert.equal(fixed[5],ui[5]);
});
function fakeGraphics(){
 const calls={viewport:[],scissor:[],matrices:[],textures:[],attributes:[]};
 const extension={MAX_TEXTURE_MAX_ANISOTROPY_EXT:90,TEXTURE_MAX_ANISOTROPY_EXT:91};
 let viewport=new Int32Array([0,0,1920,1080]);
 const gl={FRAMEBUFFER:1,DRAW_FRAMEBUFFER:2,VIEWPORT:3,SCISSOR_BOX:4,TEXTURE_2D:5,
  getUniformLocation:()=>({}),uniformMatrix4fv:(...args)=>calls.matrices.push(args),
  viewport:(...args)=>{calls.viewport.push(args);viewport=new Int32Array(args);},
  scissor:(...args)=>calls.scissor.push(args),getParameter:p=>p===90?16:viewport,
  bindFramebuffer(){},bindTexture(){},getExtension:name=>name==='EXT_texture_filter_anisotropic'?extension:null,
  texParameterf:(...args)=>calls.textures.push(args),getContextAttributes:()=>({antialias:true})};
 class Canvas{
  #width=800;#height=600;
  get width(){return this.#width;}set width(n){this.#width=n;}
  get height(){return this.#height;}set height(n){this.#height=n;}
  getContext(kind,attrs){calls.attributes.push(attrs);return gl;}
  get backing(){return [this.#width,this.#height];}
 }
 return {canvas:new Canvas(),gl,calls};
}
test('HD buffers preserve logical input size and scale screen viewports but leave framebuffer passes alone',()=>{
 const {canvas,gl,calls}=fakeGraphics();installGraphics(canvas,{aspect:'wide',quality:'1080',antialias:true});
 canvas.getContext('webgl',{antialias:false});
 assert.deepEqual(canvas.backing,[1920,1080]);assert.deepEqual([canvas.width,canvas.height],[800,600]);
 assert.equal(calls.attributes[0].antialias,true);
 gl.viewport(0,0,800,600);assert.deepEqual(calls.viewport.at(-1),[0,0,1920,1080]);
 assert.deepEqual([...gl.getParameter(gl.VIEWPORT)],[0,0,800,600]);
 gl.scissor(100,100,200,300);assert.deepEqual(calls.scissor.at(-1),[240,180,480,540]);
 const projection=gl.getUniformLocation({},'projection');
 const matrix=new Float32Array([1,0,0,0,0,4/3,0,0,0,0,1,1,0,0,-1,0]);
 gl.uniformMatrix4fv(projection,false,matrix);near(calls.matrices.at(-1)[2][0],.75);
 const modelview=gl.getUniformLocation({},'modelview');
 gl.uniformMatrix4fv(modelview,false,matrix);assert.equal(calls.matrices.at(-1)[2],matrix);
 gl.bindFramebuffer(gl.FRAMEBUFFER,{});gl.viewport(0,0,256,256);
 assert.deepEqual(calls.viewport.at(-1),[0,0,256,256]);
 gl.uniformMatrix4fv(projection,false,matrix);assert.equal(calls.matrices.at(-1)[2],matrix);
 gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.uniformMatrix4fv(projection,false,matrix);
 assert.equal(canvas.checkWidescreenSupport(),true);
 const texture={};gl.bindTexture(gl.TEXTURE_2D,texture);gl.bindTexture(gl.TEXTURE_2D,texture);
 assert.deepEqual(calls.textures,[[gl.TEXTURE_2D,91,8]]);
});
test('classic fallback restores 4:3 buffers when the engine shader does not support projection correction',()=>{
 const {canvas}=fakeGraphics();let unsupported=0;
 installGraphics(canvas,{aspect:'wide',quality:'720'},{onUnsupported:()=>unsupported++});canvas.getContext('webgl');
 assert.equal(canvas.checkWidescreenSupport(),false);assert.equal(unsupported,1);
 assert.deepEqual(canvas.backing,[960,720]);assert.deepEqual([canvas.width,canvas.height],[800,600]);
});
test('quality and aspect choices are constrained and native 4:3 remains available',()=>{
 assert.deepEqual(normalizeGraphics({quality:'bogus',aspect:'bogus'}),normalizeGraphics());
 assert.deepEqual(renderSize(800,600,normalizeGraphics({aspect:'classic',quality:'native'})),{width:800,height:600});
 assert.deepEqual(renderSize(800,600,normalizeGraphics({quality:'1440'})),{width:2560,height:1440});
});
