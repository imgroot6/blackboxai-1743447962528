const getAvailablePort = async (port) => {
  const net = require('net');
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => resolve(getAvailablePort(port + 1)));
    server.listen({ port }, () => {
      server.close(() => resolve(port));
    });
  });
};

module.exports = { getAvailablePort };