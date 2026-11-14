#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
source_dir="${1:-/home/virgil/Downloads/The Simpsons Hit & Run}"
if ! command -v emcmake >/dev/null 2>&1; then
  echo 'Emscripten is required: activate its emsdk environment before this build.' >&2
  exit 1
fi
emcmake cmake -S "$project_dir/native" -B "$project_dir/build/wasm" "-DSHR_SOURCE=$source_dir"
cmake --build "$project_dir/build/wasm" --target radmath_web -j 4
