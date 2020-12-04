import ignore from 'ignore';
import { logger } from '../../logger';
import { Pr } from '../../platform';
import { readLocalFile } from '../../util/fs';
import { getBranchFiles } from '../../util/git';

export async function codeOwnersForPr(pr: Pr): Promise<string[]> {
  logger.debug('Searching for CODEOWNERS file');
  try {
    const codeOwnersFile =
      (await readLocalFile('CODEOWNERS', 'utf8')) ||
      (await readLocalFile('.github/CODEOWNERS', 'utf8')) ||
      (await readLocalFile('.gitlab/CODEOWNERS', 'utf8')) ||
      (await readLocalFile('docs/CODEOWNERS', 'utf8'));

    if (!codeOwnersFile) {
      logger.debug('No CODEOWNERS file found');
      return [];
    }

    logger.debug(`Found CODEOWNERS file: ${codeOwnersFile}`);

    const prFiles = await getBranchFiles(pr.sourceBranch);
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
    logger.debug(
      { prFiles, rules },
      'PR files and rules to match for CODEOWNERS'
    );
    const matchingRule = rules.find((rule) => prFiles?.every(rule.match));
    if (!matchingRule) {
      logger.debug('No matching CODEOWNERS rule found');
      return [];
    }
    logger.debug(
      `CODEOWNERS matched the following usernames: ${JSON.stringify(
        matchingRule.usernames
      )}`
    );
    return matchingRule.usernames;
  } catch (err) {
    logger.warn({ err, pr }, 'Failed to determine CODEOWNERS for PR.');
    return [];
  }
}
