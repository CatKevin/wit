import {Command} from 'commander';
import {initAction} from './init';
import {commitAction, logAction} from './commit';
import {checkoutAction} from './checkout';
import {diffAction} from './diff';
import {makeStubAction} from './stub';
import {addAction, resetAction, statusAction} from './workspace';
import {colorsEnabled, setColorsEnabled} from '../lib/ui';
import {accountListAction, accountUseAction} from './account';

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
    .action((paths: string[], opts: {staged?: boolean}) => {
      if (opts.staged) {
        return resetAction(paths, {staged: true});
      }
      return resetAction(paths, {staged: false});
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
    .action(makeStubAction('push'));

  program
    .command('clone <repo_id>')
    .description('Clone a wit repository from Sui/Walrus')
    .action(makeStubAction('clone'));

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
    .action(makeStubAction('fetch'));

  program
    .command('invite <address>')
    .description('Manage Seal collaborator policies (future stage)')
    .action(makeStubAction('invite'));

  program
    .command('push-blob <path>')
    .description('Upload a single blob or quilt for experimentation')
    .action(makeStubAction('push-blob'));

  const account = program.command('account').description('Manage wit accounts (keys, active address)');
  account.command('list').description('List locally stored accounts (keys) and show active').action(accountListAction);
  account.command('use <address>').description('Set active account address (updates ~/.witconfig, author if unknown)').action(accountUseAction);

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
