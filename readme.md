# jest-dynamodb [![CircleCI](https://circleci.com/gh/goldsam/jest-localstack/tree/master.svg?style=svg)](https://circleci.com/gh/goldsam/jest-localstack/tree/master) [![npm (scoped)](https://img.shields.io/npm/v/@golsam/jest-localstack.svg)](https://www.npmjs.com/package/@goldsam/jest-localstack)

Jest preset to run LocalStack

# Usage

## 0. Install

```
$ yarn add @goldsam/jest-localstack --dev
```

Make sure `aws-sdk` is installed as a peer dependency.

## 1. Create `jest.config.js`

```js
module.exports = {
  preset: '@goldsam/jest-localstack'
};
```

## 2. Create `jest-localstack-config.js`

```js
// see table below for for additional details
module.exports = {
  services: ['dynamodb', 'kinesis'],
  showLog: true
};
```

### `jest-localstack-config.js` properties:

| Property       | Type             | Default                 | Description                                                                                                                     |
| -------------- | ---------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `image`        | string           | `localstack/localstack` | LocalStack image name.                                                                                                          |
| `readyTimeout` | number           | `60000`                 | Timeout (ms) to wait for LocalStack to become ready.                                                                            |
| `showLog`      | boolean          | `false`                 | `true` to output LocalStack log to stdout; `false` to suppress log output.                                                      |
| `services`     | string\|string[] | `undefined`             | Comma delimited list or array of service names to mock; `null` or `undefined` mocks all supported services.                     |
| `dynamoTables` | Object[]         | `undefined`             | Array of [Create Table](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#createTable-property) parameters. |

#### `dynamoTables`

## 3. Configure clients

```js
// This example only uses DynamoDB
const {DocumentClient} = require('aws-sdk/clients/dynamodb');

const isTest = process.env.JEST_WORKER_ID;
const config = {
  convertEmptyValues: true,
  ...(isTest && {endpoint: 'localhost:4569', sslEnabled: false, region: 'local-env'})
};

const ddb = new DocumentClient(config);
```

## 4. Write tests

```js
it('should insert item into table', async () => {
  await ddb.put({TableName: 'files', Item: {id: '1', hello: 'world'}}).promise();

  const {Item} = await ddb.get({TableName: 'files', Key: {id: '1'}}).promise();

  expect(Item).toEqual({
    id: '1',
    hello: 'world'
  });
});
```

# Read

- [LocalStack - A fully functional local AWS cloud stack](https://github.com/localstack/localstack)
- [dockerode - Docker Remote API module](https://github.com/apocas/dockerode)

# See Also

- [jest-dynamodb](https://github.com/shelfio/jest-dynamodb)

# License

MIT © Sam Goldmann 2019
