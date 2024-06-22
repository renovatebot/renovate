import { ECR, ECRClientConfig } from '@aws-sdk/client-ecr';
import { logger } from '../../../logger';
import type { HostRule } from '../../../types';
import type { HttpError } from '../../../util/http';
import type { HttpResponse } from '../../../util/http/types';
import { regEx } from '../../../util/regex';
import { addSecretForSanitizing } from '../../../util/sanitize';

export const ecrRegex = regEx(
  /\d+\.dkr\.ecr(?:-fips)?\.([-a-z0-9]+)\.amazonaws\.com/,
);
export const ecrPublicRegex = regEx(/public\.ecr\.aws/);

export async function getECRAuthToken(
  region: string,
  opts: HostRule,
): Promise<string | null> {
  const config: ECRClientConfig = { region };
  if (opts.username && opts.password) {
    config.credentials = {
      accessKeyId: opts.username,
      secretAccessKey: opts.password,
      ...(opts.token && { sessionToken: opts.token }),
    };
  }

  const ecr = new ECR(config);
  try {
    const data = await ecr.getAuthorizationToken({});
    const authorizationToken = data?.authorizationData?.[0]?.authorizationToken;
    if (authorizationToken) {
      // sanitize token
      addSecretForSanitizing(authorizationToken);
      return authorizationToken;
    }
    logger.warn(
      'Could not extract authorizationToken from ECR getAuthorizationToken response',
    );
  } catch (err) {
    logger.trace({ err }, 'err');
    logger.warn('ECR getAuthorizationToken error');
  }
  return null;
}

export function isECRMaxResultsError(err: HttpError): boolean {
  const resp = err.response as HttpResponse<any> | undefined;
  return !!(
    resp?.statusCode === 405 &&
    resp.headers?.['docker-distribution-api-version'] &&
    // https://docs.aws.amazon.com/AmazonECR/latest/APIReference/API_DescribeRepositories.html#ECR-DescribeRepositories-request-maxResults
    resp.body?.['errors']?.[0]?.message?.includes(
      'Member must have value less than or equal to 1000',
    )
  );
}
