import {readZip,selectGameEntries,entryStream} from './zip.mjs';
export const LOCAL_ASSETS='/local-game-assets/';
async function vault(){
  if(!navigator.storage?.getDirectory)throw new Error('This browser cannot store game files locally. Try an up-to-date Chrome, Edge or Firefox browser.');
  return (await navigator.storage.getDirectory()).getDirectoryHandle('hit-and-run-game',{create:true});
}
export async function importedGame(){
  try{
    const file=await (await (await vault()).getFileHandle('mount.json')).getFile();
    const manifest=JSON.parse(await file.text());
    return manifest.version===1&&manifest.generation?.startsWith('import-')&&manifest.paths?.['scripts.rcf']?manifest:null;
  }catch{return null;}
}
export async function activateLocalFiles(){
  if(!navigator.serviceWorker)throw new Error('Game ZIP loading requires HTTPS or localhost and service worker support.');
  const registration=await navigator.serviceWorker.register('/game-files-sw.js',{scope:'/',type:'module'});
  await navigator.serviceWorker.ready;
  if(!navigator.serviceWorker.controller)await new Promise((resolve,reject)=>{
    const done=()=>{clearTimeout(timer);navigator.serviceWorker.removeEventListener('controllerchange',done);resolve();};
    const timer=setTimeout(()=>{navigator.serviceWorker.removeEventListener('controllerchange',done);reject(new Error('Game file loader could not activate. Refresh the page and try again.'));},10000);
    navigator.serviceWorker.addEventListener('controllerchange',done);
    if(navigator.serviceWorker.controller)done();
  });
  (registration.active||navigator.serviceWorker.controller)?.postMessage({type:'refresh-game-files'});
  return LOCAL_ASSETS;
}
export async function importGameZip(file,onProgress=()=>{}){
  const entries=selectGameEntries(await readZip(file));
  const total=entries.reduce((n,e)=>n+e.size,0);
  const estimate=await navigator.storage?.estimate?.();
  if(estimate?.quota&&estimate.quota-(estimate.usage||0)<total*1.05)throw new Error('Not enough browser storage. Free at least '+(total/1024**3).toFixed(1)+' GB and try again.');
  // Every import uses a new directory; the previous working mount is replaced
  // only after all files pass length and CRC checks.
  const directory=await vault(),previous=await importedGame(),generation='import-'+crypto.randomUUID();
  for await(const [name] of directory.entries())if(name.startsWith('import-')&&name!==previous?.generation)try{await directory.removeEntry(name,{recursive:true});}catch{}
  const staging=await directory.getDirectoryHandle(generation,{create:true});
  const paths={};let done=0,published=false;
  try{
    for(let i=0;i<entries.length;i++){
      const entry=entries[i],key='asset-'+i;
      onProgress({file:entry.path,completed:done,total,index:i,count:entries.length});
      const output=await (await staging.getFileHandle(key,{create:true})).createWritable();
      try{const input=await entryStream(file,entry);await input.pipeTo(output);}
      catch(error){try{await output.abort();}catch{}throw error;}
      paths[entry.path]=key;done+=entry.size;
    }
    const manifest={version:1,generation,paths,bytes:done,count:entries.length};
    const output=await (await directory.getFileHandle('mount.json',{create:true})).createWritable();
    await output.write(JSON.stringify(manifest));await output.close();published=true;
    if(previous?.generation&&previous.generation!==generation)try{await directory.removeEntry(previous.generation,{recursive:true});}catch{}
    onProgress({file:'Ready',completed:done,total,index:entries.length,count:entries.length});
    return manifest;
  }finally{if(!published)try{await directory.removeEntry(generation,{recursive:true});}catch{}}
}

export async function checkLocalFiles(){
  const response=await fetch(LOCAL_ASSETS+'scripts.rcf',{headers:{Range:'bytes=0-0'},cache:'no-store'});
  if(response.status!==206||!response.headers.get('Content-Range')?.startsWith('bytes 0-0/'))throw new Error('The browser could not read its imported game files. Refresh the page; if needed, try a current Chrome or Edge browser.');
  await response.arrayBuffer();
}
