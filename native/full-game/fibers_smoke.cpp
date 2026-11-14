#include <radthread.hpp>
#include <cstdlib>
#include <cstdio>
#include <stdexcept>

// Test harness only: isolate fiber scheduling from the unfinished original
// memory manager. Production browser_fibers uses radMemory allocator APIs.
void* radMemoryAllocAligned(radMemoryAllocator,unsigned bytes,unsigned align){
 void* result=nullptr;return posix_memalign(&result,align,bytes)==0?result:nullptr;
}
void radMemoryFreeAligned(radMemoryAllocator,void* pointer){std::free(pointer);}
void hrBrowserTerminateFibers();
namespace {
IRadThreadFiber* mainFiber;IRadThreadFiber* first;IRadThreadFiber* second;
int sequence=0;bool failed=false;
void firstEntry(void* data){
 volatile int preserved=12345;
 if(data!=&sequence||radThreadGetActiveFiber()!=first)failed=true;
 sequence=1;second->SwitchTo();
 if(sequence!=2||preserved!=12345)failed=true;
 sequence=3;mainFiber->SwitchTo();
 if(sequence!=4||preserved!=12345)failed=true;
 sequence=5;mainFiber->SwitchTo();
 std::abort();
}
void secondEntry(void*){
 volatile int preserved=67890;
 if(sequence!=1)failed=true;
 sequence=2;first->SwitchTo();
 if(sequence!=6||preserved!=67890)failed=true;
 sequence=7;mainFiber->SwitchTo();
 std::abort();
}
}
int main(){
 mainFiber=radThreadGetActiveFiber();mainFiber->SetValue(&sequence);
 if(mainFiber->GetValue()!=&sequence)return 1;
 radThreadCreateFiber(&first,firstEntry,&sequence,4096);
 radThreadCreateFiber(&second,secondEntry,nullptr,4096);
 first->SwitchTo();if(sequence!=3||failed)return 2;
 sequence=4;first->SwitchTo();if(sequence!=5||failed)return 3;
 sequence=6;second->SwitchTo();if(sequence!=7||failed)return 4;
 try{mainFiber->SwitchTo();return 5;}catch(const std::logic_error&){}
 first->Release();second->Release();hrBrowserTerminateFibers();
 std::puts("PASS: Foundation fiber API executes nested switches, resumes local stacks and preserves user data in Wasm");
}
