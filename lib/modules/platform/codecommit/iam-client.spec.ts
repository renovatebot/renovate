import { GetUserCommand, IAMClient } from '@aws-sdk/client-iam';
import { mockClient } from 'aws-sdk-client-mock';
import { PLATFORM_BAD_CREDENTIALS } from '../../../constants/error-messages';

describe('modules/platform/codecommit/iam-client', () => {
  const iam = require('./iam-client');
  const iamClient = mockClient(IAMClient);

  beforeAll(() => {
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
    iamClient.on(GetUserCommand).rejectsOnce(undefined);
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
    iamClient.on(GetUserCommand).resolves({
      User: {
        Arn: 'aws:arn:example:123456',
        UserName: 'someone',
        UserId: 'something',
        Path: 'somewhere',
        CreateDate: new Date(),
      },
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
