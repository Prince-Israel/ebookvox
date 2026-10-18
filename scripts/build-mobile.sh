#!/usr/bin/env bash
# Builds the downloadable mobile apps into ./downloads using this Mac's CURRENT network address (or EBOOKVOX_URL if you set it).
#   bash scripts/build-mobile.sh                 # LAN build for phones on the same Wi-Fi
#   EBOOKVOX_URL=https://app.yourdomain.com bash scripts/build-mobile.sh   # production build
# The address is baked into the app, so rebuild whenever the Mac's address changes (Wi-Fi switched, hotspot…).
set -euo pipefail
cd "$(dirname "$0")/.."
export JAVA_HOME="${JAVA_HOME:-$HOME/jdks/jdk-21.0.12.1+1/Contents/Home}" PATH="$HOME/.rubies/3.4.11/bin:$PATH" LANG=en_US.UTF-8
IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
URL="${EBOOKVOX_URL:-http://$IP:3230}"
[ -n "$IP" ] || [ -n "${EBOOKVOX_URL:-}" ] || { echo "No network address found — connect to Wi-Fi first."; exit 1; }
VER="$(grep -o 'versionName "[^"]*"' android/app/build.gradle | cut -d'"' -f2)"; BUILD="$(grep -o 'versionCode [0-9]*' android/app/build.gradle | cut -d' ' -f2)"
echo "Building Ebookvox $VER (build $BUILD) for $URL"
mkdir -p downloads
# --- Android
EBOOKVOX_URL="$URL" npx cap sync android >/dev/null
(cd android && ./gradlew clean assembleDebug -q)
cp android/app/build/outputs/apk/debug/app-debug.apk downloads/Ebookvox-Reader-android.apk
# --- iOS (simulator build talks to localhost; the device build to $URL)
EBOOKVOX_URL="http://localhost:3230" npx cap sync ios >/dev/null
(cd ios/App && xcodebuild -workspace App.xcworkspace -scheme App -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 16' -derivedDataPath /tmp/ev-ios-sim build -quiet >/dev/null)
rm -f downloads/Ebookvox-Reader-ios-simulator.zip; ditto -c -k --sequesterRsrc --keepParent /tmp/ev-ios-sim/Build/Products/Debug-iphonesimulator/App.app downloads/Ebookvox-Reader-ios-simulator.zip
EBOOKVOX_URL="$URL" npx cap sync ios >/dev/null
(cd ios/App && xcodebuild -workspace App.xcworkspace -scheme App -configuration Release -sdk iphoneos -derivedDataPath /tmp/ev-ios-dev CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY="" build -quiet >/dev/null)
rm -rf /tmp/ev-ipa && mkdir -p /tmp/ev-ipa/Payload && cp -R /tmp/ev-ios-dev/Build/Products/Release-iphoneos/App.app /tmp/ev-ipa/Payload/
rm -f downloads/Ebookvox-Reader-ios-unsigned.ipa; (cd /tmp/ev-ipa && zip -qry "$OLDPWD/downloads/Ebookvox-Reader-ios-unsigned.ipa" Payload)
rm -rf /tmp/ev-ipa /tmp/ev-ios-dev /tmp/ev-ios-sim
cat > downloads/VERSION.txt <<V
Ebookvox Reader mobile apps
Android: version $VER (build $BUILD)   <- Ebookvox-Reader-android.apk
iPhone:  version $VER (build $BUILD)   <- Ebookvox-Reader-ios-unsigned.ipa / -simulator.zip
Built:   $(date -u '+%Y-%m-%d %H:%M UTC')
Server:  $URL  (the Reader must be running there: bash scripts/start-all.sh — and the phone on the same network)
APK SHA-256: $(shasum -a 256 downloads/Ebookvox-Reader-android.apk | cut -d' ' -f1)

If the app can't reach the server it shows a "Connect to internet" page with the address it tried.
The same version/build is shown at the bottom of the app's Profile page.
Each build has a higher number than the last, so installing it over an older Ebookvox updates it.
V
rm -f downloads/.DS_Store
ls -la downloads
