import { SealClient } from '@mysten/seal';
import { SessionKey } from '@mysten/seal';
import { type WalletAccount } from '@mysten/wallet-standard';
import { Transaction } from '@mysten/sui/transactions';
import { SuiClient } from '@mysten/sui/client';

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

export function getSealClient(suiClient: SuiClient): SealClient {
    if (!_sealClient) {
        _sealClient = new SealClient({
            serverConfigs: SEAL_SERVERS,
            suiClient: suiClient as any,
        });
    }
    return _sealClient;
}

function base64ToBytes(b64: string): Uint8Array {
    const binString = atob(b64);
    return Uint8Array.from(binString, (c) => c.charCodeAt(0));
}

function fromHex(hex: string): Uint8Array {
    if (hex.startsWith('0x')) hex = hex.slice(2);
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
}



export async function decryptToText(
    cipher: ArrayBuffer,
    meta: EncryptionMeta,
    account: WalletAccount,
    signTransaction: (input: { transaction: Transaction }) => Promise<{ bytes: string; signature: string }>,
    suiClient: SuiClient
): Promise<string> {
    if (meta.alg !== 'seal-aes-256-gcm') {
        throw new Error(`Unsupported encryption algorithm: ${meta.alg}`);
    }

    const client = getSealClient(suiClient);
    const sealedKey = base64ToBytes(meta.sealed_session_key);

    // Adapter to satisfy Seal SDK Signer interface
    const signerAdapter = {
        getPublicKey: () => ({
            toSuiAddress: () => account.address,
            toRawBytes: () => account.publicKey,
        }),
        signTransaction: async (input: { transaction: Transaction }) => {
            return signTransaction(input);
        },
    };

    // 1. Create Ephemeral Session Key
    const sessionKey = await SessionKey.create({
        address: account.address,
        packageId: meta.package_id,
        ttlMin: 10,
        signer: signerAdapter as any,
        suiClient: suiClient as any,
    });

    // 2. Construct Transaction
    const tx = new Transaction();
    tx.setSender(account.address);
    const policyIdBytes = fromHex(meta.policy_id);

    tx.moveCall({
        target: `${meta.package_id}::whitelist::seal_approve`,
        arguments: [
            tx.pure.vector('u8', policyIdBytes),
            tx.object(meta.policy_id),
        ],
    });

    // 3. Sign Transaction
    const { bytes } = await signTransaction({ transaction: tx });

    // 4. Unseal Session Key
    const sessionKeyBytes = await client.decrypt({
        data: sealedKey,
        sessionKey,
        txBytes: typeof bytes === 'string' ? base64ToBytes(bytes) : bytes,
    });

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
