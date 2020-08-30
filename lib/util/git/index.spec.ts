import fs from 'fs-extra';
import Git from 'simple-git';
import tmp from 'tmp-promise';
import * as git from '.';

describe('platform/git', () => {
  jest.setTimeout(15000);

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

    await repo.checkout(['-b', 'renovate/past_branch', 'master']);
    await repo.checkout(['-b', 'develop', 'master']);

    await repo.checkout('master');
    await fs.writeFile(base.path + '/master_file', 'master');
    await fs.writeFile(base.path + '/file_to_delete', 'bye');
    await repo.add(['master_file', 'file_to_delete']);
    await repo.commit('master message', [
      '--date=' + masterCommitDate.toISOString(),
    ]);

    await repo.checkout(['-b', 'renovate/future_branch', 'master']);
    await fs.writeFile(base.path + '/future_file', 'future');
    await repo.add(['future_file']);
    await repo.commit('future message');

    await repo.checkoutBranch('renovate/modified_branch', 'master');
    await fs.writeFile(base.path + '/base_file', 'base');
    await repo.add(['base_file']);
    await repo.commit('base message');
    await fs.writeFile(base.path + '/modified_file', 'modified');
    await repo.add(['modified_file']);
    await repo.commit('modification');

    await repo.checkoutBranch('renovate/custom_author', 'master');
    await fs.writeFile(base.path + '/custom_file', 'custom');
    await repo.add(['custom_file']);
    await repo.addConfig('user.email', 'custom@example.com');
    await repo.commit('custom message');

    await repo.checkoutBranch('renovate/equal_branch', 'master');

    await repo.checkout('master');
  });

  let tmpDir: tmp.DirectoryResult;

  beforeEach(async () => {
    origin = await tmp.dir({ unsafeCleanup: true });
    const repo = Git(origin.path);
    await repo.clone(base.path, '.', ['--bare']);
    tmpDir = await tmp.dir({ unsafeCleanup: true });
    git.initRepo({
      localDir: tmpDir.path,
      url: origin.path,
      extraCloneOpts: {
        '--config': 'extra.clone.config=test-extra-config-value',
      },
      gitAuthorName: 'Jest',
      gitAuthorEmail: 'Jest@example.com',
    });
    await git.setBranchPrefix('renovate/');
    await git.syncGit();
  });

  afterEach(async () => {
    await tmpDir.cleanup();
    await origin.cleanup();
  });

  afterAll(async () => {
    await base.cleanup();
  });

  describe('setBaseBranch(branchName)', () => {
    it('sets the base branch as master', async () => {
      await expect(git.setBranch('master')).resolves.not.toThrow();
    });
    it('sets non-master base branch', async () => {
      await expect(git.setBranch('develop')).resolves.not.toThrow();
    });
    it('should throw if branch does not exist', async () => {
      await expect(git.setBranch('not_found')).rejects.toMatchSnapshot();
    });
  });
  describe('getFileList()', () => {
    it('should return the correct files', async () => {
      expect(await git.getFileList()).toMatchSnapshot();
    });
    it('should exclude submodules', async () => {
      const repo = Git(base.path).silent(true);
      await repo.submoduleAdd(base.path, 'submodule');
      await repo.commit('Add submodule');
      git.initRepo({
        localDir: tmpDir.path,
        url: base.path,
      });
      await git.syncGit();
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
  describe('isBranchModified()', () => {
    it('should throw if branch does not exist', async () => {
      await expect(git.isBranchModified('not_found')).rejects.toMatchSnapshot();
    });
    it('should return true when author matches', async () => {
      expect(await git.isBranchModified('renovate/future_branch')).toBe(false);
      expect(await git.isBranchModified('renovate/future_branch')).toBe(false);
    });
    it('should return false when custom author', async () => {
      expect(await git.isBranchModified('renovate/custom_author')).toBe(true);
    });
  });

  describe('getBranchCommit(branchName)', () => {
    it('should return same value for equal refs', async () => {
      const hex = await git.getBranchCommit('renovate/equal_branch');
      expect(hex).toBe(await git.getBranchCommit('master'));
      expect(hex).toHaveLength(40);
    });
    it('should throw if branch does not exist', async () => {
      await expect(git.getBranchCommit('not_found')).rejects.toMatchSnapshot();
    });
  });

  describe('getBranchFiles(branchName)', () => {
    it('detects changed files compared to current base branch', async () => {
      const file = {
        name: 'some-new-file',
        contents: 'some new-contents',
      };
      await git.commitFiles({
        branchName: 'renovate/branch_with_changes',
        files: [file],
        message: 'Create something',
      });
      const branchFiles = await git.getBranchFiles(
        'renovate/branch_with_changes'
      );
      expect(branchFiles).toMatchSnapshot();
    });
  });

  describe('mergeBranch(branchName)', () => {
    it('should perform a branch merge', async () => {
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
  describe('commitFiles({branchName, files, message})', () => {
    it('creates file', async () => {
      const file = {
        name: 'some-new-file',
        contents: 'some new-contents',
      };
      const commit = await git.commitFiles({
        branchName: 'renovate/past_branch',
        files: [file],
        message: 'Create something',
      });
      expect(commit).not.toBeNull();
    });
    it('deletes file', async () => {
      const file = {
        name: '|delete|',
        contents: 'file_to_delete',
      };
      const commit = await git.commitFiles({
        branchName: 'renovate/something',
        files: [file],
        message: 'Delete something',
      });
      expect(commit).not.toBeNull();
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
      const commit = await git.commitFiles({
        branchName: 'renovate/something',
        files,
        message: 'Update something',
      });
      expect(commit).not.toBeNull();
    });
    it('updates git submodules', async () => {
      const files = [
        {
          name: '.',
          contents: 'some content',
        },
      ];
      const commit = await git.commitFiles({
        branchName: 'renovate/something',
        files,
        message: 'Update something',
      });
      expect(commit).not.toBeNull();
    });
    it('does not push when no diff', async () => {
      const branchName = 'renovate/something';
      const local = Git(tmpDir.path);
      await local.push('origin', `master:${branchName}`);
      await local.fetch([
        'origin',
        `refs/heads/${branchName}:refs/remotes/origin/${branchName}`,
      ]);
      const files = [];
      const commit = await git.commitFiles({
        branchName,
        files,
        message: 'Update something',
      });
      expect(commit).toBeNull();
    });
  });

  describe('getCommitMessages()', () => {
    it('returns commit messages', async () => {
      expect(await git.getCommitMessages()).toMatchSnapshot();
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
      await repo.checkout(['-b', 'test', 'master']);
      await fs.writeFile(base.path + '/test', 'lorem ipsum');
      await repo.add(['test']);
      await repo.commit('past message2');
      await repo.checkout('master');

      expect(await git.branchExists('test')).toBeFalsy();

      expect(await git.getCommitMessages()).toMatchSnapshot();

      await git.setBranch('develop');

      git.initRepo({
        localDir: tmpDir.path,
        url: base.path,
      });

      expect(await git.branchExists('test')).toBeTruthy();

      await git.setBranch('test');

      const msg = await git.getCommitMessages();
      expect(msg).toMatchSnapshot();
      expect(msg).toContain('past message2');
    });

    it('should set branch prefix', async () => {
      const repo = Git(base.path).silent(true);
      await repo.checkout(['-b', 'renovate/test', 'master']);
      await fs.writeFile(base.path + '/test', 'lorem ipsum');
      await repo.add(['test']);
      await repo.commit('past message2');
      await repo.checkout('master');

      git.initRepo({
        localDir: tmpDir.path,
        url: base.path,
      });

      await git.setBranchPrefix('renovate/');
      expect(await git.branchExists('renovate/test')).toBe(true);
      const cid = await git.getBranchCommit('renovate/test');

      git.initRepo({
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
      git.initRepo({
        localDir: tmpDir.path,
        url: base.path,
      });
      await git.syncGit();
      expect(await fs.exists(tmpDir.path + '/.gitmodules')).toBeTruthy();
      await repo.reset(['--hard', 'HEAD^']);
    });

    it('should use extra clone configuration', async () => {
      const repo = Git(tmpDir.path).silent(true);
      const res = (await repo.raw(['config', 'extra.clone.config'])).trim();
      expect(res).toBe('test-extra-config-value');
    });
  });
});
