import hashlib
from io import BytesIO
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import unittest

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from game_server import AssetError,DEFAULT_ASSETS,make_handler,parse_range,resolve_asset,status_for

class Connection:
    def __init__(self,request):self.input=BytesIO(request);self.output=BytesIO()
    def makefile(self,*args,**kwargs):return self.input
    def sendall(self,data):self.output.write(data)

def request(handler,path,method='GET',headers=None):
    fields={'Host':'localhost','Connection':'close',**(headers or {})}
    raw=(method+' '+path+' HTTP/1.1\r\n'+''.join(k+': '+v+'\r\n' for k,v in fields.items())+'\r\n').encode()
    conn=Connection(raw);handler(conn,('127.0.0.1',1),SimpleNamespace())
    head,body=conn.output.getvalue().split(b'\r\n\r\n',1)
    lines=head.decode().split('\r\n')
    status=int(lines[0].split()[1]);headers=dict(line.split(': ',1) for line in lines[1:])
    return status,headers,body

class ServerChecks(unittest.TestCase):
    def setUp(self):
        self.temp=TemporaryDirectory();self.root=Path(self.temp.name)
        (self.root/'Art').mkdir();(self.root/'Art/Test.p3d').write_bytes(b'0123456789')
        self.handler=make_handler(self.root)
    def tearDown(self):self.temp.cleanup();resolve_asset.cache_clear()
    def test_full_and_head(self):
        code,headers,body=request(self.handler,'/assets/art/test.p3d')
        self.assertEqual((code,body),(200,b'0123456789'))
        self.assertEqual(headers['Content-Length'],'10')
        self.assertEqual(headers['Accept-Ranges'],'bytes')
        self.assertEqual(headers['Cross-Origin-Opener-Policy'],'same-origin')
        self.assertEqual(headers['Cross-Origin-Embedder-Policy'],'require-corp')
        code,headers,body=request(self.handler,'/assets/Art/Test.p3d','HEAD')
        self.assertEqual((code,headers['Content-Length'],body),(200,'10',b''))
    def test_ranges(self):
        for value,expected,content_range in [('bytes=2-5',b'2345','bytes 2-5/10'),('bytes=-3',b'789','bytes 7-9/10'),('bytes=8-',b'89','bytes 8-9/10'),('bytes=0-999',b'0123456789','bytes 0-9/10')]:
            code,headers,body=request(self.handler,'/assets/art/test.p3d',headers={'Range':value})
            self.assertEqual((code,body),(206,expected));self.assertEqual(headers['Content-Range'],content_range)
    def test_invalid_ranges(self):
        for value in ['bytes=99-','bytes=5-2','bytes=0-1,3-4','bytes=-0','garbage','bytes=-']:
            code,headers,body=request(self.handler,'/assets/art/test.p3d',headers={'Range':value})
            self.assertEqual((code,body),(416,b''));self.assertEqual(headers['Content-Range'],'bytes */10')
    def test_no_source_or_executable_exposure(self):
        (self.root/'secret.txt').write_text('secret')
        (self.root/'Simpsons.exe').write_bytes(b'not an asset')
        for path in ['/assets/../secret.txt','/assets/%2e%2e/secret.txt','/assets/Art/%2e%2e/secret.txt','/assets/Simpsons.exe','/assets/Art','/engine/../../package.json','/README.txt']:
            self.assertEqual(request(self.handler,path)[0],404,path)
        (self.root/'Art/outside.txt').symlink_to(ROOT/'package.json')
        self.assertEqual(request(self.handler,'/assets/Art/outside.txt')[0],404)
    def test_status_and_shell(self):
        self.assertFalse(status_for(self.root)['ready'])
        code,headers,body=request(self.handler,'/api/game-status')
        self.assertEqual(code,200);self.assertIn(b'"ready": false',body)
        self.assertEqual(request(self.handler,'/')[0],302)
        self.assertEqual(request(self.handler,'/engine/index.html')[0],200)
        self.assertEqual(request(self.handler,'/engine/SRR2.js')[1]['Content-Type'],'text/javascript')
    def test_browser_import_scripts_are_served(self):
        for path in ['/game-files-sw.js','/engine/zip.mjs','/engine/local-files.mjs','/engine/asset-response.mjs']:
            code,headers,body=request(self.handler,path)
            self.assertEqual(code,200,path)
            self.assertEqual(headers['Content-Type'],'text/javascript')
            self.assertTrue(body)
        self.assertEqual(request(self.handler,'/game-files-sw.js/../package.json')[0],404)
    def test_empty_file(self):
        (self.root/'Art/empty.p3d').touch()
        self.assertEqual(request(self.handler,'/assets/Art/empty.p3d')[2],b'')
        self.assertEqual(request(self.handler,'/assets/Art/empty.p3d',headers={'Range':'bytes=0-0'})[0],416)
    def test_pinned_javascript(self):
        data=(ROOT/'public/engine/SRR2.js').read_bytes()
        digest=hashlib.sha1(f'blob {len(data)}\0'.encode()+data).hexdigest()
        self.assertEqual(digest,'1dcc07030585d6e4816fcda7abcbdd93b3c5fa1b')
    def test_retail_asset_streaming(self):
        if not DEFAULT_ASSETS.exists():self.skipTest('Local retail installation unavailable')
        self.assertTrue(status_for(DEFAULT_ASSETS)['ready'])
        h=make_handler(DEFAULT_ASSETS)
        code,headers,body=request(h,'/assets/dialog.rcf','HEAD')
        self.assertEqual(code,200);self.assertEqual(int(headers['Content-Length']),(DEFAULT_ASSETS/'dialog.rcf').stat().st_size)
        code,headers,body=request(h,'/assets/art/l1i00.p3d',headers={'Range':'bytes=0-127'})
        self.assertEqual(code,206)
        with (DEFAULT_ASSETS/'art/l1i00.p3d').open('rb') as f:self.assertEqual(body,f.read(128))

if __name__=='__main__':unittest.main()
