#!/usr/bin/env bash
set -euo pipefail

# TubeFlow Automated Safe Release Script
# Ensures that:
# 1. Code signing identity is verified in keychain before building
# 2. electronLanguages minimizes codesign time
# 3. Code signature of the built application is strictly verified BEFORE uploading
# 4. GitHub Release assets and updater metadata are published consistently

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

echo "🔍 [1/6] Checking Environment and Prerequisites..."

# 1. Check gh CLI
if ! command -v gh &> /dev/null; then
  echo "❌ Error: GitHub CLI ('gh') is not installed or not in PATH."
  exit 1
fi

# 2. Check code signing identity
CERT_NAME="Apple Development: alaa.els3id@icloud.com (A59KS552Q4)"
if ! security find-identity -v -p codesigning | grep -q "$CERT_NAME"; then
  echo "❌ Error: Code signing certificate '$CERT_NAME' not found in macOS keychain."
  echo "Available identities:"
  security find-identity -v -p codesigning
  exit 1
fi
echo "✅ Code signing certificate verified: $CERT_NAME"

# 3. Determine target version
CURRENT_VERSION=$(node -p "require('./package.json').version")
TARGET_VERSION="${1:-$CURRENT_VERSION}"

if [ "$TARGET_VERSION" != "$CURRENT_VERSION" ]; then
  echo "📝 Updating version from $CURRENT_VERSION to $TARGET_VERSION in package.json..."
  npm version "$TARGET_VERSION" --no-git-tag-version
  npm install --package-lock-only --silent
fi

echo "📦 Target version: v$TARGET_VERSION"

# 4. Clean old build artifacts
echo "🧹 [2/6] Cleaning previous release artifacts..."
rm -rf release/mac-arm64 "release/TubeFlow-$TARGET_VERSION"* release/latest-mac.yml

# 5. Build and Package with signing
echo "⚙️ [3/6] Building and packaging signed macOS binaries..."
npm run build
npx electron-builder --mac

# 6. CRITICAL VALIDATION: Verify Code Signature
echo "🛡️ [4/6] Verifying macOS application code signature..."
APP_PATH="release/mac-arm64/TubeFlow.app"

if [ ! -d "$APP_PATH" ]; then
  echo "❌ Error: $APP_PATH was not generated!"
  exit 1
fi

codesign --verify --deep --strict "$APP_PATH"
echo "✅ Strict codesign verification passed!"

codesign -d -r- "$APP_PATH"
echo "✅ Designated requirement validated!"

# Check output files
DMG_FILE="release/TubeFlow-$TARGET_VERSION-arm64.dmg"
ZIP_FILE="release/TubeFlow-$TARGET_VERSION-arm64-mac.zip"
YML_FILE="release/latest-mac.yml"

for file in "$DMG_FILE" "$ZIP_FILE" "$YML_FILE"; do
  if [ ! -f "$file" ]; then
    echo "❌ Error: Required release asset '$file' is missing!"
    exit 1
  fi
done
echo "✅ All required distribution assets verified."

# 7. Git Commit & Tag
echo "🏷️ [5/6] Committing and tagging release..."
git add package.json package-lock.json CHANGELOG.md || true
if ! git diff --cached --quiet; then
  git commit -m "release: v$TARGET_VERSION"
fi

if ! git rev-parse "v$TARGET_VERSION" >/dev/null 2>&1; then
  git tag -a "v$TARGET_VERSION" -m "v$TARGET_VERSION"
fi

git push origin main
git push origin "v$TARGET_VERSION"

# 8. GitHub Release
echo "🚀 [6/6] Publishing to GitHub Releases..."
if gh release view "v$TARGET_VERSION" >/dev/null 2>&1; then
  echo "Release v$TARGET_VERSION exists. Uploading updated assets with --clobber..."
  gh release upload "v$TARGET_VERSION" \
    "$DMG_FILE" \
    "$DMG_FILE.blockmap" \
    "$ZIP_FILE" \
    "$ZIP_FILE.blockmap" \
    "$YML_FILE" \
    --clobber
else
  echo "Creating new GitHub release v$TARGET_VERSION..."
  gh release create "v$TARGET_VERSION" \
    "$DMG_FILE" \
    "$DMG_FILE.blockmap" \
    "$ZIP_FILE" \
    "$ZIP_FILE.blockmap" \
    "$YML_FILE" \
    --title "v$TARGET_VERSION" \
    --generate-notes
fi

echo ""
echo "🎉 Successfully released TubeFlow v$TARGET_VERSION!"
echo "🔗 View release: https://github.com/alaaels3id/TubeFlow/releases/tag/v$TARGET_VERSION"
