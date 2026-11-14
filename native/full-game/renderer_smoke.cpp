#include <pddi/pddi.hpp>
#include <emscripten/emscripten.h>
#include <GL/gl.h>
#include <cstdio>

int main(){
 pddiDevice* device=nullptr;
 if(pddiCreate(PDDI_VERSION_MAJOR,PDDI_VERSION_MINOR,&device)!=PDDI_OK||!device)return 1;
 pddiDisplay* display=device->NewDisplay(0);
 if(!display||!display->InitDisplay(640,480,32))return 2;
 pddiRenderContext* context=device->NewRenderContext(display);
 if(!context)return 3;
 context->BeginFrame();
 context->SetClearColour(pddiColour(23,47,89));
 context->Clear(PDDI_BUFFER_ALL);
 unsigned char pixel[4]={};
 glReadPixels(320,240,1,1,GL_RGBA,GL_UNSIGNED_BYTE,pixel);
 if(glGetError()!=GL_NO_ERROR||pixel[0]!=23||pixel[1]!=47||pixel[2]!=89)return 4;
 context->SetProjectionMode(PDDI_PROJECTION_DEVICE);
 context->SetCullMode(PDDI_CULL_NONE);
 context->EnableZBuffer(false);
 auto* stream=context->BeginPrims(nullptr,PDDI_PRIM_TRIANGLES,PDDI_V_C,3);
 if(!stream)return 5;
 stream->Colour(pddiColour(255,0,0));stream->Coord(100,100,0);
 stream->Colour(pddiColour(0,255,0));stream->Coord(540,100,0);
 stream->Colour(pddiColour(0,0,255));stream->Coord(320,400,0);
 context->EndPrims(stream);
 glReadPixels(320,240,1,1,GL_RGBA,GL_UNSIGNED_BYTE,pixel);
 if(glGetError()!=GL_NO_ERROR||(pixel[0]==23&&pixel[1]==47&&pixel[2]==89))return 6;
 context->EndFrame();display->SwapBuffers();
 std::puts("PASS: original PDDI renderer clears and draws a triangle through WebGL");
}
