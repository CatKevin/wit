import { SuiClient } from '@mysten/sui/client';
import { loadSigner, checkResources } from '../lib/keys';
import { resolveWalrusConfig } from '../lib/walrus';
import { addCollaborator, fetchRepositoryState } from '../lib/suiRepo';
import { EvmRepoService } from '../lib/evmRepo';
import { loadMantleSigner } from '../lib/evmProvider';
import { readRepoConfig, requireWitDir } from '../lib/repo';
import { colors } from '../lib/ui';

export async function inviteAction(address: string, options: { repo?: string; sealPolicy?: string; sealSecret?: string }) {
  try {
    const witPath = await requireWitDir();
    const repoCfg = await readRepoConfig(witPath);

    if (repoCfg.chain !== 'mantle') {
      // SUI Logic (Default)
      return inviteActionSui(address, options, repoCfg);
    }

    // Mantle Logic
    let repoIdStr = options.repo || repoCfg.repo_id;

    if (!repoIdStr) {
      // eslint-disable-next-line no-console
      console.error(colors.red('Error: Repository ID is required. Run inside a wit repo or use --repo <id>.'));
      process.exit(1);
    }

    if (repoCfg.isPrivate === false) {
      console.log(colors.yellow('Warning: This repository is public. Collaborators are not needed for read access (but may be needed for write access).'));
    }

    if (repoIdStr.startsWith('mantle:')) {
      repoIdStr = repoIdStr.split(':').pop()!;
    }

    const repoId = BigInt(repoIdStr!);

    // 2. Connect to Mantle
    const signerCtx = await loadMantleSigner();
    const repoService = new EvmRepoService(signerCtx);

    // 3. Add Collaborator
    await repoService.addCollaborator(repoId, address);

  } catch (err: any) {
    console.error(colors.red(`Command failed: ${err.message}`));
    process.exit(1);
  }
}

async function inviteActionSui(address: string, options: { sealPolicy?: string; sealSecret?: string }, repoCfg: any) {
  if (!repoCfg.repo_id) {
    throw new Error('Repository not initialized on chain. Run `wit push` first.');
  }

  const signer = await loadSigner();
  const signerAddr = signer.address;

  console.log(colors.header(`Adding collaborator ${address} to ${repoCfg.repo_id}...`));

  const res = await checkResources(signerAddr);
  if (res.hasMinSui === false) {
    throw new Error(`Insufficient SUI balance. Need at least ${res.minSui} MIST.`);
  }

  const config = await resolveWalrusConfig();
  const client = new SuiClient({ url: config.suiRpcUrl });

  let whitelistId: string | undefined;
  // Attempt to auto-detect if private
  if (repoCfg.seal_policy_id) {
    whitelistId = repoCfg.seal_policy_id;
  } else {
    try {
      const state = await fetchRepositoryState(client, repoCfg.repo_id);
      if (state.sealPolicyId) {
        whitelistId = state.sealPolicyId;
      }
    } catch (err) {
      // ignore
    }
  }

  // Allow override
  if (options.sealPolicy) {
    whitelistId = options.sealPolicy;
  }

  await addCollaborator(client, signer.signer, {
    repoId: repoCfg.repo_id,
    collaborator: address,
    whitelistId
  });

  console.log(colors.green(`Collaborator ${address} added successfully.`));
  if (whitelistId) {
    console.log(colors.gray(`(Added to private whitelist ${whitelistId})`));
  }
}
