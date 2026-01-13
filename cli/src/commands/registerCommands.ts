import { Command } from 'commander';
import { initAction } from './init';
import { commitAction, logAction } from './commit';
import { checkoutAction } from './checkout';
import { diffAction } from './diff';
import { makeStubAction } from './stub';
import { addAction, resetAction, statusAction } from './workspace';
import { pushAction } from './push';
import { cloneAction } from './clone';
import { fetchAction } from './fetch';
import { pullAction } from './pull';
import { inviteAction } from './invite';
import { colors, colorsEnabled, setColorsEnabled } from '../lib/ui';
import { accountBalanceAction, accountGenerateAction, accountImportAction, accountListAction, accountUseAction } from './account';
import { pushBlobAction, pullBlobAction } from './walrusBlob';
import {
  pushQuiltAction,
  pullQuiltAction,
  pushQuiltLegacyAction,
  pullQuiltLegacyAction,
  listQuiltIdentifiersCommand,
  catQuiltFileById,
} from './walrusQuilt';
import { listAction } from './list';
import { transferAction } from './transfer';
import { removeUserAction } from './removeUser';
import { chainCurrentAction, chainListAction, chainUseAction } from './chain';
import { formatChainMismatchMessage } from '../lib/chain';
import { getRepoChainMismatch, readRepoConfig, requireWitDir } from '../lib/repo';
import { carMapAction, carPackAction, carUnpackAction } from './ipfsCar';
import { lighthouseUploadAction } from './lighthouse';
import { lighthouseDownloadAction } from './lighthouseDownload';
import { lighthousePinAction } from './lighthousePin';

function shouldSkipChainCheck(cmd: Command): boolean {
  const parent = cmd.parent;
  if (!parent) return false;
  if (parent.name() !== 'chain') return false;
  const name = cmd.name();
  return name === 'list' || name === 'use' || name === 'current';
}

async function enforceRepoChain(cmd: Command): Promise<void> {
  if (shouldSkipChainCheck(cmd)) return;
  let witPath: string;
  try {
    witPath = await requireWitDir();
  } catch (err: any) {
    if (err?.message?.includes('Not a wit repository')) return;
    throw err;
  }
  let repoCfg;
  try {
    repoCfg = await readRepoConfig(witPath);
  } catch (err: any) {
    if (err?.code === 'ENOENT') return;
    throw err;
  }
  const mismatch = await getRepoChainMismatch(repoCfg);
  if (!mismatch) return;
  if ('error' in mismatch) {
    // eslint-disable-next-line no-console
    console.error(colors.red(mismatch.error));
    process.exit(1);
  }
  // eslint-disable-next-line no-console
  console.error(colors.red(formatChainMismatchMessage(mismatch.repoChain, mismatch.activeChain)));
  process.exit(1);
}

