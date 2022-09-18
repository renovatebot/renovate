import { GetUserCommand, IAMClient } from '@aws-sdk/client-iam';
import { mockClient } from 'aws-sdk-client-mock';
import { PLATFORM_BAD_CREDENTIALS } from '../../../constants/error-messages';

describe('modules/platform/codecommit/iam-client', () => {
  let iam: any;
  let iamClient: any;

  beforeAll(() => {
    iamClient = mockClient(IAMClient);

    iam = require('./iam-client');
    iam.initIamClient('eu-east', {
      accessKeyId: 'aaa',
      secretAccessKey: 'bbb',
    });
  });

  it('should throw in case of bad authentication', async () => {
    iamClient.on(GetUserCommand).rejects(new Error(PLATFORM_BAD_CREDENTIALS));
    let userArn;
    try {
      userArn = await iam.getUserArn();
    } catch (err) {
      //
    }
    expect(userArn).toBeUndefined();
  });

  it('should return empty', async () => {
    iamClient.on(GetUserCommand).resolves(undefined);
    let userArn;
    try {
      userArn = await iam.getUserArn();
    } catch (err) {
      //
    }
    expect(userArn).toBe('');
  });

  it('should return the user arn, even though user has no permission', async () => {
    iamClient
      .on(GetUserCommand)
      .rejects(new Error('User: aws:arn:example:123456 has no permissions'));
    let userArn;
    try {
      userArn = await iam.getUserArn();
    } catch (err) {
      //
    }
    expect(userArn).toBe('aws:arn:example:123456');
  });

  it('should return the user normally', async () => {
    iamClient
      .on(GetUserCommand)
      .resolves({ User: { Arn: 'aws:arn:example:123456' } });
    let userArn;
    try {
      userArn = await iam.getUserArn();
    } catch (err) {
      //
    }
    expect(userArn).toBe('aws:arn:example:123456');
  });
});
