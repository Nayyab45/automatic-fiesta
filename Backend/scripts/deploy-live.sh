#!/usr/bin/env bash
# One-command deploy of the backend to the LIVE server (weeat@ns3.netstech.net,
# ~/github, pm2 process "weeat" -- the one https://weeat.netstech.net serves).
# NOT the git `origin` remote, which is a separate copy that never goes live.
#
#   cd Backend && bash scripts/deploy-live.sh            # compare, ask, deploy
#   bash scripts/deploy-live.sh --dry-run                 # only show what would change
#   bash scripts/deploy-live.sh --yes                     # skip the confirmation
#
# Compares file contents (ignoring CRLF/LF differences) against the server,
# takes a backup tarball there, uploads only what changed, runs `npm install`
# when package files changed (using the same Node pm2 runs the app with),
# restarts pm2 and checks the API answers. Secrets (.env, the Firebase key)
# are never touched by this script.
set -euo pipefail

HOST="weeat@ns3.netstech.net"
PORT=2290
REMOTE_DIR="~/github"
SSH=(ssh -o BatchMode=yes -p "$PORT" "$HOST")

DRY_RUN=0
ASSUME_YES=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --yes) ASSUME_YES=1 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

if [ ! -f package.json ] || [ ! -d src ]; then
  echo "Run this from the Backend folder." >&2
  exit 2
fi

list_files() { find src package.json package-lock.json -type f -not -path 'src/assets/*' | sort; }

hash_local() {
  list_files | while IFS= read -r f; do printf '%s %s\n' "$(tr -d '\r' < "$f" | md5sum | cut -d' ' -f1)" "$f"; done
}

hash_remote() {
  "${SSH[@]}" "cd $REMOTE_DIR && find src package.json package-lock.json -type f -not -path 'src/assets/*' | sort | while IFS= read -r f; do printf '%s %s\n' \"\$(tr -d '\r' < \"\$f\" | md5sum | cut -d' ' -f1)\" \"\$f\"; done"
}

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
hash_local | awk '{print $2" "$1}' | sort > "$TMP/local"
hash_remote | awk '{print $2" "$1}' | sort > "$TMP/remote"

{ join "$TMP/local" "$TMP/remote" | awk '$2!=$3{print $1}'; join -v1 "$TMP/local" "$TMP/remote" | awk '{print $1}'; } | sort > "$TMP/changed"
join -v2 "$TMP/local" "$TMP/remote" | awk '{print $1}' > "$TMP/remote_only"

if [ ! -s "$TMP/changed" ]; then
  echo "Live server already matches this code. Nothing to deploy."
  exit 0
fi

echo "Files to upload ($(wc -l < "$TMP/changed")):"
sed 's/^/  /' "$TMP/changed"
if [ -s "$TMP/remote_only" ]; then
  echo "On the server but not here (left alone):"
  sed 's/^/  /' "$TMP/remote_only"
fi

if [ "$DRY_RUN" = 1 ]; then
  echo "(dry run -- nothing changed)"
  exit 0
fi

if [ "$ASSUME_YES" != 1 ]; then
  read -r -p "Deploy to PRODUCTION now? [y/N] " answer
  [ "$answer" = "y" ] || [ "$answer" = "Y" ] || { echo "Cancelled."; exit 1; }
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="~/backup-deploy-$STAMP.tgz"
echo "Backing up the current server code to $BACKUP ..."
"${SSH[@]}" "cd $REMOTE_DIR && tar czf $BACKUP --exclude='src/assets' src package.json package-lock.json"

echo "Uploading ..."
tar czf - -T "$TMP/changed" | "${SSH[@]}" "cd $REMOTE_DIR && tar xzf -"

if grep -qE '^package(-lock)?\.json$' "$TMP/changed"; then
  echo "Package files changed -- installing dependencies ..."
  "${SSH[@]}" "cd $REMOTE_DIR && INTERP=\$(pm2 jlist | node -e 'let s=\"\";process.stdin.on(\"data\",d=>s+=d).on(\"end\",()=>console.log(JSON.parse(s).find(p=>p.name===\"weeat\").pm2_env.exec_interpreter))') && export PATH=\"\$(dirname \"\$INTERP\"):\$PATH\" && npm install --omit=dev --no-audit --no-fund"
fi

echo "Restarting ..."
"${SSH[@]}" "pm2 restart weeat > /dev/null && sleep 6 && pm2 list | grep weeat"

STATUS="$(curl -s -m 20 -o /dev/null -w '%{http_code}' https://weeat.netstech.net/api/restaurants || true)"
if [ "$STATUS" = "200" ]; then
  echo "Deployed. API answers 200."
  echo "Rollback if needed: ssh -p $PORT $HOST 'cd $REMOTE_DIR && tar xzf $BACKUP && pm2 restart weeat'"
else
  echo "WARNING: API answered '$STATUS' after the restart. Check: ssh -p $PORT $HOST 'pm2 logs weeat --lines 40 --nostream'" >&2
  echo "Rollback: ssh -p $PORT $HOST 'cd $REMOTE_DIR && tar xzf $BACKUP && pm2 restart weeat'" >&2
  exit 1
fi
