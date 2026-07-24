import { isNonEmptyString } from '@sindresorhus/is';
import type {
  WorkItem,
  WorkItemStateColor,
} from 'azure-devops-node-api/interfaces/WorkItemTrackingInterfaces.js';
import type { IWorkItemTrackingApi } from 'azure-devops-node-api/WorkItemTrackingApi.js';
import { GlobalConfig } from '../../../config/global.ts';
import { logger } from '../../../logger/index.ts';
import { Lazy } from '../../../util/lazy.ts';
import { sanitize } from '../../../util/sanitize.ts';
import type { EnsureIssueConfig, EnsureIssueResult, Issue } from '../types.ts';
import * as azureApi from './azure-got-wrapper.ts';
import type { Config } from './types.ts';
import { getWorkItemTitle } from './util.ts';

// Historical fallbacks, used when the work item type's states cannot be
// resolved from the API (e.g. Azure DevOps Server versions without the
// endpoint). These match the values Renovate hardcoded previously.
const defaultOpenState = 'New';
const defaultClosedState = 'Closed';

// Azure Boards groups every work item state into one of these meta-state
// categories. Which concrete state name maps to a category depends on the
// project's process (Basic: To Do/Doing/Done, Agile: New/Active/.../Closed,
// custom inherited processes: anything). Categories are stable, so we resolve
// the concrete names from them instead of hardcoding process-specific values.
const openCategories = ['Proposed', 'InProgress'];
const closedCategories = ['Completed', 'Resolved', 'Removed'];

interface WorkItemStates {
  /** State to move a work item to when (re)opening it. */
  open: string;
  /** State to move a work item to when closing it. */
  closed: string;
  /** All state names that represent a closed/completed work item. */
  closedNames: Set<string>;
}

/**
 * Return the names of the states whose category is one of `categories`,
 * preserving the order Azure DevOps returns them in (workflow order).
 */
function namesByCategory(
  stateColors: WorkItemStateColor[],
  categories: string[],
): string[] {
  return stateColors
    .filter((s) => s.category && categories.includes(s.category) && s.name)
    .map((s) => s.name!);
}

export class IssueService {
  private config: Config;
  private readonly workItemStates: Lazy<Promise<WorkItemStates>>;

  constructor(config: Config) {
    this.config = config;
    // Wrapped in `Lazy` so concurrent callers share a single resolution
    // instead of each firing a duplicate `getWorkItemTypeStates` request.
    this.workItemStates = new Lazy(() => this.resolveWorkItemStates());
  }

  /**
   * Resolve the concrete open/closed state names for the `Issue` work item type
   * from its process, so Renovate does not depend on hardcoded state names that
   * only exist in some Azure DevOps processes. Falls back to the historical
   * `New`/`Closed` values if the states cannot be fetched.
   */
  private async resolveWorkItemStates(): Promise<WorkItemStates> {
    const states: WorkItemStates = {
      open: defaultOpenState,
      closed: defaultClosedState,
      closedNames: new Set([defaultClosedState]),
    };

    try {
      const azureApiWit = await azureApi.workItemTrackingApi();
      const stateColors = await azureApiWit.getWorkItemTypeStates(
        this.config.project,
        this.config.workItemType,
      );

      if (stateColors?.length) {
        const openNames = namesByCategory(stateColors, openCategories);
        // A `Completed` state (e.g. Agile's `Closed`) is the true "done" state.
        // `Resolved`/`Removed` states also count as closed but must not be
        // picked over `Completed` when moving an item to closed.
        const completed = stateColors.find(
          (s) => s.category === 'Completed' && s.name,
        );
        const closedNames = namesByCategory(stateColors, closedCategories);

        // First open-category state, else the type's first state overall. If a
        // process somehow exposes only closed states, this falls back to a
        // closed state name; that is intentional (there is no better reopen
        // target) rather than a bug.
        states.open = openNames[0] ?? stateColors[0].name ?? states.open;
        if (closedNames.length) {
          // Prefer a `Completed` state as the close target so processes that
          // order `Resolved` before `Closed` (e.g. some custom Agile
          // inheritances) still close to `Closed`; fall back to the wider set
          // only when no `Completed` state exists. Keep the full set for
          // recognising already-closed items.
          states.closed = completed?.name ?? closedNames[0];
          states.closedNames = new Set(closedNames);
        }
      }
    } catch (err) {
      logger.debug(
        { err },
        'Azure: could not resolve work item states, using default state names',
      );
    }

    return states;
  }

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

  /**
   * The work item type names the project's process defines. Some processes
   * (e.g. Scrum) do not define `Issue`, in which case creating one fails;
   * checking up front lets us log an actionable message (including the types
   * that *are* available) instead of a cryptic error.
   */
  private async getWorkItemTypeNames(
    azureApiWit: IWorkItemTrackingApi,
  ): Promise<string[]> {
    const types = await azureApiWit.getWorkItemTypes(this.config.project);
    return types.map((t) => t.name).filter(isNonEmptyString);
  }

