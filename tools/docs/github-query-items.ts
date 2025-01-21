import fs from 'fs-extra';
import { DateTime } from 'luxon';
import { logger } from '../../lib/logger';
import { getIssuesByIssueTypeQuery } from '../../lib/modules/platform/github/graphql';
import * as hostRules from '../../lib/util/host-rules';
import { GithubHttp } from '../../lib/util/http/github';

const githubApi = new GithubHttp();

if (process.env.GITHUB_TOKEN) {
  logger.info('Using GITHUB_TOKEN from env');
  hostRules.add({
    matchHost: 'api.github.com',
    token: process.env.GITHUB_TOKEN,
  });
}

export type ItemsEntity = {
  html_url: string;
  number: number;
  title: string;
  labels: LabelsEntity[];
  issueType: 'Bug' | 'Feature';
};

export type LabelsEntity = {
  name: string;
};

export interface RenovateOpenItems {
  managers: OpenItems;
  platforms: OpenItems;
  datasources: OpenItems;
  versionings: OpenItems;
}

export type OpenItems = Record<string, Items | undefined>;

export interface Items {
  bugs: ItemsEntity[];
  features: ItemsEntity[];
}

async function getIssuesByIssueType(
  issueType: 'Bug' | 'Feature',
): Promise<ItemsEntity[]> {
  const queryString = `type:${issueType}, repo:renovatebot/renovate, state:open`;
  const res = (await githubApi.querySearchField<unknown>(
    getIssuesByIssueTypeQuery,
    'search',
    {
      variables: {
        queryStr: queryString,
      },
      paginate: true,
      readOnly: true,
    },
  )) as {
    labels: { nodes: { name: string }[] };
    number: number;
    title: string;
    url: string;
  }[];

  return (
    res.map((issue) => {
      return {
        ...issue,
        issueType,
        labels: issue.labels.nodes,
        html_url: issue.url,
      };
    }) ?? []
  );
}

export async function getOpenGitHubItems(): Promise<RenovateOpenItems> {
  const result: RenovateOpenItems = {
    managers: {},
    platforms: {},
    datasources: {},
    versionings: {},
  };

  if (process.env.SKIP_GITHUB_ISSUES) {
    logger.warn('Skipping GitHub issues');
    return result;
  }

  try {
    let rawItems: ItemsEntity[] = [];
    const bugs = await getIssuesByIssueType('Bug');
    const features = await getIssuesByIssueType('Feature');
    // eslint-disable-next-line
    console.log(bugs.length, features.length);

    rawItems = rawItems.concat(bugs).concat(features);

    // eslint-disable-next-line
    console.log(rawItems.length);
    result.managers = extractIssues(rawItems, 'manager:');
    result.platforms = extractIssues(rawItems, 'platform:');
    result.datasources = extractIssues(rawItems, 'datasource:');
    result.versionings = extractIssues(rawItems, 'versioning:');

    await fs.writeFile('openitems.json', JSON.stringify(result));
    return result;
  } catch (err) {
    logger.error({ err }, 'Error getting query results');
    if (process.env.CI) {
      throw err;
    }
    return result;
  }
}

function extractIssues(items: ItemsEntity[], labelPrefix: string): OpenItems {
  const issuesMap: OpenItems = {};

  for (const item of items) {
    const type = item.issueType;

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
      case 'Bug':
        issuesMap[label]?.bugs.push(item);
        break;
      case 'Feature':
        issuesMap[label]?.features.push(item);
        break;
      default:
        break;
    }
  }

  return issuesMap;
}

function stringifyIssues(items: ItemsEntity[] | undefined): string {
  if (!items) {
    return '';
  }
  let list = '';
  for (const item of items) {
    list += ` - ${item.title} [#${item.number}](${item.html_url})\n`;
  }
  return list;
}

export function generateFeatureAndBugMarkdown(
  issuesMap: OpenItems,
  key: string,
): string {
  let md = '\n\n';

  const featureList = stringifyIssues(issuesMap[key]?.features);
  const bugList = stringifyIssues(issuesMap[key]?.bugs);

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
