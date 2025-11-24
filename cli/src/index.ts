#!/usr/bin/env node
import { Command } from 'commander';
import { registerCommands } from './commands/registerCommands';
import pkg from '../package.json';

// Polyfill for toReversed (Node < 20)
if (!Array.prototype.toReversed) {
  // eslint-disable-next-line no-extend-native
  Array.prototype.toReversed = function <T>(this: T[]): T[] {
    return [...this].reverse();
  };
}

const VERSION = pkg.version || '0.0.0';

export async function run(argv = process.argv): Promise<void> {
  const program = new Command();
  program
    .name('wit')
    .description('wit CLI: single-branch, verifiable, optionally encrypted repo tool backed by Walrus + Sui')
    .version(VERSION);

  registerCommands(program);
  const normalized = normalizeArgs(argv.slice());
  await program.parseAsync(normalized);
}

if (require.main === module) {
  run().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exitCode = 1;
  });
}

function normalizeArgs(argv: string[]): string[] {
  const args = [...argv];
  const idx = args.findIndex((a) => a === 'checkout');
  if (idx > -1 && args.length > idx + 1) {
    const next = args[idx + 1];
    if (next && next.startsWith('-') && next !== '--') {
      args.splice(idx + 1, 0, '--');
    }
  }
  return args;
}
