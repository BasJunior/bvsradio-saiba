#!/usr/bin/env bash
# Low-load VPS debug APK build for BVS Radio Capacitor shell
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-21-openjdk-amd64}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

cd "$ROOT"
mkdir -p out ops/store-launch/builds ops/store-launch/logs
if [[ ! -f out/index.html ]]; then
  printf '%s\n' '<!DOCTYPE html><html><body>BVS shell</body></html>' > out/index.html
fi
echo "sdk.dir=$ANDROID_HOME" > android/local.properties
npx cap sync android
cd android
./gradlew assembleDebug --no-daemon --max-workers=2
APK="app/build/outputs/apk/debug/app-debug.apk"
cp -v "$APK" "$ROOT/ops/store-launch/builds/bvsradio-debug.apk"
ls -lah "$ROOT/ops/store-launch/builds/bvsradio-debug.apk"
echo "OK: sideload with adb install -r ops/store-launch/builds/bvsradio-debug.apk"
