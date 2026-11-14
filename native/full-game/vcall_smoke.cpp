#include <browser_vcall.hpp>
#include <cstring>
#include <cmath>
#include <cstdio>
#include <stdexcept>
struct ScriptInterface {
 virtual void AddRef()=0;
 virtual void Release()=0;
 virtual void Configure(int,float,const char*)=0;
 virtual unsigned Value()=0;
 virtual float Scaled(float)=0;
};
struct ScriptObject:ScriptInterface {
 unsigned refs=1,value=0;float scale=0;const char* name=nullptr;
 void AddRef()override{++refs;}
 void Release()override{--refs;}
 void Configure(int n,float f,const char* text)override{value=n;scale=f;name=text;}
 unsigned Value()override{return value;}
 float Scaled(float f)override{return scale*f;}
 virtual ~ScriptObject(){}
};
int main(){
 ScriptObject object;ScriptInterface* target=&object;
 hrBrowserInvokeVirtual(target,0,nullptr,0,nullptr,false);
 if(object.refs!=2)return 1;
 hrBrowserInvokeVirtual(target,1,nullptr,0,nullptr,false);
 if(object.refs!=1)return 2;
 const char* name="original script arguments";float scale=2.5f;
 unsigned params[3]={37,0,reinterpret_cast<unsigned>(name)};
 std::memcpy(&params[1],&scale,4);
 unsigned char kinds[3]={0,1,0};
 hrBrowserInvokeVirtual(target,2,params,3,kinds,false);
 if(object.value!=37||object.scale!=scale||std::strcmp(object.name,name))return 3;
 if(hrBrowserInvokeVirtual(target,3,nullptr,0,nullptr,false)!=37)return 4;
 float factor=-3;unsigned bits;std::memcpy(&bits,&factor,4);
 unsigned char floatKind=1;
 bits=hrBrowserInvokeVirtual(target,4,&bits,1,&floatKind,true);
 float result;std::memcpy(&result,&bits,4);
 if(std::fabs(result+7.5f)>1e-6f)return 5;
 try{hrBrowserInvokeVirtual(nullptr,0,nullptr,0,nullptr,false);return 6;}
 catch(const std::invalid_argument&){}
 std::puts("PASS: Wasm virtual calls preserve mixed integer/float/string args, void/integer/float returns, slots and object state");
}
