import { ElectrumClient } from '../src';

const main = async () => {
  const ecl = new ElectrumClient('fortress.qtornado.com', 50002, 'ssl');
  await ecl.connect();
  const tx = await ecl.blockchain_transaction_get(
    '2fdee6050a8713d70ffc823771e14d2cbc75f4902282f167f5ee1cf3f3962d3a',
    true,
  );

  console.log('tx: %o', tx);

  ecl.close();
};

main();
