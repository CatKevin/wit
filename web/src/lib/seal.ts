import { SealClient } from '@mysten/seal';
import { SessionKey } from '@mysten/seal';
import { type WalletAccount } from '@mysten/wallet-standard';
import { Transaction } from '@mysten/sui/transactions';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';

export type EncryptionMeta = {
    alg: 'seal-aes-256-gcm';
    policy_id: string;
    package_id: string;
    sealed_session_key: string; // base64
    iv: string; // base64
    tag: string; // base64
};

const SEAL_SERVERS = [
    {
        objectId: '0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75',
        weight: 1,
    },
    {
        objectId: '0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8',
        weight: 1,
    },
    {
        objectId: '0x6068c0acb197dddbacd4746a9de7f025b2ed5a5b6c1b1ab44dade4426d141da2',
        weight: 1,
    }
];

let _sealClient: SealClient | null = null;
let _currentSuiClient: SuiClient | null = null;

export function getSealClient(suiClient: SuiClient): SealClient {
    console.log('[getSealClient] Called with suiClient:', !!suiClient);
    console.log('[getSealClient] suiClient type:', typeof suiClient);

    // Check if suiClient is defined and valid
    if (!suiClient) {
        console.error('[getSealClient] SuiClient is null or undefined!');
        throw new Error('SuiClient is required to create SealClient');
    }

    // Check if suiClient has required methods
    console.log('[getSealClient] suiClient.getObject exists:', typeof suiClient.getObject);

    // Recreate SealClient if suiClient has changed or if it's the first time
    if (!_sealClient || _currentSuiClient !== suiClient) {
        console.log('[getSealClient] Creating new SealClient...');
        _currentSuiClient = suiClient;
        _sealClient = new SealClient({
            serverConfigs: SEAL_SERVERS,
            suiClient: suiClient as any,
        });
        console.log('[getSealClient] New SealClient created');
    }
    return _sealClient;
}

function base64ToBytes(b64: string): Uint8Array {
    const binString = atob(b64);
    return Uint8Array.from(binString, (c) => c.charCodeAt(0));
}

function fromHex(hex: string): number[] {
    if (hex.startsWith('0x')) hex = hex.slice(2);
    const bytes: number[] = [];
    for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substring(i, i + 2), 16));
    }
    return bytes;
}



