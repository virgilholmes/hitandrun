#!/usr/bin/env python3
"""Generate a local browser test of the production JS modules, without Node.
Original game data is embedded only in an ignored, local QA artifact.
"""
from pathlib import Path
import base64, sys
p=Path(__file__).resolve().parents[1]
asset=Path(sys.argv[1]) if len(sys.argv)>1 else Path('/home/virgil/Downloads/The Simpsons Hit & Run/game/cd/PC/art/cars/famil_v.p3d')
(p/'.qa').mkdir(exist_ok=True)
parts=[]
for name in ['p3d.mjs','scene.mjs','camera.mjs','renderer.mjs']:
 s=(p/'lib'/name).read_text()
 s='\n'.join(line for line in s.splitlines() if not line.startswith('import '))
 s=s.replace('export function ','function ').replace('export async function ','async function ').replace('export const ','const ')
 parts.append(s)
script='\n'.join(parts)
data=base64.b64encode(asset.read_bytes()).decode()
html='''<!doctype html><meta charset="utf-8"><title>Testing original asset</title>
<style>body{background:#101724;color:white;font:16px Arial;margin:30px}canvas{display:block;width:900px;height:580px;border:1px solid #39485e}h1{color:#fbd34c}p{color:#b7c2d3}</style>
<h1>Hit & Run — Original asset renderer</h1><p id="status">Loading…</p><canvas id="canvas"></canvas><script>'''+script+'''
(async()=>{
 try {
  const bytes=Uint8Array.from(atob("'''+data+'''"),c=>c.charCodeAt(0));
  const scene=readScene(bytes.buffer);
  if(!scene.groups.length)throw new Error('No original geometry decoded');
  const canvas=document.getElementById('canvas');
  const renderer=await createRenderer(canvas,scene,{onError:e=>{document.title='FAIL: '+e.message;}});
  renderer.select('');
  await new Promise(resolve=>setTimeout(resolve,300));
  const gl=canvas.getContext('webgl');
  const pixels=new Uint8Array(canvas.width*canvas.height*4);
  gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  let changed=0;
  for(let i=0;i<pixels.length;i+=4)if(pixels[i]>40||pixels[i+1]>40||pixels[i+2]>60)changed++;
  if(changed<100)throw new Error('No visible geometry drawn');
  if(gl.getError()!==gl.NO_ERROR)throw new Error('WebGL reported an error');
  document.getElementById('status').textContent=scene.groups.length+' original primitive groups · '+scene.textures.size+' PNG textures · drag to orbit, scroll to zoom';
  document.title='PASS: '+changed+' visible model pixels; '+scene.groups.length+' groups; '+scene.textures.size+' textures';
  window.qaRenderer=renderer;
 }catch(e){console.error(e.stack);document.title='FAIL: '+e.message;}
})();</script>'''
(p/'.qa/preview.html').write_text(html)
print(p/'.qa/preview.html')
