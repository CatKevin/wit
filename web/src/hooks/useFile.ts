import { useQuery } from '@tanstack/react-query';
import { useSuiClient, useSignTransaction, useCurrentAccount } from '@mysten/dapp-kit';
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
    const account = useCurrentAccount();

    return useQuery({
        queryKey: ['file', fileRef?.blobId, fileRef?.quiltId, fileRef?.identifier, fileRef?.enc?.iv],
        queryFn: async () => {
            if (!fileRef) throw new Error('No file reference provided');

            // If it's a standalone blob
            if (fileRef.blobId) {
                if (fileRef.enc) {
                    if (!account) throw new Error('Wallet not connected');
                    const buf = await getBlobArrayBuffer(fileRef.blobId);
                    return decryptToText(buf, fileRef.enc, account, (input) => signTransaction({ transaction: input.transaction as any }), suiClient as any);
                }
                return getBlobText(fileRef.blobId);
            }

            // If it's a file in a quilt
            if (fileRef.quiltId && fileRef.identifier) {
                if (fileRef.enc) {
                    if (!account) throw new Error('Wallet not connected');
                    const buf = await getFileFromQuiltArrayBuffer(fileRef.quiltId, fileRef.identifier);
                    return decryptToText(buf, fileRef.enc, account, (input) => signTransaction({ transaction: input.transaction as any }), suiClient as any);
                }
                return getFileFromQuiltAsText(fileRef.quiltId, fileRef.identifier);
            }

            throw new Error('Invalid file reference: must provide either blobId or (quiltId + identifier)');
        },
        enabled: !!(fileRef?.blobId || (fileRef?.quiltId && fileRef?.identifier)),
        staleTime: Infinity, // Content is immutable
    });
}
