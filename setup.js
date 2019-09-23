const {resolve} = require('path');
const cwd = require('cwd');
const readline = require('readline');
var Docker = require('dockerode');

const DynamoDB = require('aws-sdk/clients/dynamodb');
const Kinesis = require('aws-sdk/clients/kinesis');

// aws-sdk requires access and secret key
process.env.AWS_ACCESS_KEY_ID = 'access-key';
process.env.AWS_SECRET_ACCESS_KEY = 'secret-key';

const DEFAULT_SERVICES = {
  kinesis: 4568,
  dynamodb: 4569
};

const CONFIG_DEFAULTS = {
  image: 'localstack/localstack',
  readyTimeout: 60000,
  // readyTimeout: 4000,
  showLog: false
};

module.exports = async function() {
  const config = await loadConfig();
  const services = getServices(config);
  var docker = new Docker();

  return docker
    .createContainer({
      Image: config.image,
      AttachStdin: false,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
      OpenStdin: false,
      StdinOnce: false,
      Env: buildEnv(config),
      ...buildExposedPortsAndHostConfig(services)
    })
    .then(container => (global.__LOCALSTACK__ = container).start())
    .then(container => waitForReady(container, config))
    .then(container => initializeServices(container, config, services))
    .catch(err => {
      const container = global.__LOCALSTACK__;

      if (container) {
        return global.__LOCALSTACK__.kill().then(() => Promise.reject(err));
      }
      throw err;
    });
};

async function loadConfig() {
  const config = require(resolve(cwd(), 'jest-localstack-config.js'));

  return {...CONFIG_DEFAULTS, ...(typeof config === 'function' ? await config() : config)};
}

function buildEnv(config) {
  const env = ['FORCE_NONINTERACTIVE=true'];

  if (config.services) {
    env.push(
      `SERVICES=${Array.isArray(config.services) ? config.services.join(',') : config.services}`
    );
  }

  return env;
}

function buildExposedPortsAndHostConfig(services) {
  const serviceNames = Object.keys(services);

  return serviceNames.reduce(
    (config, serviceName) => {
      const port = services[serviceName];
      const key = `${port}/tcp`;
      config.ExposedPorts[key] = {};
      config.HostConfig.PortBindings[key] = [{HostPort: String(port)}];

      return config;
    },
    {
      ExposedPorts: {},
      HostConfig: {
        PortBindings: {}
      }
    }
  );
}

function waitForReady(container, config) {
  return container
    .logs({
      follow: true,
      stdout: true,
      stderr: true
    })
    .then(stream => {
      const readInterface = readline.createInterface({
        input: stream,
        output: config.showLog ? process.stdout : undefined,
        console: false
      });

      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          stream.destroy();
          reject('Error: timeout before LocalStack was ready.');
        }, config.readyTimeout);

        console.info('\nWaiting for LocalStack to be ready...');
        readInterface.on('line', function(line) {
          if (line.indexOf('Ready.') >= 0) {
            clearTimeout(timer);
            resolve(container);
          }
        });
      });
    });
}

function getServices(config) {
  let {services} = config;

  if (typeof services === 'string') {
    services = services.split(',');
  } else if (!services) {
    return DEFAULT_SERVICES;
  }

  return services.reduce((hash, service) => {
    var nameAndPort = service.trim().split(':');
    hash[nameAndPort[0]] = nameAndPort.length > 1 ? nameAndPort[1] : DEFAULT_SERVICES[service];

    return hash;
  }, {});
}

async function initializeServices(container, config, services) {
  return Promise.all([
    createDynamoTables(config, services),
    createKinesisStreams(config, services)
  ]).then(() => container);
}

async function createDynamoTables(config, services) {
  if (Array.isArray(config.dynamoTables) && services.dynamodb) {
    const dynamoDB = new DynamoDB({
      endpoint: `localhost:${services.dynamodb}`,
      sslEnabled: false,
      region: 'local-env'
    });

    return Promise.all(
      config.dynamoTables.map(dynamoTable => dynamoDB.createTable(dynamoTable).promise())
    );
  }

  return Promise.resolve();
}

async function createKinesisStreams(config, services) {
  if (Array.isArray(config.kinesisStreams) && services.kinesis) {
    const kinesis = new Kinesis({
      endpoint: `localhost:${services.kinesis}`,
      sslEnabled: false,
      region: 'local-env'
    });

    return Promise.all(
      config.kinesisStreams.map(kinesisStream => kinesis.createStream(kinesisStream).promise())
    );
  }

  return Promise.resolve();
}
