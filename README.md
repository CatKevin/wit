# WIT + Withub: Fully Encrypted, Decentralized Code Repository

**Your code, truly private. No corporation, no government, no AI can access it.**

```bash
npm install -g withub-cli
```

## Why Now? The Perfect Storm of Failures

**Cloudflare's recent outage took down half the internet** - including GitHub, GitLab, and millions of repositories. Developers worldwide couldn't access their own code.

**GitHub is training AI on your private code** - Your proprietary algorithms are becoming training data for commercial AI models, without your consent.

**One account ban = permanent code loss** - False positives, sanctions, credit card issues - any reason can lock you out of your private repositories forever.

**Local storage is a ticking time bomb** - Hardware failures, ransomware, theft - one incident and years of work vanish.

## The Solution: Complete End-to-End Encryption + Decentralization

**WIT** (CLI) and **Withub** (Web) solve this with:
- **Seal**: Decentralized key management - only YOU control access
- **Walrus**: Distributed storage across 100+ nodes - no single point of failure
- **Sui**: Blockchain state management - permanent, uncensorable

## Core Security Features

### 🔐 True End-to-End Encryption
```bash
# Your code is encrypted BEFORE leaving your machine
wit init my-project --private
wit add secret-algorithm.py
wit commit -m "Proprietary code"
wit push  # Encrypted with AES-256-GCM, sealed with your keys
```
- Code encrypted locally before any network transmission
- Even Walrus storage nodes see only encrypted blobs
- Mathematically impossible for anyone else to decrypt

### 🌍 Unstoppable Distributed Storage
- Your code split across 100+ global nodes via erasure coding
- Survives even if 1/3 of all nodes fail simultaneously
- No single country or corporation can shut it down
- Works even when GitHub/Cloudflare are completely offline

### 🔑 Your Keys, Your Control
- No accounts to ban, no platforms to trust
- Lose GitHub access? Your WIT repositories remain accessible
- Automatic key rotation when removing collaborators
- Zero-knowledge architecture - we CAN'T read your code even if forced

## Quick Start

```bash
# Install
npm install -g withub-cli

# Generate your sovereign identity
wit account generate

# Create fully encrypted repository
wit init quantum-trading-bot --private
wit add .
wit commit -m "Initial commit"
wit push  # Now permanently encrypted and distributed
```

## Real Protection Against Real Threats

| Threat | GitHub/Local Git | WIT + Withub |
|--------|------------------|--------------|
| **AI Training** | Your code trains competitor's AI | Encrypted - useless for training |
| **Account Ban** | Lose all private repos | Keys ensure perpetual access |
| **Platform Outage** | Can't access code | Works via any Walrus node |
| **Government Seizure** | Code confiscated | Distributed across 100+ jurisdictions |
| **Hardware Failure** | Total data loss | Automatic distributed backup |
| **Corporate Espionage** | Employees can read private repos | Zero-knowledge encryption |

## Architecture

### Three Layers of Protection

1. **Encryption Layer (Seal)**
   - Client-side AES-256-GCM encryption
   - Threshold secret sharing
   - Decentralized key management

2. **Storage Layer (Walrus)**
   - Byzantine fault tolerant
   - Content-addressed with cryptographic proofs
   - Geographic distribution across 100+ nodes

3. **State Layer (Sui Blockchain)**
   - Immutable repository metadata
   - Cryptographic access control
   - Permanent audit trail

## Git Compatible Commands

```bash
wit init project          # Initialize repository
wit add .                 # Stage files
wit commit -m "msg"       # Commit changes
wit push                  # Push to Walrus + Sui
wit clone 0xabc...        # Clone repository
wit pull                  # Pull updates
wit invite alice@sui      # Add collaborator
```

## Withub Web Interface

Browse repositories without any backend:
- Monaco editor with syntax highlighting
- Commit history and diffs
- Client-side decryption for private repos
- Direct blockchain queries
- Zero telemetry or tracking

## Current Status

### ✅ Working Now
- Complete Git basics (init, add, commit, push, pull, clone)
- Full E2E encryption for private repositories
- Team collaboration with cryptographic access control
- Web explorer with code viewing and diffs
- Binary file support

### 🚧 Coming Soon
- Branching and merging
- Pull request workflow
- CI/CD hooks
- IPFS gateway

## Performance

- **Encryption overhead**: <5% (hardware accelerated AES)
- **Push time**: ~3 seconds for 100 files
- **Clone time**: ~2 seconds
- **Storage cost**: ~$0.001/MB (one-time payment)

## Technology Stack

**Encryption**: AES-256-GCM, Ed25519, Seal protocol
**Storage**: Walrus Network (100+ nodes globally)
**Blockchain**: Sui (400ms finality, 100k TPS)
**CLI**: TypeScript, Node.js, Commander
**Web**: React 19, Vite, Monaco Editor

## Installation

```bash
# CLI
npm install -g withub-cli

# Web (self-host)
git clone https://github.com/CatKevin/wit
cd web && npm install && npm run dev
```

---

**Stop trusting corporations with your intellectual property. Start owning your code.**

Repository: [https://github.com/CatKevin/wit](https://github.com/CatKevin/wit)