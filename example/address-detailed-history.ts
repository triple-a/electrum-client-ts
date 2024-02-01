import { ElectrumClient } from '../src';
import { Protocol } from '../src/types';

const networks: { [key: string]: [string, number, Protocol] } = {
  bitcoin: ['electrum.bitaroo.net', 50002, 'ssl'],
  testnet: ['electrum-tbtc.triple-a.io', 50001, 'tcp'],
};

const main = async () => {
  const address = process.argv[2] || '1Ep2wRnRj2tPn77czVzk5XRLau9zt8Syt';

  let network = 'bitcoin';
  if (address.startsWith('tb')) {
    network = 'testnet';
  }

  const p = networks[network];
  const client = new ElectrumClient(p[0], p[1], p[2], {
    showBanner: false,
    logLevel: 'none',
  });

  try {
    await client.connect();

    const detailedHistory = await client.getAddressDetailedHistory(
      address,
      network as 'bitcoin' | 'testnet',
      {
        retreiveVin: true,
      },
    );

    console.log('%j', detailedHistory);
  } catch (e) {
    console.log(e);
  } finally {
    client.close();
  }
};

main();
