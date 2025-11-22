import chalk from 'chalk';

let enabled = isColorDefaultOn();
let chalkInstance: any = new (chalk as any).Instance({level: enabled ? 3 : 0});

function isColorDefaultOn(): boolean {
  return (
    process.env.WIT_NO_COLOR === undefined &&
    process.env.NO_COLOR === undefined &&
    (process.env.FORCE_COLOR === undefined || process.env.FORCE_COLOR !== '0')
  );
}

function updateInstance() {
  chalkInstance = new (chalk as any).Instance({level: enabled ? 3 : 0});
}

const wrap = (style: (c: any) => any) => (text: string) => style(chalkInstance)(text);

export function setColorsEnabled(flag: boolean): void {
  enabled = flag;
  updateInstance();
}

export function colorsEnabled(): boolean {
  return enabled;
}

// Access to the underlying chalk instance (for chainable styles if needed)
export function theme() {
  return chalkInstance;
}

export const colors = {
  red: wrap((c) => c.red),
  green: wrap((c) => c.green),
  yellow: wrap((c) => c.yellow),
  blue: wrap((c) => c.blue),
  cyan: wrap((c) => c.cyan),
  gray: wrap((c) => c.gray),
  bold: wrap((c) => c.bold),
  header: wrap((c) => c.bold.white),
  commit: wrap((c) => c.yellow),
  author: wrap((c) => c.blue),
  date: wrap((c) => c.green),
  hash: wrap((c) => c.yellow),
  added: wrap((c) => c.green),
  deleted: wrap((c) => c.red),
  modified: wrap((c) => c.red),
  staged: wrap((c) => c.green),
  untracked: wrap((c) => c.red),
};
