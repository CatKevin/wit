import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { formatUnits } from 'ethers';
import { colors } from '../lib/ui';
import { readActiveChain, type ChainId } from '../lib/chain';
import {
  createSigner,
  checkResources,
  listStoredKeys,
  normalizeAddress,
  readActiveAddress,
  setActiveAddress,
} from '../lib/keys';
import {
  createEvmKey,
  importEvmKey,
  listEvmKeys,
  normalizeEvmAddress,
  readActiveEvmAddress,
  setActiveEvmAddress,
} from '../lib/evmKeys';
import { createMantleProvider, resolveEvmTxContext, resolveMantleConfig } from '../lib/evmProvider';
import { readRepoConfig, requireWitDir, setChainAuthor, writeRepoConfig } from '../lib/repo';

export async function accountListAction(): Promise<void> {
  try {
    const activeChain = await readActiveChain();
    if (activeChain === 'mantle') {
      const active = await readActiveEvmAddress();
      const keys = await listEvmKeys();
      if (!keys.length) {
        // eslint-disable-next-line no-console
        console.log('No keys found. Generate one with `wit account generate`.');
        return;
      }
      for (const key of keys) {
        const marker = active && key.address === active ? colors.green('*') : ' ';
        const alias = key.alias ? ` (${key.alias})` : '';
        const created = key.createdAt ? ` ${colors.gray(`[${key.createdAt}]`)}` : '';
        // eslint-disable-next-line no-console
        console.log(`${marker} ${colors.hash(key.address)}${alias}${created}`);
      }
    } else if (activeChain === 'sui') {
      const active = await readActiveAddress();
      const keys = await listStoredKeys();
      if (!keys.length) {
        // eslint-disable-next-line no-console
        console.log('No keys found. Generate one with `wit account generate`.');
        return;
      }
      for (const key of keys) {
        const marker = active && key.address === active ? colors.green('*') : ' ';
        const alias = key.alias ? ` (${key.alias})` : '';
        const created = key.createdAt ? ` ${colors.gray(`[${key.createdAt}]`)}` : '';
        // eslint-disable-next-line no-console
        console.log(`${marker} ${colors.hash(key.address)}${alias}${created}`);
      }
    } else {
      printError(`Unsupported chain "${activeChain}".`);
    }
  } catch (err) {
    printError(errorMessage(err));
  }
}

export async function accountUseAction(address: string): Promise<void> {
  try {
    if (!address) {
      printError('Address is required. Usage: wit account use <address>');
      return;
    }
    const activeChain = await readActiveChain();
    if (activeChain === 'mantle') {
      const target = normalizeEvmAddress(address);
      const keys = await listEvmKeys();
      const match = keys.find((k) => k.address === target);
      if (!match) {
        printError(`Key not found for address ${target}. Generate one with "wit account generate".`);
        return;
      }

      await setActiveEvmAddress(target, { alias: match.alias, updateAuthorIfUnknown: true });
      await maybeUpdateRepoAuthor(target, activeChain);

      // eslint-disable-next-line no-console
      console.log(`Switched active account to ${colors.hash(target)}${match.alias ? ` (${match.alias})` : ''}`);
    } else if (activeChain === 'sui') {
      const target = normalizeAddress(address);
      const keys = await listStoredKeys();
      const match = keys.find((k) => k.address === target);
      if (!match) {
        printError(`Key not found for address ${target}. Generate one with "wit account generate".`);
        return;
      }

      await setActiveAddress(target, { alias: match.alias, updateAuthorIfUnknown: true });
      await maybeUpdateRepoAuthor(target, activeChain);

      // eslint-disable-next-line no-console
      console.log(`Switched active account to ${colors.hash(target)}${match.alias ? ` (${match.alias})` : ''}`);
    } else {
      printError(`Unsupported chain "${activeChain}".`);
    }
  } catch (err) {
    printError(errorMessage(err));
  }
}

