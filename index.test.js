const {DocumentClient} = require('aws-sdk/clients/dynamodb');

const ddb = new DocumentClient({
  convertEmptyValues: true,
  endpoint: 'localhost:4569',
  sslEnabled: false,
  region: 'local-env'
});

it('should insert item into table', async () => {
  await ddb.put({TableName: 'files', Item: {id: '1', hello: 'world'}}).promise();
});
