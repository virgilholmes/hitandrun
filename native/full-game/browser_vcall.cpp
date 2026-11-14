#include <browser_vcall.hpp>
#include <emscripten/emscripten.h>
#include <stdexcept>
#include <cstring>

EM_JS(unsigned, invokeWasmVirtual, (void* object,unsigned slot,const void* params,
 unsigned count,const unsigned char* kinds,int floatResult), {
 const vtable=HEAPU32[object>>>2];
 const index=HEAPU32[(vtable>>>2)+slot];
 const method=wasmTable.get(index);
 if(typeof method!=='function')throw new Error('Invalid radscript virtual method');
 const args=[object];
 for(let i=0;i<count;i++)args.push(HEAPU8[kinds+i]===1?HEAPF32[(params>>>2)+i]:HEAP32[(params>>>2)+i]);
 const value=method(...args);
 if(floatResult){
  const bits=new DataView(new ArrayBuffer(4));bits.setFloat32(0,value,true);
  return bits.getUint32(0,true);
 }
 return value===undefined?0:value;
});
unsigned hrBrowserInvokeVirtual(void* object,unsigned slot,const void* params,
 unsigned count,const unsigned char* kinds,bool floatResult){
 if(!object||count>64||(count&&(!params||!kinds)))
  throw std::invalid_argument("Invalid browser radscript virtual call");
 return invokeWasmVirtual(object,slot,params,count,kinds,floatResult);
}
