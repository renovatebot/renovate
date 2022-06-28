import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { REPOSITORY_ARCHIVED } from '../../../constants/error-messages';
import { BranchStatus } from '../../../types';
import type * as _git from '../../../util/git';
import { repoFingerprint } from '../util';
import { TAG_PULL_REQUEST_BODY } from './types';
import { mapGerritChangeToPr } from './utils';
import * as gerrit from '.';

const gerritEndpointUrl = 'https://dev.gerrit.com/renovate';

jest.mock('../../../util/git');
const git: jest.Mocked<typeof _git> = require('../../../util/git'); //TODO: understand/check why this not works inside beforeEach...

describe('modules/platform/gerrit/index', () => {
  beforeEach(async () => {
    jest.resetModules();
    jest.resetAllMocks();
    await gerrit.initPlatform({
      endpoint: gerritEndpointUrl,
      username: 'user',
      password: 'pass',
    });
  });

  describe('initPlatform()', () => {
    it('should throw if no endpoint', () => {
      expect.assertions(1);
      expect(() => gerrit.initPlatform({})).toThrow();
    });

    it('should throw if no username/password', () => {
      expect.assertions(1);
      expect(() => gerrit.initPlatform({ endpoint: 'endpoint' })).toThrow();
    });

    it('should init', async () => {
      expect(
        await gerrit.initPlatform({
          endpoint: gerritEndpointUrl,
          username: 'abc',
          password: '123',
        })
      ).toMatchSnapshot();
    });
  });

  describe('getRepos()', () => {
    it('returns repos', async () => {
      expect.assertions(1);
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/projects/?type=CODE&state=ACTIVE')
        .reply(
          200,
          gerritRestResponse({
            repo1: { id: 'repo1', state: 'ACTIVE' },
            repo2: { id: 'repo2', state: 'ACTIVE' },
          })
        );
      expect(await gerrit.getRepos()).toEqual(['repo1', 'repo2']);
    });
  });

  it('initRepo() - inactive', async () => {
    expect.assertions(1);
    httpMock
      .scope(gerritEndpointUrl)
      .get('/a/projects/test%2Frepo')
      .reply(
        200,
        gerritRestResponse({
          id: 'repo1',
          name: 'test-repo',
          state: 'READ_ONLY',
        })
      );
    await expect(gerrit.initRepo({ repository: 'test/repo' })).rejects.toThrow(
      REPOSITORY_ARCHIVED
    );
  });

  describe('initRepo()', () => {
    beforeEach(() => {
      // Project-info and branch-info
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/projects/test%2Frepo')
        .reply(
          200,
          gerritRestResponse({
            id: 'repo1',
            name: 'test-repo2',
            state: 'ACTIVE',
            labels: { 'Code-Review': {} },
          })
        );
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/projects/test%2Frepo/branches/HEAD')
        .reply(
          200,
          gerritRestResponse({ ref: 'sha-hash....', revision: 'main' })
        );
      //mock Gerrit-Commit-Hook
      httpMock
        .scope(gerritEndpointUrl)
        .get('/tools/hooks/commit-msg')
        .reply(200, '#!/bin/sh');
    });

    it('initRepo() - active', async () => {
      expect.assertions(1);
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/')
        .query((query) => query?.q?.includes('status:open') ?? false)
        .twice()
        .reply(200, gerritRestResponse([]));

      expect(await gerrit.initRepo({ repository: 'test/repo' })).toEqual({
        defaultBranch: 'main',
        isFork: false,
        repoFingerprint: repoFingerprint(
          '',
          `${gerritEndpointUrl}/a/test/repo`
        ),
      });
    });

    it('initRepo() - abandon changes', async () => {
      expect.assertions(2);
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/')
        .query((query) => query?.q?.includes('label:Code-Review=-2') ?? false)
        .reply(200, gerritRestResponse([{ _number: 1 }, { _number: 2 }]));
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/')
        .query((query) => query?.q?.includes('status:open') ?? false)
        .reply(200, gerritRestResponse([]));

      const scope = httpMock
        .scope(gerritEndpointUrl)
        .post(/\/a\/changes\/\d+\/abandon/)
        .times(2)
        .reply(200, gerritRestResponse({}));

      await gerrit.initRepo({ repository: 'test/repo' });
      expect(scope.isDone()).toBe(true);
      expect(git.installHook.mock.calls[0]).toEqual([
        'commit-msg',
        '#!/bin/sh',
      ]);
    });

    it('initRepo() - checkout branch for each open change', async () => {
      expect.assertions(4);
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/')
        .query((query) => query?.q?.includes('label:Code-Review=-2') ?? false)
        .reply(200, gerritRestResponse([]));
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/')
        .query((query) => query?.q?.includes('status:open') ?? false)
        .reply(200, gerritRestResponse([Fixtures.getJson('change-data.json')]));

      expect(await gerrit.initRepo({ repository: 'test/repo' })).toEqual({
        defaultBranch: 'main',
        isFork: false,
        repoFingerprint: repoFingerprint(
          '',
          `${gerritEndpointUrl}/a/test/repo`
        ),
      });
      expect(git.fetchRevSpec.mock.calls[0]).toEqual([
        'refs/changes/1/2:refs/heads/renovate/dependency-1.x',
      ]);
      expect(git.fetchRevSpec.mock.calls[1]).toEqual([
        'refs/changes/1/2:refs/heads/origin/renovate/dependency-1.x',
      ]);
      expect(git.registerBranch.mock.calls[0]).toEqual([
        'renovate/dependency-1.x',
        true,
      ]);
    });

    it('initRepo() - open change without branchname', async () => {
      expect.assertions(3);
      const change = Fixtures.getJson('change-data.json');
      change.hashtags = [];
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/')
        .query((query) => query?.q?.includes('label:Code-Review=-2') ?? false)
        .reply(200, gerritRestResponse([]));
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/')
        .query((query) => query?.q?.includes('status:open') ?? false)
        .reply(200, gerritRestResponse([change]));

      expect(await gerrit.initRepo({ repository: 'test/repo' })).toEqual({
        defaultBranch: 'main',
        isFork: false,
        repoFingerprint: repoFingerprint(
          '',
          `${gerritEndpointUrl}/a/test/repo`
        ),
      });
      expect(git.fetchRevSpec).toHaveBeenCalledTimes(0);
      expect(git.registerBranch).toHaveBeenCalledTimes(0);
    });
  });

  describe('findPr()', () => {
    it('findPr() - no results', () => {
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/')
        .query(() => true)
        .reply(200, gerritRestResponse([]));
      return expect(
        gerrit.findPr({ branchName: 'branch', state: 'open' })
      ).resolves.toBeNull();
    });

    it('findPr() - return the last change from search results', () => {
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/')
        .query(() => true)
        .reply(200, gerritRestResponse([{ _number: 1 }, { _number: 2 }]));
      return expect(
        gerrit.findPr({ branchName: 'branch', state: 'open' })
      ).resolves.toHaveProperty('number', 2);
    });
  });

  describe('getPr()', () => {
    it('getPr() - found', () => {
      const input = Fixtures.getJson('change-data.json');
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/123456')
        .reply(200, gerritRestResponse(input));

      return expect(gerrit.getPr(123456)).resolves.toEqual(
        mapGerritChangeToPr(input)
      );
    });

    it('getPr() - not found', () => {
      httpMock.scope(gerritEndpointUrl).get('/a/changes/123456').reply(404);

      return expect(gerrit.getPr(123456)).resolves.toBeNull();
    });

    it('getPr() - other error', () => {
      httpMock.scope(gerritEndpointUrl).get('/a/changes/123456').reply(500);

      return expect(gerrit.getPr(123456)).rejects.toThrow();
    });
  });

  describe('updatePr()', () => {
    beforeAll(() => {
      gerrit.setConfig({ approveAvailable: true });
    });

    it('updatePr() - new prTitle => copy to commit msg', async () => {
      const input = Fixtures.getJson('change-data.json');
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/123456')
        .reply(200, gerritRestResponse(input));
      const scope = httpMock
        .scope(gerritEndpointUrl)
        .put('/a/changes/123456/message', /Change-Id: .../gi)
        .reply(200, gerritRestResponse({}));

      await gerrit.updatePr({ number: 123456, prTitle: 'new title' });
      expect(scope.isDone()).toBeTrue();
    });

    it('updatePr() - new prTitle => copy to commit msg error', async () => {
      const input = Fixtures.getJson('change-data.json');
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/123456')
        .reply(200, gerritRestResponse(input));
      const scope = httpMock
        .scope(gerritEndpointUrl)
        .put('/a/changes/123456/message', /Change-Id: .../gi)
        .reply(409, 'commit message is already the same');

      await gerrit.updatePr({ number: 123456, prTitle: 'new title' });
      expect(scope.isDone()).toBeTrue();
    });

    it('updatePr() - auto approve enabled', async () => {
      const input = Fixtures.getJson('change-data.json');
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/123456')
        .reply(200, gerritRestResponse(input));
      //get GerritChange with Labels included
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/123456/detail')
        .reply(200, gerritRestResponse({ labels: { 'Code-Review': {} } }));
      const approveMock = httpMock
        .scope(gerritEndpointUrl)
        .post(
          '/a/changes/123456/revisions/current/review',
          "{labels:{'Code-Review':2}}"
        )
        .reply(200, gerritRestResponse(''));

      await gerrit.updatePr({
        number: 123456,
        prTitle: input.subject,
        platformOptions: {
          gerritAutoApprove: true,
        },
      });
      expect(approveMock.isDone()).toBeTrue();
    });

    it('updatePr() - closed => abandon the change', async () => {
      const input = Fixtures.getJson('change-data.json');
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/123456')
        .reply(200, gerritRestResponse(input));
      const scope = httpMock
        .scope(gerritEndpointUrl)
        .post('/a/changes/123456/abandon')
        .reply(200, gerritRestResponse({}));

      await gerrit.updatePr({
        number: 123456,
        prTitle: input.subject,
        state: 'closed',
      });
      expect(scope.isDone()).toBeTrue();
    });

    it('updatePr() - existing prBody found in change.messages => nothing todo...', async () => {
      const input = Fixtures.getJson('change-data.json');
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/123456')
        .reply(200, gerritRestResponse(input));
      const scope = httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/123456/messages')
        .reply(
          200,
          gerritRestResponse([
            { tag: TAG_PULL_REQUEST_BODY, message: 'Last PR-Body' },
          ])
        );

      await gerrit.updatePr({
        number: 123456,
        prTitle: input.subject,
        prBody: 'Last PR-Body',
      });
      expect(scope.isDone()).toBeTrue();
    });

    it('updatePr() - new prBody found in change.messages => add as message', async () => {
      const input = Fixtures.getJson('change-data.json');
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/123456')
        .reply(200, gerritRestResponse(input));
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/123456/messages')
        .reply(
          200,
          gerritRestResponse([
            { tag: TAG_PULL_REQUEST_BODY, message: 'Last PR-Body' },
          ])
        );
      const scope = httpMock
        .scope(gerritEndpointUrl)
        .post(
          '/a/changes/123456/revisions/current/review',
          "{message:'NEW PR-Body',tag:'pull-request'}"
        )
        .reply(200, gerritRestResponse(''));

      await gerrit.updatePr({
        number: 123456,
        prTitle: input.subject,
        prBody: 'NEW PR-Body',
      });
      expect(scope.isDone()).toBeTrue();
    });
  });

  describe('createPr() - error ', () => {
    it('createPr() - no existing found => rejects', () => {
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/')
        .query((query) => query?.q?.includes('status:open') ?? false)
        .reply(200, gerritRestResponse([]));
      return expect(
        gerrit.createPr({
          sourceBranch: 'source',
          targetBranch: 'target',
          prTitle: 'title',
          prBody: 'body',
        })
      ).rejects.toThrow(
        `the change should be created automatically from previous push to refs/for/source`
      );
    });
  });

  describe('createPr() - success', () => {
    beforeAll(() => {
      gerrit.setConfig({ approveAvailable: true });
    });

    beforeEach(() => {
      const input = Fixtures.getJson('change-data.json');
      //get messages
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/123456/messages')
        .reply(
          200,
          gerritRestResponse([
            { tag: TAG_PULL_REQUEST_BODY, message: 'Last PR-Body' },
          ])
        );
      //get the change (final result)
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/123456')
        .reply(200, gerritRestResponse(input));
      //search for change
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/')
        .query((query) => query?.q?.includes('status:open') ?? false)
        .reply(200, gerritRestResponse([input]));
    });

    it('createPr() - update body/title and WITHOUT approve', async () => {
      const updatePrBodyMock = httpMock
        .scope(gerritEndpointUrl)
        .post(
          '/a/changes/123456/revisions/current/review',
          "{message:'body',tag:'pull-request'}"
        )
        .reply(200, gerritRestResponse(''));

      const pr = await gerrit.createPr({
        sourceBranch: 'source',
        targetBranch: 'target',
        prTitle: 'title',
        prBody: 'body',
        platformOptions: {
          gerritAutoApprove: false,
        },
      });
      expect(updatePrBodyMock.isDone()).toBeTrue();
      expect(pr).toHaveProperty('number', 123456);
    });

    it('createPr() - update body/title and ALREADY approved', async () => {
      //get GerritChange with Labels included
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/123456/detail')
        .reply(
          200,
          gerritRestResponse({
            labels: { 'Code-Review': { approved: { _account_id: 10000 } } },
          })
        );

      const updatePrBodyMock = httpMock
        .scope(gerritEndpointUrl)
        .post(
          '/a/changes/123456/revisions/current/review',
          "{message:'body',tag:'pull-request'}"
        )
        .reply(200, gerritRestResponse(''));

      const pr = await gerrit.createPr({
        sourceBranch: 'source',
        targetBranch: 'target',
        prTitle: 'title',
        prBody: 'body',
        platformOptions: {
          gerritAutoApprove: true,
        },
      });
      expect(updatePrBodyMock.isDone()).toBeTrue();
      expect(pr).toHaveProperty('number', 123456);
    });

    it('createPr() - update body/title and NOT approved => approve', async () => {
      //get GerritChange with Labels included
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/123456/detail')
        .reply(200, gerritRestResponse({ labels: { 'Code-Review': {} } }));

      const updatePrBodyMock = httpMock
        .scope(gerritEndpointUrl)
        .post(
          '/a/changes/123456/revisions/current/review',
          "{message:'body',tag:'pull-request'}"
        )
        .reply(200, gerritRestResponse(''));
      const approveMock = httpMock
        .scope(gerritEndpointUrl)
        .post(
          '/a/changes/123456/revisions/current/review',
          "{labels:{'Code-Review':2}}"
        )
        .reply(200, gerritRestResponse(''));

      const pr = await gerrit.createPr({
        sourceBranch: 'source',
        targetBranch: 'target',
        prTitle: 'title',
        prBody: 'body',
        platformOptions: {
          gerritAutoApprove: true,
        },
      });
      expect(updatePrBodyMock.isDone()).toBeTrue();
      expect(approveMock.isDone()).toBeTrue();
      expect(pr).toHaveProperty('number', 123456);
    });
  });

  describe('getBranchPr()', () => {
    it('getBranchPr() - no result', () => {
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/')
        .query((query) => query?.q?.includes('status:open') ?? false)
        .reply(200, gerritRestResponse([]));

      return expect(
        gerrit.getBranchPr('renovate/dependency-1.x')
      ).resolves.toBeNull();
    });

    it('getBranchPr() - found', () => {
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/')
        .query((query) => query?.q?.includes('status:open') ?? false)
        .reply(200, gerritRestResponse([Fixtures.getJson('change-data.json')]));

      return expect(
        gerrit.getBranchPr('renovate/dependency-1.x')
      ).resolves.toHaveProperty('number', 123456);
    });
  });

  describe('getPrList()', () => {
    it('getPrList() - empty list', () => {
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/')
        .query((query) => query?.q?.includes('owner:self') ?? false)
        .reply(200, gerritRestResponse([]));

      return expect(gerrit.getPrList()).resolves.toEqual([]);
    });

    it('getPrList() - multiple results', () => {
      const change = Fixtures.getJson('change-data.json');
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/')
        .query((query) => query?.q?.includes('owner:self') ?? false)
        .reply(200, gerritRestResponse([change, change, change]));

      return expect(gerrit.getPrList()).resolves.toHaveLength(3);
    });
  });

  describe('mergePr()', () => {
    it('mergePr() - blocker by Verified', () => {
      httpMock
        .scope(gerritEndpointUrl)
        .post('/a/changes/123456/submit')
        .reply(409, 'blocked by Verified');

      return expect(gerrit.mergePr({ id: 123456 })).resolves.toBeFalse();
    });

    it('mergePr() - success', () => {
      httpMock
        .scope(gerritEndpointUrl)
        .post('/a/changes/123456/submit')
        .reply(200, gerritRestResponse({ status: 'MERGED' }));

      return expect(gerrit.mergePr({ id: 123456 })).resolves.toBeTrue();
    });

    it('mergePr() - other errors', () => {
      httpMock
        .scope(gerritEndpointUrl)
        .post('/a/changes/123456/submit')
        .reply(500, 'any other error');

      return expect(gerrit.mergePr({ id: 123456 })).rejects.toThrow();
    });
  });

  describe('getBranchStatus()', () => {
    it('getBranchStatus() - branchname/change not found => yellow', () => {
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/')
        .query(
          (query) =>
            query?.q?.includes(
              'hashtag:sourceBranch-renovate/dependency-1.x'
            ) ?? false
        )
        .reply(200, gerritRestResponse([]));

      return expect(
        gerrit.getBranchStatus('renovate/dependency-1.x')
      ).resolves.toBe(BranchStatus.yellow);
    });

    it('getBranchStatus() - branchname/changes found, submittable and not hasProblems => green', () => {
      const change = Fixtures.getJson('change-data.json');
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/')
        .query(
          (query) =>
            query?.q?.includes(
              'hashtag:sourceBranch-renovate/dependency-1.x'
            ) ?? false
        )
        .reply(200, gerritRestResponse([change, change]));

      return expect(
        gerrit.getBranchStatus('renovate/dependency-1.x')
      ).resolves.toBe(BranchStatus.green);
    });

    it('getBranchStatus() - branchname/changes found and hasProblems => red', () => {
      const submittableChange = Fixtures.getJson('change-data.json');
      const changeWithProblems = { ...submittableChange };
      changeWithProblems.submittable = false;
      changeWithProblems.problems = [
        { message: 'error1' },
        { message: 'error2' },
      ];
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/')
        .query(
          (query) =>
            query?.q?.includes(
              'hashtag:sourceBranch-renovate/dependency-1.x'
            ) ?? false
        )
        .reply(
          200,
          gerritRestResponse([changeWithProblems, submittableChange])
        );

      return expect(
        gerrit.getBranchStatus('renovate/dependency-1.x')
      ).resolves.toBe(BranchStatus.red);
    });
  });

  describe('getBranchStatusCheck()', () => {
    it('getBranchStatusCheck() - ??? ', () => {
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/')
        .query(true)
        .reply(200, gerritRestResponse([]));

      return expect(
        gerrit.getBranchStatusCheck('renovate/dependency-1.x', 'ctx')
      ).resolves.toBe(BranchStatus.yellow);
    });
  });

  describe('setBranchStatus()', () => {
    it('setBranchStatus()', () => {
      return expect(
        gerrit.setBranchStatus({
          branchName: 'branch',
          context: 'ctx',
          state: BranchStatus.red,
          description: 'desc',
        })
      ).resolves.toBeUndefined();
    });
  });

  describe('addReviewers()', () => {
    it('addReviewers() - add reviewers', () => {
      httpMock
        .scope(gerritEndpointUrl)
        .post('/a/changes/123456/reviewers', /{reviewer:'user\d'}/)
        .twice()
        .reply(200, gerritRestResponse(''));

      return expect(
        gerrit.addReviewers(123456, ['user1', 'user2'])
      ).resolves.toBeUndefined();
    });
  });

  describe('addAssignees()', () => {
    it('addAssignees() - set assignee', () => {
      httpMock
        .scope(gerritEndpointUrl)
        .put('/a/changes/123456/assignee', /{assignee:'user1'}/)
        .reply(200, gerritRestResponse(''));

      return expect(
        gerrit.addAssignees(123456, ['user1', 'user2'])
      ).resolves.toBeUndefined();
    });
  });

  describe('ensureComment()', () => {
    it('ensureComment() - not exists => create new', () => {
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/123456/messages')
        .reply(200, gerritRestResponse([]));
      httpMock
        .scope(gerritEndpointUrl)
        .post(
          '/a/changes/123456/revisions/current/review',
          "{message:'My-Comment-Msg',tag:'myTopic'}"
        )
        .reply(200, gerritRestResponse(''));

      return expect(
        gerrit.ensureComment({
          number: 123456,
          topic: 'myTopic',
          content: 'My-Comment-Msg',
        })
      ).resolves.toBeTrue();
    });

    it('ensureComment() - already exists => dont create new', () => {
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/123456/messages')
        .reply(
          200,
          gerritRestResponse([{ message: 'My-Comment-Msg', tag: 'myTopic' }])
        );

      return expect(
        gerrit.ensureComment({
          number: 123456,
          topic: 'myTopic',
          content: 'My-Comment-Msg',
        })
      ).resolves.toBeTrue();
    });
  });

  describe('getRawFile()', () => {
    it('getRawFile() - repo and branch', () => {
      httpMock
        .scope(gerritEndpointUrl)
        .get(
          '/a/projects/test%2Frepo/branches/main/files/renovate.json/content'
        )
        .reply(200, gerritResponse(Buffer.from('{}').toString('base64')));
      return expect(
        gerrit.getRawFile('renovate.json', 'test/repo', 'main')
      ).resolves.toBe('{}');
    });

    it('getRawFile() - repo/branch from config', () => {
      gerrit.setConfig({
        repository: 'repo',
        head: 'master',
        approveAvailable: true,
      });
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/projects/repo/branches/master/files/renovate.json/content')
        .reply(200, gerritResponse(Buffer.from('{}').toString('base64')));
      return expect(gerrit.getRawFile('renovate.json')).resolves.toBe('{}');
    });

    it('getRawFile() - repo/branch defaults', () => {
      gerrit.setConfig({ approveAvailable: true });
      httpMock
        .scope(gerritEndpointUrl)
        .get(
          '/a/projects/All-Projects/branches/HEAD/files/renovate.json/content'
        )
        .reply(200, gerritResponse(Buffer.from('{}').toString('base64')));
      return expect(gerrit.getRawFile('renovate.json')).resolves.toBe('{}');
    });
  });

  describe('getJsonFile()', () => {
    //TODO: the wanted semantic is not clear
    it('getJsonFile()', () => {
      httpMock
        .scope(gerritEndpointUrl)
        .get(
          '/a/projects/test%2Frepo/branches/main/files/renovate.json/content'
        )
        .reply(200, gerritResponse(Buffer.from('{}').toString('base64')));
      return expect(
        gerrit.getJsonFile('renovate.json', 'test/repo', 'main')
      ).resolves.toEqual({});
    });
  });

  describe('getRepoForceRebase()', () => {
    it('getRepoForceRebase()', () => {
      return expect(gerrit.getRepoForceRebase()).resolves.toBeTrue();
    });
  });

  describe('massageMarkdown()', () => {
    it('massageMarkdown()', () => {
      return expect(gerrit.massageMarkdown('my body')).toBe('my body'); //TODO: check the real gerrit limit (max. chars)
    });
  });

  describe('commitFiles()', () => {
    it('commitFiles() - empty commit', () => {
      git.prepareCommit.mockResolvedValueOnce(null); //empty commit
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/')
        .query(
          (query) =>
            (query.q?.includes(
              'hashtag:sourceBranch-renovate/dependency-1.x'
            ) &&
              query.q?.includes('branch:main')) ??
            false
        )
        .reply(200, gerritRestResponse([]));
      return expect(
        gerrit.commitFiles({
          branchName: 'renovate/dependency-1.x',
          targetBranch: 'main',
          message: 'commit msg',
          files: [],
        })
      ).resolves.toBeNull();
    });

    it('commitFiles() - create first Patch', async () => {
      git.prepareCommit.mockResolvedValueOnce({
        commitSha: 'commitSha',
        parentCommitSha: 'parentSha',
        files: [],
      });
      git.pushCommit.mockResolvedValueOnce(true);
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/')
        .query(
          (query) =>
            (query.q?.includes(
              'hashtag:sourceBranch-renovate/dependency-1.x'
            ) &&
              query.q?.includes('branch:main')) ??
            false
        )
        .reply(200, gerritRestResponse([]));
      const res = await gerrit.commitFiles({
        branchName: 'renovate/dependency-1.x',
        targetBranch: 'main',
        message: 'commit msg',
        files: [],
      });
      expect(res).toBe('commitSha');
      expect(git.pushCommit.mock.calls[0]).toEqual([
        {
          files: [],
          sourceRef: 'renovate/dependency-1.x',
          targetRef: 'refs/for/main%t=sourceBranch-renovate/dependency-1.x',
        },
      ]);
      expect(git.registerBranch.mock.calls[0]).toEqual([
        'renovate/dependency-1.x',
        false,
        'commitSha',
      ]);
    });

    it('commitFiles() - existing change-set without new changes', async () => {
      const existingChange = Fixtures.getJson('change-data.json');
      git.prepareCommit.mockResolvedValueOnce({
        commitSha: 'commitSha',
        parentCommitSha: 'parentSha',
        files: [],
      });
      git.pushCommit.mockResolvedValueOnce(true);
      git.hasDiff.mockResolvedValueOnce(false); //no changes
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/')
        .query(
          (query) =>
            (query.q?.includes(
              'hashtag:sourceBranch-renovate/dependency-1.x'
            ) &&
              query.q?.includes('branch:main')) ??
            false
        )
        .reply(200, gerritRestResponse([existingChange]));

      const res = await gerrit.commitFiles({
        branchName: 'renovate/dependency-1.x',
        targetBranch: 'main',
        message: ['commit msg'],
        files: [],
      });
      expect(res).toBe('commitSha');
      expect(git.fetchRevSpec.mock.calls[0]).toEqual(['refs/changes/1/2']);
      expect(git.prepareCommit.mock.calls[0]).toEqual([
        {
          branchName: 'renovate/dependency-1.x',
          files: [],
          targetBranch: 'main',
          message: ['commit msg', 'Change-Id: ...'],
        },
      ]);
      expect(git.pushCommit).toHaveBeenCalledTimes(0);
      expect(git.registerBranch).toHaveBeenCalledTimes(0);
    });

    it('commitFiles() - existing change-set with new changes - autoapprove again', async () => {
      const existingChange = Fixtures.getJson('change-data.json');
      git.prepareCommit.mockResolvedValueOnce({
        commitSha: 'commitSha',
        parentCommitSha: 'parentSha',
        files: [],
      });
      git.pushCommit.mockResolvedValueOnce(true);
      git.hasDiff.mockResolvedValueOnce(true);
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/')
        .query(
          (query) =>
            (query.q?.includes(
              'hashtag:sourceBranch-renovate/dependency-1.x'
            ) &&
              query.q?.includes('branch:main')) ??
            false
        )
        .reply(200, gerritRestResponse([existingChange]));
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/123456/detail')
        .reply(200, gerritRestResponse({ labels: { 'Code-Review': {} } }));
      const approveMock = httpMock
        .scope(gerritEndpointUrl)
        .post(
          '/a/changes/123456/revisions/current/review',
          "{labels:{'Code-Review':2}}"
        )
        .reply(200, gerritRestResponse(''));

      const res = await gerrit.commitFiles({
        branchName: 'renovate/dependency-1.x',
        targetBranch: 'main',
        message: 'commit msg',
        files: [],
      });
      expect(res).toBe('commitSha');
      expect(git.fetchRevSpec.mock.calls[0]).toEqual(['refs/changes/1/2']);
      expect(git.prepareCommit.mock.calls[0]).toEqual([
        {
          branchName: 'renovate/dependency-1.x',
          files: [],
          targetBranch: 'main',
          message: ['commit msg', 'Change-Id: ...'],
        },
      ]);
      expect(git.pushCommit.mock.calls[0]).toEqual([
        {
          files: [],
          sourceRef: 'renovate/dependency-1.x',
          targetRef: 'refs/for/main%t=sourceBranch-renovate/dependency-1.x',
        },
      ]);
      expect(git.registerBranch.mock.calls[0]).toEqual([
        'renovate/dependency-1.x',
        false,
        'commitSha',
      ]);
      expect(approveMock.isDone()).toBeTrue();
    });
  });

  describe('currently unused/not-implemented functions', () => {
    it('deleteLabel()', () => {
      return expect(
        gerrit.deleteLabel(123456, 'label')
      ).resolves.toBeUndefined();
    });

    it('ensureCommentRemoval()', () => {
      return expect(
        gerrit.ensureCommentRemoval({
          type: 'by-topic',
          number: 123456,
          topic: 'topic',
        })
      ).resolves.toBeUndefined();
    });

    it('ensureIssueClosing()', () => {
      return expect(
        gerrit.ensureIssueClosing('title')
      ).resolves.toBeUndefined();
    });

    it('ensureIssue()', () => {
      return expect(
        gerrit.ensureIssue({ body: 'body', title: 'title' })
      ).resolves.toBeNull();
    });

    it('findIssue()', () => {
      return expect(gerrit.findIssue('title')).resolves.toBeNull();
    });

    it('getIssueList()', () => {
      return expect(gerrit.getIssueList()).resolves.toStrictEqual([]);
    });

    it('getVulnerabilityAlerts()', () => {
      return expect(gerrit.getVulnerabilityAlerts()).resolves.toStrictEqual([]);
    });
  });
});

function gerritRestResponse(body: any): any {
  return `)]}'\n${JSON.stringify(body)}`;
}

function gerritResponse(body: string): any {
  return `)]}'\n${body}`;
}
