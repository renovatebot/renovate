import * as httpMock from '~test/http-mock.ts';
import { GithubHttp, setBaseUrl } from '../../../util/http/github.ts';
import { toBase64 } from '../../../util/string.ts';
import { getRepoFile } from './files.ts';

describe('modules/platform/github/files', () => {
  const apiHost = 'https://api.github.com';
  const http = new GithubHttp();

  it('reads a file and decodes its content', async () => {
    httpMock
      .scope(apiHost)
      .get('/repos/some/repo/contents/renovate.json')
      .reply(200, { content: toBase64('{}') });

    const res = await getRepoFile(http, 'some/repo', 'renovate.json', null, {
      baseUrl: `${apiHost}/`,
    });

    expect(res).toBe('{}');
  });

  it('appends the ref when given', async () => {
    httpMock
      .scope(apiHost)
      .get('/repos/some/repo/contents/renovate.json?ref=dev')
      .reply(200, { content: toBase64('{}') });

    const res = await getRepoFile(http, 'some/repo', 'renovate.json', 'dev', {
      baseUrl: `${apiHost}/`,
    });

    expect(res).toBe('{}');
  });

  it('falls back to the client base url', async () => {
    setBaseUrl('https://ghe.example.com/api/v3/');
    httpMock
      .scope('https://ghe.example.com')
      .get('/api/v3/repos/some/repo/contents/renovate.json')
      .reply(200, { content: toBase64('{}') });

    const res = await getRepoFile(http, 'some/repo', 'renovate.json');

    expect(res).toBe('{}');
  });
});
