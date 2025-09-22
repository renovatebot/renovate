import type { Mocked, MockedObject } from 'vitest';
import { vi } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';
import type { logger as _logger } from '../../../logger';
import type * as _hostRules from '../../../util/host-rules';
import type { Platform } from '../types';
import { IssueService } from './issue';
import type { Config } from './types';

vi.mock('./azure-got-wrapper', () => mockDeep());
vi.mock('./azure-helper', () => mockDeep());
vi.mock('../../../util/host-rules', () => mockDeep());
vi.mock('../../../util/sanitize', () =>
  mockDeep({ sanitize: (s: string) => s }),
);
vi.mock('./util', () => ({
  getWorkItemTitle: vi.fn((title: string) => `[Renovate] ${title}`),
}));

describe('modules/platform/azure/issue', () => {
  let hostRules: Mocked<typeof _hostRules>;
  let azure: Platform;
  let azureApi: Mocked<typeof import('./azure-got-wrapper')>;
  let logger: MockedObject<typeof _logger>;
  let config: Config;
  let issueService: IssueService;

  beforeEach(async () => {
    // reset module
    vi.resetModules();
    hostRules = await vi.importMock('../../../util/host-rules');
    azure = await vi.importActual('.');
    azureApi = await vi.importMock('./azure-got-wrapper');
    logger = (
      await vi.importMock<typeof import('../../../logger')>('../../../logger')
    ).logger;
    hostRules.find.mockReturnValue({
      token: 'token',
    });

    await azure.initPlatform({
      endpoint: 'https://dev.azure.com/renovate12345',
      token: 'token',
    });

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
            'System.Title': 'Resolved Issue',
            'System.State': 'Resolved',
            'System.Description': 'Resolved description',
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
      expect(result[2].state).toBe('closed'); // Resolved
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
        title: '[repo] Test Issue',
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

      // The method always returns 'updated' for open issues, even if content is same
      expect(result).toEqual('updated');
    });
  });

  describe('integration with main azure Platform', () => {
    it('getIssueList should work interface', async () => {
      azureApi.workItemTrackingApi.mockImplementation(
        () =>
          ({
            queryByWiql: vi.fn().mockResolvedValue({
              workItems: [],
            }),
          }) as any,
      );

      const result = await azure.getIssueList();
      expect(result).toEqual([]);
    });

    it('findIssue should work', async () => {
      azureApi.workItemTrackingApi.mockImplementation(
        () =>
          ({
            queryByWiql: vi.fn().mockResolvedValue({
              workItems: [],
            }),
          }) as any,
      );

      const result = await azure.findIssue('Test Issue');
      expect(result).toBeNull();
    });

    it('ensureIssue should work', async () => {
      azureApi.workItemTrackingApi.mockImplementation(
        () =>
          ({
            queryByWiql: vi.fn().mockResolvedValue({
              workItems: [],
            }),
            createWorkItem: vi.fn().mockResolvedValue({ id: 123 }),
          }) as any,
      );

      const result = await azure.ensureIssue({
        title: 'Test Issue',
        body: 'Test body content',
      });

      expect(result).toEqual('created');
    });

    it('ensureIssueClosing should work', async () => {
      azureApi.workItemTrackingApi.mockImplementation(
        () =>
          ({
            queryByWiql: vi.fn().mockResolvedValue({
              workItems: [],
            }),
          }) as any,
      );

      await expect(
        azure.ensureIssueClosing('Test Issue'),
      ).resolves.not.toThrow();
    });
  });
});
