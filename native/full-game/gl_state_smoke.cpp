#include <GL/gl.h>
#include <emscripten/emscripten.h>
#include <cstdio>
EM_JS_DEPS(glStateDeps,"$GLEmulation");
EM_JS(int,checkState,(),{
 const attenuation=GLEmulation.lightAttenuation;
 if(attenuation.length!==8)return 1;
 for(let i=0;i<8;i++){
  const expected=i===3?[2,.5,.125]:[1,0,0];
  if(expected.some((value,j)=>attenuation[i][j]!==value))return 2;
 }
 if([.25,.5,.75,1].some((value,j)=>GLEmulation.materialEmission[j]!==value))return 3;
 if(GLEmulation.materialShininess!==17)return 4;
 if(GLEmulation.materialDiffuse[0]===.25)return 5;
 return 0;
});
int main(){
 GLfloat c=2,l=.5f,q=.125f,shininess=17;
 glLightfv(GL_LIGHT3,GL_CONSTANT_ATTENUATION,&c);
 glLightfv(GL_LIGHT3,GL_LINEAR_ATTENUATION,&l);
 glLightfv(GL_LIGHT3,GL_QUADRATIC_ATTENUATION,&q);
 GLfloat emission[]={.25f,.5f,.75f,1};
 glMaterialfv(GL_FRONT_AND_BACK,GL_EMISSION,emission);
 glMaterialfv(GL_FRONT_AND_BACK,GL_SHININESS,&shininess);
 int code=checkState();if(code)return code;
 std::puts("PASS: compiled browser GL layer preserves per-light attenuation, emission and scalar material state (no GPU draw test)");
}
