export const LIGHTHOUSE_GATEWAY = 'https://gateway.lighthouse.storage/ipfs';
export const GATEWAYS = [
    'https://gateway.lighthouse.storage/ipfs',
    'https://ipfs.io/ipfs',
    'https://dweb.link/ipfs'
];

/**
 * Lighthouse Storage Service
 * Handles interactions with Lighthouse IPFS gateway with fallbacks
 */
export const LighthouseService = {
    /**
     * Get content from IPFS with gateway fallback
     */
    async fetchWithFallback(cid: string, type: 'json' | 'text' | 'buffer'): Promise<any> {
        const cleanCid = cid.replace('ipfs://', '');

        for (const gateway of GATEWAYS) {
            try {
                const url = `${gateway}/${cleanCid}`;
                console.log(`[LighthouseService] Fetching ${cleanCid} from ${gateway}`);

                const response = await fetch(url);

                if (!response.ok) {
                    console.warn(`[LighthouseService] Gateway ${gateway} failed: ${response.status} ${response.statusText}`);
                    continue;
                }

                // Check for directory listing (HTML) when expecting JSON/Text
                const contentType = response.headers.get('content-type');
                if (contentType?.includes('text/html') && type !== 'buffer') {
                    console.log(`[LighthouseService] Encountered directory listing at ${gateway}, attempting to find file...`);
                    const text = await response.text();

                    // console.log('[LighthouseService] Directory HTML snippet:', text.slice(0, 500)); 

                    // Robust Regex to find links.
                    // Matches: <a ... href="VALUE" ... >
                    // We look for both " and ' quotes
                    const hrefRegex = /<a[^>]+href=(["'])(.*?)\1/g;
                    let match;

                    while ((match = hrefRegex.exec(text)) !== null) {
                        const rawHref = match[2];
                        let href = rawHref;

                        // Attempt to decode URL if it contains % (it likely does for encoded params)
                        try {
                            href = decodeURIComponent(rawHref);
                        } catch (e) {
                            // ignore
                        }

                        // Ignore parent directory links and hash links
                        if (href === '..' || href.endsWith('/..') || href.startsWith('#')) continue;
                        if (href.includes('Parent Directory')) continue;

                        // If it's a directory link (often ends with /), we might need to drill down or ignore?
                        // Usually commit files are just files.

                        console.log(`[LighthouseService] Found candidate href: ${href} (raw: ${rawHref})`);

                        let fileUrl;
                        if (href.startsWith('http')) {
                            fileUrl = href;
                        } else if (href.startsWith('/ipfs/')) {
                            // Absolute path on gateway (e.g. /ipfs/Qm.../file)
                            const origin = new URL(gateway).origin;
                            fileUrl = `${origin}${href}`;
                        } else {
                            // Relative path
                            // We use the rawHref here because it's already encoded for URL usage, OR we encode it?
                            // Browsers expect valid URL chars. If rawHref is "foo%20bar", that's good.
                            // If rawHref is "foo bar" (unlikely in HTML href), we need to encode.
                            // But usually HTML hrefs are percent-encoded. 
                            // SAFEST: Use new URL() with base.

                            // NOTE: Gateway URLs might already include path, so simple string concat is risky if not careful.
                            // ${gateway}/${cleanCid}/ is the base.
                            // We should use the unmodified rawHref from the HTML to be safe, as the gateway generated it.
                            fileUrl = `${gateway}/${cleanCid}/${rawHref}`;
                        }

                        console.log(`[LighthouseService] Trying file URL: ${fileUrl}`);
                        try {
                            const subResponse = await fetch(fileUrl);
                            if (subResponse.ok) {
                                if (type === 'json') return await subResponse.json();
                                if (type === 'text') return await subResponse.text();
                            } else {
                                console.warn(`[LighthouseService] Failed to fetch file ${fileUrl}: ${subResponse.status}`);
                            }
                        } catch (err) {
                            console.warn(`[LighthouseService] Error fetching file ${fileUrl}:`, err);
                        }
                    }
                    console.warn(`[LighthouseService] Failed to find valid file in directory listing from ${gateway}`);
                    continue;
                }

                if (type === 'json') return await response.json();
                if (type === 'text') return await response.text();
                if (type === 'buffer') {
                    const buffer = await response.arrayBuffer();
                    return new Uint8Array(buffer);
                }

            } catch (error) {
                console.error(`[LighthouseService] Error fetching from ${gateway}:`, error);
                // Continue to next gateway
            }
        }
        return null;
    },

    /**
     * Download content from IPFS as JSON
     */
    async downloadJSON<T>(cid: string): Promise<T | null> {
        return this.fetchWithFallback(cid, 'json');
    },

    /**
     * Download content from IPFS as raw buffer (Uint8Array)
     */
    async downloadBuffer(cid: string): Promise<Uint8Array | null> {
        return this.fetchWithFallback(cid, 'buffer');
    },

    /**
     * Download content from IPFS as Text
     */
    async downloadText(cid: string): Promise<string | null> {
        return this.fetchWithFallback(cid, 'text');
    },

    /**
     * Get public IPFS gateway URL for a CID (default gateway)
     */
    getGatewayUrl(cid: string): string {
        const cleanCid = cid.replace('ipfs://', '');
        return `${LIGHTHOUSE_GATEWAY}/${cleanCid}`;
    }
};
