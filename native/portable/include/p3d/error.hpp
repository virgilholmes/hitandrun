#pragma once
#include <stdexcept>
// Keep original parser assertions active on both native and browser builds.
#define P3DASSERT(condition) do { if(!(condition)) throw std::runtime_error("Pure3D assertion: " #condition); } while(false)
