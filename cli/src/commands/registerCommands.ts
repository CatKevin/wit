import {Command} from 'commander';
import {makeStubAction} from './stub';

export function registerCommands(program: Command): void {
  program
    .command('init [name]')
    .description('Initialize a wit repository (creates .wit, config, ignores)')
    .action(makeStubAction('init'));

  program
    .command('status')
    .description('Show workspace vs index status')
    .action(makeStubAction('status'));

  program
    .command('add <file...>')
    .description('Add file(s) to the wit index')
    .action(makeStubAction('add'));

  program
    .command('commit')
    .option('-m, --message <message>', 'commit message')
    .description('Create a local commit (single-branch)')
    .action(makeStubAction('commit'));

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
    .action(makeStubAction('diff'));

  program
    .command('log')
    .description('Show commit history (local, single-branch)')
    .action(makeStubAction('log'));

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
}
