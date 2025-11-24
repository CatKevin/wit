import { useQuery } from '@tanstack/react-query';
import { useSuiClient, useSignTransaction, useCurrentAccount, useSignPersonalMessage } from '@mysten/dapp-kit';
import { getBlobText, getFileFromQuiltAsText, getBlobArrayBuffer, getFileFromQuiltArrayBuffer } from '@/lib/walrus';
import { decryptToText } from '@/lib/seal';

export interface FileRef {
    blobId?: string;
    quiltId?: string;
    identifier?: string;
    enc?: {
        alg: 'seal-aes-256-gcm';
        iv: string;
        tag: string;
        policy_id: string;
        package_id: string;
        sealed_session_key: string;
        cipher_size?: number;
        // Legacy/Fallback support if needed, but better to be strict
        policy?: string;
    };
    policyId?: string;
}

export function useFileContent(fileRef?: FileRef) {
    const suiClient = useSuiClient();
    const { mutateAsync: signTransaction } = useSignTransaction();
    const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
    const account = useCurrentAccount();

    return useQuery({
        queryKey: ['file', fileRef?.blobId, fileRef?.quiltId, fileRef?.identifier, fileRef?.enc?.iv],
        queryFn: async () => {
            console.log('[useFileContent] Starting with fileRef:', fileRef);
            console.log('[useFileContent] SuiClient from hook:', !!suiClient);
            console.log('[useFileContent] Account:', account?.address);

            if (!fileRef) throw new Error('No file reference provided');

            // Check if suiClient is available
            if (!suiClient) {
                console.error('[useFileContent] SuiClient is null!');
                throw new Error('SuiClient is not initialized. Please check your wallet connection.');
            }
            console.log('[useFileContent] SuiClient type:', typeof suiClient);
            console.log('[useFileContent] SuiClient constructor:', suiClient?.constructor?.name);

            // If it's a standalone blob
            if (fileRef.blobId) {
                if (fileRef.enc) {
                    console.log('[useFileContent] Encrypted blob detected');
                    if (!account) throw new Error('Wallet not connected');
                    console.log('[useFileContent] Fetching blob array buffer...');
                    const buf = await getBlobArrayBuffer(fileRef.blobId);
                    console.log('[useFileContent] Blob fetched, size:', buf.byteLength);
                    console.log('[useFileContent] Calling decryptToText with suiClient:', !!suiClient);
                    return decryptToText(
                        buf,
                        fileRef.enc,
                        account,
                        (input) => signTransaction({ transaction: input.transaction as any }),
                        suiClient as any,
                        (input) => signPersonalMessage({ message: input.message, account })
                    );
                }
                console.log('[useFileContent] Fetching plain text blob');
                return getBlobText(fileRef.blobId);
            }

            // If it's a file in a quilt
            if (fileRef.quiltId && fileRef.identifier) {
                if (fileRef.enc) {
                    console.log('[useFileContent] Encrypted quilt file detected');
                    if (!account) {
                        console.error('[useFileContent] No account - wallet not connected!');
                        throw new Error('Please connect your wallet to view encrypted files. Only whitelisted addresses can decrypt this content.');
                    }
                    console.log('[useFileContent] Fetching quilt file array buffer...');
                    const buf = await getFileFromQuiltArrayBuffer(fileRef.quiltId, fileRef.identifier);
                    console.log('[useFileContent] Quilt file fetched, size:', buf.byteLength);
                    console.log('[useFileContent] Calling decryptToText with suiClient:', !!suiClient);
                    return decryptToText(
                        buf,
                        fileRef.enc,
                        account,
                        (input) => signTransaction({ transaction: input.transaction as any }),
                        suiClient as any,
                        (input) => signPersonalMessage({ message: input.message, account })
                    );
                }
                console.log('[useFileContent] Fetching plain text quilt file');
                return getFileFromQuiltAsText(fileRef.quiltId, fileRef.identifier);
            }

            throw new Error('Invalid file reference: must provide either blobId or (quiltId + identifier)');
        },
        enabled: !!(fileRef?.blobId || (fileRef?.quiltId && fileRef?.identifier)),
        staleTime: Infinity, // Content is immutable
    });
}
