describe('modules/platform/codecommit/iam-client', () => {
  let iamClient: any;
  let iam: any;

  beforeEach(() => {
    jest.resetModules();
    jest.mock('@aws-sdk/client-iam');
    const mod = require('@aws-sdk/client-iam');
    iamClient = mod['IAM'];

    iam = require('./iam-client');
    iam.initIamClient('eu-east', {
      accessKeyId: 'aaa',
      secretAccessKey: 'bbb',
    });
  });

  it('should throw in case of bad authentication', async () => {
    jest.spyOn(iamClient.prototype, 'send').mockImplementationOnce(() => {
      throw new Error('bad credentials');
    });
    let userArn;
    try {
      userArn = await iam.getUserArn();
    } catch (err) {
      //
    }
    expect(userArn).toBeUndefined();
  });

  it('should return the user arn, even though user has no permission', async () => {
    jest.spyOn(iamClient.prototype, 'send').mockImplementationOnce(() => {
      throw new Error('User: aws:arn:example:123456 has no permissions');
    });
    let userArn;
    try {
      userArn = await iam.getUserArn();
    } catch (err) {
      //
    }
    expect(userArn).toBe('aws:arn:example:123456');
  });

  it('should return the user normally', async () => {
    jest.spyOn(iamClient.prototype, 'send').mockImplementationOnce(() => {
      return Promise.resolve({ User: { Arn: 'aws:arn:example:123456' } });
    });
    let userArn;
    try {
      userArn = await iam.getUserArn();
    } catch (err) {
      //
    }
    expect(userArn).toBe('aws:arn:example:123456');
  });
});
