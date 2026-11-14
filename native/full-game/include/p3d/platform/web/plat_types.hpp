#pragma once
#include <cstdint>
#include <strings.h>
using P3D_S64=std::int64_t;using P3D_U64=std::uint64_t;
using P3D_S32=std::int32_t;using P3D_U32=std::uint32_t;
using P3D_S16=std::int16_t;using P3D_U16=std::uint16_t;
using P3D_S8=std::int8_t;using P3D_U8=std::uint8_t;
// The retail PC frontend and font assets use 16-bit code units.
using P3D_UNICODE=std::uint16_t;
#ifndef strcmpi
#define strcmpi strcasecmp
#endif
