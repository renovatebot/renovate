import type { IWorkItemTrackingApi } from 'azure-devops-node-api/WorkItemTrackingApi.js';
import { vi } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';
import { logger as _logger, partial } from '~test/util.ts';
import * as _azureApi from './azure-got-wrapper.ts';
import { IssueService } from './issue.ts';
import type { Config } from './types.ts';

const logger = _logger.logger;

vi.mock('./azure-got-wrapper.ts', () => mockDeep());
vi.mock('./azure-helper.ts', () => mockDeep());
vi.mock('../../../util/sanitize.ts', () =>
  mockDeep({ sanitize: (s: string) => s }),
);
vi.mock('./util.ts', () => ({
  getWorkItemTitle: vi.fn((title: string) => `[Renovate] ${title}`),
}));

const azureApi = vi.mocked(_azureApi, true);

describe('modules/platform/azure/issue', () => {
  let config: Config;
  let issueService: IssueService;

  beforeEach(() => {
    config = {
      repository: 'test/repo',
      project: 'testProject',
      repoId: '123',
      workItemType: 'Issue',
    } as Config;

    issueService = new IssueService(config);
  });

  describe('getIssueList()', () => {
    it('should return empty array when no work items found', async () => {
      azureApi.workItemTrackingApi.mockResolvedValue(
        partial<IWorkItemTrackingApi>({
          queryByWiql: vi.fn().mockResolvedValue({
            workItems: [],
          }),
        }),
      );

      const result = await issueService.getIssueList();
      expect(result).toEqual([]);
    });

    it('should return formatted issues list', async () => {
      const mockWorkItems = [
        {
          id: 1,
          fields: {
            'System.Title': 'Test Issue 1',
            'System.State': 'New',
            'System.Description': 'Test description 1',
          },
        },
        {
          id: 2,
          fields: {
            'System.Title': 'Test Issue 2',
            'System.State': 'Closed',
            'System.Description': 'Test description 2',
          },
        },
      ];

      azureApi.workItemTrackingApi.mockResolvedValue(
        partial<IWorkItemTrackingApi>({
          queryByWiql: vi.fn().mockResolvedValue({
            workItems: [{ id: 1 }, { id: 2 }],
          }),
          getWorkItems: vi.fn().mockResolvedValue(mockWorkItems),
        }),
      );

      const result = await issueService.getIssueList();

      expect(result).toEqual([
        {
          number: 1,
          title: 'Test Issue 1',
          state: 'open',
          body: 'Test description 1',
        },
        {
          number: 2,
          title: 'Test Issue 2',
          state: 'closed',
          body: 'Test description 2',
        },
      ]);
    });

    it('should filter by title when titleFilter provided', async () => {
      const queryByWiqlMock = vi.fn().mockResolvedValue({ workItems: [] });
      azureApi.workItemTrackingApi.mockResolvedValue(
        partial<IWorkItemTrackingApi>({
          queryByWiql: queryByWiqlMock,
        }),
      );

      await issueService.getIssueList('Test Filter');

      expect(queryByWiqlMock.mock.calls[0][0].query).toContain(
        "AND [System.Title] = 'Test Filter'",
      );
    });

    it('should escape single quotes in title filter', async () => {
      const queryByWiqlMock = vi.fn().mockResolvedValue({ workItems: [] });
      azureApi.workItemTrackingApi.mockResolvedValue(
        partial<IWorkItemTrackingApi>({
          queryByWiql: queryByWiqlMock,
        }),
      );

      await issueService.getIssueList("Test's Filter");

      expect(queryByWiqlMock.mock.calls[0][0].query).toContain(
        "AND [System.Title] = 'Test''s Filter'",
      );
    });

    it('should handle errors gracefully', async () => {
      azureApi.workItemTrackingApi.mockResolvedValue(
        partial<IWorkItemTrackingApi>({
          queryByWiql: vi.fn().mockRejectedValue(new Error('API Error')),
        }),
      );

      const result = await issueService.getIssueList();
      expect(result).toEqual([]);
      expect(logger.warn).toHaveBeenCalled();
    });

    it('does not filter the query by work item type', async () => {
      const queryByWiqlMock = vi.fn().mockResolvedValue({ workItems: [] });
      azureApi.workItemTrackingApi.mockResolvedValue(
        partial<IWorkItemTrackingApi>({
          queryByWiql: queryByWiqlMock,
        }),
      );

      await issueService.getIssueList('Test Filter');

      expect(queryByWiqlMock.mock.calls[0][0].query).not.toContain(
        'System.WorkItemType',
      );
    });

    it('should map various Azure states to open/closed', async () => {
      const mockWorkItems = [
        {
          id: 1,
          fields: {
            'System.Title': 'Active Issue',
            'System.State': 'Active',
            'System.Description': 'Active description',
          },
        },
        {
          id: 2,
          fields: {
            'System.Title': 'ToDo Issue',
            'System.State': 'To Do',
            'System.Description': 'ToDo description',
          },
        },
        {
          id: 3,
          fields: {
            'System.Title': 'Closed Issue',
            'System.State': 'Closed',
            'System.Description': 'Closed description',
          },
        },
      ];

      azureApi.workItemTrackingApi.mockResolvedValue(
        partial<IWorkItemTrackingApi>({
          queryByWiql: vi.fn().mockResolvedValue({
            workItems: [{ id: 1 }, { id: 2 }, { id: 3 }],
          }),
          getWorkItems: vi.fn().mockResolvedValue(mockWorkItems),
        }),
      );

      const result = await issueService.getIssueList();

      expect(result[0].state).toBe('open'); // Active
      expect(result[1].state).toBe('open'); // To Do
      expect(result[2].state).toBe('closed'); // Closed
    });
  });

  describe('findIssue()', () => {
    it('should return first matching issue', async () => {
      const mockIssue = {
        number: 1,
        title: '[Renovate] Test Issue',
        state: 'open',
        body: 'Test description',
      };

      vi.spyOn(issueService, 'getIssueList').mockResolvedValue([mockIssue]);

      const result = await issueService.findIssue('Test Issue');

      expect(result).toEqual(mockIssue);
    });

    it('should return null when no issue found', async () => {
      vi.spyOn(issueService, 'getIssueList').mockResolvedValue([]);

      const result = await issueService.findIssue('Non-existent Issue');

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      vi.spyOn(issueService, 'getIssueList').mockRejectedValue(
        new Error('API Error'),
      );

      const result = await issueService.findIssue('Test Issue');

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('ensureIssueClosing()', () => {
    it('should close open issue when found', async () => {
      const mockIssue = {
        number: 1,
        title: '[Renovate] Test Issue',
        state: 'open',
        body: 'Test description',
      };

      vi.spyOn(issueService, 'findIssue').mockResolvedValue(mockIssue);

      const updateWorkItemMock = vi.fn();
      azureApi.workItemTrackingApi.mockResolvedValue(
        partial<IWorkItemTrackingApi>({
          updateWorkItem: updateWorkItemMock,
        }),
      );

      await issueService.ensureIssueClosing('Test Issue');

      expect(updateWorkItemMock).toHaveBeenCalledWith(
        undefined,
        [{ op: 'replace', path: '/fields/System.State', value: 'Closed' }],
        1,
        'testProject',
      );
    });

    it('should not close already closed issue', async () => {
      const mockIssue = {
        number: 1,
        title: '[Renovate] Test Issue',
        state: 'closed',
        body: 'Test description',
      };

      vi.spyOn(issueService, 'findIssue').mockResolvedValue(mockIssue);

      const updateWorkItemMock = vi.fn();
      azureApi.workItemTrackingApi.mockResolvedValue(
        partial<IWorkItemTrackingApi>({
          updateWorkItem: updateWorkItemMock,
        }),
      );

      await issueService.ensureIssueClosing('Test Issue');

      expect(updateWorkItemMock).not.toHaveBeenCalled();
    });

    it('should not close issue without number', async () => {
      const mockIssue = {
        number: undefined,
        title: '[Renovate] Test Issue',
        state: 'open',
        body: 'Test description',
      };

      vi.spyOn(issueService, 'findIssue').mockResolvedValue(mockIssue);

      const updateWorkItemMock = vi.fn();
      azureApi.workItemTrackingApi.mockResolvedValue(
        partial<IWorkItemTrackingApi>({
          updateWorkItem: updateWorkItemMock,
        }),
      );

      await issueService.ensureIssueClosing('Test Issue');

      expect(updateWorkItemMock).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      vi.spyOn(issueService, 'findIssue').mockRejectedValue(
        new Error('API Error'),
      );

      await expect(
        issueService.ensureIssueClosing('Test Issue'),
      ).resolves.not.toThrow();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('ensureIssue()', () => {
    it('should create new issue when none exists', async () => {
      vi.spyOn(issueService, 'getIssueList').mockResolvedValue([]);

      const createWorkItemMock = vi.fn().mockResolvedValue({ id: 123 });
      azureApi.workItemTrackingApi.mockResolvedValue(
        partial<IWorkItemTrackingApi>({
          createWorkItem: createWorkItemMock,
          getWorkItemTypes: vi.fn().mockResolvedValue([{ name: 'Issue' }]),
        }),
      );

      const result = await issueService.ensureIssue({
        title: 'Test Issue',
        body: 'Test body content',
      });

      expect(createWorkItemMock).toHaveBeenCalled();
      expect(result).toEqual('created');
    });

    it('should return null when work item creation returns no result', async () => {
      vi.spyOn(issueService, 'getIssueList').mockResolvedValue([]);

      const createWorkItemMock = vi.fn().mockResolvedValue(null);
      azureApi.workItemTrackingApi.mockResolvedValue(
        partial<IWorkItemTrackingApi>({
          createWorkItem: createWorkItemMock,
          getWorkItemTypes: vi.fn().mockResolvedValue([{ name: 'Issue' }]),
        }),
      );

      const result = await issueService.ensureIssue({
        title: 'Test Issue',
        body: 'Test body content',
      });

      expect(createWorkItemMock).toHaveBeenCalled();
      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        'Azure: work item creation returned no result; skipping issue',
      );
    });

    it('should skip issue when the Issue work item type does not exist', async () => {
      vi.spyOn(issueService, 'getIssueList').mockResolvedValue([]);

      const createWorkItemMock = vi.fn();
      azureApi.workItemTrackingApi.mockResolvedValue(
        partial<IWorkItemTrackingApi>({
          createWorkItem: createWorkItemMock,
          getWorkItemTypes: vi.fn().mockResolvedValue([{ name: 'Bug' }]),
        }),
      );

      const result = await issueService.ensureIssue({
        title: 'Test Issue',
        body: 'Test body content',
      });

      expect(createWorkItemMock).not.toHaveBeenCalled();
      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        {
          workItemType: 'Issue',
          availableTypes: ['Bug'],
          project: 'testProject',
          documentationUrl:
            'https://docs.renovatebot.com/configuration-options/#azureworkitemtype',
        },
        expect.stringContaining('work item type does not exist'),
      );
    });

    it('should reopen closed issue when shouldReOpen is true', async () => {
      const mockClosedIssue = {
        number: 1,
        title: '[Renovate] Test Issue',
        state: 'closed',
        body: 'Old description',
      };

      vi.spyOn(issueService, 'getIssueList').mockResolvedValue([
        mockClosedIssue,
      ]);

      const updateWorkItemMock = vi.fn();
      azureApi.workItemTrackingApi.mockResolvedValue(
        partial<IWorkItemTrackingApi>({
          updateWorkItem: updateWorkItemMock,
        }),
      );

      const result = await issueService.ensureIssue({
        title: 'Test Issue',
        body: 'New body content',
        shouldReOpen: true,
      });

      expect(updateWorkItemMock).toHaveBeenCalledWith(
        undefined,
        expect.arrayContaining([
          { op: 'replace', path: '/fields/System.State', value: 'New' },
          {
            op: 'replace',
            path: '/fields/System.Title',
            value: '[Renovate] Test Issue',
          },
          {
            op: 'replace',
            path: '/fields/System.Description',
            value: 'New body content',
          },
        ]),
        1,
        'testProject',
      );
      expect(result).toEqual('updated');
    });

    it('should not reopen closed issue when once is true', async () => {
      const mockClosedIssue = {
        number: 1,
        title: '[Renovate] Test Issue',
        state: 'closed',
        body: 'Old description',
      };

      vi.spyOn(issueService, 'getIssueList').mockResolvedValue([
        mockClosedIssue,
      ]);

      const result = await issueService.ensureIssue({
        title: 'Test Issue',
        body: 'New body content',
        once: true,
      });

      expect(result).toBeNull();
    });

    it('should update existing open issue', async () => {
      const mockOpenIssue = {
        number: 1,
        title: '[Renovate] Test Issue',
        state: 'open',
        body: 'Old description',
      };

      vi.spyOn(issueService, 'getIssueList').mockResolvedValue([mockOpenIssue]);

      const updateWorkItemMock = vi.fn();
      azureApi.workItemTrackingApi.mockResolvedValue(
        partial<IWorkItemTrackingApi>({
          updateWorkItem: updateWorkItemMock,
        }),
      );

      const result = await issueService.ensureIssue({
        title: 'Test Issue',
        body: 'Updated body content',
      });

      expect(updateWorkItemMock).toHaveBeenCalledWith(
        undefined,
        expect.arrayContaining([
          {
            op: 'replace',
            path: '/fields/System.Title',
            value: '[Renovate] Test Issue',
          },
          {
            op: 'replace',
            path: '/fields/System.Description',
            value: 'Updated body content',
          },
        ]),
        1,
        'testProject',
      );
      expect(result).toEqual('updated');
    });

    it('should close duplicate open issues', async () => {
      const mockOpenIssues = [
        {
          number: 1,
          title: '[Renovate] Test Issue',
          state: 'open',
          body: 'Description 1',
        },
        {
          number: 2,
          title: '[Renovate] Test Issue',
          state: 'open',
          body: 'Description 2',
        },
        {
          number: 3,
          title: '[Renovate] Test Issue',
          state: 'open',
          body: 'Description 3',
        },
      ];

      vi.spyOn(issueService, 'getIssueList').mockResolvedValue(mockOpenIssues);

      const updateWorkItemMock = vi.fn();
      azureApi.workItemTrackingApi.mockResolvedValue(
        partial<IWorkItemTrackingApi>({
          updateWorkItem: updateWorkItemMock,
        }),
      );

      await issueService.ensureIssue({
        title: 'Test Issue',
        body: 'Updated body content',
      });

      // Should close issues 2 and 3 (duplicates)
      expect(updateWorkItemMock).toHaveBeenCalledWith(
        undefined,
        [{ op: 'replace', path: '/fields/System.State', value: 'Closed' }],
        2,
        'testProject',
      );
      expect(updateWorkItemMock).toHaveBeenCalledWith(
        undefined,
        [{ op: 'replace', path: '/fields/System.State', value: 'Closed' }],
        3,
        'testProject',
      );
    });

    it('should skip duplicate issues without number', async () => {
      const mockOpenIssues = [
        {
          number: 1,
          title: '[Renovate] Test Issue',
          state: 'open',
          body: 'Description 1',
        },
        {
          title: '[Renovate] Test Issue',
          state: 'open',
          body: 'Description 2',
          // number is undefined
        },
      ];

      vi.spyOn(issueService, 'getIssueList').mockResolvedValue(mockOpenIssues);

      const updateWorkItemMock = vi.fn();
      azureApi.workItemTrackingApi.mockResolvedValue(
        partial<IWorkItemTrackingApi>({
          updateWorkItem: updateWorkItemMock,
        }),
      );

      await issueService.ensureIssue({
        title: 'Test Issue',
        body: 'Updated body content',
      });

      // Should not attempt to close duplicate without number
      expect(updateWorkItemMock).not.toHaveBeenCalledWith(
        undefined,
        [{ op: 'replace', path: '/fields/System.State', value: 'Closed' }],
        undefined,
        'testProject',
      );
    });

    it('should handle errors gracefully', async () => {
      vi.spyOn(issueService, 'getIssueList').mockRejectedValue(
        new Error('API Error'),
      );

      const result = await issueService.ensureIssue({
        title: 'Test Issue',
        body: 'Test body content',
      });

      expect(result).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('ensureIssue()'),
      );
    });

    it('should not update issue if content is same', async () => {
      const mockOpenIssue = {
        number: 1,
        title: '[Renovate] Test Issue',
        state: 'open',
        body: 'Same content',
      };

      vi.spyOn(issueService, 'getIssueList').mockResolvedValue([mockOpenIssue]);

      const updateWorkItemMock = vi.fn();
      azureApi.workItemTrackingApi.mockResolvedValue(
        partial<IWorkItemTrackingApi>({
          updateWorkItem: updateWorkItemMock,
        }),
      );

      const result = await issueService.ensureIssue({
        title: 'Test Issue',
        body: 'Same content',
      });

      expect(result).toEqual('updated');
      expect(updateWorkItemMock).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        'Issue #1 is already up-to-date',
      );
    });

    it('should return null when trying to reopen issue without number', async () => {
      const mockClosedIssueWithoutNumber = {
        title: '[repo] Test Issue',
        state: 'closed',
        body: 'Old content',
        // number is undefined
      };

      vi.spyOn(issueService, 'getIssueList').mockResolvedValue([
        mockClosedIssueWithoutNumber,
      ]);

      const result = await issueService.ensureIssue({
        title: 'Test Issue',
        body: 'New content',
        shouldReOpen: true,
      });

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        'Cannot reopen issue without number',
      );
    });

    it('should return null when trying to update issue without number', async () => {
      const mockOpenIssueWithoutNumber = {
        title: '[repo] Old Title',
        state: 'open',
        body: 'Old content',
        // number is undefined
      };

      vi.spyOn(issueService, 'getIssueList').mockResolvedValue([
        mockOpenIssueWithoutNumber,
      ]);

      const result = await issueService.ensureIssue({
        title: 'Test Issue',
        body: 'New content',
      });

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        'Cannot update issue without number',
      );
    });

    it('should not reopen closed issue when shouldReOpen is false', async () => {
      const mockClosedIssue = {
        number: 1,
        title: '[Renovate] Test Issue',
        state: 'closed',
        body: 'Old description',
      };

      vi.spyOn(issueService, 'getIssueList').mockResolvedValue([
        mockClosedIssue,
      ]);

      const createWorkItemMock = vi.fn().mockResolvedValue({ id: 123 });
      azureApi.workItemTrackingApi.mockResolvedValue(
        partial<IWorkItemTrackingApi>({
          createWorkItem: createWorkItemMock,
          getWorkItemTypes: vi.fn().mockResolvedValue([{ name: 'Issue' }]),
        }),
      );

      const result = await issueService.ensureIssue({
        title: 'Test Issue',
        body: 'New body content',
        shouldReOpen: false,
      });

      // Should fall through and create a new issue
      expect(createWorkItemMock).toHaveBeenCalled();
      expect(result).toBe('created');
    });
  });

  describe('work item state resolution', () => {
    // Basic process: To Do (Proposed) / Doing (InProgress) / Done (Completed).
    const basicStates = [
      { name: 'To Do', category: 'Proposed' },
      { name: 'Doing', category: 'InProgress' },
      { name: 'Done', category: 'Completed' },
    ];
    // Custom Agile-derived process with no Proposed state (e.g. Nuvei "Digital
    // Agile"): Active (InProgress) / Closed (Completed).
    const noProposedStates = [
      { name: 'Active', category: 'InProgress' },
      { name: 'Closed', category: 'Completed' },
    ];
    // Custom process that orders a Resolved-category state *before* the
    // Completed-category state (mirrors a real Nuvei "DBA" process). The close
    // target must still be the Completed state, not the first closed-category
    // state in workflow order.
    const resolvedBeforeClosedStates = [
      { name: 'New', category: 'Proposed' },
      { name: 'Active', category: 'InProgress' },
      { name: 'Resolved', category: 'Resolved' },
      { name: 'Closed', category: 'Completed' },
      { name: 'Duplicate', category: 'Removed' },
      { name: 'Rejected', category: 'Removed' },
    ];

    it('does not set System.State when creating an issue', async () => {
      vi.spyOn(issueService, 'getIssueList').mockResolvedValue([]);

      const createWorkItemMock = vi.fn().mockResolvedValue({ id: 123 });
      azureApi.workItemTrackingApi.mockResolvedValue(
        partial<IWorkItemTrackingApi>({
          createWorkItem: createWorkItemMock,
          getWorkItemTypeStates: vi.fn().mockResolvedValue(noProposedStates),
          getWorkItemTypes: vi.fn().mockResolvedValue([{ name: 'Issue' }]),
        }),
      );

      await issueService.ensureIssue({ title: 'Test Issue', body: 'body' });

      const patchDocument = createWorkItemMock.mock.calls[0][1];
      expect(patchDocument).not.toContainEqual(
        expect.objectContaining({ path: '/fields/System.State' }),
      );
    });

    it('classifies work items as closed by state category', async () => {
      azureApi.workItemTrackingApi.mockResolvedValue(
        partial<IWorkItemTrackingApi>({
          queryByWiql: vi.fn().mockResolvedValue({
            workItems: [{ id: 1 }, { id: 2 }],
          }),
          getWorkItems: vi.fn().mockResolvedValue([
            {
              id: 1,
              fields: { 'System.Title': 'a', 'System.State': 'To Do' },
            },
            {
              id: 2,
              fields: { 'System.Title': 'b', 'System.State': 'Done' },
            },
          ]),
          getWorkItemTypeStates: vi.fn().mockResolvedValue(basicStates),
        }),
      );

      const result = await issueService.getIssueList();

      expect(result[0].state).toBe('open'); // To Do
      expect(result[1].state).toBe('closed'); // Done (Completed category)
    });

    it('closes an issue using the process closed state', async () => {
      vi.spyOn(issueService, 'findIssue').mockResolvedValue({
        number: 1,
        title: '[Renovate] Test Issue',
        state: 'open',
        body: 'body',
      });

      const updateWorkItemMock = vi.fn();
      azureApi.workItemTrackingApi.mockResolvedValue(
        partial<IWorkItemTrackingApi>({
          updateWorkItem: updateWorkItemMock,
          getWorkItemTypeStates: vi.fn().mockResolvedValue(basicStates),
        }),
      );

      await issueService.ensureIssueClosing('Test Issue');

      expect(updateWorkItemMock).toHaveBeenCalledWith(
        undefined,
        [{ op: 'replace', path: '/fields/System.State', value: 'Done' }],
        1,
        'testProject',
      );
    });

    it('closes to a Completed state even when Resolved is ordered first', async () => {
      vi.spyOn(issueService, 'findIssue').mockResolvedValue({
        number: 1,
        title: '[Renovate] Test Issue',
        state: 'open',
        body: 'body',
      });

      const updateWorkItemMock = vi.fn();
      azureApi.workItemTrackingApi.mockResolvedValue(
        partial<IWorkItemTrackingApi>({
          updateWorkItem: updateWorkItemMock,
          getWorkItemTypeStates: vi
            .fn()
            .mockResolvedValue(resolvedBeforeClosedStates),
        }),
      );

      await issueService.ensureIssueClosing('Test Issue');

      expect(updateWorkItemMock).toHaveBeenCalledWith(
        undefined,
        [{ op: 'replace', path: '/fields/System.State', value: 'Closed' }],
        1,
        'testProject',
      );
    });

    it('closes to the first closed-category state when no Completed state exists', async () => {
      // Process that exposes a Resolved-category state but no Completed one, so
      // the close target falls back to the first closed-category state.
      const resolvedWithoutCompletedStates = [
        { name: 'New', category: 'Proposed' },
        { name: 'Active', category: 'InProgress' },
        { name: 'Resolved', category: 'Resolved' },
      ];

      vi.spyOn(issueService, 'findIssue').mockResolvedValue({
        number: 1,
        title: '[Renovate] Test Issue',
        state: 'open',
        body: 'body',
      });

      const updateWorkItemMock = vi.fn();
      azureApi.workItemTrackingApi.mockResolvedValue(
        partial<IWorkItemTrackingApi>({
          updateWorkItem: updateWorkItemMock,
          getWorkItemTypeStates: vi
            .fn()
            .mockResolvedValue(resolvedWithoutCompletedStates),
        }),
      );

      await issueService.ensureIssueClosing('Test Issue');

      expect(updateWorkItemMock).toHaveBeenCalledWith(
        undefined,
        [{ op: 'replace', path: '/fields/System.State', value: 'Resolved' }],
        1,
        'testProject',
      );
    });

    it('classifies all closed-category states as closed', async () => {
      azureApi.workItemTrackingApi.mockResolvedValue(
        partial<IWorkItemTrackingApi>({
          queryByWiql: vi.fn().mockResolvedValue({
            workItems: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
          }),
          getWorkItems: vi.fn().mockResolvedValue([
            {
              id: 1,
              fields: { 'System.Title': 'a', 'System.State': 'Active' },
            },
            {
              id: 2,
              fields: { 'System.Title': 'b', 'System.State': 'Resolved' },
            },
            {
              id: 3,
              fields: { 'System.Title': 'c', 'System.State': 'Closed' },
            },
            {
              id: 4,
              fields: { 'System.Title': 'd', 'System.State': 'Rejected' },
            },
          ]),
          getWorkItemTypeStates: vi
            .fn()
            .mockResolvedValue(resolvedBeforeClosedStates),
        }),
      );

      const result = await issueService.getIssueList();

      expect(result[0].state).toBe('open'); // Active
      expect(result[1].state).toBe('closed'); // Resolved (Resolved category)
      expect(result[2].state).toBe('closed'); // Closed (Completed category)
      expect(result[3].state).toBe('closed'); // Rejected (Removed category)
    });

    it('reopens an issue using the process open state', async () => {
      vi.spyOn(issueService, 'getIssueList').mockResolvedValue([
        {
          number: 1,
          title: '[Renovate] Test Issue',
          state: 'closed',
          body: 'Old description',
        },
      ]);

      const updateWorkItemMock = vi.fn();
      azureApi.workItemTrackingApi.mockResolvedValue(
        partial<IWorkItemTrackingApi>({
          updateWorkItem: updateWorkItemMock,
          getWorkItemTypeStates: vi.fn().mockResolvedValue(basicStates),
        }),
      );

      await issueService.ensureIssue({
        title: 'Test Issue',
        body: 'New body content',
        shouldReOpen: true,
      });

      expect(updateWorkItemMock).toHaveBeenCalledWith(
        undefined,
        expect.arrayContaining([
          { op: 'replace', path: '/fields/System.State', value: 'To Do' },
        ]),
        1,
        'testProject',
      );
    });

    it('reopens using the first InProgress state when no Proposed state exists', async () => {
      vi.spyOn(issueService, 'getIssueList').mockResolvedValue([
        {
          number: 1,
          title: '[Renovate] Test Issue',
          state: 'closed',
          body: 'Old description',
        },
      ]);

      const updateWorkItemMock = vi.fn();
      azureApi.workItemTrackingApi.mockResolvedValue(
        partial<IWorkItemTrackingApi>({
          updateWorkItem: updateWorkItemMock,
          getWorkItemTypeStates: vi.fn().mockResolvedValue(noProposedStates),
        }),
      );

      await issueService.ensureIssue({
        title: 'Test Issue',
        body: 'New body content',
        shouldReOpen: true,
      });

      expect(updateWorkItemMock).toHaveBeenCalledWith(
        undefined,
        expect.arrayContaining([
          { op: 'replace', path: '/fields/System.State', value: 'Active' },
        ]),
        1,
        'testProject',
      );
    });

    it('falls back to default state names when states cannot be resolved', async () => {
      vi.spyOn(issueService, 'findIssue').mockResolvedValue({
        number: 1,
        title: '[Renovate] Test Issue',
        state: 'open',
        body: 'body',
      });

      const updateWorkItemMock = vi.fn();
      azureApi.workItemTrackingApi.mockResolvedValue(
        partial<IWorkItemTrackingApi>({
          updateWorkItem: updateWorkItemMock,
          getWorkItemTypeStates: vi
            .fn()
            .mockRejectedValue(new Error('not supported')),
        }),
      );

      await issueService.ensureIssueClosing('Test Issue');

      expect(updateWorkItemMock).toHaveBeenCalledWith(
        undefined,
        [{ op: 'replace', path: '/fields/System.State', value: 'Closed' }],
        1,
        'testProject',
      );
    });

    it('keeps the default closed state when no closed-category state exists', async () => {
      vi.spyOn(issueService, 'findIssue').mockResolvedValue({
        number: 1,
        title: '[Renovate] Test Issue',
        state: 'open',
        body: 'body',
      });

      const updateWorkItemMock = vi.fn();
      azureApi.workItemTrackingApi.mockResolvedValue(
        partial<IWorkItemTrackingApi>({
          updateWorkItem: updateWorkItemMock,
          getWorkItemTypeStates: vi
            .fn()
            .mockResolvedValue([{ name: 'To Do', category: 'Proposed' }]),
        }),
      );

      await issueService.ensureIssueClosing('Test Issue');

      expect(updateWorkItemMock).toHaveBeenCalledWith(
        undefined,
        [{ op: 'replace', path: '/fields/System.State', value: 'Closed' }],
        1,
        'testProject',
      );
    });

    it('falls back to default states when the type has no states', async () => {
      azureApi.workItemTrackingApi.mockResolvedValue(
        partial<IWorkItemTrackingApi>({
          queryByWiql: vi.fn().mockResolvedValue({ workItems: [{ id: 1 }] }),
          getWorkItems: vi.fn().mockResolvedValue([
            {
              id: 1,
              fields: { 'System.Title': 'a', 'System.State': 'Closed' },
            },
          ]),
          getWorkItemTypeStates: vi.fn().mockResolvedValue([]),
        }),
      );

      const result = await issueService.getIssueList();

      expect(result[0].state).toBe('closed');
    });

    it('reopens using the first available state when only closed-category states exist', async () => {
      vi.spyOn(issueService, 'getIssueList').mockResolvedValue([
        {
          number: 1,
          title: '[Renovate] Test Issue',
          state: 'closed',
          body: 'Old description',
        },
      ]);

      const updateWorkItemMock = vi.fn();
      azureApi.workItemTrackingApi.mockResolvedValue(
        partial<IWorkItemTrackingApi>({
          updateWorkItem: updateWorkItemMock,
          getWorkItemTypeStates: vi
            .fn()
            .mockResolvedValue([{ name: 'OnlyClosed', category: 'Completed' }]),
        }),
      );

      await issueService.ensureIssue({
        title: 'Test Issue',
        body: 'New body content',
        shouldReOpen: true,
      });

      expect(updateWorkItemMock).toHaveBeenCalledWith(
        undefined,
        expect.arrayContaining([
          { op: 'replace', path: '/fields/System.State', value: 'OnlyClosed' },
        ]),
        1,
        'testProject',
      );
    });

    it('reopens using the default state when no state has a name', async () => {
      vi.spyOn(issueService, 'getIssueList').mockResolvedValue([
        {
          number: 1,
          title: '[Renovate] Test Issue',
          state: 'closed',
          body: 'Old description',
        },
      ]);

      const updateWorkItemMock = vi.fn();
      azureApi.workItemTrackingApi.mockResolvedValue(
        partial<IWorkItemTrackingApi>({
          updateWorkItem: updateWorkItemMock,
          getWorkItemTypeStates: vi
            .fn()
            .mockResolvedValue([{ category: 'InProgress' }]),
        }),
      );

      await issueService.ensureIssue({
        title: 'Test Issue',
        body: 'New body content',
        shouldReOpen: true,
      });

      expect(updateWorkItemMock).toHaveBeenCalledWith(
        undefined,
        expect.arrayContaining([
          { op: 'replace', path: '/fields/System.State', value: 'New' },
        ]),
        1,
        'testProject',
      );
    });

    it('resolves work item states only once (cached per instance)', async () => {
      const getWorkItemTypeStatesMock = vi.fn().mockResolvedValue([
        { name: 'Doing', category: 'InProgress' },
        { name: 'Done', category: 'Completed' },
      ]);
      const updateWorkItemMock = vi.fn();
      azureApi.workItemTrackingApi.mockResolvedValue(
        partial<IWorkItemTrackingApi>({
          queryByWiql: vi.fn().mockResolvedValue({ workItems: [{ id: 1 }] }),
          getWorkItems: vi.fn().mockResolvedValue([
            {
              id: 1,
              fields: {
                'System.Title': '[Renovate] Test Issue',
                'System.State': 'Doing',
                'System.Description': 'Old description',
              },
            },
          ]),
          getWorkItemTypeStates: getWorkItemTypeStatesMock,
          updateWorkItem: updateWorkItemMock,
        }),
      );

      // getIssueList (inside ensureIssue) resolves states once, then ensureIssue
      // resolves again and must hit the cache rather than re-querying.
      await issueService.ensureIssue({
        title: 'Test Issue',
        body: 'New body content',
      });

      expect(getWorkItemTypeStatesMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('work item type configuration', () => {
    it('uses the configured Issue work item type', async () => {
      vi.spyOn(issueService, 'getIssueList').mockResolvedValue([]);

      const createWorkItemMock = vi.fn().mockResolvedValue({ id: 123 });
      azureApi.workItemTrackingApi.mockResolvedValue(
        partial<IWorkItemTrackingApi>({
          createWorkItem: createWorkItemMock,
          getWorkItemTypes: vi.fn().mockResolvedValue([{ name: 'Issue' }]),
        }),
      );

      await issueService.ensureIssue({ title: 'Test Issue', body: 'body' });

      expect(createWorkItemMock.mock.calls[0][1]).toContainEqual({
        op: 'add',
        path: '/fields/System.WorkItemType',
        value: 'Issue',
      });
      expect(createWorkItemMock.mock.calls[0][3]).toBe('Issue');
    });

    it('creates the work item using the configured type', async () => {
      const taskService = new IssueService({
        ...config,
        workItemType: 'Task',
      } as Config);
      vi.spyOn(taskService, 'getIssueList').mockResolvedValue([]);

      const createWorkItemMock = vi.fn().mockResolvedValue({ id: 123 });
      azureApi.workItemTrackingApi.mockResolvedValue(
        partial<IWorkItemTrackingApi>({
          createWorkItem: createWorkItemMock,
          getWorkItemTypes: vi.fn().mockResolvedValue([{ name: 'Task' }]),
        }),
      );

      await taskService.ensureIssue({
        title: 'Test Issue',
        body: 'body',
      });

      expect(createWorkItemMock.mock.calls[0][1]).toContainEqual({
        op: 'add',
        path: '/fields/System.WorkItemType',
        value: 'Task',
      });
      expect(createWorkItemMock.mock.calls[0][3]).toBe('Task');
    });

    it('resolves work item states against the configured type', async () => {
      const taskService = new IssueService({
        ...config,
        workItemType: 'Task',
      } as Config);
      vi.spyOn(taskService, 'getIssueList').mockResolvedValue([]);

      const getWorkItemTypeStatesMock = vi.fn().mockResolvedValue([]);
      azureApi.workItemTrackingApi.mockResolvedValue(
        partial<IWorkItemTrackingApi>({
          createWorkItem: vi.fn().mockResolvedValue({ id: 1 }),
          getWorkItemTypes: vi.fn().mockResolvedValue([{ name: 'Task' }]),
          getWorkItemTypeStates: getWorkItemTypeStatesMock,
        }),
      );

      await taskService.ensureIssue({
        title: 'Test Issue',
        body: 'body',
      });

      expect(getWorkItemTypeStatesMock).toHaveBeenCalledWith(
        'testProject',
        'Task',
      );
    });
  });
});
