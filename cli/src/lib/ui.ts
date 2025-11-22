import chalk from 'chalk';

export const colors = {
    red: chalk.red,
    green: chalk.green,
    yellow: chalk.yellow,
    blue: chalk.blue,
    cyan: chalk.cyan,
    gray: chalk.gray,
    bold: chalk.bold,
    header: chalk.bold.white,
    commit: chalk.yellow,
    author: chalk.blue,
    date: chalk.green,
    hash: chalk.yellow,
    added: chalk.green,
    deleted: chalk.red,
    modified: chalk.red, // worktree modified
    staged: chalk.green, // index modified
    untracked: chalk.red,
};
