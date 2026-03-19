#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ICON_ROOT="$ROOT_DIR/build/icons"
PNG_ROOT="$ICON_ROOT/png"
ICONSET_DIR="$ICON_ROOT/AsterNote.iconset"

rm -rf "$ICONSET_DIR"
mkdir -p "$ICONSET_DIR"

cp "$PNG_ROOT/16x16.png" "$ICONSET_DIR/icon_16x16.png"
cp "$PNG_ROOT/32x32.png" "$ICONSET_DIR/icon_16x16@2x.png"
cp "$PNG_ROOT/32x32.png" "$ICONSET_DIR/icon_32x32.png"
cp "$PNG_ROOT/64x64.png" "$ICONSET_DIR/icon_32x32@2x.png"
cp "$PNG_ROOT/128x128.png" "$ICONSET_DIR/icon_128x128.png"
cp "$PNG_ROOT/256x256.png" "$ICONSET_DIR/icon_128x128@2x.png"
cp "$PNG_ROOT/256x256.png" "$ICONSET_DIR/icon_256x256.png"
cp "$PNG_ROOT/512x512.png" "$ICONSET_DIR/icon_256x256@2x.png"
cp "$PNG_ROOT/512x512.png" "$ICONSET_DIR/icon_512x512.png"

sips -z 1024 1024 "$PNG_ROOT/512x512.png" --out "$ICONSET_DIR/icon_512x512@2x.png" >/dev/null
iconutil -c icns "$ICONSET_DIR" -o "$ICON_ROOT/icon.icns"

rm -rf "$ICONSET_DIR"
