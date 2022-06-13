import { DateTime } from 'luxon';
import type { RenovateConfig } from '../../lib/config/types';
import { logger } from '../../lib/logger';
import { getManagers } from '../../lib/modules/manager';
import * as hostRules from '../../lib/util/host-rules';
import { GithubHttp } from '../../lib/util/http/github';
import { getQueryString } from '../../lib/util/url';
import { readFile, updateFile } from '../utils';
import type { GithubApiQueryResponse, ItemsEntity } from './github-query-items';
import { getDisplayName, getNameWithUrl, replaceContent } from './utils';

const gitHubApiUrl = 'https://api.github.com/search/issues?';

if (process.env.GITHUB_TOKEN) {
  logger.debug('Using GITHUB_TOKEN from env');
  hostRules.add({
    matchHost: 'api.github.com',
    token: process.env.GITHUB_TOKEN,
  });
}

interface ManagerIssues {
  bugs: ItemsEntity[];
  features: ItemsEntity[];
}

function getTitle(manager: string, displayName: string): string {
  if (manager === 'regex') {
    return `Custom Manager Support using Regex`;
  }
  return `Automated Dependency Updates for ${displayName}`;
}

function getManagerLink(manager: string): string {
  return `[\`${manager}\`](${manager}/)`;
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
  managerIssuesMap: Record<string, ManagerIssues>,
  items: ItemsEntity[]
): void {
  if (!items || !managerIssuesMap) {
    return;
  }
  for (const item of items) {
    const type = item.labels
      .find((l) => l.name.startsWith('type:'))
      ?.name.split(':')[1];
    if (!type) {
      continue;
    }
    const manager = item.labels
      .find((l) => l.name.startsWith('manager:'))
      ?.name.split(':')[1];
    if (!manager) {
      continue;
    }
    if (!managerIssuesMap[manager]) {
      managerIssuesMap[manager] = { bugs: [], features: [] };
    }
    switch (type) {
      case 'bug':
        managerIssuesMap[manager].bugs.push(item);
        break;
      case 'feature':
        managerIssuesMap[manager].features.push(item);
        break;
      default:
        break;
    }
  }
}

export async function getManagersGitHubIssues(): Promise<
  Record<string, ManagerIssues>
> {
  const q = `repo:renovatebot/renovate type:issue is:open -label:priority-5-triage`;
  const per_page = 100;
  const managerIssuesMap: Record<string, ManagerIssues> = {};
  const githubApi = new GithubHttp('manager-issues');
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
      managerIssuesMap,
      items.sort((a, b) => a.number - b.number)
    );
  } catch (err) {
    logger.error({ err }, 'Error getting query results');
    throw err;
  }
  return managerIssuesMap;
}

export async function generateManagers(dist: string): Promise<void> {
  const managers = getManagers();
  const managerIssuesMap = await getManagersGitHubIssues();
  const allLanguages: Record<string, string[]> = {};
  for (const [manager, definition] of managers) {
    const language = definition.language ?? 'other';
    allLanguages[language] = allLanguages[language] || [];
    allLanguages[language].push(manager);
    const { defaultConfig, supportedDatasources } = definition;
    const { fileMatch } = defaultConfig as RenovateConfig;
    const displayName = getDisplayName(manager, definition);
    let md = `---
title: ${getTitle(manager, displayName)}
sidebar_label: ${displayName}
---
`;
    if (manager !== 'regex') {
      const nameWithUrl = getNameWithUrl(manager, definition);
      md += `Renovate supports updating ${nameWithUrl} dependencies.\n\n`;
      if (defaultConfig.enabled === false) {
        md += '## Enabling\n\n';
        md += `${displayName} functionality is currently in beta testing so you must opt in to test it out. To enable it, add a configuration like this to either your bot config or your \`renovate.json\`:\n\n`;
        md += '```\n';
        md += `{\n  "${manager}": {\n    "enabled": true\n  }\n}`;
        md += '\n```\n\n';
        md +=
          'If you find any bugs, please [raise a bug report](https://github.com/renovatebot/renovate/issues/new?template=3-Bug_report.md). If you find that it works well, then feedback on that would be welcome too.\n\n';
      }
      md += '## File Matching\n\n';
      if (!Array.isArray(fileMatch) || fileMatch.length === 0) {
        md += `Because file names for \`${manager}\` cannot be easily determined automatically, Renovate will not attempt to match any \`${manager}\` files by default. `;
      } else {
        md += `By default, Renovate will check any files matching `;
        if (fileMatch.length === 1) {
          md += `the following regular expression: \`${fileMatch[0]}\`.\n\n`;
        } else {
          md += `any of the following regular expressions:\n\n`;
          md += '```\n';
          md += fileMatch.join('\n');
          md += '\n```\n\n';
        }
      }
      md += `For details on how to extend a manager's \`fileMatch\` value, please follow [this link](/modules/manager/#file-matching).\n\n`;
      md += '## Supported datasources\n\n';
      const escapedDatasources = (supportedDatasources || [])
        .map(
          (datasource) =>
            `[\`${datasource}\`](../../datasource/#${datasource}-datasource)`
        )
        .join(', ');
      md += `This manager supports extracting the following datasources: ${escapedDatasources}.\n\n`;
    }
    const managerReadmeContent = await readFile(
      `lib/modules/manager/${manager}/readme.md`
    );
    if (manager !== 'regex') {
      md += '\n## Additional Information\n\n';
    }
    md += managerReadmeContent + '\n\n';

    const [featureList] = stringifyIssues(managerIssuesMap[manager]?.features);
    if (featureList) {
      md += '## Open feature requests\n\n';
      md += featureList;
      md += '\n';
    }

    const [bugList] = stringifyIssues(managerIssuesMap[manager]?.bugs);
    if (bugList) {
      md += '## Open bug reports\n\n';
      md += bugList;
      md += '\n';
    }

    if (featureList || bugList) {
      const now = DateTime.utc().toFormat('MMMM dd, yyyy');
      const lists = `list of ${featureList ? 'features' : ''}${
        featureList && bugList ? ' and ' : ''
      }${bugList ? 'bugs' : ''}`;
      md += '\n\n';
      md += `The above ${lists} were current when this page was generated on ${now}.\n`;
    }

    await updateFile(`${dist}/modules/manager/${manager}/index.md`, md);
  }
  const languages = Object.keys(allLanguages).filter(
    (language) => language !== 'other'
  );
  languages.sort();
  languages.push('other');
  let languageText = '\n';

  for (const language of languages) {
    languageText += `**${language}**: `;
    languageText += allLanguages[language].map(getManagerLink).join(', ');
    languageText += '\n\n';
  }
  let indexContent = await readFile(`docs/usage/modules/manager.md`);
  indexContent = replaceContent(indexContent, languageText);
  await updateFile(`${dist}/modules/manager.md`, indexContent);
}
