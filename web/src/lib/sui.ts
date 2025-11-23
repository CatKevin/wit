import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';

export const SUI_NETWORK = 'testnet';
export const SUI_RPC_URL = getFullnodeUrl(SUI_NETWORK);

export const suiClient = new SuiClient({ url: SUI_RPC_URL });
