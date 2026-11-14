#include <cstdio>
#include <cmath>
#include <simcommon/largesymmetricmatrix.hpp>
#include <simcommon/simmath.hpp>

// Execute the supplied physics solver in Wasm. A real inverse is checked
// against independent expected values, rather than only checking compilation.
int main() {
    sim::LargeSymmetricMatrix matrix(2);
    matrix(0,0)=4; matrix(0,1)=1; matrix(1,1)=3;
    float input[2]={2,5}, output[2]={};
    if(!matrix.PostMultiply(input,output)) return 1;
    if(std::fabs(output[0]-13)>1e-5f || std::fabs(output[1]-17)>1e-5f) return 2;
    if(!matrix.Invert()) return 3;
    if(std::fabs(matrix(0,0)-3.f/11)>1e-5f ||
       std::fabs(matrix(0,1)+1.f/11)>1e-5f ||
       std::fabs(matrix(1,1)-4.f/11)>1e-5f) return 4;
    if(!matrix.PostMultiply(output,input)) return 5;
    if(std::fabs(input[0]-2)>1e-5f || std::fabs(input[1]-5)>1e-5f) return 6;
    if(sim::ClampBetween(-2.f,0.f,1.f)!=0 ||
       sim::ClampBetween(2.f,0.f,1.f)!=1 ||
       sim::ClampBetween(.5f,0.f,1.f)!=.5f) return 7;
    std::puts("PASS: original physics matrix multiplication, inversion, solve and clamping execute in Wasm");
}
