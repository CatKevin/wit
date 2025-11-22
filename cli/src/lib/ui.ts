import chalk from 'chalk';

let enabled =
  process.env.WIT_NO_COLOR === undefined &&
  process.env.NO_COLOR === undefined &&
  (process.env.FORCE_COLOR === undefined || process.env.FORCE_COLOR !== '0');

const wrap =
  (fn: (text: string) => string) =>
  (text: string) =>
    enabled ? fn(text) : text;

export function setColorsEnabled(flag: boolean): void {
  enabled = flag;
}

export function colorsEnabled(): boolean {
  return enabled;
}

export const colors = {
  red: wrap(chalk.red),
  green: wrap(chalk.green),
  yellow: wrap(chalk.yellow),
  blue: wrap(chalk.blue),
  cyan: wrap(chalk.cyan),
  gray: wrap(chalk.gray),
  bold: wrap(chalk.bold),
  header: wrap(chalk.bold.white),
  commit: wrap(chalk.yellow),
  author: wrap(chalk.blue),
  date: wrap(chalk.green),
  hash: wrap(chalk.yellow),
  added: wrap(chalk.green),
  deleted: wrap(chalk.red),
  modified: wrap(chalk.red),
  staged: wrap(chalk.green),
  untracked: wrap(chalk.red),
};
