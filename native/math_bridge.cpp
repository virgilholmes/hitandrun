#include <radmath/radmath.hpp>
#include <cmath>
// This module exposes only the original math library. It is NOT the game engine.
extern "C" {
int hr_math_init() { return radMathInitialize(); }
int hr_math_normalize3(float* values) {
  if (!values) return 0;
  rmt::Vector v(values[0],values[1],values[2]);
  if (!std::isfinite(v.x) || !std::isfinite(v.y) || !std::isfinite(v.z) || v.MagnitudeSqr()<1e-20f) return 0;
  v.Normalize(); values[0]=v.x;values[1]=v.y;values[2]=v.z;return 1;
}
int hr_math_transform3(const float* matrix,const float* input,float* output) {
  if(!matrix || !input || !output)return 0;
  rmt::Matrix m;
  for(int row=0;row<4;row++)for(int col=0;col<4;col++){
    float value=matrix[row*4+col];if(!std::isfinite(value))return 0;m.m[row][col]=value;
  }
  rmt::Vector v(input[0],input[1],input[2]),out;
  if(!std::isfinite(v.x)||!std::isfinite(v.y)||!std::isfinite(v.z))return 0;
  m.Transform(v,&out);output[0]=out.x;output[1]=out.y;output[2]=out.z;return 1;
}
}
