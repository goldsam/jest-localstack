/* eslint-disable no-console */
const NodeEnvironment = require('jest-environment-node');
const debug = require('debug')('jest-localstack');

module.exports = class DynamoDBEnvironment extends NodeEnvironment {
  constructor(config) {
    super(config);
  }

  async setup() {
    debug('Setup LocalStack Test Environment');

    await super.setup();
  }

  async teardown() {
    debug('Teardown LocalStack Test Environment');

    await super.teardown();
  }

  runScript(script) {
    return super.runScript(script);
  }
};
