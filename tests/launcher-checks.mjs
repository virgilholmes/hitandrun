import { verifyEngineBytes,WASM_SIZE } from '../public/engine/integrity.mjs';
const root=arguments[0];
for(const name of ['public/engine/bootstrap.mjs','public/engine/integrity.mjs','public/engine/SRR2.js','next.config.mjs']) {
  checkModuleSyntax(readFile(root+'/'+name));print('PASS: modern JavaScript syntax — '+name);
}
for(const buffer of [new ArrayBuffer(1),new ArrayBuffer(WASM_SIZE)]) {
  let rejected=false;try{await verifyEngineBytes(buffer);}catch(e){rejected=true;}
  if(!rejected)throw new Error('Invalid engine bytes accepted');
}
print('PASS: invalid engine files rejected before instantiation');
globalThis.process={env:{}};
const config=(await import('../next.config.mjs')).default;
const headers=await config.headers(),routes=await config.rewrites();
if(!headers[0].headers.some(h=>h.key==='Cross-Origin-Opener-Policy'&&h.value==='same-origin'))throw new Error('Missing isolation header');
if(!routes.some(r=>r.source==='/assets/:path*'))throw new Error('Missing asset proxy');
print('PASS: Next.js isolation headers and local asset rewrite configured (Next.js itself not executed)');
