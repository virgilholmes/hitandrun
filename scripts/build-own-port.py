#!/usr/bin/env python3
"""Compile our independent source-port milestone, never download a game engine."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[1]

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',type=Path,default=Path('/home/virgil/Downloads/The Simpsons Hit & Run'))
    args=parser.parse_args()
    source=args.source.resolve()
    original=source/'game/libs/pure3d/p3d/chunkfile.cpp'
    if not original.exists():parser.error('Original source folder does not contain game/libs/pure3d/p3d/chunkfile.cpp')
    emcmake=shutil.which('emcmake');emcc=shutil.which('emcc')
    if not emcmake or not emcc:
        print('Emscripten is missing. Install emscripten, then run this script again.',file=sys.stderr)
        return 1
    build=ROOT/'build/our-wasm';output=ROOT/'public/our-port'
    env={**os.environ,'EM_CACHE':os.environ.get('EM_CACHE',str(ROOT/'build/emscripten-cache'))}
    subprocess.run([emcmake,'cmake','-S',str(ROOT/'native'),'-B',str(build),f'-DSHR_SOURCE={source}','-DCMAKE_BUILD_TYPE=Debug'],env=env,check=True)
    subprocess.run(['cmake','--build',str(build),'--target','source_core_web','-j','4'],env=env,check=True)
    # Publish our earlier independently-written asset visualizer alongside the
    # compiled original-reader milestone. It is not the original game renderer.
    for file in (ROOT/'lib').glob('*.mjs'):shutil.copyfile(file,output/file.name)
    originals=[original,*sorted((source/'game/libs/radmath/radmath').glob('*.cpp'))]
    own=[ROOT/'native/source_core.cpp',ROOT/'native/math_bridge.cpp',*sorted((ROOT/'native/portable/include/p3d').glob('*.hpp')),*sorted((ROOT/'lib').glob('*.mjs'))]
    digest=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
    provenance={
        'milestone':'Original math + original Pure3D chunk reader; no gameplay',
        'compiler':subprocess.check_output([emcc,'--version'],text=True,env=env).splitlines()[0],
        'originalSources':{str(f.relative_to(source)):digest(f) for f in originals},
        'ourAdaptersAndRenderer':{str(f.relative_to(ROOT)):digest(f) for f in own},
        'artifacts':{name:digest(output/name) for name in ['source-core.mjs','source-core.wasm']},
        'usesDownloadedGameEngine':False,
    }
    (output/'provenance.json').write_text(json.dumps(provenance,indent=2)+'\n')
    node=shutil.which('node')
    if not node:raise RuntimeError('Node.js is needed to validate the compiled module')
    subprocess.run([node,str(ROOT/'tests/own-port.test.mjs')],cwd=ROOT,check=True)
    subprocess.run([node,str(ROOT/'tests/springfield.test.mjs')],cwd=ROOT,check=True)
    print('Built and runtime-tested our source-core.wasm from the original sources and our adapters.')
    print('Try it with: python scripts/play.py --own-port')
    print('This milestone reads and displays assets. It does not run gameplay.')
    return 0

if __name__=='__main__':raise SystemExit(main())
