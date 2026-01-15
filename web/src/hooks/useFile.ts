import { useQuery } from '@tanstack/react-query';
import { useSuiClient, useSignTransaction, useCurrentAccount, useSignPersonalMessage } from '@mysten/dapp-kit';
import { getBlobText, getFileFromQuiltAsText, getBlobArrayBuffer, getFileFromQuiltArrayBuffer } from '@/lib/walrus';
import { decryptToText } from '@/lib/seal';

import { fetchMantleFileContent } from '@/lib/evm/fetchMantleRepo';

export interface FileRef {
    blobId?: string;
    quiltId?: string;
    identifier?: string;
    chain?: 'sui' | 'mantle'; // Added chain property
    enc?: {
        alg: 'seal-aes-256-gcm' | 'lit-aes-256-gcm'; // Added lit support in type
        iv: string;
        tag: string;
        policy_id?: string;
        package_id?: string;
        sealed_session_key?: string;
        cipher_size?: number;
        // Lit params
        lit_encrypted_key?: string;
        access_control_conditions?: any;
        unified_access_control_conditions?: any;
        lit_hash?: string;
    };
    policyId?: string;
}

export const ENCRYPTED_CONTENT_PLACEHOLDER = '__ENCRYPTED_MANTLE_FILE__';

export function useFileContent(fileRef?: FileRef) {
    const suiClient = useSuiClient();
    const { mutateAsync: signTransaction } = useSignTransaction();
    const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
    const account = useCurrentAccount();

    return useQuery({
        queryKey: ['file', fileRef?.blobId, fileRef?.quiltId, fileRef?.identifier, fileRef?.chain, fileRef?.enc?.iv],
        queryFn: async () => {
            if (!fileRef) throw new Error('No file reference provided');

            // Mantle Path
            if (fileRef.chain === 'mantle') {
                if (fileRef.blobId) {
                    // Check if file is encrypted (has enc metadata)
                    if (fileRef.enc) {
                        // Return placeholder to trigger Decrypt UI
                        return ENCRYPTED_CONTENT_PLACEHOLDER;
                    }
                    return fetchMantleFileContent(fileRef.blobId);
                }
                throw new Error('Mantle files require a blobId (CID)');
            }

            // Sui Path (Existing Logic)
            // ... (rest of the logic)
            console.log('[useFileContent] Starting with fileRef:', fileRef);
            console.log('[useFileContent] SuiClient from hook:', !!suiClient);
            // ...

            // If it's a standalone blob
            if (fileRef.blobId) {
                if (fileRef.enc) {
                    if (!account) throw new Error('Wallet not connected');
                    // ... existing decryption logic
                    const buf = await getBlobArrayBuffer(fileRef.blobId);
                    return decryptToText(
                        buf,
                        fileRef.enc as any, // Cast for compatibility
                        account,
                        (input) => signTransaction({ transaction: input.transaction as any }),
                        suiClient as any,
                        (input) => signPersonalMessage({ message: input.message, account })
                    );
                }
                return getBlobText(fileRef.blobId);
            }

            // If it's a file in a quilt
            if (fileRef.quiltId && fileRef.identifier) {
                if (fileRef.enc) {
                    if (!account) throw new Error('Wallet not connected');
                    const buf = await getFileFromQuiltArrayBuffer(fileRef.quiltId, fileRef.identifier);
                    return decryptToText(
                        buf,
                        fileRef.enc as any,
                        account,
                        (input) => signTransaction({ transaction: input.transaction as any }),
                        suiClient as any,
                        (input) => signPersonalMessage({ message: input.message, account })
                    );
                }
                return getFileFromQuiltAsText(fileRef.quiltId, fileRef.identifier);
            }

            throw new Error('Invalid file reference: must provide either blobId or (quiltId + identifier)');
        },
        enabled: !!(fileRef?.blobId || (fileRef?.quiltId && fileRef?.identifier)),
        staleTime: Infinity, // Content is immutable
    });
}
