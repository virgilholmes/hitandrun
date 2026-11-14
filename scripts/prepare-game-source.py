#!/usr/bin/env python3
"""Stage original source and our browser portability edits without altering it."""
from pathlib import Path
import argparse
import hashlib
import json
import re
import posixpath
import sys
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',type=Path,default=Path('/home/virgil/Downloads/The Simpsons Hit & Run'))
    args=parser.parse_args()
    source=args.source.resolve()/'game';dest=ROOT/'build/full-game/source'
    if not (source/'code/main/game.cpp').exists():parser.error('Original game source is missing')
    sys.path.insert(0,str(ROOT/'native/full-game'))
    from adapt_loop import adapt_cpp,adapt_hpp
    from library_projects import collect,write_cmake,applies
    changed=[];count=0
    headers={f.relative_to(source).as_posix().casefold():f.relative_to(source).as_posix() for f in source.rglob('*') if f.is_file() and f.suffix.lower() in {'.h','.hpp','.inc','.inl','.cpp','.c'}}
    include_roots=['code','libs/radcore/inc','libs/radmovie/inc','libs/radsound/inc','libs/radscript/inc','libs/radmusic/inc','libs/pure3d','libs/scrooby/inc','libs/scrooby/src','libs/radmath','libs/sim','libs/poser/inc','libs/choreo/inc','libs/radcontent/inc']
    def includes(text,relative):
        def fix(match):
            requested=match.group(1).replace('\\','/').strip().rstrip('.')
            for base in [relative.parent.as_posix(),*include_roots]:
                key=posixpath.normpath(base+'/'+requested).casefold()
                if key in headers:return '#include "'+posixpath.relpath(headers[key],relative.parent.as_posix())+'"'
            return match.group(0).replace('\\','/')
        return re.sub(r'^\s*#include\s*[<"]([^>"\n]+)[>"]',fix,text,flags=re.M)
    for folder in ['code','libs']:
        for file in (source/folder).rglob('*'):
            if not file.is_file() or file.suffix.lower() not in {'.h','.hpp','.cpp','.c','.inl','.inc'}:continue
            relative=file.relative_to(source);output=dest/relative
            text=file.read_text(errors='surrogateescape')
            original=text
            # Extend platform validation only. Keep Windows/console code paths
            # disabled; real browser implementations live in native/full-game.
            text=re.sub(r'(^\s*#if[^\n]*!defined\s*\(\s*RAD_GAMECUBE\s*\)[^\n]*!defined\s*\(\s*RAD_WIN32\s*\)[^\n]*)',r'\1 && !defined(RAD_WEB)',text,flags=re.M)
            if relative.as_posix()=='libs/radmath/radmath/util.hpp':
                text=text.replace('#include <math.h>','#include <math.h>\n#include <cmath>').replace('_isnan(n)','std::isnan(n)')
            if relative.as_posix()=='libs/radcore/inc/raddebug.hpp':
                marker='typedef void (radDebugOutputHandler)(const char * pString );'
                text=text.replace(marker,marker+'\n#ifdef RAD_WEB\nbool rDebugAssertFail_Implementation(const char*,const char*,unsigned);\n#define rReleaseBreak() __builtin_trap()\n#endif\n')
            name=relative.as_posix()
            if name=='libs/radcore/inc/radtime.hpp':
                text=text.replace('radTime64 radTimeGetMicroseconds64( void );','#ifdef RAD_WEB\ntypedef unsigned long long radTime64;\n#endif\nradTime64 radTimeGetMicroseconds64( void );')
            if name=='code/main/globaltypes.h':
                text=text.replace('#endif //GLOBALTYPES_H','#ifdef RAD_WEB\ntypedef unsigned long long simpsonsUInt64;\n#endif\n#endif //GLOBALTYPES_H')
            if name=='code/main/tuidunaligned.h':
                text=text.replace('#elif defined(RAD_GAMECUBE)','#elif defined(RAD_GAMECUBE) || defined(RAD_WEB)')
            if name=='libs/radcore/inc/radmemory.hpp':
                text=text.replace('#if defined (RAD_WIN32) || defined (RAD_XBOX)\n    radMemorySpace_Main','#if defined (RAD_WIN32) || defined (RAD_XBOX) || defined(RAD_WEB)\n    radMemorySpace_Main')
            if name=='libs/radcore/inc/radfile.hpp':
                text=text.replace('#define RADFILE_HPP','#define RADFILE_HPP\n#ifdef RAD_WEB\nstruct radMemcardInfo { char dummy; };\n#endif')
            if name=='libs/radcontent/inc/radload/utility/hashtable.hpp':
                text=text.replace('        RawIterator it( this );','        typename HashTable<T>::RawIterator it( this );')
            if name=='libs/pure3d/p3d/array.hpp':
                for cls in ['tDynamicArray','tPtrArray']:
                    marker='template <class T> class '+cls+' : public tArray<T>\n{\npublic:'
                    text=text.replace(marker,marker+'\n    using tArray<T>::size;\n    using tArray<T>::data;')
            if name=='libs/pure3d/p3d/platform.hpp':
                text=text.replace('#ifdef RAD_LINUX','#if defined(RAD_LINUX) && !defined(RAD_WEB)')
                text=text.replace('#ifndef _BASE_PLATFORM_HPP','#ifdef RAD_WEB\n#include <p3d/platform/web/platform.hpp>\n#endif\n#ifndef _BASE_PLATFORM_HPP')
            if name=='code/input/controller.h':
                text=text.replace('namespace Input\n{','namespace Input\n{\n#ifdef RAD_WEB\n    const static unsigned int MaxPorts=4;\n    const static unsigned int MaxSlots=1;\n#endif')
            if name=='libs/pure3d/p3d/array.hpp':
                marker='template <class T> class tPtrDynamicArray : public tPtrArray<T>\n{\npublic:'
                text=text.replace(marker,marker+'\n    using tPtrArray<T>::size;\n    using tPtrArray<T>::data;')
            if name=='libs/pure3d/p3d/inventory.hpp':
                text=text.replace('#include <p3d/platform.hpp>','#include <p3d/platform.hpp>\n#include <p3d/context.hpp>')
            if name=='libs/choreo/inc/choreo/basebank.hpp':
                start=text.index('template <class T>\ninline T* find')
                end=text.index('//---------------------------------------------------------------------------\n// interface BaseBank',start)
                functions=text[start:end]
                text=text[:start]+text[end:]
                marker='    virtual RawIterator* NewRawIterator() = 0;\n};'
                text=text.replace(marker,marker+'\n\n'+functions,1)
            if name=='libs/pure3d/p3d/array.hpp':
                text=text.replace('Grow(Size()*2);','Grow(this->Size()*2);')
            if name=='code/memory/map.h':
                text=text.replace('    MapElementVector::iterator it;','    typename MapElementVector::iterator it;')
            if name=='code/roads/geometry.h':
                text=text.replace('        GetAverage(mNormalizedAverage);','        this->GetAverage(mNormalizedAverage);')
            if name=='code/ai/actionbuttonhandler.h':
                text=text.replace('## terminal','terminal')
            if name=='code/main/game.cpp':text=adapt_cpp(text)
            if name=='code/main/game.h':text=adapt_hpp(text)
            if name=='libs/pure3d/p3d/plat_types.hpp':
                text=text.replace('#ifdef RAD_LINUX','#if defined(RAD_LINUX) && !defined(RAD_WEB)')
                text=text.replace('#ifndef _BASE_PLAT_TYPES_HPP','#ifdef RAD_WEB\n#include <p3d/platform/web/plat_types.hpp>\n#endif\n#ifndef _BASE_PLAT_TYPES_HPP')
            if name=='code/presentation/gui/guientity.h':
                text=text.replace('#ifdef RAD_WIN32 // parallel the xbox for now.','#if defined(RAD_WIN32) || defined(RAD_WEB) // Retail PC text index.')
            if name=='code/worldsim/coins/sparkle.cpp':
                text=text.replace('#if defined( RAD_XBOX ) || defined( RAD_WIN32 )','#if defined( RAD_XBOX ) || defined( RAD_WIN32 ) || defined(RAD_WEB)')
            text=re.sub(r'^class rmt::(?:Vector|Quaternion|Matrix);\s*$', '',text,flags=re.M)
            if name.endswith('.cpp'):
                text=re.sub(r'^([^\n;{}]*radLinkedClass<[^\n;]+>::s_[^\n;]+=.*;)$',r'template<> \1',text,flags=re.M)
            if name=='code/ai/sequencer/action.h':
                text=text.replace('class Action: public Task','CharacterAi::StateManager* hrGetCharacterStateManager(Character*);\n\nclass Action: public Task')
                text=text.replace('mpCharacter->GetStateManager()', 'hrGetCharacterStateManager(mpCharacter)')
            if name=='code/ai/sequencer/action.cpp':
                text+='\nCharacterAi::StateManager* hrGetCharacterStateManager(Character* character) { return character->GetStateManager(); }\n'
            text=re.sub(r'^class poser::(Joint|Pose);\s*$',r'namespace poser { class \1; }',text,flags=re.M)
            if name=='libs/radcore/inc/raddebugwatch.hpp':
                marker='inline void radDbgWatchAddUnsignedInt'
                extension='#ifdef RAD_WEB\ntemplate<class Return,class... Args> inline void radDbgWatchDelete(Return (*callback)(Args...)) { radDbgWatchDelete(reinterpret_cast<void*>(callback)); }\n#endif\n'
                if marker in text:text=text.replace(marker,extension+marker,1)
            if name=='code/console/console.cpp':
                text=text.replace('char *found = strchr','const char *found = strchr')
            if name=='code/console/upcase.cpp':text='#include <ctype.h>\n'+text
            if name=='code/supersprint/supersprintmanager.cpp':
                text=text.replace("SuperSprintData::CHARACTER_NAMES[ mPlayers[ k ].mCharacterIndex ] != '\\0'",'SuperSprintData::CHARACTER_NAMES[ mPlayers[ k ].mCharacterIndex ] != nullptr')
            if name=='code/data/memcard/memorycardmanager.h':
                text=text.replace('#ifdef RAD_WIN32\n    enum eMemcardInfoLoadState','#if defined(RAD_WIN32) || defined(RAD_WEB)\n    enum eMemcardInfoLoadState')
            if name in ['code/sound/soundrenderer/soundnucleus.cpp','code/sound/soundrenderer/soundresourcemanager.cpp']:
                text=text.replace('defined RAD_XBOX || defined RAD_WIN32','defined RAD_XBOX || defined RAD_WIN32 || defined RAD_WEB')
                text=text.replace('defined( RAD_XBOX ) || defined( RAD_WIN32 )','defined( RAD_XBOX ) || defined( RAD_WIN32 ) || defined(RAD_WEB)')
            if name in ['code/presentation/gui/bootup/guiscreenlicense.cpp','code/presentation/gui/guiscreenmessage.cpp','code/presentation/gui/backend/guiloadingbar.h','code/camera/supersprintcam.cpp']:
                text=text.replace('#ifdef RAD_WIN32','#if defined(RAD_WIN32) || defined(RAD_WEB)')
            if name=='code/constants/movienames.h':
                text=text.replace('#elif defined RAD_GAMECUBE','#elif defined RAD_GAMECUBE || defined RAD_WEB')
            if name=='code/render/Culling/ScratchArray.h':
                text=text.replace('mpData+mSize == orSplitArray.mpData','mpData+mSize == irAdjArray.mpData')
            if name=='code/worldsim/worldphysicsmanager.cpp':
                text=text.replace('character==true','character!=nullptr').replace('vehicle==true','vehicle!=nullptr')
                text=text.replace('character == true','character != nullptr').replace('vehicle == true','vehicle != nullptr')
            if name=='libs/radcore/inc/radmemory.hpp':
                text=text.replace('#if defined (RAD_WIN32) || defined (RAD_XBOX)\n#define STANDARD_ALIGNMENT','#if defined (RAD_WIN32) || defined (RAD_XBOX) || defined(RAD_WEB)\n#define STANDARD_ALIGNMENT')
            if name in ['libs/sim/simcommon/largesymmetricmatrix.cpp','libs/sim/simphysics/virtualcm.cpp']:
                text=text.replace('#include "windows.h"','// Browser diagnostics use the original radDebug output handler.')
                text=text.replace('OutputDebugString(', 'rDebugString(')
            if name=='libs/sim/simcommon/simmath.hpp':
                text=text.replace('val = Min(val,maxv);','val = val < maxv ? val : maxv;').replace('return Max(val,minv);','return val > minv ? val : minv;')
            if name=='libs/choreo/src/puppet.cpp':
                # These five error returns belong to pointer-returning Play methods.
                text=re.sub(r'((?:AnimationDriver|LocomotionDriver|SynchronizationDriver)\* Puppet::Play[\s\S]*?)(?=\n(?:[A-Za-z_][^\n]*Puppet::|//---)|\Z)', lambda m:m.group(0).replace('return false;','return nullptr;'),text)
            if name=='libs/pure3d/p3d/anim/animate.cpp':
                text=text.replace('#ifdef RAD_WIN32','#if defined(RAD_WIN32) || defined(RAD_WEB)')
            if name=='libs/pure3d/p3d/queue.hpp':
                text=text.replace('if(Empty())','if(this->Empty())')
            if name=='libs/pure3d/p3d/inventory.cpp':
                text=text.replace('"Section %p: %d elements\\n", table->GetUID()', '"Section %llu: %d elements\\n", static_cast<unsigned long long>(table->GetUID())')
            if name=='code/worldsim/worldphysicsmanager.cpp':
                text=text.replace('obj )==false', 'obj )==nullptr')
            if name=='libs/pure3d/lib/libpng/pngconf.h':
                text='#ifdef RAD_WEB\n#define PNG_USER_MEM_SUPPORTED\n#endif\n'+text
            if name=='libs/radmusic/src/radmusic/resource/resource_manager.cpp':
                text=text.replace('defined RAD_WIN32 || defined RAD_XBOX','defined RAD_WIN32 || defined RAD_XBOX || defined RAD_WEB')
            if name=='libs/radmusic/src/radmusic/schema/schema_util.cpp':
                text=text.replace('#if defined RAD_WIN32','#if defined RAD_WIN32 || defined RAD_WEB')
            if name=='libs/scrooby/src/FeChunkHandler.cpp':
                text='#include <strings.h>\n'+text.replace('stricmp(', 'strcasecmp(')
            if name.startswith('libs/pure3d/pddi/gl/') and '/display_' not in name:
                text=text.replace('#ifdef RAD_LINUX', '#if defined(RAD_LINUX) && !defined(RAD_WEB)')
                text='#ifdef RAD_WEB\n#include <pddi/platform/web/gldisplay.hpp>\n#include <GL/gl.h>\n#define LIGHT_MODEL_COLOR_CONTROL_EXT (GLenum)0x81F8\n#define SINGLE_COLOR_EXT (GLenum)0x81F9\n#define SEPARATE_SPECULAR_COLOR_EXT (GLenum)0x81FA\n#undef GL_BGRA_EXT\n#define GL_BGRA_EXT GL_RGBA\n#endif\n'+text
            if name=='libs/pure3d/pddi/pddi.hpp':
                text=text.replace('#ifdef RAD_LINUX','#if defined(RAD_LINUX) && !defined(RAD_WEB)')
            if name=='libs/pure3d/pddi/base/debug.hpp':
                text=text.replace('#ifdef RAD_LINUX','#if defined(RAD_LINUX) && !defined(RAD_WEB)')
                text=text.replace('// PDDI Debugging support','// PDDI Debugging support\n#ifdef RAD_WEB\n#define pddiBreak() __builtin_trap()\n#endif')
            if name=='libs/radscript/inc/radnamespace.hpp':
                text=text.replace('struct IRadNameSpace;','struct IRadNameSpace;\ntemplate<> IRadNameSpace* radLinkedClass<IRadNameSpace>::s_pLinkedClassHead;\ntemplate<> IRadNameSpace* radLinkedClass<IRadNameSpace>::s_pLinkedClassTail;')
            if name=='libs/radscript/src/typeinfo/TypeInfoMethod.cpp':
                text='#include <browser_vcall.hpp>\n#include <stdexcept>\n'+text
                marker='                return InvokeVf( pI, m_VTableOffset, pParams, numParams );'
                # Keep desktop assembly calls unchanged, inserting a separate Web branch.
                before='            #ifdef RAD_WEB\n                if(numParams>64)throw std::invalid_argument("Too many radscript arguments");\n                unsigned char kinds[64]={};\n                for(unsigned i=0;i<numParams;++i){\n                    auto* info=GetParamInfoAt(i);\n                    if(info->GetIndLvl()==0 && info->GetHashedType()==ParserConst::TOK_DOUBLE)\n                        throw std::invalid_argument("Packed radscript double arguments require a separate ABI adapter");\n                    kinds[i]=(info->GetIndLvl()==0 && info->GetHashedType()==ParserConst::TOK_FLOAT)?1:0;\n                }\n                auto* resultInfo=GetReturnInfo();\n                if(resultInfo->GetIndLvl()==0 && resultInfo->GetHashedType()==ParserConst::TOK_DOUBLE)\n                    throw std::invalid_argument("Packed radscript double results require a separate ABI adapter");\n                return hrBrowserInvokeVirtual(pI,m_VTableOffset,pParams,numParams,kinds,\n                    resultInfo->GetIndLvl()==0 && resultInfo->GetHashedType()==ParserConst::TOK_FLOAT);\n            #endif\n'
                text=text.replace('            #if defined (RAD_WIN32) || defined (RAD_XBOX)',before+'            #if defined (RAD_WIN32) || defined (RAD_XBOX)')
            if name=='libs/pure3d/pddi/gl/glcon.cpp':
                # Separate-specular is an optional desktop extension absent in WebGL.
                text=text.replace('        if(display->CheckExtension("GL_EXT_separate_specular_color"))', '#ifndef RAD_WEB\n        if(display->CheckExtension("GL_EXT_separate_specular_color"))')
                text=text.replace('glLightModeli(LIGHT_MODEL_COLOR_CONTROL_EXT,SEPARATE_SPECULAR_COLOR_EXT);\n        }','glLightModeli(LIGHT_MODEL_COLOR_CONTROL_EXT,SEPARATE_SPECULAR_COLOR_EXT);\n        }\n#endif')
                for field,kind in [('attenA','GL_CONSTANT_ATTENUATION'),('attenB','GL_LINEAR_ATTENUATION'),('attenC','GL_QUADRATIC_ATTENUATION')]:
                    text=text.replace('glLightf(h, '+kind+', state.lightingState->light[handle].'+field+');','glLightfv(h, '+kind+', &state.lightingState->light[handle].'+field+');')
            if name=='libs/pure3d/pddi/gl/glmat.cpp':
                text=re.sub(r'\bGL_CLAMP\b','GL_CLAMP_TO_EDGE',text)
                text=text.replace('glMaterialf(GL_FRONT_AND_BACK,GL_SHININESS, texEnv[i].shininess);','glMaterialfv(GL_FRONT_AND_BACK,GL_SHININESS, &texEnv[i].shininess);')
            if name=='libs/pure3d/pddi/gl/gltex.cpp':
                text=text.replace('GL_RGBA8','GL_RGBA')
                # Texture residency priority is a driver hint, unavailable in WebGL.
                # Retain the engine priority property used by GetPriority().
                text=text.replace('    glPrioritizeTextures(1,&gltexture,&fpriority);','#ifndef RAD_WEB\n    glPrioritizeTextures(1,&gltexture,&fpriority);\n#endif')
            text=includes(text,relative)
            output.parent.mkdir(parents=True,exist_ok=True)
            data=text.encode(errors='surrogateescape')
            if not output.exists() or output.read_bytes()!=data:output.write_bytes(data)
            if text!=original:changed.append({'file':str(relative),'originalSha256':hashlib.sha256(file.read_bytes()).hexdigest(),'stagedSha256':hashlib.sha256(data).hexdigest()})
            count+=1
    (dest.parent/'port-edits.json').write_text(json.dumps({'status':'incomplete full-game browser port','source':str(source),'stagedTextFiles':count,'edits':changed},indent=2)+'\n')
    project=args.source.resolve()/'game/build/win32/SRR2.vcxproj'
    ns={'m':'http://schemas.microsoft.com/developer/msbuild/2003'}
    all_sources={f.relative_to(source).as_posix().casefold():f.relative_to(source).as_posix() for f in (source/'code').rglob('*') if f.is_file()}
    selected=[];excluded=[]
    for entry in ET.parse(project).findall('.//m:ItemGroup/m:ClCompile',ns):
        if any((e.text or '').strip().lower()=='true' and applies(e.attrib.get('Condition','')) for e in entry.findall('m:ExcludedFromBuild',ns)):continue
        key=posixpath.normpath('build/win32/'+entry.attrib['Include'].replace('\\','/')).casefold()
        if key not in all_sources:raise ValueError('Original compile unit missing: '+key)
        relative=all_sources[key]
        if any(name in relative.lower() for name in ['win32','ps2reverb','xboxreverb']) or relative.lower().endswith('/pchsrr2.cpp'):
            excluded.append(relative);continue
        selected.append(relative)
    generated='set(ORIGINAL_GAMEPLAY_SOURCES\n'+''.join('  "${STAGED_SOURCE}/'+name+'"\n' for name in selected)+')\n'
    (dest.parent/'game_sources.cmake').write_text(generated)
    (dest.parent/'game_sources.json').write_text(json.dumps({'compileUnits':selected,'platformFilesRequiringReplacements':excluded},indent=2)+'\n')
    libraries=collect(source)
    write_cmake(libraries,dest.parent)
    (dest.parent/'library_sources.json').write_text(json.dumps(libraries,indent=2)+'\n')
    print('Library compile units: '+str(sum(len(v['sources']) for v in libraries.values())))
    print(f'Full gameplay compile list: {len(selected)} original units; {len(excluded)} platform-specific replacements pending.')
    print(f'Staged {count} source files; {len(changed)} portability edits. Original files untouched.')

if __name__=='__main__':main()
