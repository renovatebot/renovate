import {
  GetUserCommand,
  GetUserCommandOutput,
  IAMClient,
} from '@aws-sdk/client-iam';
import type { Credentials } from '@aws-sdk/types';
import { regEx } from '../../../util/regex';

let iam: IAMClient;

export function initIamClient(
  region: string,
  credentials: Credentials
): IAMClient {
  if (!iam) {
    iam = new IAMClient({
      region: region,
      credentials: credentials,
    });
  }
  return iam;
}

const userRe = regEx(/User:\s*(?<arn>[^ ]+).*/);

export async function getUserArn(): Promise<string> {
  const cmd = new GetUserCommand({});
  let res;
  try {
    const userRes: GetUserCommandOutput = await iam.send(cmd);
    res = userRes.User?.Arn;
  } catch (err) {
    const match = userRe.exec(err.message);
    if (match) {
      res = match.groups?.arn;
    }
    if (!res) {
      throw new Error(err.message);
    }
  }

  return res ?? '';
}
