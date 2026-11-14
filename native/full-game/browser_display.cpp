#include <pddi/platform/web/gldisplay.hpp>
#include <emscripten/emscripten.h>
#include <GL/gl.h>
#include <cstring>
#include <limits>

extern pddiDisplayInfo displayInfo[2];
pglDisplay::pglDisplay(): mode(PDDI_DISPLAY_WINDOW),winWidth(640),winHeight(480),
 winBitDepth(32),context(nullptr),gammaR(1),gammaG(1),gammaB(1),extBGRA(false),reset(true) {}
pglDisplay::~pglDisplay(){if(browserContext)emscripten_webgl_destroy_context(browserContext);}
bool pglDisplay::InitDisplay(const pddiDisplayInit* init){
 return init && InitDisplay(init->xsize,init->ysize,init->bpp);
}
bool pglDisplay::InitDisplay(int x,int y,int bpp){
 if(x<=0||y<=0||x>16384||y>16384)return false;
 if(!browserContext){
  EmscriptenWebGLContextAttributes attributes;
  emscripten_webgl_init_context_attributes(&attributes);
  attributes.alpha=false;attributes.depth=true;attributes.stencil=true;
  attributes.antialias=false;attributes.majorVersion=1;
  // Legacy OpenGL calls are translated by Emscripten's GL emulation layer.
  browserContext=emscripten_webgl_create_context("#canvas",&attributes);
  if(browserContext<=0){browserContext=0;return false;}
 }
 if(emscripten_webgl_make_context_current(browserContext)!=EMSCRIPTEN_RESULT_SUCCESS)return false;
 if(emscripten_set_canvas_element_size("#canvas",x,y)!=EMSCRIPTEN_RESULT_SUCCESS)return false;
 winWidth=x;winHeight=y;winBitDepth=bpp;reset=true;
 glViewport(0,0,x,y);
 return true;
}
pddiDisplayInfo* pglDisplay::GetDisplayInfo(){return &displayInfo[0];}
int pglDisplay::GetHeight(){return winHeight;}
int pglDisplay::GetWidth(){return winWidth;}
int pglDisplay::GetDepth(){return winBitDepth;}
pddiDisplayMode pglDisplay::GetDisplayMode(){return mode;}
int pglDisplay::GetNumColourBuffer(){return 2;}
unsigned pglDisplay::GetBufferMask(){return PDDI_BUFFER_COLOUR|PDDI_BUFFER_DEPTH|PDDI_BUFFER_STENCIL;}
unsigned pglDisplay::GetFreeTextureMem(){return std::numeric_limits<unsigned>::max();}
void pglDisplay::SwapBuffers(){glFlush();}
unsigned pglDisplay::Screenshot(pddiColour* buffer,int nBytes){
 const size_t required=size_t(winWidth)*winHeight*sizeof(pddiColour);
 if(!buffer||nBytes<0||size_t(nBytes)<required)return 0;
 glReadPixels(0,0,winWidth,winHeight,GL_RGBA,GL_UNSIGNED_BYTE,buffer);
 return glGetError()==GL_NO_ERROR?unsigned(required):0;
}
void pglDisplay::BeginContext(){emscripten_webgl_make_context_current(browserContext);}
void pglDisplay::EndContext(){glFlush();}
void pglDisplay::BeginTiming(){gettimeofday(&beginTime,nullptr);}
float pglDisplay::EndTiming(){timeval now;gettimeofday(&now,nullptr);return (now.tv_sec-beginTime.tv_sec)*1000.f+(now.tv_usec-beginTime.tv_usec)*.001f;}
bool pglDisplay::CheckExtension(char* name){
 if(!name||!*name||std::strchr(name,' '))return false;
 const char* list=reinterpret_cast<const char*>(glGetString(GL_EXTENSIONS));
 if(!list)return false;
 const size_t length=std::strlen(name);
 for(const char* match=list;(match=std::strstr(match,name));match+=length)
  if((match==list||match[-1]==' ')&&(match[length]==' '||match[length]=='\0'))return true;
 return false;
}
unsigned pglDisplay::FillDisplayModes(pddiModeInfo* modes){
 if(!modes)return 0;
 modes[0]={640,480,32};modes[1]={800,600,32};modes[2]={1024,768,32};return 3;
}
// The supplied Linux renderer also stores gamma without applying a ramp.
void pglDisplay::SetGamma(float r,float g,float b){gammaR=r;gammaG=g;gammaB=b;}
void pglDisplay::GetGamma(float* r,float* g,float* b){if(r)*r=gammaR;if(g)*g=gammaG;if(b)*b=gammaB;}
