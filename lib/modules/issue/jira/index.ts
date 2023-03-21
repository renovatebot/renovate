import { logger } from '../../../logger';
import { JiraHttp, setBaseUrl } from '../../../util/http/jira';
import { regEx } from '../../../util/regex';
import { sanitize } from '../../../util/sanitize';
import type {
  EnsureIssueConfig,
  EnsureIssueResult,
  Issue,
} from '../../platform/types';
import { smartTruncate } from '../../platform/utils/pr-body';
import { readOnlyIssueBody } from '../../platform/utils/read-only-issue-body';
import { IssueCollector } from '../issue-collector';
import type {
  JiraIssue,
  JiraSearchResponse,
  JiraTransitionsResponse,
} from './types';
import * as utils from './utils';

export class JiraIssueCollector extends IssueCollector {
  static readonly id = 'jira';

  constructor() {
    super(JiraIssueCollector.id);
    this.http = new JiraHttp();
    setBaseUrl(getJiraCloudUrl());
  }

  getIssue(number: number, useCache?: boolean): Promise<Issue | null> {
    logger.warn(`getIssue() is not implemented`);
    return Promise.resolve(null);
  }

  async getIssueList(): Promise<Issue[]> {
    logger.debug(`getIssueList()`);
    const projectKey = getProjectKey();

    try {
      const jql = encodeURIComponent(
        [
          `project = "${projectKey}"`,
          `reporter = currentUser()`,
          'status != "done"',
        ].join(' AND ')
      );

      const jiraIssues = await this.http.getJson<JiraSearchResponse>(
        `/rest/api/3/search?jql=${jql}`
      );

      const issues: Issue[] = [];
      for (const issue of jiraIssues.body.issues) {
        issues.push({
          number: issue.id,
          title: issue.fields.summary,
          body: utils.convertAtlassianDocumentFormatToMarkdown(
            issue.fields.description
          ),
          state: 'OPEN', // TODO Fix me
        });
      }

      return issues;
    } catch (err) {
      logger.warn({ err }, 'Error finding jira issues');
      return [];
    }
  }

  async findIssue(title: string): Promise<Issue | null> {
    logger.debug(`Jira: findIssue(${title})`);

    const issues = await this.findOpenIssues(title);
    if (!issues.length) {
      return null;
    }
    if (issues.length > 1) {
      logger.error(
        `Jira: findIssue found more than one issue with title ${title}. This should not happen.`
      );
    }
    const [issue] = issues;

    return {
      number: issue.id,
      body: utils.convertAtlassianDocumentFormatToMarkdown(
        issue.fields.description
      ),
    };
  }

  async ensureIssue({
    title,
    reuseTitle,
    body,
  }: EnsureIssueConfig): Promise<EnsureIssueResult | null> {
    logger.debug(`ensureIssue()`);

    const projectKey = getProjectKey();

    let description = readOnlyIssueBody(sanitize(body));
    description = this.massageMarkdown(description);

    try {
      let issues = await this.findOpenIssues(title);
      if (!issues.length && reuseTitle) {
        issues = await this.findOpenIssues(reuseTitle);
      }
      if (issues.length) {
        // Close any duplicates
        for (const issue of issues.slice(1)) {
          await this.closeIssue(issue.key);
        }
        const [issue] = issues;

        if (
          issue.fields.summary !== title ||
          issue.fields.description !==
            utils.convertMarkdownToAtlassianDocumentFormat(description.trim())
        ) {
          await this.http.putJson(`/rest/api/3/issue/${issue.key}`, {
            body: {
              fields: {
                summary: title,
                description:
                  utils.convertMarkdownToAtlassianDocumentFormat(description),
              },
            },
          });

          logger.info(`Jira issue ${issue.key} updated`);

          return 'updated';
        }
      } else {
        await this.http.postJson(`/rest/api/3/issue`, {
          body: {
            fields: {
              project: {
                key: projectKey,
              },
              summary: title,
              description:
                utils.convertMarkdownToAtlassianDocumentFormat(description),
              issuetype: {
                name: 'Task',
              },
              labels: ['RENOVATE'],
            },
          },
        });

        logger.info(`Jira issue created in project ${projectKey}`);

        return 'created';
      }
    } catch (err) /* istanbul ignore next */ {
      logger.warn({ err }, 'Could not ensure jira issue');
    }
    return null;
  }

