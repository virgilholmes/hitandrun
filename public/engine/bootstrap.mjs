import { normalizeGraphics, installGraphics } from './graphics.mjs';
import { verifyEngineBytes } from './integrity.mjs';
const canvas=document.getElementById('canvas'),overlay=document.getElementById('overlay');
const status=document.getElementById('status'),errorBox=document.getElementById('error');
const startButton=document.getElementById('start'),progress=document.getElementById('progress');
const logs=document.getElementById('logs');
const GRAPHICS_KEY='hit-and-run-graphics-v1';
const aspectSelect=document.getElementById('aspect'),qualitySelect=document.getElementById('quality'),antialiasInput=document.getElementById('antialias');
let graphics=normalizeGraphics();
try{graphics=normalizeGraphics(JSON.parse(localStorage.getItem(GRAPHICS_KEY)||'{}'));}catch{}
aspectSelect.value=graphics.aspect;qualitySelect.value=graphics.quality;antialiasInput.checked=graphics.antialias;
function updateGraphics(){
  graphics=normalizeGraphics({aspect:aspectSelect.value,quality:qualitySelect.value,antialias:antialiasInput.checked});
  document.documentElement.style.setProperty('--game-aspect',graphics.aspect==='wide'?'1.7777777778':'1.3333333333');
  try{localStorage.setItem(GRAPHICS_KEY,JSON.stringify(graphics));}catch{}
}
for(const input of [aspectSelect,qualitySelect,antialiasInput])input.addEventListener('change',updateGraphics);
updateGraphics();