export async function accountGenerateAction(opts: { alias?: string }): Promise<void> {
  try {
    const alias = opts.alias?.trim() || 'default';
    const activeChain = await readActiveChain();
    if (activeChain === 'mantle') {
      const { address } = await createEvmKey(alias);
      await maybeUpdateRepoAuthor(address, activeChain);
      // eslint-disable-next-line no-console
      console.log(`Generated new account ${colors.hash(address)} (${alias}) and set as active.`);
      // eslint-disable-next-line no-console
      console.log(colors.yellow(`\n👉 Important: This is a Mantle Mainnet wallet.`));
      // eslint-disable-next-line no-console
      console.log(colors.yellow(`   You MUST fund this address with MNT tokens to perform ANY operations (push, create-repo, etc).`));
      // eslint-disable-next-line no-console
      console.log(colors.yellow(`   Address: ${address}`));
    } else if (activeChain === 'sui') {
      const { address } = await createSigner(alias);
      await maybeUpdateRepoAuthor(address, activeChain);
      // eslint-disable-next-line no-console
      console.log(`Generated new account ${colors.hash(address)} (${alias}) and set as active.`);
    } else {
      printError(`Unsupported chain "${activeChain}".`);
    }
  } catch (err) {
    printError(errorMessage(err));
  }
}

export async function accountImportAction(privateKey: string, opts: { alias?: string }): Promise<void> {
  try {
    if (!privateKey) {
      printError('Private key is required. Usage: wit account import <private_key>');
      return;
    }
    const alias = opts.alias?.trim() || 'default';
    const activeChain = await readActiveChain();
    if (activeChain === 'mantle') {
      const { address } = await importEvmKey(privateKey, alias);
      await maybeUpdateRepoAuthor(address, activeChain);
      // eslint-disable-next-line no-console
      console.log(`Imported account ${colors.hash(address)} (${alias}) and set as active.`);
    } else if (activeChain === 'sui') {
      printError('Sui key import is not supported yet.');
    } else {
      printError(`Unsupported chain "${activeChain}".`);
    }
  } catch (err) {
    printError(errorMessage(err));
  }
}

