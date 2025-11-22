#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$ROOT/dist/index.js"

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT
cd "$tmpdir"

export NO_COLOR=1

echo "[smoke] init"
node "$BIN" init sample

echo "[smoke] add/commit c1"
printf 'hello\n' > a.txt
node "$BIN" add
node "$BIN" commit -m "c1"

echo "[smoke] modify/diff/commit c2"
printf 'hello v2\n' > a.txt
node "$BIN" add
node "$BIN" diff --cached
node "$BIN" commit -m "c2"

echo "[smoke] checkout c1 and verify"
first_id="$(ls .wit/objects/commits | head -n1 | sed 's/.json$//')"
node "$BIN" checkout "$first_id"
grep -q "hello" a.txt

echo "[smoke] restore worktree change"
printf 'bad\n' > a.txt
node "$BIN" restore a.txt
grep -q "hello" a.txt

echo "[smoke] reset staged"
printf 'tmp\n' > tmp.txt
node "$BIN" add tmp.txt
node "$BIN" reset tmp.txt

echo "[smoke] log"
node "$BIN" log

echo "[smoke] completed"
