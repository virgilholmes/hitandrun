#!/usr/bin/env python3
"""Launch the existing original-engine browser port using local retail assets."""
import argparse
import os
from pathlib import Path
import shutil
import subprocess
import sys
import threading
import webbrowser
from game_server import DEFAULT_ASSETS,PROJECT,create_server,status_for

def main():
    cli=argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--assets',type=Path,default=Path(os.environ.get('SHR_ASSET_DIR',str(DEFAULT_ASSETS))))
    cli.add_argument('--port',type=int,default=8080)
    cli.add_argument('--next',action='store_true',help='Use the Next.js interface; requires npm install first')
    cli.add_argument('--production',action='store_true',help='Run a previously built Next.js production app')
    cli.add_argument('--no-open',action='store_true')
    cli.add_argument('--own-port',action='store_true',help='Open our independent source-port milestone, not the downloaded game engine')
    args=cli.parse_args()
    if not 1<=args.port<=65535:cli.error('Port must be between 1 and 65535')
    if args.next and args.port==3000:cli.error('The asset server port must differ from Next.js port 3000')
    status=status_for(args.assets)
    if not status['ready']:print('No local PC installation found. Choose your installed game ZIP in the browser.',flush=True)
    node=shutil.which('node')
    next_cli=PROJECT/'node_modules/next/dist/bin/next'
    if args.next and (not node or not next_cli.exists()):cli.error('Next.js requires Node.js and npm install. To try the game without Node, run this command without --next.')
    try:server=create_server(args.port,args.assets)
    except OSError as e:print(f'Cannot start the loopback server: {e}',file=sys.stderr);return 1
    child=None
    try:
        if args.next:
            thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
            env={**os.environ,'SHR_BACKEND_URL':f'http://127.0.0.1:{args.port}'}
            child=subprocess.Popen([node,str(next_cli),'start' if args.production else 'dev','--hostname','127.0.0.1','--port','3000'],cwd=PROJECT,env=env)
            url='http://127.0.0.1:3000'+('/our-port/preview.html' if args.own_port else '')
        else:url=f'http://127.0.0.1:{args.port}/'+('our-port/preview.html' if args.own_port else 'engine/index.html')
        print(f'Open {url}',flush=True)
        print('Use the local PC installation or choose a game ZIP in the browser. Game data stays on this machine.',flush=True)
        if args.own_port:print('Our source-port milestone: asset reading and rendering only; gameplay is pending.',flush=True)
        if not args.own_port and not status['engineInstalled']:print('The browser will fetch and verify the engine binary on first launch. Internet access is needed once.',flush=True)
        print('Press Ctrl+C to stop.',flush=True)
        if not args.no_open:webbrowser.open(url)
        if child:return child.wait()
        server.serve_forever()
    except KeyboardInterrupt:return 0
    finally:
        if child:
            if child.poll() is None:
                child.terminate()
                try:child.wait(timeout=5)
                except subprocess.TimeoutExpired:child.kill();child.wait()
            server.shutdown()
        server.server_close()
    return 0

if __name__=='__main__':raise SystemExit(main())
