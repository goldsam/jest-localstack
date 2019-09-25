const DynamoDB = require('aws-sdk/clients/dynamodb');
const Kinesis = require('aws-sdk/clients/kinesis');
const cwd = require('cwd');
const Docker = require('dockerode');
const {resolve} = require('path');
const readline = require('readline');
const DEFAULT_SERVICE_PORTS = require('./service-ports.json');

// aws-sdk requires access and secret key
process.env.AWS_ACCESS_KEY_ID = 'access-key';
process.env.AWS_SECRET_ACCESS_KEY = 'secret-key';

const CONFIG_DEFAULTS = {
  image: 'localstack/localstack:latest',
  readyTimeout: 60000,
  showLog: false
};

module.exports = async function() {
  const config = await loadConfig();
  const services = getServices(config);
  const docker = new Docker();

  console.log('');

  if (!(await imageExists(docker, config.image))) {
    console.log('Pulling LocalStack image. This may take some time...');
    await pullImage(docker, config.image);
  }

  console.log('Creating LocalStack container.');
  const container = await docker.createContainer({
    Image: config.image,
    AttachStdin: false,
    AttachStdout: true,
    AttachStderr: true,
    Tty: true,
    OpenStdin: false,
    StdinOnce: false,
    Env: buildEnv(config),
    ...buildExposedPortsAndHostConfig(services)
  });

  console.log('Starting LocalStack.');
  await container.start();
  try {
    console.log('Waiting for LocalStack to be ready...');
    await waitForReady(container, config);

    await createResources(container, config, services);
    global.__LOCALSTACK__ = container;
  } catch (e) {
    await container.remove({
      force: true
    });
    throw e;
  }
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

async function pullImage(dockerode, imageName) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    const imageNameWithTag = imageName.indexOf(':') > 0 ? imageName : `${imageName}:latest`;

    if (await imageExists(dockerode, imageNameWithTag)) {
      return dockerode.getImage(imageNameWithTag);
    }

    dockerode.pull(imageNameWithTag, (pullError, stream) => {
      if (pullError) {
        reject(pullError);
      }

      if (!stream) {
        throw new Error(`Image '${imageNameWithTag}' doesn't exists`);
      }

      dockerode.modem.followProgress(stream, (error /*, output*/) => {
        // onFinished
        if (error) {
          reject(error);
        }

        resolve(dockerode.getImage(imageNameWithTag));
      });
    });
  });
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

        readInterface.on('line', function(line) {
          if (line.indexOf('Ready.') >= 0) {
            clearTimeout(timer);
            resolve(container);
          }
        });
      });
    });
}

async function imageExists(dockerode, imageName) {
  const images = await dockerode.listImages({filters: {reference: [imageName]}});

  return images.length > 0;
}

function getServices(config) {
  let {services} = config;

  if (typeof services === 'string') {
    services = services.split(',');
  } else if (!services) {
    return DEFAULT_SERVICE_PORTS;
  }

  return services.reduce((hash, service) => {
    var nameAndPort = service.trim().split(':');
    hash[nameAndPort[0]] = nameAndPort.length > 1 ? nameAndPort[1] : DEFAULT_SERVICE_PORTS[service];

    return hash;
  }, {});
}

async function createResources(container, config, services) {
  return Promise.all([
    createDynamoTables(config, services),
    createKinesisStreams(config, services)
  ]);
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
