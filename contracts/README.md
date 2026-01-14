# wit Contracts

## EVM Contracts (Solidity)

Directory: `solidity/`
Framework: Hardhat

### Deployed Addresses

**Mantle Sepolia Testnet (Chain ID 5003)**
- **WitPolyRepo (Mantle Sepolia)**: `0xf5db3fb6c5C94348dB6Ab32236f16002514ff4F9`
- **Verified**: Yes (Sourcify/MantleScan)
- **Verified**: Yes (Sourcify/MantleScan)
- Explorer: https://sepolia.mantlescan.xyz/address/0xf5db3fb6c5C94348dB6Ab32236f16002514ff4F9#code

### Commands

```bash
cd solidity
npm install
npx hardhat test      # Run tests
npx hardhat compile   # Compile contracts
npx hardhat run scripts/deploy.ts --network mantleSepolia # Deploy
```

## Sui Move package(s)

Sui Move package(s) and supporting scripts for repository state (`update_head`, ACL), Seal policy helpers, and deployment configs per network.

Structure:
- `move/` : Sui Move packages (repository state, ACL).
- `solidity/` : EVM Smart Contracts (Mantle Testnet).


