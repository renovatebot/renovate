import { DateTime } from 'luxon';
import { logger } from '../../lib/logger';
import { GithubHttp } from '../../lib/util/http/github';
import { getQueryString } from '../../lib/util/url';

const gitHubApiUrl = 'https://api.github.com/search/issues?';

export type GithubApiQueryResponse = {
  total_count: number;
  incomplete_results: boolean;
  items: ItemsEntity[];
};

export type ItemsEntity = {
  html_url: string;
  number: number;
  title: string;
  labels: LabelsEntity[];
};

export type LabelsEntity = {
  name: string;
};

export interface GitHubIssues {
  bugs: ItemsEntity[];
  features: ItemsEntity[];
}

export async function getOpenGitHubItems(): Promise<ItemsEntity[]> {
  const q = `repo:renovatebot/renovate type:issue is:open -label:priority-5-triage`;
  const per_page = 100;
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
    return res.body?.items ?? [];
  } catch (err) {
    logger.error({ err }, 'Error getting query results');
    throw err;
  }
  return [];
}

export function extractIssues(
  issuesMap: Record<string, GitHubIssues>,
  items: ItemsEntity[],
  labelPrefix: string
): void {
  if (!items || !issuesMap) {
    return;
  }
  for (const item of items) {
    const type = item.labels
      .find((l) => l.name.startsWith('type:'))
      ?.name.split(':')[1];
    if (!type) {
      continue;
    }
    const label = item.labels
      .find((l) => l.name.startsWith(labelPrefix))
      ?.name.split(':')[1];
    if (!label) {
      continue;
    }
    if (!issuesMap[label]) {
      issuesMap[label] = { bugs: [], features: [] };
    }
    switch (type) {
      case 'bug':
        issuesMap[label].bugs.push(item);
        break;
      case 'feature':
        issuesMap[label].features.push(item);
        break;
      default:
        break;
    }
  }
}

export function stringifyIssues(items: ItemsEntity[]): [string, number] {
  if (!items) {
    return ['', 0];
  }
  let list = '';
  for (const item of items) {
    list += ` - ${item.title} [#${item.number}](${item.html_url})\n`;
  }
  return [list, items.length];
}

export function generateFeatureAndBugMarkdown(
  issuesMap: Record<string, GitHubIssues>,
  key: string
): string {
  let md = '';
  const [featureList] = stringifyIssues(issuesMap[key]?.features);
  const [bugList] = stringifyIssues(issuesMap[key]?.bugs);

  if (featureList || bugList) {
    md += '## Open items\n\n';
  }

  if (featureList || bugList) {
    const now = DateTime.utc().toFormat('MMMM dd, yyyy');
    const lists = `list of ${featureList ? 'features' : ''}${
      featureList && bugList ? ' and ' : ''
    }${bugList ? 'bugs' : ''}`;
    md += `The below ${lists} were current when this page was generated on ${now}.\n\n`;
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

  return md;
}
