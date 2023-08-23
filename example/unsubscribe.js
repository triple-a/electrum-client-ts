const { ElectrumClient } = require('../dist');

const main = async () => {
  const ecl = new ElectrumClient('fortress.qtornado.com', 50002, 'tls', {
    logLevel: 'debug',
  });
  try {
    await ecl.connect();

    await ecl.blockchain_scripthash_subscribe(
      'f3aa57a41424146327e5c88c25db8953dd16c6ab6273cdb74a4404ed4d0f5714',
    );

    const result = await ecl.blockchain_scripthash_unsubscribe(
      'f3aa57a41424146327e5c88c25db8953dd16c6ab6273cdb74a4404ed4d0f5714',
    );
    console.log('result: ', result);
  } catch (e) {
    console.error(e);
  } finally {
    ecl.close();
  }
};

main();
