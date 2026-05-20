import { CONFIG_GIT_URL_UNAVAILABLE } from '../../../constants/error-messages.ts';
import { logger } from '../../../logger/index.ts';
import { parseGitAuthor } from '../../../util/git/author.ts';
import { parseUrl } from '../../../util/url.ts';
import type { GitUrlOption } from '../types.ts';

export function warnIfDefaultGitAuthorEmail(
  gitAuthor: string | undefined,
  isGHE: boolean | undefined,
): void {
  if (isGHE === true) {
    return;
  }
  const parsed = parseGitAuthor(
    gitAuthor ?? 'renovate@whitesourcesoftware.com',
  );
  if (parsed?.address === 'renovate@whitesourcesoftware.com') {
    logger.once.warn(
      {
        documentationUrl:
          'https://github.com/renovatebot/renovate/discussions/39309',
      },
      'Using the default gitAuthor email address, renovate@whitesourcesoftware.com, is not recommended on GitHub.com, as this corresponds to a user owned by Mend and used by users of the forking-renovate[bot] GitHub App. For security and authenticity reasons, Mend enables "Vigilant Mode" on this account to visibly flag unsigned commits. As an account you do not control, you will not be able to sign commits. If you are comfortable with the `Unverified` signatures on each commit, no work is needed. Otherwise, it is recommended to migrate to a user account you own',
    );
  }
}

export function getRepoUrl(
  repository: string,
  gitUrl: GitUrlOption | undefined,
  sshUrl: string | null,
  endpoint: string,
  authToken: string | null,
): string {
  if (gitUrl === 'ssh') {
    if (!sshUrl) {
      throw new Error(CONFIG_GIT_URL_UNAVAILABLE);
    }
    logger.debug(`Using ssh URL: ${sshUrl}`);
    return sshUrl;
  }

  const parsedEndpoint = parseUrl(endpoint);
  // v8 ignore if: endpoint is validated during initPlatform
  if (!parsedEndpoint) {
    throw new Error(`Invalid GitHub endpoint: ${endpoint}`);
  }
  if (authToken) {
    const [username, password] = authToken.split(':');
    parsedEndpoint.username = username;
    parsedEndpoint.password = password ?? '';
  }
  parsedEndpoint.host = parsedEndpoint.host.replace(
    'api.github.com',
    'github.com',
  );
  parsedEndpoint.pathname = `${repository}.git`;
  return parsedEndpoint.href;
}
