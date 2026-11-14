"""Read library build inputs from the supplied original Visual Studio projects."""
from pathlib import Path
import posixpath
import re
import xml.etree.ElementTree as ET

NS={'m':'http://schemas.microsoft.com/developer/msbuild/2003'}
PROJECTS={
 'radcore':'radcore/build/win32/radcore.vcxproj',
 'radcontent':'radcontent/build/win32/radcontent.vcxproj',
 'pure3d':'pure3d/build/win32/Pure3D.vcxproj',
 'choreo':'choreo/build/win32/choreo.vcxproj',
 'poser':'poser/build/win32/poser.vcxproj',
 'sim':'sim/build/win32/sim.vcxproj',
 'radscript':'radscript/build/win32/radscript.vcxproj',
 'radmusic':'radmusic/build/win32/radmusic.vcxproj',
 'scrooby':'scrooby/build/win32/ScroobyLib.vcxproj',
 'radsound':'radsound/build/win32/radsound.vcxproj',
 'radmovie':'radmovie/build/win32/radmovie.vcxproj',
 'png':'pure3d/build/win32/libpng.vcxproj',
 'zlib':'pure3d/build/win32/zlib.vcxproj',
}

def applies(condition,config='Release|Win32'):
 if not condition:return True
 match=re.search(r"==\s*'([^']+)'",condition)
 return bool(match and match.group(1)==config)

def collect(source):
 index={p.relative_to(source).as_posix().casefold():p.relative_to(source).as_posix() for p in source.rglob('*') if p.is_file()}
 result={}
 for name,rel in PROJECTS.items():
  project=source/'libs'/rel;tree=ET.parse(project);base=project.parent.relative_to(source).as_posix()
  sources=[];excluded=[];missing=[];includes=[]
  for e in tree.findall('.//m:ItemGroup/m:ClCompile',NS):
   value=e.attrib.get('Include')
   if not value:continue
   if any(applies(x.attrib.get('Condition','')) and (x.text or '').strip().lower()=='true' for x in e.findall('m:ExcludedFromBuild',NS)):continue
   key=posixpath.normpath(base+'/'+value.replace('\\','/')).casefold()
   if key not in index:missing.append(key);continue
   path=index[key]
   # The supplied platform source is retained in the inventory. Browser
   # replacements are built separately and must supply these real contracts.
   if (name=='radscript' and path.endswith('/win32typeinfovfcall.cpp')) or (name=='pure3d' and '/platform/win32/' in path) or (name=='radcore' and any(t in path for t in ['/src/radtime/time.cpp','/src/raddebug/debug.cpp','/src/radplatform/platform.cpp'])):
    excluded.append(path);continue
   sources.append(path)
  for definition in tree.findall('.//m:ItemDefinitionGroup',NS):
   if not applies(definition.attrib.get('Condition','')):continue
   e=definition.find('m:ClCompile/m:AdditionalIncludeDirectories',NS)
   if e is None:continue
   for inc in (e.text or '').replace('\\','/').split(';'):
    if '$(' in inc or '%(' in inc or not inc:continue
    includes.append(posixpath.normpath(base+'/'+inc))
  # Original sources often include their own short-named precompiled header.
  for p in (source/'libs'/rel.split('/')[0]/'src').rglob('pch.hpp'):
   includes.append(p.parent.relative_to(source).as_posix())
  result[name]={'sources':list(dict.fromkeys(sources)),'includes':list(dict.fromkeys(includes)),'browserReplacements':excluded,'missingSourceFiles':missing}
 return result

def write_cmake(result,dest):
 lines=[]
 for name,data in result.items():
  if not data['sources']:continue
  lines.append('set(ORIGINAL_'+name+'_SOURCES\n'+''.join(' "${STAGED_SOURCE}/'+p+'"\n' for p in data['sources'])+')\n')
  lines.append('set(ORIGINAL_'+name+'_INCLUDES\n'+''.join(' "${STAGED_SOURCE}/'+p+'"\n' for p in data['includes'])+')\n')
 (dest/'library_sources.cmake').write_text(''.join(lines))
