import { GetUserCommand, IAMClient } from '@aws-sdk/client-iam';
import { mockClient } from 'aws-sdk-client-mock';
import * as iam from './iam-client';

describe('modules/platform/codecommit/iam-client', () => {
  const iamClient = mockClient(IAMClient);
  iam.initIamClient();

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
});
