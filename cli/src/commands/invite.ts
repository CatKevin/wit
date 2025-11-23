import {SuiClient} from '@mysten/sui/client';
import {colors} from '../lib/ui';
import {requireWitDir, readRepoConfig} from '../lib/repo';
import {resolveWalrusConfig} from '../lib/walrus';
import {loadSigner} from '../lib/keys';
import {addCollaborator} from '../lib/suiRepo';

export async function inviteAction(address: string): Promise<void> {
  if (!address) {
    throw new Error('Usage: wit invite <address>');
  }
  // eslint-disable-next-line no-console
  console.log(colors.header('Adding collaborator...'));
  const witPath = await requireWitDir();
  const repoCfg = await readRepoConfig(witPath);
  if (!repoCfg.repo_id) {
    throw new Error('Missing repo_id. Run `wit push` once to create the remote repository.');
  }

  const signerInfo = await loadSigner();
  const resolved = await resolveWalrusConfig(process.cwd());
  const suiClient = new SuiClient({url: resolved.suiRpcUrl});

  try {
    await addCollaborator(suiClient, signerInfo.signer, {repoId: repoCfg.repo_id, collaborator: address});
    // eslint-disable-next-line no-console
    console.log(colors.green(`Added ${colors.hash(address)} as collaborator.`));
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