export async function accountBalanceAction(addressArg?: string): Promise<void> {
  try {
    const activeChain = await readActiveChain();
    if (activeChain === 'mantle') {
      const address = addressArg ? normalizeEvmAddress(addressArg) : await readActiveEvmAddress();
      if (!address) {
        printError('No address provided and no active address configured. Use `wit account generate` or `wit account use <address>` first.');
        return;
      }
      const networkHint = await readMantleNetworkHint();
      const config = resolveMantleConfig(networkHint);
      const provider = createMantleProvider(config.network);
      const balance = await provider.getBalance(address);
      const txContext = await resolveEvmTxContext(provider, address, { to: address, value: 0n });

      // eslint-disable-next-line no-console
      console.log(colors.header(`Account ${colors.hash(address)}`));
      // eslint-disable-next-line no-console
      console.log(`Network: ${config.chainName} (${config.chainId}, ${config.network})`);
      // eslint-disable-next-line no-console
      console.log(`RPC: ${config.rpcUrl}`);
      // eslint-disable-next-line no-console
      console.log(`MNT: ${formatUnits(balance, 18)} MNT`);

      const gasLimit = txContext.gasLimit;
      const feeData = txContext.feeData;
      const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice;
      const gasCost = gasLimit && gasPrice ? gasLimit * gasPrice : null;
      const gasLabel = gasLimit ? gasLimit.toString() : 'n/a';
      const maxFee = feeData.maxFeePerGas ? `${formatUnits(feeData.maxFeePerGas, 9)} gwei` : 'n/a';
      const maxPriority = feeData.maxPriorityFeePerGas ? `${formatUnits(feeData.maxPriorityFeePerGas, 9)} gwei` : 'n/a';
      const gasPriceLabel = feeData.gasPrice ? `${formatUnits(feeData.gasPrice, 9)} gwei` : 'n/a';
      const gasCostLabel = gasCost ? `${formatUnits(gasCost, 18)} MNT` : 'n/a';

      // eslint-disable-next-line no-console
      console.log(colors.cyan('Gas estimate (simple transfer):'));
      // eslint-disable-next-line no-console
      console.log(`  gasLimit: ${gasLabel}`);
      // eslint-disable-next-line no-console
      console.log(`  maxFeePerGas: ${maxFee}`);
      // eslint-disable-next-line no-console
      console.log(`  maxPriorityFeePerGas: ${maxPriority}`);
      // eslint-disable-next-line no-console
      console.log(`  gasPrice: ${gasPriceLabel}`);
      // eslint-disable-next-line no-console
      console.log(`  estCost: ${gasCostLabel}`);
    } else if (activeChain === 'sui') {
      const target = addressArg ? normalizeAddress(addressArg) : await readActiveAddress();
      if (!target) {
        printError('No address provided and no active address configured. Use `wit account generate` or `wit account use <address>` first.');
        return;
      }
      const res = await checkResources(target);

      // eslint-disable-next-line no-console
      console.log(colors.header(`Account ${colors.hash(target)}`));
      if (res.error) {
        // eslint-disable-next-line no-console
        console.log(`SUI: ${colors.red('error')} ${res.error}`);
      } else {
        const badgeSui = res.hasMinSui === false ? colors.red('(low)') : res.hasMinSui ? colors.green('(ok)') : colors.yellow('(unknown)');
        // eslint-disable-next-line no-console
        console.log(`SUI: ${formatBalance(res.suiBalance ?? 0n, 'SUI')} ${badgeSui}`);
      }

      if (res.walError) {
        // eslint-disable-next-line no-console
        console.log(`WAL: ${colors.red('error')} ${res.walError}`);
      } else {
        const badgeWal = res.hasMinWal === false ? colors.red('(low)') : res.hasMinWal ? colors.green('(ok)') : colors.yellow('(unknown)');
        // eslint-disable-next-line no-console
        console.log(`WAL: ${formatBalance(res.walBalance ?? 0n, 'WAL')} ${badgeWal}`);
      }
    } else {
      printError(`Unsupported chain "${activeChain}".`);
    }
  } catch (err) {
    printError(errorMessage(err));
  }
}

function formatBalance(amount: bigint, symbol: string): string {
  const whole = amount / 1_000_000_000n;
  const frac = amount % 1_000_000_000n;
  return `${whole}.${frac.toString().padStart(9, '0')} ${symbol}`;
}

async function maybeUpdateRepoAuthor(address: string, chain: ChainId): Promise<void> {
  let witDir: string;
  try {
    witDir = await requireWitDir();
  } catch (err: any) {
    if (err?.message?.includes('Not a wit repository')) return;
    throw err;
  }
  try {
    const cfg = await readRepoConfig(witDir);
    if (cfg.chain && cfg.chain !== chain) return;
    const current = cfg.chains?.[chain]?.author;
    if (current && current !== 'unknown') return;
    setChainAuthor(cfg, chain, address);
    await writeRepoConfig(witDir, cfg);
    // eslint-disable-next-line no-console
    console.log(colors.green(`Updated .wit/config.json author to ${address}`));
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.warn(`Warning: could not update .wit/config.json author: ${err.message}`);
  }
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

async function readMantleNetworkHint(): Promise<string | null> {
  try {
    const witDir = await requireWitDir();
    const repoCfg = await readRepoConfig(witDir);
    if (repoCfg.network) return repoCfg.network;
  } catch (err: any) {
    if (err?.message?.includes('Not a wit repository')) {
      // ignore
    } else {
      throw err;
    }
  }

  const configPath = path.join(os.homedir(), '.witconfig');
  try {
    const raw = await fs.readFile(configPath, 'utf8');
    const cfg = JSON.parse(raw) as { network?: string };
    return cfg.network ?? null;
  } catch (err: any) {
    if (err?.code === 'ENOENT') return null;
    throw err;
  }
}
