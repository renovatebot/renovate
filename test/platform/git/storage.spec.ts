import fs from 'fs-extra';
import Git from 'simple-git/promise';
import tmp from 'tmp-promise';
import GitStorage from '../../../lib/platform/git/storage';

describe('platform/git/storage', () => {
  jest.setTimeout(15000);

  const git = new GitStorage();
  const masterCommitDate = new Date();
  masterCommitDate.setMilliseconds(0);
  let base: tmp.DirectoryResult;
  let origin: tmp.DirectoryResult;
  beforeAll(async () => {
    base = await tmp.dir({ unsafeCleanup: true });
    const repo = Git(base.path).silent(true);
    await repo.init();
    await repo.addConfig('user.email', 'Jest@example.com');
    await repo.addConfig('user.name', 'Jest');
    await fs.writeFile(base.path + '/past_file', 'past');
    await repo.add(['past_file']);
    await repo.commit('past message');

    await repo.checkoutBranch('renovate/past_branch', 'master');
    await repo.checkoutBranch('develop', 'master');

    await repo.checkout('master');
    await fs.writeFile(base.path + '/master_file', 'master');
    await fs.writeFile(base.path + '/file_to_delete', 'bye');
    await repo.add(['master_file', 'file_to_delete']);
    await repo.commit('master message', [
      '--date=' + masterCommitDate.toISOString(),
    ]);

    await repo.checkoutBranch('renovate/future_branch', 'master');
    await fs.writeFile(base.path + '/future_file', 'future');
    await repo.add(['future_file']);
    await repo.commit('future message');

    await repo.checkout('master');
  });

  let tmpDir: tmp.DirectoryResult;

  beforeEach(async () => {
    origin = await tmp.dir({ unsafeCleanup: true });
    const repo = Git(origin.path);
    await repo.clone(base.path, '.', ['--bare']);
    tmpDir = await tmp.dir({ unsafeCleanup: true });
    global.gitAuthor = {
      name: 'test',
      email: 'test@example.com',
    };
    await git.initRepo({
      localDir: tmpDir.path,
      url: origin.path,
    });
  });

  afterEach(async () => {
    await tmpDir.cleanup();
    await origin.cleanup();
    git.cleanRepo();
  });

  afterAll(async () => {
    await base.cleanup();
  });

  describe('setBaseBranch(branchName)', () => {
    it('sets the base branch as master', async () => {
      await git.setBaseBranch('master');
    });
    it('sets non-master base branch', async () => {
      await git.setBaseBranch('develop');
    });
    it('should throw if branch does not exist', async () => {
      await expect(git.setBaseBranch('not_found')).rejects.toMatchSnapshot();
    });
  });
  describe('getFileList()', () => {
    it('returns empty array if error', async () => {
      expect(await git.getFileList('not_found')).toEqual([]);
    });
    it('should return the correct files', async () => {
      expect(await git.getFileList('renovate/future_branch')).toMatchSnapshot();
      expect(await git.getFileList()).toMatchSnapshot();
    });
    it('should exclude submodules', async () => {
      const repo = Git(base.path).silent(true);
      await repo.submoduleAdd(base.path, 'submodule');
      await repo.commit('Add submodule');
      await git.initRepo({
        localDir: tmpDir.path,
        url: base.path,
      });
      expect(await fs.exists(tmpDir.path + '/.gitmodules')).toBeTruthy();
      expect(await git.getFileList()).toMatchSnapshot();
      await repo.reset(['--hard', 'HEAD^']);
    });
  });
  describe('branchExists(branchName)', () => {
    it('should return true if found', async () => {
      expect(await git.branchExists('renovate/future_branch')).toBe(true);
      expect(await git.branchExists('renovate/future_branch')).toBe(true); // should come from cache
    });
    it('should return false if not found', async () => {
      expect(await git.branchExists('not_found')).toBe(false);
    });
  });
  describe('getAllRenovateBranches()', () => {
    it('should return all renovate branches', async () => {
      await git.setBranchPrefix('renovate/');
      const res = await git.getAllRenovateBranches('renovate/');
      expect(res).toContain('renovate/past_branch');
      expect(res).toContain('renovate/future_branch');
      expect(res).not.toContain('master');
    });
  });
  describe('isBranchStale()', () => {
    it('should return false if same SHA as master', async () => {
      expect(await git.isBranchStale('renovate/future_branch')).toBe(false);
    });
    it('should return true if SHA different from master', async () => {
      expect(await git.isBranchStale('renovate/past_branch')).toBe(true);
    });
    it('should throw if branch does not exist', async () => {
      await expect(git.isBranchStale('not_found')).rejects.toMatchSnapshot();
    });
  });

  describe('getBranchCommit(branchName)', () => {
    it('should return same value for equal refs', async () => {
      const hex = await git.getBranchCommit('renovate/past_branch');
      expect(hex).toBe(await git.getBranchCommit('master~1'));
      expect(hex).toHaveLength(40);
    });
    it('should throw if branch does not exist', async () => {
      await expect(git.getBranchCommit('not_found')).rejects.toMatchSnapshot();
    });
  });

  describe('createBranch(branchName, sha)', () => {
    it('resets existing branch', async () => {
      const hex = await git.getBranchCommit('renovate/past_branch');
      expect(await git.getBranchCommit('renovate/future_branch')).not.toBe(hex);
      await git.createBranch('renovate/future_branch', hex);
      expect(await git.getBranchCommit('renovate/future_branch')).toBe(hex);
    });
  });

  describe('mergeBranch(branchName)', () => {
    it('should perform a branch merge', async () => {
      await git.setBranchPrefix('renovate/');
      await git.mergeBranch('renovate/future_branch');
      const merged = await Git(origin.path).branch([
        '--verbose',
        '--merged',
        'master',
      ]);
      expect(merged.all).toContain('renovate/future_branch');
    });
    it('should throw if branch merge throws', async () => {
      await expect(git.mergeBranch('not_found')).rejects.toThrow();
    });
    it('should throw if branch merge is stale', async () => {
      expect.assertions(1);
      await git.setBranchPrefix('renovate/');
      await git.commitFilesToBranch({
        branchName: 'test',
        files: [{ name: 'some-new-file', contents: 'some new-contents' }],
        message: 'test mesage',
        parentBranch: 'renovate/past_branch',
      });

      await git.setBaseBranch('master');

      await expect(git.mergeBranch('test')).rejects.toThrow();
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
      const time = await git.getBranchLastCommitTime('master');
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
      expect(res).toBe('master');
    });
    it('short cuts 404', async () => {
      const res = await git.getFile('some-missing-path');
      expect(res).toBeNull();
    });
    it('returns null for 404', async () => {
      await expect(
        git.getFile('some-path', 'some-branch')
      ).rejects.toMatchSnapshot();
    });
  });
  describe('commitFilesToBranch({branchName, files, message, parentBranch})', () => {
    it('creates file', async () => {
      const file = {
        name: 'some-new-file',
        contents: 'some new-contents',
      };
      await git.commitFilesToBranch({
        branchName: 'renovate/past_branch',
        files: [file],
        message: 'Create something',
      });
    });
    it('deletes file', async () => {
      const file = {
        name: '|delete|',
        contents: 'file_to_delete',
      };
      await git.commitFilesToBranch({
        branchName: 'renovate/something',
        files: [file],
        message: 'Delete something',
      });
    });
    it('updates multiple files', async () => {
      const files = [
        {
          name: 'some-existing-file',
          contents: 'updated content',
        },
        {
          name: 'some-other-existing-file',
          contents: 'other updated content',
        },
      ];
      await git.commitFilesToBranch({
        branchName: 'renovate/something',
        files,
        message: 'Update something',
      });
    });
    it('updates git submodules', async () => {
      const files = [
        {
          name: '.',
          contents: 'some content',
        },
      ];
      await git.commitFilesToBranch({
        branchName: 'renovate/something',
        files,
        message: 'Update something',
      });
    });
  });

  describe('getCommitMessages()', () => {
    it('returns commit messages', async () => {
      expect(await git.getCommitMessages()).toMatchSnapshot();
    });
  });

  describe('Storage.getUrl()', () => {
    const getUrl = GitStorage.getUrl;
    it('returns https url', () => {
      expect(
        getUrl({
          protocol: 'https',
          auth: 'user:pass',
          hostname: 'host',
          repository: 'some/repo',
        })
      ).toEqual('https://user:pass@host/some/repo.git');
      expect(
        getUrl({
          auth: 'user:pass',
          hostname: 'host',
          repository: 'some/repo',
        })
      ).toEqual('https://user:pass@host/some/repo.git');
    });

    it('returns ssh url', () => {
      expect(
        getUrl({
          protocol: 'ssh',
          auth: 'user:pass',
          hostname: 'host',
          repository: 'some/repo',
        })
      ).toEqual('git@host:some/repo.git');
    });
  });

  describe('initRepo())', () => {
    it('should fetch latest', async () => {
      const repo = Git(base.path).silent(true);
      await repo.checkoutBranch('test', 'master');
      await fs.writeFile(base.path + '/test', 'lorem ipsum');
      await repo.add(['test']);
      await repo.commit('past message2');
      await repo.checkout('master');

      expect(await git.branchExists('test')).toBeFalsy();

      expect(await git.getCommitMessages()).toMatchSnapshot();

      await git.setBaseBranch('develop');

      await git.initRepo({
        localDir: tmpDir.path,
        url: base.path,
      });

      expect(await git.branchExists('test')).toBeTruthy();

      await git.setBaseBranch('test');

      const msg = await git.getCommitMessages();
      expect(msg).toMatchSnapshot();
      expect(msg).toContain('past message2');
    });

    it('should set branch prefix', async () => {
      const repo = Git(base.path).silent(true);
      await repo.checkoutBranch('renovate/test', 'master');
      await fs.writeFile(base.path + '/test', 'lorem ipsum');
      await repo.add(['test']);
      await repo.commit('past message2');
      await repo.checkout('master');

      await git.initRepo({
        localDir: tmpDir.path,
        url: base.path,
      });

      await git.setBranchPrefix('renovate/');
      expect(await git.branchExists('renovate/test')).toBe(true);
      const cid = await git.getBranchCommit('renovate/test');

      await git.initRepo({
        localDir: tmpDir.path,
        url: base.path,
      });

      await repo.checkout('renovate/test');
      await repo.commit('past message3', ['--amend']);

      await git.setBranchPrefix('renovate/');
      expect(await git.branchExists('renovate/test')).toBe(true);
      expect(await git.getBranchCommit('renovate/test')).not.toEqual(cid);
    });

    it('should fail clone ssh submodule', async () => {
      const repo = Git(base.path).silent(true);
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
        localDir: tmpDir.path,
        url: base.path,
      });
      expect(await fs.exists(tmpDir.path + '/.gitmodules')).toBeTruthy();
      await repo.reset(['--hard', 'HEAD^']);
    });
  });
});
