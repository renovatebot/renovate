import nock from 'nock';
import * as httpMock from '../../../test/httpMock';
import { REPOSITORY_DISABLED } from '../../constants/error-messages';
import { logger as _logger } from '../../logger';
import { BranchStatus } from '../../types';
import { setBaseUrl } from '../../util/http/bitbucket';
import { Platform, RepoParams } from '../common';

const baseUrl = 'https://api.bitbucket.org';

const pr = {
  id: 5,
  source: { branch: { name: 'branch' } },
  destination: { branch: { name: 'master' } },
  title: 'title',
  summary: { raw: 'summary' },
  state: 'OPEN',
  created_on: '2018-07-02T07:02:25.275030+00:00',
  links: {
    commits: {
      href: `https://api.bitbucket.org/2.0/repositories/some/repo/pullrequests/5/commits`,
    },
  },
};

const diff = `
diff --git a/requirements.txt b/requirements.txt
index 7e08d70..f5283ca 100644
--- a/requirements.txt
+++ b/requirements.txt
@@ -7,7 +7,7 @@ docutils==0.12
enum34==1.1.6
futures==3.2.0
isort==4.3.4
-jedi==0.11.1
+jedi==0.12.1
lazy-object-proxy==1.3.1
lxml==3.6.0
mccabe==0.6.1
`;

const commits = {
  size: 1,
  values: [{ author: { raw: 'Renovate Bot <bot@renovateapp.com>' } }],
};

