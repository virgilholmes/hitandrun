export const WASM_SIZE=4655088;
export const WASM_BLOB_SHA='4a92e45140f42fd224d0804fe236c4052240f9ac';
export async function verifyEngineBytes(buffer){
  if(!(buffer instanceof ArrayBuffer)||buffer.byteLength!==WASM_SIZE)throw new Error('Unexpected engine binary size.');
  const b=new Uint8Array(buffer);
  if(b[0]!==0||b[1]!==97||b[2]!==115||b[3]!==109)throw new Error('Downloaded file is not WebAssembly.');
  const header=new TextEncoder().encode(`blob ${b.byteLength}\0`),all=new Uint8Array(header.length+b.length);
  all.set(header);all.set(b,header.length);
  const hash=new Uint8Array(await crypto.subtle.digest('SHA-1',all));
  const hex=Array.from(hash,x=>x.toString(16).padStart(2,'0')).join('');
  if(hex!==WASM_BLOB_SHA)throw new Error('Engine integrity check failed.');
  return true;
}
