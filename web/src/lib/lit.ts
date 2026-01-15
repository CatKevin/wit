import { LitNodeClient } from '@lit-protocol/lit-node-client';
import { LitAccessControlConditionResource, createSiweMessage } from '@lit-protocol/auth-helpers';
import { LIT_ABILITY } from '@lit-protocol/constants';
import { Wallet, type Signer } from 'ethers';

// Use 'datil-test' to match CLI
export const LIT_NETWORK = 'datil-test';

// Payer Private Key for Capacity Delegation (Testing Only)
const LIT_PAYER_PRIVATE_KEY = import.meta.env.VITE_LIT_PAYER_PRIVATE_KEY;

export class BrowserLitService {
    private litNodeClient: LitNodeClient;
    private connected = false;

    constructor() {
        this.litNodeClient = new LitNodeClient({
            litNetwork: LIT_NETWORK,
            debug: true,
            checkNodeAttestation: false,
        });
    }

    async connect() {
        if (this.connected) return;
        try {
            await this.litNodeClient.connect();
            this.connected = true;
        } catch (err) {
            console.error('[BrowserLitService] Failed to connect to Lit nodes:', err);
            throw err;
        }
    }

    /**
     * Generates Session Signatures using Capacity Delegation.
     * This allows the user to perform Lit actions without holding a Capacity Credit NFT themselves.
     * The app (Payer) delegates capacity to the user for this session.
     */
    async getSessionSigs(signer: Signer, chain: string = 'ethereum'): Promise<any> {
        await this.connect();

        if (!LIT_PAYER_PRIVATE_KEY) {
            throw new Error('Missing VITE_LIT_PAYER_PRIVATE_KEY in .env');
        }

        const address = await signer.getAddress();
        console.log('[BrowserLitService] Generating Session Sigs for:', address);

        // 1. Initialize Payer Wallet
        const payerWallet = new Wallet(LIT_PAYER_PRIVATE_KEY);

        // 2. Create Capacity Delegation AuthSig
        // Delegate usage to the current user (browser wallet)
        const { capacityDelegationAuthSig } = await this.litNodeClient.createCapacityDelegationAuthSig({
            dAppOwnerWallet: payerWallet,
            capacityTokenId: '369618', // Hardcoded from CLI/User info (Datil-Test)
            delegateeAddresses: [address],
            uses: '1',
        });
        console.log('[BrowserLitService] Capacity Delegation created');

        // 3. Define Resources (Decryption)
        const resourceAbilities = [
            {
                resource: new LitAccessControlConditionResource('*'),
                ability: LIT_ABILITY.AccessControlConditionDecryption,
            }
        ];

        // 4. Get Session Sigs (Triggers Wallet Signature)
        const sessionSigs = await this.litNodeClient.getSessionSigs({
            chain,
            expiration: new Date(Date.now() + 1000 * 60 * 10).toISOString(), // 10 mins
            capabilityAuthSigs: [capacityDelegationAuthSig],
            resourceAbilityRequests: resourceAbilities,
            authNeededCallback: async (params: any) => {
                console.log('[BrowserLitService] authNeededCallback triggered', params);
                const toSign = await createSiweMessage({
                    uri: params.uri,
                    expiration: params.expiration,
                    resources: params.resourceAbilityRequests,
                    walletAddress: address,
                    nonce: await this.litNodeClient.getLatestBlockhash(),
                    litNodeClient: this.litNodeClient,
                });

                const signature = await signer.signMessage(toSign);

                return {
                    sig: signature,
                    derivedVia: 'web3.eth.personal.sign',
                    signedMessage: toSign,
                    address: address,
                };
            },
        });

        console.log('[BrowserLitService] Session Sigs generated');
        return sessionSigs;
    }

    /**
     * Decrypts the session key using Lit Protocol (v7 with Session Sigs).
     */
    async decryptSessionKey(
        ciphertext: string,
        dataToEncryptHash: string,
        unifiedAccessControlConditions: any[],
        sessionSigs: any // Changed from authSig to sessionSigs
    ): Promise<Uint8Array> {
        await this.connect();

        console.log('[BrowserLitService] Decrypting session key...', {
            ciphertext: ciphertext.slice(0, 20) + '...',
            hash: dataToEncryptHash,
            acc: unifiedAccessControlConditions
        });

        const result = await this.litNodeClient.decrypt({
            ciphertext,
            dataToEncryptHash,
            unifiedAccessControlConditions,
            sessionSigs, // Use sessionSigs here
            chain: 'mantle',
        });

        console.log('[BrowserLitService] Decrypted session key success');
        return result.decryptedData;
    }

    /**
     * Decrypts content using AES-256-GCM (Web Crypto API).
     */
    async decryptContent(
        encryptedBytes: Uint8Array,
        sessionKey: Uint8Array,
        ivHex: string,
        tagHex: string
    ): Promise<string> {
        console.log('[BrowserLitService] Decrypting content...', { iv: ivHex, tag: tagHex, len: encryptedBytes.length });

        // Convert hex IV and Tag to Uint8Array
        const iv = this.hexToBytes(ivHex);
        const tag = this.hexToBytes(tagHex);

        // Import Key
        const key = await window.crypto.subtle.importKey(
            'raw',
            sessionKey as any,
            { name: 'AES-GCM' },
            false,
            ['decrypt']
        );

        // Concatenate ciphertext + tag for Web Crypto
        const ciphertextWithTag = new Uint8Array(encryptedBytes.length + tag.length);
        ciphertextWithTag.set(encryptedBytes);
        ciphertextWithTag.set(tag, encryptedBytes.length);

        try {
            const decryptedBuffer = await window.crypto.subtle.decrypt(
                {
                    name: 'AES-GCM',
                    iv: iv as any,
                },
                key,
                ciphertextWithTag as any
            );

            return new TextDecoder().decode(decryptedBuffer);
        } catch (e) {
            console.error('[BrowserLitService] Decryption failed:', e);
            throw new Error('Decryption failed. Invalid key or integrity check failed.');
        }
    }

    private hexToBytes(hex: string): Uint8Array {
        if (!hex) return new Uint8Array(0);
        if (hex.startsWith('0x')) hex = hex.slice(2);
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
        }
        return bytes;
    }
}

export const litService = new BrowserLitService();
