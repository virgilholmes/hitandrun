import {assetResponse} from './engine/asset-response.mjs';
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
let cached=null;
self.addEventListener('message',event=>{if(event.data?.type==='refresh-game-files')cached=null;});
async function localAsset(request,url){
  if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405});
  try{
    const path=decodeURIComponent(url.pathname.slice('/local-game-assets/'.length)).replaceAll('\\','/').toLowerCase();
    if(path.split('/').some(p=>!p||p==='..'||p==='.'||p.includes(':')||p.includes('\0')))return new Response(null,{status:404});
    const vault=await (await navigator.storage.getDirectory()).getDirectoryHandle('hit-and-run-game');
    if(!cached)cached=JSON.parse(await (await (await vault.getFileHandle('mount.json')).getFile()).text());
    const key=Object.hasOwn(cached.paths,path)?cached.paths[path]:null;
    if(!key)return new Response(null,{status:404});
    const generation=await vault.getDirectoryHandle(cached.generation);
    const file=await (await generation.getFileHandle(key)).getFile();
    return assetResponse(file,request);
  }catch{return new Response('Local game file unavailable. Re-import your game ZIP.',{status:404});}
}
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(url.origin===self.location.origin&&url.pathname.startsWith('/local-game-assets/'))event.respondWith(localAsset(event.request,url));
});
