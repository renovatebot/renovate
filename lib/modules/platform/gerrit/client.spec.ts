import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { partial } from '../../../../test/util';
import { REPOSITORY_ARCHIVED } from '../../../constants/error-messages';
import { setBaseUrl } from '../../../util/http/gerrit';
import { GerritClient } from './client';
import type { GerritChangeMessageInfo, GerritMergeableInfo } from './types';

const gerritEndpointUrl = 'https://dev.gerrit.com/renovate/';
const jsonResultHeader = { 'content-type': 'application/json;charset=utf-8' };

describe('modules/platform/gerrit/client', () => {
  const client = new GerritClient();

  beforeAll(() => {
    setBaseUrl(gerritEndpointUrl);
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
          jsonResultHeader
        );
      expect(await client.getRepos()).toEqual(['repo1', 'repo2']);
    });
  });

  describe('getProjectInfo()', () => {
    it('inactive', () => {
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
          jsonResultHeader
        );
      return expect(client.getProjectInfo('test/repo')).rejects.toThrow(
        REPOSITORY_ARCHIVED
      );
    });

    it('active', () => {
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
          jsonResultHeader
        );
      return expect(client.getProjectInfo('test/repo')).resolves.toEqual({
        id: 'repo1',
        name: 'test-repo',
        state: 'ACTIVE',
      });
    });
  });

  describe('getBranchInfo()', () => {
    it('info', () => {
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/projects/test%2Frepo/branches/HEAD')
        .reply(
          200,
          gerritRestResponse({ ref: 'sha-hash....', revision: 'main' }),
          jsonResultHeader
        );
      return expect(client.getBranchInfo('test/repo')).resolves.toEqual({
        ref: 'sha-hash....',
        revision: 'main',
      });
    });
  });

  describe('findChanges()', () => {
    it('by-label', () => {
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/')
        .query((query) => query?.q?.includes('label:Code-Review=-2') ?? false)
        .reply(
          200,
          gerritRestResponse([{ _number: 1 }, { _number: 2 }]),
          jsonResultHeader
        );

      return expect(
        client.findChanges(['label:Code-Review=-2'])
      ).resolves.toEqual([{ _number: 1 }, { _number: 2 }]);
    });
  });

  describe('getChange()', () => {
    it('get', () => {
      const input = Fixtures.getJson('change-data.json');
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/123456')
        .reply(200, gerritRestResponse(input), jsonResultHeader);
      return expect(client.getChange(123456)).resolves.toEqual(input);
    });
  });

  describe('getChangeDetails()', () => {
    it('get', () => {
      const input = Fixtures.getJson('change-data.json');
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/123456/detail')
        .reply(200, gerritRestResponse(input), jsonResultHeader);
      return expect(client.getChangeDetails(123456)).resolves.toEqual(input);
    });
  });

  describe('getMergeableInfo()', () => {
    it('get', () => {
      const mergeInfo: GerritMergeableInfo = {
        mergeable: true,
        submit_type: 'MERGE_IF_NECESSARY',
      };
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/123456/revisions/current/mergeable')
        .reply(200, gerritRestResponse(mergeInfo), jsonResultHeader);
      const input = Fixtures.getJson('change-data.json');
      return expect(client.getMergeableInfo(input)).resolves.toEqual(mergeInfo);
    });
  });

  describe('abandonChange()', () => {
    it('abandon', () => {
      httpMock
        .scope(gerritEndpointUrl)
        .post('/a/changes/123456/abandon')
        .reply(200, gerritRestResponse({}), jsonResultHeader);
      return expect(client.abandonChange(123456)).toResolve();
    });
  });

  describe('submitChange()', () => {
    it('submit', () => {
      const change = Fixtures.getJson('change-data.json');
      httpMock
        .scope(gerritEndpointUrl)
        .post('/a/changes/123456/submit')
        .reply(200, gerritRestResponse(change), jsonResultHeader);
      return expect(client.submitChange(123456)).resolves.toEqual(change);
    });
  });

  describe('setCommitMessage()', () => {
    it('submit', () => {
      const change = Fixtures.getJson('change-data.json');
      httpMock
        .scope(gerritEndpointUrl)
        .put('/a/changes/123456/message', { message: 'new message' })
        .reply(200, gerritRestResponse(change), jsonResultHeader);
      return expect(client.setCommitMessage(123456, 'new message')).toResolve();
    });
  });

  describe('getMessages()', () => {
    it('no messages', () => {
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/123456/messages')
        .reply(200, gerritRestResponse([]), jsonResultHeader);
      return expect(client.getMessages(123456)).resolves.toEqual([]);
    });

    it('with messages', () => {
      httpMock
        .scope(gerritEndpointUrl)
        .get('/a/changes/123456/messages')
        .reply(
          200,
          gerritRestResponse([
            partial<GerritChangeMessageInfo>({ message: 'msg1' }),
            partial<GerritChangeMessageInfo>({ message: 'msg2' }),
          ]),
          jsonResultHeader
        );
      return expect(client.getMessages(123456)).resolves.toEqual([
        { message: 'msg1' },
        { message: 'msg2' },
      ]);
    });
  });

  describe('addMessage()', () => {
    it('add with tag', () => {
      httpMock
        .scope(gerritEndpointUrl)
        .post('/a/changes/123456/revisions/current/review', {
          message: 'message',
          tag: 'tag',
        })
        .reply(200, gerritRestResponse([]), jsonResultHeader);
      return expect(client.addMessage(123456, 'message', 'tag')).toResolve();
    });

    it('add without tag', () => {
      httpMock
        .scope(gerritEndpointUrl)
        .post('/a/changes/123456/revisions/current/review', {
          message: 'message',
        })
        .reply(200, gerritRestResponse([]), jsonResultHeader);
      return expect(client.addMessage(123456, 'message')).toResolve();
    });
  });

  describe('setLabel', () => {
    it('setLabel', () => {
      httpMock
        .scope(gerritEndpointUrl)
        .post('/a/changes/123456/revisions/current/review', {
          labels: { 'Code-Review': 2 },
        })
        .reply(200, gerritRestResponse([]), jsonResultHeader);
      return expect(client.setLabel(123456, 'Code-Review', +2)).toResolve();
    });
  });

  describe('addReviewer', () => {
    it('add', () => {
      httpMock
        .scope(gerritEndpointUrl)
        .post('/a/changes/123456/reviewers', {
          reviewer: 'username',
        })
        .reply(200, gerritRestResponse([]), jsonResultHeader);
      return expect(client.addReviewer(123456, 'username')).toResolve();
    });
  });

  describe('addAssignee', () => {
    it('add', () => {
      httpMock
        .scope(gerritEndpointUrl)
        .put('/a/changes/123456/assignee', {
          assignee: 'username',
        })
        .reply(200, gerritRestResponse([]), jsonResultHeader);
      return expect(client.addAssignee(123456, 'username')).toResolve();
    });
  });

  describe('getFile()', () => {
    it('getFile() - repo and branch', () => {
      httpMock
        .scope(gerritEndpointUrl)
        .get(
          '/a/projects/test%2Frepo/branches/main/files/renovate.json/content'
        )
        .reply(200, gerritFileResponse('{}'));
      return expect(
        client.getFile('test/repo', 'main', 'renovate.json')
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
