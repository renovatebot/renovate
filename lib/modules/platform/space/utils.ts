import {logger} from '../../../logger';
import * as hostRules from '../../../util/host-rules';
import {joinUrlParts} from '../../../util/url';

export const TAG_PULL_REQUEST_BODY = 'pull-request';

export function getSpaceRepoUrl(repository: string, endpoint: string): string {
  logger.debug(`getSpaceRepoUrl: repository=${repository}, endpoint=${endpoint}`);
  const orgName = endpoint.split('.')[0]

  // Find options for current host and determine Git endpoint
  const opts = hostRules.find({
    hostType: 'space',
    url: endpoint,
  });

  const url = new URL('https://git.jetbrains.space');
  if (!opts.token) {
    throw new Error(
      'Init: You must configure a JetBrains Space token',
    );
  }
  url.username = 'username-doesnt-matter';
  url.password = opts.token;
  url.pathname = joinUrlParts(
    orgName,
    repository
  );

  logger.debug(
    { url: url.toString() },
    'using URL based on configured endpoint',
  );
  return url.toString();
}
