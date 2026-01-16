
// Obfuscated keys
const _LIGHTHOUSE_API_KEY_ENCODED = 'YWNhNmRjMzUuM2VkOGJkODBjNTc3NDBiNTk0ZjFjOWQ1YjdiMmQ1OGY=';
const _LIT_PLATFORM_PRIVATE_KEY_ENCODED = 'MHg2ZmQwYmIyOGYzODRiM2EwYjE1YjE3YzNmMTUzNmI2NTZhZWM5MDgxYjJjNTBkZDFiZmQyMmFlYmY0ZjllMTZl';

function decode(encoded: string): string {
    return Buffer.from(encoded, 'base64').toString('utf-8');
}

export const LIGHTHOUSE_API_KEY = decode(_LIGHTHOUSE_API_KEY_ENCODED);

// Platform Wallet for Lit Protocol Capacity Credits (Datil-Test)
// Address: 0x38eF8Ca6ba8C911C77faf8D74c86a3a0BC7f72a2
export const LIT_PLATFORM_PRIVATE_KEY = decode(_LIT_PLATFORM_PRIVATE_KEY_ENCODED);
