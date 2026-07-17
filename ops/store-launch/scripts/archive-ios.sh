#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"
export PATH="$(ruby -e 'print Gem.user_dir' 2>/dev/null)/bin:${PATH}"
mkdir -p out build
echo '<!doctype html><title>BVS</title>' > out/index.html
npx cap sync ios
xcodebuild -workspace ios/App/App.xcworkspace \
  -scheme App \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$ROOT/build/BVSRadio.xcarchive" \
  -allowProvisioningUpdates \
  -allowProvisioningDeviceRegistration \
  DEVELOPMENT_TEAM=VGFK77VH73 \
  CODE_SIGN_STYLE=Automatic \
  ENABLE_USER_SCRIPT_SANDBOXING=NO \
  archive
echo "Archive OK: $ROOT/build/BVSRadio.xcarchive"
echo "Next: open Xcode → Window → Organizer → Distribute App"
open -a Xcode "$ROOT/build/BVSRadio.xcarchive"
