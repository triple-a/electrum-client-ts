import * as bitcoin from 'bitcoinjs-lib';

/**
 * Convert a bitcoin address to a script hash
 *
 * @param {string} address - The bitcoin address
 * @param {string} network - The bitcoin network
 * @returns {string} The script hash
 */
export function addressToScriptHash(
  address: string,
  network: 'bitcoin' | 'testnet' | 'regtest' = 'bitcoin',
): string {
  const script = bitcoin.address.toOutputScript(
    address,
    bitcoin.networks[network],
  );
  const hash = bitcoin.crypto.sha256(script).reverse().toString('hex');
  return hash;
}
