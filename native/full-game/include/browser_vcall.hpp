#pragma once
#include <cstdint>
// Params retain the original packed 32-bit slots. kinds[i] selects float
// rather than integer/pointer conversion at the JavaScript-to-Wasm boundary.
unsigned hrBrowserInvokeVirtual(void* object,unsigned slot,const void* params,
 unsigned count,const unsigned char* kinds,bool floatResult);
