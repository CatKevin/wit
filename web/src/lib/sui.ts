import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';

export const SUI_NETWORK = 'testnet';
export const SUI_RPC_URL = getFullnodeUrl(SUI_NETWORK);

// Create a default client, but this should be overridden by the provider
let suiClient: SuiClient | null = null;

export function getSuiClient(): SuiClient {
    if (!suiClient) {
        suiClient = new SuiClient({ url: SUI_RPC_URL });
    }
    return suiClient;
}

// Allow setting the client from the provider
export function setSuiClient(client: SuiClient) {
    suiClient = client;
}

export interface Repository {
    id: string;
    name: string;
    description: string;
    owner: string;
    collaborators: string[];
    head_commit?: string;
    head_manifest?: string;
    head_quilt?: string;
    version: number;
    seal_policy_id?: string;
}

// Robust decoder function from CLI (handles multiple formats)
export function decodeVecAsString(raw: unknown): string | null {
    if (raw === null || raw === undefined) return null;

    // Handle direct string (including hex format)
    if (typeof raw === 'string') {
        if (raw.startsWith('0x')) {
            // Decode hex string to UTF-8
            try {
                const hex = raw.slice(2);
                const bytes = new Uint8Array(hex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
                return new TextDecoder().decode(bytes);
            } catch {
                return raw;
            }
        }
        return raw;
    }

    // Handle arrays
    if (Array.isArray(raw)) {
        if (!raw.length) return null;

        // Array of numbers (byte array)
        if (raw.every((v) => typeof v === 'number')) {
            return new TextDecoder().decode(new Uint8Array(raw as number[]));
        }

        // Array with single element (recurse)
        if (raw.length === 1) {
            return decodeVecAsString(raw[0]);
        }

        // Fallback: try first element
        return decodeVecAsString(raw[0]);
    }

    // Handle objects (nested structures)
    if (typeof raw === 'object') {
        const asRec = raw as Record<string, any>;

        // Check for common nested patterns
        if (asRec.vec !== undefined) return decodeVecAsString(asRec.vec);
        if (asRec.fields !== undefined) return decodeVecAsString(asRec.fields);
    }

    return String(raw);
}

// Decode vector<u8> as hex string (for object IDs like seal_policy_id)
export function decodeVecAsHex(raw: unknown): string | null {
    if (raw === null || raw === undefined) return null;

    if (typeof raw === 'string') {
        // Already a hex string
        return raw.startsWith('0x') ? raw : `0x${raw}`;
    }

    if (Array.isArray(raw)) {
        if (!raw.length) return null;

        // Array of numbers (byte array) - convert to hex
        if (raw.every((v) => typeof v === 'number')) {
            const hex = (raw as number[]).map(b => b.toString(16).padStart(2, '0')).join('');
            return `0x${hex}`;
        }

        // Single element array - recurse
        if (raw.length === 1) {
            return decodeVecAsHex(raw[0]);
        }

        return null;
    }

    if (typeof raw === 'object') {
        const asRec = raw as Record<string, any>;
        if (asRec.vec !== undefined) return decodeVecAsHex(asRec.vec);
        if (asRec.fields !== undefined) return decodeVecAsHex(asRec.fields);
    }

    return null;
}

export async function getRepository(id: string, client?: SuiClient): Promise<Repository> {
    const suiClient = client || getSuiClient();
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

    // Parse collaborators array
    let collaborators: string[] = [];
    if (fields.collaborators && Array.isArray(fields.collaborators)) {
        collaborators = fields.collaborators.map((addr: string) => addr);
    }

    return {
        id: object.data?.objectId || '',
        name: decodeVecAsString(fields.name) || '',
        description: decodeVecAsString(fields.description) || '',
        owner: fields.owner,
        collaborators,
        head_commit: decodeVecAsString(fields.head_commit) || undefined,
        head_manifest: decodeVecAsString(fields.head_manifest) || undefined,
        head_quilt: decodeVecAsString(fields.head_quilt) || undefined,
        version: Number(fields.version),
        seal_policy_id: decodeVecAsHex(fields.seal_policy_id) || undefined,
    };
}
