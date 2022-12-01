import {
  GetUserCommand,
  GetUserCommandOutput,
  IAMClient,
} from '@aws-sdk/client-iam';
import { logger } from '../../../logger';

let iam: IAMClient;

export function initIamClient(): void {
  if (!iam) {
    iam = new IAMClient({});
  }
}

/**
 * This method will throw an exception only in case we have no connection
 * 1) there is a connection and we return user.arn.
 * 2) there is a connection but no permission for the current user, we still get his user arn in the error message
 * 3) there is a problem in the connection to the aws api, then throw an error with the err
 */
export async function getUserArn(): Promise<string> {
  const cmd = new GetUserCommand({});
  let res;
  try {
    const userRes: GetUserCommandOutput = await iam.send(cmd);
    logger.debug(`succssfully got user : ${userRes}`);
    res = userRes?.User?.Arn;
  } catch (err) {
    logger.warn('Failed to get IAM user info');
    throw err;
  }

  return res ?? '';
}
