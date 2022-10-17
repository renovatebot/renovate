import {
  GetUserCommand,
  GetUserCommandOutput,
  IAMClient,
} from '@aws-sdk/client-iam';
import type { Credentials } from '@aws-sdk/types';
import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';

let iam: IAMClient;

export function initIamClient(region: string, credentials: Credentials): void {
  if (!iam) {
    iam = new IAMClient({
      region,
      credentials,
    });
  }
}

const userRe = regEx(/User:\s*(?<arn>[^ ]+).*/);

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
    res = userRes?.User?.Arn;
  } catch (err) {
    const match = userRe.exec(err.message);
    if (match) {
      logger.warn(
        'It is recommended to add "IAMReadOnlyAccess" policy to this IAM user'
      );
      res = match.groups?.arn;
    }
    if (!res) {
      logger.warn(
        'Failed to get IAM user info, Make sure your user has "IAMReadOnlyAccess" policy'
      );
      throw err;
    }
  }

  return res ?? '';
}
