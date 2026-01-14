
import { LitNodeClient } from '@lit-protocol/lit-node-client';
import crypto from 'crypto';

// Polyfill for Lit SDK in Node.js environment
if (!globalThis.crypto) {
    globalThis.crypto = crypto as any;
}


async function main() {
    console.log('Inspecting LitNodeClient...');
    const client = new LitNodeClient({
        litNetwork: 'datil-test',
        debug: false
    });

    console.log('LitNodeClient instance created.');

    // Check if encrypt method exists
    if (typeof (client as any).encrypt === 'function') {
        console.log('encrypt method EXISTS.');
    } else {
        console.log('encrypt method DOES NOT EXIST.');
    }

    try {
        console.log('Attempting to connect...');
        await client.connect();
        console.log('Connected to Lit.');

        console.log('Testing encryption...');
        const sessionKey = Buffer.from('12345678901234567890123456789012'); // 32 bytes
        const acc = [
            {
                contractAddress: '',
                standardContractType: '',
                chain: 'ethereum',
                method: '',
                parameters: [],
                returnValueTest: {
                    comparator: '=',
                    value: 'true',
                },
                conditionType: 'evmBasic', // Use simple condition for test
            },
        ];

        // Try encrypting
        try {
            const res = await (client as any).encrypt({
                dataToEncrypt: sessionKey,
                accessControlConditions: acc,
            });
            console.log('Encryption successful!');
            console.log('Ciphertext:', res.ciphertext);
            console.log('Hash:', res.dataToEncryptHash);
        } catch (encErr) {
            console.error('Encryption FAILED:', (encErr as any).message);
            // console.error(encErr);
        }

    } catch (e) {
        console.log('Connection failed:', (e as any).message);
    }
}

main().catch(err => console.error(err));
