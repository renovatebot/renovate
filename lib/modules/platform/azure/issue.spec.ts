import { vi } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';
import { logger as _logger } from '~test/util.ts';
import * as _hostRules from '../../../util/host-rules.ts';
import * as _azureApi from './azure-got-wrapper.ts';
import { IssueService } from './issue.ts';
import type { Config } from './types.ts';

const logger = _logger.logger;

vi.mock('./azure-got-wrapper.ts', () => mockDeep());
vi.mock('./azure-helper.ts', () => mockDeep());
vi.mock('../../../util/host-rules.ts', () => mockDeep());
vi.mock('../../../util/sanitize.ts', () =>
  mockDeep({ sanitize: (s: string) => s }),
);
vi.mock('./util.ts', () => ({
  getWorkItemTitle: vi.fn((title: string) => `[Renovate] ${title}`),
}));

const azureApi = vi.mocked(_azureApi, true);
const hostRules = vi.mocked(_hostRules);

describe('modules/platform/azure/issue', () => {
  let config: Config;
  let issueService: IssueService;

  beforeEach(() => {
    vi.clearAllMocks();
    hostRules.find.mockReturnValue({ token: 'token' });

    config = {
      repository: 'test/repo',
      project: 'testProject',
      repoId: '123',
    } as Config;

    issueService = new IssueService(config);
  });

  describe('getIssueList()', () => {
    it('should return empty array when no work items found', async () => {
      azureApi.workItemTrackingApi.mockImplementation(
        () =>
          ({
            queryByWiql: vi.fn().mockResolvedValue({
              workItems: [],
            }),
          }) as any,
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

      azureApi.workItemTrackingApi.mockImplementation(
        () =>
          ({
            queryByWiql: vi.fn().mockResolvedValue({
              workItems: [{ id: 1 }, { id: 2 }],
            }),
            getWorkItems: vi.fn().mockResolvedValue(mockWorkItems),
          }) as any,
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
      azureApi.workItemTrackingApi.mockImplementation(
        () =>
          ({
            queryByWiql: vi.fn().mockResolvedValue({
              workItems: [],
            }),
          }) as any,
      );

      await issueService.getIssueList('Test Filter');

      const mockCall =
        azureApi.workItemTrackingApi.mock.results[0].value.queryByWiql.mock
          .calls[0][0];
      expect(mockCall.query).toContain("AND [System.Title] = 'Test Filter'");
    });

    it('should escape single quotes in title filter', async () => {
      azureApi.workItemTrackingApi.mockImplementation(
        () =>
          ({
            queryByWiql: vi.fn().mockResolvedValue({
              workItems: [],
            }),
          }) as any,
      );

      await issueService.getIssueList("Test's Filter");

      const mockCall =
        azureApi.workItemTrackingApi.mock.results[0].value.queryByWiql.mock
          .calls[0][0];
      expect(mockCall.query).toContain("AND [System.Title] = 'Test''s Filter'");
    });

    it('should handle errors gracefully', async () => {
      azureApi.workItemTrackingApi.mockImplementation(
        () =>
          ({
            queryByWiql: vi.fn().mockRejectedValue(new Error('API Error')),
          }) as any,
      );

      const result = await issueService.getIssueList();
      expect(result).toEqual([]);
      expect(logger.warn).toHaveBeenCalled();
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

      azureApi.workItemTrackingApi.mockImplementation(
        () =>
          ({
            queryByWiql: vi.fn().mockResolvedValue({
              workItems: [{ id: 1 }, { id: 2 }, { id: 3 }],
            }),
            getWorkItems: vi.fn().mockResolvedValue(mockWorkItems),
          }) as any,
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
      azureApi.workItemTrackingApi.mockImplementation(
        () =>
          ({
            updateWorkItem: updateWorkItemMock,
          }) as any,
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
      azureApi.workItemTrackingApi.mockImplementation(
        () =>
          ({
            updateWorkItem: updateWorkItemMock,
          }) as any,
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
      azureApi.workItemTrackingApi.mockImplementation(
        () =>
          ({
            updateWorkItem: updateWorkItemMock,
          }) as any,
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
      azureApi.workItemTrackingApi.mockImplementation(
        () =>
          ({
            createWorkItem: createWorkItemMock,
          }) as any,
      );

      const result = await issueService.ensureIssue({
        title: 'Test Issue',
        body: 'Test body content',
      });

      expect(createWorkItemMock).toHaveBeenCalled();
      expect(result).toEqual('created');
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
      azureApi.workItemTrackingApi.mockImplementation(
        () =>
          ({
            updateWorkItem: updateWorkItemMock,
          }) as any,
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
      azureApi.workItemTrackingApi.mockImplementation(
        () =>
          ({
            updateWorkItem: updateWorkItemMock,
          }) as any,
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
      azureApi.workItemTrackingApi.mockImplementation(
        () =>
          ({
            updateWorkItem: updateWorkItemMock,
          }) as any,
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
      azureApi.workItemTrackingApi.mockImplementation(
        () =>
          ({
            updateWorkItem: updateWorkItemMock,
          }) as any,
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
      azureApi.workItemTrackingApi.mockImplementation(
        () =>
          ({
            updateWorkItem: updateWorkItemMock,
          }) as any,
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
      azureApi.workItemTrackingApi.mockImplementation(
        () =>
          ({
            createWorkItem: createWorkItemMock,
          }) as any,
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
});
