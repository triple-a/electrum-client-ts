const servers = {
  tcp: {
    protocol: 'tcp',
    port: '50001',
    host: 'fortress.qtornado.com',
  },
  ssl: {
    protocol: 'ssl',
    port: '50002',
    host: 'fortress.qtornado.com',
  },
  ws: {
    protocol: 'ws',
    port: '50003',
    host: 'electrumx-server.tbtc.svc.cluster.local',
  },
  wss: {
    protocol: 'wss',
    port: '50004',
    host: 'electrumx-server.tbtc.svc.cluster.local',
  },
};

const serversArray = [
  servers.tcp,
  servers.ssl,
  // TODO: WebSocket is commented out for CI, until we find public servers for this protocol.
  // electrumServers.ws,
  // electrumServers.wss,
];

module.exports = {
  servers,
  serversArray,
};
