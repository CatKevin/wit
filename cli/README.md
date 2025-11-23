# wit CLI

Scaffold for the `wit` Node.js/TypeScript CLI (Commander + Ink).

## Scripts
- `npm install` (once) to pull deps.
- `npm run build` to compile to `dist/`.
- `node dist/index.js --help` to view the stubbed commands.

## Usage (dev)
- Initialize a repo scaffold in the current directory:
  ```bash
  node dist/index.js init <repo-name>
  ```
  This creates `.wit/` layout, writes `config.json` with defaults (network testnet, Walrus relay testnet, author/key_alias placeholders), and ensures `.gitignore`/`.witignore` contain `.wit/` and key paths.
- `status`, `add`, `reset`/`restore --staged`, `restore <paths>`, `checkout`, `commit`, `log`, and `diff` work: index read/write, hashing, ignore patterns, recursive add, add-all, staged deletions, unstage paths, worktree restore from index, checkout commit snapshots (update HEAD/index/worktree), canonical commit serialization + hashing, head ref updates, commit history traversal, and unified diff for worktree vs index / index vs HEAD (text vs binary flag). Output is colorized for readability and can be toggled via `--color`/`--no-color` or `WIT_NO_COLOR`/`NO_COLOR`.
- Remaining commands are stubbed placeholders until their Stage 1 tasks are implemented.

## Current status
- Stage 1: CLI command skeleton is wired; `init`, `status`, `add`, `reset`/`restore`, `commit`, `log`, `diff`, `checkout`, `push-blob`/`pull-blob`, `push-quilt`/`pull-quilt`, `quilt-cat`, `quilt-ls`/`quilt-cat-id` have working logic.
- Quilt: `push-quilt` uses Walrus `writeQuilt` + `writeFiles` to upload, emitting a local manifest (quilt_id, file ids/meta, root_hash); `pull-quilt` downloads via manifest + `getFiles` and verifies hashes. `quilt-cat` pulls a single file by identifier using manifest; `quilt-ls` / `quilt-cat-id` use quilt_id directly. `push-quilt-legacy`/`pull-quilt-legacy` provide a single-blob archive fallback.
- Blob: `push-blob`/`pull-blob` upload/download and verify hash.
- Colors: `--color`/`--no-color` and `NO_COLOR`/`WIT_NO_COLOR` env vars.
- More remote/contract/Web features land in later stages.
