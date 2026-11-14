import { createOrbitCamera } from './camera.mjs';
const VERTEX = `
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aUV;
attribute vec4 aColor;
uniform mat4 uMVP;
varying vec2 vUV;
varying vec4 vColor;
varying float vLight;
void main() {
  gl_Position=uMVP*vec4(aPosition,1.0);
  vUV=aUV; vColor=aColor;
  float n=length(aNormal);
  vLight=n>0.01 ? 0.55+0.45*abs(dot(normalize(aNormal),normalize(vec3(0.3,0.8,0.5)))) : 1.0;
}`;
const FRAGMENT = `
precision mediump float;
uniform sampler2D uTexture;
uniform bool uHasTexture;
varying vec2 vUV;
varying vec4 vColor;
varying float vLight;
void main() {
 vec4 color=vColor;
 if(uHasTexture) color*=texture2D(uTexture,vUV);
 if(color.a<0.1) discard;
 gl_FragColor=vec4(color.rgb*vLight,1.0);
}`;
function multiply(a,b) {
 const out=new Float32Array(16);
 for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)out[c*4+r]+=a[k*4+r]*b[c*4+k];
 return out;
}
function viewMatrix(eye,center) {
 const norm=v=>{const n=Math.hypot(...v)||1;return v.map(x=>x/n);};
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const z=norm(eye.map((v,i)=>v-center[i])),x=norm(cross([0,1,0],z)),y=cross(z,x);
 const dot=v=>-v.reduce((s,n,i)=>s+n*eye[i],0);
 return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,dot(x),dot(y),dot(z),1]);
}
function perspective(aspect,near,far) {
 const f=1/Math.tan(Math.PI/8),nf=1/(near-far);
 return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]);
}
export async function createRenderer(canvas,scene,{onError=()=>{}}={}) {
 const gl=canvas.getContext('webgl',{antialias:true,preserveDrawingBuffer:true});
 if(!gl)throw new Error('WebGL is unavailable in this browser.');
 const buffers=[],textures=[],shaderObjects=[];
 let program=null,disposed=false,frame=0;
 function cleanResources() {
   buffers.forEach(b=>gl.deleteBuffer(b)); textures.forEach(t=>gl.deleteTexture(t));
   shaderObjects.forEach(s=>gl.deleteShader(s)); if(program)gl.deleteProgram(program);
 }
 function shader(type,source) {
   const s=gl.createShader(type); shaderObjects.push(s); gl.shaderSource(s,source);gl.compileShader(s);
   if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)||'Shader compilation failed.');
   return s;
 }
 const gpu=[],gpuTextures=new Map();
 let fallbackTexture=null;
 try {
   program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,VERTEX));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,FRAGMENT));gl.linkProgram(program);
   if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||'Shader linking failed.');
   gl.useProgram(program);
   fallbackTexture=gl.createTexture();textures.push(fallbackTexture);gl.bindTexture(gl.TEXTURE_2D,fallbackTexture);
   gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
   let expandedBytes=0;
   function upload(data,target=gl.ARRAY_BUFFER) {
     const b=gl.createBuffer();buffers.push(b);gl.bindBuffer(target,b);gl.bufferData(target,data,gl.STATIC_DRAW);return b;
   }
   // Expand indices once to avoid relying on optional 32-bit index extensions.
   function attribute(values,width,indices,fallback,count) {
     const out=new Float32Array(count*width);
     for(let i=0;i<count;i++)for(let c=0;c<width;c++)out[i*width+c]=values ? values[(indices?indices[i]:i)*width+c] : fallback[c];
     return upload(out);
   }
   for(const group of scene.groups) {
     const count=group.indices ? group.indices.length : group.positions.length/3;
     if(!count)continue;
     expandedBytes+=count*12*4;
     if(expandedBytes>128*1024*1024)throw new Error('Geometry exceeds the 128 MiB GPU budget. Choose a smaller asset.');
     gpu.push({name:group.name,shader:group.shader,type:group.type,count,
       position:attribute(group.positions,3,group.indices,[0,0,0],count),
       normal:attribute(group.normals,3,group.indices,[0,0,0],count),
       uv:attribute(group.uvs,2,group.indices,[0,0],count),
       color:attribute(group.colors,4,group.indices,[1,1,1,1],count)});
   }
   // Browsers decode the original embedded PNG payloads; no proprietary codec.
   for(const [name,bytes] of scene.textures) {
     const url=URL.createObjectURL(new Blob([bytes],{type:'image/png'}));
     try {
       const image=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error(`Could not decode texture ${name}.`));i.src=url;});
       if(image.width>8192 || image.height>8192)throw new Error('Texture exceeds 8192 pixels.');
       const t=gl.createTexture();textures.push(t);gl.bindTexture(gl.TEXTURE_2D,t);
       gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
       gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
       gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
       gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
       gpuTextures.set(name,{handle:t,pot:(image.width&(image.width-1))===0&&(image.height&(image.height-1))===0});
     } finally { URL.revokeObjectURL(url); }
   }
 } catch(e) { cleanResources();throw e; }
 const names=[...new Set(gpu.map(g=>g.name))];
 let selected=names[0]||'';
 const camera=createOrbitCamera(),keys=new Set();let lastTime=null;
 let drag=null;
 const loc=Object.fromEntries(['aPosition','aNormal','aUV','aColor'].map(name=>[name,gl.getAttribLocation(program,name)]));
 const mvp=gl.getUniformLocation(program,'uMVP'),hasTexture=gl.getUniformLocation(program,'uHasTexture');
 gl.uniform1i(gl.getUniformLocation(program,'uTexture'),0);
 const modes=[gl.TRIANGLES,gl.TRIANGLE_STRIP,gl.LINES,gl.LINE_STRIP,gl.POINTS];
 function fit() {
   const low=[Infinity,Infinity,Infinity],high=[-Infinity,-Infinity,-Infinity];
   for(const g of scene.groups)if(selected==='' || g.name===selected)for(let i=0;i<g.positions.length;i+=3)for(let c=0;c<3;c++) {
     low[c]=Math.min(low[c],g.positions[i+c]);high[c]=Math.max(high[c],g.positions[i+c]);
   }
   camera.fit(low,high);
 }
 function draw(timestamp=performance.now()) {
   if(disposed)return;
   try {
     camera.move(keys,lastTime===null?0:(timestamp-lastTime)/1000);lastTime=timestamp;
     const scale=Math.min(globalThis.devicePixelRatio||1,2),w=Math.max(1,Math.round(canvas.clientWidth*scale)),h=Math.max(1,Math.round(canvas.clientHeight*scale));
     if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
     gl.viewport(0,0,w,h);gl.clearColor(0.045,0.065,0.105,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);
     const eye=camera.eye();
     const matrix=multiply(perspective(w/h,Math.max(.02,camera.distance/5000),Math.max(camera.radius*8,camera.distance*4)),viewMatrix(eye,camera.target));
     gl.useProgram(program);gl.uniformMatrix4fv(mvp,false,matrix);
     for(const g of gpu)if(selected===''||g.name===selected) {
       for(const [key,name,width] of [['position','aPosition',3],['normal','aNormal',3],['uv','aUV',2],['color','aColor',4]]) {
         if(loc[name]<0)continue;gl.bindBuffer(gl.ARRAY_BUFFER,g[key]);gl.enableVertexAttribArray(loc[name]);gl.vertexAttribPointer(loc[name],width,gl.FLOAT,false,0,0);
       }
       const material=scene.shaders.get(g.shader),texture=gpuTextures.get(material?.texture);
       gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture?.handle||fallbackTexture);gl.uniform1i(hasTexture,texture?1:0);
       if(texture){const wrap=texture.pot&&material.uvMode!==1?gl.REPEAT:gl.CLAMP_TO_EDGE;gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,wrap);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,wrap);}
       gl.drawArrays(modes[g.type],0,g.count);
     }
     frame=requestAnimationFrame(draw);
   } catch(e) { onError(e); }
 }
 const down=e=>{canvas.focus();drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);};
 const move=e=>{if(!drag)return;camera.orbit(e.clientX-drag[0],e.clientY-drag[1]);drag=[e.clientX,e.clientY];};
 const up=()=>{drag=null;};
 const wheel=e=>{e.preventDefault();camera.zoom(e.deltaY);};
 const supported=new Set(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight']);
 const keydown=e=>{if(supported.has(e.code)){e.preventDefault();keys.add(e.code);}if(e.code==='Home'){e.preventDefault();fit();}};
 const keyup=e=>keys.delete(e.code),blur=()=>keys.clear();
 canvas.addEventListener('keydown',keydown);canvas.addEventListener('blur',blur);window.addEventListener('keyup',keyup);window.addEventListener('blur',blur);
 const lost=e=>{e.preventDefault();onError(new Error('WebGL context lost. Reload the asset to continue.'));};
 canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);canvas.addEventListener('wheel',wheel,{passive:false});canvas.addEventListener('webglcontextlost',lost);
 fit();draw();
 return {
   names,selected,drawCalls:gpu.length,
   select(name){selected=name;fit();},fit,focus:(target,distance)=>camera.focus(target,distance),
   dispose(){disposed=true;cancelAnimationFrame(frame);canvas.removeEventListener('keydown',keydown);canvas.removeEventListener('blur',blur);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',blur);canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);canvas.removeEventListener('wheel',wheel);canvas.removeEventListener('webglcontextlost',lost);cleanResources();},
 };
}
