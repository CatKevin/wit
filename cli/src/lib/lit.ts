import { LitNodeClient } from '@lit-protocol/lit-node-client';
import { AUTH_METHOD_SCOPE } from '@lit-protocol/constants';
// LitNetwork is a type alias usually, or we just use string constant.
// LIT_RPC is not directly exported in recent versions, we rely on LitNodeClient defaults.
import { generateSessionKey, encryptBuffer, decryptBuffer } from './crypto';

// Use 'manhattan' as a default network for now, or 'datil-dev' / 'datil-test'
// For this MVP we will target 'datil-test'
export const LIT_NETWORK = 'datil-test';

export const LIT_ACTION_CODE = `
const go = async () => {
    // --- Configuration ---
    const RPC_URL = "https://rpc.sepolia.mantle.xyz";
  
    // jsParams: repoId, contractAddress, userAddress
    if (!repoId || !contractAddress || !userAddress) {
        console.log("Missing required params: repoId, contractAddress, userAddress");
        LitActions.setResponse({ response: "false" });
        return;
    }
  
    const abi = [
        "function hasAccess(uint256 repoId, address user) view returns (bool)"
    ];
    
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    // Explicitly define provider to avoid issues with default providers in Lit
    const contract = new ethers.Contract(contractAddress, abi, provider);
    
    try {
        console.log(\`Checking access for Repo \${repoId}, User \${userAddress} on Mantle Sepolia...\`);
        const hasAccess = await contract.hasAccess(repoId, userAddress);
        console.log(\`Result: \${hasAccess}\`);
        LitActions.setResponse({ response: hasAccess.toString() }); 
    } catch (error) {
        console.error("Error checking access:", error);
        LitActions.setResponse({ response: "false" });
    }
};
go();
`;

export interface LitInitConfig {
    debug?: boolean;
}

export class LitService {
    private litNodeClient: LitNodeClient;
    private connected: boolean = false;

    constructor(config: LitInitConfig = {}) {
        this.litNodeClient = new LitNodeClient({
            litNetwork: LIT_NETWORK,
            debug: config.debug ?? false,
        });
    }

    /**
     * Generates the Access Control Conditions (ACC) for a specific repo.
     * This uses the custom Lit Action to check access on Mantle Sepolia.
     * 
     * @param repoId The repository ID (uint256 string).
     * @param contractAddress The Wit Repo Contract address on Mantle Sepolia.
     * @returns The ACC array compatible with Lit SDK.
     */
    getAccessControlConditions(repoId: string, contractAddress: string) {
        return [
            {
                contractAddress: '', // Not used for litActionCondition
                standardContractType: '',
                chain: 'ethereum', // Placeholder, required but ignored by logic
                method: '',
                parameters: [],
                returnValueTest: {
                    comparator: '=',
                    value: 'true',
                },
                conditionType: 'litActionCondition',
                code: LIT_ACTION_CODE,
                jsParams: {
                    repoId,
                    contractAddress,
                    userAddress: ':userAddress', // Dynamic substitution by Lit
                },
            },
        ];
    }

    async connect() {
        if (this.connected) return;
        await this.litNodeClient.connect();
        this.connected = true;
    }

    /**
     * Encrypts a session key using Lit Protocol.
     * 
     * @param sessionKey The 32-byte session key to encrypt.
     * @param accessControlConditions The Lit Access Control Conditions.
     * @returns The { ciphertext, dataToEncryptHash } from Lit encryption.
     */
    async encryptSessionKey(
        sessionKey: Buffer,
        accessControlConditions: any[]
    ): Promise<{ ciphertext: string; dataToEncryptHash: string }> {
        await this.connect();

        // In Lit v6+, we use litNodeClient.encrypt() or similar patterns.
        // However, typically for "encrypt string" we rely on the SDK helper or
        // manually do the encryption.
        // For simplicity in this shell, we will assume standard usage:
        // 1. We encrypt the session key locally? No, Lit encrypts the key.
        // Wait, standard pattern is:
        // Lit encrypts the *content key*? 
        // Actually, usually we use Lit to encrypt a "message" (the session key).

        // Using the 'encryptString' helper from SDK if available, or base encryption.
        // Since we only installed core client, we use `encrypt` with specific args.

        const { ciphertext, dataToEncryptHash } = await this.litNodeClient.encrypt({
            dataToEncrypt: sessionKey,
            accessControlConditions,
        });

        return { ciphertext, dataToEncryptHash };
    }

    /**
     * Decrypts the session key using Lit Protocol.
     * 
     * @param ciphertext The encrypted session key from Lit.
     * @param dataToEncryptHash The hash of the session key.
     * @param accessControlConditions The conditions used to encrypt.
     * @param authSig The user's auth signature (e.g. from wallet).
     * @returns The raw session key (Buffer).
     */
    async decryptSessionKey(
        ciphertext: string,
        dataToEncryptHash: string,
        accessControlConditions: any[],
        authSig: any
    ): Promise<Buffer> {
        await this.connect();

        const decryptedString = await this.litNodeClient.decrypt({
            ciphertext,
            dataToEncryptHash,
            accessControlConditions,
            authSig,
            chain: 'ethereum', // chain is often required but ignored for some conditions
        });

        // decryptedString is typically a Uint8Array or string depending on input.
        // The encrypt function above treats input as Uint8Array if passed buffer.
        return Buffer.from(decryptedString.decryptedData);
    }
}
