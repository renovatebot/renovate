import * as httpMock from '~test/http-mock.ts';
import { BitbucketHttp, setBaseUrl } from '../http/bitbucket.ts';
import { getRepoFile } from './files.ts';

describe('util/bitbucket/files', () => {
  const apiHost = 'https://api.bitbucket.org';
  const http = new BitbucketHttp();

  beforeEach(() => {
    setBaseUrl(`${apiHost}/`);
  });

  it('defaults the ref to HEAD and resolves a relative base', async () => {
    httpMock
      .scope(apiHost)
      .get('/2.0/repositories/some/repo/src/HEAD/renovate.json')
      .reply(200, '{}');

    const res = await getRepoFile(http, '/', 'some/repo', 'renovate.json');

    expect(res).toBe('{}');
  });

  it('uses the given ref and API base URL', async () => {
    httpMock
      .scope(apiHost)
      .get('/2.0/repositories/some/repo/src/abc123/docs/CHANGELOG.md')
      .reply(200, '# changelog');

    const res = await getRepoFile(
      http,
      `${apiHost}/`,
      'some/repo',
      'docs/CHANGELOG.md',
      'abc123',
    );

    expect(res).toBe('# changelog');
  });
});
