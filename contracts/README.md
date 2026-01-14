# wit Contracts

## EVM Contracts (Solidity)

Directory: `solidity/`
Framework: Hardhat

### Deployed Addresses

**Mantle Sepolia Testnet (Chain ID 5003)**
- **WitPolyRepo (UUPS Proxy)**: `0xbc89b2F377386A46c20E09E02d83A8479bFDc203`
- **Implementation**: `0x5D8D666dAbf73d705BD59A02227c57d2362a11e7`
- **Verified**: Yes (Sourcify/MantleScan)
- Explorer: https://sepolia.mantlescan.xyz/address/0x5d8d666dabf73d705bd59a02227c57d2362a11e7#code

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


