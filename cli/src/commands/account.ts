import {colors} from '../lib/ui';
import {listStoredKeys, readActiveAddress} from '../lib/keys';

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
