import fs from 'fs/promises';
import path from 'path';
import { colors } from '../lib/ui';
import { downloadFromLighthouseGateway, resolveLighthouseGatewayUrl } from '../lib/lighthouse';

type DownloadOptions = {
  out?: string;
  car?: boolean;
  verify?: boolean;
  retries?: number;
  timeout?: number;
  retryDelay?: number;
  gateway?: string;
};

export async function lighthouseDownloadAction(cid: string, opts: DownloadOptions): Promise<void> {
  try {
    if (!cid) {
      printError('CID is required. Usage: wit lighthouse-download <cid> --out <path>');
      return;
    }

    const format = opts.car ? 'car' : 'raw';
    const output = resolveOutputPath(cid, format, opts.out);
    const gateway = opts.gateway || resolveLighthouseGatewayUrl();

    const result = await downloadFromLighthouseGateway(cid, {
      format,
      verify: opts.verify !== false,
      retries: opts.retries,
      retryDelayMs: opts.retryDelay,
      timeoutMs: opts.timeout,
      gatewayUrl: gateway,
    });

    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, result.bytes);

    // eslint-disable-next-line no-console
    console.log(colors.green('Downloaded from Lighthouse.'));
    // eslint-disable-next-line no-console
    console.log(`  cid:     ${colors.hash(cid)}`);
    // eslint-disable-next-line no-console
    console.log(`  gateway: ${result.gateway}`);
    // eslint-disable-next-line no-console
    console.log(`  output:  ${output}`);
  } catch (err) {
    printError(errorMessage(err));
  }
}

function resolveOutputPath(cid: string, format: 'raw' | 'car', out?: string): string {
  if (out) return path.resolve(out);
  const suffix = format === 'car' ? '.car' : '';
  return path.resolve(`${cid}${suffix}`);
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
