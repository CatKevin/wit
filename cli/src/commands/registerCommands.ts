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
import { colorsEnabled, setColorsEnabled } from '../lib/ui';
import { accountBalanceAction, accountGenerateAction, accountListAction, accountUseAction } from './account';
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

export function registerCommands(program: Command): void {
  // Global options (propagate to subcommands)
  program.option('--color', 'force color output').option('--no-color', 'disable color output');

  program
    .command('init [name]')
    .description('Initialize a wit repository (creates .wit, config, ignores)')
    .action(initAction);

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
    .action(checkoutAction);

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
    .description('Manage Seal collaborator policies (future stage)')
    .action(inviteAction);

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
    .command('list')
    .description('List repositories you own or collaborate on')
    .option('--owned', 'Show only owned repositories')
    .option('--collaborated', 'Show only collaborated repositories')
    .action(listAction);

  const account = program.command('account').description('Manage wit accounts (keys, active address)');
  account.command('list').description('List locally stored accounts (keys) and show active').action(accountListAction);
  account.command('use <address>').description('Set active account address (updates ~/.witconfig, author if unknown)').action(accountUseAction);
  account
    .command('generate')
    .option('--alias <name>', 'alias to record in key file (defaults to "default")')
    .description('Generate a new account (keypair), set as active, and update author if unknown')
    .action(accountGenerateAction);
  account
    .command('balance')
    .argument('[address]', 'Address to query (defaults to active)')
    .description('Show SUI/WAL balance for the address (defaults to active)')
    .action((address?: string) => accountBalanceAction(address));

  program.hook('preAction', (cmd) => {
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
  });
}
