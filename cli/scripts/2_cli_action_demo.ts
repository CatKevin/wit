
import { LitNodeClient } from "@lit-protocol/lit-node-client";
import { LIT_NETWORK, LIT_ABILITY } from "@lit-protocol/constants";
import { LitAccessControlConditionResource, LitActionResource, generateAuthSig, createSiweMessageWithResources } from "@lit-protocol/auth-helpers";
// Removed non-existent import
import { encryptString, decryptToString } from "@lit-protocol/encryption";
import * as dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';

if (!globalThis.crypto) {
    globalThis.crypto = crypto.webcrypto as any;
}

// Force use of v5 from contracts-sdk dependencies
const ethersV5 = require('@lit-protocol/contracts-sdk/node_modules/ethers');
const { Wallet } = ethersV5;

import { loadEvmKey } from '../src/lib/evmKeys';

// Load .env from cli root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PLATFORM_PRIVATE_KEY = process.env.LIT_PLATFORM_PRIVATE_KEY;
const CAPACITY_TOKEN_ID = "369618"; // Hardcoded from mint script result

if (!PLATFORM_PRIVATE_KEY) {
    console.error("❌ LIT_PLATFORM_PRIVATE_KEY not found in .env");
    process.exit(1);
}

// ⚠️ Ensure this address has access in your Mantle contract
// For this demo, we assume the Lit Action just returns true or checks a permissive condition
// If specific user is needed, replace this.
// Use Qma... CID (V0) because Lit Nodes hash the content to V0/Identity when checking access.
// Passing baf... (V1) causes "Hash mismatch" error.
const LIT_ACTION_IPFS_CID = "Qma8FtFLwvYxBBfgUDy9z1ShCBJJvJqaxBbg9w9aKpEgVF";
const MANTLE_CONTRACT = "0xf5db3fb6c5C94348dB6Ab32236f16002514ff4F9";
const REPO_ID = "1";

async function main() {
    // Load User Wallet from WIT CLI config
    let userWallet;
    try {
        const keyInfo = await loadEvmKey();
        userWallet = new Wallet(keyInfo.privateKey);
        console.log(`👤 Current User Address: ${userWallet.address}`);
    } catch (e) {
        console.error("❌ Failed to load user key via 'wit account'. Please ensure you have generated a key.");
        throw e;
    }

    // --- 1. Init Lit Client V7 ---
    console.log("🔄 Connecting to Lit Network (Datil-Test)...");
    const client = new LitNodeClient({
        litNetwork: 'datil-test',
        debug: false
    });
    await client.connect();

    // --- 2. Platform Delegation (Serverless) ---
    console.log("🎫 Creating Capacity Delegation (Platform -> User)...");
    const platformWallet = new Wallet(PLATFORM_PRIVATE_KEY);

    const { capacityDelegationAuthSig } = await client.createCapacityDelegationAuthSig({
        dAppOwnerWallet: platformWallet,
        capacityTokenId: CAPACITY_TOKEN_ID,
        delegateeAddresses: [userWallet.address],
        uses: "1",
    });

    // --- 3. Get Session Signatures (User Side) ---
    console.log("✍️ Generating Session Signatures...");

    const resourceAbilities = [
        {
            resource: new LitAccessControlConditionResource('*'),
            ability: LIT_ABILITY.AccessControlConditionDecryption,
        },
        {
            resource: new LitActionResource('*'),
            ability: LIT_ABILITY.LitActionExecution,
        }
    ];

    const sessionSigs = await client.getSessionSigs({
        chain: "ethereum",
        expiration: new Date(Date.now() + 1000 * 60 * 10).toISOString(),
        capabilityAuthSigs: [capacityDelegationAuthSig],
        resourceAbilityRequests: resourceAbilities as any,
        authNeededCallback: async (params: any) => {
            console.log("DEBUG: resourceAbilityRequests:", JSON.stringify(params.resourceAbilityRequests, null, 2));
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

    // --- 4. Encrypt ---
    const secretCode = "console.log('Deploying to Mantle 5003...');";
    console.log(`\n🔒 Encrypting: "${secretCode}"`);

    const accessControlConditions = [
        {
            contractAddress: `ipfs://${LIT_ACTION_IPFS_CID}`,
            standardContractType: "LitAction",
            chain: "ethereum",
            method: "go",
            parameters: [
                REPO_ID,
                MANTLE_CONTRACT,
                userWallet.address // Using random wallet, adjust Lit Action logic if it checks strict allowlist
            ],
            returnValueTest: {
                comparator: "=",
                value: "true",
            },
        },
    ];

    const { ciphertext, dataToEncryptHash } = await encryptString(
        {
            accessControlConditions,
            dataToEncrypt: secretCode,
        },
        client
    );

    console.log(`📦 Ciphertext: ${ciphertext.substring(0, 20)}...`);
    console.log(`🔑 DataHash: ${dataToEncryptHash}`);

    // --- 5. Decrypt ---
    console.log("\n🔓 Decrypting (Verifying Mantle Contract)...");

    try {
        const decryptedString = await decryptToString(
            {
                accessControlConditions,
                ciphertext,
                dataToEncryptHash,
                sessionSigs,
                chain: "ethereum",
            },
            client
        );

        console.log(`🎉 Success! Content: "${decryptedString}"`);
    } catch (e: any) {
        console.error("❌ Decryption Failed!");
        console.error("Reason:", e.message || e);

        // Dump logs if available in error
        if (e.logs) {
            console.log("Lit Action Logs:", e.logs);
        }
    }

    client.disconnect();
}

main().catch((e) => console.error(e));
