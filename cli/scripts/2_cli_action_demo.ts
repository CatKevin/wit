
import { LitNodeClient } from "@lit-protocol/lit-node-client";
import { LIT_NETWORK, LIT_ABILITY } from "@lit-protocol/constants";
import { LitAccessControlConditionResource, LitActionResource, generateAuthSig, createSiweMessageWithResources } from "@lit-protocol/auth-helpers";
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
const CAPACITY_TOKEN_ID = "369618";

if (!PLATFORM_PRIVATE_KEY) {
    console.error("❌ LIT_PLATFORM_PRIVATE_KEY not found in .env");
    process.exit(1);
}

// Mantle Mainnet Contract
const MANTLE_CONTRACT = "0xbc89b2F377386A46c20E09E02d83A8479bFDc203";
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

    // --- 4. Encrypt ---
    const secretCode = "console.log('Hello Mantle Mainnet from Lit!');";
    console.log(`\n🔒 Encrypting: "${secretCode}"`);

    // Docs say for Custom Contract:
    // conditionType: 'evmContract' (Required if not basic 20/721/1155)
    // contractAddress: Address
    // functionName: Name of function
    // functionParams: Array of params
    // functionAbi: The ABI object for the function
    // chain: Chain string

    const unifiedAccessControlConditions = [
        {
            conditionType: 'evmContract',
            contractAddress: MANTLE_CONTRACT,
            functionName: 'hasAccess',
            functionParams: [REPO_ID, ':userAddress'],
            functionAbi: {
                name: "hasAccess",
                type: "function",
                stateMutability: "view",
                inputs: [
                    { name: "repoId", type: "uint256" },
                    { name: "user", type: "address" }
                ],
                outputs: [
                    { name: "", type: "bool" }
                ]
            },
            chain: 'mantle',
            returnValueTest: {
                key: '', // Empty key means check the return value itself
                comparator: '=',
                value: 'true'
            }
        }
    ];

    const { ciphertext, dataToEncryptHash } = await encryptString(
        {
            unifiedAccessControlConditions,
            dataToEncrypt: secretCode,
        },
        client
    );

    console.log(`📦 Ciphertext: ${ciphertext.substring(0, 20)}...`);
    console.log(`🔑 DataHash: ${dataToEncryptHash}`);

    // --- 5. Decrypt ---
    console.log("\n🔓 Decrypting (Direct Mantle Check)...");

    try {
        const decryptedString = await decryptToString(
            {
                unifiedAccessControlConditions,
                ciphertext,
                dataToEncryptHash,
                sessionSigs,
                chain: "mantle",
            },
            client
        );

        console.log(`🎉 Success! Content: "${decryptedString}"`);
    } catch (e: any) {
        console.error("❌ Decryption Failed!");
        console.error("Reason:", e.message || e);
    }

    client.disconnect();
}

main().catch((e) => console.error(e));
