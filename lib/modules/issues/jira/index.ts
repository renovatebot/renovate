import { logger } from '../../../logger';
import { JiraHttp } from '../../../util/http/jira';
import { regEx } from '../../../util/regex';
import { sanitize } from '../../../util/sanitize';
import type {
  EnsureIssueConfig,
  EnsureIssueResult,
  Issue,
} from '../../platform/types';
import { smartTruncate } from '../../platform/utils/pr-body';
import { readOnlyIssueBody } from '../../platform/utils/read-only-issue-body';
import type {
  JiraIssue,
  JiraSearchResponse,
  JiraTransitionsResponse,
} from './types';
import * as utils from './utils';

const jiraHttp = new JiraHttp();

export async function findIssue(
  title: string,
  projectKey: string
): Promise<Issue | null> {
  logger.debug(`Jira: findIssue(${title})`);

  const issues = await findOpenIssues(title, projectKey);
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

export async function findOpenIssues(
  title: string,
  projectKey: string
): Promise<JiraIssue[]> {
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
        await jiraHttp.getJson<{ issues: JiraIssue[] }>(
          `/rest/api/3/search?jql=${jql}`
        )
      ).body.issues || /* istanbul ignore next */ []
    );
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Error finding open jira issues');
    return [];
  }
}

export async function closeIssue(issueKey: string): Promise<void> {
  const transitions = await jiraHttp.getJson<JiraTransitionsResponse>(
    `/rest/api/3/issue/${issueKey}/transitions`
  );

  for (const transition of transitions.body.transitions) {
    if (transition.to.statusCategory.key === 'done') {
      logger.debug(`closeIssue: closing issue ${issueKey}`);

      await jiraHttp.postJson(`/rest/api/3/issue/${issueKey}/transitions`, {
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

export function massageMarkdown(input: string, repositoryUrl: string): string {
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

export async function ensureIssue(
  { title, reuseTitle, body }: EnsureIssueConfig,
  projectKey: string,
  repositoryUrl: string
): Promise<EnsureIssueResult | null> {
  logger.debug(`ensureIssue()`);
  let description = readOnlyIssueBody(sanitize(body));
  description = massageMarkdown(description, repositoryUrl);

  try {
    let issues = await findOpenIssues(title, projectKey);
    if (!issues.length && reuseTitle) {
      issues = await findOpenIssues(reuseTitle, projectKey);
    }
    if (issues.length) {
      // Close any duplicates
      for (const issue of issues.slice(1)) {
        await closeIssue(issue.key);
      }
      const [issue] = issues;

      if (
        issue.fields.summary !== title ||
        issue.fields.description !==
          utils.convertMarkdownToAtlassianDocumentFormat(description.trim())
      ) {
        await jiraHttp.putJson(`/rest/api/3/issue/${issue.key}`, {
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
      await jiraHttp.postJson(`/rest/api/3/issue`, {
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

/* istanbul ignore next */
export async function getIssueList(projectKey: string): Promise<Issue[]> {
  logger.debug(`getIssueList()`);

  try {
    const jql = encodeURIComponent(
      [
        `project = "${projectKey}"`,
        `reporter = currentUser()`,
        'status != "done"',
      ].join(' AND ')
    );

    const jiraIssues = await jiraHttp.getJson<JiraSearchResponse>(
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

export async function ensureIssueClosing(
  title: string,
  projectKey: string
): Promise<void> {
  const issues = await findOpenIssues(title, projectKey);
  for (const issue of issues) {
    await closeIssue(issue.key);
  }
}
