Current launcher: working prebuilt engine (iscle).
Run ./PLAY.sh, or npm run dev for Next.js. The root page and old /our-port
bookmarks open that engine. The independent source-port experiment is retained
and is only opened explicitly with --own-port; it remains incomplete.

The Simpsons: Hit & Run — local browser launcher + Next.js integration

Try the original game engine:
  python /home/virgil/Projects/hit-and-run-web/scripts/play.py
Then click Start game in the browser. Stop the terminal process with Ctrl+C.

This now integrates an EXISTING full-game WebAssembly engine build by iscle,
based on ZenoArrows' source port. It is no longer just an asset inspector.
The user confirmed the original game launches and runs in their browser.
Full campaign completion has not been verified.

No Node.js or C++ compiler is required for the Python launch path. It serves
only local game files; gameplay executes in the browser's WebAssembly engine,
not in a remote emulator. Your assets are not uploaded.

The retail PC installation was detected at:
  /home/virgil/Games/The Simpsons Hit & Run
To choose another installation:
  python scripts/play.py --assets '/path/to/retail/game'
Or set SHR_ASSET_DIR. Do not use the development assets in the source folder.

Engine download:
The unmodified engine JS is present and matches its pinned upstream Git hash.
The 4.7 MB WASM binary is fetched by your browser on first launch, checked
against its pinned Git blob hash, and cached locally in the browser.
To install the binary locally beforehand:
  python scripts/fetch-engine.py
This downloads ENGINE CODE ONLY. No game data is downloaded. Once installed,
the local browser launch can work without an external engine download.
The code accepts only the pinned binary with the expected size and hash.

Next.js interface (when Node.js >=20.9 and npm are installed):
  cd /home/virgil/Projects/hit-and-run-web
  npm install
  npm run dev
Open http://127.0.0.1:3000. The launcher starts the Python asset service and the
Next.js dev server together. The root page embeds the same local game shell.
The earlier asset inspector is available at /inspect.

Production Next.js:
  npm run build
  npm start
The asset service remains local; a deployed website cannot read your PC files.
No public deployment or game-asset upload has been performed.

Implementation:
- Same-origin asset streaming with HEAD and correct single HTTP Range support.
- COOP/COEP headers for SharedArrayBuffer and the engine's pthreads.
- Case-insensitive resolution of game asset filenames on Linux.
- Game asset directory remains external; executable and source files are not
  exposed, and traversal/symlink escapes are rejected.
- A click-to-start game canvas, loading/error UI, fullscreen and audio resume.
- Responsive 4:3 display with white letterboxing, including in fullscreen.
  The full picture scales to fit the available viewport without cropping.
- Original engine save callbacks connected to local IndexedDB storage.
- Engine download integrity checking and browser cache.

Verification completed:
- Eight Python tests pass against the actual request handler, using in-memory
  HTTP transports rather than sockets. They cover full reads, HEAD, byte ranges,
  invalid ranges, zero-length files, isolation headers, blocked paths, case
  resolution, the original engine JS hash and real retail asset bytes.
- JavaScriptCore accepts the browser bootstrap, integrity module, original
  engine JS and Next.js config syntax. Tests check invalid binary rejection,
  header configuration and rewrite configuration.
- Original radmath compiles natively and its CTest passes. This is supplementary
  groundwork and is not the engine build used by the main launcher.
- The earlier P3D decoder passed fourteen checks and decoded eight original
  assets (973 primitive groups) in Qt JS and JavaScriptCore.

Verification blocked:
This Codex sandbox prohibits creating even a loopback socket (EPERM), so the
HTTP server cannot be launched here. Browser startup is also sandbox-blocked.
Node/npm are absent, and terminal downloads are disabled. Therefore neither
Next.js build/start nor end-to-end browser gameplay has been demonstrated here.
You must launch the Python command in your NORMAL terminal, outside the Codex
sandbox, to perform the actual game test. Errors appear in the game overlay;
expand Port and diagnostics to see the runtime log.

Run checks:
  python -m unittest discover -s tests -p test_server.py -v
  python scripts/check-offline.py
  npm test

The optional original-math Emscripten target remains in native/:
  bash scripts/build-wasm.sh '/path/to/original/source'
It builds ONLY the math library, not the game, and needs an activated SDK.
The main launcher uses the prebuilt full-game engine instead.

Upstream engine:
  https://github.com/iscle/the-simpsons-hit-and-run-wasm
Pinned revision:
  7712a23723a60c752682debf727be10488866d87
Original source port:
  https://github.com/iscle/The-Simpsons-Hit-and-Run/tree/wasm-port
