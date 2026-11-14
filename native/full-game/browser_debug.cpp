#include <raddebug.hpp>
#include <emscripten/heap.h>
#include <cstdarg>
#include <cstdint>
#include <cstdio>
namespace {
 bool haltOnAsserts=true;
 radDebugOutputHandler* outputHandler=nullptr;
 void output(const char* message){if(outputHandler)outputHandler(message);else std::fputs(message,stderr);}
 void format(const char* text,va_list args){char buffer[RAD_DEBUG_PRINT_MAX_LENGTH];std::vsnprintf(buffer,sizeof(buffer),text,args);output(buffer);}
}
bool rDebugAssertFail_Implementation(const char* condition,const char* file,unsigned line){std::fprintf(stderr,"Assertion failed: %s (%s:%u)\n",condition,file,line);return haltOnAsserts;}
void rDebugHaltOnAsserts_Implementation(bool halt){haltOnAsserts=halt;}
void rDebugWarningFail_Implementation(const char* condition,const char* file,unsigned line){std::fprintf(stderr,"Warning: %s (%s:%u)\n",condition,file,line);}
void rDebugValidFail_Implementation(const char* condition,const char* file,unsigned line){std::fprintf(stderr,"Invalid pointer: %s (%s:%u)\n",condition,file,line);}
int rDebugValidPointer_Implementation(void* pointer){auto address=reinterpret_cast<std::uintptr_t>(pointer);return address!=0&&address<emscripten_get_heap_size();}
int rDebugValidPointer32_Implementation(void* pointer){return rDebugValidPointer_Implementation(pointer)&&reinterpret_cast<std::uintptr_t>(pointer)%4==0;}
void rDebugString_Implementation(const char* message){output(message?message:"(null)");}
void rDebuggerString_Implementation(const char* message){rDebugString_Implementation(message);}
void rDebugSetOutputHandler(radDebugOutputHandler* handler){outputHandler=handler;}
void rReleasePrintf(const char* text,...){va_list args;va_start(args,text);format(text,args);va_end(args);}
void rDebugPrintf(const char* text,...){va_list args;va_start(args,text);format(text,args);va_end(args);}
void rTunePrintf(const char* text,...){va_list args;va_start(args,text);format(text,args);va_end(args);}
