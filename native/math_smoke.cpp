#include <radmath/radmath.hpp>
#include <cmath>
#include <cstdio>
extern "C" int hr_math_init();
extern "C" int hr_math_normalize3(float*);
extern "C" int hr_math_transform3(const float*,const float*,float*);
int main() {
  if(hr_math_init()!=0)return 4;
  rmt::Vector a(1,0,0), b(0,1,0), cross;
  cross.CrossProduct(a,b);
  if (std::fabs(cross.z-1)>0.0001f) return 1;
  rmt::Vector v(3,4,0); v.Normalize();
  if (std::fabs(v.Magnitude()-1)>0.0001f) return 2;
  rmt::Matrix m; m.Identity();
  rmt::Vector output; m.Transform(v,&output);
  if (!output.Equals(v,0.0001f)) return 3;
  float zero[3]={0,0,0}, normal[3]={3,4,0};
  if(hr_math_normalize3(zero)!=0 || hr_math_normalize3(normal)!=1)return 5;
  if(std::fabs(normal[0]-0.6f)>0.0001f || std::fabs(normal[1]-0.8f)>0.0001f)return 6;
  float matrix[16]={1,0,0,0, 0,1,0,0, 0,0,1,0, 10,20,30,1};
  float input[3]={1,2,3}, translated[3]={0,0,0};
  if(hr_math_transform3(matrix,input,translated)!=1)return 7;
  if(translated[0]!=11 || translated[1]!=22 || translated[2]!=33)return 8;
  std::puts("PASS: original radmath cross product, normalization and matrix transform, bridge and original trig sanity checks");
}
