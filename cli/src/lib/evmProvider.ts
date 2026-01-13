import { JsonRpcProvider, Wallet, type FeeData, type TransactionRequest } from 'ethers';
import { loadEvmKey } from './evmKeys';

export type EvmNetwork = 'mainnet' | 'testnet';

export type MantleConfig = {
  network: EvmNetwork;
  chainId: number;
  chainName: string;
  rpcUrl: string;
};

export type EvmSignerContext = {
  provider: JsonRpcProvider;
  signer: Wallet;
  address: string;
  config: MantleConfig;
};

export type EvmTxContext = {
  chainId: number;
  nonce: number;
  feeData: FeeData;
  gasLimit?: bigint;
};

const DEFAULT_RPC_URLS: Record<EvmNetwork, string> = {
  testnet: 'https://rpc.sepolia.mantle.xyz',
  mainnet: 'https://rpc.mantle.xyz',
};

const DEFAULT_CHAIN_IDS: Record<EvmNetwork, number> = {
  testnet: 5003,
  mainnet: 5000,
};

const DEFAULT_CHAIN_NAMES: Record<EvmNetwork, string> = {
  testnet: 'mantle-sepolia',
  mainnet: 'mantle',
};

export function resolveMantleNetwork(input?: string | null): EvmNetwork {
  return input === 'mainnet' ? 'mainnet' : 'testnet';
}

export function resolveMantleRpcUrl(network: EvmNetwork): string {
  return (
    process.env.WIT_MANTLE_RPC_URL ||
    process.env.MANTLE_RPC_URL ||
    DEFAULT_RPC_URLS[network]
  );
}

export function resolveMantleChainId(network: EvmNetwork): number {
  const override = process.env.WIT_MANTLE_CHAIN_ID || process.env.MANTLE_CHAIN_ID;
  if (override) {
    const parsed = Number(override);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_CHAIN_IDS[network];
}

export function resolveMantleConfig(networkInput?: string | null): MantleConfig {
  const network = resolveMantleNetwork(networkInput);
  return {
    network,
    chainId: resolveMantleChainId(network),
    chainName: DEFAULT_CHAIN_NAMES[network],
    rpcUrl: resolveMantleRpcUrl(network),
  };
}

export function createMantleProvider(networkInput?: string | null): JsonRpcProvider {
  const config = resolveMantleConfig(networkInput);
  return new JsonRpcProvider(config.rpcUrl, {
    name: config.chainName,
    chainId: config.chainId,
  });
}

export async function loadMantleSigner(networkInput?: string | null, address?: string): Promise<EvmSignerContext> {
  const config = resolveMantleConfig(networkInput);
  const provider = new JsonRpcProvider(config.rpcUrl, {
    name: config.chainName,
    chainId: config.chainId,
  });
  const key = await loadEvmKey(address);
  const signer = new Wallet(key.privateKey, provider);
  return {
    provider,
    signer,
    address: signer.address,
    config,
  };
}

export async function resolveEvmTxContext(
  provider: JsonRpcProvider,
  address: string,
  tx?: TransactionRequest,
): Promise<EvmTxContext> {
  const [network, nonce, feeData] = await Promise.all([
    provider.getNetwork(),
    provider.getTransactionCount(address, 'pending'),
    provider.getFeeData(),
  ]);
  let gasLimit: bigint | undefined;
  if (tx) {
    gasLimit = await provider.estimateGas({ ...tx, from: address });
  }
  return {
    chainId: Number(network.chainId),
    nonce,
    feeData,
    gasLimit,
  };
}
