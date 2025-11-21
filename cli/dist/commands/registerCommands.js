"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCommands = registerCommands;
const init_1 = require("./init");
const stub_1 = require("./stub");
function registerCommands(program) {
    program
        .command('init [name]')
        .description('Initialize a wit repository (creates .wit, config, ignores)')
        .action(init_1.initAction);
    program
        .command('status')
        .description('Show workspace vs index status')
        .action((0, stub_1.makeStubAction)('status'));
    program
        .command('add <file...>')
        .description('Add file(s) to the wit index')
        .action((0, stub_1.makeStubAction)('add'));
    program
        .command('commit')
        .option('-m, --message <message>', 'commit message')
        .description('Create a local commit (single-branch)')
        .action((0, stub_1.makeStubAction)('commit'));
    program
        .command('push')
        .description('Upload manifest/quilt/commit to Walrus and update Sui head')
        .action((0, stub_1.makeStubAction)('push'));
    program
        .command('clone <repo_id>')
        .description('Clone a wit repository from Sui/Walrus')
        .action((0, stub_1.makeStubAction)('clone'));
    program
        .command('diff')
        .option('--cached', 'compare against index instead of worktree')
        .description('Show diffs between worktree/index/commit')
        .action((0, stub_1.makeStubAction)('diff'));
    program
        .command('log')
        .description('Show commit history (local, single-branch)')
        .action((0, stub_1.makeStubAction)('log'));
    program
        .command('fetch')
        .description('Update remote mirror (head/manifest/commit) without changing worktree')
        .action((0, stub_1.makeStubAction)('fetch'));
    program
        .command('invite <address>')
        .description('Manage Seal collaborator policies (future stage)')
        .action((0, stub_1.makeStubAction)('invite'));
    program
        .command('push-blob <path>')
        .description('Upload a single blob or quilt for experimentation')
        .action((0, stub_1.makeStubAction)('push-blob'));
}
