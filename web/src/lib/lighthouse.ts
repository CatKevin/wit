export const LIGHTHOUSE_GATEWAY = 'https://gateway.lighthouse.storage/ipfs';

/**
 * Lighthouse Storage Service
 * Handles interactions with Lighthouse IPFS gateway
 */
export const LighthouseService = {
    /**
     * Get public IPFS gateway URL for a CID
     */
    getGatewayUrl(cid: string): string {
        // Remove ifps:// prefix if present
        const cleanCid = cid.replace('ipfs://', '');
        return `${LIGHTHOUSE_GATEWAY}/${cleanCid}`;
    },

    /**
     * Download content from IPFS as JSON
     */
    async downloadJSON<T>(cid: string): Promise<T | null> {
        try {
            const url = this.getGatewayUrl(cid);
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Failed to fetch from IPFS: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`[LighthouseService] Download JSON failed for ${cid}:`, error);
            return null;
        }
    },

    /**
     * Download content from IPFS as raw buffer (Uint8Array)
     */
    async downloadBuffer(cid: string): Promise<Uint8Array | null> {
        try {
            const url = this.getGatewayUrl(cid);
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Failed to fetch from IPFS: ${response.statusText}`);
            }

            const buffer = await response.arrayBuffer();
            return new Uint8Array(buffer);
        } catch (error) {
            console.error(`[LighthouseService] Download Buffer failed for ${cid}:`, error);
            return null;
        }
    },

    /**
     * Download content from IPFS as Text
     */
    async downloadText(cid: string): Promise<string | null> {
        try {
            const url = this.getGatewayUrl(cid);
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Failed to fetch from IPFS: ${response.statusText}`);
            }

            return await response.text();
        } catch (error) {
            console.error(`[LighthouseService] Download Text failed for ${cid}:`, error);
            return null;
        }
    }
};
