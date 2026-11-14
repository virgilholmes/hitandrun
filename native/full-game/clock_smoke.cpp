#include <radtime.hpp>
#include <raddebug.hpp>
#include <emscripten/emscripten.h>
#include <cstdio>
#include <cstring>
namespace {char captured[64];void capture(const char* message){std::snprintf(captured,sizeof(captured),"%s",message);}}
int main(){
 radTimeInitialize();
 const auto start=radTimeGetMicroseconds64();
 const double deadline=emscripten_get_now()+5;
 while(emscripten_get_now()<deadline){}
 if(radTimeGetMicroseconds64()-start<4000)return 1;
 if(radTimeGetMilliseconds()<4)return 2;
 radTimeInitialize(); // nested initialization must not reset the clock
 if(radTimeGetMilliseconds()<4)return 3;
 radDate date{};radTimeGetDate(&date);
 if(date.m_Year<2020||date.m_Month<1||date.m_Month>12||date.m_Day<1||date.m_Day>31)return 4;
 radTimeTerminate();radTimeTerminate();
 rDebugSetOutputHandler(capture);rReleasePrintf("browser %s %d","debug",7);rDebugSetOutputHandler(nullptr);
 if(std::strcmp(captured,"browser debug 7"))return 5;
 std::puts("PASS: browser clocks, calendar date, nested initialization and debug output callback");
}
