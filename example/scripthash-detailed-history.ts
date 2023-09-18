import { ElectrumClient } from '../src';

const main = async () => {
  const client = new ElectrumClient('electrum.bitaroo.net', 50002, 'ssl', {
    showBanner: false,
    logLevel: 'none',
  });

  try {
    await client.connect();

    const scriptHash =
      process.argv[2] ||
      //'740485f380ff6379d11ef6fe7d7cdd68aea7f8bd0d953d9fdf3531fb7d531833';
      //'8b01df4e368ea28f8dc0423bcf7a4923e3a12d307c875e47a0cfbf90b5c39161';
      'cf52d58a518fce3b9d8ff7a76c07f1a1c838d4483d4ddf95ec781244096cd9b2';

    const address =
      process.argv[3] || //'1LpErkYJUeGkTiJ68HEfg6p4T1rpYXRNLX';
      //'1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';
      '1Ep2wRnRj2tPn77czVzk5XRLau9zt8Syt';

    const detailedHistory = await client.getScriptHashDetailedHistory(
      scriptHash,
      address,
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