const COMMIT='7712a23723a60c752682debf727be10488866d87';
const WASM_URL=`https://raw.githubusercontent.com/iscle/the-simpsons-hit-and-run-wasm/${COMMIT}/SRR2.wasm`;
const DB='hit-and-run-local-saves',STORE='files';
let started=false,gameplay=false,lastSave=0,failed=false;
function log(...args){logs.textContent=(logs.textContent+'\n'+args.map(String).join(' ')).slice(-16000);}
function fail(error){overlay.classList.add('has-error');failed=true;startButton.disabled=false;startButton.textContent='Reload and retry';errorBox.textContent=error?.message||String(error);status.textContent='The game could not start.';overlay.classList.remove('hidden');log(error?.stack||error);}
window.addEventListener('error',e=>fail(e.error||e.message));
window.addEventListener('unhandledrejection',e=>fail(e.reason));
async function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function loadSaves(){const db=await openDB();try{return await new Promise((resolve,reject)=>{const entries=[],tx=db.transaction(STORE,'readonly'),r=tx.objectStore(STORE).openCursor();r.onsuccess=()=>{const c=r.result;if(c){entries.push({path:c.key,data:c.value});c.continue();}};tx.oncomplete=()=>resolve(entries);tx.onerror=()=>reject(tx.error);});}finally{db.close();}}
async function storeSave(path,data){const db=await openDB();try{await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(data,path);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});lastSave=performance.now();}finally{db.close();}}
async function getWasm(){
  const candidates=['./SRR2.wasm',WASM_URL];
  let cache=null;
  try{cache=await caches.open('hit-and-run-engine-'+COMMIT);const saved=await cache.match(WASM_URL);if(saved){const bytes=await saved.arrayBuffer();await verifyEngineBytes(bytes);return bytes;}}catch(e){log('Engine cache unavailable:',e.message);}
  let failure;
  for(const url of candidates){
    try{
      status.textContent=url.startsWith('http')?'Downloading the browser engine (4.7 MB)…':'Loading the browser engine…';
      const response=await fetch(url,{credentials:'omit',signal:AbortSignal.timeout(45000)});
      if(!response.ok)throw new Error(`Engine download returned HTTP ${response.status}`);
      const bytes=await response.arrayBuffer();await verifyEngineBytes(bytes);
      try{await cache?.put(WASM_URL,new Response(bytes,{headers:{'Content-Type':'application/wasm'}}));}catch(e){log('Engine cache write:',e.message);}
      return bytes;
    }catch(e){failure=e;log('Engine fetch:',e.message);}
  }
  throw new Error('Could not load the original engine. Check internet access, or run scripts/fetch-engine.py first. '+(failure?.message||''));
}
function resumeAudio(){
  const M=window.Module;
  for(const context of [M?.SDL2?.audioContext,globalThis.AL?.currentContext?.audioCtx])context?.resume?.().catch(log);
  canvas.focus();
}
document.getElementById('fullscreen').onclick=()=>{document.getElementById('game').requestFullscreen?.().catch(fail);canvas.focus();};
document.getElementById('sound').onclick=resumeAudio;
document.getElementById('reload').onclick=()=>{if(!gameplay||confirm('Restart the game? Unsaved progress will be lost.'))location.reload();};
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();fail(new Error('WebGL context lost. Restart the page to continue.'));});
window.addEventListener('keydown',e=>{if(started&&['Tab',' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','F1'].includes(e.key))e.preventDefault();});
window.addEventListener('pointerdown',()=>{if(started)resumeAudio();},{passive:true});
window.addEventListener('beforeunload',e=>{if(gameplay&&(!lastSave||performance.now()-lastSave>90000)){e.preventDefault();e.returnValue='';}});
try{
  if(!crossOriginIsolated||typeof SharedArrayBuffer==='undefined')throw new Error('This game requires cross-origin isolation. Start it with scripts/play.py or npm run dev; opening the HTML directly will not work.');
  const probe=document.createElement('canvas');
  if(!probe.getContext('webgl2')&&!probe.getContext('webgl'))throw new Error('WebGL is unavailable. Enable browser graphics acceleration.');
  const response=await fetch('/api/game-status',{cache:'no-store'});
  if(!response.ok)throw new Error('The local game-file server is unavailable. Start scripts/play.py.');
  const files=await response.json();
  if(!files.ready)throw new Error('Required PC game files are missing: '+files.missing.join(', ')+'. Set SHR_ASSET_DIR to your retail PC installation.');
  status.textContent='Local PC game files found. Ready to load the original engine.';
  startButton.disabled=false;
}catch(e){fail(e);}
startButton.onclick=async()=>{
  if(failed){location.reload();return;}
  overlay.classList.add('loading');startButton.disabled=true;startButton.textContent='Loading…';progress.hidden=false;
  try{
    const bytes=await getWasm();status.textContent='Compiling the original engine…';
    const compiled=await WebAssembly.compile(bytes);
    installGraphics(canvas,graphics,{
      onContext:info=>log('Graphics context:',JSON.stringify(info)),
      onUnsupported:()=>{document.documentElement.style.setProperty('--game-aspect','1.3333333333');log('Projection shader unavailable; using 4:3.');},
    });
    for(const input of [aspectSelect,qualitySelect,antialiasInput])input.disabled=true;
    const M=window.Module={
      canvas,assetBaseUrl:'/assets/',
      instantiateWasm(imports,receive){const instance=new WebAssembly.Instance(compiled,imports);receive(instance,compiled);return instance.exports;},
      preRun:[()=>{M.addRunDependency('restore-saves');loadSaves().then(saves=>{M.pendingSaves=saves;}).catch(e=>{M.pendingSaves=[];log('Saves could not be loaded:',e.message);}).finally(()=>M.removeRunDependency('restore-saves'));}],
      flushPendingSaves(){for(const save of M.pendingSaves||[]){try{M.FS.writeFile(save.path,save.data);}catch(e){log('Save restore:',e.message);}}M.pendingSaves=[];},
      persistSave(path){try{const data=M.FS.readFile(path);storeSave(path,data).catch(e=>log('Save write failed:',e.message));}catch(e){log('Save read failed:',e.message);}},
      setGameplayActive(active){gameplay=!!active;},
      print:log,printErr:log,onAbort:fail,
      setStatus(text){if(!overlay.classList.contains('hidden')&&text)status.textContent=text;},
      setBootProgress(value){const n=Math.max(0,Math.min(1,value));progress.value=n;status.textContent='Loading game — '+Math.round(n*100)+'%';if(n>=1){setTimeout(()=>canvas.checkWidescreenSupport?.(),2000);document.body.classList.add('playing');overlay.classList.add('hidden');canvas.focus();resumeAudio();}},
    };
    const script=document.createElement('script');script.src='./SRR2.js';script.onerror=()=>fail(new Error('Engine JavaScript failed to load.'));started=true;document.body.append(script);
  }catch(e){fail(e);}
};
