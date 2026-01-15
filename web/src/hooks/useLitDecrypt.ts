import { useState } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { ethers5Adapter } from 'thirdweb/adapters/ethers5';
import { litService } from '@/lib/lit';
import { fetchMantleFileBuffer } from '@/lib/evm/fetchMantleRepo';
import type { FileRef } from '@/hooks/useFile';
import { mantleMainnet, thirdwebClient } from '@/lib/thirdweb';

export function useLitDecrypt() {
    const account = useActiveAccount();
    const [isDecrypting, setIsDecrypting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const decryptFile = async (fileRef: FileRef): Promise<string> => {
        if (!account) {
            throw new Error('Wallet not connected');
        }

        if (!fileRef.blobId || !fileRef.enc) {
            throw new Error('Invalid file reference for decryption');
        }

        setIsDecrypting(true);
        setError(null);

        try {
            // 1. Fetch encrypted content
            const encryptedBuffer = await fetchMantleFileBuffer(fileRef.blobId);

            // 2. Get Signer from Thirdweb Account
            const signer = await ethers5Adapter.signer.toEthers({
                client: thirdwebClient,
                chain: mantleMainnet,
                account,
            });

            // 3. Generate Session Sigs (User Interaction + Capacity Delegation)
            const sessionSigs = await litService.getSessionSigs(signer);

            // 4. Decrypt Session Key
            // Parse enc metadata
            console.log('[useLitDecrypt] fileRef.enc:', fileRef.enc);

            const {
                lit_encrypted_key,
                access_control_conditions,
                unified_access_control_conditions,
                iv,
                tag,
                lit_hash
            } = fileRef.enc;

            const conditions = access_control_conditions || unified_access_control_conditions;

            if (!lit_encrypted_key || !conditions || !lit_hash) {
                // Compatibility check: if missing Lit params, maybe old seal format?
                throw new Error('File encryption metadata missing Lit params.');
            }

            const sessionKey = await litService.decryptSessionKey(
                lit_encrypted_key,
                lit_hash,
                conditions,
                sessionSigs
            );

            // 5. Decrypt Content
            const content = await litService.decryptContent(
                encryptedBuffer,
                sessionKey,
                iv,
                tag
            );

            return content;
        } catch (err: any) {
            console.error('[useLitDecrypt] Error:', err);
            const msg = err.message || 'Decryption failed';
            setError(msg);
            throw new Error(msg);
        } finally {
            setIsDecrypting(false);
        }
    };

    return { decryptFile, isDecrypting, error };
}
