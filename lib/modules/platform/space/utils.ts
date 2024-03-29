import {CONFIG_GIT_URL_UNAVAILABLE} from "../../../constants/error-messages";
import {logger} from '../../../logger';
import * as hostRules from '../../../util/host-rules';
import {joinUrlParts} from '../../../util/url';

export const TAG_PULL_REQUEST_BODY = 'pull-request';

export function getSpaceRepoUrl(repository: string, endpoint: string): string {
  logger.debug(`getSpaceRepoUrl: repository=${repository}, endpoint=${endpoint}`);

  if (!endpoint.endsWith('.jetbrains.space')) {
    logger.debug('SPACE: invalid endpoint, it must looks like my-org-name.jetbrains.space')
    throw Error(CONFIG_GIT_URL_UNAVAILABLE)
  }

  if (repository.indexOf('/') === -1) {
    throw Error('Init: repository name must include project key, like my-project/my-repo (default project key is "main")')
  }

  // endpoint looks like <orgname>.jetbrains.space, picking the first part
  const orgName = endpoint.split('.')[0]

  const opts = hostRules.find({
    hostType: 'space',
    url: endpoint,
  });

  const url = new URL('https://git.jetbrains.space');
  if (!opts.token) {
    throw new Error('Init: You must configure a JetBrains Space token');
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
