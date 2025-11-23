import { SuiClient } from '@mysten/sui/client';
import { loadSigner, checkResources } from '../lib/keys';
import { resolveWalrusConfig } from '../lib/walrus';
import { removeCollaborator } from '../lib/suiRepo';
import { requireWitDir, readRepoConfig } from '../lib/repo';
import { colors } from '../lib/ui';

export async function removeUserAction(addressToRemove: string): Promise<void> {
    const witPath = await requireWitDir();
    const repoCfg = await readRepoConfig(witPath);

    if (!repoCfg.repo_id) {
        throw new Error('Repository not initialized on chain. Run `wit push` first.');
    }

    const signer = await loadSigner();
    const address = signer.address;

    // Basic validation
    if (!addressToRemove.startsWith('0x')) {
        throw new Error('Invalid address format. Must start with 0x.');
    }

    console.log(colors.header(`Removing collaborator ${addressToRemove} from ${repoCfg.repo_id}...`));

    const res = await checkResources(address);
    if (res.hasMinSui === false) {
        throw new Error(`Insufficient SUI balance. Need at least ${res.minSui} MIST.`);
    }

    const config = await resolveWalrusConfig();
    const client = new SuiClient({ url: config.suiRpcUrl });

    try {
        await removeCollaborator(client, signer.signer, {
            repoId: repoCfg.repo_id,
            collaborator: addressToRemove,
        });

        console.log(colors.green(`Collaborator ${addressToRemove} removed successfully.`));
    } catch (err: any) {
        console.error(colors.red(`Removal failed: ${err.message}`));
        if (err.message.includes('ENotAuthorized')) {
            console.error(colors.yellow('Hint: Only the owner can remove collaborators.'));
        }
        process.exit(1);
    }
}
