#include "source_core.hpp"
#include <fstream>
#include <iterator>
#include <cstdio>
#include <vector>
int main(int argc,char** argv){
 const unsigned char empty[]={0x50,0x33,0x44,0xff,12,0,0,0,12,0,0,0};
 if(!hr_source_probe(empty,sizeof(empty))||hr_source_chunk_count()!=1)return 1;
 if(hr_source_probe(empty,sizeof(empty)-1))return 2;
 const unsigned char nested[]={0x50,0x33,0x44,0xff,12,0,0,0,24,0,0,0,0,0,1,0,12,0,0,0,12,0,0,0};
 if(!hr_source_probe(nested,sizeof(nested))||hr_source_mesh_count()!=1||hr_source_chunk_count()!=2)return 3;
 const unsigned char big[]={0xff,0x44,0x33,0x50,0,0,0,12,0,0,0,24,0,1,0,0,0,0,0,12,0,0,0,12};
 if(!hr_source_probe(big,sizeof(big))||hr_source_mesh_count()!=1||hr_source_chunk_count()!=2)return 4;
 for(int i=1;i<argc;i++){
  std::ifstream file(argv[i],std::ios::binary);if(!file)return 5;
  std::vector<unsigned char> bytes((std::istreambuf_iterator<char>(file)),{});
  if(!hr_source_probe(bytes.data(),bytes.size())){std::fprintf(stderr,"%s\n",hr_source_last_error());return 6;}
  std::printf("Original Pure3D parser: %s — %u chunks, %u meshes, %u textures\n",argv[i],hr_source_chunk_count(),hr_source_mesh_count(),hr_source_texture_count());
 }
 std::puts("PASS: original chunk parser with our portable adapter, bounds validation and endian handling");
}
