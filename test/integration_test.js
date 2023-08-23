const { ElectrumClient } = require('../dist');

const chai = require('chai');
const assert = chai.assert;

const fs = require('fs');

const config = require('./config');

describe('ElectrumClient', async () => {
  let txData;

  before(async () => {
    txData = JSON.parse(await fs.readFileSync('./test/tx.json', 'utf8'));
  });

  describe('for all protocols', async () => {
    config.serversArray.forEach((server) => {
      let client;

      before(async () => {
        client = new ElectrumClient(server.host, server.port, server.protocol, {
          clientName: 'test_client' + server.protocol,
          protocolVersion: '1.4.2',
          ...server.options,
        });

        await client.connect().catch((err) => {
          console.error(
            `failed to connect with config [${JSON.stringify(
              server,
            )}]: [${err}]`,
          );
        });
      });

      after(() => {
        client.close();
      });

      it('request returns result', async () => {
        const expectedResult = txData.hex;
        const result = await client.blockchain_transaction_get(txData.hash);

        assert.equal(result, expectedResult, 'unexpected result');
      });
    });
  });

  describe('when not connected', async () => {
    before(async () => {
      const server = config.servers.tcp;

      client = new ElectrumClient(
        server.host,
        server.port,
        server.protocol,
        server.options,
      );
    });

    it('request throws error', async () => {
      await client.blockchain_transaction_get(txData.hash).then(
        (_value) => {
          // onFulfilled
          assert.fail('not failed as expected');
        },
        (reason) => {
          // onRejected
          assert.include(reason.toString(), `connection not established`);
        },
      );
    });
  });
  // TODO: Add tests
});
