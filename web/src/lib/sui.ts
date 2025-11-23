import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';

export const SUI_NETWORK = 'testnet';
export const SUI_RPC_URL = getFullnodeUrl(SUI_NETWORK);

export const suiClient = new SuiClient({ url: SUI_RPC_URL });

export interface Repository {
    id: string;
    name: string;
    description: string;
    owner: string;
    head_commit?: string;
    head_manifest?: string;
    head_quilt?: string;
    version: number;
    seal_policy_id?: string;
}

export async function getRepository(id: string): Promise<Repository> {
    const object = await suiClient.getObject({
        id,
        options: {
            showContent: true,
        },
    });

    if (object.error) {
        throw new Error(`Failed to fetch repository: ${object.error.code}`);
    }

    const content = object.data?.content as any;
    if (!content || content.dataType !== 'moveObject') {
        throw new Error('Invalid object type');
    }

    const fields = content.fields;

    // Helper to parse Option<vector<u8>> -> string | undefined
    const parseOptionBytes = (opt: any): string | undefined => {
        if (!opt || !opt.fields) return undefined;
        // Move Option is struct { vec: vector<T> }
        // If vec is empty, it's None. If vec has 1 element, it's Some.
        const vec = opt.fields.vec;
        if (!vec || !Array.isArray(vec) || vec.length === 0) return undefined;

        // The inner value is vector<u8>, which might be represented as number[] or string (base64/hex) depending on RPC
        // Typically Sui RPC returns vector<u8> as string (if it's a string) or number[]
        // But here we expect Blob IDs which are strings (or bytes that form a string ID)
        // Let's assume it's a string or byte array we need to decode.
        // Wait, in the contract: head_commit: Option<vector<u8>>.
        // If it's a Blob ID, it's likely a string.
        // Let's try to convert bytes to string if it's an array.
        const inner = vec[0];
        if (typeof inner === 'string') return inner;
        if (Array.isArray(inner)) return new TextDecoder().decode(new Uint8Array(inner));
        return undefined;
    };

    // Helper to parse vector<u8> -> string
    const parseBytes = (val: any): string => {
        if (typeof val === 'string') return val;
        if (Array.isArray(val)) return new TextDecoder().decode(new Uint8Array(val));
        return '';
    };

    return {
        id: object.data?.objectId || '',
        name: parseBytes(fields.name),
        description: parseBytes(fields.description),
        owner: fields.owner,
        head_commit: parseOptionBytes(fields.head_commit),
        head_manifest: parseOptionBytes(fields.head_manifest),
        head_quilt: parseOptionBytes(fields.head_quilt),
        version: Number(fields.version),
        seal_policy_id: parseOptionBytes(fields.seal_policy_id),
    };
}
