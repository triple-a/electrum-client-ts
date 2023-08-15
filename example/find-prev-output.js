const { ElectrumClient } = require('../dist');

const config = {
  host: 'fortress.qtornado.com',
  port: 50002,
  protocol: 'ssl',
};

// node example/find-prev-output.js 38c54z9c8VAkGNSL3yEAaefdBNpTKQKZjy a4883058f7cfe851487dce5280e68e1a6a30dc1cdbbb2d320e81f850389fc295 38c54z9c8VAkGNSL3yEAaefdBNpTKQKZjy

const main = async () => {
  console.log('Connecting...');
  const client = new ElectrumClient(config.host, config.port, config.protocol);

  await client.connect();

  const address = process.argv[2] || '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';
  const scriptHash =
    process.argv[3] ||
    '740485f380ff6379d11ef6fe7d7cdd68aea7f8bd0d953d9fdf3531fb7d531833';

  try {
    const ver = await client.server_version('electrum-client-js', '1.4');
    console.log('Negotiated version:', ver);

    const balance = await client.blockchain_scripthash_getBalance(scriptHash);
    console.log('Balance:', balance);

    const history = await client.blockchain_scripthash_getHistory(scriptHash);

    for (const it of history) {
      const tx = await client.blockchain_transaction_get(it.tx_hash, true);
      // console.log('tx: %j', tx.vout.length);

      for (const output of tx.vout) {
        if (output.scriptPubKey.address === address) {
          console.log('Found output:', output);
          return;
        }
      }
    }
  } catch (e) {
    console.error('error: %o', e);
  } finally {
    client.close();
  }
};

main().catch(console.error);
