#!/usr/bin/env python3
"""Run real C++ and JavaScript checks using locally installed GCC/CMake/Qt.
This does not build Next.js or verify WebGL in a browser.
"""
import argparse
from pathlib import Path
import shlex
import subprocess
p=Path(__file__).resolve().parents[1]
args=argparse.ArgumentParser()
args.add_argument('--source',type=Path,default=Path('/home/virgil/Downloads/The Simpsons Hit & Run'))
args=args.parse_args()
build=p/'build';build.mkdir(exist_ok=True)
subprocess.run(['cmake','-S',str(p/'native'),'-B',str(build/'native'),f'-DSHR_SOURCE={args.source}'],check=True)
r=subprocess.run(['cmake','--build',str(build/'native'),'-j','4'],capture_output=True,text=True)
(build/'native/build.log').write_text(r.stdout+r.stderr)
if r.returncode:
 print(r.stderr[-4000:]);raise SystemExit(r.returncode)
subprocess.run(['ctest','--test-dir',str(build/'native'),'--output-on-failure'],check=True)
flags=shlex.split(subprocess.check_output(['pkg-config','--cflags','--libs','Qt6Qml'],text=True))
subprocess.run(['g++','-fPIC','-std=c++17',str(p/'scripts/js-runner.cpp'),'-o',str(build/'js-runner'),*flags],check=True)
assets=args.source/'game/cd/PC/art'
files=[assets/'cars'/name for name in ['famil_v.p3d','bart_v.p3d','apu_v.p3d','ambul.p3d','burns_v.p3d']]
files += [assets/name for name in ['l1r1.p3d','l1r2.p3d','l1r3.p3d']]
subprocess.run([str(build/'js-runner'),str(p),*[str(f) for f in files if f.exists()]],check=True)

# JavaScriptCore understands modern async functions; Qt's JS engine does not.
# Use the runtime's own loader and libraries without changing global settings.
for runtime in sorted(Path('/var/lib/flatpak/runtime/org.gnome.Platform/x86_64').glob('*/*/files')):
 loader=runtime/'lib/x86_64-linux-gnu/ld-linux-x86-64.so.2'
 jsc=runtime/'libexec/webkitgtk-6.0/jsc'
 if loader.exists() and jsc.exists():
  subprocess.run([str(loader),'--library-path',str(runtime/'lib/x86_64-linux-gnu'),str(jsc),str(p/'tests/jsc-checks.mjs'),'--',*[str(f) for f in files if f.exists()]],check=True)
  subprocess.run([str(loader),'--library-path',str(runtime/'lib/x86_64-linux-gnu'),str(jsc),str(p/'tests/launcher-checks.mjs'),'--',str(p)],check=True)
  break
else:
 print('JavaScriptCore not found; modern renderer syntax check skipped.')

subprocess.run(['python','-m','unittest','discover','-s',str(p/'tests'),'-p','test_server.py'],check=True)
print('Offline C++/JS and HTTP-handler checks passed. Next.js and browser gameplay remain unverified.')
