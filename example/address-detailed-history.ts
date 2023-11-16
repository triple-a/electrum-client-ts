import { ElectrumClient } from '../src';

const main = async () => {
  const client = new ElectrumClient('electrum.bitaroo.net', 50002, 'ssl', {
    showBanner: false,
    logLevel: 'none',
  });

  try {
    await client.connect();

    const address =
      process.argv[2] || //'1LpErkYJUeGkTiJ68HEfg6p4T1rpYXRNLX';
      //'1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';
      '1Ep2wRnRj2tPn77czVzk5XRLau9zt8Syt';

    const detailedHistory = await client.getAddressDetailedHistory(
      address,
      'bitcoin',
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
