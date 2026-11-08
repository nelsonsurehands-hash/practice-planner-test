#!/usr/bin/env bash
# Publish the current commit (or a branch) to the TEST copy of the app: test.theextracoach.com
# It runs in demo mode (data stays on the device) with a yellow TEST banner, so it can never
# touch real teams. Usage: tools/deploy-test.sh [git-ref]   (default: HEAD)
set -euo pipefail
REF="${1:-HEAD}"
SRC="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
git -C "$SRC" archive "$REF" | tar -x -C "$TMP"
echo "test.theextracoach.com" > "$TMP/CNAME"
echo 'window.APP_CONFIG={supabaseUrl:"",supabaseAnonKey:"",oauth:[],env:"test"};' > "$TMP/js/config.js"
python3 - "$TMP/manifest.webmanifest" <<'PY'
import json,sys
p=sys.argv[1];m=json.load(open(p));m["name"]="Extra Coach TEST";m["short_name"]="TEST";json.dump(m,open(p,"w"),indent=2)
PY
sed -i 's#<title>#<title>TEST · #' "$TMP/index.html"
cd "$TMP"
git init -q -b main
git -c user.name="Brian" -c user.email="cornelison.brian@gmail.com" add -A
git -c user.name="Brian" -c user.email="cornelison.brian@gmail.com" commit -qm "Test build of $(git -C "$SRC" rev-parse --short "$REF")"
git push -qf https://github.com/nelsonsurehands-hash/practice-planner-test main
echo "Published $(git -C "$SRC" rev-parse --short "$REF") to test.theextracoach.com"
