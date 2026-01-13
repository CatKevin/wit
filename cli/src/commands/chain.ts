import { colors } from '../lib/ui';
import { listSupportedChains, normalizeChain, readActiveChain, setActiveChain } from '../lib/chain';

export async function chainListAction(): Promise<void> {
  const active = await readActiveChain();
  const chains = listSupportedChains();
  // eslint-disable-next-line no-console
  console.log(colors.header(`Active chain: ${active}`));
  for (const chain of chains) {
    const marker = chain.id === active ? colors.green('*') : ' ';
    const label = chain.label ? ` ${colors.gray(`(${chain.label})`)}` : '';
    // eslint-disable-next-line no-console
    console.log(`${marker} ${chain.id}${label}`);
  }
}

export async function chainUseAction(chainArg: string): Promise<void> {
  if (!chainArg) {
    throw new Error('Chain is required. Usage: wit chain use <chain>');
  }
  const chain = normalizeChain(chainArg);
  await setActiveChain(chain);
  // eslint-disable-next-line no-console
  console.log(`Active chain set to ${colors.green(chain)}.`);
}

export async function chainCurrentAction(): Promise<void> {
  const active = await readActiveChain();
  const info = listSupportedChains().find((chain) => chain.id === active);
  const label = info?.label ? ` (${info.label})` : '';
  // eslint-disable-next-line no-console
  console.log(`${active}${label}`);
}
