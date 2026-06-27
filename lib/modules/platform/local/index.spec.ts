import { partial } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import { rawExec as _rawExec } from '../../../util/exec/common.ts';
import type { ExecResult } from '../../../util/exec/types.ts';
import * as platform from './index.ts';

vi.mock('../../../util/exec/common.ts');
const rawExec = vi.mocked(_rawExec);

describe('modules/platform/local/index', () => {
  afterEach(() => {
    GlobalConfig.reset();
  });

  describe('initPlatform', () => {
    it('returns input', async () => {
      expect(await platform.initPlatform({})).toMatchInlineSnapshot(`
        {
          "dryRun": "lookup",
          "endpoint": "local",
          "persistRepoData": true,
          "requireConfig": "optional",
        }
      `);
    });

    it('preserves an explicit dryRun=extract override', async () => {
      await expect(
        platform.initPlatform({
          dryRun: 'extract',
        }),
      ).resolves.toEqual({
        dryRun: 'extract',
        endpoint: 'local',
        persistRepoData: true,
        requireConfig: 'optional',
      });
    });

    it('preserves an explicit dryRun=full override', async () => {
      await expect(
        platform.initPlatform({
          dryRun: 'full',
        }),
      ).resolves.toEqual({
        dryRun: 'full',
        endpoint: 'local',
        persistRepoData: true,
        requireConfig: 'optional',
      });
    });

    it('falls back to lookup for unsupported dryRun values', async () => {
      await expect(
        platform.initPlatform({
          dryRun: 'silent',
        }),
      ).resolves.toMatchObject({ dryRun: 'lookup' });
    });
  });

  describe('getRepos', () => {
    it('returns empty array', async () => {
      expect(await platform.getRepos()).toEqual([]);
    });
  });

  describe('initRepo', () => {
    it('returns object', async () => {
      expect(await platform.initRepo()).toMatchInlineSnapshot(`
        {
          "defaultBranch": "",
          "isFork": false,
          "repoFingerprint": "",
        }
      `);
      expect(rawExec).not.toHaveBeenCalled();
    });

    it('allows dryRun=full on a clean work tree', async () => {
      GlobalConfig.set({ dryRun: 'full', localDir: '/tmp/foo' });
      rawExec.mockResolvedValueOnce(partial<ExecResult>({ stdout: '\n' }));
      await expect(platform.initRepo()).resolves.toMatchObject({
        defaultBranch: '',
      });
      expect(rawExec).toHaveBeenCalledExactlyOnceWith(
        'git status --porcelain',
        {
          cwd: '/tmp/foo',
        },
      );
    });

    it('throws on dryRun=full with a dirty work tree', async () => {
      GlobalConfig.set({ dryRun: 'full', localDir: '/tmp/foo' });
      rawExec.mockResolvedValueOnce(
        partial<ExecResult>({ stdout: ' M Dockerfile\n' }),
      );
      await expect(platform.initRepo()).rejects.toThrow('uncommitted changes');
    });

    it('warns on dryRun=full outside a git repository', async () => {
      GlobalConfig.set({ dryRun: 'full', localDir: '/tmp/foo' });
      rawExec.mockRejectedValueOnce(new Error('not a git repository'));
      await expect(platform.initRepo()).resolves.toMatchObject({
        defaultBranch: '',
      });
    });
  });

  describe('dummy functions', () => {
    it('findIssue', async () => {
      expect(await platform.findIssue()).toBeNull();
    });

    it('getIssueList', async () => {
      expect(await platform.getIssueList()).toEqual([]);
    });

    it('getRawFile', async () => {
      expect(await platform.getRawFile()).toBeNull();
    });

    it('getJsonFile', async () => {
      expect(await platform.getJsonFile()).toBeNull();
    });

    it('getPrList', async () => {
      expect(await platform.getPrList()).toEqual([]);
    });

    it('ensureIssueClosing', async () => {
      expect(await platform.ensureIssueClosing()).toBeUndefined();
    });

    it('ensureIssue', async () => {
      expect(await platform.ensureIssue()).toBeNull();
    });

    it('massageMarkdown', () => {
      expect(platform.massageMarkdown('foo')).toBe('foo');
    });

    it('maxBodyLength', () => {
      expect(platform.maxBodyLength()).toBe(Infinity);
    });

    it('updatePr', async () => {
      expect(await platform.updatePr()).toBeUndefined();
    });

    it('mergePr', async () => {
      expect(await platform.mergePr()).toBe(false);
    });

    it('addReviewers', async () => {
      expect(await platform.addReviewers()).toBeUndefined();
    });

    it('addAssignees', async () => {
      expect(await platform.addAssignees()).toBeUndefined();
    });

    it('createPr', async () => {
      expect(await platform.createPr()).toBeNull();
    });

    it('deleteLabel', async () => {
      expect(await platform.deleteLabel()).toBeUndefined();
    });

    it('setBranchStatus', async () => {
      expect(await platform.setBranchStatus()).toBeUndefined();
    });

    it('getBranchStatus', async () => {
      expect(await platform.getBranchStatus()).toBe('red');
    });

    it('getBranchStatusCheck', async () => {
      expect(await platform.getBranchStatusCheck()).toBeNull();
    });

    it('ensureCommentRemoval', async () => {
      expect(await platform.ensureCommentRemoval()).toBeUndefined();
    });

    it('ensureComment', async () => {
      expect(await platform.ensureComment()).toBeFalse();
    });

    it('getPr', async () => {
      expect(await platform.getPr()).toBeNull();
    });

    it('findPr', async () => {
      expect(await platform.findPr()).toBeNull();
    });

    it('getBranchPr', async () => {
      expect(await platform.getBranchPr()).toBeNull();
    });
  });
});
