
import { LitContracts } from "@lit-protocol/contracts-sdk";
import { LIT_NETWORK } from "@lit-protocol/constants";
// import { Wallet, JsonRpcProvider } from "ethers"; // Root is v6
// Force use of v5 from contracts-sdk dependencies
const ethersV5 = require('@lit-protocol/contracts-sdk/node_modules/ethers');
const { Wallet, providers } = ethersV5;
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env from cli root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PLATFORM_PRIVATE_KEY = process.env.LIT_PLATFORM_PRIVATE_KEY;

if (!PLATFORM_PRIVATE_KEY) {
    console.error("❌ LIT_PLATFORM_PRIVATE_KEY not found in .env");
    process.exit(1);
}

async function mintCapacityCredit() {
    console.log("🔄 Connecting to Chronicle Yellowstone (Chain ID: 175188)...");

    // 1. Initialize Ethers v5 Signer
    const provider = new providers.JsonRpcProvider("https://yellowstone-rpc.litprotocol.com");
    const wallet = new Wallet(PLATFORM_PRIVATE_KEY!, provider);

    // 2. Connect to Lit Contracts SDK (V7)
    const contractClient = new LitContracts({
        signer: wallet,
        network: 'datil-test' as any,
    });
    await contractClient.connect();

    console.log("🛠 Minting Capacity Credit NFT...");

    // 3. Mint NFT
    // requestsPerDay: 50 -> enough for testing
    const tx = await contractClient.mintCapacityCreditsNFT({
        requestsPerDay: 500,
        requestsPerSecond: 10,
        daysUntilUTCMidnightExpiration: 30,
    });

    const tokenId = tx.capacityTokenIdStr;

    console.log("---------------------------------------------");
    console.log(`✅ NFT Minted Successfully!`);
    console.log(`🔑 Capacity Token ID: ${tokenId}`);
    console.log("---------------------------------------------");
}

mintCapacityCredit().catch((e) => {
    console.error("❌ Mint Failed:", e);
    console.error(e.message);
});
