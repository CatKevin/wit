import {Command} from 'commander';
import {registerCommands} from './commands/registerCommands';

const VERSION = '0.1.0-dev';

export async function run(argv = process.argv): Promise<void> {
  const program = new Command();
  program
    .name('wit')
    .description('wit CLI: single-branch, verifiable, optionally encrypted repo tool backed by Walrus + Sui')
    .version(VERSION);

  registerCommands(program);
  await program.parseAsync(argv);
}

if (require.main === module) {
  run().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exitCode = 1;
  });
}
