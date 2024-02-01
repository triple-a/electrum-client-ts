// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ElectrumClient } = require('../dist');

const networks = {
  bitcoin: ['electrum.bitaroo.net', 50002, 'ssl'],
  testnet: ['electrum-tbtc.triple-a.io', 50001, 'tcp'],
};

async function main() {
  let network = process.argv[2] || 'bitcoin';

  const p = networks[network];

  const client = new ElectrumClient(p[0], p[1], p[2]);

  try {
    await client.connect();

    const blocksToWait = 2;

    const estimateFee = await client.blockchain_estimatefee(blocksToWait);

    console.log(`Estimated fee: ${estimateFee}`);

    const relayfee = await client.blockchain_relayfee();

    console.log(`Relay fee: ${relayfee}`);
  } catch (e) {
    console.log(`Error: ${e}`);
  } finally {
    await client.close();
  }
}

main().catch(console.error);
