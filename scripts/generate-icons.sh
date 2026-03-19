#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_SVG="$ROOT_DIR/build/icons/icon.svg"
OUTPUT_DIR="$ROOT_DIR/build/icons"
PNG_DIR="$OUTPUT_DIR/png"

if ! command -v convert >/dev/null 2>&1; then
  echo "ImageMagick 'convert' is required." >&2
  exit 1
fi

mkdir -p "$PNG_DIR"

for size in 16 24 32 48 64 128 256 512; do
  convert -background none "$SOURCE_SVG" -resize "${size}x${size}" "$PNG_DIR/${size}x${size}.png"
done

cp "$PNG_DIR/512x512.png" "$OUTPUT_DIR/icon.png"

convert \
  "$PNG_DIR/16x16.png" \
  "$PNG_DIR/24x24.png" \
  "$PNG_DIR/32x32.png" \
  "$PNG_DIR/48x48.png" \
  "$PNG_DIR/64x64.png" \
  "$PNG_DIR/128x128.png" \
  "$PNG_DIR/256x256.png" \
  "$OUTPUT_DIR/icon.ico"

echo "Generated icons in $OUTPUT_DIR"
