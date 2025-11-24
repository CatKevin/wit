# wit CLI

Wit with Withub: A private, decentralized alternative to Git with GitHub, powered by Walrus. This CLI (Node.js/TypeScript, Commander + Ink) talks directly to Walrus decentralized storage instead of centralized hosts, targeting a single-branch, verifiable repository model with Sui state integration.

## Requirements
- Node.js >= 18.
- Access to a Walrus relay (testnet by default); Sui RPC endpoints are configurable as the state layer evolves.

## Install & Run
- Global install: `npm install -g withub-cli` then `wit --help`.
- On-demand: `npx withub-cli --help` (no global install needed).
- Upgrade: `npm install -g withub-cli@latest`. Uninstall: `npm uninstall -g withub-cli`.

## Quickstart
- Initialize a repo scaffold in the current directory:
  ```bash
  wit init <repo-name>
  ```
  This creates `.wit/`, writes `config.json` with sensible defaults (Walrus testnet relay, author/key placeholders), and ensures `.gitignore` / `.witignore` include `.wit/` and key paths.
- Local VC workflow: `wit status`, `wit add`, `wit reset` / `wit restore --staged`, `wit restore <paths>`, `wit commit`, `wit log`, `wit diff`, `wit checkout`.
- Storage experiments: `wit push-blob` / `pull-blob`; `wit push-quilt` / `pull-quilt` / `quilt-cat` / `quilt-ls` / `quilt-cat-id`; `push-quilt-legacy` / `pull-quilt-legacy` as archive fallback.
- Colorized output can be toggled via `--color` / `--no-color` or env vars `NO_COLOR` / `WIT_NO_COLOR`.

## Developer Scripts
- `npm ci`: install dependencies deterministically.
- `npm run build`: compile to `dist/` (entry `dist/index.js` ships with shebang for npm shims).
- `npm start`: run the compiled CLI locally.
- `npm run test:smoke`: minimal smoke test.
- `prepublishOnly`: runs `npm run build && npm run test:smoke` to guard against unbuilt or untested publishes.

## Publish Checklist (manual)
1) `npm ci && npm run build`.
2) `npm run test:smoke`.
3) `npm pack` and inspect the tarball (should contain `dist/**`, `README.md`, `LICENSE`, `package.json`; `bin` points to `dist/index.js`).
4) `npm publish` (scope is already `access: public`; for prerelease use `npm publish --tag next`).
5) Verify: `npm info withub-cli version`, `npx withub-cli --version`, optionally `npm install -g withub-cli && wit --help` for global smoke.

## Current Scope
- Local VC core: `init`, `status`, `add`, `reset`, `restore`, `commit`, `log`, `diff`, `checkout`.
- Walrus storage flows: quilt/blob push/pull commands plus legacy archive fallback.
- Remote/contract/Web flows are under active development; CLI surfaces will expand alongside Sui state and privacy (Seal) integration.
