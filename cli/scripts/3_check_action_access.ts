
import { LitNodeClient } from "@lit-protocol/lit-node-client";
import { LIT_NETWORK, LIT_ABILITY } from "@lit-protocol/constants";
import { LitAccessControlConditionResource, LitActionResource, generateAuthSig, createSiweMessageWithResources } from "@lit-protocol/auth-helpers";
import { loadEvmKey } from '../src/lib/evmKeys';
import * as dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';

if (!globalThis.crypto) {
    globalThis.crypto = crypto.webcrypto as any;
}

// Force use of v5 from contracts-sdk dependencies
const ethersV5 = require('@lit-protocol/contracts-sdk/node_modules/ethers');
const { Wallet } = ethersV5;

// Load .env from cli root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PLATFORM_PRIVATE_KEY = process.env.LIT_PLATFORM_PRIVATE_KEY;
const CAPACITY_TOKEN_ID = "369618";

if (!PLATFORM_PRIVATE_KEY) {
    console.error("❌ LIT_PLATFORM_PRIVATE_KEY not found in .env");
    process.exit(1);
}

const LIT_ACTION_IPFS_CID = "Qma8FtFLwvYxBBfgUDy9z1ShCBJJvJqaxBbg9w9aKpEgVF";
const MANTLE_CONTRACT = "0xf5db3fb6c5C94348dB6Ab32236f16002514ff4F9";
const REPO_ID = "1";

async function main() {
    // --- 1. Load User ---
    let userWallet;
    try {
        const keyInfo = await loadEvmKey();
        userWallet = new Wallet(keyInfo.privateKey);
        console.log(`👤 Current User Address: ${userWallet.address}`);
    } catch (e) {
        throw e;
    }

    // --- 2. Init Lit ---
    console.log("🔄 Connecting to Lit Network (Datil-Test)...");
    const client = new LitNodeClient({
        litNetwork: 'datil-test',
        debug: false
    });
    await client.connect();

    // --- 3. Delegation ---
    console.log("🎫 Creating Delegation...");
    const platformWallet = new Wallet(PLATFORM_PRIVATE_KEY);
    const { capacityDelegationAuthSig } = await client.createCapacityDelegationAuthSig({
        dAppOwnerWallet: platformWallet,
        capacityTokenId: CAPACITY_TOKEN_ID,
        delegateeAddresses: [userWallet.address],
        uses: "1",
    });

    // --- 4. Session Sigs ---
    console.log("✍️ Generating Session Signatures...");
    const resourceAbilities = [
        {
            resource: new LitActionResource('*'),
            ability: LIT_ABILITY.LitActionExecution,
        },
        // We add these just to be consistent, though we only execute
        {
            resource: new LitAccessControlConditionResource('*'),
            ability: LIT_ABILITY.AccessControlConditionDecryption,
        }
    ];

    const sessionSigs = await client.getSessionSigs({
        chain: "ethereum",
        expiration: new Date(Date.now() + 1000 * 60 * 10).toISOString(),
        capabilityAuthSigs: [capacityDelegationAuthSig],
        resourceAbilityRequests: resourceAbilities as any,
        authNeededCallback: async (params: any) => {
            const toSign = await createSiweMessageWithResources({
                uri: params.uri,
                expiration: params.expiration,
                resources: params.resourceAbilityRequests,
                walletAddress: userWallet.address,
                nonce: await client.getLatestBlockhash(),
            });
            return await generateAuthSig({
                signer: userWallet,
                toSign,
            });
        },
    });

    // --- 5. Execute JS Directly ---
    console.log(`\n🚀 Executing Lit Action (CID: ${LIT_ACTION_IPFS_CID})...`);
    console.log(`Checking access for Repo: ${REPO_ID} User: ${userWallet.address}`);

    // Mock the accessControlConditions array that the Action logic expects
    const accessControlConditions = [
        {
            standardContractType: "LitAction",
            parameters: [REPO_ID, MANTLE_CONTRACT, userWallet.address]
        }
    ];

    try {
        const res = await client.executeJs({
            ipfsId: LIT_ACTION_IPFS_CID,
            sessionSigs,
            jsParams: {
                accessControlConditions, // Inject params
            }
        });

        console.log("------------------------------------------------");
        console.log("✅ Execute Result:", res);
        console.log("Response:", res.response);
        console.log("Logs:", res.logs);
        console.log("------------------------------------------------");

        if (res.response === "true") {
            console.log("🎉 Access GRANTED by Mantle Contract!");
        } else {
            console.log("⛔ Access DENIED by Mantle Contract.");
            console.log("Please check if the user is a collaborator on Repo " + REPO_ID);
        }

    } catch (e: any) {
        console.error("❌ Execution Failed:", e);
        if (e.message.includes("NodeInvalidAuthSig")) {
            console.error("Diagnosis: The Session Signature itself is invalid for the Node.");
        }
    }

    client.disconnect();
}

main().catch(console.error);