describe('platform/bitbucket', () => {
  let bitbucket: Platform;
  let hostRules: jest.Mocked<typeof import('../../util/host-rules')>;
  let GitStorage: jest.Mocked<import('../git/storage').Storage> & jest.Mock;
  let logger: jest.Mocked<typeof _logger>;
  beforeEach(async () => {
    // reset module
    jest.resetModules();
    httpMock.reset();
    httpMock.setup();
    jest.mock('../git/storage');
    jest.mock('../../util/host-rules');
    jest.mock('../../logger');
    hostRules = require('../../util/host-rules');
    bitbucket = await import('.');
    logger = (await import('../../logger')).logger as any;
    GitStorage = require('../git/storage').Storage;
    GitStorage.mockImplementation(() => ({
      initRepo: jest.fn(),
      cleanRepo: jest.fn(),
      getFileList: jest.fn(),
      branchExists: jest.fn(() => true),
      isBranchStale: jest.fn(() => false),
      setBaseBranch: jest.fn(),
      getBranchLastCommitTime: jest.fn(),
      getAllRenovateBranches: jest.fn(),
      getCommitMessages: jest.fn(),
      getFile: jest.fn(),
      commitFiles: jest.fn(),
      mergeBranch: jest.fn(),
      deleteBranch: jest.fn(),
      getRepoStatus: jest.fn(),
    }));

    // clean up hostRules
    hostRules.clear();
    hostRules.find.mockReturnValue({
      username: 'abc',
      password: '123',
    });

    setBaseUrl(baseUrl);
  });

  afterEach(async () => {
    await bitbucket.cleanRepo();
  });

  async function initRepoMock(
    config?: Partial<RepoParams>,
    repoResp?: any
  ): Promise<nock.Scope> {
    const repository = config?.repository || 'some/repo';

    const scope = httpMock
      .scope(baseUrl)
      .get(`/2.0/repositories/${repository}`)
      .reply(200, {
        owner: {},
        mainbranch: { name: 'master' },
        ...repoResp,
      });

    await bitbucket.initRepo({
      repository: 'some/repo',
      localDir: '',
      optimizeForDisabled: false,
      ...config,
    });

    return scope;
  }

  describe('initPlatform()', () => {
    it('should throw if no username/password', () => {
      expect.assertions(1);
      expect(() => bitbucket.initPlatform({})).toThrow();
    });
    it('should show warning message if custom endpoint', async () => {
      await bitbucket.initPlatform({
        endpoint: 'endpoint',
        username: 'abc',
        password: '123',
      });
      expect(logger.warn).toHaveBeenCalledWith(
        'Init: Bitbucket Cloud endpoint should generally be https://api.bitbucket.org/ but is being configured to a different value. Did you mean to use Bitbucket Server?'
      );
    });
    it('should init', async () => {
      expect(
        await bitbucket.initPlatform({
          username: 'abc',
          password: '123',
        })
      ).toMatchSnapshot();
    });
  });

  describe('getRepos()', () => {
    it('returns repos', async () => {
      httpMock
        .scope(baseUrl)
        .get('/2.0/repositories/?role=contributor&pagelen=100')
        .reply(200, {
          values: [{ full_name: 'foo/bar' }, { full_name: 'some/repo' }],
        });
      const res = await bitbucket.getRepos();
      expect(res).toEqual(['foo/bar', 'some/repo']);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('initRepo()', () => {
    it('works', async () => {
      httpMock
        .scope(baseUrl)
        .get('/2.0/repositories/some/repo')
        .reply(200, { owner: {}, mainbranch: { name: 'master' } });
      expect(
        await bitbucket.initRepo({
          repository: 'some/repo',
          localDir: '',
          optimizeForDisabled: false,
        })
      ).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('throws disabled', async () => {
      expect.assertions(2);
      httpMock
        .scope(baseUrl)
        .get('/2.0/repositories/some/empty')
        .reply(200, { owner: {}, mainbranch: { name: 'master' } })
        .get('/2.0/repositories/some/empty/src/master/renovate.json')
        .reply(
          200,
          JSON.stringify({
            enabled: false,
          })
        );
      await expect(
        bitbucket.initRepo({
          repository: 'some/empty',
          optimizeForDisabled: true,
          localDir: '',
        })
      ).rejects.toThrow(REPOSITORY_DISABLED);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('getRepoForceRebase()', () => {
    it('always return false, since bitbucket does not support force rebase', async () => {
      const actual = await bitbucket.getRepoForceRebase();
      expect(actual).toBe(false);
    });
  });

  describe('setBaseBranch()', () => {
    it('updates file list', async () => {
      await initRepoMock();
      await bitbucket.setBaseBranch('branch');
      await bitbucket.setBaseBranch();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('getFileList()', () => {
    it('sends to gitFs', async () => {
      await initRepoMock();
      const fileList = await bitbucket.getFileList();
      expect(fileList).not.toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('branchExists()', () => {
    describe('getFileList()', () => {
      it('sends to gitFs', async () => {
        await initRepoMock();
        const branchExists = await bitbucket.branchExists('test');
        expect(branchExists).toEqual(true);
        expect(httpMock.getTrace()).toMatchSnapshot();
      });
    });
  });

  describe('isBranchStale()', () => {
    it('sends to gitFs', async () => {
      await initRepoMock();
      expect(await bitbucket.isBranchStale('test')).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('getBranchPr()', () => {
    it('bitbucket finds PR for branch', async () => {
      const scope = await initRepoMock();
      scope
        .get(
          '/2.0/repositories/some/repo/pullrequests?state=OPEN&state=MERGED&state=DECLINED&state=SUPERSEDED&pagelen=50'
        )
        .reply(200, { values: [pr] })
        .get('/2.0/repositories/some/repo/pullrequests/5')
        .reply(200, pr)
        .get('/2.0/repositories/some/repo/pullrequests/5/diff')
        .reply(200, diff)
        .get('/2.0/repositories/some/repo/pullrequests/5/commits?pagelen=2')
        .reply(200, commits);

      expect(await bitbucket.getBranchPr('branch')).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null if no PR for branch', async () => {
      const scope = await initRepoMock();
      scope
        .get(
          '/2.0/repositories/some/repo/pullrequests?state=OPEN&state=MERGED&state=DECLINED&state=SUPERSEDED&pagelen=50'
        )
        .reply(200, { values: [pr] });

      const res = await bitbucket.getBranchPr('branch_without_pr');
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('getBranchStatus()', () => {
    it('getBranchStatus 1', async () => {
      await initRepoMock();
      expect(await bitbucket.getBranchStatus('master', null)).toBe(
        BranchStatus.green
      );
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('getBranchStatus 2', async () => {
      await initRepoMock();
      expect(await bitbucket.getBranchStatus('master', ['foo'])).toBe(
        BranchStatus.red
      );
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('getBranchStatus 3', async () => {
      const scope = await initRepoMock();
      scope
        .get('/2.0/repositories/some/repo/refs/branches/master')
        .reply(200, {
          name: 'master',
          target: { hash: 'master_hash' },
        })
        .get(
          '/2.0/repositories/some/repo/commit/master_hash/statuses?pagelen=100'
        )
        .reply(200, {
          values: [
            {
              key: 'foo',
              state: 'FAILED',
            },
          ],
        });
      expect(await bitbucket.getBranchStatus('master', [])).toBe(
        BranchStatus.red
      );
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('getBranchStatus 4', async () => {
      const scope = await initRepoMock();
      scope
        .get('/2.0/repositories/some/repo/refs/branches/branch')
        .reply(200, {
          name: 'branch',
          target: {
            hash: 'branch_hash',
            parents: [{ hash: 'master_hash' }],
          },
        })
        .get(
          '/2.0/repositories/some/repo/commit/branch_hash/statuses?pagelen=100'
        )
        .reply(200, {
          values: [
            {
              key: 'foo',
              state: 'SUCCESSFUL',
            },
          ],
        });
      expect(await bitbucket.getBranchStatus('branch', [])).toBe(
        BranchStatus.green
      );
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('getBranchStatus 5', async () => {
      const scope = await initRepoMock();
      scope
        .get('/2.0/repositories/some/repo/refs/branches/pending/branch')
        .reply(200, {
          name: 'pending/branch',
          target: {
            hash: 'pending/branch_hash',
            parents: [{ hash: 'master_hash' }],
          },
        })
        .get(
          '/2.0/repositories/some/repo/commit/pending/branch_hash/statuses?pagelen=100'
        )
        .reply(200, {
          values: [
            {
              key: 'foo',
              state: 'INPROGRESS',
            },
          ],
        });
      expect(await bitbucket.getBranchStatus('pending/branch', [])).toBe(
        BranchStatus.yellow
      );
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('getBranchStatus 6', async () => {
      const scope = await initRepoMock();
      scope
        .get(
          '/2.0/repositories/some/repo/refs/branches/branch-with-empty-status'
        )
        .reply(200, {
          name: 'branch-with-empty-status',
          target: {
            hash: 'branch-with-empty-status',
            parents: [{ hash: 'master_hash' }],
          },
        })
        .get(
          '/2.0/repositories/some/repo/commit/branch-with-empty-status/statuses?pagelen=100'
        )
        .reply(200, {
          values: [],
        });
      expect(
        await bitbucket.getBranchStatus('branch-with-empty-status', [])
      ).toBe(BranchStatus.yellow);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('getBranchStatusCheck()', () => {
    beforeEach(async () => {
      const scope = await initRepoMock();
      scope
        .get('/2.0/repositories/some/repo/refs/branches/master')
        .reply(200, {
          name: 'master',
          target: { hash: 'master_hash' },
        })
        .get(
          '/2.0/repositories/some/repo/commit/master_hash/statuses?pagelen=100'
        )
        .reply(200, {
          values: [
            {
              key: 'foo',
              state: 'FAILED',
            },
          ],
        });
    });
    it('getBranchStatusCheck 1', async () => {
      expect(await bitbucket.getBranchStatusCheck('master', null)).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('getBranchStatusCheck 2', async () => {
      expect(await bitbucket.getBranchStatusCheck('master', 'foo')).toBe(
        BranchStatus.red
      );
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('getBranchStatusCheck 3', async () => {
      expect(await bitbucket.getBranchStatusCheck('master', 'bar')).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('setBranchStatus()', () => {
    it('posts status', async () => {
      const scope = await initRepoMock();
      scope
        .get('/2.0/repositories/some/repo/refs/branches/branch')
        .twice()
        .reply(200, {
          name: 'branch',
          target: {
            hash: 'branch_hash',
            parents: [{ hash: 'master_hash' }],
          },
        })
        .post('/2.0/repositories/some/repo/commit/branch_hash/statuses/build')
        .reply(200)
        .get(
          '/2.0/repositories/some/repo/commit/branch_hash/statuses?pagelen=100'
        )
        .reply(200, {
          values: [
            {
              key: 'foo',
              state: 'SUCCESSFUL',
            },
          ],
        });
      await bitbucket.setBranchStatus({
        branchName: 'branch',
        context: 'context',
        description: 'description',
        state: BranchStatus.red,
        url: 'targetUrl',
      });
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('getRepoStatus()', () => {
    it('sends to gitFs', async () => {
      await initRepoMock();
      expect(await bitbucket.getRepoStatus()).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('deleteBranch()', () => {
    it('sends to gitFs', async () => {
      await initRepoMock();
      expect(await bitbucket.deleteBranch('test')).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('should handle closing PRs when none exist', async () => {
      const scope = await initRepoMock();
      scope
        .get(
          '/2.0/repositories/some/repo/pullrequests?state=OPEN&state=MERGED&state=DECLINED&state=SUPERSEDED&pagelen=50'
        )
        .reply(200, { values: [pr] });
      await bitbucket.deleteBranch('some-branch', true);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('should handle closing PRs when some exist', async () => {
      const scope = await initRepoMock();
      scope
        .get(
          '/2.0/repositories/some/repo/pullrequests?state=OPEN&state=MERGED&state=DECLINED&state=SUPERSEDED&pagelen=50'
        )
        .reply(200, { values: [pr] })
        .post('/2.0/repositories/some/repo/pullrequests/5/decline')
        .reply(200);
      await bitbucket.deleteBranch('branch', true);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('mergeBranch()', () => {
    it('sends to gitFs', async () => {
      await initRepoMock();
      expect(await bitbucket.mergeBranch('test')).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('getBranchLastCommitTime()', () => {
    it('sends to gitFs', async () => {
      await initRepoMock();
      expect(await bitbucket.getBranchLastCommitTime('test')).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('findIssue()', () => {
    it('does not throw', async () => {
      const scope = await initRepoMock({}, { has_issues: true });
      scope
        .get(
          '/2.0/repositories/some/repo/issues?q=title%3D%22title%22%20AND%20(state%20%3D%20%22new%22%20OR%20state%20%3D%20%22open%22)%20AND%20reporter.username%3D%22abc%22'
        )
        .reply(200, {
          values: [
            {
              id: 25,
              title: 'title',
              content: { raw: 'content' },
            },
            {
              id: 26,
              title: 'title',
              content: { raw: 'content' },
            },
          ],
        });
      expect(await bitbucket.findIssue('title')).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null if no issues', async () => {
      const scope = await initRepoMock(
        {
          repository: 'some/empty',
        },
        { has_issues: true }
      );
      scope
        .get(
          '/2.0/repositories/some/empty/issues?q=title%3D%22title%22%20AND%20(state%20%3D%20%22new%22%20OR%20state%20%3D%20%22open%22)%20AND%20reporter.username%3D%22abc%22'
        )
        .reply(200, {
          values: [],
        });
      expect(await bitbucket.findIssue('title')).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
  describe('ensureIssue()', () => {
    it('updates existing issues', async () => {
      const scope = await initRepoMock({}, { has_issues: true });
      scope
        .get(
          '/2.0/repositories/some/repo/issues?q=title%3D%22title%22%20AND%20(state%20%3D%20%22new%22%20OR%20state%20%3D%20%22open%22)%20AND%20reporter.username%3D%22abc%22'
        )
        .reply(200, {
          values: [
            {
              id: 25,
              title: 'title',
              content: { raw: 'content' },
            },
            {
              id: 26,
              title: 'title',
              content: { raw: 'content' },
            },
          ],
        })
        .put('/2.0/repositories/some/repo/issues/25')
        .reply(200)
        .put('/2.0/repositories/some/repo/issues/26')
        .reply(200);
      expect(
        await bitbucket.ensureIssue({ title: 'title', body: 'body' })
      ).toEqual('updated');
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('creates new issue', async () => {
      const scope = await initRepoMock(
        { repository: 'some/empty' },
        { has_issues: true }
      );
      scope
        .get(
          '/2.0/repositories/some/empty/issues?q=title%3D%22title%22%20AND%20(state%20%3D%20%22new%22%20OR%20state%20%3D%20%22open%22)%20AND%20reporter.username%3D%22abc%22'
        )
        .reply(200, { values: [] })
        .post('/2.0/repositories/some/empty/issues')
        .reply(200);
      expect(
        await bitbucket.ensureIssue({ title: 'title', body: 'body' })
      ).toEqual('created');
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('noop for existing issue', async () => {
      const scope = await initRepoMock({}, { has_issues: true });
      scope
        .get(
          '/2.0/repositories/some/repo/issues?q=title%3D%22title%22%20AND%20(state%20%3D%20%22new%22%20OR%20state%20%3D%20%22open%22)%20AND%20reporter.username%3D%22abc%22'
        )
        .reply(200, {
          values: [
            {
              id: 25,
              title: 'title',
              content: { raw: 'content' },
            },
            {
              id: 26,
              title: 'title',
              content: { raw: 'content' },
            },
          ],
        })
        .put('/2.0/repositories/some/repo/issues/26')
        .reply(200);
      expect(
        await bitbucket.ensureIssue({
          title: 'title',
          body: '\n content \n',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('ensureIssueClosing()', () => {
    it('does not throw', async () => {
      await initRepoMock();
      await bitbucket.ensureIssueClosing('title');
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('closes issue', async () => {
      const scope = await initRepoMock({}, { has_issues: true });
      scope
        .get(
          '/2.0/repositories/some/repo/issues?q=title%3D%22title%22%20AND%20(state%20%3D%20%22new%22%20OR%20state%20%3D%20%22open%22)%20AND%20reporter.username%3D%22abc%22'
        )
        .reply(200, {
          values: [
            {
              id: 25,
              title: 'title',
              content: { raw: 'content' },
            },
            {
              id: 26,
              title: 'title',
              content: { raw: 'content' },
            },
          ],
        })
        .put('/2.0/repositories/some/repo/issues/25')
        .reply(200)
        .put('/2.0/repositories/some/repo/issues/26')
        .reply(200);
      await bitbucket.ensureIssueClosing('title');
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('addAssignees()', () => {
    it('does not throw', async () => {
      expect(await bitbucket.addAssignees(3, ['some'])).toMatchSnapshot();
    });
  });

  describe('addReviewers', () => {
    it('should add the given reviewers to the PR', async () => {
      const scope = await initRepoMock();
      scope
        .get('/2.0/repositories/some/repo/pullrequests/5')
        .reply(200, pr)
        .get('/2.0/repositories/some/repo/pullrequests/5/diff')
        .reply(200, diff)
        .get('/2.0/repositories/some/repo/pullrequests/5/commits?pagelen=2')
        .reply(200, commits)
        .put('/2.0/repositories/some/repo/pullrequests/5')
        .reply(200);
      await bitbucket.addReviewers(5, ['someuser', 'someotheruser']);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('ensureComment()', () => {
    it('does not throw', async () => {
      expect(
        await bitbucket.ensureComment({
          number: 3,
          topic: 'topic',
          content: 'content',
        })
      ).toMatchSnapshot();
    });
  });

  describe('ensureCommentRemoval()', () => {
    it('does not throw', async () => {
      expect(
        await bitbucket.ensureCommentRemoval({ number: 3, topic: 'topic' })
      ).toMatchSnapshot();
    });
  });

  describe('getPrList()', () => {
    it('exists', () => {
      expect(bitbucket.getPrList).toBeDefined();
    });
  });

  describe('findPr()', () => {
    it('exists', () => {
      expect(bitbucket.findPr).toBeDefined();
    });

    it('finds pr', async () => {
      const scope = await initRepoMock();
      scope
        .get(
          '/2.0/repositories/some/repo/pullrequests?state=OPEN&state=MERGED&state=DECLINED&state=SUPERSEDED&pagelen=50'
        )
        .reply(200, { values: [pr] });
      expect(
        await bitbucket.findPr({
          branchName: 'branch',
          prTitle: 'title',
        })
      ).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('createPr()', () => {
    it('posts PR', async () => {
      const scope = await initRepoMock();
      scope
        .get('/2.0/repositories/some/repo/default-reviewers')
        .reply(200, {
          values: [{ uuid: '{1234-5678}' }],
        })
        .post('/2.0/repositories/some/repo/pullrequests')
        .reply(200, { id: 5 });
      const { number } = await bitbucket.createPr({
        branchName: 'branch',
        prTitle: 'title',
        prBody: 'body',
      });
      expect(number).toBe(5);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('getPr()', () => {
    it('exists', async () => {
      const scope = await initRepoMock();
      scope
        .get('/2.0/repositories/some/repo/pullrequests/5')
        .reply(200, pr)
        .get('/2.0/repositories/some/repo/pullrequests/5/diff')
        .reply(200, diff)
        .get('/2.0/repositories/some/repo/pullrequests/5/commits?pagelen=2')
        .reply(200, commits);
      expect(await bitbucket.getPr(5)).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('canRebase', async () => {
      expect.assertions(4);
      const author = global.gitAuthor;
      const scope = await initRepoMock();
      scope
        .get('/2.0/repositories/some/repo/pullrequests/3')
        .reply(200, {
          id: 3,
          source: { branch: { name: 'branch' } },
          destination: { branch: { name: 'master' } },
          title: 'title',
          summary: { raw: 'summary' },
          state: 'OPEN',
          created_on: '2018-07-02T07:02:25.275030+00:00',
          links: {
            commits: {
              href: `https://api.bitbucket.org/2.0/repositories/some/repo/pullrequests/3/commits`,
            },
          },
        })
        .get('/2.0/repositories/some/repo/pullrequests/3/diff')
        .reply(200, ' ')
        .get('/2.0/repositories/some/repo/pullrequests/3/commits?pagelen=2')
        .reply(200, {
          size: 2,
        })
        .get('/2.0/repositories/some/repo/pullrequests/5')
        .twice()
        .reply(200, pr)
        .get('/2.0/repositories/some/repo/pullrequests/5/diff')
        .twice()
        .reply(200, diff)
        .get('/2.0/repositories/some/repo/pullrequests/5/commits?pagelen=2')
        .twice()
        .reply(200, commits);
      try {
        expect(await bitbucket.getPr(3)).toMatchSnapshot();

        global.gitAuthor = { email: 'bot@renovateapp.com', name: 'bot' };
        expect(await bitbucket.getPr(5)).toMatchSnapshot();

        global.gitAuthor = { email: 'jane@example.com', name: 'jane' };
        expect(await bitbucket.getPr(5)).toMatchSnapshot();

        expect(httpMock.getTrace()).toMatchSnapshot();
      } finally {
        global.gitAuthor = author;
      }
    });
  });

  describe('getPrBody()', () => {
    it('returns diff files', () => {
      expect(
        bitbucket.getPrBody(
          '<details><summary>foo</summary>bar</details>text<details>'
        )
      ).toMatchSnapshot();
    });
  });

  describe('updatePr()', () => {
    it('puts PR', async () => {
      const scope = await initRepoMock();
      scope.put('/2.0/repositories/some/repo/pullrequests/5').reply(200);
      await bitbucket.updatePr(5, 'title', 'body');
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('mergePr()', () => {
    it('posts Merge', async () => {
      const scope = await initRepoMock();
      scope.post('/2.0/repositories/some/repo/pullrequests/5/merge').reply(200);
      await bitbucket.mergePr(5, 'branch');
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('commitFiles()', () => {
    it('sends to gitFs', async () => {
      await initRepoMock();
      const res = await bitbucket.commitFiles({
        branchName: 'test',
        files: [],
        message: 'message',
      });
      expect(res).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('getFile()', () => {
    it('sends to gitFs', async () => {
      await initRepoMock();
      expect(await bitbucket.getFile('test.file')).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('getCommitMessages()', () => {
    it('sends to gitFs', async () => {
      await initRepoMock();
      expect(await bitbucket.getCommitMessages()).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('getAllRenovateBranches()', () => {
    it('sends to gitFs', async () => {
      await initRepoMock();
      expect(await bitbucket.getAllRenovateBranches('test')).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('getVulnerabilityAlerts()', () => {
    it('returns empty array', async () => {
      expect(await bitbucket.getVulnerabilityAlerts()).toEqual([]);
    });
  });
});
