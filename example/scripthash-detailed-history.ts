import { ElectrumClient } from '../src';

const main = async () => {
  const client = new ElectrumClient('fortress.qtornado.com', 50002, 'tls', {
    showBanner: false,
    logLevel: 'none',
  });

  try {
    await client.connect();

    const scriptHash =
      process.argv[2] ||
      '740485f380ff6379d11ef6fe7d7cdd68aea7f8bd0d953d9fdf3531fb7d531833';

    const detailedHistory = await client.getScriptHashDetailedHistory(
      scriptHash,
    );

    console.log('%j', detailedHistory);
  } catch (e) {
    console.log(e);
  } finally {
    client.close();
  }
};

main();
