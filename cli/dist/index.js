"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = run;
const commander_1 = require("commander");
const registerCommands_1 = require("./commands/registerCommands");
const VERSION = '0.1.0-dev';
async function run(argv = process.argv) {
    const program = new commander_1.Command();
    program
        .name('wit')
        .description('wit CLI: single-branch, verifiable, optionally encrypted repo tool backed by Walrus + Sui')
        .version(VERSION);
    (0, registerCommands_1.registerCommands)(program);
    await program.parseAsync(argv);
}
if (require.main === module) {
    run().catch((err) => {
        // eslint-disable-next-line no-console
        console.error(err);
        process.exitCode = 1;
    });
}
