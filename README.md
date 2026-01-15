# WIT + Withub: Fully Encrypted, Decentralized Code Repository

**Your code, truly private. No corporation, no government, no AI can access it.**

**Online Demo**: [https://catkevin.github.io/wit-app/](https://catkevin.github.io/wit-app/)

WIT provides **Fully Encrypted Storage** by leveraging **Lit Protocol** for decentralized access control, **IPFS** for resilient, distributed storage, and **Mantle** for immutable state management.

## Why Now? The Risks of Centralization

**The fragility of the cloud is real.** The recent **Cloudflare outage** caused a global collapse of cloud services, proving that centralized storage is a massive risk. When the cloud goes down, you lose access to your work.

**Your privacy is not guaranteed.** GitHub and other platforms may use your private code to **train commercial AI models** without your explicit consent. No one knows if your proprietary algorithms are being leaked or used against you.

**You don't own your account.** If your account is lost, banned, or suspended for any reason, your **private code could be lost forever**. You are one policy change away from losing everything.

**Local storage is not enough.** Relying on a local machine exposes you to hardware damage, theft, or corruption. You need a backup that is as resilient as the blockchain.

## The Solution: Complete End-to-End Encryption + Decentralization

**WIT** (CLI) and **Withub** (Web) solve this with:
- **Lit Protocol**: Decentralized key management & access control - only YOU control access
- **IPFS**: Distributed content-addressed storage - no single point of failure
- **Mantle**: High-performance L2 blockchain for state management & permissions

### Real Protection Against Real Threats

| Threat | GitHub/Local Git | WIT + Withub |
|--------|------------------|--------------|
| **AI Training** | Your code trains competitor's AI | Encrypted - useless for training |
| **Account Ban** | Lose all private repos | Keys ensure perpetual access |
| **Platform Outage** | Can't access code | Works via generic IPFS gateways |
| **Government Seizure** | Code confiscated | Distributed across global IPFS nodes |
| **Corporate Espionage** | Employees can read private repos | Zero-knowledge encryption |

## Core Security Features

### 🔐 True End-to-End Encryption
Your code is encrypted **locally** (AES-256-GCM) before it ever leaves your machine. Storage nodes see only ciphertext. It is mathematically impossible for anyone without access rights to decrypt your data.

### 🌍 Resilient Distributed Storage
Files are stored on **IPFS** (InterPlanetary File System) via decentralized pinning services (Lighthouse). Your repository survives outages, censorship, and data center failures.

### 🔑 Dynamic Access Control
Access is managed via **Smart Contracts** and **Lit Protocol**.
- **No shared passwords**: Session keys are encrypted specifically for authorized wallet addresses.
- **Instant Revocation**: Remove a collaborator on-chain, and they immediately lose access to future updates.

### 📜 Smart Contract Deployment
**Status**: Deployed on Mantle Mainnet (Beta/Test State)
**Address**: [`0xbc89b2F377386A46c20E09E02d83A8479bFDc203`](https://mantlescan.xyz/address/0xbc89b2F377386A46c20E09E02d83A8479bFDc203)

> **⚠️ Note**: While deployed on Mainnet, this contract is currently in a **testing phase**. Use with caution and do not store high-value production secrets yet.

## Getting Started

### Installation
```bash
npm install -g withub-cli
```

### Quick Start
```bash
# 1. Generate your sovereign identity
wit account generate

# 2. Initialize a private repository
wit init my-project --private

# 3. Add and commit files
wit add .
wit commit -m "Initial secret commit"

# 4. Push to IPFS + Mantle (Encrypted)
wit push
```

### Common Commands
```bash
wit clone mantle:0xabc... # Clone from Mantle (Hex ID)
wit pull                  # Pull updates
wit invite 0xabc...      # Add collaborator (updates contract)
wit status                # Check repo status
```

## Withub Web Interface

Browse repositories without any backend. The web interface performs client-side decryption using your wallet signature.

- **URL**: [https://catkevin.github.io/wit-app/](https://catkevin.github.io/wit-app/)
- **Features**: Monaco editor, commit history, diff view, zero telemetry.

**Self-Host**:
```bash
git clone https://github.com/CatKevin/wit
cd web && npm install && npm run dev
```

---

## Technical Verification: Privacy & Encryption

> **Goal**: Verify privacy features using Lit Protocol (Hybrid Envelope Encryption).

### Core Architecture

1.  **Data Layer**: File content is encrypted with a random `session_key` (AES-256-GCM).
2.  **Access Layer**: The `session_key` is encrypted by **Lit Protocol**, bound to the Mantle contract's `hasAccess()` function.
3.  **Decryption**: Only wallets that satisfy `hasAccess()` can request Lit nodes to decrypt the `session_key`.

### Testing Guide

#### Prerequisites
- **Accounts**: OWNER (Creator), COLLAB (Invited), ALIEN (Unauthorized).
- **Network**: Mantle Mainnet.

#### Test Cases

**1. Create Private Repo**
```bash
wit init demo-repo --private
# Verify: .wit/config.json contains correct chain/privacy settings
```

**2. Push & Encrypt**
```bash
echo "Secret" > secret.txt
wit add . && wit commit -m "test" && wit push
# Verify: Output shows "Encrypting files...", IPFS stores ciphertext
```

**3. Invite Collaborator**
```bash
wit invite <COLLAB_ADDRESS>
# Verify: Transaction confirmed on Mantle
```

**4. Decrypt (Collaborator)**
```bash
wit account use <COLLAB_ADDRESS>
wit clone mantle:<REPO_ID> collab-repo
# Verify: "Fetching session keys...", content is "Secret"
```

**5. Unauthorized Access (Alien)**
```bash
wit account use <ALIEN_ADDRESS>
wit clone mantle:<REPO_ID> alien-repo
# Verify: Decryption FAILS (Lit Access Control denied)
```