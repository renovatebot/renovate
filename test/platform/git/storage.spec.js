const fs = require('fs-extra');
const Git = require('simple-git/promise');
const tmp = require('tmp-promise');
const GitStorage = require('../../../lib/platform/git/storage');

describe('platform/git/storage', () => {
  jest.setTimeout(15000);

  const git = new GitStorage();
  const masterCommitDate = new Date();
  masterCommitDate.setMilliseconds(0);
  let base;
  let origin;
  beforeAll(async () => {
    base = await tmp.dir({ unsafeCleanup: true });
    const repo = Git(base.path).silent(true);
    await repo.init();
    await fs.writeFile(base.path + '/past_file', 'past');
    await repo.add(['past_file']);
    await repo.commit('past message');

    await repo.checkoutBranch('renovate/past_branch', 'master');
    await repo.checkoutBranch('develop', 'master');

    await repo.checkout('master');
    await fs.writeFile(base.path + '/master_file', 'master');
    await repo.add(['master_file']);
    await repo.commit('master message', [
      '--date=' + masterCommitDate.toISOString(),
    ]);

    await repo.checkoutBranch('renovate/future_branch', 'master');
    await fs.writeFile(base.path + '/future_file', 'future');
    await repo.add(['future_file']);
    await repo.commit('future message');

    await repo.checkout('master');
  });

  let tmpDir;

  beforeEach(async () => {
    origin = await tmp.dir({ unsafeCleanup: true });
    const repo = Git(origin.path);
    await repo.clone(base.path, '.', ['--bare']);
    tmpDir = await tmp.dir({ unsafeCleanup: true });
    await git.initRepo({
      localDir: tmpDir.path,
      platform: 'github',
      repository: 'owner/repo-name',
      url: origin.path,
      gitAuthor: {
        name: 'test',
        address: 'test@example.com',
      },
    });
  });

  afterEach(() => {
    tmpDir.cleanup();
    origin.cleanup();
    git.cleanRepo();
  });

  afterAll(() => {
    base.cleanup();
  });

  describe('setBaseBranch(branchName)', () => {
    it('sets the base branch as master', async () => {
      await git.setBaseBranch('master');
    });
    it('sets non-master base branch', async () => {
      await git.setBaseBranch('develop');
    });
  });
  describe('getFileList()', () => {
    it('returns empty array if error', async () => {
      expect(await git.getFileList('not_found')).toEqual([]);
    });
    it('should return the correct files', async () => {
      expect(await git.getFileList('renovate/future_branch')).toMatchSnapshot();
    });
  });
  describe('branchExists(branchName)', () => {
    it('should return true if found', async () => {
      expect(await git.branchExists('renovate/future_branch')).toBe(true);
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
  });

  describe('getBranchCommit(branchName)', () => {
    it('should return same value for equal refs', async () => {
      const hex = await git.getBranchCommit('renovate/past_branch');
      expect(hex).toBe(await git.getBranchCommit('master~1'));
      expect(hex).toHaveLength(40);
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
      await git.mergeBranch('renovate/future_branch');
      const merged = await Git(origin.path).branch([
        '--verbose',
        '--merged',
        'master',
      ]);
      expect(merged.all).toContain('renovate/future_branch');
    });
    it('should throw if branch merge throws', async () => {
      let e;
      try {
        await git.mergeBranch('not_found');
      } catch (err) {
        e = err;
      }
      expect(e).toMatchSnapshot();
    });
  });
  describe('deleteBranch(branchName)', () => {
    it('should send delete', async () => {
      await git.deleteBranch('renovate/past_branch');
      const branches = await Git(origin.path).branch();
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
      expect(res).toBe(null);
    });
    it('returns null for 404', async () => {
      let e;
      try {
        await git.getFile('some-path', 'some-branch');
      } catch (err) {
        e = err;
      }
      expect(e).toMatchSnapshot();
    });
  });
  describe('commitFilesToBranch(branchName, files, message, parentBranch)', () => {
    it('creates file', async () => {
      const file = {
        name: 'some-new-file',
        contents: 'some new-contents',
      };
      await git.commitFilesToBranch(
        'renovate/past_branch',
        [file],
        'Create something'
      );
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
      await git.commitFilesToBranch(
        'renovate/something',
        files,
        'Update something'
      );
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
          gitFs: 'https',
          auth: 'user:pass',
          hostname: 'host',
          repository: 'some/repo',
        })
      ).toEqual('https://user:pass@host/some/repo.git');
    });

    it('returns ssh url', () => {
      expect(
        getUrl({
          gitFs: 'ssh',
          auth: 'user:pass',
          hostname: 'host',
          repository: 'some/repo',
        })
      ).toEqual('git@host:some/repo.git');
    });
  });
});
