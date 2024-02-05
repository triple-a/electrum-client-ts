// getDetailedTransaction
//
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ElectrumClient } = require('../dist');

async function main() {
  const txid =
    process.argv[2] ||
    '2fdee6050a8713d70ffc823771e14d2cbc75f4902282f167f5ee1cf3f3962d3a';

  const client = new ElectrumClient('electrum.bitaroo.net', 50002, 'ssl', {
    logLevel: 'none',
  });

  const testnetClient = new ElectrumClient(
    'electrum-tbtc.triple-a.io',
    50001,
    'tcp',
  );

  try {
    try {
      await testnetClient.connect();
      const tx = await testnetClient.getDetailedTransaction(txid);
      console.log('%j', tx);
    } catch (_err) {
      await client.connect();
      const tx = await client.getDetailedTransaction(txid);
      console.log('%j', tx);
    }
  } catch (err) {
    console.log('error', err);
  } finally {
    await client.close();
    await testnetClient.close();
  }
}

main().catch(console.error);
