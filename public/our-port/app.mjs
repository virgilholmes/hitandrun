const status=document.getElementById('status'),sample=document.getElementById('sample'),area=document.getElementById('area'),files=document.getElementById('files');
const select=document.getElementById('mesh'),canvas=document.getElementById('canvas'),fit=document.getElementById('fit'),house=document.getElementById('house');
let module,readScene,createRenderer,mergeArea,SPRINGFIELD,renderer,areaActive=false;
function message(error){status.textContent=error.message||String(error);}
function probe(buffer){
 if(buffer.byteLength>64*1024*1024)throw new Error('Choose a file smaller than 64 MiB.');
 const ptr=module._malloc(Math.max(1,buffer.byteLength));
 if(!ptr)throw new Error('Could not allocate asset memory.');
 try{
  module.HEAPU8.set(new Uint8Array(buffer),ptr);
  if(!module._hr_source_probe(ptr,buffer.byteLength))throw new Error(module.UTF8ToString(module._hr_source_last_error()));
  return {chunks:module._hr_source_chunk_count(),meshes:module._hr_source_mesh_count(),textures:module._hr_source_texture_count()};
 }finally{module._free(ptr);}
}
async function fetchAsset(path){const r=await fetch('/assets/'+path);if(!r.ok)throw new Error('Could not load '+path+' (HTTP '+r.status+').');return r.arrayBuffer();}
async function display(scene,summary,isArea=false){
 renderer?.dispose();renderer=null;areaActive=false;
 if(!scene.groups.length){status.textContent=summary+'\nThis file has no supported geometry.';return;}
 status.textContent='Preparing '+scene.groups.length+' primitive groups and '+scene.textures.size+' textures…';
 renderer=await createRenderer(canvas,scene,{onError:message});renderer.select('');
 select.replaceChildren(new Option('All meshes',''),...renderer.names.map(name=>new Option(name,name)));
 select.value='';select.disabled=false;fit.disabled=false;areaActive=isArea;house.disabled=!isArea;
 if(isArea)renderer.focus(SPRINGFIELD.house,140);
 status.textContent=summary;
 canvas.focus();
}
async function inspect(buffer){
 const info=probe(buffer),scene=readScene(buffer);
 let summary=`Original C++ reader: ${info.chunks} chunks, ${info.meshes} meshes, ${info.textures} textures.\nModule compiled from our source build; no downloaded game engine is loaded.`;
 if(scene.assembly)summary+=`\nAssembled ${scene.assembly.props.length} parts using the original ${scene.assembly.skeleton} skeleton rest pose.`;
 await display(scene,summary);
}
async function load(action){
 sample.disabled=area.disabled=files.disabled=select.disabled=fit.disabled=house.disabled=true;
 try{await action();}catch(e){message(e);}
 finally{sample.disabled=area.disabled=files.disabled=false;select.disabled=fit.disabled=!renderer;house.disabled=!renderer||!areaActive;}
}
sample.onclick=()=>load(async()=>inspect(await fetchAsset('art/cars/famil_v.p3d')));
area.onclick=()=>load(async()=>{
 const paths=[SPRINGFIELD.resources,...SPRINGFIELD.regions],scenes=[];let chunks=0;
 for(let i=0;i<paths.length;i++){
  status.textContent=`Loading Springfield (${i+1}/${paths.length}): ${paths[i]}…`;
  const buffer=await fetchAsset(paths[i]);chunks+=probe(buffer).chunks;scenes.push(readScene(buffer));
 }
 const scene=mergeArea(scenes[0],scenes.slice(1));
 let summary=`Springfield neighborhood loaded: ${paths.length} original files, ${chunks.toLocaleString()} C++-validated chunks.\n${scene.groups.length} primitive groups, ${scene.textures.size} shared textures. Camera starts near the Simpsons’ house.`;
 if(scene.missingTextures.length)summary+=`\nMissing textures: ${scene.missingTextures.length}.`;
 await display(scene,summary,true);
});
files.onchange=()=>{if(files.files[0])load(async()=>inspect(await files.files[0].arrayBuffer()));};
select.onchange=()=>renderer?.select(select.value);
fit.onclick=()=>{renderer?.select('');select.value='';canvas.focus();};
house.onclick=()=>{renderer?.select('');renderer?.focus(SPRINGFIELD.house,140);select.value='';canvas.focus();};
window.addEventListener('pagehide',()=>renderer?.dispose());
try{
 const factory=(await import('./source-core.mjs')).default;
 module=await factory();
 if(module._hr_math_init()!==0)throw new Error('Original math initialization failed.');
 ({readScene}=await import('./scene.mjs'));({createRenderer}=await import('./renderer.mjs'));
 ({mergeArea,SPRINGFIELD}=await import('./springfield.mjs'));
 status.textContent='Our original-source module is ready. Choose the family car or Springfield neighborhood.';
 sample.disabled=area.disabled=files.disabled=false;
}catch(e){status.textContent='Our source module has not been built successfully yet.\nRun: python scripts/build-own-port.py\n\n'+e.message;}
