// Browser implementation of the original foundation's clock API.
#include <radtime.hpp>
#include <emscripten/emscripten.h>
#include <cstdint>
#include <ctime>
namespace {
 unsigned initializationDepth=0;
 double origin=0;
 double elapsedMilliseconds(){return emscripten_get_now()-origin;}
}
void radTimeInitialize(){if(initializationDepth++==0)origin=emscripten_get_now();}
void radTimeTerminate(){if(initializationDepth) --initializationDepth;}
unsigned int radTimeGetSeconds(){return static_cast<unsigned int>(static_cast<std::uint64_t>(elapsedMilliseconds()/1000.0));}
unsigned int radTimeGetMilliseconds(){return static_cast<unsigned int>(static_cast<std::uint64_t>(elapsedMilliseconds()));}
unsigned int radTimeGetMicroseconds(){return static_cast<unsigned int>(static_cast<std::uint64_t>(elapsedMilliseconds()*1000.0));}
radTime64 radTimeGetMicroseconds64(){return static_cast<radTime64>(elapsedMilliseconds()*1000.0);}
void radTimeGetDate(radDate* date){
 if(!date)return;
 const std::time_t now=std::time(nullptr);
 const std::tm* local=std::localtime(&now);
 if(!local){*date={};return;}
 date->m_Year=static_cast<unsigned short>(local->tm_year+1900);
 date->m_Month=static_cast<unsigned char>(local->tm_mon+1);
 date->m_Day=static_cast<unsigned char>(local->tm_mday);
 date->m_Hour=static_cast<unsigned char>(local->tm_hour);
 date->m_Minute=static_cast<unsigned char>(local->tm_min);
 date->m_Second=static_cast<unsigned char>(local->tm_sec);
}
