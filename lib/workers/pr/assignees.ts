import ignore from 'ignore';
import { RenovateConfig } from '../../config';
import { Pr, platform } from '../../platform';
import { logger } from '../../logger';

export function assigneesFromConfig(config: RenovateConfig): Promise<string[]> {
  return Promise.resolve(config.assignees || []);
}

export async function assigneesFromCodeowners(
  config: RenovateConfig,
  pr: Pr
): Promise<string[]> {
  if (!config.assigneesFromCodeowners) {
    return [];
  }

  try {
    const codeowners =
      (await platform.getFile('CODEOWNERS', pr.targetBranch)) ||
      (await platform.getFile('.github/CODEOWNERS', pr.targetBranch)) ||
      (await platform.getFile('.gitlab/CODEOWNERS', pr.targetBranch)) ||
      (await platform.getFile('docs/CODEOWNERS', pr.targetBranch));

    if (!codeowners) {
      return [];
    }

    const prFiles = await platform.getPrFiles(pr.number);
    const rules = codeowners
      .split('\n')
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

    const matchingRule = rules.find((rule) => prFiles.every(rule.match));
    if (!matchingRule) {
      return [];
    }
    return matchingRule.usernames;
  } catch (err) {
    logger.debug({ err }, 'Failed to detrmine assignees from codeowners');
    return [];
  }
}
