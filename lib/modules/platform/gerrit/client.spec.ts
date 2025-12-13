import { REPOSITORY_ARCHIVED } from '../../../constants/error-messages';
import { setBaseUrl } from '../../../util/http/gerrit';
import type { FindPRConfig } from '../types';
import { client } from './client';
import type {
  GerritChange,
  GerritChangeMessageInfo,
  GerritFindPRConfig,
  GerritMergeableInfo,
} from './types';
import { MIN_GERRIT_VERSION } from './utils';
import * as httpMock from '~test/http-mock';
import { partial } from '~test/util';

const gerritEndpointUrl = 'https://dev.gerrit.com/renovate/';
const jsonResultHeader = { 'content-type': 'application/json;charset=utf-8' };

describe('modules/platform/gerrit/client', () => {
  beforeAll(() => {
    setBaseUrl(gerritEndpointUrl);
  });

  describe('getGerritVersion()', () => {
    it('returns version', async () => {
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/config/server/version')
        .reply(200, gerritRestResponse('3.9.1'), jsonResultHeader);
      expect(await client.getGerritVersion()).toBe('3.9.1');
    });
  });

  describe('getRepos()', () => {
    it('returns repos', async () => {
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/projects/?type=CODE&state=ACTIVE')
        .reply(
          200,
          gerritRestResponse({
            repo1: { id: 'repo1', state: 'ACTIVE' },
            repo2: { id: 'repo2', state: 'ACTIVE' },
          }),
          jsonResultHeader,
        );
      expect(await client.getRepos()).toEqual(['repo1', 'repo2']);
    });
  });

  describe('getProjectInfo()', () => {
    it('inactive', async () => {
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/projects/test%2Frepo')
        .reply(
          200,
          gerritRestResponse({
            id: 'repo1',
            name: 'test-repo',
            state: 'READ_ONLY',
          }),
          jsonResultHeader,
        );
      await expect(client.getProjectInfo('test/repo')).rejects.toThrow(
        REPOSITORY_ARCHIVED,
      );
    });

    it('active', async () => {
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/projects/test%2Frepo')
        .reply(
          200,
          gerritRestResponse({
            id: 'repo1',
            name: 'test-repo',
            state: 'ACTIVE',
          }),
          jsonResultHeader,
        );
      await expect(client.getProjectInfo('test/repo')).resolves.toEqual({
        id: 'repo1',
        name: 'test-repo',
        state: 'ACTIVE',
      });
    });
  });

  describe('getBranchInfo()', () => {
    it('info', async () => {
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/projects/test%2Frepo/branches/HEAD')
        .reply(
          200,
          gerritRestResponse({ ref: 'sha-hash....', revision: 'main' }),
          jsonResultHeader,
        );
      await expect(client.getBranchInfo('test/repo')).resolves.toEqual({
        ref: 'sha-hash....',
        revision: 'main',
      });
    });
  });

  describe('findChanges()', () => {
    it.each([
      ['owner:self', { branchName: 'dependency-xyz' }],
      ['project:repo', { branchName: 'dependency-xyz' }],
      ['-is:wip', { branchName: 'dependency-xyz' }],
      [
        'footer:Renovate-Branch=dependency-xyz',
        { branchName: 'dependency-xyz' },
      ],
      ['message:"Renovate-Branch: "', { branchName: '' }],
      ['hasfooter:Renovate-Branch', { branchName: '' }, '3.6.0'],
      ['label:Code-Review=-2', { branchName: 'dependency-xyz', label: '-2' }],
      [
        'branch:otherTarget',
        { branchName: 'dependency-xyz', targetBranch: 'otherTarget' },
      ],
      [
        'status:abandoned',
        {
          branchName: 'dependency-xyz',
          state: 'closed' as FindPRConfig['state'],
        },
      ],
      [
        'message:"fix(deps): update dependency react-router-dom to v6.21.2"',
        {
          branchName: 'dependency-xyz',
          prTitle: 'fix(deps): update dependency react-router-dom to v6.21.2',
        },
      ],
      [
        'message:"fix(deps): update dependency react-router-dom to ~> \\"v6.21.2\\""',
        {
          branchName: 'dependency-xyz',
          prTitle:
            'fix(deps): update dependency react-router-dom to ~> "v6.21.2"',
        },
      ],
      [
        'message:"fix(deps): \\"update dependency react-router-dom to ~> \\"v6.21.2\\"\\""',
        {
          branchName: 'dependency-xyz',
          prTitle:
            'fix(deps): "update dependency react-router-dom to ~> "v6.21.2""',
        },
      ],
      [
        'subject:"fix(deps): update dependency react-router-dom to v6.21.2"',
        {
          branchName: 'dependency-xyz',
          prTitle: 'fix(deps): update dependency react-router-dom to v6.21.2',
        },
        '3.8.0',
      ],
    ])(
      'query contains %p',
      async (
        expectedQueryPart: string,
        config: GerritFindPRConfig,
        gerritVersion?: string,
      ) => {
        client.setGerritVersion(gerritVersion ?? MIN_GERRIT_VERSION);

        httpMock
          .scope(gerritEndpointUrl)
          .get('/a/changes/')
          .query((query) => query?.q?.includes(expectedQueryPart) ?? false)
          .reply(
            200,
            gerritRestResponse([{ _number: 1 }, { _number: 2 }]),
            jsonResultHeader,
          );
        await expect(client.findChanges('repo', config)).resolves.toEqual([
          { _number: 1 },
          { _number: 2 },
        ]);
      },
    );

    it('sets query.n as 1 if a single change is requested', async () => {
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/')
        .query((query) => query.n === '1')
        .reply(200, gerritRestResponse([{ _number: 1 }]), jsonResultHeader);
      await expect(
        client.findChanges('repo', {
          branchName: 'dependency-xyz',
          singleChange: true,
          pageLimit: 5, // should be ignored
        }),
      ).resolves.toEqual([{ _number: 1 }]);
    });

    it('sets query.n as 50 if pageLimit is not provided', async () => {
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/')
        .query((query) => query.n === '50')
        .reply(200, gerritRestResponse([{ _number: 1 }]), jsonResultHeader);
      await expect(
        client.findChanges('repo', {
          branchName: 'dependency-xyz',
        }),
      ).resolves.toEqual([{ _number: 1 }]);
    });

    it('sets query.n with pageLimit if provided', async () => {
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/')
        .query((query) => query.n === '5')
        .reply(200, gerritRestResponse([{ _number: 1 }]), jsonResultHeader);
      await expect(
        client.findChanges('repo', {
          branchName: 'dependency-xyz',
          pageLimit: 5,
        }),
      ).resolves.toEqual([{ _number: 1 }]);
    });

    it('sets query.S with startOffset if provided', async () => {
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/')
        .query((query) => query.S === '5')
        .reply(200, gerritRestResponse([{ _number: 1 }]), jsonResultHeader);
      await expect(
        client.findChanges('repo', {
          branchName: 'dependency-xyz',
          startOffset: 5,
        }),
      ).resolves.toEqual([{ _number: 1 }]);
    });

    it('sets query.S as 0 if startOffset is not provided', async () => {
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/')
        .query((query) => query.S === '0')
        .reply(200, gerritRestResponse([{ _number: 1 }]), jsonResultHeader);
      await expect(
        client.findChanges('repo', {
          branchName: 'dependency-xyz',
        }),
      ).resolves.toEqual([{ _number: 1 }]);
    });

    it('handles pagination automatically', async () => {
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/')
        .query((query) => query.n === '2' && query.S === '0')
        .reply(
          200,
          gerritRestResponse([
            { _number: 1 },
            { _number: 2, _more_changes: true },
          ]),
          jsonResultHeader,
        )
        .get('/a/changes/')
        .query((query) => query.n === '2' && query.S === '2')
        .reply(
          200,
          gerritRestResponse([
            { _number: 3 },
            { _number: 4, _more_changes: true },
          ]),
          jsonResultHeader,
        )
        .get('/a/changes/')
        .query((query) => query.n === '2' && query.S === '4')
        .reply(
          200,
          gerritRestResponse([{ _number: 5 }, { _number: 6 }]),
          jsonResultHeader,
        );
      await expect(
        client.findChanges('repo', {
          branchName: 'dependency-xyz',
          pageLimit: 2, // to keep the test short
        }),
      ).resolves.toEqual([
        { _number: 1 },
        { _number: 2 },
        { _number: 3 },
        { _number: 4 },
        { _number: 5 },
        { _number: 6 },
      ]);
    });

    it('handles pagination with startOffset', async () => {
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/')
        .query((query) => query.n === '2' && query.S === '2')
        .reply(
          200,
          gerritRestResponse([
            { _number: 3 },
            { _number: 4, _more_changes: true },
          ]),
          jsonResultHeader,
        )
        .get('/a/changes/')
        .query((query) => query.n === '2' && query.S === '4')
        .reply(
          200,
          gerritRestResponse([{ _number: 5 }, { _number: 6 }]),
          jsonResultHeader,
        );
      await expect(
        client.findChanges('repo', {
          branchName: 'dependency-xyz',
          pageLimit: 2,
          startOffset: 2,
        }),
      ).resolves.toEqual([
        { _number: 3 },
        { _number: 4 },
        { _number: 5 },
        { _number: 6 },
      ]);
    });

    it('allows disabling automatic pagination', async () => {
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/')
        .query((query) => query.n === '2' && query.S === '0')
        .reply(
          200,
          gerritRestResponse([
            { _number: 1 },
            { _number: 2, _more_changes: true },
          ]),
          jsonResultHeader,
        );
      await expect(
        client.findChanges('repo', {
          branchName: 'dependency-xyz',
          noPagination: true,
          pageLimit: 2,
        }),
      ).resolves.toEqual([{ _number: 1 }, { _number: 2 }]);
    });

    it('sets query.o when requestDetails is provided', async () => {
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/')
        .query(
          (query) =>
            Array.isArray(query.o) &&
            query.o.toString() === ['LABELS', 'MESSAGES'].toString(),
        )
        .reply(200, gerritRestResponse([{ _number: 3 }]), jsonResultHeader);
      await expect(
        client.findChanges('repo', {
          branchName: 'dependency-xyz',
          requestDetails: ['LABELS', 'MESSAGES'],
        }),
      ).resolves.toEqual([{ _number: 3 }]);
    });
  });

  describe('getChange()', () => {
    it('get', async () => {
      const change = partial<GerritChange>({});
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/123456?o=CURRENT_REVISION&o=COMMIT_FOOTERS')
        .reply(200, gerritRestResponse(change), jsonResultHeader);
      await expect(
        client.getChange(123456, ['CURRENT_REVISION', 'COMMIT_FOOTERS']),
      ).resolves.toEqual(change);
    });
  });

  describe('getMergeableInfo()', () => {
    it('get', async () => {
      const mergeInfo: GerritMergeableInfo = {
        mergeable: true,
        submit_type: 'MERGE_IF_NECESSARY',
      };
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/123456/revisions/current/mergeable')
        .reply(200, gerritRestResponse(mergeInfo), jsonResultHeader);
      await expect(
        client.getMergeableInfo(partial<GerritChange>({ _number: 123456 })),
      ).resolves.toEqual(mergeInfo);
    });
  });

  describe('abandonChange()', () => {
    it('abandon', async () => {
      httpMock
        .scope(gerritEndpointUrl)
        .post('/a/changes/123456/abandon', {
          notify: 'OWNER_REVIEWERS',
        })
        .reply(200, gerritRestResponse({}), jsonResultHeader);
      await expect(client.abandonChange(123456)).toResolve();
    });
    it('abandon with message', async () => {
      httpMock
        .scope(gerritEndpointUrl)
        .post('/a/changes/123456/abandon', {
          message: 'The abandon reason is important.',
          notify: 'OWNER_REVIEWERS',
        })
        .reply(200, gerritRestResponse({}), jsonResultHeader);
      await expect(
        client.abandonChange(123456, 'The abandon reason is important.'),
      ).toResolve();
    });
  });

  describe('submitChange()', () => {
    it('submit', async () => {
      const change = partial<GerritChange>({});
      httpMock
        .scope(gerritEndpointUrl)
        .post('/a/changes/123456/submit')
        .reply(200, gerritRestResponse(change), jsonResultHeader);
      await expect(client.submitChange(123456)).resolves.toEqual(change);
    });
  });

  describe('moveChange()', () => {
    it('move change to different branch', async () => {
      const change = partial<GerritChange>({ branch: 'new-main' });
      httpMock
        .scope(gerritEndpointUrl)
        .post('/a/changes/123456/move', {
          destination_branch: 'new-main',
        })
        .reply(200, gerritRestResponse(change), jsonResultHeader);
      await expect(client.moveChange(123456, 'new-main')).resolves.toEqual(
        change,
      );
    });
  });

  describe('getBranchChange()', () => {
    it('returns null when no changes found', async () => {
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/')
        .query(true)
        .reply(200, gerritRestResponse([]), jsonResultHeader);
      await expect(
        client.getBranchChange('test/repo', {
          branchName: 'renovate/dependency-1.x',
          state: 'open',
        }),
      ).resolves.toBeNull();
    });

    it('returns single change when only one found', async () => {
      const change = partial<GerritChange>({
        _number: 123,
        branch: 'main',
      });
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/')
        .query(true)
        .reply(200, gerritRestResponse([change]), jsonResultHeader);
      await expect(
        client.getBranchChange('test/repo', {
          branchName: 'renovate/dependency-1.x',
          state: 'open',
        }),
      ).resolves.toEqual(change);
    });

    it('returns first change when multiple found without targetBranch', async () => {
      const change1 = partial<GerritChange>({
        _number: 111,
        branch: 'main',
      });
      const change2 = partial<GerritChange>({
        _number: 222,
        branch: 'develop',
      });
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/')
        .query(true)
        .reply(200, gerritRestResponse([change1, change2]), jsonResultHeader);
      await expect(
        client.getBranchChange('test/repo', {
          branchName: 'renovate/dependency-1.x',
          state: 'open',
        }),
      ).resolves.toEqual(change1);
    });

    it('returns matching change when targetBranch specified and match found', async () => {
      const change1 = partial<GerritChange>({
        _number: 111,
        branch: 'main',
      });
      const change2 = partial<GerritChange>({
        _number: 222,
        branch: 'develop',
      });
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/')
        .query(true)
        .reply(200, gerritRestResponse([change1, change2]), jsonResultHeader);
      await expect(
        client.getBranchChange('test/repo', {
          branchName: 'renovate/dependency-1.x',
          state: 'open',
          targetBranch: 'develop',
        }),
      ).resolves.toEqual(change2);
    });

    it('returns first change when targetBranch specified but no match found', async () => {
      const change1 = partial<GerritChange>({
        _number: 111,
        branch: 'main',
      });
      const change2 = partial<GerritChange>({
        _number: 222,
        branch: 'develop',
      });
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/')
        .query(true)
        .reply(200, gerritRestResponse([change1, change2]), jsonResultHeader);
      await expect(
        client.getBranchChange('test/repo', {
          branchName: 'renovate/dependency-1.x',
          state: 'open',
          targetBranch: 'release',
        }),
      ).resolves.toEqual(change1);
    });
  });

  describe('getMessages()', () => {
    it('no messages', async () => {
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/123456/messages')
        .reply(200, gerritRestResponse([]), jsonResultHeader);
      await expect(client.getMessages(123456)).resolves.toEqual([]);
    });

    it('with messages', async () => {
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/123456/messages')
        .reply(
          200,
          gerritRestResponse([
            partial<GerritChangeMessageInfo>({ message: 'msg1' }),
            partial<GerritChangeMessageInfo>({ message: 'msg2' }),
          ]),
          jsonResultHeader,
        );
      await expect(client.getMessages(123456)).resolves.toEqual([
        { message: 'msg1' },
        { message: 'msg2' },
      ]);
    });
  });

  describe('addMessage()', () => {
    it('add with tag', async () => {
      httpMock
        .scope(gerritEndpointUrl)
        .post('/a/changes/123456/revisions/current/review', {
          message: 'message',
          tag: 'tag',
          notify: 'NONE',
        })
        .reply(200, gerritRestResponse([]), jsonResultHeader);
      await expect(client.addMessage(123456, 'message', 'tag')).toResolve();
    });

    it('add without tag', async () => {
      httpMock
        .scope(gerritEndpointUrl)
        .post('/a/changes/123456/revisions/current/review', {
          message: 'message',
          notify: 'NONE',
        })
        .reply(200, gerritRestResponse([]), jsonResultHeader);
      await expect(client.addMessage(123456, 'message')).toResolve();
    });

    it('add too big message', async () => {
      const okMessage = 'a'.repeat(16 * 1024); // 16KB
      const tooBigMessage = okMessage + 'b';
      const truncationNotice = '\n\n[Truncated by Renovate]';
      const truncatedMessage =
        tooBigMessage.slice(0, 16 * 1024 - truncationNotice.length) +
        truncationNotice;
      httpMock.scope(gerritEndpointUrl);
      httpMock
        .scope(gerritEndpointUrl)
        .post('/a/changes/123456/revisions/current/review', {
          message: truncatedMessage,
          notify: 'NONE',
        })
        .reply(200, gerritRestResponse([]), jsonResultHeader);
      await expect(client.addMessage(123456, tooBigMessage)).toResolve();
    });
  });

  describe('checkForExistingMessage()', () => {
    it('msg not found', async () => {
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/123456/messages')
        .reply(200, gerritRestResponse([]), jsonResultHeader);
      await expect(
        client.checkForExistingMessage(123456, ' the message '),
      ).resolves.toBeFalse();
    });

    it('msg found', async () => {
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/123456/messages')
        .reply(
          200,
          gerritRestResponse([
            partial<GerritChangeMessageInfo>({ message: 'msg1' }),
            partial<GerritChangeMessageInfo>({ message: 'the message' }),
          ]),
          jsonResultHeader,
        );
      await expect(
        client.checkForExistingMessage(123456, 'the message'),
      ).resolves.toBeTrue();
    });
  });

  describe('addMessageIfNotAlreadyExists()', () => {
    it('msg not found', async () => {
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/123456/messages')
        .reply(200, gerritRestResponse([]), jsonResultHeader);
      httpMock
        .scope(gerritEndpointUrl)
        .post('/a/changes/123456/revisions/current/review', {
          message: 'new trimmed message',
          tag: 'TAG',
          notify: 'NONE',
        })
        .reply(200, gerritRestResponse([]), jsonResultHeader);

      await expect(
        client.addMessageIfNotAlreadyExists(
          123456,
          ' new trimmed message\n',
          'TAG',
        ),
      ).toResolve();
    });

    it('msg already exists', async () => {
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/123456/messages')
        .reply(
          200,
          gerritRestResponse([
            partial<GerritChangeMessageInfo>({ message: 'msg1', tag: 'TAG' }),
          ]),
          jsonResultHeader,
        );

      await expect(
        client.addMessageIfNotAlreadyExists(123456, 'msg1\n', 'TAG'),
      ).toResolve();
    });
  });

  describe('setLabel()', () => {
    it('setLabel', async () => {
      httpMock
        .scope(gerritEndpointUrl)
        .post('/a/changes/123456/revisions/current/review', {
          labels: { 'Renovate-Merge-Confidence': 1 },
          notify: 'NONE',
        })
        .reply(200, gerritRestResponse([]), jsonResultHeader);
      await expect(
        client.setLabel(123456, 'Renovate-Merge-Confidence', +1),
      ).toResolve();
    });
  });

  describe('deleteHashtag()', () => {
    it('deleteHashtag', async () => {
      httpMock
        .scope(gerritEndpointUrl)
        .post('/a/changes/123456/hashtags', {
          remove: ['hashtag1'],
        })
        .reply(200, gerritRestResponse([]), jsonResultHeader);
      await expect(client.deleteHashtag(123456, 'hashtag1')).toResolve();
    });
  });

  describe('addReviewer()', () => {
    it('add', async () => {
      httpMock
        .scope(gerritEndpointUrl)
        .post('/a/changes/123456/revisions/current/review', {
          reviewers: [{ reviewer: 'user1' }, { reviewer: 'user2' }],
          notify: 'OWNER_REVIEWERS',
        })
        .reply(200, gerritRestResponse([]), jsonResultHeader);
      await expect(client.addReviewers(123456, ['user1', 'user2'])).toResolve();
    });
  });

  describe('addAssignee()', () => {
    it('add', async () => {
      httpMock
        .scope(gerritEndpointUrl)
        .put('/a/changes/123456/assignee', {
          assignee: 'username',
        })
        .reply(200, gerritRestResponse([]), jsonResultHeader);
      await expect(client.addAssignee(123456, 'username')).toResolve();
    });
  });

  describe('getFile()', () => {
    it('getFile() - repo and branch', async () => {
      httpMock
        .scope(gerritEndpointUrl)
        .get(
          '/a/projects/test%2Frepo/branches/base%2Fbranch/files/renovate.json/content',
        )
        .reply(200, gerritFileResponse('{}'));
      await expect(
        client.getFile('test/repo', 'base/branch', 'renovate.json'),
      ).resolves.toBe('{}');
    });
  });
});

function gerritRestResponse(body: any): any {
  return `)]}'\n${JSON.stringify(body)}`;
}

function gerritFileResponse(content: string): any {
  return Buffer.from(content).toString('base64');
}
