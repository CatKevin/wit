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
- `status`, `add`, `reset`/`restore --staged`, `commit`, `log`, and `diff` work: index read/write, hashing, ignore patterns, recursive add, add-all, staged deletions, unstage paths, canonical commit serialization + hashing, head ref updates, commit history traversal, and diff for worktree vs index / index vs HEAD (text vs binary flag).
- Remaining commands are stubbed placeholders until their Stage 1 tasks are implemented.

## Current status
- Stage 1: CLI command skeleton is wired; `init`, `status`, and `add` have working logic (index read/write, workspace scan, hashing).
- Commands stubbed: `commit`, `push`, `clone`, `diff`, `log`, `fetch`, `invite`, `push-blob`.
- Behavior: remaining commands render placeholders; business logic will be added in subsequent stage 1 tasks (commit engine, state tracking, etc.).