Artifact details and attribution: public/engine/UPSTREAM.txt
The original game and its assets retain their respective owners' rights.
Upstream compatibility and limitations apply; this is not a claim of a newly
completed, independently verified game port.

Independent source port — new development track
----------------------------------------------
The user chose to write our browser adaptations against the original supplied
source rather than base the port on iscle's adaptations. The working borrowed
engine remains available separately as a reference, with attribution.

Current independent source milestone:
- Original radmath translation units build natively with our portability fixes.
- Original Pure3D chunkfile.cpp builds against our new bounded memory-file,
  assertion and reference-counting adapters in native/portable/include/p3d.
- Original reader tests pass on both development and retail P3D files, plus
  little/big-endian synthetic files and malformed/truncated input.
- No gameplay has been independently ported yet. The new browser page renders
  static assets with our JavaScript renderer after checking them in our C++
  reader module. This is not the original gameplay/rendering engine.
- Compressed P3D wrappers are rejected explicitly; no unsafe decoder is enabled.

Install the compiler in your normal Arch Linux terminal:
  sudo pacman -S --needed emscripten nodejs npm
Verify emcc --version works (activate the SDK environment if needed).

Compile this independent milestone:
  cd /home/virgil/Projects/hit-and-run-web
  python scripts/build-own-port.py

Then launch:
  python scripts/play.py --own-port
Or use the Next.js route /our-port with npm run dev.

The build targets public/our-port/source-core.mjs and source-core.wasm.
It writes provenance.json with compiler information, source/adaptor hashes and
artifact hashes. Nothing in this build downloads or imports SRR2.js/SRR2.wasm.
It never silently falls back to the reference engine. Generated modules and
renderer copies are build artifacts and are ignored in source control.

Remaining independent milestones:
1. Compile and exercise this foundation as actual WebAssembly.
2. Port original geometry/material loading and PDDI rendering interfaces.
3. Port timing, files, input, audio and the game loop.
4. Boot menus, then a level, then characters, driving and missions.

The independent source-core WASM has now been compiled with Emscripten 7.0.0.
Five runtime tests pass in Node.js: original math, both byte orders, malformed
input recovery, and two retail assets matched against the independent JS reader.
Run npm run test:own-port to repeat them. This remains an asset milestone, not
a playable independent game port.

Springfield neighborhood preview
--------------------------------
The independent page now has Load Springfield neighborhood. It loads the Level 1
terrain resources and the l1z1/l1r1/l1r7 region combination from the original
mission scripts. Shared materials resolve 283 PNG textures for 406 primitive
groups with no missing texture references in the detected retail installation.
Terrain resources contribute shared textures/materials; their unrelated prop
and background meshes are not dumped into the neighborhood preview.

Click the canvas to focus it. WASD/arrows move the inspection camera; Q/E move
vertically, Shift moves faster, dragging orbits, and scrolling zooms. Fit view
shows the whole loaded area; Simpsons' house returns to the initial location.
This is camera navigation over static geometry, not original player movement.
Characters, traffic, collision and missions remain unimplemented.

Restart scripts/play.py --own-port after this update: the server now serves the
new camera and neighborhood modules. Refresh the browser and load the area.
Checks: npm run test:own-port (9 runtime tests), npm run test:springfield
(shared resource/geometry validation and camera movement checks).

Full original gameplay compilation
----------------------------------
The full-game work now lives in native/full-game. It is separate from both the
borrowed reference engine and the independent static asset preview.

  python scripts/build-game.py --clean

The latest clean attempt compiled 480/510 selected original gameplay files to
Wasm object files. It did NOT link a complete game. The object count is not a
percentage of overall port completion: engine libraries, browser platform
backends and linking are still required. The browser clock/debug foundation
passed a real WebAssembly runtime test. Game::Run has been adapted to yield
through Emscripten frame callbacks while retaining its original update body;
that loop has compiled but has not run as part of a full game.

See native/full-game/STATUS.txt and build/full-game/build-report.json for the
remaining failures and source provenance. The build command exits nonzero
while required gameplay files fail, and readyToPlay remains false.


Original full-game engine build update (2026-11-13)
------------------------------------------------
`npm run build:game` now attempts the original engine libraries as well as
original gameplay, and records each library's source inventory, missing files,
platform replacements and object/archive presence in build/full-game/build-report.json.
The build remains nonzero and readyToPlay=false while required ports are missing.

