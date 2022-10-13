import { GetUserCommand, IAMClient } from '@aws-sdk/client-iam';
import { mockClient } from 'aws-sdk-client-mock';
import { PLATFORM_BAD_CREDENTIALS } from '../../../constants/error-messages';
import * as iam from './iam-client';

describe('modules/platform/codecommit/iam-client', () => {
  const iamClient = mockClient(IAMClient);
  iam.initIamClient('eu-east', {
    accessKeyId: 'aaa',
    secretAccessKey: 'bbb',
  });

  it('should return empty', async () => {
    iamClient.on(GetUserCommand).resolves({});
    await expect(iam.getUserArn()).resolves.toMatch('');
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
    await expect(iam.getUserArn()).resolves.toMatch('aws:arn:example:123456');
  });

  it('should throw in case of bad authentication', async () => {
    const err = new Error(PLATFORM_BAD_CREDENTIALS);
    iamClient.on(GetUserCommand).rejects(err);
    await expect(iam.getUserArn()).rejects.toThrow(err);
  });

  it('should return the user arn, even though user has no permission', async () => {
    iamClient
      .on(GetUserCommand)
      .rejects(new Error('User: aws:arn:example:123456 has no permissions'));
    await expect(iam.getUserArn()).resolves.toMatch('aws:arn:example:123456');
  });
});
