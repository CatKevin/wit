import { colors } from '../lib/ui';
import { pinCidWithLighthouse, resolveLighthouseApiKey, resolveLighthousePinUrl } from '../lib/lighthouse';

type PinOptions = {
  pinUrl?: string;
  retries?: string | number;
  retryDelay?: string | number;
  timeout?: string | number;
};

export async function lighthousePinAction(cid: string, opts: PinOptions): Promise<void> {
  try {
    if (!cid) {
      printError('CID is required. Usage: wit lighthouse-pin <cid>');
      return;
    }
    const apiKey = resolveLighthouseApiKey();
    if (!apiKey) {
      printError('Missing LIGHTHOUSE_API_KEY. Set it in .env, ~/.witconfig, or export it before running this command.');
      return;
    }

    const pinUrl = opts.pinUrl || resolveLighthousePinUrl() || undefined;
    const retries = parseOptionalNumber(opts.retries, 3);
    const retryDelay = parseOptionalNumber(opts.retryDelay, 1000);
    const timeout = parseOptionalNumber(opts.timeout, 30_000);
    const totalAttempts = retries + 1;

    const result = await pinCidWithLighthouse(cid, {
      apiKey,
      pinUrl,
      retries,
      retryDelayMs: retryDelay,
      timeoutMs: timeout,
      onRetry: (attempt, err, delayMs) => {
        const message = err?.message || String(err);
        // eslint-disable-next-line no-console
        console.warn(
          colors.yellow(
            `Pin attempt ${attempt}/${totalAttempts} failed: ${message}. Retrying in ${delayMs}ms...`,
          ),
        );
      },
    });

    // eslint-disable-next-line no-console
    console.log(colors.green('Pinned on Lighthouse.'));
    // eslint-disable-next-line no-console
    console.log(`  cid:     ${colors.hash(result.cid)}`);
    // eslint-disable-next-line no-console
    console.log(`  pin url: ${result.pinUrl}`);
  } catch (err) {
    printError(errorMessage(err));
  }
}

function parseOptionalNumber(value: string | number | undefined, fallback: number): number {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'number') return Number.isNaN(value) ? fallback : value;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
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
