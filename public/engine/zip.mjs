// Read ordinary ZIP directories without loading the multi-GB archive into RAM.
const u16=(v,n)=>v.getUint16(n,true),u32=(v,n)=>v.getUint32(n,true);
export function safePath(path){
  const name=path.replaceAll('\\','/');
  if(!name||name.startsWith('/')||name.includes('\0')||(name.endsWith('/')?name.slice(0,-1):name).split('/').some(p=>!p||p==='..'||p==='.'||p.includes(':')))throw new Error('ZIP contains an unsafe file path.');
  return name;
}
export async function readZip(blob){
  const tailStart=Math.max(0,blob.size-65557);
  const tail=new DataView(await blob.slice(tailStart).arrayBuffer());
  let end=-1;
  for(let n=tail.byteLength-22;n>=0;n--)if(u32(tail,n)===0x06054b50&&n+22+u16(tail,n+20)===tail.byteLength){end=n;break;}
  if(end<0)throw new Error('This is not a supported ZIP. Select a ZIP of the installed PC game folder.');
  const count=u16(tail,end+10),size=u32(tail,end+12),offset=u32(tail,end+16);
  if(u16(tail,end+4)||u16(tail,end+6)||u16(tail,end+8)!==count)throw new Error('Split ZIP archives are not supported.');
  if(count===65535||size===0xffffffff||offset===0xffffffff)throw new Error('ZIP64 archives are not supported. Use a standard ZIP smaller than 4 GB.');
  if(count>50000||size>32*1024*1024||offset+size>tailStart+end)throw new Error('ZIP directory is invalid or too large.');
  const bytes=new Uint8Array(await blob.slice(offset,offset+size).arrayBuffer()),view=new DataView(bytes.buffer);
  const entries=[];let cursor=0;
  for(let i=0;i<count;i++){
    if(cursor+46>size||u32(view,cursor)!==0x02014b50)throw new Error('ZIP directory is damaged.');
    const flags=u16(view,cursor+8),method=u16(view,cursor+10),crc=u32(view,cursor+16),compressed=u32(view,cursor+20),length=u32(view,cursor+24),nameLength=u16(view,cursor+28),extra=u16(view,cursor+30),comment=u16(view,cursor+32),local=u32(view,cursor+42);
    if(cursor+46+nameLength+extra+comment>size)throw new Error('ZIP filename is truncated.');
    if(flags&1)throw new Error('Password-protected ZIP files are not supported.');
    if(compressed===0xffffffff||length===0xffffffff||local===0xffffffff)throw new Error('ZIP64 entries are not supported.');
    const name=safePath(new TextDecoder(flags&2048?'utf-8':'windows-1252').decode(bytes.subarray(cursor+46,cursor+46+nameLength)));
    entries.push({name,method,crc,compressed,size:length,offset:local,flags});
    cursor+=46+nameLength+extra+comment;
  }
  return entries;
}
const EXTENSIONS=new Set(['rcf','p3d','mfk','con','pag','scr','rmv','rsd','prj','cho','toc','bin','typ','txt','png','bmp','tga','jpg','wav','ogg','mp3','dat','fnt']);
export function selectGameEntries(entries){
  const files=entries.filter(e=>!e.name.endsWith('/'));
  const roots=files.filter(e=>e.name.toLowerCase()==='scripts.rcf'||e.name.toLowerCase().endsWith('/scripts.rcf')).map(e=>e.name.slice(0,-'scripts.rcf'.length));
  for(const root of roots){
    const selected=[];const seen=new Set();
    for(const entry of files){
      if(!entry.name.toLowerCase().startsWith(root.toLowerCase()))continue;
      const path=entry.name.slice(root.length).toLowerCase();
      if(!EXTENSIONS.has(path.split('.').at(-1))||['mods','dlls','glcache','lucas','__macosx'].includes(path.split('/')[0]))continue;
      if(seen.has(path))throw new Error('ZIP contains duplicate game paths: '+path);
      seen.add(path);selected.push({...entry,path});
    }
    if(seen.has('scripts.rcf')&&seen.has('dialog.rcf')&&seen.has('art/l1i00.p3d')&&selected.some(e=>e.path.startsWith('art/frontend/'))&&selected.some(e=>e.path.startsWith('sound/'))){
      if(selected.some(e=>![0,8].includes(e.method)))throw new Error('Use ZIP compression Store or Deflate for the game files.');
      if(selected.reduce((n,e)=>n+e.size,0)>8*1024**3)throw new Error('The uncompressed game ZIP is larger than 8 GB.');
      return selected;
    }
  }
  throw new Error('No retail PC game found. ZIP the installed game folder containing scripts.rcf, dialog.rcf, art and sound. C++ source code and Xbox disc images will not work.');
}
const crcTable=Uint32Array.from({length:256},(_,i)=>{for(let j=0;j<8;j++)i=(i&1)?0xedb88320^(i>>>1):i>>>1;return i>>>0;});
export function crc32(bytes,previous=0){let crc=(previous^0xffffffff)>>>0;for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
export async function entryStream(blob,entry){
  if(entry.offset+30>blob.size)throw new Error('ZIP file header is truncated.');
  const header=new DataView(await blob.slice(entry.offset,entry.offset+30).arrayBuffer());
  if(u32(header,0)!==0x04034b50||u16(header,8)!==entry.method||(u16(header,6)&1))throw new Error('ZIP file header is invalid.');
  const start=entry.offset+30+u16(header,26)+u16(header,28);
  if(start+entry.compressed>blob.size)throw new Error('ZIP file data is truncated.');
  let source=blob.slice(start,start+entry.compressed).stream();
  if(entry.method===8)source=source.pipeThrough(new DecompressionStream('deflate-raw'));
  else if(entry.method!==0)throw new Error('Unsupported ZIP compression.');
  let size=0,crc=0;
  return source.pipeThrough(new TransformStream({
    transform(chunk,controller){size+=chunk.length;if(size>entry.size)throw new Error('ZIP expands beyond its declared file size.');crc=crc32(chunk,crc);controller.enqueue(chunk);},
    flush(){if(size!==entry.size||crc!==entry.crc)throw new Error('ZIP data failed integrity checks: '+entry.name);},
  }));
}
