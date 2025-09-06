#!/usr/bin/env bash
set -euo pipefail

# Generate assets/icon.icns from assets/icon.png on macOS
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PNG_ICON="$ROOT_DIR/assets/icon.png"
ICNS_ICON="$ROOT_DIR/assets/icon.icns"
ICONSET_DIR="$ROOT_DIR/assets/tmp.iconset"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Skipping .icns generation (not macOS)"
  exit 0
fi

if [[ ! -f "$PNG_ICON" ]]; then
  echo "icon.png not found at $PNG_ICON"
  exit 1
fi

# If icns exists and newer than png, skip
if [[ -f "$ICNS_ICON" && "$ICNS_ICON" -nt "$PNG_ICON" ]]; then
  echo "icon.icns is up to date"
  exit 0
fi

echo "Generating icon.icns from icon.png..."
rm -rf "$ICONSET_DIR"
mkdir -p "$ICONSET_DIR"

sizes=(16 32 64 128 256 512 1024)
for size in "${sizes[@]}"; do
  sips -z "$size" "$size" "$PNG_ICON" --out "$ICONSET_DIR/icon_${size}x${size}.png" >/dev/null
done

# Create 2x variants for required sizes
cp "$ICONSET_DIR/icon_32x32.png" "$ICONSET_DIR/icon_16x16@2x.png"
cp "$ICONSET_DIR/icon_64x64.png" "$ICONSET_DIR/icon_32x32@2x.png"
cp "$ICONSET_DIR/icon_256x256.png" "$ICONSET_DIR/icon_128x128@2x.png"
cp "$ICONSET_DIR/icon_512x512.png" "$ICONSET_DIR/icon_256x256@2x.png"

# iconutil to build icns
if ! command -v iconutil >/dev/null 2>&1; then
  echo "iconutil not found. Please install Xcode command line tools."
  exit 1
fi

iconutil -c icns "$ICONSET_DIR" -o "$ICNS_ICON"
rm -rf "$ICONSET_DIR"
echo "Generated: $ICNS_ICON"

