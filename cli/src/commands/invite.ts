import { SuiClient } from '@mysten/sui/client';
import { colors } from '../lib/ui';
import { requireWitDir, readRepoConfig, writeRepoConfig } from '../lib/repo';
import { resolveWalrusConfig } from '../lib/walrus';
import { loadSigner } from '../lib/keys';
import { addCollaborator, fetchRepositoryState } from '../lib/suiRepo';

export async function inviteAction(address: string): Promise<void> {
  if (!address) {
    throw new Error('Usage: wit invite <address>');
  }
  // eslint-disable-next-line no-console
  console.log(colors.header('Adding collaborator...'));
  let witPath: string;
  try {
    witPath = await requireWitDir();
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.log(colors.red(err?.message || 'Not a wit repository. Run `wit init` first.'));
    return;
  }
  const repoCfg = await readRepoConfig(witPath);
  if (!repoCfg.repo_id) {
    throw new Error('Missing repo_id. Run `wit push` once to create the remote repository.');
  }

  const signerInfo = await loadSigner();
  const resolved = await resolveWalrusConfig(process.cwd());
  const suiClient = new SuiClient({ url: resolved.suiRpcUrl });

  // Check if repo is private by fetching on-chain state
  // We could rely on local config, but on-chain is truth.
  let whitelistId: string | undefined;
  try {
    const state = await fetchRepositoryState(suiClient, repoCfg.repo_id);
    if (state.sealPolicyId) {
      whitelistId = state.sealPolicyId;
      // Update local config if missing
      if (repoCfg.seal_policy_id !== whitelistId) {
        repoCfg.seal_policy_id = whitelistId;
        await writeRepoConfig(witPath, repoCfg);
      }
    }
  } catch (err) {
    // ignore fetch error, assume public or will fail later
  }

  try {
    await addCollaborator(suiClient, signerInfo.signer, {
      repoId: repoCfg.repo_id,
      collaborator: address,
      whitelistId
    });
    // eslint-disable-next-line no-console
    console.log(colors.green(`Added ${colors.hash(address)} as collaborator.`));
    if (whitelistId) {
      // eslint-disable-next-line no-console
      console.log(colors.cyan(`User added to Whitelist (${whitelistId}). They can now decrypt the repository.`));
    }
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (msg.includes('ENotAuthorized') || msg.includes('NotAuthorized')) {
      // eslint-disable-next-line no-console
      console.log(colors.red('Add failed: current account is not authorized (owner or collaborator required).'));
      return;
    }
    // eslint-disable-next-line no-console
    console.log(colors.red(`Add collaborator failed: ${msg}`));
  }
}
