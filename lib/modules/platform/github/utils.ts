import { logger } from '../../../logger/index.ts';
import { parseGitAuthor } from '../../../util/git/author.ts';

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
