import * as httpMock from '~test/http-mock.ts';
import { GiteaHttp, setBaseUrl } from '../../../util/http/gitea.ts';
import { getLabelList, lookupLabelByName } from './labels.ts';
import type { Label } from './schema.ts';
import type { LabelListRepo } from './types.ts';

describe('modules/platform/gitea/labels', () => {
  const baseUrl = 'https://gitea.renovatebot.com';
  const http = new GiteaHttp();

  const repoLabel: Label = { id: 1, name: 'repo-label' };
  const orgLabel: Label = { id: 2, name: 'org-label' };

  function userRepo(): LabelListRepo {
    return {
      repository: 'some/repo',
      isOrgRepo: false,
      orgName: 'some',
      labelList: null,
    };
  }

  function orgRepo(): LabelListRepo {
    return { ...userRepo(), isOrgRepo: true };
  }

  beforeEach(() => {
    setBaseUrl(baseUrl);
  });

  it('returns repo labels for a user repository', async () => {
    httpMock
      .scope(`${baseUrl}/api/v1`)
      .get('/repos/some/repo/labels')
      .reply(200, [repoLabel]);

    const res = await getLabelList(http, userRepo());

    expect(res).toEqual([repoLabel]);
  });

  it('appends org labels for an organization repository', async () => {
    httpMock
      .scope(`${baseUrl}/api/v1`)
      .get('/repos/some/repo/labels')
      .reply(200, [repoLabel])
      .get('/orgs/some/labels')
      .reply(200, [orgLabel]);

    const res = await getLabelList(http, orgRepo());

    expect(res).toEqual([repoLabel, orgLabel]);
  });

  it('ignores org label errors', async () => {
    httpMock
      .scope(`${baseUrl}/api/v1`)
      .get('/repos/some/repo/labels')
      .reply(200, [repoLabel])
      .get('/orgs/some/labels')
      .reply(404);

    const res = await getLabelList(http, orgRepo());

    expect(res).toEqual([repoLabel]);
  });

  it('caches the label list on the repository', async () => {
    httpMock
      .scope(`${baseUrl}/api/v1`)
      .get('/repos/some/repo/labels')
      .reply(200, [repoLabel]);
    const repo = userRepo();

    await getLabelList(http, repo);
    const res = await getLabelList(http, repo);

    expect(res).toEqual([repoLabel]);
    expect(repo.labelList).not.toBeNull();
  });

  describe('lookupLabelByName', () => {
    it('returns the id of a matching label', async () => {
      httpMock
        .scope(`${baseUrl}/api/v1`)
        .get('/repos/some/repo/labels')
        .reply(200, [repoLabel]);

      const res = await lookupLabelByName(http, userRepo(), 'repo-label');

      expect(res).toBe(1);
    });

    it('returns null for an unknown label', async () => {
      httpMock
        .scope(`${baseUrl}/api/v1`)
        .get('/repos/some/repo/labels')
        .reply(200, [repoLabel]);

      const res = await lookupLabelByName(http, userRepo(), 'missing');

      expect(res).toBeNull();
    });
  });
});
