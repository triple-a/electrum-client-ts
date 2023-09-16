const { ElectrumClient } = require('../dist');

const config = {
  host: 'fortress.qtornado.com',
  port: 50002,
  protocol: 'ssl',
};

const main = async () => {
  console.log('Connecting...');
  const client = new ElectrumClient(config.host, config.port, config.protocol);

  await client.connect();

  try {
    const r = await client.blockchain_headers_subscribe();
    console.log(r);
  } catch (e) {
    console.log(e);
  } finally {
    client.close();
  }
};

main().catch(console.error);
