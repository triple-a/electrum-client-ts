const { ElectrumClient } = require('../dist');

async function main() {
  const client = new ElectrumClient('fortress.qtornado.com', 50002, 'ssl');

  try {
    console.log('connecting...');
    await client.connect(
      'electrum-client-js', // optional client name
      '1.4.2', // optional protocol version
    );

    const header = await client.blockchain_headers_subscribe();
    console.log('Current header:', header);

    await client.close();
  } catch (err) {
    console.log('error', err);
  }
}

main().catch(console.error);
