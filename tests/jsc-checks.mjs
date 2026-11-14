import { runChecks } from './checks.mjs';
import { createRenderer } from '../lib/renderer.mjs';
import { readScene } from '../lib/scene.mjs';
print('PASS: '+runChecks()+' parser checks in JavaScriptCore');
if(typeof createRenderer!=='function')throw new Error('Renderer export missing');
print('PASS: renderer module syntax and export (no browser/GPU exercised)');
for(const path of arguments) {
 const bytes=readFile(path,'binary');
 const buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
 const scene=readScene(buffer);
 print('PASS: '+path+' — '+scene.groups.length+' primitive groups, '+scene.textures.size+' PNG textures');
}
