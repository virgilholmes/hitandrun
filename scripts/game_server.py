"""Loopback-only asset server for the original browser engine and Next.js.
No game data is copied into public/. Only known asset file types are exposed.
"""
from functools import lru_cache
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit
import json
import mimetypes
import re

PROJECT=Path(__file__).resolve().parents[1]
DEFAULT_ASSETS=Path('/home/virgil/Games/The Simpsons Hit & Run')
ALLOWED_EXTENSIONS={'.rcf','.p3d','.mfk','.con','.pag','.scr','.rmv','.rsd','.prj','.cho','.toc','.bin','.typ','.txt','.png','.bmp','.tga','.jpg','.wav','.ogg','.mp3','.dat','.fnt'}
REQUIRED=('scripts.rcf','dialog.rcf','art/frontend','art/l1i00.p3d','sound')

class AssetError(Exception):
    pass

@lru_cache(maxsize=4096)
def resolve_asset(root_text, relative):
    root=Path(root_text).resolve()
    # URL decoding occurs once here; never pass an already-decoded path.
    relative=unquote(relative).replace('\\','/')
    parts=relative.split('/')
    if not parts or any(p in ('','..','.') or '\x00' in p or ':' in p for p in parts):
        raise AssetError('Invalid asset path')
    if Path(parts[-1]).suffix.lower() not in ALLOWED_EXTENSIONS:
        raise AssetError('Not a game asset')
    if parts[0].lower() in {'mods','dlls','glcache','lucas'}:
        raise AssetError('Not an original game asset')
    current=root
    for part in parts:
        exact=current/part
        if exact.exists():current=exact
        else:
            if not current.is_dir():raise FileNotFoundError(relative)
            matches=[f for f in current.iterdir() if f.name.casefold()==part.casefold()]
            if len(matches)!=1:raise FileNotFoundError(relative)
            current=matches[0]
        current=current.resolve()
        if not current.is_relative_to(root):raise AssetError('Asset outside game directory')
    if not current.is_file():raise FileNotFoundError(relative)
    return current

def parse_range(value,size):
    """Return inclusive byte endpoints, or None for an ordinary full response."""
    if value is None:return None
    match=re.fullmatch(r'bytes=(\d*)-(\d*)',value.strip())
    if not match or not any(match.groups()) or size<=0:raise AssetError('Invalid byte range')
    a,b=match.groups()
    if a:
        start=int(a);end=min(int(b),size-1) if b else size-1
    else:
        length=int(b)
        if length<=0:raise AssetError('Invalid suffix range')
        start=max(0,size-length);end=size-1
    if start<0 or start>=size or end<start:raise AssetError('Unsatisfiable byte range')
    return start,end

def status_for(root):
    missing=[name for name in REQUIRED if not (root/name).exists()]
    return {'ready':not missing,'missing':missing,'engineInstalled':(PROJECT/'public/engine/SRR2.wasm').is_file()}

def make_handler(asset_root=DEFAULT_ASSETS):
    asset_root=Path(asset_root).resolve()
    public=PROJECT/'public'
    class Handler(BaseHTTPRequestHandler):
        protocol_version='HTTP/1.1'
        def end_headers(self):
            self.send_header('Cross-Origin-Opener-Policy','same-origin')
            self.send_header('Cross-Origin-Embedder-Policy','require-corp')
            self.send_header('Cross-Origin-Resource-Policy','same-origin')
            self.send_header('X-Content-Type-Options','nosniff')
            super().end_headers()
        def log_message(self,fmt,*args):
            if getattr(self,'_error',False):super().log_message(fmt,*args)
        def json(self,body,status=200):
            data=json.dumps(body).encode()
            self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(data)));self.send_header('Cache-Control','no-store');self.end_headers()
            if self.command!='HEAD':self.wfile.write(data)
        def do_HEAD(self):self.handle_file()
        def do_GET(self):self.handle_file()
        def handle_file(self):
            path=urlsplit(self.path).path
            if path=='/api/game-status':return self.json(status_for(asset_root))
            if path in ('/','/engine','/engine/','/our-port','/our-port/'):
                self.send_response(302);self.send_header('Location','/our-port/index.html' if path.startswith('/our-port') else '/engine/index.html');self.send_header('Content-Length','0');self.end_headers();return
            try:
                if path.startswith('/assets/'):
                    file=resolve_asset(str(asset_root),path[len('/assets/'):])
                    content_type='application/octet-stream'
                elif path.startswith('/our-port/'):
                    name=path[len('/our-port/'):]
                    if name not in {'index.html','preview.html','app.mjs','source-core.mjs','source-core.wasm','provenance.json','p3d.mjs','scene.mjs','renderer.mjs','camera.mjs','springfield.mjs'}:raise FileNotFoundError(path)
                    file=public/'our-port'/name
                    content_type={'.html':'text/html; charset=utf-8','.mjs':'text/javascript','.wasm':'application/wasm','.json':'application/json'}.get(file.suffix,'application/octet-stream')
                elif path.startswith('/engine/'):

                    # Explicit files only; no file browsing or source exposure.
                    name=path[len('/engine/'):]
                    if name not in {'index.html','bootstrap.mjs','graphics.mjs','integrity.mjs','SRR2.js','SRR2.wasm','logo.png'}:raise FileNotFoundError(path)
                    file=public/'engine'/name
                    content_type={'.wasm':'application/wasm','.mjs':'text/javascript','.js':'text/javascript','.html':'text/html; charset=utf-8','.png':'image/png'}.get(file.suffix,'application/octet-stream')
                else:raise FileNotFoundError(path)
                size=file.stat().st_size
                try:partial=parse_range(self.headers.get('Range'),size)
                except (AssetError,ValueError):
                    self.send_response(416);self.send_header('Content-Range',f'bytes */{size}');self.send_header('Content-Length','0');self.end_headers();return
                start,end=partial if partial else (0,size-1)
                length=max(0,end-start+1)
                with file.open('rb') as source:
                    self.send_response(206 if partial else 200)
                    self.send_header('Content-Type',content_type);self.send_header('Content-Length',str(length));self.send_header('Accept-Ranges','bytes')
                    self.send_header('Cache-Control','no-cache')
                    if partial:self.send_header('Content-Range',f'bytes {start}-{end}/{size}')
                    self.end_headers()
                    if self.command=='HEAD':return
                    source.seek(start);remaining=length
                    while remaining:
                        data=source.read(min(1024*1024,remaining))
                        if not data:break
                        self.wfile.write(data);remaining-=len(data)
            except (FileNotFoundError,NotADirectoryError,AssetError,PermissionError):
                self.send_error(404,'File not found')
            except (BrokenPipeError,ConnectionResetError):pass
    return Handler

def create_server(port=8080,assets=DEFAULT_ASSETS):
    return ThreadingHTTPServer(('127.0.0.1',port),make_handler(assets))
