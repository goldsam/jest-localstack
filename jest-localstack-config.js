module.exports = {
  // showLog: true,
  services: ['dynamodb', 'kinesis'],
  // image: 'localstack/localstack',
  dynamoTables: [
    {
      TableName: `files`,
      KeySchema: [{AttributeName: 'id', KeyType: 'HASH'}],
      AttributeDefinitions: [{AttributeName: 'id', AttributeType: 'S'}],
      ProvisionedThroughput: {ReadCapacityUnits: 1, WriteCapacityUnits: 1}
    }
  ]
};
