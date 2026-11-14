# Hit & Run browser launcher

Local launcher and Next.js interface for the existing WebAssembly engine by
[iscle](https://github.com/iscle/the-simpsons-hit-and-run-wasm), based on
ZenoArrows’ port. Uses a retail PC installation supplied on your machine.

## Run

```bash
./PLAY.sh
```

The browser opens automatically. Click **Choose game ZIP** and select a ZIP
of your **installed retail PC game folder**, containing `scripts.rcf`,
`dialog.rcf`, `art/` and `sound/`. This is game data, not C++ source code.
The importer extracts files into browser-local storage; it does not upload
them to a server. Imports are remembered in this browser for this site.
After import, select graphics settings and click **Play**.

The existing local-installation path is still available without a ZIP.
The default asset location is `/home/virgil/Games/The Simpsons Hit & Run`.
For another location:

```bash
python scripts/play.py --assets '/path/to/retail/game'
```

For the Next.js interface (Node.js 20.9+):

```bash
npm install
npm run dev
```

## Graphics

The launcher includes experimental 16:9 projection correction, 720p/1080p/1440p
rendering, browser antialiasing and up to 8× anisotropic filtering. Widescreen
keeps the HUD centered; original scene culling is unchanged, so use 4:3 if
objects pop in at the edges. Automated wrapper tests pass; live browser
rendering with these changes is not verified here.

## Contents

Game data, the supplied original game source, saves, downloaded Wasm binaries,
and generated builds are excluded. The engine Wasm binary is fetched and
integrity-checked in the browser on first launch; see
[upstream attribution](public/engine/UPSTREAM.txt).

`native/` and the source-build scripts retain an **unfinished** independent
source-port experiment. It is not the playable launcher and cannot boot the
game. `--own-port` opens its asset preview only.

## Checks

```bash
npm run test:graphics
npm run test:server
npm run test:local-files
```

The source-port tests additionally require locally generated artifacts and
retail assets. See [detailed local documentation](README.txt).

## Browser ZIP import

Use standard ZIP compression (Store or Deflate). Password-protected, split and
ZIP64 archives are not supported. A folder surrounding the game files inside
the ZIP is fine. The importer verifies file lengths and CRCs, skips executable
files and mods, and keeps the previous import if extraction fails. It needs
enough browser storage for the new extracted files while retaining the old
import. Failed/cancelled staging directories are removed on the next import.

The local asset service worker serves GET/HEAD and single byte ranges from
browser storage; unrelated requests go through normally. Hosting requires
HTTPS or localhost and the existing COOP/COEP headers. Simply opening the HTML
file, or hosting without those headers, is insufficient for this engine.

Automated ZIP, integrity, import transaction, service-worker routing, and range
checks pass. Browser OPFS/service-worker activation and complete gameplay with
an imported multi-GB installation have not been live-tested here. ZIP fixture
tests require Node.js 22.15+ for its built-in CRC function.
