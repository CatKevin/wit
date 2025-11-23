import { SuiClient } from '@mysten/sui/client';
import { loadSigner, checkResources } from '../lib/keys';
import { resolveWalrusConfig } from '../lib/walrus';
import { transferOwnership } from '../lib/suiRepo';
import { requireWitDir, readRepoConfig, writeRepoConfig } from '../lib/repo';
import { colors } from '../lib/ui';

export async function transferAction(newOwner: string): Promise<void> {
    const witPath = await requireWitDir();
    const repoCfg = await readRepoConfig(witPath);

    if (!repoCfg.repo_id) {
        throw new Error('Repository not initialized on chain. Run `wit push` first.');
    }

    const signer = await loadSigner();
    const address = signer.address;

    // Basic validation
    if (!newOwner.startsWith('0x')) {
        throw new Error('Invalid address format. Must start with 0x.');
    }

    console.log(colors.header(`Transferring ownership of ${repoCfg.repo_id} to ${newOwner}...`));

    const res = await checkResources(address);
    if (res.hasMinSui === false) {
        throw new Error(`Insufficient SUI balance. Need at least ${res.minSui} MIST.`);
    }

    const config = await resolveWalrusConfig();
    const client = new SuiClient({ url: config.suiRpcUrl });

    try {
        await transferOwnership(client, signer.signer, {
            repoId: repoCfg.repo_id,
            newOwner,
        });

        console.log(colors.green('Ownership transferred successfully!'));
        console.log(colors.cyan(`You are now a collaborator. ${newOwner} is the new owner.`));

        // Update local config author just in case, though strictly not required as author != owner
        // But we might want to warn user if they try to do owner-only things later
    } catch (err: any) {
        console.error(colors.red(`Transfer failed: ${err.message}`));
        if (err.message.includes('ENotAuthorized')) {
            console.error(colors.yellow('Hint: Only the current owner can transfer ownership.'));
        }
        process.exit(1);
    }
}
