declare module '@web3-storage/car-block-validator' {
  export function validateBlock(block: { cid: unknown; bytes: Uint8Array }): Promise<void>;
}
