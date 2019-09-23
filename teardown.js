const debug = require('debug')('jest-localstack');

module.exports = async function() {
  // eslint-disable-next-line no-console
  debug('Teardown LocalStack');
  const container = global.__LOCALSTACK__;

  if (container) {
    container.remove({
      force: true
    });
  }
};
