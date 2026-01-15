import { LitNodeClient } from '@lit-protocol/lit-node-client';
import { AUTH_METHOD_SCOPE } from '@lit-protocol/constants';
// LitNetwork is a type alias usually, or we just use string constant.
// LIT_RPC is not directly exported in recent versions, we rely on LitNodeClient defaults.
import { generateSessionKey, encryptBuffer, decryptBuffer } from './crypto';

// Use 'manhattan' as a default network for now, or 'datil-dev' / 'datil-test'
// For this MVP we will target 'datil-test'
export const LIT_NETWORK = 'datil-test';

export const LIT_ACTION_CODE = `
(async () => {
    // --- Configuration ---
    const RPC_URL = "https://rpc.mantle.xyz";
  
    // 1. Get params from accessControlConditions
    const _cond = accessControlConditions.find(c => c.standardContractType === "LitAction");
    const params = _cond.parameters;
    const repoId = params[0];
    const contractAddress = params[1];
    const userAddress = params[2];

    if (!repoId || !contractAddress || !userAddress) {
        console.log("Missing required params");
        LitActions.setResponse({ response: "false" });
        return;
    }
  
    const abi = [
        "function hasAccess(uint256 repoId, address user) view returns (bool)"
    ];
    
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(contractAddress, abi, provider);
    
    try {
        console.log("Checking access for Repo " + repoId + " User " + userAddress);
        const hasAccess = await contract.hasAccess(repoId, userAddress);
        console.log("Result: " + hasAccess);
        LitActions.setResponse({ response: hasAccess.toString() }); 
    } catch (error) {
        console.error("Error checking access:", error);
        LitActions.setResponse({ response: "false" });
    }
})();
`;

export const LIT_ACTION_CID = 'bafkreibbq3fltufjarcmk45426mhhssky5izkjuxio7im26q6lxlf2qbda';

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
     * Use unifiedAccessControlConditions for evmContract type support.
     * 
     * @param repoId The repository ID.
     * @param contractAddress The Wit Repo Contract address.
     * @returns The Unified ACC array compatible with Lit SDK.
     */
    getAccessControlConditions(repoId: string, contractAddress: string) {
        return [
            {
                conditionType: 'evmContract',
                contractAddress: contractAddress,
                functionName: 'hasAccess',
                functionParams: [repoId, ':userAddress'],
                functionAbi: {
                    name: "hasAccess",
                    type: "function",
                    stateMutability: "view",
                    inputs: [
                        { name: "repoId", type: "uint256" },
                        { name: "user", type: "address" }
                    ],
                    outputs: [
                        { name: "", type: "bool" }
                    ]
                },
                chain: 'mantle',
                returnValueTest: {
                    key: '',
                    comparator: '=',
                    value: 'true',
                },
            },
        ];
    }

    async connect() {
        if (this.connected) return;
        await this.litNodeClient.connect();
        this.connected = true;
    }

    async disconnect() {
        if (!this.connected) return;
        if (typeof (this.litNodeClient as any).disconnect === 'function') {
            await (this.litNodeClient as any).disconnect();
        }
        this.connected = false;
    }

    /**
     * Encrypts a session key using Lit Protocol.
     * 
     * @param sessionKey The 32-byte session key to encrypt.
     * @param unifiedAccessControlConditions The Lit Unified Access Control Conditions.
     * @returns The { ciphertext, dataToEncryptHash } from Lit encryption.
     */
    async encryptSessionKey(
        sessionKey: Buffer,
        unifiedAccessControlConditions: any[]
    ): Promise<{ ciphertext: string; dataToEncryptHash: string }> {
        await this.connect();

        const { ciphertext, dataToEncryptHash } = await this.litNodeClient.encrypt({
            dataToEncrypt: sessionKey,
            unifiedAccessControlConditions,
        });

        return { ciphertext, dataToEncryptHash };
    }

    /**
     * Decrypts the session key using Lit Protocol.
     * 
     * @param ciphertext The encrypted session key from Lit.
     * @param dataToEncryptHash The hash of the session key.
     * @param unifiedAccessControlConditions The conditions used to encrypt.
     * @param authSig The user's auth signature (e.g. from wallet).
     * @returns The raw session key (Buffer).
     */
    async decryptSessionKey(
        ciphertext: string,
        dataToEncryptHash: string,
        unifiedAccessControlConditions: any[],
        authSig: any
    ): Promise<Buffer> {
        await this.connect();

        const decryptedString = await this.litNodeClient.decrypt({
            ciphertext,
            dataToEncryptHash,
            unifiedAccessControlConditions,
            authSig,
            chain: 'mantle',
        });

        return Buffer.from(decryptedString.decryptedData);
    }

    /**
     * Generates a SIWE AuthSig using a local ethers Signer.
     * This is required for Lit Protocol to authenticate the user and check access.
     */
    async getAuthSig(signer: ethers.Signer): Promise<any> {
        const address = await signer.getAddress();
        const domain = 'localhost';
        const origin = 'https://localhost/login';
        const statement = 'Sign in to Wit CLI to decrypt repository data.';
        const now = new Date().toISOString();
        const expiration = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(); // 24 hours
        const chainId = 5000; // Mantle Mainnet

        // Construct SIWE Message (EIP-4361)
        // Note: Newlines (\n) are critical.
        const message = `${domain} wants you to sign in with your Ethereum account:\n${address}\n\n${statement}\n\nURI: ${origin}\nVersion: 1\nChain ID: ${chainId}\nNonce: ${this.randomNonce()}\nIssued At: ${now}\nExpiration Time: ${expiration}`;

        const signature = await signer.signMessage(message);

        return {
            sig: signature,
            derivedVia: 'web3.eth.personal.sign',
            signedMessage: message,
            address: address,
        };
    }

    private randomNonce(): string {
        return Math.random().toString(36).substring(2, 12);
    }
}
import { ethers } from 'ethers';