  async closeIssue(issueKey: string): Promise<void> {
    const transitions = await this.http.getJson<JiraTransitionsResponse>(
      `/rest/api/3/issue/${issueKey}/transitions`
    );

    for (const transition of transitions.body.transitions) {
      if (transition.to.statusCategory.key === 'done') {
        logger.debug(`closeIssue: closing issue ${issueKey}`);

        await this.http.postJson(`/rest/api/3/issue/${issueKey}/transitions`, {
          body: {
            transition: {
              id: transition.id,
            },
          },
        });

        return;
      }
    }

    logger.debug('Error closeIssue');
  }

  async ensureIssueClosing(title: string): Promise<void> {
    const issues = await this.findOpenIssues(title);
    for (const issue of issues) {
      await this.closeIssue(issue.key);
    }
  }

  async findOpenIssues(title: string): Promise<JiraIssue[]> {
    const projectKey = getProjectKey();

    try {
      const jql = encodeURIComponent(
        [
          `summary ~ "${title}"`,
          `project = "${projectKey}"`,
          `reporter = currentUser()`,
          'status != "done"', //TODO - Should we only check for `new` or `open` issues, or is not done also ok?
        ].join(' AND ')
      );

      return (
        (
          await this.http.getJson<{ issues: JiraIssue[] }>(
            `/rest/api/3/search?jql=${jql}`
          )
        ).body.issues || /* istanbul ignore next */ []
      );
    } catch (err) /* istanbul ignore next */ {
      logger.warn({ err }, 'Error finding open jira issues');
      return [];
    }
  }

  massageMarkdown(input: string): string {
    const repositoryUrl = getRepositoryUrl();

    // Remove any HTML we use
    return smartTruncate(input, 50000)
      .replace(
        'you tick the rebase/retry checkbox',
        'by renaming this PR to start with "rebase!"'
      )
      .replace(regEx(/<\/?summary>/g), '**')
      .replace(regEx(/<\/?(details|blockquote)>/g), '')
      .replace(regEx(`\n---\n\n.*?<!-- rebase-check -->.*?\n`), '')
      .replace(regEx(/\]\(\.\.\/pull\//g), `](${repositoryUrl}/pull-requests/`)
      .replace(regEx(/<!--renovate-(?:debug|config-hash):.*?-->/g), '')
      .replace(regEx(/\]\(\.\.\/\.\.\/pull-requests\//g), ``)
      .replace(regEx(/\*\*\n\n\n\*\*/g), '\n#### ') // Level 4 heading for package types
      .replace(regEx(/\n\n\*\*/g), '\n### ') // Level 3 heading for managers
      .replace(regEx(/\*\*/g), '') // Remove closing bold tags
      .replace(regEx(/WARN:/g), '⚠️'); // WARN to use emoji
  }
}

/**
 * TODO - What is the best way to retrieve these per repository to use in the Jira Issue Collector?
 * Retrieving this may vary between platforms(ie: Bitbucket repositories can be natively linked)
 */
function getProjectKey(): string {
  return 'somekey';
}

/**
 * TODO - What is the best way to retrieve these per repository to use in the Jira Issue Collector?
 * Retrieving this may vary between platforms(ie: Bitbucket repositories can be natively linked)
 */
function getJiraCloudUrl(): string {
  return 'https://someorg.atlassian.net';
}

function getRepositoryUrl(): string {
  return `${getJiraCloudUrl()}/browse/${getProjectKey()}`;
}

//  try {
//       const jiraProjects =
//         await bitbucketHttp.getJson<BitbucketJiraProjectsResponse>(
//           `/internal/repositories/${repository}/jira/projects`
//         );

//       // Currently only handle repositories with a single jira project
//       if (jiraProjects.body.values.length === 1) {
//         config = {
//           ...config,
//           hasJiraProjectLinked: true,
//           jiraProjectKey: jiraProjects.body.values[0].project.key,
//           jiraCloudUrl: jiraProjects.body.values[0].project.site.cloudUrl,
//         };

//         setJiraBaseUrl(config.jiraCloudUrl);
//       } else if (jiraProjects.body.values.length > 1) {
//         logger.debug(
//           `Multiple Jira Projects found linked to repository ${repository}.  Functionality currently only supports at most 1 linked Jira Project.`
//         );
//       } else {
//         logger.debug(`No Jira Projects linked to repository ${repository}`);
//       }
