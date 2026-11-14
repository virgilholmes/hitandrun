#include "source_core.hpp"
#include <p3d/chunkfile.hpp>
#include <constants/chunkids.hpp>
#include <string>
#include <vector>
#include <stdexcept>
namespace {
std::string lastError;
std::uint32_t chunkCount=0,meshCount=0,textureCount=0;
std::uint32_t word(const unsigned char* b,bool little){
 if(little)return std::uint32_t(b[0])|(std::uint32_t(b[1])<<8)|(std::uint32_t(b[2])<<16)|(std::uint32_t(b[3])<<24);
 return std::uint32_t(b[3])|(std::uint32_t(b[2])<<8)|(std::uint32_t(b[1])<<16)|(std::uint32_t(b[0])<<24);
}
// The original loader assumes valid packaged assets. Validate external bytes
// before giving them to it, and enforce the original parser's stack capacity.
void validate(const unsigned char* data,std::uint32_t size){
 if(!data||size<12||size>64u*1024*1024)throw std::runtime_error("Expected a P3D file between 12 bytes and 64 MiB");
 const auto magic=word(data,true);
 if(magic==Pure3D::DATA_FILE_COMPRESSED||magic==Pure3D::DATA_FILE_COMPRESSED_SWAP)throw std::runtime_error("Compressed P3D wrappers are not supported yet");
 if(magic!=Pure3D::DATA_FILE&&magic!=Pure3D::DATA_FILE_SWAP)throw std::runtime_error("Not a Pure3D file");
 const bool little=magic==Pure3D::DATA_FILE;
 struct Pending{std::uint32_t offset,end,depth;};
 std::vector<Pending> work{{0,size,0}};
 unsigned total=0;
 while(!work.empty()){
  const auto p=work.back();work.pop_back();
  if(p.offset>p.end||p.end-p.offset<12||p.depth>=CHUNK_STACK_SIZE||++total>1000000)throw std::runtime_error("Invalid chunk boundary or nesting depth");
  const auto head=word(data+p.offset+4,little),length=word(data+p.offset+8,little);
  if(head<12||length<head||length>p.end-p.offset)throw std::runtime_error("Invalid chunk size");
  if(p.offset==0&&length!=size)throw std::runtime_error("Root size does not match file");
  if(p.offset&&p.offset+length<p.end)work.push_back({p.offset+length,p.end,p.depth});
  if(head<length)work.push_back({p.offset+head,p.offset+length,p.depth+1});
 }
}
void visit(tChunkFile& parser){
 ++chunkCount;
 if(parser.GetCurrentID()==Pure3D::Mesh::MESH||parser.GetCurrentID()==Pure3D::Mesh::SKIN)++meshCount;
 if(parser.GetCurrentID()==Pure3D::Texture::TEXTURE)++textureCount;
 while(parser.ChunksRemaining()){parser.BeginChunk();visit(parser);parser.EndChunk();}
}
}
extern "C" int hr_source_probe(const unsigned char* bytes,std::uint32_t length){
 chunkCount=meshCount=textureCount=0;lastError.clear();
 try{
  validate(bytes,length);
  // The original parser retains and releases this adapter through Assign().
  tChunkFile parser(new tFile(bytes,length));
  visit(parser);return 1;
 }catch(const std::exception& e){lastError=e.what();chunkCount=meshCount=textureCount=0;return 0;}
}
extern "C" std::uint32_t hr_source_chunk_count(){return chunkCount;}
extern "C" std::uint32_t hr_source_mesh_count(){return meshCount;}
extern "C" std::uint32_t hr_source_texture_count(){return textureCount;}
extern "C" const char* hr_source_last_error(){return lastError.c_str();}
