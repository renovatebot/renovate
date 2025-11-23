import { logger } from '../../../logger';
import { sanitize } from '../../../util/sanitize';
import type { EnsureIssueConfig, EnsureIssueResult, Issue } from '../types';
import * as azureApi from './azure-got-wrapper';
import type { Config } from './types';
import { getWorkItemTitle } from './util';

export class IssueService {
  constructor(private config: Config) {}

  async findIssue(title: string): Promise<Issue | null> {
    logger.debug(`findIssue(${title})`);
    try {
      const finalTitle = getWorkItemTitle(title, this.config.repository);
      const issues = await this.getIssueList(finalTitle);
      return issues[0] ?? null;
    } catch (err) {
      logger.error({ err }, 'Error finding issue');
      return null;
    }
  }

  async getIssueList(titleFilter?: string): Promise<Issue[]> {
    logger.debug('getIssueList()');
    try {
      const azureApiWit = await azureApi.workItemTrackingApi();

      let wiql = `
        SELECT [System.Id], [System.Title], [System.State], [System.CreatedDate]
        FROM WorkItems
        WHERE [System.WorkItemType] = 'Issue'
          AND [System.TeamProject] = '${this.config.project}'
      `;

      if (titleFilter) {
        const escapedTitle = titleFilter.replace(/'/g, "''");
        wiql += ` AND [System.Title] = '${escapedTitle}'`;
      }

      const result = await azureApiWit.queryByWiql({ query: wiql });

      if (!result.workItems?.length) {
        logger.debug('getIssueList() no work items found');
        return [];
      }

      const workItemIds = result.workItems.map((wi) => wi.id!);
      const workItems = await azureApiWit.getWorkItems(workItemIds, [
        'System.Id',
        'System.Title',
        'System.State',
        'System.Description',
      ]);

      return workItems.map((wi) => ({
        number: wi.id!,
        title: wi.fields!['System.Title'],
        state:
          wi.fields!['System.State'] === 'New' ||
          wi.fields!['System.State'] === 'Active' ||
          wi.fields!['System.State'] === 'To Do'
            ? 'open'
            : 'closed',
        body: wi.fields!['System.Description'],
      }));
    } catch (err) {
      logger.warn({ err }, 'Error fetching issue list');
      return [];
    }
  }

  async ensureIssueClosing(title: string): Promise<void> {
    logger.debug(`ensureIssueClosing(${title})`);
    try {
      const issue = await this.findIssue(title);
      if (issue && issue.state === 'open' && issue.number) {
        const azureApiWit = await azureApi.workItemTrackingApi();
        await azureApiWit.updateWorkItem(
          undefined,
          [{ op: 'replace', path: '/fields/System.State', value: 'Closed' }],
          issue.number,
          this.config.project,
        );
        logger.debug(`Closed issue #${issue.number}: ${title}`);
      }
    } catch (err) {
      logger.error({ err }, 'Error closing issue');
    }
  }

  async ensureIssue({
    title,
    body,
    once = false,
    shouldReOpen = true,
  }: EnsureIssueConfig): Promise<EnsureIssueResult | null> {
    logger.debug(`ensureIssue()`);

    try {
      const azureApiWit = await azureApi.workItemTrackingApi();
      const finalTitle = getWorkItemTitle(title, this.config.repository);
      const issues = await this.getIssueList(finalTitle);

      // Close duplicate open issues if any
      const openIssues = issues.filter((issue) => issue.state === 'open');
      if (openIssues.length > 1) {
        for (let i = 1; i < openIssues.length; i++) {
          const issueNumber = openIssues[i].number;
          if (issueNumber) {
            await azureApiWit.updateWorkItem(
              undefined,
              [
                {
                  op: 'replace',
                  path: '/fields/System.State',
                  value: 'Closed',
                },
              ],
              issueNumber,
              this.config.project,
            );
            logger.info(`Closed duplicate issue #${issueNumber}`);
          }
        }
      }

      const existingIssue =
        openIssues[0] ?? issues.find((issue) => issue.state === 'closed');

      if (existingIssue) {
        if (existingIssue.state === 'closed' && once) {
          logger.debug('Issue already closed - skipping update');
          return null;
        } else if (existingIssue.state === 'closed' && shouldReOpen) {
          // Reopen and update work item
          await azureApiWit.updateWorkItem(
            undefined,
            [
              { op: 'replace', path: '/fields/System.State', value: 'New' },
              {
                op: 'replace',
                path: '/fields/System.Title',
                value: finalTitle,
              },
              {
                op: 'replace',
                path: '/fields/System.Description',
                value: sanitize(body),
              },
              {
                op: 'replace',
                path: '/multilineFieldsFormat/System.Description',
                value: 'Markdown',
              },
            ],
            existingIssue.number!,
            this.config.project,
          );
          logger.debug(`Reopened issue #${existingIssue.number}`);
          return 'updated';
        } else if (existingIssue.state === 'open') {
          // Update work item if needed
          if (
            existingIssue.title !== finalTitle ||
            existingIssue.body !== body
          ) {
            await azureApiWit.updateWorkItem(
              undefined,
              [
                {
                  op: 'replace',
                  path: '/fields/System.Title',
                  value: finalTitle,
                },
                {
                  op: 'replace',
                  path: '/fields/System.Description',
                  value: sanitize(body),
                },
                {
                  op: 'replace',
                  path: '/multilineFieldsFormat/System.Description',
                  value: 'Markdown',
                },
              ],
              existingIssue.number!,
              this.config.project,
            );
            logger.debug(`Updated issue #${existingIssue.number}`);
            return 'updated';
          }
          logger.debug(`Issue #${existingIssue.number} is already up-to-date`);
          return 'updated';
        }
      }

      // Create new work item if none found
      const newWorkItem = await azureApiWit.createWorkItem(
        undefined,
        [
          { op: 'add', path: '/fields/System.WorkItemType', value: 'Issue' },
          { op: 'add', path: '/fields/System.Title', value: finalTitle },
          {
            op: 'add',
            path: '/fields/System.Description',
            value: sanitize(body),
          },
          {
            op: 'add',
            path: '/multilineFieldsFormat/System.Description',
            value: 'Markdown',
          },
          { op: 'add', path: '/fields/System.State', value: 'New' },
        ],
        this.config.project,
        'Issue',
      );

      logger.debug(`Created new issue #${newWorkItem.id}`);
      return 'created';
    } catch (err) {
      logger.warn({ err }, 'Error ensuring issue');
      return null;
    }
  }
}
