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
      '740485f380ff6379d11ef6fe7d7cdd68aea7f8bd0d953d9fdf3531fb7d531833';

    const address = process.argv[3] || '1LpErkYJUeGkTiJ68HEfg6p4T1rpYXRNLX';

    const detailedHistory = await client.getScriptHashDetailedHistory(
      scriptHash,
      address,
    );

    console.log('%j', detailedHistory);
  } catch (e) {
    console.log(e);
  } finally {
    client.close();
  }
};

main();