export function registerCommands(program: Command): void {
  // Global options (propagate to subcommands)
  program.option('--color', 'force color output').option('--no-color', 'disable color output');

  program
    .command('init [name]')
    .description('Initialize a wit repository (creates .wit, config, ignores)')
    .option('--private', 'Initialize as private repository (generate seal policy + secret)')
    .option('--seal-policy <id>', 'Use existing seal policy id for private repo')
    .option('--seal-secret <secret>', 'Explicit seal secret (otherwise auto-generated/stored)')
    .action((name: string, opts: { private?: boolean; sealPolicy?: string; sealSecret?: string }) =>
      initAction(name, { private: opts.private, sealPolicy: opts.sealPolicy, sealSecret: opts.sealSecret })
    );

  program
    .command('status')
    .description('Show workspace vs index status')
    .action(statusAction);

  program
    .command('add [paths...]')
    .option('-A, --all', 'add all changes (equivalent to add .)')
    .description('Add file(s) to the wit index')
    .action(addAction);

  program
    .command('reset [paths...]')
    .option('-A, --all', 'unstage all entries from the wit index')
    .description('Reset index entries for paths (like git reset -- <paths>)')
    .action(resetAction);

  program
    .command('restore')
    .option('--staged', 'unstage paths from the index (alias of reset)')
    .argument('[paths...]')
    .description('Restore worktree files from index or unstage when using --staged')
    .action((paths: string[], opts: { staged?: boolean }) => {
      if (opts.staged) {
        return resetAction(paths, { staged: true });
      }
      return resetAction(paths, { staged: false });
    });

  program
    .command('commit')
    .option('-m, --message <message>', 'commit message')
    .description('Create a local commit (single-branch)')
    .action(commitAction);

  program
    .command('checkout <commit_id>')
    .description('Checkout a commit snapshot to the worktree (updates index and HEAD ref)')
    .action(async (commitId: string) => {
      await checkoutAction(commitId);
    });

  program
    .command('push')
    .description('Upload manifest/quilt/commit to Walrus and update Sui head')
    .action(pushAction);

  program
    .command('clone <repo_id>')
    .description('Clone a wit repository from Sui/Walrus')
    .action(cloneAction);

  program
    .command('diff')
    .option('--cached', 'compare against index instead of worktree')
    .description('Show diffs between worktree/index/commit')
    .action(diffAction);

  program
    .command('log')
    .description('Show commit history (local, single-branch)')
    .action(logAction);

  program
    .command('fetch')
    .description('Update remote mirror (head/manifest/commit) without changing worktree')
    .action(fetchAction);

  program
    .command('pull')
    .description('Fetch and fast-forward to remote head when possible')
    .action(pullAction);

  program
    .command('invite <address>')
    .description('Add a collaborator to the repository')
    .option('--seal-policy <id>', 'Seal policy id to apply (defaults to repo config)')
    .option('--seal-secret <secret>', 'Seal secret to save locally when setting policy')
    .action((address: string) => inviteAction(address));

  program
    .command('transfer <new_owner>')
    .description('Transfer repository ownership to a new address')
    .action(transferAction);

  program
    .command('remove-user <address>')
    .description('Remove a collaborator from the repository')
    .action(removeUserAction);

  program
    .command('push-blob <path>')
    .description('Upload a single blob to Walrus (hash-verified)')
    .option('--epochs <n>', 'epochs to store blob for (default 1)', (v) => parseInt(v, 10), 1)
    .option('--deletable', 'mark blob deletable (default true)', true)
    .action((pathArg: string, opts: { epochs: number; deletable?: boolean }) => pushBlobAction(pathArg, opts));

  program
    .command('pull-blob <blob_id> <out_path>')
    .description('Download a Walrus blob and verify hash')
    .action((blobId: string, outPath: string) => pullBlobAction(blobId, outPath));

  program
    .command('push-quilt <dir>')
    .description('Upload a directory as Walrus files (tags + hash), emits local manifest')
    .option('--epochs <n>', 'epochs to store quilt for (default 1)', (v) => parseInt(v, 10), 1)
    .option('--deletable', 'mark quilt deletable (default true)', true)
    .option('--manifest-out <path>', 'where to write manifest (default ./quilt-manifest.json)')
    .action((dir: string, opts: { epochs: number; deletable?: boolean; manifestOut?: string }) => pushQuiltAction(dir, opts));

  program
    .command('pull-quilt <manifest_path> <out_dir>')
    .description('Download files from Walrus using manifest produced by push-quilt (hash/root_hash verified)')
    .action((manifestPath: string, outDir: string) => pullQuiltAction(manifestPath, outDir));

  program
    .command('quilt-cat <manifest_path> <identifier>')
    .description('Fetch a single file from a quilt (by identifier) and print to stdout')
    .action(async (manifestPath: string, identifier: string) => {
      const { fetchQuiltFile } = await import('./walrusQuilt.js');
      const { bytes } = await fetchQuiltFile(manifestPath, identifier);
      process.stdout.write(Buffer.from(bytes));
    });

  program
    .command('quilt-ls <quilt_id>')
    .description('List identifiers inside a quilt (no manifest needed)')
    .action((quiltId: string) => listQuiltIdentifiersCommand(quiltId));

  program
    .command('quilt-cat-id <quilt_id> <identifier>')
    .description('Fetch a single file from a quilt by quilt_id + identifier (no manifest needed)')
    .action((quiltId: string, identifier: string) => catQuiltFileById(quiltId, identifier));

  program
    .command('push-quilt-legacy <dir>')
    .description('Upload directory as legacy archive (single blob with embedded manifest)')
    .option('--epochs <n>', 'epochs to store archive for (default 1)', (v) => parseInt(v, 10), 1)
    .option('--deletable', 'mark archive deletable (default true)', true)
    .action((dir: string, opts: { epochs: number; deletable?: boolean }) => pushQuiltLegacyAction(dir, opts));

  program
    .command('pull-quilt-legacy <blob_id> <out_dir>')
    .description('Download legacy archive and restore files (hash/root_hash verified)')
    .action((blobId: string, outDir: string) => pullQuiltLegacyAction(blobId, outDir));

  program
    .command('car-pack <input>')
    .description('Pack a directory or file into a CAR snapshot')
    .option('-o, --out <path>', 'output CAR file path')
    .option('--no-wrap', 'do not wrap input with a directory')
    .option('--root-out <path>', 'write root CID to a file')
    .action((input: string, opts: { out?: string; wrap?: boolean; rootOut?: string }) => carPackAction(input, opts));

  program
    .command('car-unpack <car_file> <out_dir>')
    .description('Unpack a CAR snapshot to a directory')
    .action((carFile: string, outDir: string) => carUnpackAction(carFile, outDir));

  program
    .command('car-map <car_file>')
    .description('Generate a path -> CID map from a CAR snapshot')
    .option('-o, --out <path>', 'output JSON path (prints to stdout if omitted)')
    .option('--no-strip-root', 'keep the top-level CAR root segment in paths')
    .action((carFile: string, opts: { out?: string; stripRoot?: boolean }) => carMapAction(carFile, opts));

  program
    .command('lighthouse-upload <file>')
    .description('Upload a file to Lighthouse and print CID')
    .option('--cid-version <n>', 'CID version (default 1)', (v) => parseInt(v, 10), 1)
    .option('--progress', 'show upload progress')
    .option('--retries <n>', 'retry attempts (default 3)', (v) => parseInt(v, 10), 3)
    .option('--retry-delay <ms>', 'base retry delay in ms (default 1000)', (v) => parseInt(v, 10), 1000)
    .action((file: string, opts: { cidVersion?: number; progress?: boolean; retries?: number; retryDelay?: number }) =>
      lighthouseUploadAction(file, opts));

  program
    .command('lighthouse-download <cid>')
    .description('Download a CID from Lighthouse gateway')
    .option('-o, --out <path>', 'output file path (defaults to <cid>[.car])')
    .option('--car', 'download as CAR (format=car)')
    .option('--no-verify', 'disable CID verification (default true)')
    .option('--retries <n>', 'retry attempts (default 3)', (v) => parseInt(v, 10), 3)
    .option('--retry-delay <ms>', 'base retry delay in ms (default 500)', (v) => parseInt(v, 10), 500)
    .option('--timeout <ms>', 'request timeout in ms (default 30000)', (v) => parseInt(v, 10), 30_000)
    .option('--gateway <url>', 'override gateway URL')
    .action((cid: string, opts: { out?: string; car?: boolean; verify?: boolean; retries?: number; retryDelay?: number; timeout?: number; gateway?: string }) =>
      lighthouseDownloadAction(cid, opts));

  program
    .command('lighthouse-pin <cid>')
    .description('Pin a CID using Lighthouse API')
    .option('--pin-url <url>', 'override Lighthouse pin URL')
    .option('--retries <n>', 'retry attempts (default 3)', (v) => parseInt(v, 10), 3)
    .option('--retry-delay <ms>', 'base retry delay in ms (default 1000)', (v) => parseInt(v, 10), 1000)
    .option('--timeout <ms>', 'request timeout in ms (default 30000)', (v) => parseInt(v, 10), 30_000)
    .action((cid: string, opts: { pinUrl?: string; retries?: number; retryDelay?: number; timeout?: number }) =>
      lighthousePinAction(cid, opts));

  program
    .command('list')
    .description('List repositories you own or collaborate on')
    .option('--owned', 'Show only owned repositories')
    .option('--collaborated', 'Show only collaborated repositories')
    .action(listAction);

  const chain = program.command('chain').description('Manage active chain');
  chain.command('list').description('List supported chains').action(chainListAction);
  chain.command('use <chain>').description('Set active chain').action(chainUseAction);
  chain.command('current').description('Show active chain').action(chainCurrentAction);

  const account = program.command('account').description('Manage wit accounts (keys, active address)');
  account.command('list').description('List locally stored accounts (keys) and show active').action(accountListAction);
  account.command('use <address>').description('Set active account address (updates ~/.witconfig, author if unknown)').action(accountUseAction);
  account
    .command('generate')
    .option('--alias <name>', 'alias to record in key file (defaults to "default")')
    .description('Generate a new account (keypair), set as active, and update author if unknown')
    .action(accountGenerateAction);
  account
    .command('import <private_key>')
    .option('--alias <name>', 'alias to record in key file (defaults to "default")')
    .description('Import a private key for the active chain and set as active')
    .action((privateKey: string, opts: { alias?: string }) => accountImportAction(privateKey, opts));
  account
    .command('balance')
    .argument('[address]', 'Address to query (defaults to active)')
    .description('Show SUI/WAL balance for the address (defaults to active)')
    .action((address?: string) => accountBalanceAction(address));

  program.hook('preAction', async (cmd) => {
    const opts = (cmd as any).optsWithGlobals ? (cmd as any).optsWithGlobals() : program.opts();
    const envDefault =
      process.env.WIT_NO_COLOR === undefined &&
      process.env.NO_COLOR === undefined &&
      (process.env.FORCE_COLOR === undefined || process.env.FORCE_COLOR !== '0');
    const desired = opts.color ? true : opts.noColor ? false : envDefault;
    setColorsEnabled(desired);
    if (!desired && colorsEnabled()) {
      setColorsEnabled(false);
    }
    await enforceRepoChain(cmd);
  });
}
