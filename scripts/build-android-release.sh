#!/usr/bin/env bash
# Builds the signed Android App Bundle (.aab) that Google Play requires.
#   bash scripts/build-android-release.sh
# First run: creates your UPLOAD KEY in ~/ebookvox-signing/ (you choose the password). KEEP THAT FOLDER AND PASSWORD SAFE: back it up outside this Mac.
# The key is never added to git. Output: downloads/Ebookvox-Reader-release.aab
set -euo pipefail
cd "$(dirname "$0")/.."
export JAVA_HOME="${JAVA_HOME:-$HOME/jdks/jdk-21.0.12.1+1/Contents/Home}" LANG=en_US.UTF-8
KDIR="$HOME/ebookvox-signing"; KS="$KDIR/ebookvox-upload.jks"; ALIAS="ebookvox"
mkdir -p "$KDIR"; chmod 700 "$KDIR"
if [ ! -f "$KS" ]; then
  echo "Creating your Ebookvox upload key (once). Choose a strong password and WRITE IT DOWN."
  read -r -s -p "New key password (min 8 characters): " PW; echo
  read -r -s -p "Repeat it: " PW2; echo
  [ "$PW" = "$PW2" ] && [ ${#PW} -ge 8 ] || { echo "Passwords differ or are shorter than 8 characters."; exit 1; }
  keytool -genkeypair -v -keystore "$KS" -alias "$ALIAS" -keyalg RSA -keysize 2048 -validity 10000 -storepass "$PW" -keypass "$PW" -dname "CN=Ebookvox, OU=Mobile, O=Ebookvox, C=NG" >/dev/null
  printf 'storeFile=%s\nstorePassword=%s\nkeyAlias=%s\nkeyPassword=%s\n' "$KS" "$PW" "$ALIAS" "$PW" > android/keystore.properties
  chmod 600 android/keystore.properties "$KS"
  echo "Key created at $KS. BACK THIS FILE UP and keep the password."
elif [ ! -f android/keystore.properties ]; then
  read -r -s -p "Password of $KS: " PW; echo
  printf 'storeFile=%s\nstorePassword=%s\nkeyAlias=%s\nkeyPassword=%s\n' "$KS" "$PW" "$ALIAS" "$PW" > android/keystore.properties; chmod 600 android/keystore.properties
fi
URL="${EBOOKVOX_URL:-https://app.ebookvox.com}"
[ -z "${ADMOB_ANDROID_APP_ID:-}" ] && ADMOB_ANDROID_APP_ID="$(grep -E '^ADMOB_ANDROID_APP_ID=' .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"')" || true
export ADMOB_ANDROID_APP_ID
VC="$(grep -o 'versionCode [0-9]*' android/app/build.gradle | cut -d' ' -f2)"; VN="$(grep -o 'versionName "[^"]*"' android/app/build.gradle | cut -d'"' -f2)"
echo "Building Ebookvox $VN (build $VC) for $URL"
EBOOKVOX_URL="$URL" npx cap sync android >/dev/null
(cd android && ./gradlew clean bundleRelease -q)
mkdir -p downloads
cp android/app/build/outputs/bundle/release/app-release.aab downloads/Ebookvox-Reader-release.aab
echo; keytool -printcert -jarfile downloads/Ebookvox-Reader-release.aab 2>/dev/null | grep -E "Owner|SHA256" | head -2 || true
ls -la downloads/Ebookvox-Reader-release.aab
echo "Upload this file in Play Console: Release > Create new release."
