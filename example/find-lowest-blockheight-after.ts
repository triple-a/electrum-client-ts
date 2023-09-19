import * as bitcoin from 'bitcoinjs-lib';
import { ElectrumClient } from '../src';

const client = new ElectrumClient('fortress.qtornado.com', 50002, 'tls', {
  logLevel: 'none',
});

async function findLowestBlockHeight(afterTimestamp: number): Promise<number> {
  if (!client.isConnected()) {
    await client.connect();
  }

  const blockHeader = await client.blockchain_headers_subscribe();

  for (let blockHeight = blockHeader.height; blockHeight > 0; blockHeight--) {
    const blockHeaderHex = await client.blockchain_block_header(blockHeight);

    // console.log(blockHeaderHex);

    const blockHeader = bitcoin.Block.fromHex(blockHeaderHex as string);

    console.log(
      `Block ${blockHeight} ts: ${new Date(
        blockHeader.timestamp * 1000,
      ).toISOString()}`,
    );
    if (blockHeader.timestamp <= afterTimestamp) {
      return blockHeight;
    }
  }

  return -1;
}

(async () => {
  const afterTimestamp = 1695053000;

  console.log(
    `Finding lowest block height after ${new Date(
      afterTimestamp * 1000,
    ).toISOString()}...`,
  );

  const lowestBlockHeight = await findLowestBlockHeight(afterTimestamp);

  console.log(lowestBlockHeight);
})().finally(() => {
  client.close();
});
