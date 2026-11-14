export function byteRange(value,size){
  if(value===null)return null;
  const match=/^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if(!match||(!match[1]&&!match[2])||size<=0)throw new Error('Invalid range');
  const start=match[1]?Number(match[1]):Math.max(0,size-Number(match[2]));
  const end=match[1]?(match[2]?Math.min(size-1,Number(match[2])):size-1):size-1;
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=size||end<start||(!match[1]&&Number(match[2])===0))throw new Error('Unsatisfiable range');
  return [start,end];
}
export function assetResponse(file,request){
  const headers=new Headers({'Content-Type':'application/octet-stream','Accept-Ranges':'bytes','Cross-Origin-Resource-Policy':'same-origin','Cache-Control':'no-store'});
  let range;
  try{range=byteRange(request.headers.get('Range'),file.size);}catch{headers.set('Content-Range','bytes */'+file.size);headers.set('Content-Length','0');return new Response(null,{status:416,headers});}
  const [start,end]=range||[0,file.size-1],length=Math.max(0,end-start+1);
  headers.set('Content-Length',String(length));
  if(range)headers.set('Content-Range',`bytes ${start}-${end}/${file.size}`);
  return new Response(request.method==='HEAD'?null:file.slice(start,end+1).stream(),{status:range?206:200,headers});
}
