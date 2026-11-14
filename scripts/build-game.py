#!/usr/bin/env python3
"""Compile original gameplay and report remaining full-engine port failures.
This does not claim to produce a playable executable while backends are missing.
"""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
ROOT=Path(__file__).resolve().parents[1]

def main():
    cli=argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--source',type=Path,default=Path('/home/virgil/Downloads/The Simpsons Hit & Run'))
    cli.add_argument('--clean',action='store_true',help='Discard previous full-engine object files before compilation')
    args=cli.parse_args()
    for tool in ['emcmake','emcc','cmake','node']:
        if not shutil.which(tool):cli.error(f'{tool} is missing')
    env={**os.environ,'EM_CACHE':os.environ.get('EM_CACHE',str(ROOT/'build/emscripten-cache'))}
    subprocess.run([sys.executable,str(ROOT/'scripts/prepare-game-source.py'),'--source',str(args.source)],check=True,env=env)
    folder=ROOT/'build/full-game';build=folder/'wasm'
    subprocess.run(['emcmake','cmake','-S',str(ROOT/'native/full-game'),'-B',str(build),f'-DSTAGED_SOURCE={folder}/source'],check=True,env=env)
    command=['cmake','--build',str(build),'--parallel','4']
    if args.clean:command.append('--clean-first')
    command+=['--','-k']
    print('Compiling original gameplay and engine libraries; diagnostics: '+str(folder/'engine-build.log'),flush=True)
    with (folder/'engine-build.log').open('w') as log:result=subprocess.run(command,stdout=log,stderr=subprocess.STDOUT,env=env)
    diagnostics=(folder/'engine-build.log').read_text(errors='replace')
    errors=[line for line in diagnostics.splitlines() if 'error: ' in line]
    inventory=json.loads((folder/'game_sources.json').read_text())
    objects=list((build/'CMakeFiles/gameplay_objects.dir').rglob('*.o'))
    runner="import{pathToFileURL}from'node:url';const{default:create}=await import(pathToFileURL(process.argv[1]));await create();"
    runtime_checks={}
    for label,target in [('foundation','foundation_clock_smoke'),('physics','physics_smoke'),('scriptCalls','vcall_smoke'),('fibers','fibers_smoke'),('glState','gl_state_smoke')]:
        check_build=subprocess.run(['cmake','--build',str(build),'--target',target,'--parallel','4'],capture_output=True,text=True,env=env)
        (folder/(label+'-build.log')).write_text(check_build.stdout+check_build.stderr)
        check_run=None
        if check_build.returncode==0:
            check_run=subprocess.run(['node','--input-type=module','-e',runner,str(build/(target+'.mjs'))],capture_output=True,text=True,env=env)
            print(check_run.stdout,end='');print(check_run.stderr,end='')
            (folder/(label+'-runtime.log')).write_text(check_run.stdout+check_run.stderr)
        runtime_checks[label]=check_run is not None and check_run.returncode==0
    # A static archive cannot prove its browser imports link. Keep the renderer
    # diagnostic separate from runtime tests that genuinely execute in Node.
    renderer_build=subprocess.run(['cmake','--build',str(build),'--target','renderer_smoke','--parallel','4'],capture_output=True,text=True,env=env)
    (folder/'renderer-build.log').write_text(renderer_build.stdout+renderer_build.stderr)
    libraries=json.loads((folder/'library_sources.json').read_text())
    library_report={name:{
        'expectedUnits':len(data['sources']),
        'objectFilesPresent':len(list((build/f'CMakeFiles/original_{name}.dir').rglob('*.o'))),
        'archivePresent':(build/f'liboriginal_{name}.a').exists(),
        'browserReplacements':data['browserReplacements'],
        'missingSourceFiles':data['missingSourceFiles'],
    } for name,data in libraries.items()}
    report={
        'status':'objects_and_archives_built' if result.returncode==0 else 'compile_incomplete',
        'readyToPlay':False,
        'expectedGameplayUnits':len(inventory['compileUnits']),
        'objectFilesPresent':len(objects),
        'cleanBuild':args.clean,
        'engineLibraries':library_report,
        'physicsRuntimePassed':runtime_checks['physics'],
        'scriptCallsRuntimePassed':runtime_checks['scriptCalls'],
        'fibersRuntimePassed':runtime_checks['fibers'],
        'glStateRuntimePassed':runtime_checks['glState'],
        'rendererLinkPassed':renderer_build.returncode==0,
        'rendererRuntimePassed':False,
        'errors':errors,
        'foundationRuntimePassed':runtime_checks['foundation'],
        'platformFilesRequiringReplacements':inventory['platformFilesRequiringReplacements'],
        'remainingSubsystems':['Pure3D browser platform + PDDI rendering','Foundation files, allocation, controllers and scheduling','Browser audio and video backends','Startup, saves and full-engine linking'],
    }
    (folder/'build-report.json').write_text(json.dumps(report,indent=2)+'\n')
    print(f"Gameplay objects present: {len(objects)}/{len(inventory['compileUnits'])}. Compilation result: {report['status']}.")
    print('This is not a playable game build. See build/full-game/build-report.json for blockers.')
    return 1 if result.returncode or renderer_build.returncode or not all(runtime_checks.values()) else 0

if __name__=='__main__':raise SystemExit(main())
