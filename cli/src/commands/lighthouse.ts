import path from 'path';
import { colors } from '../lib/ui';
import { resolveLighthouseApiKey, uploadFileToLighthouse } from '../lib/lighthouse';

type UploadOptions = {
  cidVersion?: string | number;
  progress?: boolean;
};

export async function lighthouseUploadAction(filePath: string, opts: UploadOptions): Promise<void> {
  try {
    if (!filePath) {
      printError('File path is required. Usage: wit lighthouse-upload <file>');
      return;
    }
    const apiKey = resolveLighthouseApiKey();
    if (!apiKey) {
      printError('Missing LIGHTHOUSE_API_KEY. Set it in .env or export it before running this command.');
      return;
    }

    const cidVersion = parseCidVersion(opts.cidVersion);
    const absPath = path.resolve(filePath);
    const progress = opts.progress ? createProgressReporter() : undefined;

    const result = await uploadFileToLighthouse(absPath, { apiKey, cidVersion, onProgress: progress });
    if (progress) progress(100);

    // eslint-disable-next-line no-console
    console.log(colors.green('Uploaded to Lighthouse.'));
    // eslint-disable-next-line no-console
    console.log(`  cid:  ${colors.hash(result.cid)}`);
    // eslint-disable-next-line no-console
    console.log(`  name: ${result.name ?? path.basename(absPath)}`);
    if (result.size) {
      // eslint-disable-next-line no-console
      console.log(`  size: ${result.size}`);
    }
  } catch (err) {
    printError(errorMessage(err));
  }
}

function parseCidVersion(value?: string | number): number {
  if (value === undefined || value === null) return 1;
  if (typeof value === 'number') return Number.isNaN(value) ? 1 : value;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? 1 : parsed;
}

function createProgressReporter(): (progress: number) => void {
  let last = -1;
  return (progress: number) => {
    const value = Math.max(0, Math.min(100, Math.round(progress)));
    if (value === last) return;
    last = value;
    // eslint-disable-next-line no-console
    process.stdout.write(`\rUploading... ${value}%`);
    if (value === 100) {
      // eslint-disable-next-line no-console
      process.stdout.write('\n');
    }
  };
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