  async getIssueList(titleFilter?: string): Promise<Issue[]> {
    logger.debug('getIssueList()');
    try {
      const azureApiWit = await azureApi.workItemTrackingApi();

      // Intentionally not filtering by [System.WorkItemType]: the type is
      // configurable (`azureWorkItemType`) and a repo's Renovate issues have a
      // unique title, so matching on title + project finds them regardless of
      // which work item type they were created as.
      let wiql = `
        SELECT [System.Id]
        FROM WorkItems
        WHERE [System.TeamProject] = '${this.config.project}'
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

      const workItemIds = result.workItems.map((wi: WorkItem) => wi.id!);
      const workItems = await azureApiWit.getWorkItems(workItemIds, [
        'System.Id',
        'System.Title',
        'System.State',
        'System.Description',
        'System.CreatedDate',
        'System.ChangedDate',
      ]);

      const { closedNames } = await this.workItemStates.getValue();

      return workItems.map((wi: WorkItem) => ({
        number: wi.id!,
        title: wi.fields!['System.Title'],
        state: closedNames.has(wi.fields!['System.State']) ? 'closed' : 'open',
        body: wi.fields!['System.Description'],
        createdAt: wi.fields!['System.CreatedDate'],
        lastModified: wi.fields!['System.ChangedDate'],
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
      if (issue?.state === 'open' && issue.number) {
        const azureApiWit = await azureApi.workItemTrackingApi();
        const { closed } = await this.workItemStates.getValue();
        await azureApiWit.updateWorkItem(
          undefined,
          [{ op: 'replace', path: '/fields/System.State', value: closed }],
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
      const { open, closed } = await this.workItemStates.getValue();

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
                  value: closed,
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
        }
        if (existingIssue.state === 'closed' && shouldReOpen) {
          // Reopen and update work item
          if (!existingIssue.number) {
            logger.warn('Cannot reopen issue without number');
            return null;
          }
          await azureApiWit.updateWorkItem(
            undefined,
            [
              { op: 'replace', path: '/fields/System.State', value: open },
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
            existingIssue.number,
            this.config.project,
          );
          logger.debug(`Reopened issue #${existingIssue.number}`);
          return 'updated';
        }
        if (existingIssue.state === 'open') {
          // Update work item if needed
          if (
            existingIssue.title !== finalTitle ||
            existingIssue.body !== body
          ) {
            if (!existingIssue.number) {
              logger.warn('Cannot update issue without number');
              return null;
            }
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
              existingIssue.number,
              this.config.project,
            );
            logger.debug(`Updated issue #${existingIssue.number}`);
            return 'updated';
          }
          logger.debug(`Issue #${existingIssue.number} is already up-to-date`);
          return 'updated';
        }
      }

      // Create new work item if none found. System.State is intentionally
      // omitted so Azure DevOps applies the work item type's default initial
      // state for the project's process (e.g. `To Do` on Basic, `New`/`Active`
      // on Agile). Passing a hardcoded state fails on processes that lack it.

      // The configured work item type (default `Issue`) only exists in some
      // processes (Basic, Agile, CMMI) but not others (e.g. Scrum). Creating one
      // on a process without it returns a 404 that the REST client surfaces as
      // `null`, so check first and log an actionable message instead of failing
      // cryptically.
      const availableTypes = await this.getWorkItemTypeNames(azureApiWit);
      if (!availableTypes.includes(this.config.workItemType)) {
        logger.warn(
          {
            workItemType: this.config.workItemType,
            availableTypes,
            project: this.config.project,
            documentationUrl: `${GlobalConfig.get('productLinks').documentation}configuration-options/#azureworkitemtype`,
          },
          'Azure: work item type does not exist in project (or the token lacks permission to it); skipping issue. The Dependency Dashboard needs a process that defines this work item type. Set one your project defines via the `azureWorkItemType` repo config option.',
        );
        return null;
      }

      const newWorkItem = await azureApiWit.createWorkItem(
        undefined,
        [
          {
            op: 'add',
            path: '/fields/System.WorkItemType',
            value: this.config.workItemType,
          },
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
        ],
        this.config.project,
        this.config.workItemType,
      );

      // Azure DevOps normally returns the created work item, but the
      // underlying REST client resolves to `null` instead of throwing for
      // some responses: a 404, or any 2xx with an empty/non-JSON body (e.g. a
      // 203 sign-in page from an expired token or an SSO/proxy in front of the
      // instance). Guard the result so such a response does not crash the whole
      // run with `Cannot read properties of null (reading 'id')`.
      if (!newWorkItem?.id) {
        logger.warn(
          'Azure: work item creation returned no result; skipping issue',
        );
        return null;
      }

      logger.debug(`Created new issue #${newWorkItem.id}`);
      return 'created';
    } catch (err) {
      logger.warn({ err }, 'Error ensuring issue');
      return null;
    }
  }
}
