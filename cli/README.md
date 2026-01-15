# wit CLI

Wit with Withub: A private, decentralized alternative to Git with GitHub.
Now supporting multi-chain architecture:
- **Mantle**: Powered by IPFS (Lighthouse) + Lit Protocol for privacy/encryption (Mainnet).
- **Sui**: Powered by Walrus decentralized storage (Testnet).

The CLI routes commands to the appropriate chain and storage backend based on your configuration.

## Requirements
- Node.js >= 18.
- **For Mantle**: A Lighthouse API Key (get one at [Lighthouse Storage](https://lighthouse.storage)).
- **For Sui**: Access to a Walrus relay (configured by default).

## Install & Run
- Global install: `npm install -g withub-cli` then `wit --help`.
- On-demand: `npx withub-cli --help` (no global install needed).
- Upgrade: `npm install -g withub-cli@latest`. Uninstall: `npm uninstall -g withub-cli`.

## Quickstart

### 1. Configure Environment (For Mantle)
For a smoother experience with Mantle/IPFS, set your Lighthouse API key in your shell:
```bash
export WIT_LIGHTHOUSE_API_KEY="your-api-key"
```

### 2. Choose Your Chain
Wit supports multiple chains. Select your active chain globally:
```bash
wit chain list       # List available chains (sui, mantle)
wit chain use mantle # Switch to Mantle Mainnet
wit chain current    # Show current active chain
```

### 3. Identity & Accounts
Manage your EVM (Mantle) or Sui identity:
```bash
# For Mantle
wit account generate       # Generate a new random EVM wallet
wit account import <key>   # Import an existing private key
wit account list           # List managed accounts
wit account use <address>  # Select active account
wit account balance        # Check MNT balance
```

### 4. Initialize & Version Control
Standard VC workflow works across chains:
```bash
mkdir my-repo && cd my-repo
wit init                   # Initialize repo on the active chain
wit status
wit add .
wit commit -m "First commit"
```

### 5. Remote Operations
Push and pull from decentralized storage.
- **Mantle**: Pushes to IPFS (via Lighthouse), encrypts content with a session key, and manages access via Lit Protocol.
- **Sui**: Pushes to Walrus.

```bash
wit push                   # Push to configured chain storage
wit fetch                  # Fetch updates
wit pull                   # Pull and checkout
wit clone <repo-id>        # Clone an existing repository
```

### 6. Privacy & Access Control (Mantle Only)
Manage collaborators for your private repository using Lit Protocol:
```bash
wit invite <address>       # Grant access to a collaborator
wit remove-user <address>  # Revoke access
```

## Storage & Implementation Details
- **Mantle**:
  - **Storage**: IPFS (CAR format).
  - **Privacy**: AES-256-GCM encryption. Session keys are encrypted via Lit Protocol and stored in IPFS metadata. Access control is enforced by a smart contract on Mantle Mainnet.
  - **Access Control**: Lit Protocol.
- **Sui**:
  - **Storage**: Walrus (Blob/Quilt).
  - **Privacy**: Seal.

## Developer Scripts
- `npm ci`: install dependencies.
- `npm run build`: compile to `dist/`.
- `npm start`: run locally.
- `npm run test:smoke`: minimal smoke test.