export async function decryptToText(
    cipher: ArrayBuffer,
    meta: EncryptionMeta,
    account: WalletAccount,
    signTransaction: (input: { transaction: Transaction }) => Promise<{ bytes: string; signature: string }>,
    suiClientFromHook: any, // Accept the client from hook but we'll create our own
    signPersonalMessage?: (input: { message: Uint8Array }) => Promise<{ bytes: string; signature: string }>
): Promise<string> {
    console.log('[Seal] Starting decryption with meta:', meta);
    console.log('[Seal] Account address:', account?.address);
    console.log('[Seal] SuiClient from hook defined:', !!suiClientFromHook);

    if (meta.alg !== 'seal-aes-256-gcm') {
        throw new Error(`Unsupported encryption algorithm: ${meta.alg}`);
    }

    // Create a proper SuiClient instance for Seal SDK compatibility
    const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });
    console.log('[Seal] Created new SuiClient for Seal SDK');

    const client = getSealClient(suiClient);
    console.log('[Seal] Got SealClient:', !!client);
    const sealedKey = base64ToBytes(meta.sealed_session_key);
    console.log('[Seal] Sealed key length:', sealedKey.length);

    // Adapter to satisfy Seal SDK Signer interface
    const signerAdapter = {
        getPublicKey: () => {
            console.log('[Seal] getPublicKey called, returning address:', account.address);
            return {
                toSuiAddress: () => account.address,
                toRawBytes: () => account.publicKey,
            };
        },
        signTransaction: async (input: { transaction: Transaction }) => {
            console.log('[Seal] signTransaction called');
            try {
                const result = await signTransaction(input);
                console.log('[Seal] Transaction signed successfully:', { hasBytes: !!result.bytes, hasSignature: !!result.signature });
                return result;
            } catch (err) {
                console.error('[Seal] Failed to sign transaction:', err);
                throw err;
            }
        },
        signPersonalMessage: async (input: Uint8Array | { message: Uint8Array }) => {
            // Handle both input formats
            const message = input instanceof Uint8Array ? input : input.message;
            console.log('[Seal] signPersonalMessage called with message:', message);
            console.log('[Seal] Message type:', typeof message, 'isUint8Array:', message instanceof Uint8Array);

            if (!signPersonalMessage) {
                throw new Error('signPersonalMessage hook is not available');
            }

            try {
                // The dapp-kit expects { message: Uint8Array, account: WalletAccount }
                const result = await signPersonalMessage({ message, account } as any);
                console.log('[Seal] Personal message signed successfully, signature:', result.signature);
                // Return in the format Seal SDK expects
                return {
                    signature: result.signature,
                    bytes: result.bytes || ''
                };
            } catch (err) {
                console.error('[Seal] Failed to sign personal message:', err);
                throw err;
            }
        },
    };

    // 1. Create Ephemeral Session Key
    console.log('[Seal] Creating session key...');
    console.log('[Seal] Signer adapter:', {
        hasGetPublicKey: !!signerAdapter.getPublicKey,
        hasSignTransaction: !!signerAdapter.signTransaction,
    });

    let sessionKey;
    try {
        console.log('[Seal] Preparing to create SessionKey with:');
        console.log('  - address:', account.address);
        console.log('  - packageId:', meta.package_id);
        console.log('  - suiClient has getObject:', typeof suiClient?.getObject);
        console.log('  - suiClient constructor:', suiClient?.constructor?.name);

        sessionKey = await SessionKey.create({
            address: account.address,
            packageId: meta.package_id,
            ttlMin: 10,
            signer: signerAdapter as any,
            suiClient: suiClient as any,
        });
        console.log('[Seal] Session key created successfully');
    } catch (err) {
        console.error('[Seal] Failed to create session key:', err);
        console.error('[Seal] Error stack:', err instanceof Error ? err.stack : 'No stack');
        throw new Error(`Failed to create session key: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 2. Construct Transaction
    const tx = new Transaction();
    const policyIdBytes = fromHex(meta.policy_id);
    console.log('[Seal] Policy ID bytes:', policyIdBytes);

    tx.moveCall({
        target: `${meta.package_id}::whitelist::seal_approve`,
        arguments: [
            tx.pure.vector('u8', policyIdBytes),
            tx.object(meta.policy_id),
        ],
    });

    // 3. Build transaction bytes (not sign!)
    // Important: Use onlyTransactionKind: true as per Seal examples
    console.log('[Seal] Building transaction bytes...');
    let txBytes;
    try {
        txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });
        console.log('[Seal] Transaction bytes built, length:', txBytes.length);
    } catch (err) {
        console.error('[Seal] Failed to build transaction:', err);
        throw new Error(`Failed to build transaction: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 4. Unseal Session Key
    console.log('[Seal] Unsealing session key...');
    let sessionKeyBytes;
    try {
        sessionKeyBytes = await client.decrypt({
            data: sealedKey,
            sessionKey,
            txBytes: new Uint8Array(txBytes),
        });
        console.log('[Seal] Session key unsealed, length:', sessionKeyBytes.length);
    } catch (err) {
        console.error('[Seal] Failed to unseal session key:', err);
        throw new Error(`Failed to unseal session key: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 5. Decrypt Data
    const key = await crypto.subtle.importKey(
        'raw',
        sessionKeyBytes,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
    );

    const iv = base64ToBytes(meta.iv);
    const tag = base64ToBytes(meta.tag);

    const combined = new Uint8Array(cipher.byteLength + tag.byteLength);
    combined.set(new Uint8Array(cipher), 0);
    combined.set(tag, cipher.byteLength);

    const plain = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        combined
    );

    return new TextDecoder().decode(plain);
}
