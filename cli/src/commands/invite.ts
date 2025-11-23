import {SuiClient} from '@mysten/sui/client';
import {colors} from '../lib/ui';
import {requireWitDir, readRepoConfig, writeRepoConfig} from '../lib/repo';
import {resolveWalrusConfig} from '../lib/walrus';
import {loadSigner} from '../lib/keys';
import {addCollaborator, setSealPolicy} from '../lib/suiRepo';
import {ensureSealSecret} from '../lib/seal';

export async function inviteAction(address: string, opts?: {sealPolicy?: string; sealSecret?: string}): Promise<void> {
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
  let sealPolicyId = opts?.sealPolicy || repoCfg.seal_policy_id;
  if (opts?.sealPolicy && repoCfg.seal_policy_id !== opts.sealPolicy) {
    repoCfg.seal_policy_id = opts.sealPolicy;
    await writeRepoConfig(witPath, repoCfg);
  }

  const signerInfo = await loadSigner();
  const resolved = await resolveWalrusConfig(process.cwd());
  const suiClient = new SuiClient({url: resolved.suiRpcUrl});

  if (sealPolicyId) {
    try {
      await ensureSealSecret(sealPolicyId, {repoRoot: process.cwd(), secret: opts?.sealSecret, createIfMissing: true});
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.log(colors.red(`Seal secret missing: ${err?.message || err}`));
      return;
    }
  }

  try {
    await addCollaborator(suiClient, signerInfo.signer, {repoId: repoCfg.repo_id, collaborator: address});
    // eslint-disable-next-line no-console
    console.log(colors.green(`Added ${colors.hash(address)} as collaborator.`));
    if (sealPolicyId) {
      await setSealPolicy(suiClient, signerInfo.signer, {repoId: repoCfg.repo_id, policyId: sealPolicyId});
      // eslint-disable-next-line no-console
      console.log(colors.cyan(`Seal policy updated on-chain (${sealPolicyId}). Share the secret with the collaborator.`));
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
