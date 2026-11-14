#include <radthread.hpp>
#include <emscripten/fiber.h>
#include <algorithm>
#include <exception>
#include <new>
#include <pthread.h>
#include <stdexcept>

namespace {
class BrowserFiber;
thread_local BrowserFiber* active=nullptr;
thread_local BrowserFiber* root=nullptr;
class BrowserFiber final:public IRadThreadFiber {
 unsigned references=1;
 radMemoryAllocator allocator;
 void* stack=nullptr;
 void* unwind=nullptr;
 void* value;
 RADFIBERENTRY entry;
 pthread_t owner;
 bool main;
 static void enter(void* data){
  auto* self=static_cast<BrowserFiber*>(data);
  self->entry(self->value);
  // Foundation's contract says fiber entries must not return.
  std::terminate();
 }
public:
 emscripten_fiber_t context{};
 BrowserFiber(RADFIBERENTRY fn,void* data,unsigned size,radMemoryAllocator a):
  allocator(a),value(data),entry(fn),owner(pthread_self()),main(fn==nullptr){
  const unsigned unwindSize=65536;
  unwind=radMemoryAllocAligned(allocator,unwindSize,16);
  if(!unwind)throw std::bad_alloc();
  if(main)emscripten_fiber_init_from_current_context(&context,unwind,unwindSize);
  else {
   size=std::max(size,65536u);
   stack=radMemoryAllocAligned(allocator,size,16);
   if(!stack){radMemoryFreeAligned(allocator,unwind);throw std::bad_alloc();}
   emscripten_fiber_init(&context,enter,this,stack,size,unwind,unwindSize);
  }
 }
 ~BrowserFiber(){
  if(stack)radMemoryFreeAligned(allocator,stack);
  radMemoryFreeAligned(allocator,unwind);
 }
 void AddRef()override{++references;}
 void Release()override{
  if(references==1&&(this==active||main))
   throw std::logic_error("Cannot release the active or root browser fiber");
  if(!--references)delete this;
 }
 void SwitchTo()override{
  if(!pthread_equal(owner,pthread_self()))throw std::logic_error("Cross-thread fiber switch");
  if(this==active)throw std::logic_error("Cannot switch to active fiber");
  BrowserFiber* previous=active;
  if(!previous)throw std::logic_error("Browser fiber context not initialized");
  active=this;
  emscripten_fiber_swap(&previous->context,&context);
  if(active!=previous)std::terminate();
 }
 void* GetValue()override{return value;}
 void SetValue(void* data)override{value=data;}
};
void ensureRoot(){
 if(!root){root=new BrowserFiber(nullptr,nullptr,0,RADMEMORY_ALLOC_DEFAULT);active=root;}
}
}
void radThreadCreateFiber(IRadThreadFiber** output,RADFIBERENTRY entry,void* data,
 unsigned stackSize,radMemoryAllocator allocator){
 if(!output||!entry)throw std::invalid_argument("Missing browser fiber output or entry");
 *output=nullptr;ensureRoot();
 *output=new BrowserFiber(entry,data,stackSize,allocator);
}
IRadThreadFiber* radThreadGetActiveFiber(){ensureRoot();return active;}
// Called by the eventual browser threading shutdown after child fibers release.
void hrBrowserTerminateFibers(){
 if(active!=root)throw std::logic_error("Cannot shut down fibers from a child");
 active=nullptr;delete root;root=nullptr;
}
