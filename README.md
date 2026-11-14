# Hit & Run browser launcher

Local launcher and Next.js interface for the existing WebAssembly engine by
[iscle](https://github.com/iscle/the-simpsons-hit-and-run-wasm), based on
ZenoArrows’ port. Uses a retail PC installation supplied on your machine.

## Run

```bash
./PLAY.sh
```

The browser opens automatically. Select graphics settings, then click **Play**.
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
```

The source-port tests additionally require locally generated artifacts and
retail assets. See [detailed local documentation](README.txt).