Pure3D, sim, choreo, poser, radcontent, radmusic, Scrooby, libpng, zlib and
radmath archives build from the supplied source. The original physics matrix
solver is linked and executed in Wasm, checking multiplication, inversion and
solving against known results. Browser clock/debug runtime checks also pass.
The latest incremental build has 494/510 gameplay object files present; this
is not a percentage of overall game completion.

The independent original-source game is still not playable. Required work is
in radcore platform services, browser input, Pure3D/PDDI WebGL integration,
radscript calling conventions, audio/video, startup and full linking.
Detailed status: native/full-game/STATUS.txt.


Browser script calls and original renderer integration (2026-11-13)
-----------------------------------------------------------------
The radscript source archive now builds with a new Wasm virtual-call adapter
in native/full-game/browser_vcall.cpp. Its linked Node/Wasm test verifies
mixed integer/float/string arguments, virtual method selection and
void/integer/float returns. The supplied retail typeinfo contains no double
declarations; unsupported double ABI calls currently fail explicitly.

The original PDDI OpenGL sources compile with browser_display.cpp, which
creates a WebGL canvas context. This remains an experimental path: the
renderer integration test does not link against this Emscripten version's
incomplete legacy GL support. Required lighting/material imports remain
unresolved. No placeholder functions or ignored linker errors were added.
The renderer test is not accessible as a playable game and has not run in
a browser. build:game explicitly attempts its link and records the failure.

Latest full build: incomplete, readyToPlay=false. Clock, original physics
and browser script-call runtime tests pass. The complete original-source game
still needs platform services, graphics compatibility, input, audio/video,
startup and successful full-program linking before it can boot.


Original renderer browser compatibility update (2026-11-13)
----------------------------------------------------------
The PDDI renderer diagnostic now links successfully. Browser compatibility
adds actual point-light attenuation and emissive materials to a generated copy
of the installed Emscripten GL layer, with retained licensing and hashes.
Texture format/wrapping and context-reset behavior were also corrected.
Compiled Node/Wasm checks pass for light and material state. GPU pixel checks
remain UNVERIFIED: the Qt browser process failed to launch in this sandbox.
The self-contained diagnostic is build/full-game/wasm/renderer_smoke.html.

The Foundation fiber API also passes Wasm stack-switching tests with an
isolated test allocator. It is not a complete threading or loader backend;
loader worker threads and semaphores still require browser implementations.
The complete game remains unplayable. Current detailed status and limitations:
native/full-game/STATUS.txt and build/full-game/build-report.json.


Launcher graphics options
-------------------------
Restart the local launcher after updating, then refresh the browser. The title
screen offers experimental 16:9 widescreen, original 4:3, original resolution,
720p, 1080p and 1440p, plus optional browser antialiasing. Preferences persist
separately from game saves and apply on the next Play. 16:9 and 1080p are the
new defaults. If performance is poor, select 720p or original resolution.

public/engine/graphics.mjs wraps the browser canvas and WebGL context; the
pinned engine JS/Wasm are unchanged. It increases drawing-buffer resolution,
scales on-screen viewports/scissors and adjusts the engine's named projection
uniform. It preserves logical mouse coordinates, centers the original HUD,
and skips offscreen framebuffer passes. Texture anisotropy is enabled up to
8x when supported. Original textures and lighting assets are unchanged.

Widescreen expands the rendered horizontal view, but the game simulation and
its original culling/frustum code are unchanged, so objects may pop in near
wide screen edges. A 4:3 option is available. If the expected projection shader
is not observed after boot, the wrapper falls back to 4:3 automatically.

Five automated graphics tests cover projection/FOV, UI proportions, logical
input dimensions, viewport/scissor scaling, framebuffer isolation, texture
filtering and fallback. Eight server tests also pass. Live browser gameplay
with these options is not verified in this sandbox.


Choose game ZIP in the browser
-----------------------------
The title screen now accepts a ZIP of the installed retail PC game folder.
Choose game ZIP -> select the archive -> wait for import -> Play. Include
scripts.rcf, dialog.rcf, art/ and sound/. A C++ source ZIP is not playable data.
No game data is uploaded to a server: files are streamed into local browser
storage and served through a local service worker with byte-range support.
The launch script now works without a preconfigured retail installation.

Restart PLAY.sh after updating so it serves the new modules/service worker.
Standard Store/Deflate ZIPs are supported, not encrypted/split/ZIP64 archives.
Use localhost or HTTPS with the existing isolation headers. Imports are scoped
to this browser and origin; changing hostname or port uses separate storage.
Six import/range/worker tests, five graphics tests and nine server tests pass.
Full game playback from browser-imported assets remains unverified here.
