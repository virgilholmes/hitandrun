#pragma once
// Browser-facing declarations for the original Pure3D platform contract.
// Implementations must be linked before the full game can run.
#include <pddi/pddi.hpp>
class tContext;class tFile;class tPolySkinLoader;class tTask;
class tContextInitData {
public:
 int xsize=640,ysize=480,bpp=32;
 pddiDisplayMode displayMode;
 unsigned bufferMask=0;
 const char* canvasSelector="#canvas";
};
class tPlatform {
public:
 static tPlatform* Create();static void Destroy(tPlatform*);static tPlatform* GetPlatform();
 tContext* CreateContext(tContextInitData*);void DestroyContext(tContext*);
 void SetActiveContext(tContext*);tContext* GetActiveContext(){return currentContext;}
 tFile* OpenFile(const char*);void AddTask(tTask*);void RemoveTask(tTask*);void CycleTasks();
 tPolySkinLoader* CreatePolySkinLoader();
protected:
 tContext* currentContext=nullptr;
};
