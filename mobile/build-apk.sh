#!/usr/bin/env bash
# Builds the debug APK: the web bundle, the static files vite does not copy (fonts, icons, animations),
# then the Capacitor sync and gradle. Needs JDK 21 (Android Studio's jbr) in JAVA_HOME.
set -e
cd "$(dirname "$0")/../tweb"
NODE_OPTIONS=--max-old-space-size=8192 npx vite build
cp -r public/assets public/changelogs dist/
cp public/*.webmanifest public/browserconfig.xml public/version public/encoderWorker.min.wasm public/decoderWorker.min.wasm dist/
git checkout src/lib/settingsSearch/generated.ts 2>/dev/null || true
cd ../mobile
npx cap sync android
cd android
./gradlew.bat assembleDebug
echo "APK: $(pwd)/app/build/outputs/apk/debug/app-debug.apk"
