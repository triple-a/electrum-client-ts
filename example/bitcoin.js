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

  const scriptHash =
    process.argv[2] ||
    '740485f380ff6379d11ef6fe7d7cdd68aea7f8bd0d953d9fdf3531fb7d531833';

  try {
    const ver = await client.server_version('electrum-client-js', '1.4');
    console.log('Negotiated version:', ver, typeof ver);

    const balance = await client.blockchain_scripthash_getBalance(scriptHash);
    console.log('Balance:', balance);

    const history = await client.blockchain_scripthash_getHistory(scriptHash);
    console.log('History:', history);

    const unspent = await client.blockchain_scripthash_listunspent(scriptHash);
    console.log('Unspent:', unspent);
  } catch (e) {
    console.error('error: %o', e);
  }

  await client.close();
};

main().catch(console.error);
