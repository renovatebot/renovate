import fs from 'fs-extra';
import Git from 'simple-git';
import tmp from 'tmp-promise';
import { mocked, partial } from '../../../test/util';
import { GlobalConfig } from '../../config/global';
import {
  CONFIG_VALIDATION,
  INVALID_PATH,
} from '../../constants/error-messages';
import * as _repoCache from '../cache/repository';
import type { BranchCache } from '../cache/repository/types';
import { newlineRegex, regEx } from '../regex';
import * as _conflictsCache from './conflicts-cache';
import * as _modifiedCache from './modified-cache';
import * as _parentShaCache from './parent-sha-cache';
import type { FileChange } from './types';
import * as git from '.';
import { setNoVerify } from '.';

jest.mock('./conflicts-cache');
jest.mock('./modified-cache');
jest.mock('./parent-sha-cache');
jest.mock('delay');
jest.mock('../cache/repository');
const repoCache = mocked(_repoCache);
const conflictsCache = mocked(_conflictsCache);
const modifiedCache = mocked(_modifiedCache);
const parentShaCache = mocked(_parentShaCache);
// Class is no longer exported
const SimpleGit = Git().constructor as { prototype: ReturnType<typeof Git> };

describe('util/git/index', () => {
  jest.setTimeout(60000);

  const masterCommitDate = new Date();
  masterCommitDate.setMilliseconds(0);
  let base: tmp.DirectoryResult;
  let origin: tmp.DirectoryResult;
  let defaultBranch: string;

  beforeAll(async () => {
    base = await tmp.dir({ unsafeCleanup: true });
    const repo = Git(base.path);
    await repo.init();
    defaultBranch = (await repo.raw('branch', '--show-current')).trim();
    await repo.addConfig('user.email', 'Jest@example.com');
    await repo.addConfig('user.name', 'Jest');
    await fs.writeFile(base.path + '/past_file', 'past');
    await repo.addConfig('commit.gpgsign', 'false');
    await repo.add(['past_file']);
    await repo.commit('past message');

    await repo.checkout(['-b', 'renovate/past_branch', defaultBranch]);
    await repo.checkout(['-b', 'develop', defaultBranch]);

    await repo.checkout(defaultBranch);
    await fs.writeFile(base.path + '/master_file', defaultBranch);
    await fs.writeFile(base.path + '/file_to_delete', 'bye');
    await repo.add(['master_file', 'file_to_delete']);
    await repo.commit('master message', [
      '--date=' + masterCommitDate.toISOString(),
    ]);

    await repo.checkout(['-b', 'renovate/future_branch', defaultBranch]);
    await fs.writeFile(base.path + '/future_file', 'future');
    await repo.add(['future_file']);
    await repo.commit('future message');

    await repo.checkoutBranch('renovate/modified_branch', defaultBranch);
    await fs.writeFile(base.path + '/base_file', 'base');
    await repo.add(['base_file']);
    await repo.commit('base message');
    await fs.writeFile(base.path + '/modified_file', 'modified');
    await repo.add(['modified_file']);
    await repo.commit('modification');

    await repo.checkoutBranch('renovate/custom_author', defaultBranch);
    await fs.writeFile(base.path + '/custom_file', 'custom');
    await repo.add(['custom_file']);
    await repo.addConfig('user.email', 'custom@example.com');
    await repo.commit('custom message');

    await repo.checkoutBranch('renovate/nested_files', defaultBranch);
    await fs.mkdirp(base.path + '/bin/');
    await fs.writeFile(base.path + '/bin/nested', 'nested');
    await fs.writeFile(base.path + '/root', 'root');
    await repo.add(['root', 'bin/nested']);
    await repo.addConfig('user.email', 'custom@example.com');
    await repo.commit('nested message');

    await repo.checkoutBranch('renovate/equal_branch', defaultBranch);

    await repo.checkout(defaultBranch);
  });

  let tmpDir: tmp.DirectoryResult;

  const OLD_ENV = process.env;

  beforeEach(async () => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    origin = await tmp.dir({ unsafeCleanup: true });
    const repo = Git(origin.path);
    await repo.clone(base.path, '.', ['--bare']);
    await repo.addConfig('commit.gpgsign', 'false');
    tmpDir = await tmp.dir({ unsafeCleanup: true });
    GlobalConfig.set({ localDir: tmpDir.path });
    await git.initRepo({
      url: origin.path,
    });
    git.setUserRepoConfig({ branchPrefix: 'renovate/' });
    git.setGitAuthor('Jest <Jest@example.com>');
    setNoVerify([]);
    await git.syncGit();
    // override some local git settings for better testing
    const local = Git(tmpDir.path);
    await local.addConfig('commit.gpgsign', 'false');
    parentShaCache.getCachedBranchParentShaResult.mockReturnValue(null);
  });

  afterEach(async () => {
    await tmpDir?.cleanup();
    await origin?.cleanup();
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    process.env = OLD_ENV;
    await base?.cleanup();
  });

  describe('gitRetry', () => {
    it('returns result if git returns successfully', async () => {
      const gitFunc = jest.fn().mockImplementation((args) => {
        if (args === undefined) {
          return 'some result';
        } else {
          return 'different result';
        }
      });
      expect(await git.gitRetry(() => gitFunc())).toBe('some result');
      expect(await git.gitRetry(() => gitFunc('arg'))).toBe('different result');
      expect(gitFunc).toHaveBeenCalledTimes(2);
    });

    it('retries the func call if ExternalHostError thrown', async () => {
      process.env.NODE_ENV = '';
      const gitFunc = jest
        .fn()
        .mockImplementationOnce(() => {
          throw new Error('The remote end hung up unexpectedly');
        })
        .mockImplementationOnce(() => {
          throw new Error('The remote end hung up unexpectedly');
        })
        .mockImplementationOnce(() => 'some result');
      expect(await git.gitRetry(() => gitFunc())).toBe('some result');
      expect(gitFunc).toHaveBeenCalledTimes(3);
    });

    it('retries the func call up to retry count if ExternalHostError thrown', async () => {
      process.env.NODE_ENV = '';
      const gitFunc = jest.fn().mockImplementation(() => {
        throw new Error('The remote end hung up unexpectedly');
      });
      await expect(git.gitRetry(() => gitFunc())).rejects.toThrow(
        'The remote end hung up unexpectedly'
      );
      expect(gitFunc).toHaveBeenCalledTimes(6);
    });

    it("doesn't retry and throws an Error if non-ExternalHostError thrown by git", async () => {
      const gitFunc = jest.fn().mockImplementationOnce(() => {
        throw new Error('some error');
      });
      await expect(git.gitRetry(() => gitFunc())).rejects.toThrow('some error');
      expect(gitFunc).toHaveBeenCalledTimes(1);
    });
  });

  describe('validateGitVersion()', () => {
    it('has a git version greater or equal to the minimum required', async () => {
      const res = await git.validateGitVersion();
      expect(res).toBeTrue();
    });
  });

  describe('checkoutBranch(branchName)', () => {
    it('sets the base branch as master', async () => {
      await expect(git.checkoutBranch(defaultBranch)).resolves.not.toThrow();
    });

    it('sets non-master base branch', async () => {
      await expect(git.checkoutBranch('develop')).resolves.not.toThrow();
    });
  });

  describe('getFileList()', () => {
    it('should return the correct files', async () => {
      expect(await git.getFileList()).toEqual([
        'file_to_delete',
        'master_file',
        'past_file',
      ]);
    });

    it('should exclude submodules', async () => {
      const repo = Git(base.path);
      await repo.submoduleAdd(base.path, 'submodule');
      await repo.submoduleAdd(base.path, 'file');
      await repo.commit('Add submodules');
      await git.initRepo({
        cloneSubmodules: true,
        url: base.path,
      });
      await git.syncGit();
      expect(await fs.pathExists(tmpDir.path + '/.gitmodules')).toBeTruthy();
      expect(await git.getFileList()).toEqual([
        '.gitmodules',
        'file_to_delete',
        'master_file',
        'past_file',
      ]);
      await repo.reset(['--hard', 'HEAD^']);
    });
  });

  describe('branchExists(branchName)', () => {
    it('should return true if found', () => {
      expect(git.branchExists('renovate/future_branch')).toBeTrue();
    });

    it('should return false if not found', () => {
      expect(git.branchExists('not_found')).toBeFalse();
    });
  });

  describe('getBranchList()', () => {
    it('should return all branches', () => {
      const res = git.getBranchList();
      expect(res).toContain('renovate/past_branch');
      expect(res).toContain('renovate/future_branch');
      expect(res).toContain(defaultBranch);
    });
  });

  describe('isBranchBehindBase()', () => {
    it('should return false if same SHA as master', async () => {
      repoCache.getCache.mockReturnValueOnce({});
      expect(
        await git.isBranchBehindBase('renovate/future_branch')
      ).toBeFalse();
    });

    it('should return true if SHA different from master', async () => {
      repoCache.getCache.mockReturnValueOnce({});
      expect(await git.isBranchBehindBase('renovate/past_branch')).toBeTrue();
    });

    it('should return result even if non-default and not under branchPrefix', async () => {
      const parentSha = 'SHA';
      const branchCache = partial<BranchCache>({
        branchName: 'develop',
        parentSha: parentSha,
      });
      repoCache.getCache.mockReturnValueOnce({}).mockReturnValueOnce({
        branches: [branchCache],
      });
      expect(await git.isBranchBehindBase('develop')).toBeTrue();
      expect(await git.isBranchBehindBase('develop')).toBeTrue(); // cache
    });
  });

  describe('isBranchModified()', () => {
    beforeEach(() => {
      modifiedCache.getCachedModifiedResult.mockReturnValue(null);
    });

    it('should return false when branch is not found', async () => {
      expect(await git.isBranchModified('renovate/not_found')).toBeFalse();
    });

    it('should return false when author matches', async () => {
      expect(await git.isBranchModified('renovate/future_branch')).toBeFalse();
      expect(await git.isBranchModified('renovate/future_branch')).toBeFalse();
    });

    it('should return false when author is ignored', async () => {
      git.setUserRepoConfig({
        gitIgnoredAuthors: ['custom@example.com'],
      });
      expect(await git.isBranchModified('renovate/custom_author')).toBeFalse();
    });

    it('should return true when custom author is unknown', async () => {
      expect(await git.isBranchModified('renovate/custom_author')).toBeTrue();
    });

    it('should return value stored in modifiedCacheResult', async () => {
      modifiedCache.getCachedModifiedResult.mockReturnValue(true);
      expect(await git.isBranchModified('renovate/future_branch')).toBeTrue();
    });
  });

  describe('getBranchCommit(branchName)', () => {
    it('should return same value for equal refs', () => {
      const hex = git.getBranchCommit('renovate/equal_branch');
      expect(hex).toBe(git.getBranchCommit(defaultBranch));
      expect(hex).toHaveLength(40);
    });

    it('should return null', () => {
      expect(git.getBranchCommit('not_found')).toBeNull();
    });
  });

  describe('getBranchParentSha(branchName)', () => {
    it('should return sha if found', async () => {
      const parentSha = await git.getBranchParentSha('renovate/future_branch');
      expect(parentSha).toHaveLength(40);
      expect(parentSha).toEqual(git.getBranchCommit(defaultBranch));
    });

    it('should return null if not found', async () => {
      expect(await git.getBranchParentSha('not_found')).toBeNull();
    });

    it('should return cached value', async () => {
      parentShaCache.getCachedBranchParentShaResult.mockReturnValueOnce('111');
      expect(await git.getBranchParentSha('not_found')).toBe('111');
    });
  });

  describe('getBranchFiles(branchName)', () => {
    it('detects changed files compared to current base branch', async () => {
      const file: FileChange = {
        type: 'addition',
        path: 'some-new-file',
        contents: 'some new-contents',
      };
      await git.commitFiles({
        branchName: 'renovate/branch_with_changes',
        files: [
          file,
          { type: 'addition', path: 'dummy', contents: null as never },
        ],
        message: 'Create something',
      });
      const branchFiles = await git.getBranchFiles(
        'renovate/branch_with_changes'
      );
      expect(branchFiles).toEqual(['some-new-file']);
    });
  });

  describe('mergeBranch(branchName)', () => {
    it('should perform a branch merge', async () => {
      await git.mergeBranch('renovate/future_branch');
      const merged = await Git(origin.path).branch([
        '--verbose',
        '--merged',
        defaultBranch,
      ]);
      expect(merged.all).toContain('renovate/future_branch');
    });

    it('should throw if branch merge throws', async () => {
      await expect(git.mergeBranch('not_found')).rejects.toThrow();
    });
  });

  describe('deleteBranch(branchName)', () => {
    it('should send delete', async () => {
      await git.deleteBranch('renovate/past_branch');
      const branches = await Git(origin.path).branch({});
      expect(branches.all).not.toContain('renovate/past_branch');
    });
  });

  describe('getBranchLastCommitTime', () => {
    it('should return a Date', async () => {
      const time = await git.getBranchLastCommitTime(defaultBranch);
      expect(time).toEqual(masterCommitDate);
    });

    it('handles error', async () => {
      const res = await git.getBranchLastCommitTime('some-branch');
      expect(res).toBeDefined();
    });
  });

  describe('getFile(filePath, branchName)', () => {
    it('gets the file', async () => {
      const res = await git.getFile('master_file');
      expect(res).toBe(defaultBranch);
    });

    it('short cuts 404', async () => {
      const res = await git.getFile('some-missing-path');
      expect(res).toBeNull();
    });

    it('returns null for 404', async () => {
      expect(await git.getFile('some-path', 'some-branch')).toBeNull();
    });
  });

  describe('commitFiles({branchName, files, message})', () => {
    it('creates file', async () => {
      const file: FileChange = {
        type: 'addition',
        path: 'some-new-file',
        contents: 'some new-contents',
      };
      const commit = await git.commitFiles({
        branchName: 'renovate/past_branch',
        files: [file],
        message: 'Create something',
      });
      expect(commit).not.toBeNull();
    });

    it('link file', async () => {
      const file: FileChange = {
        type: 'addition',
        path: 'future_link',
        contents: 'past_file',
        isSymlink: true,
      };
      const commit = await git.commitFiles({
        branchName: 'renovate/future_branch',
        files: [file],
        message: 'Create a link',
      });
      expect(commit).toBeString();
      const tmpGit = Git(tmpDir.path);
      const lsTree = await tmpGit.raw(['ls-tree', commit!]);
      const files = lsTree
        .trim()
        .split(newlineRegex)
        .map((x) => x.split(/\s/))
        .map(([mode, type, _hash, name]) => [mode, type, name]);
      expect(files).toContainEqual(['100644', 'blob', 'past_file']);
      expect(files).toContainEqual(['120000', 'blob', 'future_link']);
    });

    it('deletes file', async () => {
      const file: FileChange = {
        type: 'deletion',
        path: 'file_to_delete',
      };
      const commit = await git.commitFiles({
        branchName: 'renovate/something',
        files: [file],
        message: 'Delete something',
      });
      expect(commit).not.toBeNull();
    });

    it('updates multiple files', async () => {
      const files: FileChange[] = [
        {
          type: 'addition',
          path: 'some-existing-file',
          contents: 'updated content',
        },
        {
          type: 'addition',
          path: 'some-other-existing-file',
          contents: 'other updated content',
        },
      ];
      const commit = await git.commitFiles({
        branchName: 'renovate/something',
        files,
        message: 'Update something',
      });
      expect(commit).not.toBeNull();
    });

    it('uses right commit SHA', async () => {
      const files: FileChange[] = [
        {
          type: 'addition',
          path: 'some-existing-file',
          contents: 'updated content',
        },
        {
          type: 'addition',
          path: 'some-other-existing-file',
          contents: 'other updated content',
        },
      ];
      const commitConfig = {
        branchName: 'renovate/something',
        files,
        message: 'Update something',
      };
      const commitSha = await git.commitFiles(commitConfig);
      const remoteSha = await git.fetchCommit(commitConfig);
      expect(commitSha).toEqual(remoteSha);
    });

    it('updates git submodules', async () => {
      const files: FileChange[] = [
        {
          type: 'addition',
          path: '.',
          contents: 'some content',
        },
      ];
      const commit = await git.commitFiles({
        branchName: 'renovate/something',
        files,
        message: 'Update something',
      });
      expect(commit).toBeNull();
    });

    it('does not push when no diff', async () => {
      const files: FileChange[] = [
        {
          type: 'addition',
          path: 'future_file',
          contents: 'future',
        },
      ];
      const commit = await git.commitFiles({
        branchName: 'renovate/future_branch',
        files,
        message: 'No change update',
      });
      expect(commit).toBeNull();
    });

    it('does not pass --no-verify', async () => {
      const commitSpy = jest.spyOn(SimpleGit.prototype, 'commit');
      const pushSpy = jest.spyOn(SimpleGit.prototype, 'push');

      const files: FileChange[] = [
        {
          type: 'addition',
          path: 'some-new-file',
          contents: 'some new-contents',
        },
      ];

      await git.commitFiles({
        branchName: 'renovate/something',
        files,
        message: 'Pass no-verify',
      });

      expect(commitSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.not.objectContaining({ '--no-verify': null })
      );
      expect(pushSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.not.objectContaining({ '--no-verify': null })
      );
    });

    it('passes --no-verify to commit', async () => {
      const commitSpy = jest.spyOn(SimpleGit.prototype, 'commit');
      const pushSpy = jest.spyOn(SimpleGit.prototype, 'push');

      const files: FileChange[] = [
        {
          type: 'addition',
          path: 'some-new-file',
          contents: 'some new-contents',
        },
      ];
      setNoVerify(['commit']);

      await git.commitFiles({
        branchName: 'renovate/something',
        files,
        message: 'Pass no-verify',
      });

      expect(commitSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ '--no-verify': null })
      );
      expect(pushSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.not.objectContaining({ '--no-verify': null })
      );
    });

    it('passes --no-verify to push', async () => {
      const commitSpy = jest.spyOn(SimpleGit.prototype, 'commit');
      const pushSpy = jest.spyOn(SimpleGit.prototype, 'push');

      const files: FileChange[] = [
        {
          type: 'addition',
          path: 'some-new-file',
          contents: 'some new-contents',
        },
      ];
      setNoVerify(['push']);

      await git.commitFiles({
        branchName: 'renovate/something',
        files,
        message: 'Pass no-verify',
      });

      expect(commitSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.not.objectContaining({ '--no-verify': null })
      );
      expect(pushSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ '--no-verify': null })
      );
    });

    it('creates file with the executable bit', async () => {
      const file: FileChange = {
        type: 'addition',
        path: 'some-executable',
        contents: 'some new-contents',
        isExecutable: true,
      };
      const commit = await git.commitFiles({
        branchName: 'renovate/past_branch',
        files: [file],
        message: 'Create something',
      });
      expect(commit).not.toBeNull();

      const repo = Git(tmpDir.path);
      const result = await repo.raw(['ls-tree', 'HEAD', 'some-executable']);
      expect(result).toStartWith('100755');
    });
  });

  describe('getCommitMessages()', () => {
    it('returns commit messages', async () => {
      expect(await git.getCommitMessages()).toEqual([
        'master message',
        'past message',
      ]);
    });
  });

  describe('Storage.getUrl()', () => {
    const getUrl = git.getUrl;

    it('returns https url', () => {
      expect(
        getUrl({
          protocol: 'https',
          auth: 'user:pass',
          hostname: 'host',
          repository: 'some/repo',
        })
      ).toBe('https://user:pass@host/some/repo.git');
      expect(
        getUrl({
          auth: 'user:pass',
          hostname: 'host',
          repository: 'some/repo',
        })
      ).toBe('https://user:pass@host/some/repo.git');
    });

    it('returns ssh url', () => {
      expect(
        getUrl({
          protocol: 'ssh',
          auth: 'user:pass',
          hostname: 'host',
          repository: 'some/repo',
        })
      ).toBe('git@host:some/repo.git');
    });
  });

  describe('initRepo())', () => {
    it('should fetch latest', async () => {
      const repo = Git(base.path);
      await repo.checkout(['-b', 'test', defaultBranch]);
      await fs.writeFile(base.path + '/test', 'lorem ipsum');
      await repo.add(['test']);
      await repo.commit('past message2');
      await repo.checkout(defaultBranch);

      expect(git.branchExists('test')).toBeFalsy();

      expect(await git.getCommitMessages()).toEqual([
        'master message',
        'past message',
      ]);

      await git.checkoutBranch('develop');

      await git.initRepo({
        url: base.path,
      });

      expect(git.branchExists('test')).toBeTruthy();

      await git.checkoutBranch('test');

      const msg = await git.getCommitMessages();
      expect(msg).toEqual(['past message2', 'master message', 'past message']);
      expect(msg).toContain('past message2');
    });

    it('should set branch prefix', async () => {
      const repo = Git(base.path);
      await repo.checkout(['-b', 'renovate/test', defaultBranch]);
      await fs.writeFile(base.path + '/test', 'lorem ipsum');
      await repo.add(['test']);
      await repo.commit('past message2');
      await repo.checkout(defaultBranch);

      await git.initRepo({
        url: base.path,
      });

      git.setUserRepoConfig({ branchPrefix: 'renovate/' });
      expect(git.branchExists('renovate/test')).toBeTrue();

      await git.initRepo({
        url: base.path,
      });

      await repo.checkout('renovate/test');
      await repo.commit('past message3', ['--amend']);

      git.setUserRepoConfig({ branchPrefix: 'renovate/' });
      expect(git.branchExists('renovate/test')).toBeTrue();
    });

    it('should fail clone ssh submodule', async () => {
      const repo = Git(base.path);
      await fs.writeFile(
        base.path + '/.gitmodules',
        '[submodule "test"]\npath=test\nurl=ssh://0.0.0.0'
      );
      await repo.add('.gitmodules');
      await repo.raw([
        'update-index',
        '--add',
        '--cacheinfo',
        '160000',
        '4b825dc642cb6eb9a060e54bf8d69288fbee4904',
        'test',
      ]);
      await repo.commit('Add submodule');
      await git.initRepo({
        cloneSubmodules: true,
        url: base.path,
      });
      await git.syncGit();
      expect(await fs.pathExists(tmpDir.path + '/.gitmodules')).toBeTruthy();
      await repo.reset(['--hard', 'HEAD^']);
    });

    it('should use extra clone configuration', async () => {
      await fs.emptyDir(tmpDir.path);
      await git.initRepo({
        url: origin.path,
        extraCloneOpts: {
          '-c': 'extra.clone.config=test-extra-config-value',
        },
        fullClone: true,
      });
      git.getBranchCommit(defaultBranch);
      await git.syncGit();
      const repo = Git(tmpDir.path);
      const res = (await repo.raw(['config', 'extra.clone.config'])).trim();
      expect(res).toBe('test-extra-config-value');
    });
  });

  describe('setGitAuthor()', () => {
    it('throws for invalid', () => {
      expect(() => git.setGitAuthor('invalid')).toThrow(CONFIG_VALIDATION);
    });
  });

  describe('isBranchConflicted', () => {
    beforeAll(async () => {
      const repo = Git(base.path);
      await repo.init();

      await repo.checkout(['-b', 'renovate/conflicted_branch', defaultBranch]);
      await repo.checkout([
        '-b',
        'renovate/non_conflicted_branch',
        defaultBranch,
      ]);

      await repo.checkout(defaultBranch);
      await fs.writeFile(base.path + '/one_file', 'past (updated)');
      await repo.add(['one_file']);
      await repo.commit('past (updated) message');

      await repo.checkout('renovate/conflicted_branch');
      await fs.writeFile(base.path + '/one_file', 'past (updated branch)');
      await repo.add(['one_file']);
      await repo.commit('past (updated branch) message');

      await repo.checkout('renovate/non_conflicted_branch');
      await fs.writeFile(base.path + '/another_file', 'other');
      await repo.add(['another_file']);
      await repo.commit('other (updated branch) message');

      await repo.checkout(defaultBranch);

      conflictsCache.getCachedConflictResult.mockReturnValue(null);
    });

    it('returns true for non-existing source branch', async () => {
      const res = await git.isBranchConflicted(
        defaultBranch,
        'renovate/non_existing_branch'
      );
      expect(res).toBeTrue();
    });

    it('returns true for non-existing target branch', async () => {
      const res = await git.isBranchConflicted(
        'renovate/non_existing_branch',
        'renovate/non_conflicted_branch'
      );
      expect(res).toBeTrue();
    });

    it('detects conflicted branch', async () => {
      const branchBefore = 'renovate/non_conflicted_branch';
      await git.checkoutBranch(branchBefore);

      const res = await git.isBranchConflicted(
        defaultBranch,
        'renovate/conflicted_branch'
      );

      expect(res).toBeTrue();

      const status = await git.getRepoStatus();
      expect(status.current).toEqual(branchBefore);
      expect(status.isClean()).toBeTrue();
    });

    it('detects non-conflicted branch', async () => {
      const branchBefore = 'renovate/conflicted_branch';
      await git.checkoutBranch(branchBefore);

      const res = await git.isBranchConflicted(
        defaultBranch,
        'renovate/non_conflicted_branch'
      );

      expect(res).toBeFalse();

      const status = await git.getRepoStatus();
      expect(status.current).toEqual(branchBefore);
      expect(status.isClean()).toBeTrue();
    });

    describe('cache', () => {
      beforeEach(() => {
        jest.resetAllMocks();
      });

      it('returns cached values', async () => {
        conflictsCache.getCachedConflictResult.mockReturnValue(true);

        const res = await git.isBranchConflicted(
          defaultBranch,
          'renovate/conflicted_branch'
        );

        expect(res).toBeTrue();
        expect(conflictsCache.getCachedConflictResult.mock.calls).toEqual([
          [
            defaultBranch,
            expect.any(String),
            'renovate/conflicted_branch',
            expect.any(String),
          ],
        ]);
        expect(conflictsCache.setCachedConflictResult).not.toHaveBeenCalled();
      });

      it('caches truthy return value', async () => {
        conflictsCache.getCachedConflictResult.mockReturnValue(null);

        const res = await git.isBranchConflicted(
          defaultBranch,
          'renovate/conflicted_branch'
        );

        expect(res).toBeTrue();
        expect(conflictsCache.setCachedConflictResult.mock.calls).toEqual([
          [
            defaultBranch,
            expect.any(String),
            'renovate/conflicted_branch',
            expect.any(String),
            true,
          ],
        ]);
      });

      it('caches falsy return value', async () => {
        conflictsCache.getCachedConflictResult.mockReturnValue(null);

        const res = await git.isBranchConflicted(
          defaultBranch,
          'renovate/non_conflicted_branch'
        );

        expect(res).toBeFalse();
        expect(conflictsCache.setCachedConflictResult.mock.calls).toEqual([
          [
            defaultBranch,
            expect.any(String),
            'renovate/non_conflicted_branch',
            expect.any(String),
            false,
          ],
        ]);
      });
    });
  });

  describe('Renovate non-branch refs', () => {
    const lsRenovateRefs = async (): Promise<string[]> =>
      (await Git(tmpDir.path).raw(['ls-remote', 'origin', 'refs/renovate/*']))
        .split(newlineRegex)
        .map((line) => line.replace(regEx(/[0-9a-f]+\s+/i), ''))
        .filter(Boolean);

    it('creates renovate ref in default section', async () => {
      const commit = git.getBranchCommit('develop')!;

      await git.pushCommitToRenovateRef(commit, 'foo/bar');

      const renovateRefs = await lsRenovateRefs();
      expect(renovateRefs).toContain('refs/renovate/branches/foo/bar');
    });

    it('creates custom section for renovate ref', async () => {
      const commit = git.getBranchCommit('develop')!;

      await git.pushCommitToRenovateRef(commit, 'bar/baz', 'foo');

      const renovateRefs = await lsRenovateRefs();
      expect(renovateRefs).toContain('refs/renovate/foo/bar/baz');
    });

    it('clears pushed Renovate refs', async () => {
      const commit = git.getBranchCommit('develop')!;
      await git.pushCommitToRenovateRef(commit, 'foo');
      await git.pushCommitToRenovateRef(commit, 'bar');
      await git.pushCommitToRenovateRef(commit, 'baz');

      expect(await lsRenovateRefs()).not.toBeEmpty();
      await git.clearRenovateRefs();
      expect(await lsRenovateRefs()).toBeEmpty();
    });

    it('clears remote Renovate refs', async () => {
      const commit = git.getBranchCommit('develop')!;
      const tmpGit = Git(tmpDir.path);
      await tmpGit.raw(['update-ref', 'refs/renovate/aaa', commit]);
      await tmpGit.raw(['push', '--force', 'origin', 'refs/renovate/aaa']);

      await git.pushCommitToRenovateRef(commit, 'bbb');
      await git.pushCommitToRenovateRef(commit, 'ccc', 'branches');
      await git.clearRenovateRefs();
      expect(await lsRenovateRefs()).toBeEmpty();
    });

    it('preserves unknown sections by default', async () => {
      const commit = git.getBranchCommit('develop')!;
      const tmpGit = Git(tmpDir.path);
      await tmpGit.raw(['update-ref', 'refs/renovate/foo/bar', commit]);
      await tmpGit.raw(['push', '--force', 'origin', 'refs/renovate/foo/bar']);
      await git.clearRenovateRefs();
      expect(await lsRenovateRefs()).toEqual(['refs/renovate/foo/bar']);
    });
  });

  describe('listCommitTree', () => {
    it('creates non-branch ref', async () => {
      const commit = git.getBranchCommit('develop')!;
      const res = await git.listCommitTree(commit);
      expect(res).toEqual([
        {
          mode: '100644',
          path: 'past_file',
          sha: '913705ab2ca79368053a476efa48aa6912d052c5',
          type: 'blob',
        },
      ]);
    });
  });

  describe('getRepoStatus', () => {
    it('should pass options into git status', async () => {
      await git.checkoutBranch('renovate/nested_files');

      await fs.writeFile(tmpDir.path + '/bin/nested', 'new nested');
      await fs.writeFile(tmpDir.path + '/root', 'new root');
      const resp = await git.getRepoStatus('bin');

      expect(resp.modified).toStrictEqual(['bin/nested']);
    });

    it('should reject when trying to access directory out of localDir', async () => {
      GlobalConfig.set({ localDir: tmpDir.path });
      await git.checkoutBranch('renovate/nested_files');

      await fs.writeFile(tmpDir.path + '/bin/nested', 'new nested');
      await fs.writeFile(tmpDir.path + '/root', 'new root');

      await expect(git.getRepoStatus('../../bin')).rejects.toThrow(
        INVALID_PATH
      );
    });
  });

  describe('getSubmodules', () => {
    it('should return empty array', async () => {
      expect(await git.getSubmodules()).toHaveLength(0);
    });
  });
});
