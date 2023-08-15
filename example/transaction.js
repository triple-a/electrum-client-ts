const { ElectrumClient } = require('../dist');

async function main() {
  const client = new ElectrumClient('electrum.bitaroo.net', 50002, 'ssl');

  try {
    console.log('connecting...');
    await client.connect();

    const tx = await client.blockchain_transaction_get(
      '2fdee6050a8713d70ffc823771e14d2cbc75f4902282f167f5ee1cf3f3962d3a',
      true,
    );
    console.log('Tx: %o', tx);

    await client.close();
  } catch (err) {
    console.log('error', err);
  }
}

main().catch(console.error);
