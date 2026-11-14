#pragma once
#include <cstdint>
extern "C" {
 int hr_source_probe(const unsigned char* bytes,std::uint32_t length);
 std::uint32_t hr_source_chunk_count();
 std::uint32_t hr_source_mesh_count();
 std::uint32_t hr_source_texture_count();
 const char* hr_source_last_error();
}
