#!/usr/bin/env python3
"""Fetch only the pinned engine binary. No game data is downloaded."""
from pathlib import Path
from urllib.request import Request,urlopen
import hashlib
import os
import sys

COMMIT='7712a23723a60c752682debf727be10488866d87'
BLOB_SHA='4a92e45140f42fd224d0804fe236c4052240f9ac'
SIZE=4655088
DEST=Path(__file__).resolve().parents[1]/'public/engine/SRR2.wasm'

def valid(data):
    return len(data)==SIZE and data[:4]==b'\0asm' and hashlib.sha1(f'blob {len(data)}\0'.encode()+data).hexdigest()==BLOB_SHA

def fetch():
    if DEST.is_file() and valid(DEST.read_bytes()):print('Verified local engine binary.');return
    url=f'https://raw.githubusercontent.com/iscle/the-simpsons-hit-and-run-wasm/{COMMIT}/SRR2.wasm'
    print('Downloading the original browser engine (4.7 MB)…')
    with urlopen(Request(url,headers={'User-Agent':'hit-and-run-local-launcher'}),timeout=30) as response:
        data=response.read(SIZE+1)
    if not valid(data):raise ValueError('Engine integrity check failed')
    DEST.parent.mkdir(parents=True,exist_ok=True)
    temp=DEST.with_suffix('.wasm.download')
    temp.write_bytes(data);os.replace(temp,DEST)
    print(f'Engine verified and saved: {DEST}')

if __name__=='__main__':
    try:fetch()
    except Exception as e:print(f'Engine download failed: {e}',file=sys.stderr);raise SystemExit(1)
