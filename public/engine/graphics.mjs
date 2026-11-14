// Launcher-side graphics controls. The pinned engine files remain unmodified.
export const DEFAULT_GRAPHICS=Object.freeze({aspect:'wide',quality:'1080',antialias:true});
export function normalizeGraphics(value={}){
  return {aspect:['wide','classic'].includes(value.aspect)?value.aspect:DEFAULT_GRAPHICS.aspect,
    quality:['native','720','1080','1440'].includes(value.quality)?value.quality:DEFAULT_GRAPHICS.quality,
    antialias:typeof value.antialias==='boolean'?value.antialias:DEFAULT_GRAPHICS.antialias};
}
export function renderSize(width,height,settings){
  const aspect=settings.aspect==='wide'?16/9:width/Math.max(1,height);
  const h=settings.quality==='native'?Math.max(1,height):Number(settings.quality);
  return {width:Math.max(1,Math.round(h*aspect)),height:h};
}
export function correctProjection(matrix,aspect,logicalAspect){
  const out=new Float32Array(matrix);
  if(out.length!==16)return out;
  const perspective=Math.abs(out[15])<1e-6&&Math.abs(out[11])>0.5;
  const source=perspective?Math.abs(out[5]/out[0]):logicalAspect;
  if(!Number.isFinite(source)||source<=0||!Number.isFinite(aspect)||aspect<=0)return out;
  const scale=source/aspect;
  // Scale the clip-space X row, retaining centered 4:3 menus/HUD rather than
  // stretching them. Perspective keeps vertical FOV and reveals more sideways.
  for(const index of [0,4,8,12])out[index]*=scale;
  return out;
}
export function installGraphics(canvas,value,{onContext=()=>{},onUnsupported=()=>{}}={}){
  const settings=normalizeGraphics(value);
  const prototype=Object.getPrototypeOf(canvas);
  function descriptor(name){let p=prototype;while(p){const d=Object.getOwnPropertyDescriptor(p,name);if(d)return d;p=Object.getPrototypeOf(p);}throw new Error('Canvas dimension API unavailable');}
  const widthProperty=descriptor('width'),heightProperty=descriptor('height');
  let width=widthProperty.get.call(canvas),height=heightProperty.get.call(canvas);
  const getContext=canvas.getContext.bind(canvas);
  function resize(){
    const size=renderSize(width,height,settings);
    if(widthProperty.get.call(canvas)!==size.width)widthProperty.set.call(canvas,size.width);
    if(heightProperty.get.call(canvas)!==size.height)heightProperty.set.call(canvas,size.height);
  }
  // Keep the engine's logical dimensions and mouse coordinates intact, while
  // allocating a larger drawing buffer through the native DOM descriptors.
  Object.defineProperties(canvas,{
    width:{configurable:true,get:()=>width,set:n=>{width=Math.max(1,Number(n)>>>0);resize();}},
    height:{configurable:true,get:()=>height,set:n=>{height=Math.max(1,Number(n)>>>0);resize();}},
  });
  const contexts=new WeakSet();
  canvas.getContext=function(kind,attributes){
    const webgl=['webgl','webgl2','experimental-webgl'].includes(kind);
    let gl=getContext(kind,webgl?{...attributes,antialias:settings.antialias}:attributes);
    if(!gl&&webgl&&settings.antialias)gl=getContext(kind,{...attributes,antialias:false});
    if(!gl||!webgl||contexts.has(gl))return gl;
    contexts.add(gl);
    const projectionLocations=new WeakSet();
    const original={};
    for(const name of ['getUniformLocation','uniformMatrix4fv','viewport','scissor','getParameter','bindFramebuffer','bindTexture'])original[name]=gl[name].bind(gl);
    let framebuffer=null,projectionSeen=false;
    const scaleBox=(x,y,w,h)=>{
      const size=renderSize(width,height,settings);
      return [Math.round(x*size.width/width),Math.round(y*size.height/height),Math.round(w*size.width/width),Math.round(h*size.height/height)];
    };
    gl.bindFramebuffer=function(target,buffer){
      if(target===gl.FRAMEBUFFER||target===gl.DRAW_FRAMEBUFFER)framebuffer=buffer;
      return original.bindFramebuffer(target,buffer);
    };
    gl.viewport=function(x,y,w,h){return original.viewport(...(framebuffer?[x,y,w,h]:scaleBox(x,y,w,h)));};
    gl.scissor=function(x,y,w,h){return original.scissor(...(framebuffer?[x,y,w,h]:scaleBox(x,y,w,h)));};
    gl.getParameter=function(parameter){
      const result=original.getParameter(parameter);
      if(!framebuffer&&(parameter===gl.VIEWPORT||parameter===gl.SCISSOR_BOX)){
        const size=renderSize(width,height,settings);
        return new Int32Array([Math.round(result[0]*width/size.width),Math.round(result[1]*height/size.height),Math.round(result[2]*width/size.width),Math.round(result[3]*height/size.height)]);
      }
      return result;
    };
    gl.getUniformLocation=function(program,name){
      const location=original.getUniformLocation(program,name);
      if(location&&name==='projection')projectionLocations.add(location);
      return location;
    };
    gl.uniformMatrix4fv=function(location,transpose,data,offset=0,length){
      if(!framebuffer&&settings.aspect==='wide'&&projectionLocations.has(location)){
        const matrix=data.subarray?data.subarray(offset,offset+16):data.slice(offset,offset+16);
        if(matrix.length===16){projectionSeen=true;return original.uniformMatrix4fv(location,transpose,correctProjection(matrix,16/9,width/height));}
      }
      return length===undefined?(offset?original.uniformMatrix4fv(location,transpose,data,offset):original.uniformMatrix4fv(location,transpose,data)):original.uniformMatrix4fv(location,transpose,data,offset,length);
    };
    const extension=gl.getExtension('EXT_texture_filter_anisotropic')||gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic')||gl.getExtension('MOZ_EXT_texture_filter_anisotropic');
    const anisotropy=extension?Math.min(8,original.getParameter(extension.MAX_TEXTURE_MAX_ANISOTROPY_EXT)):1;
    const textures=new WeakSet();
    gl.bindTexture=function(target,texture){
      original.bindTexture(target,texture);
      if(extension&&target===gl.TEXTURE_2D&&texture&&!textures.has(texture)){
        gl.texParameterf(target,extension.TEXTURE_MAX_ANISOTROPY_EXT,anisotropy);textures.add(texture);
      }
    };
    onContext({antialias:!!gl.getContextAttributes()?.antialias,anisotropy});
    // Called after boot so a different shader interface fails back to classic.
    canvas.checkWidescreenSupport=()=>{
      if(settings.aspect==='wide'&&!projectionSeen){settings.aspect='classic';resize();onUnsupported();}
      return projectionSeen;
    };
    return gl;
  };
  resize();
  return settings;
}
