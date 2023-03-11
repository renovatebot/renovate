import { DateTime } from 'luxon';
import { logger } from '../../lib/logger';
import { getPlatformList, getPlatforms } from '../../lib/modules/platform';
import * as hostRules from '../../lib/util/host-rules';
import { GithubHttp } from '../../lib/util/http/github';
import { getQueryString } from '../../lib/util/url';
import { readFile, updateFile } from '../utils';
import type { GithubApiQueryResponse, ItemsEntity } from './github-query-items';
import { getModuleLink, replaceContent } from './utils';

const gitHubApiUrl = 'https://api.github.com/search/issues?';

if (process.env.GITHUB_TOKEN) {
  logger.debug('Using GITHUB_TOKEN from env');
  hostRules.add({
    matchHost: 'api.github.com',
    token: process.env.GITHUB_TOKEN,
  });
}

interface PlatformIssues {
  bugs: ItemsEntity[];
  features: ItemsEntity[];
}

function stringifyIssues(items: ItemsEntity[]): [string, number] {
  if (!items) {
    return ['', 0];
  }
  let list = '';
  for (const item of items) {
    list += ` - ${item.title} [#${item.number}](${item.html_url})\n`;
  }
  return [list, items.length];
}

function extractIssues(
  platformIssuesMap: Record<string, PlatformIssues>,
  items: ItemsEntity[]
): void {
  if (!items || !platformIssuesMap) {
    return;
  }
  for (const item of items) {
    const type = item.labels
      .find((l) => l.name.startsWith('type:'))
      ?.name.split(':')[1];
    if (!type) {
      continue;
    }
    const platform = item.labels
      .find((l) => l.name.startsWith('platform:'))
      ?.name.split(':')[1];
    if (!platform) {
      continue;
    }
    if (!platformIssuesMap[platform]) {
      platformIssuesMap[platform] = { bugs: [], features: [] };
    }
    switch (type) {
      case 'bug':
        platformIssuesMap[platform].bugs.push(item);
        break;
      case 'feature':
        platformIssuesMap[platform].features.push(item);
        break;
      default:
        break;
    }
  }
}

export async function getPlatformGitHubIssues(): Promise<
  Record<string, PlatformIssues>
> {
  const q = `repo:renovatebot/renovate type:issue is:open -label:priority-5-triage`;
  const per_page = 100;
  const platformIssuesMap: Record<string, PlatformIssues> = {};
  const githubApi = new GithubHttp();
  try {
    const query = getQueryString({ q, per_page });
    const res = await githubApi.getJson<GithubApiQueryResponse>(
      gitHubApiUrl + query,
      {
        paginationField: 'items',
        paginate: true,
      }
    );
    const items = res.body?.items ?? [];
    extractIssues(
      platformIssuesMap,
      items.sort((a, b) => a.number - b.number)
    );
  } catch (err) {
    logger.error({ err }, 'Error getting query results');
    throw err;
  }
  return platformIssuesMap;
}

export async function generatePlatforms(dist: string): Promise<void> {
  let platformContent = 'Supported values for `platform` are: ';
  const platforms = getPlatformList();
  for (const platform of platforms) {
    const readme = await readFile(`lib/modules/platform/${platform}/index.md`);
    await updateFile(`${dist}/modules/platform/${platform}/index.md`, readme);
  }

  platformContent += platforms
    .map((v) => getModuleLink(v, `\`${v}\``))
    .join(', ');

  platformContent += '.\n';

  const indexFileName = `docs/usage/modules/platform/index.md`;
  let indexContent = await readFile(indexFileName);
  indexContent = replaceContent(indexContent, platformContent);
  await updateFile(`${dist}/modules/platform/index.md`, indexContent);

  await generatePlatformOpenFeaturesAndBugs(dist);
}

export async function generatePlatformOpenFeaturesAndBugs(
  dist: string
): Promise<void> {
  const platforms = getPlatforms();
  const platformIssuesMap = await getPlatformGitHubIssues();

  for (const [platform] of platforms) {
    const platformReadmeContent = await readFile(
      `lib/modules/platform/${platform}/index.md`
    );

    let md = platformReadmeContent + '\n\n';

    const [featureList] = stringifyIssues(
      platformIssuesMap[platform]?.features
    );
    const [bugList] = stringifyIssues(platformIssuesMap[platform]?.bugs);

    if (featureList || bugList) {
      md += '## Open issues\n\n';
    }

    if (featureList) {
      md += '### Feature requests\n\n';
      md += featureList;
      md += '\n';
    }

    if (bugList) {
      md += '### Bug reports\n\n';
      md += bugList;
      md += '\n';
    }

    if (featureList || bugList) {
      const now = DateTime.utc().toFormat('MMMM dd, yyyy');
      const lists = `list of ${featureList ? 'features' : ''}${
        featureList && bugList ? ' and ' : ''
      }${bugList ? 'bugs' : ''}`;
      md += '\n';
      md += `The above ${lists} were current when this page was generated on ${now}.\n`;
    }

    await updateFile(`${dist}/modules/platform/${platform}/index.md`, md);
  }
}
