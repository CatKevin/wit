import fs from 'fs/promises';
import path from 'path';
import {colors} from '../lib/ui';
import {
  createSigner,
  listStoredKeys,
  normalizeAddress,
  readActiveAddress,
  setActiveAddress,
} from '../lib/keys';

export async function accountListAction(): Promise<void> {
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
}

export async function accountUseAction(address: string): Promise<void> {
  if (!address) {
    throw new Error('Address is required. Usage: wit account use <address>');
  }
  const target = normalizeAddress(address);
  const keys = await listStoredKeys();
  const match = keys.find((k) => k.address === target);
  if (!match) {
    throw new Error(`Key not found for address ${target}. Generate one with "wit account generate".`);
  }

  await setActiveAddress(target, {alias: match.alias, updateAuthorIfUnknown: true});
  await maybeUpdateRepoAuthor(target);

  // eslint-disable-next-line no-console
  console.log(`Switched active account to ${colors.hash(target)}${match.alias ? ` (${match.alias})` : ''}`);
}

export async function accountGenerateAction(opts: {alias?: string}): Promise<void> {
  const alias = opts.alias?.trim() || 'default';
  const {address} = await createSigner(alias);
  await maybeUpdateRepoAuthor(address);
  // eslint-disable-next-line no-console
  console.log(`Generated new account ${colors.hash(address)} (${alias}) and set as active.`);
}

async function maybeUpdateRepoAuthor(address: string): Promise<void> {
  const witDir = path.join(process.cwd(), '.wit');
  const repoCfgPath = path.join(witDir, 'config.json');
  try {
    await fs.access(repoCfgPath);
  } catch (err: any) {
    if (err?.code === 'ENOENT') return;
    throw err;
  }
  try {
    const raw = await fs.readFile(repoCfgPath, 'utf8');
    const cfg = JSON.parse(raw) as {author?: string};
    if (!cfg.author || cfg.author === 'unknown') {
      cfg.author = address;
      await fs.writeFile(repoCfgPath, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
      // eslint-disable-next-line no-console
      console.log(colors.green(`Updated .wit/config.json author to ${address}`));
    }
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.warn(`Warning: could not update .wit/config.json author: ${err.message}`);
  }
}
