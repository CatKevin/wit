import fs from 'fs/promises';
import path from 'path';
import { colors } from '../lib/ui';
import { mapCarPaths, packCar, unpackCar } from '../lib/ipfsCar';

type PackOptions = {
  out?: string;
  wrap?: boolean;
  rootOut?: string;
};

type MapOptions = {
  out?: string;
  stripRoot?: boolean;
};

export async function carPackAction(input: string, opts: PackOptions): Promise<void> {
  try {
    if (!input) {
      printError('Input path is required. Usage: wit car-pack <input> --out <file.car>');
      return;
    }
    const absInput = path.resolve(input);
    const output = resolveOutputPath(absInput, opts.out);
    const result = await packCar(absInput, output, { wrap: opts.wrap !== false });

    if (opts.rootOut) {
      await fs.writeFile(path.resolve(opts.rootOut), `${result.root}\n`, 'utf8');
    }

    // eslint-disable-next-line no-console
    console.log(colors.green('CAR snapshot created.'));
    // eslint-disable-next-line no-console
    console.log(`  root: ${colors.hash(result.root)}`);
    // eslint-disable-next-line no-console
    console.log(`  output: ${result.output}`);
  } catch (err) {
    printError(errorMessage(err));
  }
}

export async function carUnpackAction(carFile: string, outDir: string): Promise<void> {
  try {
    if (!carFile || !outDir) {
      printError('CAR file and output directory are required. Usage: wit car-unpack <file.car> <out_dir>');
      return;
    }
    await unpackCar(carFile, outDir);
    // eslint-disable-next-line no-console
    console.log(colors.green('CAR snapshot unpacked.'));
    // eslint-disable-next-line no-console
    console.log(`  input: ${path.resolve(carFile)}`);
    // eslint-disable-next-line no-console
    console.log(`  output: ${path.resolve(outDir)}`);
  } catch (err) {
    printError(errorMessage(err));
  }
}

export async function carMapAction(carFile: string, opts: MapOptions): Promise<void> {
  try {
    if (!carFile) {
      printError('CAR file is required. Usage: wit car-map <file.car> --out <path>');
      return;
    }
    const result = await mapCarPaths(carFile, { stripRoot: opts.stripRoot !== false });
    const payload = JSON.stringify(result.map, null, 2) + '\n';
    if (opts.out) {
      const outPath = path.resolve(opts.out);
      await fs.writeFile(outPath, payload, 'utf8');
      // eslint-disable-next-line no-console
      console.log(colors.green('CAR path map written.'));
      // eslint-disable-next-line no-console
      console.log(`  root: ${colors.hash(result.root)}`);
      // eslint-disable-next-line no-console
      console.log(`  output: ${outPath}`);
      // eslint-disable-next-line no-console
      console.log(`  entries: ${Object.keys(result.map).length}`);
    } else {
      // eslint-disable-next-line no-console
      console.log(payload.trimEnd());
    }
  } catch (err) {
    printError(errorMessage(err));
  }
}

function resolveOutputPath(input: string, out?: string): string {
  if (out) return path.resolve(out);
  const base = path.basename(input === '.' ? process.cwd() : input);
  return path.resolve(`${base}.car`);
}

function printError(message: string): void {
  // eslint-disable-next-line no-console
  console.error(colors.red(message));
  process.exitCode = 1;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return String(err);
}
