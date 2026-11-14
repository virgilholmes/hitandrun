#pragma once
// New portable adapter for the original chunkfile.cpp's file/stream contract.
// This deliberately implements only that component's required interface.
#include <algorithm>
#include <cstdint>
#include <cstring>
#include <stdexcept>
using P3D_U32 = std::uint32_t;
class radLoadStream {
public:
 virtual ~radLoadStream() = default;
 virtual bool Read(void*,unsigned,unsigned)=0;
 virtual unsigned GetSize()=0;
 virtual unsigned GetPosition()=0;
};
class tRefCounted {
public:
 void AddRef(){++references;}
 void Release(){if(--references==0)delete this;}
 template<class T> static void Assign(T*& dest,T* value){if(value)value->AddRef();if(dest)dest->Release();dest=value;}
 template<class T> static void Release(T*& value){if(value)value->Release();value=nullptr;}
protected:
 virtual ~tRefCounted()=default;
private:
 unsigned references=0;
};
class tFile : public radLoadStream, public tRefCounted {
public:
 enum DataType{BYTE=1,WORD=2,DWORD=4,QWORD=8};
 tFile(const unsigned char* input,unsigned length):data(input),length(length){}
 unsigned GetSize() override{return length;}
 unsigned GetPosition() override{return position;}
 void Advance(unsigned count){if(count>length-position)throw std::runtime_error("Read past file end");position+=count;}
 bool GetData(void* out,unsigned count,DataType type=BYTE){
  const unsigned unit=static_cast<unsigned>(type);
  if(unit!=1&&unit!=2&&unit!=4&&unit!=8)throw std::runtime_error("Invalid read unit");
  if(count>(length-position)/unit)throw std::runtime_error("Read past file end");
  const unsigned bytes=count*unit;
  if(out){std::memcpy(out,data+position,bytes);if(swap&&unit>1){auto* b=static_cast<unsigned char*>(out);for(unsigned i=0;i<bytes;i+=unit)std::reverse(b+i,b+i+unit);}}
  position+=bytes;return true;
 }
 bool Read(void* out,unsigned count,unsigned unit)override{return GetData(out,count,static_cast<DataType>(unit));}
 std::uint8_t GetByte(){std::uint8_t n;GetData(&n,1,BYTE);return n;}
 std::uint16_t GetWord(){std::uint16_t n;GetData(&n,1,WORD);return n;}
 std::uint32_t GetDWord(){std::uint32_t n;GetData(&n,1,DWORD);return n;}
 bool GetEndianSwap(){return swap;}
 bool SetEndianSwap(bool value){bool old=swap;swap=value;return old;}
 void SetUncompressedSize(int){throw std::runtime_error("Compressed wrappers are not ported yet");}
 void SetCompressed(bool value){if(value)throw std::runtime_error("Compressed wrappers are not ported yet");}
 const char* GetFullFilename(){return "browser-memory.p3d";}
 const char* GetFilename(){return "browser-memory.p3d";}
private:
 const unsigned char* data;
 unsigned length,position=0;
 bool swap=false;
};
