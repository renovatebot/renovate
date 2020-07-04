import ignore from 'ignore';
import { logger } from '../../logger';
import { Pr, platform } from '../../platform';
import * as git from '../../util/git';

export async function codeOwnersForPr(pr: Pr): Promise<string[]> {
  try {
    const codeOwnersFile =
      (await git.getFile('CODEOWNERS', pr.targetBranch)) ||
      (await git.getFile('.github/CODEOWNERS', pr.targetBranch)) ||
      (await git.getFile('.gitlab/CODEOWNERS', pr.targetBranch)) ||
      (await git.getFile('docs/CODEOWNERS', pr.targetBranch));

    if (!codeOwnersFile) {
      return [];
    }

    const prFiles = await platform.getPrFiles(pr);
    const rules = codeOwnersFile
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const [pattern, ...usernames] = line.split(/\s+/);
        return {
          usernames,
          match: (path: string) => {
            const matcher = ignore().add(pattern);
            return matcher.ignores(path);
          },
        };
      })
      .reverse();

    const matchingRule = rules.find((rule) => prFiles?.every(rule.match));
    if (!matchingRule) {
      return [];
    }
    return matchingRule.usernames;
  } catch (err) {
    logger.warn({ err, pr }, 'Failed to determine code owners for PR.');
    return [];
  }
}
