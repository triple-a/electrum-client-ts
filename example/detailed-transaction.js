// getDetailedTransaction
//
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ElectrumClient } = require('../dist');

async function main() {
  const client = new ElectrumClient('electrum.bitaroo.net', 50002, 'ssl', {
    logLevel: 'none',
  });
  //const client = new ElectrumClient('electrum-tbtc.triple-a.io', 50001, 'tcp');

  try {
    await client.connect();

    const tx = await client.getDetailedTransaction(
      process.argv[2] ||
        '2fdee6050a8713d70ffc823771e14d2cbc75f4902282f167f5ee1cf3f3962d3a',
    );
    console.log('%j', tx);
  } catch (err) {
    console.log('error', err);
  } finally {
    await client.close();
  }
}

main().catch(console.error);
