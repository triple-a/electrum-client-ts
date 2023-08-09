const { ElectrumClient } = require('../dist');

async function main() {
  const client = new ElectrumClient('fortress.qtornado.com', 50002, 'ssl');

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
