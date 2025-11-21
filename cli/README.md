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
- Other commands are stubbed placeholders until their Stage 1 tasks are implemented.

## Current status
- Stage 1: CLI command skeleton is wired with Commander; output is rendered through Ink placeholders.
- Commands stubbed: `status`, `add`, `commit`, `push`, `clone`, `diff`, `log`, `fetch`, `invite`, `push-blob`.
- Behavior: each command renders a placeholder; business logic will be added in subsequent stage 1 tasks (index/commit engine, config IO, etc.).
