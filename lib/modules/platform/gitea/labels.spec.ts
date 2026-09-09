import * as httpMock from '~test/http-mock.ts';
import { GiteaHttp, setBaseUrl } from '../../../util/http/gitea.ts';
import { fetchLabelList } from './labels.ts';
import type { Label } from './schema.ts';

describe('modules/platform/gitea/labels', () => {
  const baseUrl = 'https://gitea.renovatebot.com';
  const http = new GiteaHttp();

  const repoLabel: Label = { id: 1, name: 'repo-label' };
  const orgLabel: Label = { id: 2, name: 'org-label' };

  beforeEach(() => {
    setBaseUrl(baseUrl);
  });

  it('returns repo labels for a user repository', async () => {
    httpMock
      .scope(`${baseUrl}/api/v1`)
      .get('/repos/some/repo/labels')
      .reply(200, [repoLabel]);

    const res = await fetchLabelList(http, {
      repository: 'some/repo',
      isOrgRepo: false,
      orgName: 'some',
    });

    expect(res).toEqual([repoLabel]);
  });

  it('appends org labels for an organization repository', async () => {
    httpMock
      .scope(`${baseUrl}/api/v1`)
      .get('/repos/some/repo/labels')
      .reply(200, [repoLabel])
      .get('/orgs/some/labels')
      .reply(200, [orgLabel]);

    const res = await fetchLabelList(http, {
      repository: 'some/repo',
      isOrgRepo: true,
      orgName: 'some',
    });

    expect(res).toEqual([repoLabel, orgLabel]);
  });

  it('ignores org label errors', async () => {
    httpMock
      .scope(`${baseUrl}/api/v1`)
      .get('/repos/some/repo/labels')
      .reply(200, [repoLabel])
      .get('/orgs/some/labels')
      .reply(404);

    const res = await fetchLabelList(http, {
      repository: 'some/repo',
      isOrgRepo: true,
      orgName: 'some',
    });

    expect(res).toEqual([repoLabel]);
  });
});
