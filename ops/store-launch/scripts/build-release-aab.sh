#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-21-openjdk-amd64}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
cd "$ROOT/android"
./gradlew bundleRelease --no-daemon --max-workers=2
cp -v app/build/outputs/bundle/release/app-release.aab \
  "$ROOT/ops/store-launch/builds/bvsradio-release.aab"
ls -lah "$ROOT/ops/store-launch/builds/bvsradio-release.aab"
